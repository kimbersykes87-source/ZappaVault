# Metadata Extraction Improvements

## Current Issues
1. **Year extraction**: Only looks for years in folder name, many albums don't have years
2. **Metadata fields unused**: Era, genre, description, tags are all undefined
3. **Cover art**: Works but could be more robust
4. **Year display**: Currently shows nothing when year is missing

## Proposed Solution

### 1. Enhanced Folder Name Parsing
Parse folder names more intelligently:
- `"Hot Rats (1969)"` → title: "Hot Rats", year: 1969
- `"Sheik Yerbouti [1979]"` → title: "Sheik Yerbouti", year: 1979
- `"200 Motels - 1971"` → title: "200 Motels", year: 1971
- `"Bongo Fury"` → title: "Bongo Fury", year: undefined

### 2. Metadata File Support
Look for metadata files in album folders:
- `album.json` - Structured metadata
- `info.txt` / `album.txt` - Plain text metadata
- `README.md` - Markdown description

**Format for `album.json`:**
```json
{
  "year": 1979,
  "era": "Mothers Of Invention",
  "genre": "Jazz Fusion",
  "description": "Frank Zappa's groundbreaking experiment...",
  "tags": ["classic", "fusion"],
  "subtitle": "1969 Studio Album"
}
```

### 3. Improved Cover Art Detection
Priority order:
1. Files named: `cover.jpg`, `folder.jpg`, `album.jpg`, `front.jpg`
2. Files in `Cover/` folder (current behavior)
3. Files in `Artwork/` folder
4. First image file in root (current fallback)

### 4. Year Display Logic
- Show year if available: `"1979"`
- Show nothing if missing (no "Year unknown")

### 5. Audio File Tag Extraction (Future)
Extract metadata from audio file tags (ID3, Vorbis comments) if available.

## Implementation Plan

1. **Enhanced folder name parsing** - Parse various formats
2. **Metadata file reader** - Check for JSON/TXT files
3. **Improved cover detection** - Better filename matching
4. **Year display fix** - Conditional rendering
5. **Fallback chain** - Try multiple sources for each field

