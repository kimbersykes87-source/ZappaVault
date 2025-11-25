import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import type {
  Album,
  LibrarySnapshot,
  Track,
} from '../../shared/library.ts';

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
const dropboxToken = process.env.DROPBOX_TOKEN;
const rootFolder = (args.path as string) ?? process.env.DROPBOX_LIBRARY_PATH ?? '/ZappaLibrary';
const outputFile = (args.out as string) ?? path.resolve('data/library.generated.json');

if (!dropboxToken) {
  console.error('DROPBOX_TOKEN missing. Add it to your .env file.');
  process.exit(1);
}

async function dropboxRequest<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${DROPBOX_API}/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${dropboxToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Dropbox error (${endpoint}): ${text}`);
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
  const match = text.match(/(19|20)\d{2}/);
  return match ? Number(match[0]) : undefined;
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
  const possibleFolderNames = ['Cover', 'cover', 'Covers', 'covers', 'Artwork', 'artwork', 'Images', 'images'];
  
  // First, try looking in subfolders
  for (const folderName of possibleFolderNames) {
    const coverFolderEntries = entries.filter(
      (entry) =>
        entry['.tag'] === 'file' &&
        entry.path_lower.includes(`/${folderName.toLowerCase()}/`) &&
        imageExtensions.some((ext) => entry.name.toLowerCase().endsWith(ext)),
    );
    
    if (coverFolderEntries.length > 0) {
      // Prioritize files with "1", "front", or "cover" in the name
      const prioritized = coverFolderEntries.sort((a, b) => {
        const aLower = a.name.toLowerCase();
        const bLower = b.name.toLowerCase();
        const aHas1 = aLower.startsWith('1') || aLower.includes(' 1 ') || aLower.includes('_1_');
        const bHas1 = bLower.startsWith('1') || bLower.includes(' 1 ') || bLower.includes('_1_');
        const aHasFront = aLower.includes('front') || aLower.includes('cover');
        const bHasFront = bLower.includes('front') || bLower.includes('cover');
        
        if (aHas1 && !bHas1) return -1;
        if (!aHas1 && bHas1) return 1;
        if (aHasFront && !bHasFront) return -1;
        if (!aHasFront && bHasFront) return 1;
        return 0;
      });
      
      // Return the Dropbox path for the best match
      return normalizeDropboxPath(prioritized[0].path_display);
    }
  }
  
  // If no cover found in subfolders, try looking in the album root folder
  // Find files directly in the album folder (not in subfolders)
  const folderDepth = folderPath.split('/').length;
  const rootImageFiles = entries.filter(
    (entry) => {
      if (entry['.tag'] !== 'file') return false;
      if (!imageExtensions.some((ext) => entry.name.toLowerCase().endsWith(ext))) return false;
      
      // Check if file is directly in the album folder (one level deeper)
      const entryDepth = entry.path_lower.split('/').length;
      return entryDepth === folderDepth + 1 && entry.path_lower.startsWith(folderPath.toLowerCase() + '/');
    },
  );
  
  if (rootImageFiles.length > 0) {
    const prioritized = rootImageFiles.sort((a, b) => {
      const aLower = a.name.toLowerCase();
      const bLower = b.name.toLowerCase();
      const aHas1 = aLower.startsWith('1') || aLower.includes(' 1 ') || aLower.includes('_1_');
      const bHas1 = bLower.startsWith('1') || bLower.includes(' 1 ') || bLower.includes('_1_');
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

function buildAlbum(
  folder: DropboxEntry,
  tracks: Track[],
  coverUrl?: string,
): Album | undefined {
  if (tracks.length === 0) {
    return undefined;
  }

  const totalSize = tracks.reduce((sum, track) => sum + track.sizeBytes, 0);
  const formats = Array.from(new Set(tracks.map((track) => track.format)));

  // Normalize location path to ensure it's in Dropbox API format
  const normalizedLocationPath = normalizeDropboxPath(folder.path_display);

  return {
    id: slugify(folder.path_lower),
    title: folder.name,
    year: extractYear(folder.name),
    era: undefined,
    genre: undefined,
    description: undefined,
    coverUrl,
    locationPath: normalizedLocationPath,
    lastSyncedAt: new Date().toISOString(),
    tags: [],
    tracks: tracks.sort((a, b) => a.trackNumber - b.trackNumber),
    formats,
    totalDurationMs: 0,
    totalSizeBytes: totalSize,
  };
}

async function generateSnapshot(): Promise<LibrarySnapshot> {
  const albumFolders = await listImmediateFolders(rootFolder);
  const albums: Album[] = [];

  for (const folder of albumFolders) {
    const entries = await listFolderRecursive(folder.path_lower);
    const tracks = entries
      .filter((entry) => entry['.tag'] === 'file')
      .map((entry, index) => parseTrack(entry, index))
      .filter((track): track is Track => Boolean(track));

    // Find cover art for this album
    const coverPath = await findCoverArt(folder.path_lower, entries);
    
    const album = buildAlbum(folder, tracks, coverPath);
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
    return;
  }

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
    throw new Error(`Cloudflare KV bulk write failed: ${await response.text()}`);
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
    console.log('Cloudflare KV updated (if credentials provided).');
  } catch (error) {
    console.warn('Cloudflare KV update failed (non-blocking):', error);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

