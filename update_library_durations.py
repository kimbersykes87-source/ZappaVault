#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Update track durations in library.generated.json from the track_durations.json database
This merges the duration data into the library file without needing to regenerate it
"""

import json
import sys
from pathlib import Path

# Set UTF-8 encoding for output on Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')


def normalize_path(path: str) -> str:
    """Normalize a file path for matching"""
    # Normalize slashes
    normalized = path.replace('\\', '/')
    # Ensure starts with /
    if not normalized.startswith('/'):
        normalized = '/' + normalized
    return normalized


def find_duration(file_path: str, durations: dict) -> int:
    """Find duration for a file path, trying multiple matching strategies"""
    normalized = normalize_path(file_path)
    
    # Try exact match
    if normalized in durations:
        return durations[normalized]
    
    # Try lowercase match
    if normalized.lower() in durations:
        return durations[normalized.lower()]
    
    # Try matching by filename
    file_name = normalized.split('/')[-1] if '/' in normalized else normalized
    if file_name:
        for db_path, duration in durations.items():
            db_file_name = db_path.split('/')[-1] if '/' in db_path else db_path
            if db_file_name.lower() == file_name.lower():
                return duration
    
    return 0


def update_library_durations(
    library_path: str = 'webapp/data/library.generated.json',
    durations_path: str = 'webapp/data/track_durations.json'
):
    """Update track durations in library file from durations database"""
    
    # Load durations database
    durations_file = Path(durations_path)
    if not durations_file.exists():
        print(f"❌ Durations file not found: {durations_path}")
        return False
    
    with open(durations_file, 'r', encoding='utf-8') as f:
        durations = json.load(f)
    
    print(f"✅ Loaded {len(durations) // 2} track durations from database")
    
    # Load library file
    library_file = Path(library_path)
    if not library_file.exists():
        print(f"❌ Library file not found: {library_path}")
        return False
    
    with open(library_file, 'r', encoding='utf-8') as f:
        library = json.load(f)
    
    print(f"✅ Loaded library with {library['albumCount']} albums, {library['trackCount']} tracks")
    
    # Update durations
    updated_count = 0
    total_duration = 0
    
    for album in library['albums']:
        album_duration = 0
        for track in album['tracks']:
            file_path = track.get('filePath', '')
            if file_path:
                duration_ms = find_duration(file_path, durations)
                if duration_ms > 0:
                    old_duration = track.get('durationMs', 0)
                    track['durationMs'] = duration_ms
                    album_duration += duration_ms
                    if old_duration == 0:
                        updated_count += 1
                        print(f"  ✅ Updated: {track['title']} ({duration_ms // 1000}s)")
        
        # Update album total duration
        if album_duration > 0:
            album['totalDurationMs'] = album_duration
            total_duration += album_duration
    
    # Update library totals
    library['totalDurationMs'] = total_duration
    
    # Save updated library
    with open(library_file, 'w', encoding='utf-8') as f:
        json.dump(library, f, indent=2, ensure_ascii=False)
    
    print(f"\n✅ Updated {updated_count} track durations")
    print(f"✅ Total library duration: {total_duration // 1000 // 60} minutes")
    print(f"✅ Saved updated library to {library_path}")
    
    return True


if __name__ == '__main__':
    library_path = sys.argv[1] if len(sys.argv) > 1 else 'webapp/data/library.generated.json'
    durations_path = sys.argv[2] if len(sys.argv) > 2 else 'webapp/data/track_durations.json'
    
    success = update_library_durations(library_path, durations_path)
    sys.exit(0 if success else 1)

