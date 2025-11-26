#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Convert library.generated.json to a TypeScript file that exports the data
This ensures it works reliably in Cloudflare Workers
"""
import json
import sys
from pathlib import Path

def convert_json_to_ts(json_path: str, ts_path: str):
    """Convert JSON file to TypeScript export file"""
    # Read JSON file
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # Write TypeScript file
    with open(ts_path, 'w', encoding='utf-8') as f:
        f.write("// Auto-generated from library.generated.json\n")
        f.write("// Do not edit manually - regenerate using convert_library_to_ts.py\n\n")
        f.write("import type { LibrarySnapshot } from '../shared/library.ts';\n\n")
        f.write("export const libraryData: LibrarySnapshot = ")
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write(" as LibrarySnapshot;\n")
    
    print(f"✅ Converted {json_path} to {ts_path}")
    print(f"   Albums: {data.get('albumCount', 0)}, Tracks: {data.get('trackCount', 0)}")
    
    # Verify durations
    tracks_with_durations = sum(
        sum(1 for track in album.get('tracks', []) if track.get('durationMs', 0) > 0)
        for album in data.get('albums', [])
    )
    print(f"   Tracks with durations: {tracks_with_durations}")

if __name__ == '__main__':
    json_path = sys.argv[1] if len(sys.argv) > 1 else 'webapp/data/library.generated.json'
    ts_path = sys.argv[2] if len(sys.argv) > 2 else 'functions/data/library.generated.ts'
    
    convert_json_to_ts(json_path, ts_path)

