import 'dotenv/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import type {
  Album,
  LibrarySnapshot,
  Track,
} from '../../shared/library.ts';
import { refreshAccessToken } from './refreshDropboxToken.ts';

const DROPBOX_API = 'https://api.dropboxapi.com/2';
const AUDIO_EXTENSIONS = ['.flac', '.mp3', '.wav', '.aiff', '.ogg'];

interface DropboxEntry {
  '.tag': 'file' | 'folder';
  id: string;
  name: string;
  path_display: string;
  path_lower: string;
  server_modified?: string;
  client_modified?: string;
  size?: number;
}

interface ListFolderResponse {
  cursor: string;
  has_more: boolean;
  entries: DropboxEntry[];
}

type ArgMap = Record<string, string | boolean>;

function parseArgs(argv: string[]): ArgMap {
  const args: ArgMap = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const [key, value] = token.slice(2).split('=');
      if (value) {
        args[key] = value;
      } else if (argv[i + 1] && !argv[i + 1].startsWith('--')) {
        args[key] = argv[i + 1];
        i += 1;
      } else {
        args[key] = true;
      }
    }
  }

  return args;
}

const args = parseArgs(process.argv.slice(2));
let dropboxToken: string | undefined = process.env.DROPBOX_TOKEN;
const rootFolder = (args.path as string) ?? process.env.DROPBOX_LIBRARY_PATH ?? '/ZappaLibrary';
const outputFile = (args.out as string) ?? path.resolve('data/library.generated.json');
const metadataFile = path.resolve('data/album-metadata.json');

/**
 * Get a valid Dropbox access token, refreshing if necessary
 */
async function getValidToken(): Promise<string> {
  // If we have a refresh token setup, prefer using it to get a fresh token
  if (process.env.DROPBOX_REFRESH_TOKEN && process.env.DROPBOX_APP_KEY && process.env.DROPBOX_APP_SECRET) {
    try {
      dropboxToken = await refreshAccessToken();
      console.log('✅ Successfully obtained fresh access token from refresh token');
      return dropboxToken;
    } catch (error) {
      console.error('❌ Failed to refresh token:', error instanceof Error ? error.message : error);
      // If refresh fails and we have DROPBOX_TOKEN as fallback, use it
      if (dropboxToken) {
        console.warn('⚠️  Falling back to DROPBOX_TOKEN (if provided)');
        return dropboxToken;
      }
      throw new Error('Failed to refresh token and no DROPBOX_TOKEN fallback available. Please check your refresh token credentials.');
    }
  }
  
  // Fallback to DROPBOX_TOKEN if no refresh token setup
  if (!dropboxToken) {
    throw new Error('No Dropbox token available. Please set up refresh token credentials (DROPBOX_REFRESH_TOKEN, DROPBOX_APP_KEY, DROPBOX_APP_SECRET) or provide DROPBOX_TOKEN.');
  }
  
  return dropboxToken;
}

