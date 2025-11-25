import 'dotenv/config';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import type { Album, LibrarySnapshot, Track } from '../../shared/library.ts';

interface ReviewIssue {
  severity: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  albumId?: string;
  trackId?: string;
}

interface AlbumReview {
  album: Album;
  issues: ReviewIssue[];
  score: number; // 0-100, higher is better
}

function reviewTrack(track: Track, album: Album): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  
  // Required fields
  if (!track.id) {
    issues.push({ severity: 'error', category: 'track', message: 'Missing track ID', trackId: track.id });
  }
  if (!track.title || track.title.trim() === '') {
    issues.push({ severity: 'error', category: 'track', message: 'Missing or empty track title', trackId: track.id });
  }
  if (!track.trackNumber || track.trackNumber < 1) {
    issues.push({ severity: 'error', category: 'track', message: 'Invalid track number', trackId: track.id });
  }
  if (!track.format) {
    issues.push({ severity: 'error', category: 'track', message: 'Missing format', trackId: track.id });
  }
  if (!track.filePath) {
    issues.push({ severity: 'error', category: 'track', message: 'Missing file path', trackId: track.id });
  }
  
  // Duration issues
  if (track.durationMs === 0) {
    issues.push({ severity: 'warning', category: 'track', message: 'Track duration is 0 (may not be extracted)', trackId: track.id });
  }
  if (track.durationMs < 0) {
    issues.push({ severity: 'error', category: 'track', message: 'Negative duration', trackId: track.id });
  }
  
  // File size
  if (!track.sizeBytes || track.sizeBytes === 0) {
    issues.push({ severity: 'warning', category: 'track', message: 'File size is 0 or missing', trackId: track.id });
  }
  
  return issues;
}

function reviewAlbum(album: Album): AlbumReview {
  const issues: ReviewIssue[] = [];
  
  // Required fields
  if (!album.id) {
    issues.push({ severity: 'error', category: 'album', message: 'Missing album ID', albumId: album.id });
  }
  if (!album.title || album.title.trim() === '') {
    issues.push({ severity: 'error', category: 'album', message: 'Missing or empty album title', albumId: album.id });
  }
  if (!album.locationPath) {
    issues.push({ severity: 'error', category: 'album', message: 'Missing location path', albumId: album.id });
  }
  if (!album.lastSyncedAt) {
    issues.push({ severity: 'warning', category: 'album', message: 'Missing last synced timestamp', albumId: album.id });
  }
  
  // Tracks
  if (!album.tracks || album.tracks.length === 0) {
    issues.push({ severity: 'error', category: 'album', message: 'No tracks found', albumId: album.id });
  } else {
    // Review each track
    album.tracks.forEach(track => {
      issues.push(...reviewTrack(track, album));
    });
    
    // Check for duplicate track numbers
    const trackNumbers = album.tracks.map(t => t.trackNumber);
    const duplicates = trackNumbers.filter((num, idx) => trackNumbers.indexOf(num) !== idx);
    if (duplicates.length > 0) {
      issues.push({ severity: 'warning', category: 'album', message: `Duplicate track numbers: ${[...new Set(duplicates)].join(', ')}`, albumId: album.id });
    }
    
    // Check track number sequence
    const sortedNumbers = [...trackNumbers].sort((a, b) => a - b);
    const expectedSequence = Array.from({ length: sortedNumbers.length }, (_, i) => i + 1);
    if (JSON.stringify(sortedNumbers) !== JSON.stringify(expectedSequence)) {
      issues.push({ severity: 'info', category: 'album', message: 'Track numbers are not sequential (may be intentional for multi-disc)', albumId: album.id });
    }
  }
  
  // Formats
  if (!album.formats || album.formats.length === 0) {
    issues.push({ severity: 'warning', category: 'album', message: 'No formats specified', albumId: album.id });
  }
  
  // Duration
  if (album.totalDurationMs === 0) {
    const tracksWithDuration = album.tracks.filter(t => t.durationMs > 0).length;
    if (tracksWithDuration === 0) {
      issues.push({ severity: 'warning', category: 'album', message: 'Total duration is 0 and no tracks have duration', albumId: album.id });
    } else {
      issues.push({ severity: 'info', category: 'album', message: `Total duration is 0 but ${tracksWithDuration} tracks have duration (should be recalculated)`, albumId: album.id });
    }
  }
  
  // File size
  if (!album.totalSizeBytes || album.totalSizeBytes === 0) {
    issues.push({ severity: 'warning', category: 'album', message: 'Total file size is 0 or missing', albumId: album.id });
  }
  
  // Metadata completeness
  if (!album.year) {
    issues.push({ severity: 'info', category: 'metadata', message: 'Missing year', albumId: album.id });
  }
  if (!album.era) {
    issues.push({ severity: 'info', category: 'metadata', message: 'Missing era (e.g., "Mothers Of Invention", "Solo")', albumId: album.id });
  }
  if (!album.genre) {
    issues.push({ severity: 'info', category: 'metadata', message: 'Missing genre', albumId: album.id });
  }
  if (!album.description) {
    issues.push({ severity: 'info', category: 'metadata', message: 'Missing description', albumId: album.id });
  }
  if (!album.coverUrl) {
    issues.push({ severity: 'warning', category: 'metadata', message: 'Missing cover art', albumId: album.id });
  }
  if (!album.tags || album.tags.length === 0) {
    issues.push({ severity: 'info', category: 'metadata', message: 'No tags', albumId: album.id });
  }
  
  // Calculate score (100 = perfect, deduct points for issues)
  let score = 100;
  issues.forEach(issue => {
    if (issue.severity === 'error') score -= 10;
    else if (issue.severity === 'warning') score -= 5;
    else if (issue.severity === 'info') score -= 1;
  });
  score = Math.max(0, score);
  
  return { album, issues, score };
}

