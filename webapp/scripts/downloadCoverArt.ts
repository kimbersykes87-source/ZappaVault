import 'dotenv/config';
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import type { Album, LibrarySnapshot } from '../../shared/library.ts';

// Search for cover art using various methods
async function searchCoverArt(albumTitle: string, year?: number): Promise<string | null> {
  // Clean up album title for search
  let searchTitle = albumTitle
    .replace(/\(.*?\)/g, '') // Remove parenthetical info
    .replace(/\[.*?\]/g, '') // Remove bracket info
    .replace(/Frank Zappa - /gi, '') // Remove "Frank Zappa -" prefix
    .trim();
  
  // Try to find cover art URLs from known sources
  const searchQueries = [
    `${searchTitle} ${year || ''} Frank Zappa album cover`,
    `${searchTitle} Frank Zappa`,
  ];
  
  console.log(`  Searching for: "${searchTitle}"`);
  
  // For now, return null - we'll need to implement actual image fetching
  // This could use MusicBrainz API, Discogs API, or web scraping
  return null;
}

// Download image from URL
async function downloadImage(url: string, filePath: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return false;
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(filePath, buffer);
    return true;
  } catch (error) {
    console.error(`  Error downloading image: ${error}`);
    return false;
  }
}

// Try to find cover art using MusicBrainz API
async function searchMusicBrainz(albumTitle: string, year?: number): Promise<string | null> {
  try {
    // Clean title
    let searchTitle = albumTitle
      .replace(/\(.*?\)/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/Frank Zappa - /gi, '')
      .trim();
    
    // MusicBrainz API search
    const query = encodeURIComponent(`artist:"Frank Zappa" AND release:"${searchTitle}"`);
    const url = `https://musicbrainz.org/ws/2/release/?query=${query}&fmt=json&limit=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ZappaVault/1.0 (https://github.com/yourusername/zappavault)',
      },
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    if (data.releases && data.releases.length > 0) {
      const release = data.releases[0];
      const mbid = release.id;
      
      // Get cover art from Cover Art Archive
      const coverUrl = `https://coverartarchive.org/release/${mbid}/front-500`;
      return coverUrl;
    }
  } catch (error) {
    console.error(`  MusicBrainz search error: ${error}`);
  }
  
  return null;
}

// Try Discogs API
async function searchDiscogs(albumTitle: string, year?: number): Promise<string | null> {
  try {
    // Discogs requires authentication for API access
    // For now, we'll skip this and use web scraping or manual URLs
    return null;
  } catch (error) {
    return null;
  }
}

// Known cover art URLs for specific albums
const KNOWN_COVERS: Record<string, string> = {
  "Frank Zappa - Chicago '78 (2016) [CD-FLAC-16]": "https://coverartarchive.org/release/",
  "Frank Zappa - Frank Zappa for President (2016) [FLAC]": "https://coverartarchive.org/release/",
  "Frank Zappa - Little Dots (2016) [FLAC]": "https://coverartarchive.org/release/",
};

async function findAndDownloadCovers(libraryPath: string, snapshotPath: string): Promise<void> {
  console.log('Loading library snapshot...');
  const snapshotContent = await readFile(snapshotPath, 'utf-8');
  const snapshot: LibrarySnapshot = JSON.parse(snapshotContent);
  
  const albumsWithoutCover = snapshot.albums.filter(album => !album.coverUrl);
  console.log(`Found ${albumsWithoutCover.length} albums without cover art\n`);
  
  let successCount = 0;
  
  for (const album of albumsWithoutCover) {
    console.log(`Processing: ${album.title}`);
    
    const albumPath = album.locationPath.startsWith('C:') 
      ? album.locationPath 
      : path.join(libraryPath, album.locationPath.replace(/^\//, ''));
    
    // Try MusicBrainz first
    let coverUrl = await searchMusicBrainz(album.title, album.year);
    
    if (coverUrl) {
      // Create Cover directory
      const coverDir = path.join(albumPath, 'Cover');
      await mkdir(coverDir, { recursive: true });
      
      // Determine file extension from URL or default to jpg
      const ext = coverUrl.match(/\.(jpg|jpeg|png|gif|webp)/i)?.[0] || '.jpg';
      const coverPath = path.join(coverDir, `1 Front${ext}`);
      
      console.log(`  Found cover art URL: ${coverUrl}`);
      const downloaded = await downloadImage(coverUrl, coverPath);
      
      if (downloaded) {
        album.coverUrl = coverPath.replace(/\\/g, '/');
        console.log(`  ✓ Downloaded to: ${coverPath}`);
        successCount++;
      } else {
        console.log(`  ✗ Failed to download`);
      }
    } else {
      console.log(`  ✗ No cover art found`);
    }
    
    console.log('');
  }
  
  if (successCount > 0) {
    // Save updated snapshot
    await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2));
    console.log(`\n=== Summary ===`);
    console.log(`Successfully downloaded ${successCount} cover art images`);
    console.log(`Updated library snapshot saved`);
  } else {
    console.log(`\nNo cover art could be automatically downloaded.`);
    console.log(`You may need to manually download and add cover art for these albums.`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const libraryPath = args[0] || process.env.LIBRARY_PATH || 'C:\\Users\\kimbe\\Dropbox\\Apps\\ZappaVault\\ZappaLibrary';
  const snapshotPath = args[1] || path.resolve('webapp/data/library.generated.json');
  
  console.log('Cover Art Downloader');
  console.log(`Library path: ${libraryPath}`);
  console.log(`Snapshot path: ${snapshotPath}`);
  console.log('');
  
  await findAndDownloadCovers(libraryPath, snapshotPath);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

