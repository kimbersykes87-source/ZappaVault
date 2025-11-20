import re
import os
from pathlib import Path

# Parse the provided list text to extract album/release names
def extract_release_names(text):
    """Extract unique release names from the formatted list"""
    releases = set()
    
    # Pattern to match release names like "2023 – Funky Nothingness" or "1979 – Joe's Garage: Act I"
    # Also handle different formats
    patterns = [
        r'(\d{4})\s*–\s*([A-Z][^B]+?)(?:Bookmark|$)',
        r'(\d{4})\s*–\s*([A-Z][^\d]+?)(?:\n|$)',
    ]
    
    # Split by sections (Albums, EPs, Soundtracks, etc.)
    sections = re.split(r'↑\s*[A-Z][a-z]+\s*Toggle', text)
    
    for section in sections:
        # Find all year – title patterns
        matches = re.finditer(r'(\d{4})\s*–\s*([^\n]+?)(?:Bookmark|$)', section, re.MULTILINE)
        for match in matches:
            title = match.group(2).strip()
            # Clean up the title
            title = re.sub(r'\s+', ' ', title)
            # Remove any trailing metadata like vote scores
            title = re.sub(r'\s*\(.*\)\s*$', '', title)
            if title and len(title) > 3:
                releases.add(title)
    
    return releases

# Get existing library releases
def get_library_releases(library_path):
    """Extract release names from library directory"""
    library_releases = set()
    try:
        for item in os.listdir(library_path):
            if os.path.isdir(os.path.join(library_path, item)):
                # Extract release name from folder name like "#1 Freak Out! (February 1966)"
                # Remove the number prefix and date suffix
                match = re.match(r'#\d+\s+(.+?)\s*\(.+?\)\s*$', item)
                if match:
                    title = match.group(1).strip()
                    library_releases.add(title)
                else:
                    # Try without date
                    match = re.match(r'#\d+[-\d]*\s+(.+?)\s*\[', item)
                    if match:
                        title = match.group(1).strip()
                        library_releases.add(title)
                    else:
                        # Just use the name after #
                        parts = item.split(None, 1)
                        if len(parts) > 1:
                            title = parts[1].split('(')[0].strip()
                            library_releases.add(title)
    except Exception as e:
        print(f"Error reading library: {e}")
    
    return library_releases

# Fuzzy match function to handle slight variations
def fuzzy_match(title1, title2):
    """Check if two titles are likely the same release"""
    # Normalize titles
    def normalize(t):
        t = t.lower()
        t = re.sub(r'[^\w\s]', '', t)
        t = re.sub(r'\s+', ' ', t)
        return t.strip()
    
    n1 = normalize(title1)
    n2 = normalize(title2)
    
    # Exact match
    if n1 == n2:
        return True
    
    # One contains the other (for cases like "Joe's Garage" vs "Joe's Garage Acts I, II & III")
    if n1 in n2 or n2 in n1:
        return True
    
    # Check if main words match (at least 3 words in common)
    words1 = set(n1.split())
    words2 = set(n2.split())
    common = words1 & words2
    if len(common) >= min(3, len(words1), len(words2)):
        return True
    
    return False

# Read the list from user input
with open('zappa_list.txt', 'w', encoding='utf-8') as f:
    # The user will provide this via a file - but we have it in the query
    pass

if __name__ == '__main__':
    library_path = r"C:\Users\kimbe\Dropbox\Apps\ZappaVault\ZappaLibrary"
    
    # The list text would be provided here - I'll read it from a variable
    # For now, let's create a more comprehensive comparison script


