# Library Architecture

This document describes the library data architecture and how track durations and streaming links are managed.

## Overview

The ZappaVault uses a **comprehensive library file** (`library.comprehensive.json`) as the single source of truth for all library metadata, including track durations and streaming links. The comprehensive library file is deployed as a static asset and loaded directly by Cloudflare Functions. To stay within Cloudflare KV's 25MB limit, links are extracted to a separate backup file (`library.comprehensive.links.json`) when uploading to KV, but the comprehensive library file (with all links) remains the primary source.

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
│ 5. Link Extraction (upload_library_to_kv.js)               │
│    - Creates deep copy of library for KV (links stripped)   │
│    - Extracts links to library.comprehensive.links.json    │
│    - Original library.comprehensive.json keeps all links    │
│    - Both files stored in GitHub (both deployed as static) │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Deployment                                                │
│    - library.comprehensive.json (with links) → Static Asset │
│    - library.comprehensive.links.json → Static Asset (backup)│
│    - library.comprehensive.json (no links) → KV (fallback)  │
│    - Cloudflare Functions load from static asset (primary)   │
│    - Functions forward auth cookies for protected /data/     │
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
- Pre-generated cover art URLs with `raw=1` parameter (`coverUrl` field for each album)
- **Pre-generated streaming and download links** (`streamingUrl` and `downloadUrl` for all tracks)
- **This is the single source of truth for all metadata including links**
- Deployed as static asset at `/data/library.comprehensive.json`
- Protected by middleware (requires authentication)
- Loaded by Cloudflare Functions with forwarded authentication cookies

### `library.comprehensive.links.json`
**Source:** Extracted from `library.comprehensive.json` during KV upload (backup only)  
**Contains:**
- Pre-generated Dropbox permanent links for all tracks
- Maps track IDs to their `streamingUrl` and `downloadUrl`
- Stored in GitHub repository and served as static asset
- **Used as fallback only** if comprehensive library cannot be loaded
- **Note:** The comprehensive library file contains all links, so this file is primarily a backup
- **Benefits:**
  - Backup/fallback if comprehensive library file cannot be accessed
  - Keeps KV payload small (links stripped when uploading to KV)
  - All links preserved (version controlled in GitHub)
  - Fast access (static asset)
  - Automatic updates (workflow commits both files)

### `zappa_tracks.db`
**Source:** Local SQLite database created by scanning audio files  
**Contains:**
- Track file paths
- Track durations (in seconds)
- Album associations

## API Behavior

### Loading Library Data

The API endpoint (`functions/api/albums/[id].ts`) loads library data in this priority order:

1. **Static Asset** (`/data/library.comprehensive.json`) - **Primary source** with all metadata including streaming links
   - Functions fetch the static asset with forwarded authentication cookies (to bypass middleware protection)
   - If comprehensive library already contains streaming links, they are used directly (no merge needed)
   - This is the preferred source as it contains all data including links
2. **KV Cache** (`LIBRARY_KV`) - Fast fallback, but metadata only (links stripped)
   - Used only if static asset fetch fails
   - If loaded from KV, API attempts to merge links from `library.comprehensive.links.json` (backup)
   - If links file is also missing, API falls back to on-demand link generation
3. **Sample Library** - Fallback for development

**Authentication:**
- The `/data/` path is protected by middleware (requires authentication)
- When Functions make internal `fetch()` calls to load the library, they forward the `Cookie` header from the original request
- This allows authenticated access to the static asset while maintaining security
- The library loader prioritizes static asset if it has streaming links or durations

### Link Loading and Generation

When `?links=1` is requested:

1. **Load comprehensive library** from static asset (`/data/library.comprehensive.json`)
   - Functions forward authentication cookies to access protected static asset
   - Comprehensive library already contains all streaming links in track objects
   - If library has links, they are used directly (no merge needed)
2. **Fallback: Load from KV** if static asset fetch fails
   - KV contains metadata only (links stripped)
   - API attempts to merge links from `library.comprehensive.links.json` (backup)