async function dropboxRequest<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  let token = await getValidToken();
  let response = await fetch(`${DROPBOX_API}/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  // If token expired, refresh and retry once
  if (!response.ok) {
    const text = await response.text();
    let errorMessage = `Dropbox error (${endpoint}): ${text}`;
    
    try {
      const errorData = JSON.parse(text);
      
      // Handle expired token by refreshing
      if (errorData.error?.['.tag'] === 'expired_access_token' && process.env.DROPBOX_REFRESH_TOKEN) {
        console.log('🔄 Access token expired, refreshing...');
        try {
          token = await refreshAccessToken();
          dropboxToken = token; // Update cached token
          console.log('✅ Successfully refreshed access token, retrying request...');
          
          // Retry the request with new token
          response = await fetch(`${DROPBOX_API}/${endpoint}`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify(body),
          });
          
          // If retry succeeded, return the result
          if (response.ok) {
            return (await response.json()) as T;
          }
          
          // If retry also failed, fall through to error handling
          const retryText = await response.text();
          errorMessage = `Dropbox error (${endpoint}) after token refresh: ${retryText}`;
        } catch (refreshError) {
          errorMessage = `❌ Failed to refresh expired token: ${refreshError instanceof Error ? refreshError.message : refreshError}\n\n` +
            `Original error: ${text}`;
        }
      } else if (errorData.error?.['.tag'] === 'expired_access_token') {
        // Token expired but no refresh token configured
        errorMessage = `❌ Dropbox access token has expired!\n\n` +
          `To fix this:\n` +
          `1. Set up refresh token flow (recommended) - see docs/DROPBOX_TOKEN_SETUP.md\n` +
          `   Configure DROPBOX_REFRESH_TOKEN, DROPBOX_APP_KEY, and DROPBOX_APP_SECRET\n` +
          `2. Update the secrets in GitHub Actions\n` +
          `   (Settings → Secrets and variables → Actions)\n` +
          `3. Re-run the sync workflow\n\n` +
          `Original error: ${text}`;
      } else if (errorData.error?.['.tag'] === 'invalid_access_token') {
        errorMessage = `❌ Invalid Dropbox access token!\n\n` +
          `Please check that refresh token credentials (DROPBOX_REFRESH_TOKEN, DROPBOX_APP_KEY, DROPBOX_APP_SECRET) are set correctly.\n\n` +
          `Original error: ${text}`;
      }
    } catch {
      // If parsing fails, use the original error message
    }
    
    throw new Error(errorMessage);
  }

  return (await response.json()) as T;
}

async function listFolderRecursive(folderPath: string): Promise<DropboxEntry[]> {
  const entries: DropboxEntry[] = [];
  let cursor: string | undefined;

  do {
    const payload = cursor
      ? await dropboxRequest<ListFolderResponse>('files/list_folder/continue', { cursor })
      : await dropboxRequest<ListFolderResponse>('files/list_folder', {
          path: folderPath,
          recursive: true,
          include_deleted: false,
          include_media_info: false,
        });

    entries.push(...payload.entries);
    cursor = payload.has_more ? payload.cursor : undefined;
  } while (cursor);

  return entries;
}

async function listImmediateFolders(folderPath: string): Promise<DropboxEntry[]> {
  const entries: DropboxEntry[] = [];
  let cursor: string | undefined;

  do {
    const payload = cursor
      ? await dropboxRequest<ListFolderResponse>('files/list_folder/continue', { cursor })
      : await dropboxRequest<ListFolderResponse>('files/list_folder', {
          path: folderPath,
          recursive: false,
          include_deleted: false,
          include_media_info: false,
        });
    entries.push(...payload.entries);
    cursor = payload.has_more ? payload.cursor : undefined;
  } while (cursor);

  return entries.filter((entry) => entry['.tag'] === 'folder');
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

function extractYear(text: string): number | undefined {
  // Try multiple patterns: (1969), [1969], - 1969, 1969, etc.
  const patterns = [
    /\((\d{4})\)/,           // (1969)
    /\[(\d{4})\]/,           // [1969]
    /[-–—]\s*(\d{4})\b/,     // - 1969 or – 1969
    /\b(19\d{2}|20\d{2})\b/, // 1969 or 1979 (standalone)
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const year = Number(match[1] || match[0]);
      if (year >= 1900 && year <= 2100) {
        return year;
      }
    }
  }
  
  return undefined;
}

function parseTitleAndYear(folderName: string): { title: string; year?: number } {
  const year = extractYear(folderName);
  let title = folderName;
  
  // Remove year patterns from title
  if (year) {
    title = title
      .replace(/\(\d{4}\)/, '')      // Remove (1969)
      .replace(/\[\d{4}\]/, '')      // Remove [1969]
      .replace(/[-–—]\s*\d{4}\b/, '') // Remove - 1969
      .trim();
  }
  
  return { title, year };
}

function detectFormat(filename: string): string {
  const ext = path.extname(filename).replace('.', '').toUpperCase();
  return ext || 'UNKNOWN';
}

function normalizeDropboxPath(dropboxPath: string): string {
  // Ensure path is in Dropbox API format (starts with /)
  // Convert Windows paths to Dropbox paths if needed
  if (dropboxPath.startsWith('C:/') || dropboxPath.startsWith('c:/')) {
    // Find /Dropbox/ in the path and extract everything after it
    const dropboxIndex = dropboxPath.toLowerCase().indexOf('/dropbox/');
    if (dropboxIndex !== -1) {
      const afterDropbox = dropboxPath.substring(dropboxIndex + '/dropbox'.length);
      return afterDropbox.startsWith('/') ? afterDropbox : `/${afterDropbox}`;
    }
    // Fallback: try to find Apps/ZappaVault/ZappaLibrary
    const zappaLibraryIndex = dropboxPath.toLowerCase().indexOf('zappalibrary');
    if (zappaLibraryIndex !== -1) {
      const afterZappaLibrary = dropboxPath.substring(zappaLibraryIndex);
      return `/${afterZappaLibrary.replace(/\\/g, '/')}`;
    }
  }
  // If already starts with /, it's already a Dropbox path
  if (dropboxPath.startsWith('/')) {
    return dropboxPath;
  }
  // Otherwise, assume it's relative to root and add /
  return `/${dropboxPath.replace(/\\/g, '/')}`;
}

function parseTrack(entry: DropboxEntry, index: number): Track | undefined {
  const extension = path.extname(entry.name).toLowerCase();
  if (!AUDIO_EXTENSIONS.includes(extension)) {
    return undefined;
  }

  const numberMatch = entry.name.match(/^(\d{1,2})/);
  const trackNumber = numberMatch ? Number(numberMatch[1]) : index + 1;

  // Normalize path to ensure it's in Dropbox API format
  const normalizedPath = normalizeDropboxPath(entry.path_display);

  return {
    id: slugify(entry.path_lower),
    title: entry.name.replace(/\.[^.]+$/, '').replace(/^\d{1,2}\s*-*\s*/, ''),
    durationMs: 0,
    trackNumber,
    format: detectFormat(entry.name),
    filePath: normalizedPath,
    sizeBytes: entry.size ?? 0,
  };
}

async function findCoverArt(
  folderPath: string,
  entries: DropboxEntry[],
): Promise<string | undefined> {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tif', '.tiff'];
  
  // Priority 1: Look in Cover/cover folder (most common location)
  // Check both exact case matches to handle case-sensitive filesystems
  const coverFolderNames = ['Cover', 'cover'];
  for (const folderName of coverFolderNames) {
    const coverFolderEntries = entries.filter(
      (entry) => {
        if (entry['.tag'] !== 'file') return false;
        if (!imageExtensions.some((ext) => entry.name.toLowerCase().endsWith(ext))) return false;
        // Match files in /Cover/ or /cover/ folder (case-sensitive match for exact folder name)
        const pathLower = entry.path_lower;
        const expectedPath = `${folderPath.toLowerCase()}/${folderName.toLowerCase()}/`;
        return pathLower.startsWith(expectedPath);
      },
    );
    
    if (coverFolderEntries.length > 0) {
      // Prioritize files with "1", "front", "cover", or "folder" in the name
      const prioritized = coverFolderEntries.sort((a, b) => {
        const aLower = a.name.toLowerCase();
        const bLower = b.name.toLowerCase();
        const aHas1 = aLower.startsWith('1') || aLower.includes(' 1 ') || aLower.includes('_1_') || aLower.includes('-1-');
        const bHas1 = bLower.startsWith('1') || bLower.includes(' 1 ') || bLower.includes('_1_') || bLower.includes('-1-');
        const aHasFront = aLower.includes('front') || aLower.includes('cover') || aLower.includes('folder');
        const bHasFront = bLower.includes('front') || bLower.includes('cover') || bLower.includes('folder');
        
        // Exact match for "folder" has high priority
        const aIsFolder = aLower.replace(/\.[^.]+$/, '') === 'folder';
        const bIsFolder = bLower.replace(/\.[^.]+$/, '') === 'folder';
        
        if (aIsFolder && !bIsFolder) return -1;
        if (!aIsFolder && bIsFolder) return 1;
        if (aHas1 && !bHas1) return -1;
        if (!aHas1 && bHas1) return 1;
        if (aHasFront && !bHasFront) return -1;
        if (!aHasFront && bHasFront) return 1;
        return 0;
      });
      
      return normalizeDropboxPath(prioritized[0].path_display);
    }
  }
  
  // Priority 2: Look in other artwork folders (Covers, Artwork, Images, etc.)
  const otherFolderNames = ['Covers', 'covers', 'Artwork', 'artwork', 'Images', 'images'];
  for (const folderName of otherFolderNames) {
    const coverFolderEntries = entries.filter(
      (entry) => {
        if (entry['.tag'] !== 'file') return false;
        if (!imageExtensions.some((ext) => entry.name.toLowerCase().endsWith(ext))) return false;
        const pathLower = entry.path_lower;
        const expectedPath = `${folderPath.toLowerCase()}/${folderName.toLowerCase()}/`;
        return pathLower.startsWith(expectedPath);
      },
    );
    
    if (coverFolderEntries.length > 0) {
      const prioritized = coverFolderEntries.sort((a, b) => {
        const aLower = a.name.toLowerCase();
        const bLower = b.name.toLowerCase();
        const aHas1 = aLower.startsWith('1') || aLower.includes(' 1 ') || aLower.includes('_1_') || aLower.includes('-1-');
        const bHas1 = bLower.startsWith('1') || bLower.includes(' 1 ') || bLower.includes('_1_') || bLower.includes('-1-');
        const aHasFront = aLower.includes('front') || aLower.includes('cover') || aLower.includes('folder');
        const bHasFront = bLower.includes('front') || bLower.includes('cover') || bLower.includes('folder');
        
        // Exact match for "folder" has high priority
        const aIsFolder = aLower.replace(/\.[^.]+$/, '') === 'folder';
        const bIsFolder = bLower.replace(/\.[^.]+$/, '') === 'folder';
        
        if (aIsFolder && !bIsFolder) return -1;
        if (!aIsFolder && bIsFolder) return 1;
        if (aHas1 && !bHas1) return -1;
        if (!aHas1 && bHas1) return 1;
        if (aHasFront && !bHasFront) return -1;
        if (!aHasFront && bHasFront) return 1;
        return 0;
      });
      
      return normalizeDropboxPath(prioritized[0].path_display);
    }
  }
  
  // Priority 3: Common cover filenames in root (cover.jpg, folder.jpg, etc.)
  const folderDepth = folderPath.split('/').length;
  const rootFiles = entries.filter(
    (entry) => {
      if (entry['.tag'] !== 'file') return false;
      if (!imageExtensions.some((ext) => entry.name.toLowerCase().endsWith(ext))) return false;
      const entryDepth = entry.path_lower.split('/').length;
      return entryDepth === folderDepth + 1 && entry.path_lower.startsWith(folderPath.toLowerCase() + '/');
    },
  );
  
  const commonCoverNames = ['cover', 'folder', 'album', 'front', 'artwork'];
  for (const coverName of commonCoverNames) {
    const match = rootFiles.find((entry) => {
      const name = entry.name.toLowerCase().replace(/\.[^.]+$/, '');
      return name === coverName || name.startsWith(coverName + '.') || name.startsWith(coverName + '_');
    });
    if (match) {
      return normalizeDropboxPath(match.path_display);
    }
  }
  
  // Priority 4: Any image in root folder
  if (rootFiles.length > 0) {
    const prioritized = rootFiles.sort((a, b) => {
      const aLower = a.name.toLowerCase();
      const bLower = b.name.toLowerCase();
      const aHas1 = aLower.startsWith('1') || aLower.includes(' 1 ') || aLower.includes('_1_') || aLower.includes('-1-');
      const bHas1 = bLower.startsWith('1') || bLower.includes(' 1 ') || bLower.includes('_1_') || bLower.includes('-1-');
      const aHasFront = aLower.includes('front') || aLower.includes('cover');
      const bHasFront = bLower.includes('front') || bLower.includes('cover');
      
      if (aHas1 && !bHas1) return -1;
      if (!aHas1 && bHas1) return 1;
      if (aHasFront && !bHasFront) return -1;
      if (!aHasFront && bHasFront) return 1;
      return 0;
    });
    
    return normalizeDropboxPath(prioritized[0].path_display);
  }
  
  return undefined;
}

interface AlbumMetadata {
  match: string; // Album name or path to match
  year?: number;
  coverArt?: string | null; // Cover art path (relative to album folder) or null to use auto-detection
  era?: string;
  genre?: string;
  description?: string;
  tags?: string[];
  subtitle?: string;
}

interface MetadataDatabase {
  version: string;
  albums: AlbumMetadata[];
}

async function loadMetadataDatabase(): Promise<MetadataDatabase | null> {
  try {
    const content = await readFile(metadataFile, 'utf-8');
    const db = JSON.parse(content) as MetadataDatabase;
    console.log(`Loaded metadata database with ${db.albums.length} entries`);
    return db;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log('No metadata database found, using defaults');
      return null;
    }
    console.warn('Error loading metadata database:', error);
    return null;
  }
}

function normalizeForMatching(text: string): string {
  // Normalize text for better matching by:
  // 1. Converting to lowercase
  // 2. Removing special Unicode characters that might cause issues
  // 3. Normalizing whitespace
  return text
    .toLowerCase()
    .normalize('NFD') // Decompose characters (e.g., ä -> a + ̈)
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[：／]/g, ' ') // Replace special Unicode punctuation with space
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

function matchAlbumMetadata(
  albumName: string,
  albumPath: string,
  metadataDb: MetadataDatabase | null,
): AlbumMetadata | undefined {
  if (!metadataDb) {
    return undefined;
  }

  const normalizedAlbumName = normalizeForMatching(albumName);
  const normalizedPath = normalizeForMatching(albumPath);

  // Try exact match first (case-insensitive)
  let match = metadataDb.albums.find(
    (meta) => normalizeForMatching(meta.match) === normalizedAlbumName,
  );

  // Try partial match (contains) - check if metadata match is contained in album name
  if (!match) {
    match = metadataDb.albums.find((meta) => {
      const normalizedMatch = normalizeForMatching(meta.match);
      return normalizedAlbumName.includes(normalizedMatch) ||
             normalizedMatch.includes(normalizedAlbumName);
    });
  }

  // Try path-based match
  if (!match) {
    match = metadataDb.albums.find((meta) => {
      const normalizedMatch = normalizeForMatching(meta.match);
      return normalizedPath.includes(normalizedMatch) ||
             normalizedMatch.includes(normalizedPath);
    });
  }

  // Special handling for albums with special characters
  // Try matching just the base name (before special characters)
  if (!match) {
    // Extract base name (e.g., "Zappa '75" from "Zappa '75： Zagreb／Ljubljana")
    const baseNameMatch = albumName.match(/^([^：／]+)/);
    if (baseNameMatch) {
      const baseName = normalizeForMatching(baseNameMatch[1].trim());
      match = metadataDb.albums.find(
        (meta) => normalizeForMatching(meta.match) === baseName,
      );
    }
  }

  return match;
}

function buildAlbum(
  folder: DropboxEntry,
  tracks: Track[],
  coverUrl: string | undefined,
  metadata: AlbumMetadata | undefined,
): Album | undefined {
  // Allow albums with 0 tracks - they may be empty or still being populated
  // This ensures all 106 folders are included in the library

  const totalSize = tracks.reduce((sum, track) => sum + track.sizeBytes, 0);
  const formats = Array.from(new Set(tracks.map((track) => track.format)));

  // Normalize location path to ensure it's in Dropbox API format
  const normalizedLocationPath = normalizeDropboxPath(folder.path_display);

  // Use metadata if available, otherwise parse from folder name
  let title: string;
  let year: number | undefined;

  if (metadata) {
    title = folder.name; // Keep original folder name
    year = metadata.year;
  } else {
    // Fallback: parse title and year from folder name
    const parsed = parseTitleAndYear(folder.name);
    title = parsed.title.trim() || folder.name;
    year = parsed.year;
  }

  // Use metadata cover art path if specified, otherwise use auto-detected
  let finalCoverUrl = coverUrl;
  if (metadata?.coverArt !== undefined) {
    if (metadata.coverArt === null) {
      // null means use auto-detection (already have coverUrl)
      finalCoverUrl = coverUrl;
    } else if (metadata.coverArt) {
      // Specific path provided, construct full path
      finalCoverUrl = normalizeDropboxPath(
        `${normalizedLocationPath}/${metadata.coverArt}`,
      );
    }
  }

  return {
    id: slugify(folder.path_lower),
    title,
    year,
    era: metadata?.era,
    genre: metadata?.genre,
    description: metadata?.description,
    subtitle: metadata?.subtitle,
    coverUrl: finalCoverUrl,
    locationPath: normalizedLocationPath,
    lastSyncedAt: new Date().toISOString(),
    tags: metadata?.tags ?? [],
    tracks: tracks.sort((a, b) => a.trackNumber - b.trackNumber),
    formats,
    totalDurationMs: 0,
    totalSizeBytes: totalSize,
  };
}

async function generateSnapshot(): Promise<LibrarySnapshot> {
  // Load metadata database
  const metadataDb = await loadMetadataDatabase();

  const albumFolders = await listImmediateFolders(rootFolder);
  const albums: Album[] = [];

  for (const folder of albumFolders) {
    const entries = await listFolderRecursive(folder.path_lower);
    const tracks = entries
      .filter((entry) => entry['.tag'] === 'file')
      .map((entry, index) => parseTrack(entry, index))
      .filter((track): track is Track => Boolean(track));

    // Match metadata from database
    const metadata = matchAlbumMetadata(
      folder.name,
      folder.path_display,
      metadataDb,
    );

    // Find cover art for this album (unless metadata specifies a path)
    let coverPath: string | undefined;
    if (metadata?.coverArt === null || metadata?.coverArt === undefined) {
      // Auto-detect cover art
      coverPath = await findCoverArt(folder.path_lower, entries);
    } else if (metadata.coverArt) {
      // Use metadata-specified cover art path
      const normalizedLocationPath = normalizeDropboxPath(folder.path_display);
      coverPath = normalizeDropboxPath(
        `${normalizedLocationPath}/${metadata.coverArt}`,
      );
    }

    const album = buildAlbum(folder, tracks, coverPath, metadata);
    if (album) {
      albums.push(album);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    albumCount: albums.length,
    trackCount: albums.reduce((sum, album) => sum + album.tracks.length, 0),
    albums,
  };
}

async function uploadToCloudflare(snapshot: LibrarySnapshot): Promise<void> {
  const namespaceId = process.env.CF_KV_NAMESPACE_ID;
  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!namespaceId || !accountId || !apiToken) {
    console.warn('⚠️  Cloudflare KV credentials not provided. Skipping KV upload.');
    console.warn('   Missing:', {
      namespaceId: !namespaceId ? 'CF_KV_NAMESPACE_ID' : undefined,
      accountId: !accountId ? 'CF_ACCOUNT_ID' : undefined,
      apiToken: !apiToken ? 'CLOUDFLARE_API_TOKEN' : undefined,
    });
    return;
  }

  console.log('📤 Uploading library snapshot to Cloudflare KV...');
  console.log(`   Account ID: ${accountId.substring(0, 8)}...`);
  console.log(`   Namespace ID: ${namespaceId.substring(0, 8)}...`);
  console.log(`   Albums: ${snapshot.albums.length}`);
  console.log(`   Tracks: ${snapshot.trackCount}`);

  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/bulk`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify([
          {
            key: 'library-snapshot',
            value: JSON.stringify(snapshot),
          },
        ]),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Cloudflare KV upload failed:');
      console.error(`   Status: ${response.status} ${response.statusText}`);
      console.error(`   Error: ${errorText}`);
      throw new Error(`Cloudflare KV bulk write failed: ${response.status} ${errorText}`);
    }

    console.log('✅ Cloudflare KV updated successfully!');
  } catch (error) {
    console.error('❌ Error uploading to Cloudflare KV:', error);
    throw error;
  }
}

