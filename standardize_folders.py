#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script to standardize folder names in ZappaLibrary directory.
Removes:
- Month and year in brackets (e.g., "(September 2010)", "(2016)")
- Format references (e.g., "[CD-FLAC-16]", "[FLAC]", "[CD FLAC]", "[320]", "WEB FLAC", "[-]")
- "Frank Zappa - " or "Frank Zappa " prefix
"""

import os
import re
import sys
import argparse
from pathlib import Path

# Set UTF-8 encoding for console output
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')

def clean_folder_name(name):
    """Clean and standardize folder name."""
    # Remove "Frank Zappa - " or "Frank Zappa " from the start (only once)
    # Handle cases like "Frank Zappa - Frank Zappa for President" -> "Frank Zappa for President"
    # Priority: remove "Frank Zappa - " first, then only remove "Frank Zappa " if no dash was present
    original_name = name
    # First try to remove "Frank Zappa - " pattern
    name = re.sub(r'^Frank Zappa\s*-\s*', '', name, flags=re.IGNORECASE)
    # Only remove standalone "Frank Zappa " if we didn't already remove "Frank Zappa - "
    if name == original_name:
        # No "Frank Zappa - " was found, so try removing "Frank Zappa " prefix
        name = re.sub(r'^Frank Zappa\s+', '', name, flags=re.IGNORECASE)
    
    # Remove month and year patterns like "(September 2010)" or "(2016)"
    # This pattern matches: (Month Year) or (Year)
    name = re.sub(r'\s*\([A-Za-z]+\s+\d{4}\)', '', name)  # (September 2010)
    name = re.sub(r'\s*\(\d{4}\)', '', name)  # (2016)
    
    # Remove format references in brackets: [CD-FLAC-16], [FLAC], [CD FLAC], [320], [-]
    name = re.sub(r'\s*\[CD[- ]?FLAC[- ]?\d*\]', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\s*\[FLAC\]', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\s*\[CD\s+FLAC\]', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\s*\[320\]', '', name)
    name = re.sub(r'\s*\[-\]', '', name)
    
    # Remove "WEB FLAC" or "(WEB) [FLAC]" or "(WEB)" patterns
    name = re.sub(r'\s*\(WEB\)\s*\[FLAC\]', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\s*\(WEB\)', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\s*-\s*WEB\s+FLAC', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\s*WEB\s+FLAC', '', name, flags=re.IGNORECASE)
    
    # Clean up extra spaces
    name = re.sub(r'\s+', ' ', name)
    name = name.strip()
    
    return name

def main():
    """Main function to rename folders."""
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Standardize folder names in ZappaLibrary')
    parser.add_argument('--yes', '-y', action='store_true', help='Skip confirmation and proceed with renaming')
    args = parser.parse_args()
    
    base_dir = Path(r'C:\Users\kimbe\Dropbox\Apps\ZappaVault\ZappaLibrary')
    
    if not base_dir.exists():
        print(f"Directory not found: {base_dir}")
        return
    
    # Get all folders (not files)
    folders = [f for f in base_dir.iterdir() if f.is_dir()]
    
    if not folders:
        print("No folders found in ZappaLibrary")
        return
    
    print(f"Found {len(folders)} folders to process\n")
    
    # Track renames
    renames = []
    
    for folder in sorted(folders):
        old_name = folder.name
        new_name = clean_folder_name(old_name)
        
        if old_name != new_name:
            old_path = folder
            new_path = folder.parent / new_name
            
            # Check if target already exists
            if new_path.exists():
                print(f"SKIP: Target already exists")
                print(f"  Old: {old_name}")
                print(f"  New: {new_name}\n")
                continue
            
            renames.append((old_path, new_path, old_name, new_name))
            print(f"Will rename:")
            print(f"  From: {old_name}")
            print(f"  To:   {new_name}\n")
        else:
            print(f"No change needed: {old_name}\n")
    
    if not renames:
        print("No folders need renaming.")
        return
    
    # Ask for confirmation (unless --yes flag is provided)
    if not args.yes:
        print(f"\n{len(renames)} folder(s) will be renamed.")
        response = input("Proceed with renaming? (yes/no): ").strip().lower()
        
        if response not in ['yes', 'y']:
            print("Cancelled.")
            return
    
    # Perform renames
    success_count = 0
    error_count = 0
    
    for old_path, new_path, old_name, new_name in renames:
        try:
            old_path.rename(new_path)
            print(f"✓ Renamed: {old_name} -> {new_name}")
            success_count += 1
        except Exception as e:
            print(f"✗ Error renaming {old_name}: {e}")
            error_count += 1
    
    print(f"\nDone! {success_count} successful, {error_count} errors.")

if __name__ == '__main__':
    main()

