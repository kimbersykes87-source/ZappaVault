#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Create a database of every track and its track length by album from ZappaLibrary
"""

import os
import sys
import sqlite3
from pathlib import Path
from typing import Optional, Tuple

# Set UTF-8 encoding for output on Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

try:
    from mutagen import File as MutagenFile
    from mutagen.mp3 import MP3
    from mutagen.flac import FLAC
    from mutagen.mp4 import MP4
except ImportError:
    print("Error: mutagen library not found. Please install it with: pip install mutagen")
    sys.exit(1)

# Audio file extensions to scan
AUDIO_EXTENSIONS = {'.mp3', '.flac', '.wav', '.m4a', '.ogg', '.mp4', '.aac'}
DATABASE_FILE = 'zappa_tracks.db'


def get_track_duration(file_path: Path) -> Optional[float]:
    """
    Extract track duration from audio file using mutagen.
    Returns duration in seconds, or None if unable to read.
    """
    try:
        audio_file = MutagenFile(str(file_path))
        if audio_file is None:
            return None
        
        # Get duration from the file
        if hasattr(audio_file, 'info') and hasattr(audio_file.info, 'length'):
            duration = audio_file.info.length
            return duration if duration > 0 else None
        
        return None
    except Exception as e:
        print(f"  Warning: Could not read duration from {file_path.name}: {e}")
        return None


def extract_track_info(file_path: Path) -> Tuple[Optional[str], Optional[int]]:
    """
    Extract track title and track number from filename or metadata.
    Returns (title, track_number)
    """
    # Try to get from metadata first
    try:
        audio_file = MutagenFile(str(file_path))
        if audio_file:
            title = None
            track_num = None
            
            # Try common tag fields
            if 'TIT2' in audio_file or 'TITLE' in audio_file:
                title_tag = audio_file.get('TIT2') or audio_file.get('TITLE')
                if title_tag:
                    title = str(title_tag[0]) if isinstance(title_tag, list) else str(title_tag)
            
            if 'TRCK' in audio_file or 'TRACKNUMBER' in audio_file:
                track_tag = audio_file.get('TRCK') or audio_file.get('TRACKNUMBER')
                if track_tag:
                    track_str = str(track_tag[0]) if isinstance(track_tag, list) else str(track_tag)
                    # Handle formats like "1/12" or just "1"
                    track_num = int(track_str.split('/')[0])
            
            if title:
                return (title, track_num)
    except Exception:
        pass
    
    # Fallback: extract from filename
    filename = file_path.stem  # filename without extension
    
    # Try to match patterns like "01 - Track Name" or "01. Track Name" or "Track Name"
    import re
    match = re.match(r'^(\d+)[\s\.\-]*(.+)$', filename)
    if match:
        track_num = int(match.group(1))
        title = match.group(2).strip()
        return (title, track_num)
    
    # If no number found, use whole filename as title
    return (filename, None)


def format_duration(seconds: float) -> str:
    """Format duration in seconds to MM:SS or HH:MM:SS format"""
    if seconds is None:
        return "00:00"
    
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    else:
        return f"{minutes:02d}:{secs:02d}"


def init_database(db_path: str):
    """Initialize SQLite database with schema"""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create Albums table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS Albums (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            path TEXT NOT NULL
        )
    ''')
    
    # Create Tracks table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS Tracks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            album_id INTEGER NOT NULL,
            track_number INTEGER,
            title TEXT NOT NULL,
            duration_seconds REAL,
            file_path TEXT NOT NULL,
            file_name TEXT NOT NULL,
            FOREIGN KEY (album_id) REFERENCES Albums (id) ON DELETE CASCADE
        )
    ''')
    
    # Create indexes
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_tracks_album ON Tracks (album_id)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_tracks_number ON Tracks (album_id, track_number)')
    
    conn.commit()
    return conn


def scan_library(library_path: Path, db_conn: sqlite3.Connection):
    """Scan ZappaLibrary directory and populate database"""
    cursor = db_conn.cursor()
    
    # Get all album directories (direct subdirectories of ZappaLibrary)
    album_dirs = [d for d in library_path.iterdir() if d.is_dir() and not d.name.startswith('.')]
    
    print(f"Found {len(album_dirs)} album directories")
    print("=" * 80)
    
    total_tracks = 0
    total_duration = 0.0
    
    for album_dir in sorted(album_dirs):
        album_name = album_dir.name
        
        # Skip Cover directories and other non-album folders
        if album_name.lower() in ['cover', 'covers']:
            continue
        
        print(f"\nProcessing album: {album_name}")
        
        # Get or create album in database
        cursor.execute('SELECT id FROM Albums WHERE name = ?', (album_name,))
        album_row = cursor.fetchone()
        if album_row:
            album_id = album_row[0]
        else:
            cursor.execute('INSERT INTO Albums (name, path) VALUES (?, ?)', 
                         (album_name, str(album_dir)))
            album_id = cursor.lastrowid
            db_conn.commit()
        
        # Find all audio files in this album directory (including subdirectories like CD 1, CD 2)
        audio_files = []
        for ext in AUDIO_EXTENSIONS:
            audio_files.extend(album_dir.rglob(f'*{ext}'))
            audio_files.extend(album_dir.rglob(f'*{ext.upper()}'))
        
        # Filter out files in Cover directories
        audio_files = [f for f in audio_files if 'cover' not in str(f).lower()]
        
        if not audio_files:
            print(f"  No audio files found")
            continue
        
        print(f"  Found {len(audio_files)} audio file(s)")
        
        album_tracks = 0
        album_duration = 0.0
        
        # Process each audio file
        for audio_file in sorted(audio_files):
            # Check if track already exists
            cursor.execute('SELECT id FROM Tracks WHERE file_path = ?', (str(audio_file),))
            if cursor.fetchone():
                print(f"  Skipping (already in DB): {audio_file.name}")
                continue
            
            # Extract track info
            title, track_num = extract_track_info(audio_file)
            if not title:
                title = audio_file.stem
            
            # Get duration
            duration = get_track_duration(audio_file)
            
            # Insert track into database
            cursor.execute('''
                INSERT INTO Tracks (album_id, track_number, title, duration_seconds, file_path, file_name)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (album_id, track_num, title, duration, str(audio_file), audio_file.name))
            
            duration_str = format_duration(duration) if duration else "Unknown"
            track_info = f"  [{track_num:02d}]" if track_num else "  [--]"
            print(f"{track_info} {title} ({duration_str})")
            
            album_tracks += 1
            if duration:
                album_duration += duration
        
        db_conn.commit()
        
        album_duration_str = format_duration(album_duration)
        print(f"  Album total: {album_tracks} tracks, {album_duration_str}")
        
        total_tracks += album_tracks
        total_duration += album_duration
    
    print("\n" + "=" * 80)
    print(f"Scan complete!")
    print(f"Total albums: {len(album_dirs)}")
    print(f"Total tracks: {total_tracks}")
    print(f"Total duration: {format_duration(total_duration)}")
    print(f"\nDatabase saved to: {DATABASE_FILE}")


def generate_report(db_conn: sqlite3.Connection, output_file: str = 'track_database_report.txt'):
    """Generate a text report of all tracks by album"""
    cursor = db_conn.cursor()
    
    cursor.execute('''
        SELECT a.name, a.id
        FROM Albums a
        ORDER BY a.name
    ''')
    
    albums = cursor.fetchall()
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("ZAPPA LIBRARY TRACK DATABASE REPORT\n")
        f.write("=" * 80 + "\n\n")
        
        total_tracks = 0
        total_duration = 0.0
        
        for album_name, album_id in albums:
            cursor.execute('''
                SELECT track_number, title, duration_seconds
                FROM Tracks
                WHERE album_id = ?
                ORDER BY track_number NULLS LAST, title
            ''', (album_id,))
            
            tracks = cursor.fetchall()
            
            if not tracks:
                continue
            
            f.write(f"\n{album_name}\n")
            f.write("-" * 80 + "\n")
            
            album_duration = 0.0
            
            for track_num, title, duration in tracks:
                track_num_str = f"{track_num:02d}" if track_num else "??"
                duration_str = format_duration(duration) if duration else "??:??"
                f.write(f"  {track_num_str}. {title} ({duration_str})\n")
                
                if duration:
                    album_duration += duration
                total_tracks += 1
            
            f.write(f"\n  Album Total: {len(tracks)} tracks, {format_duration(album_duration)}\n")
            
            if album_duration:
                total_duration += album_duration
        
        f.write("\n" + "=" * 80 + "\n")
        f.write(f"GRAND TOTAL: {total_tracks} tracks, {format_duration(total_duration)}\n")
    
    print(f"\nReport generated: {output_file}")


def main():
    """Main function"""
    # Get ZappaLibrary path
    if len(sys.argv) > 1:
        library_path = Path(sys.argv[1])
    else:
        # Default to ZappaLibrary in the workspace
        workspace_path = Path(__file__).parent
        library_path = workspace_path / 'ZappaLibrary'
    
    if not library_path.exists():
        print(f"Error: Library path does not exist: {library_path}")
        print(f"Usage: python {sys.argv[0]} [path_to_ZappaLibrary]")
        sys.exit(1)
    
    print(f"ZappaLibrary Track Database Creator")
    print("=" * 80)
    print(f"Library path: {library_path}")
    print(f"Database file: {DATABASE_FILE}")
    print()
    
    # Initialize database
    db_conn = init_database(DATABASE_FILE)
    
    try:
        # Scan library
        scan_library(library_path, db_conn)
        
        # Generate report
        generate_report(db_conn)
        
    finally:
        db_conn.close()
    
    print("\nDone!")


if __name__ == '__main__':
    main()


