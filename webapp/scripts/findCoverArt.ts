import 'dotenv/config';
import { readdir, stat, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { readFile } from 'node:fs/promises';
import { parseFile } from 'music-metadata';
import type { Album, LibrarySnapshot } from '../../shared/library.ts';

const COVER_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tif', '.tiff', '.webp'];
const COVER_NAMES = ['cover', 'front', 'folder', 'album', 'artwork', 'art'];

// Common cover art filenames to search for
const COVER_PATTERNS = [
  'cover',
  'front',
  'folder',
  'album',
  'artwork',
  'art',
  '01',
  '1',
  'frontcover',
  'albumart',
];

async function findAudioFilesRecursive(dirPath: string, relativePath: string = ''): Promise<string[]> {
  const audioFiles: string[] = [];
  const entries = await readdir(dirPath, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.join(relativePath, entry.name);
    
    if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (['.mp3', '.flac', '.m4a', '.ogg', '.wav', '.aiff'].includes(ext)) {
        audioFiles.push(fullPath);
      }
    } else if (entry.isDirectory() && !entry.name.toLowerCase().includes('cover')) {
      // Recursively search subdirectories (but skip Cover folders)
      const subFiles = await findAudioFilesRecursive(fullPath, relPath);
      audioFiles.push(...subFiles);
    }
  }
  
  return audioFiles;
}

async function extractEmbeddedCoverArt(albumPath: string, albumTitle: string): Promise<string | undefined> {
  try {
    const audioFiles = await findAudioFilesRecursive(albumPath);
    
    // Try to extract cover art from the first audio file
    for (const audioFile of audioFiles) {
      try {
        const metadata = await parseFile(audioFile);
        if (metadata.common.picture && metadata.common.picture.length > 0) {
          const picture = metadata.common.picture[0];
          
          // Create a Cover directory if it doesn't exist
          const coverDir = path.join(albumPath, 'Cover');
          await mkdir(coverDir, { recursive: true });
          
          // Determine file extension from MIME type
          let ext = '.jpg';
          if (picture.format) {
            if (picture.format.includes('png')) ext = '.png';
            else if (picture.format.includes('gif')) ext = '.gif';
            else if (picture.format.includes('webp')) ext = '.webp';
          }
          
          const coverPath = path.join(coverDir, `1 Front${ext}`);
          await writeFile(coverPath, picture.data);
          
          console.log(`  ✓ Extracted embedded cover art from audio file`);
          return coverPath.replace(/\\/g, '/');
        }
      } catch (error) {
        // Continue to next file if this one fails
        continue;
      }
    }
  } catch (error) {
    // Ignore errors
  }
  
  return undefined;
}

