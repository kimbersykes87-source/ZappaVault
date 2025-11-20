#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Compare Frank Zappa release list with library directory
"""

import re
import os
from pathlib import Path

def extract_releases_from_list(text):
    """Extract all unique release names from the formatted list"""
    releases = set()
    lines = text.split('\n')
    
    for line in lines:
        line = line.strip()
        # Match: YEAR – TITLE followed by optional "Bookmark"
        match = re.match(r'^(\d{4})\s*–\s*(.+?)(?:Bookmark|$)', line)
        if match:
            year = match.group(1)
            title = match.group(2).strip()
            
            # Skip section headers and metadata
            skip_keywords = ['↑', 'Toggle', 'Size', 'Snatches', 'Seeders', 'Leechers',
                            'Albums', 'EPs', 'Soundtracks', 'Anthologies', 'Compilations',
                            'Live albums', 'Singles', 'Bootlegs', 'Interviews', 'Mixtapes',
                            'DJ Mixes', 'Concert recordings', 'Unknowns', 'Produced By',
                            'Compositions', 'Guest Appearances', 'Remixes']
            
            if any(kw.lower() in title.lower() for kw in skip_keywords):
                continue
            
            if title and len(title) > 2:
                releases.add(f"{year} – {title}")
    
    return sorted(releases)

def get_library_releases(library_path):
    """Extract release names from library directory"""
    library = {}
    
    if not os.path.exists(library_path):
        return library
    
    for item in os.listdir(library_path):
        if not os.path.isdir(os.path.join(library_path, item)):
            continue
            
        # Parse folder names like:
        # "#1 Freak Out! (February 1966)"
        # "#28-29 Joe's Garage Acts I, II & III (September 1979)"
        
        # Remove #number prefix
        match = re.match(r'#\d+[-\d]*\s+(.+?)\s*\([^\)]+\)\s*(?:\[.*?\]|$)', item)
        if match:
            title = match.group(1).strip()
            library[title] = item
        else:
            # Fallback extraction
            parts = item.split(None, 1)
            if len(parts) > 1:
                rest = parts[1].split('(')[0].strip()
                rest = re.sub(r'\[.*?\]', '', rest).strip()
                if rest:
                    library[rest] = item
    
    return library

def normalize_title(title):
    """Normalize title for fuzzy matching"""
    title = title.lower()
    # Remove punctuation variations
    title = re.sub(r"['']", "'", title)
    title = re.sub(r'[–—-]', '-', title)
    # Keep only alphanumeric, spaces, apostrophes, and hyphens
    title = re.sub(r"[^\w\s'-]", ' ', title)
    title = re.sub(r'\s+', ' ', title)
    return title.strip()

def find_similar_in_library(target_title, library):
    """Find similar title in library using fuzzy matching"""
    target_norm = normalize_title(target_title)
    
    # Exact match
    if target_title in library:
        return target_title, library[target_title]
    
    # Normalized exact match
    for lib_title, lib_path in library.items():
        if normalize_title(lib_title) == target_norm:
            return lib_title, lib_path
    
    # Substring match (one contains the other)
    for lib_title, lib_path in library.items():
        lib_norm = normalize_title(lib_title)
        if (target_norm in lib_norm or lib_norm in target_norm) and len(target_norm) > 5:
            # Additional check: main words should match
            target_words = set(w for w in target_norm.split() if len(w) > 2)
            lib_words = set(w for w in lib_norm.split() if len(w) > 2)
            if target_words and lib_words and (target_words <= lib_words or lib_words <= target_words):
                return lib_title, lib_path
    
    # Word overlap match (at least 60% of significant words match)
    target_words = set(w for w in target_norm.split() if len(w) > 2)
    if target_words:
        best_match = None
        best_score = 0
        
        for lib_title, lib_path in library.items():
            lib_norm = normalize_title(lib_title)
            lib_words = set(w for w in lib_norm.split() if len(w) > 2)
            
            if lib_words:
                common = target_words & lib_words
                union = target_words | lib_words
                if union:
                    score = len(common) / len(union)
                    if score > best_score and score >= 0.6:
                        best_score = score
                        best_match = (lib_title, lib_path)
        
        if best_match:
            return best_match
    
    return None, None

def main():
    # Read the list text from file or stdin
    import sys
    
    if len(sys.argv) > 1:
        with open(sys.argv[1], 'r', encoding='utf-8') as f:
            list_text = f.read()
    else:
        # Read from stdin
        list_text = sys.stdin.read()
    
    library_path = r"C:\Users\kimbe\Dropbox\Apps\ZappaVault\ZappaLibrary"
    
    print("Parsing release list...")
    list_releases = extract_releases_from_list(list_text)
    print(f"Found {len(list_releases)} releases in the provided list\n")
    
    print("Reading library directory...")
    library = get_library_releases(library_path)
    print(f"Found {len(library)} releases in library directory\n")
    
    # Compare
    missing = []
    found = []
    uncertain = []
    
    for release in list_releases:
        # Extract title (remove year prefix)
        match = re.match(r'\d{4}\s*–\s*(.+)', release)
        if match:
            title = match.group(1).strip()
        else:
            title = release
        
        similar_title, lib_path = find_similar_in_library(title, library)
        
        if similar_title:
            found.append(release)
        else:
            # Check if it might be a different version/format
            # Some releases might have slight variations
            missing.append(release)
    
    # Print results
    print("=" * 80)
    print("MISSING RELEASES:")
    print("=" * 80)
    
    if missing:
        for release in missing:
            print(f"  • {release}")
    else:
        print("  None - all releases found in library!")
    
    print(f"\nTotal: {len(missing)} missing out of {len(list_releases)} releases")
    print(f"Found: {len(found)} releases already in library")
    
    return missing, found

if __name__ == '__main__':
    main()


