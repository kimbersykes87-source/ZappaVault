import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load track durations from the SQLite database
 * Returns a Map of file_path -> durationMs
 */
export function loadTrackDurations(): Map<string, number> {
  // Try multiple possible locations for the database
  const possiblePaths = [
    path.resolve(__dirname, '../../../zappa_tracks.db'), // From webapp/scripts/
    path.resolve(process.cwd(), 'zappa_tracks.db'), // From project root
    path.resolve(process.cwd(), '../zappa_tracks.db'), // From webapp/
    'zappa_tracks.db', // Current directory
  ];
  
  let dbPath: string | undefined;
  for (const possiblePath of possiblePaths) {
    if (existsSync(possiblePath)) {
      dbPath = possiblePath;
      break;
    }
  }
  
  if (!dbPath) {
    console.warn(`⚠️  Could not find zappa_tracks.db in any of these locations: ${possiblePaths.join(', ')}`);
    console.warn(`   This is not critical - durations will default to 0`);
    return new Map<string, number>();
  }
  
  try {
    const db = new Database(dbPath, { readonly: true });
    
    // Query all tracks with their file paths and durations
    const stmt = db.prepare(`
      SELECT file_path, duration_seconds 
      FROM Tracks 
      WHERE duration_seconds IS NOT NULL AND duration_seconds > 0
    `);
    
    const rows = stmt.all() as Array<{ file_path: string; duration_seconds: number }>;
    
    const durationMap = new Map<string, number>();
    
    for (const row of rows) {
      // Normalize the path to match Dropbox format
      // Database paths might be Windows paths or Dropbox paths
      let normalizedPath = row.file_path;
      
      // Convert Windows paths to Dropbox paths
      if (normalizedPath.startsWith('C:/') || normalizedPath.startsWith('c:/')) {
        const dropboxIndex = normalizedPath.toLowerCase().indexOf('/dropbox/');
        if (dropboxIndex !== -1) {
          normalizedPath = normalizedPath.substring(dropboxIndex + '/dropbox'.length);
          if (!normalizedPath.startsWith('/')) {
            normalizedPath = `/${normalizedPath}`;
          }
        } else {
          // Try to find ZappaLibrary
          const zappaLibraryIndex = normalizedPath.toLowerCase().indexOf('zappalibrary');
          if (zappaLibraryIndex !== -1) {
            normalizedPath = normalizedPath.substring(zappaLibraryIndex);
            normalizedPath = `/${normalizedPath.replace(/\\/g, '/')}`;
          }
        }
      }
      
      // Ensure path starts with /
      if (!normalizedPath.startsWith('/')) {
        normalizedPath = `/${normalizedPath.replace(/\\/g, '/')}`;
      }
      
      // Normalize slashes
      normalizedPath = normalizedPath.replace(/\\/g, '/');
      
      // Convert seconds to milliseconds
      const durationMs = Math.round(row.duration_seconds * 1000);
      
      // Store both the original path and normalized path for matching
      durationMap.set(normalizedPath, durationMs);
      
      // Also try lowercase version for case-insensitive matching
      durationMap.set(normalizedPath.toLowerCase(), durationMs);
    }
    
    db.close();
    
    console.log(`✅ Loaded ${durationMap.size / 2} track durations from database`);
    
    return durationMap;
  } catch (error) {
    console.warn(`⚠️  Could not load track durations from database: ${error instanceof Error ? error.message : String(error)}`);
    console.warn(`   Database path: ${dbPath}`);
    console.warn(`   This is not critical - durations will default to 0`);
    return new Map<string, number>();
  }
}

/**
 * Get duration for a track by matching file path
 */
export function getTrackDuration(
  durationMap: Map<string, number>,
  filePath: string,
): number {
  // Try exact match first
  let duration = durationMap.get(filePath);
  if (duration) {
    return duration;
  }
  
  // Try lowercase match
  duration = durationMap.get(filePath.toLowerCase());
  if (duration) {
    return duration;
  }
  
  // Try matching just the filename (in case paths differ slightly)
  const fileName = filePath.split('/').pop()?.toLowerCase();
  if (fileName) {
    // This is a fallback - less reliable but might catch some matches
    for (const [dbPath, dbDuration] of durationMap.entries()) {
      if (dbPath.toLowerCase().endsWith(fileName)) {
        return dbDuration;
      }
    }
  }
  
  return 0;
}

