# Library Architecture

This document describes the library data architecture and how track durations and streaming links are managed.

## Overview

The ZappaVault uses a **comprehensive library file** (`library.comprehensive.json`) as the single source of truth for all library metadata, including track durations and pre-generated streaming links.

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Dropbox Sync (dropboxSync.ts)                            │
│    - Scans Dropbox folder structure                         │
│    - Extracts album/track metadata                          │
│    - Output: library.generated.json                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Track Duration Database (zappa_tracks.db)                │
│    - SQLite database with track durations                   │
│    - Created by scanning local audio files                  │
│    - Contains: file_path, duration_seconds                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Comprehensive Library Creation                           │
│    (create_comprehensive_library.py)                        │
│    - Merges library.generated.json + durations              │
│    - Output: library.comprehensive.json                     │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Link Generation (generate_track_links.py)               │
│    - Generates Dropbox permanent links for all tracks       │
│    - Updates library.comprehensive.json with streamingUrl   │
│    - Processes in batches to avoid rate limiting            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Deployment                                                │
│    - library.comprehensive.json committed to repo           │
│    - Uploaded to Cloudflare KV                              │
│    - Served as static asset (/data/library.comprehensive.json)│
└─────────────────────────────────────────────────────────────┘
```

## File Structure

### `library.generated.json`
**Source:** Dropbox sync script (`dropboxSync.ts`)  
**Contains:**
- Album metadata (title, year, era, genre, description, tags)
- Track metadata (title, track number, format, file path, size)
- Cover art URLs
- **Does NOT contain:** Track durations or streaming links

### `library.comprehensive.json`
**Source:** Merged from `library.generated.json` + `zappa_tracks.db` + link generation  
**Contains:**
- All data from `library.generated.json`
- Track durations (`durationMs` field for each track)
- Pre-generated Dropbox permanent links (`streamingUrl` and `downloadUrl` for each track)
- Pre-generated cover art URLs with `raw=1` parameter (`coverUrl` field for each album)
- **This is the single source of truth used by the API**

### `zappa_tracks.db`
**Source:** Local SQLite database created by scanning audio files  
**Contains:**
- Track file paths
- Track durations (in seconds)
- Album associations

## API Behavior

### Loading Library Data

The API endpoint (`functions/api/albums/[id].ts`) loads library data in this priority order:

1. **Static Asset** (`/data/library.comprehensive.json`) - Most up-to-date, includes all links
2. **KV Cache** (`LIBRARY_KV`) - Fast, but may be stale
3. **Sample Library** - Fallback for development

### Link Generation

When `?links=1` is requested:

1. **Check for pre-generated links** in comprehensive library
   - If all tracks have links → Return immediately (fast path)
   - If some tracks missing links → Generate only missing links (fallback)

2. **Runtime link generation** (fallback only)
   - Only generates links for tracks that don't have them
   - Processes in batches to avoid timeout
   - Uses Dropbox API to create permanent shared links

## Benefits of Pre-Generated Links

1. **Eliminates Timeout Issues**
   - Large albums (30+ tracks) no longer timeout during link generation
   - Links are generated once during sync, not on every API request

2. **Faster API Responses**
   - No Dropbox API calls needed during user requests
   - API simply reads pre-generated links from comprehensive library

3. **More Reliable**
   - No dependency on Dropbox API availability during user requests
   - Links are generated in controlled environment (GitHub Actions)

4. **Better Error Handling**
   - Link generation errors are caught during sync, not during user requests
   - Failed links can be retried in next sync cycle

## Workflow Steps

### GitHub Actions Workflow (`.github/workflows/sync-dropbox.yml`)

1. **Sync Dropbox** → `library.generated.json`
2. **Export Durations** → Extract from `zappa_tracks.db`
3. **Create Comprehensive Library** → Merge durations into library
4. **Generate Links** → Create Dropbox permanent links for all tracks
5. **Upload to KV** → Update Cloudflare KV cache
6. **Commit & Push** → Save updated library to repository

### Manual Workflow

```bash
# 1. Sync Dropbox
cd webapp
npm run sync:dropbox