async function findCoverArt(albumPath: string, albumTitle?: string): Promise<string | undefined> {
  try {
    // First, check the Cover subdirectory (most common location)
    const coverDir = path.join(albumPath, 'Cover');
    try {
      const coverStat = await stat(coverDir);
      if (coverStat.isDirectory()) {
        const files = await readdir(coverDir);
        for (const file of files) {
          const ext = path.extname(file).toLowerCase();
          if (COVER_EXTENSIONS.includes(ext)) {
            const lowerName = file.toLowerCase();
            // Prefer files with "front" in the name
            if (lowerName.includes('front') || lowerName.includes('1')) {
              return path.join(coverDir, file).replace(/\\/g, '/');
            }
          }
        }
        // If no front cover found, return first image
        for (const file of files) {
          const ext = path.extname(file).toLowerCase();
          if (COVER_EXTENSIONS.includes(ext)) {
            return path.join(coverDir, file).replace(/\\/g, '/');
          }
        }
      }
    } catch {
      // Cover directory doesn't exist, continue
    }
    
    // Check root directory for cover art
    const files = await readdir(albumPath);
    const imageFiles: Array<{ file: string; priority: number }> = [];
    
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (COVER_EXTENSIONS.includes(ext)) {
        const lowerName = file.toLowerCase();
        let priority = 100;
        
        // Check if filename matches common cover patterns
        for (let i = 0; i < COVER_PATTERNS.length; i++) {
          if (lowerName.includes(COVER_PATTERNS[i])) {
            priority = i;
            break;
          }
        }
        
        imageFiles.push({ file, priority });
      }
    }
    
    // Sort by priority (lower is better) and return the best match
    if (imageFiles.length > 0) {
      imageFiles.sort((a, b) => a.priority - b.priority);
      return path.join(albumPath, imageFiles[0].file).replace(/\\/g, '/');
    }
    
    // Check subdirectories (but skip audio file directories)
    for (const file of files) {
      const fullPath = path.join(albumPath, file);
      try {
        const fileStat = await stat(fullPath);
        if (fileStat.isDirectory()) {
          const lowerName = file.toLowerCase();
          // Skip common audio file directory names
          if (lowerName.includes('cd') || lowerName.includes('disc') || 
              lowerName.includes('disc') || lowerName.match(/^\d+$/)) {
            continue;
          }
          
          // Check this subdirectory for images
          const subFiles = await readdir(fullPath);
          for (const subFile of subFiles) {
            const ext = path.extname(subFile).toLowerCase();
            if (COVER_EXTENSIONS.includes(ext)) {
              const lowerSubName = subFile.toLowerCase();
              if (lowerSubName.includes('front') || lowerSubName.includes('cover') || 
                  lowerSubName.includes('1')) {
                return path.join(fullPath, subFile).replace(/\\/g, '/');
              }
            }
          }
        }
      } catch {
        // Skip errors
      }
    }
  } catch (error) {
    console.warn(`Error searching for cover art in ${albumPath}:`, error);
  }
  
  return undefined;
}

async function findMissingCovers(libraryPath: string, snapshotPath: string): Promise<void> {
  console.log('Loading library snapshot...');
  const snapshotContent = await readFile(snapshotPath, 'utf-8');
  const snapshot: LibrarySnapshot = JSON.parse(snapshotContent);
  
  console.log(`Found ${snapshot.albums.length} albums in snapshot`);
  
  let foundCount = 0;
  let missingCount = 0;
  const updates: Array<{ album: Album; newCoverUrl: string }> = [];
  
  for (const album of snapshot.albums) {
    if (!album.coverUrl) {
      console.log(`\nSearching for cover art: ${album.title}`);
      const albumPath = album.locationPath.startsWith('C:') 
        ? album.locationPath 
        : path.join(libraryPath, album.locationPath.replace(/^\//, ''));
      
      let coverPath = await findCoverArt(albumPath, album.title);
      
      // If no cover found in files, try extracting from embedded audio metadata
      if (!coverPath) {
        coverPath = await extractEmbeddedCoverArt(albumPath, album.title);
      }
      
      if (coverPath) {
        console.log(`  ✓ Found: ${coverPath}`);
        album.coverUrl = coverPath;
        updates.push({ album, newCoverUrl: coverPath });
        foundCount++;
      } else {
        console.log(`  ✗ Not found`);
        missingCount++;
      }
    } else {
      foundCount++;
    }
  }
  
  if (updates.length > 0) {
    console.log(`\n=== Summary ===`);
    console.log(`Albums with cover art: ${foundCount}`);
    console.log(`Albums still missing cover art: ${missingCount}`);
    console.log(`New covers found: ${updates.length}`);
    
    // Write updated snapshot
    await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2));
    console.log(`\nUpdated library snapshot saved to: ${snapshotPath}`);
  } else {
    console.log(`\nNo new cover art found. All albums already have covers or none were found.`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const libraryPath = args[0] || process.env.LIBRARY_PATH || 'C:\\Users\\kimbe\\Dropbox\\Apps\\ZappaVault\\ZappaLibrary';
  const snapshotPath = args[1] || path.resolve('webapp/data/library.generated.json');
  
  console.log('Cover Art Finder');
  console.log(`Library path: ${libraryPath}`);
  console.log(`Snapshot path: ${snapshotPath}`);
  console.log('');
  
  await findMissingCovers(libraryPath, snapshotPath);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

