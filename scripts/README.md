# Library Management Scripts

This directory contains Python scripts used in the automated Dropbox sync workflow and for manual library management.

## Scripts

### `create_track_database.py`
**Purpose:** One-time setup script to create a SQLite database of all tracks and their durations from the ZappaLibrary directory.

**Usage:**
```bash
python scripts/create_track_database.py [path_to_ZappaLibrary]
```

**What it does:**
- Scans the ZappaLibrary directory recursively
- Extracts track metadata (title, track number, duration) from audio files
- Creates `zappa_tracks.db` SQLite database with all track information
- Generates a text report of all tracks

**When to run:** Only needed once to create the initial database. The database is then committed to the repository.

---

### `export_track_durations.py`
**Purpose:** Exports track durations from the SQLite database to JSON format for use in the library sync workflow.

**Usage:**
```bash
python scripts/export_track_durations.py [db_path] [output_path]
```

**Default:**
```bash
python scripts/export_track_durations.py zappa_tracks.db webapp/data/track_durations.json
```

**What it does:**
- Reads track durations from `zappa_tracks.db`
- Converts durations from seconds to milliseconds
- Normalizes file paths for matching
- Exports to JSON format for merging into the comprehensive library

**When to run:** Automatically run by the GitHub Actions workflow during sync.

---

### `create_comprehensive_library.py`
**Purpose:** Merges album metadata with track durations to create the comprehensive library file (single source of truth).

**Usage:**
```bash
python scripts/create_comprehensive_library.py [library_path] [db_path] [output_path]
```

**Default:**
```bash
python scripts/create_comprehensive_library.py webapp/data/library.generated.json zappa_tracks.db webapp/data/library.comprehensive.json
```

**What it does:**
- Loads base library from `library.generated.json` (metadata from Dropbox)
- Loads track durations from `zappa_tracks.db`
- Merges durations into track metadata
- Creates `library.comprehensive.json` with all metadata and durations

**When to run:** Automatically run by the GitHub Actions workflow during sync.

---

### `generate_track_links.py`
**Purpose:** Generates Dropbox permanent links for all tracks and album covers, eliminating timeout issues at runtime.

**Usage:**
```bash
python scripts/generate_track_links.py [library_path] [output_path] [batch_size]
```

**Default:**
```bash
python scripts/generate_track_links.py webapp/data/library.comprehensive.json webapp/data/library.comprehensive.json 10
```

**What it does:**
- Loads comprehensive library file
- For each track, generates a Dropbox permanent link (streamingUrl and downloadUrl)
- For each album cover, generates a Dropbox permanent link with `raw=1` parameter
- Updates the comprehensive library with all links
- Validates that all cover URLs use `raw=1` (not `dl=0` or `dl=1`)

**Requirements:**
- `DROPBOX_REFRESH_TOKEN` environment variable
- `DROPBOX_APP_KEY` environment variable
- `DROPBOX_APP_SECRET` environment variable
- `requests` Python package (`pip install requests`)

**When to run:** Automatically run by the GitHub Actions workflow during sync.

---

## Workflow Integration

All scripts (except `create_track_database.py`) are automatically executed by the GitHub Actions workflow (`.github/workflows/sync-dropbox.yml`) which runs:
- Daily at 08:00 UTC
- On manual dispatch

The workflow executes scripts in this order:
1. `npm run sync:dropbox` - Generates base library from Dropbox
2. `export_track_durations.py` - Exports durations to JSON
3. `create_comprehensive_library.py` - Merges metadata and durations
4. `generate_track_links.py` - Generates permanent Dropbox links
5. Uploads to Cloudflare KV
6. Commits and pushes updated library files

---

## Dependencies

All scripts require Python 3.11+.

**Additional packages:**
- `mutagen` - For `create_track_database.py` (audio file metadata extraction)
- `requests` - For `generate_track_links.py` (Dropbox API calls)

Install with:
```bash
pip install mutagen requests
```