# 2. Create comprehensive library (merge durations)
cd ..
python create_comprehensive_library.py \
  webapp/data/library.generated.json \
  zappa_tracks.db \
  webapp/data/library.comprehensive.json

# 3. Generate links
python generate_track_links.py \
  webapp/data/library.comprehensive.json \
  webapp/data/library.comprehensive.json

# 4. Upload to Cloudflare KV
cd webapp
npm run upload:cloudflare
```

## Track Duration Sources

Track durations come from the SQLite database (`zappa_tracks.db`), which is created by:

1. Scanning local audio files in `ZappaLibrary/` directory
2. Extracting duration metadata using `mutagen` library
3. Storing in SQLite database with normalized file paths

**Note:** The database must be created locally and committed to the repository, or the workflow will skip duration merging.

## Link Generation Details

### Process

1. **Load comprehensive library** (with durations but no links)
2. **For each track:**
   - Check if link already exists (skip if present)
   - Convert file path to Dropbox API path format
   - Request existing shared link from Dropbox
   - If not found, create new permanent shared link
   - Convert shared link to direct download link
   - Update track with `streamingUrl` and `downloadUrl`

3. **Batch Processing:**
   - Processes tracks in batches of 10 to avoid rate limiting
   - Includes delays between batches
   - Continues even if individual tracks fail

### Link Format

- **Regular links:** `https://dl.dropboxusercontent.com/s/abc123/file.mp3`
- **New format (scl/fo):** `https://www.dropbox.com/scl/fo/abc123/file.mp3?rlkey=xyz&dl=1`
  - Must stay on `www.dropbox.com` (not converted to `dl.dropboxusercontent.com`)
  - Uses `?dl=1` for audio files (streaming/download)
  - Uses `?raw=1` for images (cover art) - ensures direct image access without download prompt

**Cover Art URLs:**
- All cover art URLs in the comprehensive library use `raw=1` parameter
- Format: `https://www.dropbox.com/scl/fi/.../cover.jpg?rlkey=...&raw=1`
- This ensures images load correctly in browsers and social media previews

## Troubleshooting

### Links Not Generated

**Symptoms:** Tracks show "No stream" in UI

**Causes:**
1. Sync workflow didn't complete link generation step
2. Dropbox credentials missing or invalid
3. Link generation script failed (check GitHub Actions logs)
4. New tracks added but sync hasn't run yet

**Solutions:**
1. Check GitHub Actions workflow logs for errors
2. Verify Dropbox credentials in GitHub Secrets
3. Manually trigger sync workflow
4. Check that `library.comprehensive.json` contains `streamingUrl` fields

### Missing Durations

**Symptoms:** Track durations show as "0:00"

**Causes:**
1. `zappa_tracks.db` not found or not committed to repo
2. Database doesn't contain duration for specific track
3. Path normalization mismatch between database and library

**Solutions:**
1. Ensure `zappa_tracks.db` exists in repository root
2. Re-scan audio files to update database
3. Check path normalization in `create_comprehensive_library.py`

### Timeout Issues

**Symptoms:** API request times out, especially for large albums

**Causes:**
1. Links not pre-generated (falling back to runtime generation)
2. Too many tracks to process in Cloudflare Workers timeout window

**Solutions:**
1. Ensure sync workflow completed link generation
2. Verify `library.comprehensive.json` has links for all tracks
3. Check API logs to see if it's using pre-generated links or generating at runtime

## Future Improvements

- **Incremental Link Generation:** Only generate links for new/missing tracks
- **Link Refresh:** Periodically refresh links to ensure they're still valid
- **Parallel Processing:** Generate links for multiple albums in parallel
- **Link Validation:** Verify links are accessible before committing

