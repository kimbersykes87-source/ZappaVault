# Album Metadata Database

This file (`album-metadata.json`) is used by the Dropbox sync script to enrich album information with metadata that isn't stored in folder names.

## How It Works

1. **Automatic Matching**: The sync script matches albums by folder name (case-insensitive, supports partial matches)
2. **Metadata Application**: When a match is found, the metadata (year, cover art, era, genre, etc.) is applied to the album
3. **Auto-Detection Fallback**: If no match is found, the script falls back to auto-detection (extracting year from folder name, finding cover art automatically)

## Adding/Updating Metadata

### Basic Example
```json
{
  "match": "Hot Rats",
  "year": 1969,
  "coverArt": null,
  "era": "Mothers Of Invention",
  "genre": "Jazz Fusion",
  "description": "Frank Zappa's groundbreaking experiment mixing rock instrumentation with jazz improvisation.",
  "tags": ["classic", "fusion"],
  "subtitle": "1969 Studio Album"
}
```

**Note**: Descriptions are displayed in:
- **AlbumCard**: Shows description on the homepage (truncated to 3 lines)
- **AlbumPage**: Shows full description on the album detail page

### Cover Art Options

**Auto-detect (recommended):**
```json
{
  "match": "Album Name",
  "coverArt": null
}
```

**Specify custom path:**
```json
{
  "match": "Album Name",
  "coverArt": "Artwork/front-cover.jpg"
}
```

## Field Descriptions

- **`match`**: Album folder name to match (case-insensitive, partial matches work)
- **`year`**: Release year (number, e.g., `1969`)
- **`coverArt`**: 
  - `null` = Auto-detect cover art (searches Cover/, Artwork/ folders, or root)
  - `"path/to/cover.jpg"` = Use specific file (relative to album folder)
- **`era`**: Musical era/period (e.g., "Mothers Of Invention", "Solo Career")
- **`genre`**: Genre classification
- **`description`**: Album description or notes
- **`tags`**: Array of tags for filtering (e.g., `["classic", "live", "compilation"]`)
- **`subtitle`**: Optional subtitle (e.g., "1969 Studio Album")

## Matching Logic

The sync script tries to match albums in this order:
1. **Exact match**: Folder name exactly matches `match` field (case-insensitive)
2. **Partial match**: Folder name contains `match` or vice versa
3. **Path match**: Album path contains `match` string

## Updating the Database

1. Edit `webapp/data/album-metadata.json`
2. Commit and push to the repository
3. The next Dropbox sync (runs every 24 hours via GitHub Actions) will use the updated metadata

## Example: Complete Entry

```json
{
  "match": "Sheik Yerbouti",
  "year": 1979,
  "coverArt": null,
  "era": "Solo Career",
  "genre": "Progressive Rock",
  "description": "Double album featuring some of Zappa's most popular songs, including 'Dancin' Fool' and 'Bobby Brown'.",
  "tags": ["classic", "studio", "double-album"],
  "subtitle": "1979 Double Album"
}
```

