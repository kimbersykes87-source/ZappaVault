#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import urllib.request
import json
import sys

if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

url = 'https://zappavault.pages.dev/api/albums/apps-zappavault-zappalibrary-apostrophe?links=1'
response = urllib.request.urlopen(url)
data = json.loads(response.read())
album = data.get('album', data)

print(f"Album: {album['title']}")
print(f"Total tracks: {len(album['tracks'])}")
print("\nTrack durations from API:")
for track in album['tracks']:
    duration_sec = track['durationMs'] // 1000
    duration_min = duration_sec // 60
    duration_sec_remainder = duration_sec % 60
    status = "✅" if track['durationMs'] > 0 else "❌"
    print(f"  {status} Track {track['trackNumber']}: {track['title']} - {duration_min}:{duration_sec_remainder:02d} ({track['durationMs']}ms)")

