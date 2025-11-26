import 'dotenv/config';
import { readFile, mkdir, copyFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { LibrarySnapshot, Album } from '../../shared/library.ts';

// Get paths from environment or use defaults
const DROPBOX_ROOT = process.env.DROPBOX_LIBRARY_PATH || 
  process.env.DROPBOX_ROOT || 
  'C:/Users/kimbe/Dropbox/Apps/ZappaVault/ZappaLibrary';

const COVERS_OUTPUT_DIR = path.resolve('public/covers');
const libraryFile = path.resolve('data/library.generated.json');

// Supported image extensions
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

/**
 * Find cover art file in an album folder
 */
async function findCoverFile(albumPath: string): Promise<string | null> {
  // Convert Dropbox path to local filesystem path
  // Dropbox path: /Apps/ZappaVault/ZappaLibrary/Album Name
  // Local path: C:/Users/kimbe/Dropbox/Apps/ZappaVault/ZappaLibrary/Album Name
  let localPath = albumPath;
  
  // If it's a Dropbox API path, convert to local path
  if (albumPath.startsWith('/Apps/ZappaVault/ZappaLibrary/')) {
    const relativePath = albumPath.replace('/Apps/ZappaVault/ZappaLibrary/', '');
    localPath = path.join(DROPBOX_ROOT, relativePath);
  } else if (albumPath.startsWith('/ZappaLibrary/')) {
    const relativePath = albumPath.replace('/ZappaLibrary/', '');
    localPath = path.join(DROPBOX_ROOT, relativePath);
  } else if (!path.isAbsolute(albumPath)) {
    localPath = path.join(DROPBOX_ROOT, albumPath);
  }
  
  if (!existsSync(localPath)) {
    console.warn(`⚠️  Album folder not found: ${localPath}`);
    return null;
  }
  
  // Priority 1: Check Cover/ folder
  const coverFolders = ['Cover', 'cover', 'Covers', 'covers'];
  for (const folder of coverFolders) {
    const coverFolderPath = path.join(localPath, folder);
    if (existsSync(coverFolderPath)) {
      try {
        const files = readdirSync(coverFolderPath, { withFileTypes: true });
        const imageFiles: { file: string; priority: number }[] = [];
        
        for (const file of files) {
          if (file.isFile()) {
            const ext = path.extname(file.name).toLowerCase();
            if (IMAGE_EXTENSIONS.includes(ext)) {
              const fileName = file.name.toLowerCase();
              let priority = 0;
              
              // Prioritize files with "1", "front", "cover", or "folder" in name
              if (fileName.includes('1') && (fileName.includes('front') || fileName.includes('cover'))) {
                priority = 3; // Highest priority
              } else if (fileName.includes('front') || fileName.includes('cover') || fileName.includes('folder')) {
                priority = 2;
              } else if (fileName.includes('1')) {
                priority = 1;
              }
              
              imageFiles.push({
                file: path.join(coverFolderPath, file.name),
                priority,
              });
            }
          }
        }
        
        if (imageFiles.length > 0) {
          // Sort by priority (highest first), then by filename
          imageFiles.sort((a, b) => {
            if (b.priority !== a.priority) {
              return b.priority - a.priority;
            }
            return a.file.localeCompare(b.file);
          });
          
          return imageFiles[0].file;
        }
      } catch (error) {
        console.warn(`⚠️  Error reading cover folder ${coverFolderPath}:`, error);
      }
    }
  }
  
  // Priority 2: Check root folder for common cover filenames
  try {
    const files = readdirSync(localPath, { withFileTypes: true });
    
    const coverNames = [
      'cover.jpg', 'cover.jpeg', 'cover.png',
      'folder.jpg', 'folder.jpeg', 'folder.png',
      'front.jpg', 'front.jpeg', 'front.png',
      '1 front.jpg', '1 front.jpeg', '1 front.png',
      '1-front.jpg', '1-front.jpeg', '1-front.png',
    ];
    
    // First, try exact matches
    for (const coverName of coverNames) {
      const coverPath = path.join(localPath, coverName);
      if (existsSync(coverPath)) {
        return coverPath;
      }
    }
    
    // Then, check for any image file in root
    for (const file of files) {
      if (file.isFile()) {
        const ext = path.extname(file.name).toLowerCase();
        if (IMAGE_EXTENSIONS.includes(ext)) {
          return path.join(localPath, file.name);
        }
      }
    }
  } catch (error) {
    console.warn(`⚠️  Error reading album folder ${localPath}:`, error);
  }
  
  return null;
}

/**
 * Get cover filename based on album ID
 */
function getCoverFileName(album: Album, sourcePath: string): string {
  const ext = path.extname(sourcePath).toLowerCase() || '.jpg';
  return `${album.id}${ext}`;
}

/**
 * Main function to copy all cover art
 */
async function copyCoverArt() {
  console.log('📸 Starting cover art copy process...');
  console.log(`   Dropbox root: ${DROPBOX_ROOT}`);
  console.log(`   Output directory: ${COVERS_OUTPUT_DIR}`);
  
  // Ensure output directory exists
  await mkdir(COVERS_OUTPUT_DIR, { recursive: true });
  
  // Load library snapshot
  if (!existsSync(libraryFile)) {
    console.error(`❌ Library file not found: ${libraryFile}`);
    console.error('   Run "npm run sync:dropbox" first to generate the library.');
    process.exit(1);
  }
  
  const libraryContent = await readFile(libraryFile, 'utf-8');
  const snapshot: LibrarySnapshot = JSON.parse(libraryContent);
  
  console.log(`\n📚 Found ${snapshot.albums.length} albums in library\n`);
  
  let copied = 0;
  let skipped = 0;
  let failed = 0;
  const failedAlbums: string[] = [];
  
  for (const album of snapshot.albums) {
    try {
      const coverSource = await findCoverFile(album.locationPath);
      
      if (!coverSource) {
        console.log(`⚠️  No cover found: ${album.title}`);
        skipped++;
        continue;
      }
      
      // Determine output filename
      const outputFileName = getCoverFileName(album, coverSource);
      const outputPath = path.join(COVERS_OUTPUT_DIR, outputFileName);
      
      // Check if already exists
      if (existsSync(outputPath)) {
        console.log(`⊘ Skipped (exists): ${album.title} → ${outputFileName}`);
        skipped++;
        continue;
      }
      
      // Copy the file
      await copyFile(coverSource, outputPath);
      console.log(`✓ Copied: ${album.title} → ${outputFileName}`);
      copied++;
      
    } catch (error) {
      console.error(`❌ Error copying cover for ${album.title}:`, error instanceof Error ? error.message : error);
      failed++;
      failedAlbums.push(album.title);
    }
  }
  
  console.log('\n📊 Summary:');
  console.log(`  ✓ Copied: ${copied}`);
  console.log(`  ⊘ Skipped: ${skipped}`);
  console.log(`  ❌ Failed: ${failed}`);
  if (failedAlbums.length > 0) {
    console.log(`\n  Failed albums:`);
    failedAlbums.forEach(title => console.log(`    - ${title}`));
  }
  console.log(`\n📁 Covers saved to: ${COVERS_OUTPUT_DIR}`);
  console.log(`\n💡 Next steps:`);
  console.log(`   1. Review the copied covers`);
  console.log(`   2. Commit and push to GitHub`);
  console.log(`   3. Cloudflare Pages will serve them from /covers/`);
}

copyCoverArt().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

