#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate Dropbox permanent links for all tracks and album covers, and add them to the comprehensive library.

This script:
1. Loads the comprehensive library file
2. For each track, generates a Dropbox permanent link
3. For each album cover, generates a Dropbox permanent link (if coverUrl is a Dropbox path)
4. Updates the comprehensive library with streamingUrl, downloadUrl, and coverUrl
5. Saves the updated library

This eliminates the need to generate links at runtime, solving timeout issues.
"""
import json
import sys
import os
import time
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple
import requests
import io

# Set UTF-8 encoding for output on Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Normalize the configured Dropbox library root so we can trim it from file paths
RAW_DROPBOX_LIBRARY_ROOT = os.environ.get('DROPBOX_LIBRARY_PATH', '').strip()
DROPBOX_LIBRARY_ROOT = RAW_DROPBOX_LIBRARY_ROOT.replace('\\', '/').rstrip('/') if RAW_DROPBOX_LIBRARY_ROOT else ''
DROPBOX_APP_FOLDER = ''
if DROPBOX_LIBRARY_ROOT.lower().startswith('/apps/'):
    parts = [segment for segment in DROPBOX_LIBRARY_ROOT.split('/') if segment]
    if len(parts) >= 2:
        DROPBOX_APP_FOLDER = f"/{parts[0]}/{parts[1]}"

def get_dropbox_token() -> Optional[str]:
    """Get valid Dropbox access token using refresh token"""
    refresh_token = os.environ.get('DROPBOX_REFRESH_TOKEN')
    app_key = os.environ.get('DROPBOX_APP_KEY')
    app_secret = os.environ.get('DROPBOX_APP_SECRET')
    
    if not all([refresh_token, app_key, app_secret]):
        print("⚠️  Dropbox refresh token credentials not found in environment")
        print("   Set DROPBOX_REFRESH_TOKEN, DROPBOX_APP_KEY, and DROPBOX_APP_SECRET")
        return None
    
    try:
        # Exchange refresh token for access token
        response = requests.post(
            'https://api.dropbox.com/oauth2/token',
            data={
                'grant_type': 'refresh_token',
                'refresh_token': refresh_token,
            },
            auth=(app_key, app_secret),
            timeout=30
        )
        
        if response.ok:
            data = response.json()
            return data.get('access_token')
        else:
            print(f"❌ Failed to refresh Dropbox token: {response.status_code} {response.text}")
            return None
    except Exception as e:
        print(f"❌ Error refreshing Dropbox token: {e}")
        return None

def _normalize_path(path: str) -> str:
    """Normalize any filesystem path into a Dropbox-style absolute path."""
    normalized = path.strip().replace('\\', '/')
    while '//' in normalized:
        normalized = normalized.replace('//', '/')
    
    if normalized.lower().startswith('c:/'):
        dropbox_idx = normalized.lower().find('/dropbox/')
        if dropbox_idx != -1:
            normalized = normalized[dropbox_idx + len('/dropbox'):]
    
    if not normalized.startswith('/'):
        normalized = '/' + normalized
    
    return normalized


def get_dropbox_path_candidates(file_path: str) -> List[str]:
    """
    Generate potential Dropbox API paths for a given library path.

    Accounts for differences between full Dropbox tokens (which expect /Apps/...)
    and app-folder tokens (which expect paths relative to the app folder).
    """
    normalized = _normalize_path(file_path)
    candidates: List[str] = []

    def add_candidate(path: str) -> None:
        if not path or path == '/':
            return
        candidate = path if path.startswith('/') else f'/{path}'
        while '//' in candidate:
            candidate = candidate.replace('//', '/')
        if candidate not in candidates:
            candidates.append(candidate)

    add_candidate(normalized)

    if DROPBOX_LIBRARY_ROOT:
        root_normalized = _normalize_path(DROPBOX_LIBRARY_ROOT)
        if normalized.lower().startswith(root_normalized.lower()):
            trimmed = normalized[len(root_normalized):]
            add_candidate(trimmed)

    if DROPBOX_APP_FOLDER and normalized.lower().startswith(DROPBOX_APP_FOLDER.lower()):
        trimmed = normalized[len(DROPBOX_APP_FOLDER):]
        add_candidate(trimmed)

    parts = [segment for segment in normalized.split('/') if segment]
    if len(parts) > 2 and parts[0].lower() == 'apps':
        trimmed = '/' + '/'.join(parts[2:])
        add_candidate(trimmed)

    return candidates

def force_fix_image_url(url: str) -> str:
    """Aggressively fix image URLs to have raw=1 instead of dl=0 or dl=1"""
    if not url or not url.startswith('http'):
        return url
    
    # Check if it's an image URL
    image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tif', '.tiff']
    is_image = any(ext in url.lower() for ext in image_extensions)
    
    if not is_image:
        return url
    
    # Force fix: replace dl=0 or dl=1 with raw=1
    fixed = url
    if 'dl=0' in fixed:
        fixed = fixed.replace('dl=0', 'raw=1')
        print(f"  [FIX] Replaced dl=0 with raw=1: {url[:80]}...")
    elif 'dl=1' in fixed and is_image:
        fixed = fixed.replace('dl=1', 'raw=1')
        print(f"  [FIX] Replaced dl=1 with raw=1: {url[:80]}...")
    
    # Ensure raw=1 is present (in case it was missing)
    if 'raw=1' not in fixed and is_image:
        if '?' in fixed:
            fixed = fixed + '&raw=1'
        else:
            fixed = fixed + '?raw=1'
    
    return fixed

def convert_to_direct_link(shared_url: str, is_audio: bool = True) -> str:
    """Convert Dropbox shared link to direct download link"""
    # CRITICAL: Check at the START if URL has image extension AND contains dl=0 or dl=1
    # If so, immediately fix it using simple string replacement (most reliable)
    image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tif', '.tiff']
    is_image = any(ext in shared_url.lower() for ext in image_extensions)
    
    if is_image and ('dl=0' in shared_url or 'dl=1' in shared_url):
        # Use simple string replacement for maximum reliability
        fixed = shared_url
        if 'dl=0' in fixed:
            fixed = fixed.replace('dl=0', 'raw=1')
        elif 'dl=1' in fixed:
            fixed = fixed.replace('dl=1', 'raw=1')
        print(f"  [CONVERT] Fixed image URL: {shared_url[:60]}... -> {fixed[:60]}...")
        return fixed
    
    # Check if it's an scl/fo or scl/fi link (newer Dropbox format)
    if 'scl/fo/' in shared_url or 'scl/fi/' in shared_url:
        # For scl/fo and scl/fi links, keep them on www.dropbox.com
        # Use ?raw=1 for images, ?dl=1 for audio files
        try:
            from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
            url = urlparse(shared_url)
            query_params = parse_qs(url.query)
            # Remove both dl and raw parameters if present (we'll set the correct one)
            if 'dl' in query_params:
                del query_params['dl']
            if 'raw' in query_params:
                del query_params['raw']
            # Add appropriate parameter - raw=1 for images, dl=1 for audio
            if is_audio:
                query_params['dl'] = ['1']
            else:
                query_params['raw'] = ['1']
            # Reconstruct URL
            new_query = urlencode(query_params, doseq=True)
            return urlunparse((url.scheme, url.netloc, url.path, url.params, new_query, url.fragment))
        except Exception:
            # If parsing fails, replace dl=0 with raw=1 for images, or append correct param
            if is_audio:
                # For audio, replace dl=0 with dl=1 or append dl=1
                if 'dl=0' in shared_url:
                    return shared_url.replace('dl=0', 'dl=1')
                suffix = 'dl=1'
            else:
                # For images, replace dl=0 with raw=1 or append raw=1
                if 'dl=0' in shared_url:
                    return shared_url.replace('dl=0', 'raw=1')
                suffix = 'raw=1'
            return f"{shared_url.rstrip('?&')}{'&' if '?' in shared_url else '?'}{suffix}"
    else:
        # Regular links: convert to dl.dropboxusercontent.com
        # https://www.dropbox.com/s/abc123/file.mp3?dl=0
        # -> https://dl.dropboxusercontent.com/s/abc123/file.mp3
        url = shared_url.replace('www.dropbox.com', 'dl.dropboxusercontent.com')
        url = url.split('?')[0]  # Remove query parameters
        return url

def _attempt_link_for_path(
    token: str,
    dropbox_path: str,
    file_path: str,
    is_audio: bool,
    errors: list,
) -> Tuple[Optional[str], bool]:
    """
    Attempt to fetch or create a Dropbox shared link for a single path candidate.

    Returns (link, retry_flag). When retry_flag is True, callers should try the next candidate path.
    """
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
    }

    try:
        metadata_response = requests.post(
            'https://api.dropboxapi.com/2/files/get_metadata',
            headers=headers,
            json={'path': dropbox_path},
            timeout=30,
        )

        if not metadata_response.ok:
            content_type = metadata_response.headers.get('content-type', '')
            error_data = metadata_response.json() if content_type.startswith('application/json') else {}
            error_tag = error_data.get('error', {}).get('.tag', 'unknown')
            path_tag = error_data.get('error', {}).get('path', {}).get('.tag')

            if metadata_response.status_code == 409 and error_tag == 'path' and path_tag == 'not_found':
                print(f"   ⚠️  File not found at {dropbox_path}, trying alternate path...")
                return None, True

            error_msg = f"Failed to fetch metadata for {dropbox_path}: {metadata_response.status_code} {metadata_response.text[:200]}"
            errors.append(error_msg)
            print(f"   ❌ {error_msg}")
            return None, False

        response = requests.post(
            'https://api.dropboxapi.com/2/sharing/list_shared_links',
            headers=headers,
            json={'path': dropbox_path, 'direct_only': False},
            timeout=30,
        )

        if response.ok:
            data = response.json()
            if data.get('links'):
                shared_url = data['links'][0]['url']
                return convert_to_direct_link(shared_url, is_audio), False
        elif response.status_code != 409:
            error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
            print(f"   ⚠️  list_shared_links returned {response.status_code}: {json.dumps(error_data)[:100]}")

        response = requests.post(
            'https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings',
            headers=headers,
            json={
                'path': dropbox_path,
                'settings': {
                    'requested_visibility': {'.tag': 'public'}
                }
            },
            timeout=30,
        )

        if response.ok:
            data = response.json()
            shared_url = data.get('url')
            if shared_url:
                return convert_to_direct_link(shared_url, is_audio), False
        elif response.status_code == 409:
            response = requests.post(
                'https://api.dropboxapi.com/2/sharing/list_shared_links',
                headers=headers,
                json={'path': dropbox_path, 'direct_only': False},
                timeout=30,
            )
            if response.ok:
                data = response.json()
                if data.get('links'):
                    shared_url = data['links'][0]['url']
                    return convert_to_direct_link(shared_url, is_audio), False
        else:
            error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
            error_msg = f"Failed to create link for {dropbox_path}: {response.status_code} {json.dumps(error_data)[:150]}"
            errors.append(error_msg)
            print(f"   ❌ {error_msg}")
            return None, False

        errors.append(f"Failed to get link for {dropbox_path}: unknown error")
        return None, False

    except requests.exceptions.Timeout:
        error_msg = f"Timeout while contacting Dropbox for {dropbox_path}"
        errors.append(error_msg)
        print(f"   ❌ {error_msg}")
        return None, False
    except Exception as exc:
        error_msg = f"Exception getting link for {dropbox_path}: {exc}"
        errors.append(error_msg)
        print(f"   ❌ {error_msg}")
        return None, False


def get_permanent_link(token: str, file_path: str, errors: list) -> Optional[str]:
    """Get or create a Dropbox permanent link for a file, trying multiple path variants."""
    is_audio = not any(ext in file_path.lower() for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp'])
    candidates = get_dropbox_path_candidates(file_path)

    if not candidates:
        error_msg = f"No valid Dropbox path candidates for {file_path}"
        errors.append(error_msg)
        print(f"   ❌ {error_msg}")
        return None

    for candidate in candidates:
        link, retry = _attempt_link_for_path(token, candidate, file_path, is_audio, errors)
        if link:
            return link
        if retry:
            continue
        break

    error_msg = f"Failed to generate link for {file_path} (candidates tried: {', '.join(candidates)})"
    errors.append(error_msg)
    print(f"   ❌ {error_msg}")
    return None

def validate_and_fix_all_covers(library: dict) -> Tuple[int, List[str]]:
    """
    Aggressively validate and fix all cover URLs in the library.
    Returns (fixed_count, invalid_urls)
    """
    fixed_count = 0
    invalid_urls = []
    image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tif', '.tiff']
    
    for album in library.get('albums', []):
        cover_url = album.get('coverUrl', '')
        if not cover_url or not cover_url.startswith('http'):
            continue
        
        # Check if it's an image URL
        is_image = any(ext in cover_url.lower() for ext in image_extensions)
        if not is_image:
            continue
        
        # Check if it has dl=0 or dl=1 (invalid for images)
        if 'dl=0' in cover_url or 'dl=1' in cover_url:
            # Fix it
            fixed_url = force_fix_image_url(cover_url)
            if fixed_url != cover_url:
                album['coverUrl'] = fixed_url
                fixed_count += 1
                print(f"  [VALIDATE] Fixed: {album.get('title', 'Unknown')[:50]}")
            else:
                # Still invalid after fixing attempt
                invalid_urls.append(album.get('title', 'Unknown'))
                print(f"  [VALIDATE] ⚠️  Could not fix: {album.get('title', 'Unknown')[:50]} - {cover_url[:80]}")
    
    return fixed_count, invalid_urls

def generate_track_links(library_path: str, output_path: str, batch_size: int = 10):
    """Generate Dropbox permanent links for all tracks and album covers in the library"""
    print(f"Loading library from: {library_path}")
    with open(library_path, 'r', encoding='utf-8') as f:
        library = json.load(f)
    
    token = get_dropbox_token()
    if not token:
        print("❌ Cannot generate links without Dropbox token")
        return False
    
    errors = []
    tracks_processed = 0
    tracks_with_links = 0
    total_tracks = sum(len(album.get('tracks', [])) for album in library.get('albums', []))
    
    # Process tracks in batches to avoid rate limiting
    all_tracks = []
    for album in library.get('albums', []):
        for track in album.get('tracks', []):
            all_tracks.append((album, track))
    
    print(f"Generating links for all tracks...")
    
    for i in range(0, len(all_tracks), batch_size):
        batch = all_tracks[i:i + batch_size]
        batch_num = (i // batch_size) + 1
        total_batches = (len(all_tracks) + batch_size - 1) // batch_size
        
        print(f"Processing batch {batch_num}/{total_batches} ({len(batch)} tracks)...")
        
        for album, track in batch:
            tracks_processed += 1
            
            # Skip if link already exists
            if track.get('streamingUrl'):
                tracks_with_links += 1
                continue
            
            file_path = track.get('filePath', '')
            if not file_path:
                continue
            
            # Debug: show file path (truncated for security)
            print(f"  Processing: {track.get('trackNumber', '?')}. {track.get('title', 'Unknown')[:50]}")
            print(f"    File path: {file_path[:80]}...")
            
            link = get_permanent_link(token, file_path, errors)
            if link:
                track['streamingUrl'] = link
                track['downloadUrl'] = link
                tracks_with_links += 1
                print(f"  ✅ Track {track.get('trackNumber', '?')}: {track.get('title', 'Unknown')[:50]}")
            else:
                print(f"  ❌ Track {track.get('trackNumber', '?')}: {track.get('title', 'Unknown')[:50]} - Failed")
            
            # Rate limiting - small delay between requests
            time.sleep(0.1)
        
        # Longer delay between batches
        if i + batch_size < len(all_tracks):
            time.sleep(0.5)
    
    print(f"\n✅ Generated links for {tracks_with_links}/{tracks_processed} tracks")
    if errors:
        print(f"⚠️  {len(errors)} errors occurred (showing first 10):")
        for error in errors[:10]:
            print(f"   {error}")
    
    # Now generate cover links
    print(f"\nGenerating links for album covers...")
    covers_processed = 0
    covers_with_links = 0
    total_albums = len(library.get('albums', []))
    
    for album in library.get('albums', []):
        covers_processed += 1
        cover_url = album.get('coverUrl', '')
        
        # Process EVERY HTTP URL through force_fix_image_url() - don't skip any
        if cover_url and cover_url.startswith('http'):
            # Force fix the URL to ensure it has raw=1 instead of dl=0 or dl=1
            fixed_url = force_fix_image_url(cover_url)
            if fixed_url != cover_url:
                album['coverUrl'] = fixed_url
                covers_with_links += 1
                print(f"  ✅ Fixed cover URL for: {album.get('title', 'Unknown')[:50]}")
            else:
                covers_with_links += 1
            continue
        
        # Skip if no coverUrl or not a Dropbox path
        if not cover_url or not cover_url.startswith('/'):
            continue
        
        print(f"  Processing cover for: {album.get('title', 'Unknown')[:50]}")
        print(f"    Cover path: {cover_url[:80]}...")
        
        link = get_permanent_link(token, cover_url, errors)
        if link:
            album['coverUrl'] = link
            covers_with_links += 1
            print(f"  ✅ Cover link generated for: {album.get('title', 'Unknown')[:50]}")
        else:
            print(f"  ❌ Failed to generate cover link for: {album.get('title', 'Unknown')[:50]}")
        
        # Rate limiting - small delay between requests
        time.sleep(0.1)
    
    print(f"\n✅ Generated links for {covers_with_links}/{covers_processed} album covers")
    
    # Aggressive two-pass validation to fix ALL URLs with dl=0 or dl=1
    print(f"\n🔍 Running validation pass 1: Fixing all cover URLs with dl=0 or dl=1...")
    fixed_pass1, invalid_pass1 = validate_and_fix_all_covers(library)
    print(f"  Pass 1: Fixed {fixed_pass1} URLs, {len(invalid_pass1)} still invalid")
    
    fixed_pass2 = 0
    if fixed_pass1 > 0 or len(invalid_pass1) > 0:
        print(f"\n🔍 Running validation pass 2: Verifying all fixes...")
        fixed_pass2, invalid_pass2 = validate_and_fix_all_covers(library)
        print(f"  Pass 2: Fixed {fixed_pass2} URLs, {len(invalid_pass2)} still invalid")
        
        # Final check: count how many still have dl=0 or dl=1
        image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tif', '.tiff']
        still_invalid = []
        for album in library.get('albums', []):
            cover_url = album.get('coverUrl', '')
            if cover_url and cover_url.startswith('http'):
                is_image = any(ext in cover_url.lower() for ext in image_extensions)
                if is_image and ('dl=0' in cover_url or 'dl=1' in cover_url):
                    still_invalid.append(album.get('title', 'Unknown'))
        
        if still_invalid:
            print(f"\n❌ ERROR: {len(still_invalid)} cover URLs still have dl=0 or dl=1 after all fixing attempts:")
            for title in still_invalid[:10]:
                print(f"   - {title}")
            if len(still_invalid) > 10:
                print(f"   ... and {len(still_invalid) - 10} more")
            return False
        else:
            print(f"\n✅ All cover URLs validated successfully - all have raw=1")
    else:
        print(f"\n✅ All cover URLs already correct - no fixes needed")
    
    # Update metadata
    library['generatedAt'] = __import__('datetime').datetime.utcnow().isoformat() + 'Z'
    library['hasLinks'] = tracks_with_links > 0
    library['hasCoverLinks'] = covers_with_links > 0
    
    # Comprehensive statistics
    print(f"\n📊 Final Statistics:")
    print(f"  Tracks: {tracks_with_links}/{tracks_processed} with links")
    
    # Count cover statistics
    total_covers = len(library.get('albums', []))
    covers_http = 0
    covers_raw1 = 0
    covers_dl0 = 0
    covers_dl1 = 0
    covers_no_url = 0
    image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tif', '.tiff']
    
    for album in library.get('albums', []):
        cover_url = album.get('coverUrl', '')
        if not cover_url:
            covers_no_url += 1
        elif cover_url.startswith('http'):
            covers_http += 1
            is_image = any(ext in cover_url.lower() for ext in image_extensions)
            if is_image:
                if 'raw=1' in cover_url:
                    covers_raw1 += 1
                elif 'dl=0' in cover_url:
                    covers_dl0 += 1
                elif 'dl=1' in cover_url:
                    covers_dl1 += 1
    
    print(f"  Covers: {total_covers} total")
    print(f"    - HTTP URLs: {covers_http}")
    print(f"    - With raw=1: {covers_raw1}")
    print(f"    - With dl=0: {covers_dl0} (INVALID)")
    print(f"    - With dl=1: {covers_dl1} (INVALID)")
    print(f"    - No URL: {covers_no_url}")
    print(f"    - Fixed in pass 1: {fixed_pass1}")
    print(f"    - Fixed in pass 2: {fixed_pass2}")
    
    if covers_dl0 > 0 or covers_dl1 > 0:
        print(f"\n❌ ERROR: {covers_dl0 + covers_dl1} covers still have invalid URLs (dl=0 or dl=1)")
        return False
    
    print(f"\nWriting updated library to: {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(library, f, indent=2, ensure_ascii=False)
    
    print(f"✅ Successfully updated library with {tracks_with_links} track links and {covers_with_links} cover links")
    return True

if __name__ == '__main__':
    library_path = sys.argv[1] if len(sys.argv) > 1 else 'webapp/data/library.comprehensive.json'
    output_path = sys.argv[2] if len(sys.argv) > 2 else library_path  # Overwrite by default
    batch_size = int(sys.argv[3]) if len(sys.argv) > 3 else 10
    
    success = generate_track_links(library_path, output_path, batch_size)
    sys.exit(0 if success else 1)