async function verifyFilePaths(album: Album): Promise<ReviewIssue[]> {
  const issues: ReviewIssue[] = [];
  
  // Check if album directory exists
  try {
    const albumPath = album.locationPath.startsWith('C:') 
      ? album.locationPath 
      : path.join(process.cwd(), album.locationPath);
    await stat(albumPath);
  } catch {
    issues.push({ severity: 'error', category: 'file', message: `Album directory not found: ${album.locationPath}`, albumId: album.id });
  }
  
  // Check cover art file
  if (album.coverUrl) {
    try {
      const coverPath = album.coverUrl.startsWith('C:') 
        ? album.coverUrl 
        : path.join(process.cwd(), album.coverUrl);
      await stat(coverPath);
    } catch {
      issues.push({ severity: 'warning', category: 'file', message: `Cover art file not found: ${album.coverUrl}`, albumId: album.id });
    }
  }
  
  // Check a sample of track files (first 3 to avoid too many file system calls)
  for (const track of album.tracks.slice(0, 3)) {
    try {
      const trackPath = track.filePath.startsWith('C:') 
        ? track.filePath 
        : path.join(process.cwd(), track.filePath);
      await stat(trackPath);
    } catch {
      issues.push({ severity: 'error', category: 'file', message: `Track file not found: ${track.filePath}`, albumId: album.id, trackId: track.id });
    }
  }
  
  return issues;
}

