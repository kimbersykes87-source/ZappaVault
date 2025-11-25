import re
import os
import sys

# The list text from user query - key releases
def extract_releases(text):
    """Extract all release names from the formatted list"""
    releases = []
    seen = set()
    
    # Split by sections
    lines = text.split('\n')
    
    for line in lines:
        line = line.strip()
        # Match pattern: YEAR – TITLE followed by optional "Bookmark"
        # Examples: "2023 – Funky NothingnessBookmark", "1979 – Joe's Garage: Act IBookmark"
        match = re.match(r'^(\d{4})\s*–\s*(.+?)(?:Bookmark|$)', line)
        if match:
            year = match.group(1)
            title = match.group(2).strip()
            
            # Skip if it's a section header or metadata
            skip_patterns = ['↑', 'Toggle', 'Size', 'Snatches', 'Seeders', 'Leechers', 
                           'Albums', 'EPs', 'Soundtracks', 'Live albums', 'Compilations',
                           'Anthologies', 'Singles', 'Bootlegs']
            if any(pattern.lower() in title.lower() for pattern in skip_patterns):
                continue
            
            if title and len(title) > 2:
                key = f"{year} – {title}"
                if key not in seen:
                    seen.add(key)
                    releases.append({
                        'year': year,
                        'title': title,
                        'full': key
                    })
    
    return releases

def get_library_releases(path):
    """Get release names from library directory"""
    library = {}
    
    if not os.path.exists(path):
        return library
    
    for item in os.listdir(path):
        item_path = os.path.join(path, item)
        if os.path.isdir(item_path):
            # Parse: "#1 Freak Out! (February 1966)" or "#28-29 Joe's Garage Acts I, II & III (September 1979)"
            match = re.match(r'#\d+[-\d]*\s+(.+?)\s*\([^\)]+\)', item)
            if match:
                title = match.group(1).strip()
                library[title] = item
            else:
                # Fallback: split by number and date
                parts = item.split(None, 1)
                if len(parts) > 1:
                    rest = parts[1].split('(')[0].strip()
                    if rest:
                        library[rest] = item
    
    return library

def normalize(s):
    """Normalize string for comparison"""
    s = s.lower()
    s = re.sub(r"[^\w\s']", ' ', s)
    s = re.sub(r'\s+', ' ', s)
    return s.strip()

def find_match(target, library):
    """Find matching release in library"""
    target_norm = normalize(target)
    
    # Exact match
    if target in library:
        return target
    
    # Normalized match
    for lib_title in library.keys():
        if normalize(lib_title) == target_norm:
            return lib_title
    
    # Substring match (one contains the other)
    for lib_title in library.keys():
        lib_norm = normalize(lib_title)
        if target_norm in lib_norm or lib_norm in target_norm:
            if len(target_norm) > 5 and len(lib_norm) > 5:  # Avoid too short matches
                return lib_title
    
    # Word overlap (at least 70% of words match)
    target_words = set(target_norm.split())
    if not target_words:
        return None
        
    for lib_title in library.keys():
        lib_norm = normalize(lib_title)
        lib_words = set(lib_norm.split())
        if lib_words:
            common = target_words & lib_words
            if len(common) >= max(2, len(target_words) * 0.7):
                return lib_title
    
    return None

if __name__ == '__main__':
    # Read list text from stdin or file
    if len(sys.argv) > 1:
        with open(sys.argv[1], 'r', encoding='utf-8') as f:
            list_text = f.read()
    else:
        print("Reading list from stdin...")
        list_text = sys.stdin.read()
    
    library_path = r"C:\Users\kimbe\Dropbox\Apps\ZappaVault\ZappaLibrary"
    
    # Extract releases
    print("Extracting releases from list...")
    list_releases = extract_releases(list_text)
    print(f"Found {len(list_releases)} releases in list")
    
    # Get library
    print("Reading library directory...")
    library = get_library_releases(library_path)
    print(f"Found {len(library)} releases in library")
    
    # Compare
    print("\n" + "="*80)
    print("MISSING RELEASES:")
    print("="*80)
    
    missing = []
    found = []
    
    for release in list_releases:
        title = release['title']
        full = release['full']
        
        match = find_match(title, library)
        if match:
            found.append(full)
        else:
            missing.append(full)
    
    if missing:
        for item in sorted(missing):
            print(f"  • {item}")
    else:
        print("  None - all releases found in library!")
    
    print(f"\nTotal: {len(missing)} missing out of {len(list_releases)} releases")
    print(f"Found: {len(found)} releases already in library")