3. **Fallback: Runtime link generation** if links are missing
   - Only generates links for tracks that don't have them
   - Processes in batches to avoid timeout
   - Uses Dropbox API to create permanent shared links

## Benefits of Separate Links Database

1. **Stays Within KV Limits**
   - KV has 25MB per value limit
   - With 1,897 tracks, links add ~400-600KB+ of data
   - Separating links keeps metadata payload well under limit

2. **Eliminates Timeout Issues**
   - Large albums (30+ tracks) no longer timeout during link generation
   - Links are generated once during sync, not on every API request

3. **Faster API Responses**
   - No Dropbox API calls needed during user requests
   - API merges pre-generated links from static asset (fast)

4. **More Reliable**
   - No dependency on Dropbox API availability during user requests
   - Links are generated in controlled environment (GitHub Actions)
   - Links are version controlled in GitHub

5. **Better Error Handling**
   - Link generation errors are caught during sync, not during user requests
   - Failed links can be retried in next sync cycle
   - Graceful fallback to on-demand generation if links file missing

## Workflow Steps

### GitHub Actions Workflow (`.github/workflows/sync-dropbox.yml`)

1. **Sync Dropbox** → `library.generated.json`
2. **Export Durations** → Extract from `zappa_tracks.db`
3. **Create Comprehensive Library** → Merge durations into library
4. **Generate Links** → Create Dropbox permanent links for all tracks
5. **Extract Links** → Save to `library.comprehensive.links.json` (separate file)
6. **Upload to KV** → Upload metadata-only library (stays under 25MB)
7. **Commit & Push** → Save both library and links files to repository

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

# 4. Upload to Cloudflare KV (extracts links automatically)
node upload_library_to_kv.js webapp/data/library.comprehensive.json
# This creates library.comprehensive.links.json automatically
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

### Links Not Loading / "No stream" Error

**Symptoms:** Tracks show "No stream" in UI

**Causes:**
1. Comprehensive library file not deployed as static asset
2. Functions cannot access static asset (authentication issue)
3. Sync workflow didn't complete link generation step
4. Dropbox credentials missing or invalid
5. Link generation script failed (check GitHub Actions logs)
6. New tracks added but sync hasn't run yet

**Solutions:**
1. **Verify comprehensive library has links:**
   - Check that `webapp/data/library.comprehensive.json` exists in repo
   - Verify it contains `streamingUrl` fields for tracks
   - Check build logs to ensure file is copied to `dist/data/`
2. **Verify static asset is accessible:**
   - Check Cloudflare Functions logs for `[LIBRARY] ✅ Loaded library from static asset`
   - Look for authentication errors (should forward cookies)
   - Verify middleware allows authenticated access to `/data/` paths
3. **Check sync workflow:**
   - Review GitHub Actions workflow logs for link generation errors
   - Verify Dropbox credentials in GitHub Secrets
   - Manually trigger sync workflow if needed
4. **Check deployment:**
   - Ensure comprehensive library file is in `webapp/dist/data/` after build
   - Verify Cloudflare Pages deployment includes the file
   - Trigger new deployment if file is missing
5. **Debug via logs:**
   - Check Functions logs for `[LINK DEBUG]` messages
   - Look for `Pre-generated links: X/Y tracks already have links`
   - If showing 0/X, static asset is not loading correctly

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
1. Ensure sync workflow completed link generation and extraction
2. Verify `library.comprehensive.links.json` exists and has links for all tracks
3. Check API logs to see if it's loading links from static asset or generating at runtime
4. Verify links file is committed to repository and accessible as static asset

## Future Improvements

- **Incremental Link Generation:** Only generate links for new/missing tracks
- **Link Refresh:** Periodically refresh links to ensure they're still valid
- **Parallel Processing:** Generate links for multiple albums in parallel
- **Link Validation:** Verify links are accessible before committing

