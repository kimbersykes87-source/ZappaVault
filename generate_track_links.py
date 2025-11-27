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
from typing import Optional, Dict, Any
import requests
import io

# Set UTF-8 encoding for output on Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

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

def convert_to_dropbox_path(file_path: str) -> str:
    """Convert file path to Dropbox API path format
    
    The library stores paths as /Apps/ZappaVault/ZappaLibrary/...
    These are already in the correct Dropbox API format and should be used as-is.
    """
    # Normalize path separators
    normalized = file_path.replace('\\', '/')
    
    # If it's already a Dropbox path (starts with /Apps/), use it as-is
    if normalized.startswith('/Apps/'):
        return normalized
    
    # Remove Windows drive letters if present
    if normalized.startswith('C:/') or normalized.startswith('c:/'):
        dropbox_idx = normalized.lower().find('/dropbox/')
        if dropbox_idx != -1:
            normalized = normalized[dropbox_idx + len('/dropbox'):]
        else:
            # Try to find Apps/ZappaVault/ZappaLibrary
            zappa_idx = normalized.lower().find('apps/zappavault/zappalibrary')
            if zappa_idx != -1:
                normalized = normalized[zappa_idx:]
    
    # Ensure it starts with /
    if not normalized.startswith('/'):
        normalized = '/' + normalized
    
    return normalized

def convert_to_direct_link(shared_url: str, is_audio: bool = True) -> str:
    """Convert Dropbox shared link to direct download link"""
    # Check if it's an scl/fo or scl/fi link (newer Dropbox format)
    if 'scl/fo/' in shared_url or 'scl/fi/' in shared_url:
        # For scl/fo and scl/fi links, keep them on www.dropbox.com
        # Use ?raw=1 for images, ?dl=1 for audio files
        try:
            from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
            url = urlparse(shared_url)
            query_params = parse_qs(url.query)
            # Remove dl parameter if present
            if 'dl' in query_params:
                del query_params['dl']
            # Add appropriate parameter
            query_params['dl'] = ['1'] if is_audio else ['0']
            # Reconstruct URL
            new_query = urlencode(query_params, doseq=True)
            return urlunparse((url.scheme, url.netloc, url.path, url.params, new_query, url.fragment))
        except Exception:
            # If parsing fails, just append ?dl=1
            return f"{shared_url.rstrip('?&')}{'&' if '?' in shared_url else '?'}dl=1"
    else:
        # Regular links: convert to dl.dropboxusercontent.com
        # https://www.dropbox.com/s/abc123/file.mp3?dl=0
        # -> https://dl.dropboxusercontent.com/s/abc123/file.mp3
        url = shared_url.replace('www.dropbox.com', 'dl.dropboxusercontent.com')
        url = url.split('?')[0]  # Remove query parameters
        return url

def get_permanent_link(token: str, file_path: str, errors: list) -> Optional[str]:
    """Get or create a Dropbox permanent link for a file"""
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
    }
    
    # Convert path to Dropbox API format
    dropbox_path = convert_to_dropbox_path(file_path)
    
    try:
        # First, verify the file exists by getting its metadata
        metadata_response = requests.post(
            'https://api.dropboxapi.com/2/files/get_metadata',
            headers=headers,
            json={'path': dropbox_path},
            timeout=30
        )
        
        if not metadata_response.ok:
            # File doesn't exist or path is wrong
            error_data = metadata_response.json() if metadata_response.headers.get('content-type', '').startswith('application/json') else {}
            error_tag = error_data.get('error', {}).get('.tag', 'unknown')
            if error_tag == 'path' and error_data.get('error', {}).get('path', {}).get('.tag') == 'not_found':
                error_msg = f"File not found at path: {dropbox_path}"
                errors.append(error_msg)
                print(f"   ❌ {error_msg}")
                return None
        
        # File exists, now try to get existing shared link
        response = requests.post(
            'https://api.dropboxapi.com/2/sharing/list_shared_links',
            headers=headers,
            json={'path': dropbox_path, 'direct_only': False},
            timeout=30
        )
        
        if response.ok:
            data = response.json()
            if data.get('links') and len(data['links']) > 0:
                shared_url = data['links'][0]['url']
                is_audio = not any(ext in file_path.lower() for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp'])
                direct_link = convert_to_direct_link(shared_url, is_audio)
                return direct_link
        elif response.status_code == 409:
            # 409 from list_shared_links usually means no link exists yet, try to create one
            pass
        else:
            # Other error from list_shared_links, log but continue to try creating
            error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
            print(f"   ⚠️  list_shared_links returned {response.status_code}: {json.dumps(error_data)[:100]}")
        
        # If no existing link, create a new one
        response = requests.post(
            'https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings',
            headers=headers,
            json={
                'path': dropbox_path,
                'settings': {
                    'requested_visibility': {'.tag': 'public'}
                }
            },
            timeout=30
        )
        
        if response.ok:
            data = response.json()
            shared_url = data.get('url')
            if shared_url:
                is_audio = not any(ext in file_path.lower() for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp'])
                direct_link = convert_to_direct_link(shared_url, is_audio)
                return direct_link
        elif response.status_code == 409:
            # Link already exists (race condition), try to get it again
            response = requests.post(
                'https://api.dropboxapi.com/2/sharing/list_shared_links',
                headers=headers,
                json={'path': dropbox_path, 'direct_only': False},
                timeout=30
            )
            if response.ok:
                data = response.json()
                if data.get('links') and len(data['links']) > 0:
                    shared_url = data['links'][0]['url']
                    is_audio = not any(ext in file_path.lower() for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp'])
                    direct_link = convert_to_direct_link(shared_url, is_audio)
                    return direct_link
        
        # Log the error
        error_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
        error_msg = f"Failed to get link for {file_path}: {response.status_code} {json.dumps(error_data)[:200]}"
        errors.append(error_msg)
        print(f"   ❌ {error_msg}")
        return None
        
    except Exception as e:
        error_msg = f"Exception getting link for {file_path}: {str(e)}"
        errors.append(error_msg)
        print(f"   ❌ {error_msg}")
        return None

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
        
        # Skip if already has HTTP URL
        if cover_url and cover_url.startswith('http'):
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
    
    # Update metadata
    library['generatedAt'] = __import__('datetime').datetime.utcnow().isoformat() + 'Z'
    library['hasLinks'] = tracks_with_links > 0
    library['hasCoverLinks'] = covers_with_links > 0
    
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