async function reviewLibrary(snapshotPath: string, verifyFiles = false): Promise<void> {
  console.log('Loading library snapshot...');
  const snapshotContent = await readFile(snapshotPath, 'utf-8');
  const snapshot: LibrarySnapshot = JSON.parse(snapshotContent);
  
  console.log(`Reviewing ${snapshot.albums.length} albums...\n`);
  
  const reviews: AlbumReview[] = [];
  const allIssues: ReviewIssue[] = [];
  
  for (const album of snapshot.albums) {
    const review = reviewAlbum(album);
    
    if (verifyFiles) {
      const fileIssues = await verifyFilePaths(album);
      review.issues.push(...fileIssues);
      review.score = Math.max(0, review.score - (fileIssues.length * 5));
    }
    
    reviews.push(review);
    allIssues.push(...review.issues);
  }
  
  // Generate report
  console.log('='.repeat(80));
  console.log('LIBRARY REVIEW REPORT');
  console.log('='.repeat(80));
  console.log(`Total Albums: ${snapshot.albums.length}`);
  console.log(`Total Tracks: ${snapshot.trackCount}`);
  console.log('');
  
  // Issue summary
  const errors = allIssues.filter(i => i.severity === 'error');
  const warnings = allIssues.filter(i => i.severity === 'warning');
  const infos = allIssues.filter(i => i.severity === 'info');
  
  console.log('ISSUE SUMMARY:');
  console.log(`  Errors: ${errors.length}`);
  console.log(`  Warnings: ${warnings.length}`);
  console.log(`  Info: ${infos.length}`);
  console.log('');
  
  // Albums by score
  const perfectAlbums = reviews.filter(r => r.score === 100).length;
  const goodAlbums = reviews.filter(r => r.score >= 80 && r.score < 100).length;
  const fairAlbums = reviews.filter(r => r.score >= 60 && r.score < 80).length;
  const poorAlbums = reviews.filter(r => r.score < 60).length;
  
  console.log('ALBUM QUALITY SCORES:');
  console.log(`  Perfect (100): ${perfectAlbums}`);
  console.log(`  Good (80-99): ${goodAlbums}`);
  console.log(`  Fair (60-79): ${fairAlbums}`);
  console.log(`  Poor (<60): ${poorAlbums}`);
  console.log('');
  
  // Category breakdown
  const categoryCounts = new Map<string, number>();
  allIssues.forEach(issue => {
    categoryCounts.set(issue.category, (categoryCounts.get(issue.category) || 0) + 1);
  });
  
  console.log('ISSUES BY CATEGORY:');
  Array.from(categoryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      console.log(`  ${category}: ${count}`);
    });
  console.log('');
  
  // Albums with errors
  const albumsWithErrors = reviews.filter(r => r.issues.some(i => i.severity === 'error'));
  if (albumsWithErrors.length > 0) {
    console.log('ALBUMS WITH ERRORS:');
    albumsWithErrors.forEach(({ album, issues }) => {
      const errorCount = issues.filter(i => i.severity === 'error').length;
      console.log(`  ${album.title} (${errorCount} errors, score: ${issues.reduce((s, i) => s + (i.severity === 'error' ? 10 : i.severity === 'warning' ? 5 : 1), 0)})`);
    });
    console.log('');
  }
  
  // Albums missing critical metadata
  const albumsMissingMetadata = reviews.filter(r => 
    !r.album.era || !r.album.genre || !r.album.description
  );
  if (albumsMissingMetadata.length > 0) {
    console.log('ALBUMS MISSING METADATA (era, genre, or description):');
    albumsMissingMetadata.slice(0, 20).forEach(({ album }) => {
      const missing = [];
      if (!album.era) missing.push('era');
      if (!album.genre) missing.push('genre');
      if (!album.description) missing.push('description');
      console.log(`  ${album.title}: missing ${missing.join(', ')}`);
    });
    if (albumsMissingMetadata.length > 20) {
      console.log(`  ... and ${albumsMissingMetadata.length - 20} more`);
    }
    console.log('');
  }
  
  // Albums with missing durations
  const albumsWithNoDurations = reviews.filter(r => 
    r.album.totalDurationMs === 0 && r.album.tracks.every(t => t.durationMs === 0)
  );
  if (albumsWithNoDurations.length > 0) {
    console.log('ALBUMS WITH NO TRACK DURATIONS:');
    albumsWithNoDurations.slice(0, 10).forEach(({ album }) => {
      console.log(`  ${album.title} (${album.tracks.length} tracks)`);
    });
    if (albumsWithNoDurations.length > 10) {
      console.log(`  ... and ${albumsWithNoDurations.length - 10} more`);
    }
    console.log('');
  }
  
  // Albums missing cover art
  const albumsMissingCover = reviews.filter(r => !r.album.coverUrl);
  if (albumsMissingCover.length > 0) {
    console.log('ALBUMS MISSING COVER ART:');
    albumsMissingCover.forEach(({ album }) => {
      console.log(`  ${album.title}`);
    });
    console.log('');
  }
  
  // Worst albums
  const worstAlbums = [...reviews]
    .sort((a, b) => a.score - b.score)
    .slice(0, 10)
    .filter(r => r.score < 100);
  
  if (worstAlbums.length > 0) {
    console.log('ALBUMS NEEDING ATTENTION (lowest scores):');
    worstAlbums.forEach(({ album, issues, score }) => {
      console.log(`  ${album.title} (score: ${score})`);
      issues.slice(0, 3).forEach(issue => {
        console.log(`    [${issue.severity.toUpperCase()}] ${issue.category}: ${issue.message}`);
      });
      if (issues.length > 3) {
        console.log(`    ... and ${issues.length - 3} more issues`);
      }
    });
    console.log('');
  }
  
  // Metadata completeness statistics
  const withYear = snapshot.albums.filter(a => a.year).length;
  const withEra = snapshot.albums.filter(a => a.era).length;
  const withGenre = snapshot.albums.filter(a => a.genre).length;
  const withDescription = snapshot.albums.filter(a => a.description).length;
  const withCover = snapshot.albums.filter(a => a.coverUrl).length;
  const withTags = snapshot.albums.filter(a => a.tags && a.tags.length > 0).length;
  
  console.log('METADATA COMPLETENESS:');
  console.log(`  Year: ${withYear}/${snapshot.albums.length} (${Math.round(withYear / snapshot.albums.length * 100)}%)`);
  console.log(`  Era: ${withEra}/${snapshot.albums.length} (${Math.round(withEra / snapshot.albums.length * 100)}%)`);
  console.log(`  Genre: ${withGenre}/${snapshot.albums.length} (${Math.round(withGenre / snapshot.albums.length * 100)}%)`);
  console.log(`  Description: ${withDescription}/${snapshot.albums.length} (${Math.round(withDescription / snapshot.albums.length * 100)}%)`);
  console.log(`  Cover Art: ${withCover}/${snapshot.albums.length} (${Math.round(withCover / snapshot.albums.length * 100)}%)`);
  console.log(`  Tags: ${withTags}/${snapshot.albums.length} (${Math.round(withTags / snapshot.albums.length * 100)}%)`);
  console.log('');
  
  // Track duration statistics
  const tracksWithDuration = snapshot.albums.reduce((sum, album) => 
    sum + album.tracks.filter(t => t.durationMs > 0).length, 0
  );
  console.log('TRACK DURATION STATISTICS:');
  console.log(`  Tracks with duration: ${tracksWithDuration}/${snapshot.trackCount} (${Math.round(tracksWithDuration / snapshot.trackCount * 100)}%)`);
  console.log(`  Tracks without duration: ${snapshot.trackCount - tracksWithDuration}`);
  console.log('');
  
  console.log('='.repeat(80));
  console.log('Review complete!');
}

async function main() {
  const args = process.argv.slice(2);
  const snapshotPath = args[0] || path.resolve('webapp/data/library.generated.json');
  const verifyFiles = args.includes('--verify-files');
  
  console.log('Library Review Tool');
  console.log(`Snapshot path: ${snapshotPath}`);
  console.log(`Verify files: ${verifyFiles ? 'Yes' : 'No'}`);
  console.log('');
  
  await reviewLibrary(snapshotPath, verifyFiles);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

