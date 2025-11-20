#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Extract release names from user's list and compare with library
"""

import re
import os
import sys

# Set UTF-8 encoding for output
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Key releases extracted from the user's list (focusing on main albums/releases)
USER_LIST_RELEASES = [
    # 2020s
    "2023 – Funky Nothingness",
    "2022 – Waka/Wazoo",
    "2022 – The Mothers 1971",
    "2022 – Zappa '75: Zagreb/Ljubljana",
    "2022 – Zappa/Erie",
    "2021 – Zappa '88: The Last U.S. Show",
    "2021 – The Mothers 1970",
    "2020 – Halloween 81",
    "2020 – The Mothers 1970",
    
    # 2010s
    "2019 – The Hot Rats Sessions",
    "2019 – Halloween 73",
    "2019 – Halloween 73 Highlights",
    "2018 – The Roxy Performances",
    "2017 – Halloween 77",
    "2016 – Frank Zappa for President",
    "2016 – The Crux of the Biscuit",
    "2016 – Chicago '78",
    "2016 – Little Dots",
    "2016 – Road Tapes, Venue #3",
    "2016 – Meat Light - The Uncle Meat Project/Object",
    "2016 – ZAPPAtite",
    "2015 – Dance Me This",
    "2014 – Joe's Camouflage",
    "2014 – Roxy by Proxy",
    "2013 – Road Tapes Venue # 2",
    "2013 – A Token of His Extreme",
    "2012 – Baby Snakes: The Compleat Soundtrack",
    "2012 – Finer Moments",
    "2012 – Road Tapes Venue # 1",
    "2012 – Understanding America",
    "2011 – Feeding the Monkies at Ma Maison",
    "2011 – Carnegie Hall",
    "2010 – Congress Shall Make No Law…",
    "2010 – Greasy Love Songs",
    "2010 – Hammersmith Odeon",
    
    # 2000s
    "2009 – Philly '76",
    "2009 – The Lumpy Money Project/Object",
    "2008 – Joe's Menage",
    "2008 – One Shot Deal",
    "2007 – Buffalo",
    "2007 – Wazoo",
    "2007 – The Dub Room Special!",
    "2006 – The Frank Zappa AAAFNRAA Birthday Bundle",
    "2006 – The MOFO Project/Object",
    "2006 – Imaginary Diseases",
    "2006 – Trance-Fusion",
    "2005 – Joe's XMasage",
    "2004 – QuAUDIOPHILIAc",
    "2004 – Joe's Corsage",
    "2004 – Joe's Domage",
    "2003 – Halloween",
    
    # 1990s - Main albums
    "1996 – Läther",
    "1996 – Frank Zappa Plays the Music of Frank Zappa: A Memorial Tribute",
    "1996 – The Lost Episodes",
    "1994 – Civilization Phaze III",
    "1993 – The Yellow Shark",
    "1992 – You Can't Do That On Stage Anymore Vol. 1-6",
    "1991 – Make A Jazz Noise Here",
    "1991 – The Best Band You Never Heard In Your Life",
    "1991 – You Can't Do That on Stage Anymore, Volume 4",
    
    # 1980s - Main albums
    "1988 – Broadway the Hard Way",
    "1988 – Guitar",
    "1988 – You Can't Do That on Stage Anymore, Volume 1",
    "1988 – You Can't Do That on Stage Anymore, Volume 2",
    "1989 – You Can't Do That on Stage Anymore, Volume 3",
    "1986 – Jazz from Hell",
    "1986 – Does Humor Belong in Music?",
    "1985 – Frank Zappa Meets the Mothers of Prevention",
    "1984 – Francesco Zappa",
    "1984 – Them or Us",
    "1984 – Thing‐Fish",
    "1983 – The Man from Utopia",
    "1983 – Baby Snakes",
    "1982 – Ship Arriving Too Late to Save a Drowning Witch",
    "1981 – You Are What You Is",
    "1981 – Shut Up 'n Play Yer Guitar",
    "1981 – Tinseltown Rebellion",
    
    # 1970s - Main albums
    "1979 – Joe's Garage: Act I",
    "1979 – Joe's Garage: Acts II & III",
    "1979 – Orchestral Favorites",
    "1979 – Sheik Yerbouti",
    "1979 – Sleep Dirt",
    "1978 – Studio Tan",
    "1977 – Zappa in New York",
    "1976 – Zoot Allures",
    "1975 – One Size Fits All",
    "1975 – Bongo Fury",
    "1974 – Apostrophe (')",
    "1974 – Roxy & Elsewhere",
    "1973 – Over-Nite Sensation",
    "1972 – The Grand Wazoo",
    "1972 – Waka/Jawaka",
    "1971 – 200 Motels",
    "1970 – Burnt Weeny Sandwich",
    "1970 – Chunga's Revenge",
    "1970 – Weasels Ripped My Flesh",
    
    # 1960s - Main albums
    "1969 – Hot Rats",
    "1969 – Uncle Meat",
    "1968 – Cruising with Ruben & The Jets",
    "1968 – Lumpy Gravy",
    "1968 – We're Only in It for the Money",
    "1967 – Absolutely Free",
    "1966 – Freak Out!",
]

# Releases found in library (from directory listing)
LIBRARY_RELEASES = {
    "Freak Out!",
    "Absolutely Free",
    "Lumpy Gravy",
    "We're Only In It For The Money",
    "Cruising with Ruben & The Jets",
    "Uncle Meat",
    "Mothermania",
    "Hot Rats",
    "Burnt Weeny Sandwich",
    "Weasels Ripped My Flesh",
    "Chunga's Revenge",
    "Fillmore East, June 1971",
    "200 Motels",
    "Just Another Band From L.A.",
    "Waka-Jawaka",
    "The Grand Wazoo",
    "Over-Nite Sensation",
    "Apostrophe (')",
    "Roxy & Elsewhere",
    "One Size Fits All",
    "Bongo Fury",
    "Zoot Allures",
    "Zappa In New York",
    "Studio Tan",
    "Sleep Dirt",
    "Sheik Yerbouti",
    "Orchestral Favorites",
    "Joe's Garage Acts I, II & III",
    "TinselTown Rebellion",
    "Shut Up 'N Play Yer Guitar",
    "You Are What You Is",
    "Ship Arriving Too Late To Save A Drowning Witch",
    "The Man From Utopia",
    "Baby Snakes",
    "The Perfect Stranger",
    "Them or Us",
    "Thing-Fish",
    "Francesco Zappa",
    "Meets The Mothers Of Prevention",
    "Does Humor Belong In Music_",
    "Jazz From Hell",
    "Guitar",
    "You Can't Do That On Stage Anymore, Vol. 1",
    "You Can't Do That On Stage Anymore, Vol. 2",
    "Broadway The Hard Way",
    "You Can't Do That On Stage Anymore, Vol. 3",
    "The Best Band You Never Heard In Your Life",
    "Make A Jazz Noise Here",
    "You Can't Do That On Stage Anymore, Vol. 4",
    "You Can't Do That On Stage Anymore, Vol. 5",
    "You Can't Do That On Stage Anymore, Vol. 6",
    "Playground Psychotics",
    "Ahead Of Their Time",
    "The Yellow Shark",
    "Civilization Phaze III",
    "The Lost Episodes",
    "Läther",
    "Plays The Music Of Frank Zappa",
    "Have I Offended Someone_",
    "Mystery Disc",
    "EIHN- Everything Is Healing Nicely",
    "FZ-OZ",
    "Halloween",
    "Joe's Corsage",
    "quAUDIOPHILIAc",
    "Joe's Domage",
    "Joe's XMasage",
    "Imaginary Diseases",
    "Trance-Fusion",
    "The MOFO Project-Object",
    "Buffalo",
    "The Dub Room Special",
    "Wazoo",
    "One Shot Deal",
    "Joe's Menage",
    "The Lumpy Money P-O",
    "Philly '76",
    "Greasy Love Songs",
    "'Congress Shall Make No Law...'",
    "Hammersmith Odeon",
    "Feeding the Monkies at Ma Maison",
    "Carnegie Hall",
    "Understanding America",
    "Road Tapes, Venue #1",
    "Finer Moments",
    "AAAFNRAA",
    "Road Tapes, Venue #2",
    "A Token of His Extreme",
    "Joe's Camouflage",
    "Roxy By Proxy",
    "Dance Me This",
    "Roxy- The Movie",
}

def normalize_title(title):
    """Normalize title for comparison"""
    # Remove year prefix if present
    title = re.sub(r'^\d{4}\s*[–—-]\s*', '', title)
    title = title.lower()
    # Normalize punctuation - handle various dash types
    title = re.sub(r"['']", "'", title)
    title = re.sub(r'[–—/−]', '/', title)  # Normalize all dashes/slashes to /
    title = re.sub(r'/', ' ', title)  # Replace / with space for comparison
    title = re.sub(r'[^\w\s\'-]', '', title)  # Remove special chars except apostrophe and hyphen
    title = re.sub(r'\s+', ' ', title)
    return title.strip()

def find_match(title, library):
    """Find matching title in library"""
    title_norm = normalize_title(title)
    
    # Try exact match first
    for lib_title in library:
        if normalize_title(lib_title) == title_norm:
            return lib_title
    
    # Try substring match
    for lib_title in library:
        lib_norm = normalize_title(lib_title)
        if title_norm in lib_norm or lib_norm in title_norm:
            if len(title_norm) > 5:  # Avoid too short matches
                return lib_title
    
    # Try word overlap
    title_words = set(w for w in title_norm.split() if len(w) > 2)
    if title_words:
        for lib_title in library:
            lib_norm = normalize_title(lib_title)
            lib_words = set(w for w in lib_norm.split() if len(w) > 2)
            common = title_words & lib_words
            if common and len(common) >= min(2, len(title_words) * 0.7):
                return lib_title
    
    return None

# Compare
missing = []
found = []

print("=" * 80)
print("MISSING RELEASES ANALYSIS")
print("=" * 80)
print()

for release in USER_LIST_RELEASES:
    # Extract title
    match = re.match(r'\d{4}\s*–\s*(.+)', release)
    if match:
        title = match.group(1).strip()
    else:
        title = release
    
    matched = find_match(title, LIBRARY_RELEASES)
    if matched:
        found.append(release)
    else:
        missing.append(release)

print("MISSING RELEASES:")
print("-" * 80)
if missing:
    for item in sorted(missing):
        # Safely print with encoding handling
        try:
            print(f"  - {item}")
        except UnicodeEncodeError:
            print(f"  - {item.encode('ascii', errors='replace').decode('ascii')}")
else:
    print("  None found!")
print()

print(f"SUMMARY:")
print(f"  Total in list: {len(USER_LIST_RELEASES)}")
print(f"  Found in library: {len(found)}")
print(f"  Missing: {len(missing)}")

