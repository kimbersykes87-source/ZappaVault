#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Export track durations from SQLite database to JSON for use in Cloudflare Workers
"""

import sqlite3
import json
import sys
from pathlib import Path

# Set UTF-8 encoding for output on Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')


def export_durations_to_json(db_path='zappa_tracks.db', output_path='webapp/data/track_durations.json'):
    """Export track durations to JSON file"""
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Query all tracks with their file paths and durations
        cursor.execute('''
            SELECT file_path, duration_seconds
            FROM Tracks
            WHERE duration_seconds IS NOT NULL AND duration_seconds > 0
        ''')
        
        # Create a map: file_path -> duration_ms
        durations = {}
        for file_path, duration_seconds in cursor.fetchall():
            if duration_seconds:
                # Convert to milliseconds
                duration_ms = int(duration_seconds * 1000)
                
                # Normalize file path (handle both Windows and Dropbox paths)
                normalized_path = file_path.replace('\\', '/')
                
                # Convert Windows paths to Dropbox paths
                if normalized_path.startswith('C:/') or normalized_path.startswith('c:/'):
                    # Find /Dropbox/ in the path
                    dropbox_index = normalized_path.lower().find('/dropbox/')
                    if dropbox_index != -1:
                        normalized_path = normalized_path[dropbox_index + len('/dropbox'):]
                    else:
                        # Try to find ZappaLibrary
                        zappa_index = normalized_path.lower().find('zappalibrary')
                        if zappa_index != -1:
                            normalized_path = normalized_path[zappa_index:]
                            # Normalize slashes before using in f-string
                            normalized_path = normalized_path.replace('\\', '/')
                            normalized_path = f"/Apps/ZappaVault/{normalized_path}"
                
                # Ensure path starts with /
                if not normalized_path.startswith('/'):
                    normalized_path = '/' + normalized_path
                
                # Normalize slashes
                normalized_path = normalized_path.replace('\\', '/')
                
                # Store both original and lowercase for case-insensitive matching
                durations[normalized_path] = duration_ms
                durations[normalized_path.lower()] = duration_ms
        
        conn.close()
        
        # Write to JSON file
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(durations, f, indent=2, ensure_ascii=False)
        
        unique_tracks = len(durations) // 2
        print(f"✅ Exported {unique_tracks} track durations to {output_path}")
        return True
        
    except FileNotFoundError:
        print(f"❌ Database file not found: {db_path}")
        return False
    except Exception as e:
        print(f"❌ Error exporting durations: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == '__main__':
    # Allow override of paths via command line
    db_path = sys.argv[1] if len(sys.argv) > 1 else 'zappa_tracks.db'
    output_path = sys.argv[2] if len(sys.argv) > 2 else 'webapp/data/track_durations.json'
    
    success = export_durations_to_json(db_path, output_path)
    sys.exit(0 if success else 1)

