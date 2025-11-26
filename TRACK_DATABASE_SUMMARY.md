# ZappaLibrary Track Database - Summary

## Overview
Created a comprehensive database of all tracks and their lengths organized by album from the ZappaLibrary directory.

## What Was Created

### 1. Python Script: `create_track_database.py`
A Python script that:
- Scans the ZappaLibrary directory recursively
- Extracts track metadata (title, track number, duration) from audio files
- Organizes tracks by album (using folder structure)
- Creates a SQLite database with all track information
- Generates a human-readable text report

### 2. SQLite Database: `zappa_tracks.db`
A SQLite database containing:
- **Albums table**: Album names and paths
- **Tracks table**: Track information including:
  - Track number
  - Title
  - Duration (in seconds)
  - File path
  - File name
  - Foreign key relationship to Albums

### 3. Text Report: `track_database_report.txt`
A formatted text file listing all tracks organized by album with durations.

## Database Statistics
- **Total Albums**: 102
- **Total Tracks**: 1,897
- **Total Duration**: 148 hours, 12 minutes, 17 seconds

## Technical Details

### Dependencies
- **mutagen**: Python library for reading audio file metadata
  - Installed via: `pip install mutagen`

### Supported Audio Formats
- MP3
- FLAC
- WAV
- M4A
- OGG
- MP4
- AAC

### Features
- Automatically extracts track durations from audio file metadata
- Handles multi-disc albums (CD 1, CD 2, etc.)
- Skips files in "Cover" directories
- Extracts track numbers and titles from filenames if metadata is missing
- Prevents duplicate entries (skips files already in database)
- Formats durations as MM:SS or HH:MM:SS

## Database Schema

### Albums Table
```sql
CREATE TABLE Albums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    path TEXT NOT NULL
)
```

### Tracks Table
```sql
CREATE TABLE Tracks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    album_id INTEGER NOT NULL,
    track_number INTEGER,
    title TEXT NOT NULL,
    duration_seconds REAL,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    FOREIGN KEY (album_id) REFERENCES Albums (id) ON DELETE CASCADE
)
```

### Indexes
- `idx_tracks_album` on `Tracks(album_id)`
- `idx_tracks_number` on `Tracks(album_id, track_number)`

## Usage

### Running the Script
```bash
python create_track_database.py [path_to_ZappaLibrary]
```

If no path is provided, it defaults to `./ZappaLibrary` relative to the script location.

### Querying the Database

Example SQL queries:

```sql
-- List all albums
SELECT name FROM Albums ORDER BY name;

-- List all tracks for a specific album
SELECT track_number, title, duration_seconds 
FROM Tracks 
WHERE album_id = (SELECT id FROM Albums WHERE name = 'Hot Rats')
ORDER BY track_number;

-- Find longest tracks
SELECT a.name AS album, t.title, t.duration_seconds
FROM Tracks t
JOIN Albums a ON t.album_id = a.id
ORDER BY t.duration_seconds DESC
LIMIT 10;

-- Calculate total duration per album
SELECT a.name, 
       COUNT(t.id) AS track_count,
       SUM(t.duration_seconds) AS total_seconds
FROM Albums a
LEFT JOIN Tracks t ON a.id = t.album_id
GROUP BY a.id, a.name
ORDER BY total_seconds DESC;
```

## Files Created
1. `create_track_database.py` - Main script
2. `zappa_tracks.db` - SQLite database file
3. `track_database_report.txt` - Human-readable report

## Notes
- The script skips files that are already in the database to allow incremental updates
- Track durations are stored in seconds (REAL type) for precise calculations
- The script handles Windows path encoding issues with UTF-8
- Album organization is based on folder structure (each top-level directory in ZappaLibrary is treated as an album)

## Next Steps (Optional)
- Add a script to query/search the database
- Export to JSON/CSV formats
- Add album metadata (year, genre, etc.) if available
- Create a web interface for browsing the database
- Add functionality to update track information


