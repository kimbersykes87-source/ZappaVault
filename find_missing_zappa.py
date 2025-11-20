import re
import os
from pathlib import Path

# Extract release names from the formatted list
def extract_releases_from_text(text):
    """Extract unique release names from the formatted torrent list"""
    releases = []
    seen = set()
    
    # Pattern to match lines like "2023 – Funky NothingnessBookmark" or "2016 – Frank Zappa for PresidentBookmark"
    # Also handle variations
    lines = text.split('\n')
    
    current_release = None
    for line in lines:
        line = line.strip()
        
        # Match release header lines like "2023 – Funky NothingnessBookmark"
        # or "1979 – Joe's Garage: Act IBookmark"
        match = re.match(r'(\d{4})\s*–\s*(.+?)(?:Bookmark|$)', line)
        if match:
            year = match.group(1)
            title = match.group(2).strip()
            
            # Clean up title
            title = re.sub(r'\s+', ' ', title)
            
            # Skip if it's just a format marker or empty
            if title and len(title) > 2 and title not in ['↑', 'Toggle', 'Size', 'Snatches', 'Seeders', 'Leechers']:
                # Create unique identifier
                release_key = f"{year} – {title}"
                if release_key not in seen:
                    seen.add(release_key)
                    releases.append({
                        'year': year,
                        'title': title,
                        'full_name': release_key
                    })
    
    return releases

# Get existing releases from library
def get_library_releases(library_path):
    """Extract release names from library directory structure"""
    library_releases = {}
    
    try:
        for item in os.listdir(library_path):
            item_path = os.path.join(library_path, item)
            if os.path.isdir(item_path):
                # Parse folder names like:
                # "#1 Freak Out! (February 1966)"
                # "#28-29 Joe's Garage Acts I, II & III (September 1979)"
                
                # Extract title (remove #number prefix and date suffix)
                match = re.match(r'#\d+[-\d]*\s+(.+?)\s*\([^\)]+\)\s*(?:\[-?\]|$)', item)
                if match:
                    title = match.group(1).strip()
                    library_releases[title] = item
                else:
                    # Try alternative pattern
                    parts = item.split(None, 1)
                    if len(parts) > 1:
                        # Remove leading #number
                        rest = parts[1]
                        # Remove date part in parentheses
                        rest = re.sub(r'\s*\([^\)]+\)\s*$', '', rest)
                        # Remove trailing metadata in brackets
                        rest = re.sub(r'\s*\[.*?\]\s*$', '', rest)
                        title = rest.strip()
                        if title:
                            library_releases[title] = item
    except Exception as e:
        print(f"Error reading library directory: {e}")
        return {}
    
    return library_releases

# Normalize titles for comparison
def normalize_title(title):
    """Normalize title for fuzzy matching"""
    if not title:
        return ""
    
    # Convert to lowercase
    title = title.lower()
    
    # Remove common punctuation variations
    title = re.sub(r"['']", "'", title)  # Normalize apostrophes
    title = re.sub(r'[–—-]', '-', title)  # Normalize dashes
    title = re.sub(r'[^\w\s\'-]', '', title)  # Remove special chars but keep apostrophes and dashes
    
    # Normalize whitespace
    title = re.sub(r'\s+', ' ', title)
    
    # Remove common suffixes
    title = re.sub(r'\s+bookmark$', '', title)
    title = title.strip()
    
    return title

# Find similar titles
def find_similar_title(target_title, library_titles):
    """Find the most similar title in library"""
    target_norm = normalize_title(target_title)
    
    best_match = None
    best_score = 0
    
    for lib_title in library_titles.keys():
        lib_norm = normalize_title(lib_title)
        
        # Check if one contains the other
        if target_norm in lib_norm or lib_norm in target_norm:
            score = min(len(target_norm), len(lib_norm)) / max(len(target_norm), len(lib_norm))
            if score > best_score:
                best_score = score
                best_match = lib_title
        
        # Check word overlap
        target_words = set(target_norm.split())
        lib_words = set(lib_norm.split())
        if target_words and lib_words:
            overlap = len(target_words & lib_words)
            total = len(target_words | lib_words)
            if total > 0:
                score = overlap / total
                if score > best_score and score > 0.5:
                    best_score = score
                    best_match = lib_title
    
    return best_match if best_score > 0.5 else None

# Main comparison function
def find_missing_releases(list_text, library_path):
    """Compare list against library and find missing releases"""
    
    # Extract releases from list
    list_releases = extract_releases_from_text(list_text)
    print(f"Found {len(list_releases)} releases in the provided list")
    
    # Get library releases
    library_releases = get_library_releases(library_path)
    print(f"Found {len(library_releases)} releases in library directory")
    
    # Compare
    missing = []
    matched = []
    
    for release in list_releases:
        title = release['title']
        full_name = release['full_name']
        
        # Try exact match first
        if title in library_releases:
            matched.append(full_name)
            continue
        
        # Try fuzzy match
        similar = find_similar_title(title, library_releases)
        if similar:
            matched.append(f"{full_name} (matched with: {similar})")
        else:
            missing.append(full_name)
    
    return missing, matched

# Read the list from the user's query
# The list text is provided in the user query above
if __name__ == '__main__':
    library_path = r"C:\Users\kimbe\Dropbox\Apps\ZappaVault\ZappaLibrary"
    
    # The list text would be passed here
    # For now, we'll create it as a separate function that can be called
    print("Script ready. Pass the list text to find_missing_releases() function.")


