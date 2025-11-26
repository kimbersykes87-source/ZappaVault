#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json
import urllib.request
import sys

# Fix encoding for Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Check library-data endpoint
print("Checking /api/library-data endpoint...")
try:
    with urllib.request.urlopen('https://zappavault.pages.dev/api/library-data') as response:
        library_data = json.loads(response.read())
        album = [a for a in library_data['albums'] if 'apostrophe' in a['id'].lower()][0]
        print(f"\n✅ Library Data - Album: {album['title']}")
        print(f"   Total tracks: {len(album['tracks'])}")
        for track in album['tracks']:
            duration_sec = track['durationMs'] // 1000
            duration_min = duration_sec // 60
            duration_sec_remainder = duration_sec % 60
            status = "✅" if track['durationMs'] > 0 else "❌"
            print(f"   {status} Track {track['trackNumber']}: {track['title']} - {duration_min}:{duration_sec_remainder:02d} ({track['durationMs']}ms)")
except Exception as e:
    print(f"❌ Error loading library-data: {e}")

# Check albums API endpoint
print("\n\nChecking /api/albums/[id] endpoint...")
try:
    with urllib.request.urlopen('https://zappavault.pages.dev/api/albums/apps-zappavault-zappalibrary-apostrophe?links=1') as response:
        album_data = json.loads(response.read())
        # Handle nested response structure
        album = album_data.get('album', album_data)
        if 'title' in album:
            print(f"✅ Albums API - Album: {album['title']}")
            print(f"   Total tracks: {len(album['tracks'])}")
            for track in album['tracks']:
                duration_sec = track['durationMs'] // 1000
                duration_min = duration_sec // 60
                duration_sec_remainder = duration_sec % 60
                status = "✅" if track['durationMs'] > 0 else "❌"
                print(f"   {status} Track {track['trackNumber']}: {track['title']} - {duration_min}:{duration_sec_remainder:02d} ({track['durationMs']}ms)")
        else:
            print(f"❌ Unexpected response structure: {json.dumps(album_data, indent=2)[:500]}")
except Exception as e:
    print(f"❌ Error loading albums API: {e}")
    import traceback
    traceback.print_exc()