async function run(): Promise<void> {
  console.log(`Scanning Dropbox folder: ${rootFolder}`);
  const snapshot = await generateSnapshot();

  await mkdir(path.dirname(outputFile), { recursive: true });
  await writeFile(outputFile, JSON.stringify(snapshot, null, 2));
  console.log(
    `Wrote ${snapshot.albums.length} albums / ${snapshot.trackCount} tracks to ${outputFile}`,
  );

  try {
    await uploadToCloudflare(snapshot);
  } catch (error) {
    console.error('❌ Cloudflare KV update failed:', error);
    console.error('   This is non-blocking - the library file was still generated.');
    console.error('   Check your Cloudflare credentials and try again.');
    // Don't exit - the file generation was successful
  }

  // Optionally copy cover art to public/covers (if --copy-covers flag is set)
  if (args['copy-covers'] || process.env.COPY_COVERS === 'true') {
    console.log('\n📸 Copying cover art to public/covers...');
    try {
      const { execSync } = await import('child_process');
      const webappDir = path.resolve(path.dirname(outputFile), '..');
      execSync('npm run copy:covers', { 
        stdio: 'inherit', 
        cwd: webappDir,
        env: { ...process.env, DROPBOX_LIBRARY_PATH: rootFolder }
      });
      console.log('✅ Cover art copy completed');
    } catch (error) {
      console.warn('⚠️  Failed to copy cover art:', error);
      console.warn('   You can run "npm run copy:covers" manually later.');
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

