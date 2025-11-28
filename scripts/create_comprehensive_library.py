#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Create a comprehensive library file that merges:
- Album metadata from library.generated.json
- Track durations from zappa_tracks.db

This becomes the single source of truth for all track information.
"""
import json
import sqlite3
import sys
from pathlib import Path

def normalize_path_for_lookup(file_path):
    """Normalize file path for database lookup"""
    # Convert Windows paths to Dropbox paths
    normalized = file_path.replace('\\', '/')
    
    # Remove Windows drive letters and Dropbox path prefixes
    if normalized.startswith('C:/') or normalized.startswith('c:/'):
        # Find /Dropbox/ in path
        dropbox_idx = normalized.lower().find('/dropbox/')
        if dropbox_idx != -1:
            normalized = normalized[dropbox_idx + len('/dropbox'):]
    
    # Ensure it starts with /
    if not normalized.startswith('/'):
        normalized = '/' + normalized
    
    # Remove /Apps/ZappaVault/ZappaLibrary prefix if present (database uses relative paths)
    if normalized.startswith('/Apps/ZappaVault/ZappaLibrary'):
        normalized = normalized[len('/Apps/ZappaVault/ZappaLibrary'):]
        if not normalized.startswith('/'):
            normalized = '/' + normalized
    
    return normalized

def load_durations_from_db(db_path):
    """Load all track durations from SQLite database"""
    durations = {}
    
    if not Path(db_path).exists():
        print(f"⚠️  Database file not found: {db_path}")
        return durations
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Get all tracks with their file paths and durations (convert seconds to milliseconds)
        cursor.execute("""
            SELECT file_path, duration_seconds
            FROM tracks
            WHERE duration_seconds > 0
        """)
        
        for row in cursor.fetchall():
            file_path, duration_seconds = row
            duration_ms = int(duration_seconds * 1000)  # Convert seconds to milliseconds
            # Normalize path for lookup
            normalized = normalize_path_for_lookup(file_path)
            durations[normalized] = duration_ms
            # Also store lowercase version for case-insensitive lookup
            durations[normalized.lower()] = duration_ms
        
        conn.close()
        print(f"SUCCESS: Loaded {len(durations) // 2} unique track durations from database")
        return durations
    except Exception as e:
        print(f"ERROR: Error loading durations from database: {e}")
        return durations

def get_duration_for_track(track, durations):
    """Get duration for a track, trying multiple path matching strategies"""
    if track.get('durationMs', 0) > 0:
        return track['durationMs']
    
    file_path = track.get('filePath', '')
    if not file_path:
        return 0
    
    # Try exact match
    normalized = normalize_path_for_lookup(file_path)
    duration = durations.get(normalized)
    if duration:
        return duration
    
    # Try lowercase match
    duration = durations.get(normalized.lower())
    if duration:
        return duration
    
    # Try matching by filename
    filename = Path(file_path).name
    for db_path, db_duration in durations.items():
        if db_path.endswith(filename) or db_path.lower().endswith(filename.lower()):
            return db_duration
    
    return 0

def create_comprehensive_library(library_path, db_path, output_path):
    """Create comprehensive library file with all metadata including durations"""
    print(f"Loading library from: {library_path}")
    with open(library_path, 'r', encoding='utf-8') as f:
        library = json.load(f)
    
    print(f"Loading durations from: {db_path}")
    durations = load_durations_from_db(db_path)
    
    print(f"Merging durations into library...")
    updated_count = 0
    total_tracks = 0
    
    for album in library.get('albums', []):
        for track in album.get('tracks', []):
            total_tracks += 1
            old_duration = track.get('durationMs', 0)
            new_duration = get_duration_for_track(track, durations)
            
            if new_duration > 0:
                track['durationMs'] = new_duration
                if old_duration == 0:
                    updated_count += 1
    
    print(f"SUCCESS: Updated {updated_count} tracks with durations (out of {total_tracks} total)")
    
    # Update metadata
    library['generatedAt'] = __import__('datetime').datetime.utcnow().isoformat() + 'Z'
    library['hasDurations'] = updated_count > 0
    
    print(f"Writing comprehensive library to: {output_path}")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(library, f, indent=2, ensure_ascii=False)
    
    # Verify
    tracks_with_durations = sum(
        sum(1 for track in album.get('tracks', []) if track.get('durationMs', 0) > 0)
        for album in library.get('albums', [])
    )
    print(f"SUCCESS: Comprehensive library created: {tracks_with_durations}/{total_tracks} tracks have durations")
    
    return library

if __name__ == '__main__':
    library_path = sys.argv[1] if len(sys.argv) > 1 else 'webapp/data/library.generated.json'
    db_path = sys.argv[2] if len(sys.argv) > 2 else 'zappa_tracks.db'
    output_path = sys.argv[3] if len(sys.argv) > 3 else 'webapp/data/library.comprehensive.json'
    
    create_comprehensive_library(library_path, db_path, output_path)

