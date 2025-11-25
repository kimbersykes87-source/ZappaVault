import {
  applyLibraryQuery,
  DEFAULT_PAGE_SIZE,
} from '../shared/library.ts';
import type { Album, LibraryQuery } from '../shared/library.ts';
import {
  loadLibrarySnapshot,
} from '../utils/library.ts';
import type { EnvBindings } from '../utils/library.ts';

async function getPermanentLink(
  env: EnvBindings,
  filePath: string,
): Promise<string | undefined> {
  if (!env.DROPBOX_TOKEN) {
    console.log(`[COVER DEBUG] No DROPBOX_TOKEN available`);
    return undefined;
  }

  try {
    // First, try to get existing shared link
    let response = await fetch(
      'https://api.dropboxapi.com/2/sharing/list_shared_links',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.DROPBOX_TOKEN}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ 
          path: filePath,
          direct_only: false 
        }),
      },
    );

    if (response.ok) {
      const listPayload = (await response.json()) as { 
        links: Array<{ url: string }> 
      };
      if (listPayload.links && listPayload.links.length > 0) {
        // Convert shared link to direct download link
        const sharedUrl = listPayload.links[0].url;
        return convertToDirectLink(sharedUrl);
      }
    }

    // If no existing link, create a new permanent shared link
    // Try the simpler create_shared_link first (creates public link by default)
    response = await fetch(
      'https://api.dropboxapi.com/2/sharing/create_shared_link',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.DROPBOX_TOKEN}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ 
          path: filePath,
          short_url: false
        }),
      },
    );

    // If that fails, try with settings
    if (!response.ok) {
      response = await fetch(
        'https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.DROPBOX_TOKEN}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ 
            path: filePath,
            settings: {}
          }),
        },
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[COVER DEBUG] create_shared_link failed for ${filePath}: ${response.status} ${errorText}`);
      return undefined;
    }

    const payload = (await response.json()) as { url: string };
    // Convert shared link to direct download link
    return convertToDirectLink(payload.url);
  } catch (error) {
    console.log(`[COVER DEBUG] getPermanentLink error for ${filePath}:`, error);
    return undefined;
  }
}

function convertToDirectLink(sharedUrl: string): string {
  // Convert Dropbox shared link to direct download link
  // https://www.dropbox.com/s/abc123/file.jpg?dl=0
  // -> https://dl.dropboxusercontent.com/s/abc123/file.jpg
  return sharedUrl
    .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
    .replace('?dl=0', '')
    .replace('?dl=1', '')
    .split('?')[0];
}

async function listCoverFolder(
  env: EnvBindings,
  coverFolderPath: string,
): Promise<string[]> {
  if (!env.DROPBOX_TOKEN) {
    return [];
  }

  try {
    const response = await fetch(
      'https://api.dropboxapi.com/2/files/list_folder',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.DROPBOX_TOKEN}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ path: coverFolderPath }),
      },
    );

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as {
      entries: Array<{ name: string; '.tag': string }>;
    };

    return payload.entries
      .filter((entry) => entry['.tag'] === 'file')
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

function convertToDropboxPath(localPath: string): string {
  // Convert Windows path to Dropbox path
  // C:/Users/kimbe/Dropbox/Apps/ZappaVault/ZappaLibrary/... -> /Apps/ZappaVault/ZappaLibrary/...
  if (localPath.startsWith('C:/') || localPath.startsWith('c:/')) {
    // Extract the path after Dropbox
    const dropboxIndex = localPath.toLowerCase().indexOf('/dropbox/');
    if (dropboxIndex !== -1) {
      const afterDropbox = localPath.substring(dropboxIndex + '/dropbox'.length);
      // Ensure it starts with /
      const dropboxPath = afterDropbox.startsWith('/') ? afterDropbox : `/${afterDropbox}`;
      console.log(`[COVER DEBUG] Converted path: ${localPath} -> ${dropboxPath}`);
      return dropboxPath;
    }
  }
  // If already a Dropbox path (starts with /), return as is
  if (localPath.startsWith('/')) {
    return localPath;
  }
  // Otherwise, assume it's relative and add /
  return `/${localPath}`;
}

async function findCoverArt(
  env: EnvBindings,
  album: Album,
): Promise<string | undefined> {
  if (!env.DROPBOX_TOKEN) {
    return undefined;
  }

  // Convert locationPath to Dropbox format
  const dropboxLocationPath = convertToDropboxPath(album.locationPath);
  const coverFolderPath = `${dropboxLocationPath}/Cover`;

  // List files in the Cover folder
  const coverFiles = await listCoverFolder(env, coverFolderPath);

  if (coverFiles.length === 0) {
    console.log(`[COVER DEBUG] No files found in ${coverFolderPath}`);
    return undefined;
  }

  // Filter image files
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
  const imageFiles = coverFiles.filter((file) => {
    const ext = file.toLowerCase().substring(file.lastIndexOf('.'));
    return imageExtensions.includes(ext);
  });

  if (imageFiles.length === 0) {
    return undefined;
  }

  // Prioritize files with "1" or "front" in the name (case-insensitive)
  const prioritized = imageFiles.sort((a, b) => {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    
    const aHas1 = aLower.startsWith('1') || aLower.includes(' 1 ');
    const bHas1 = bLower.startsWith('1') || bLower.includes(' 1 ');
    const aHasFront = aLower.includes('front');
    const bHasFront = bLower.includes('front');

    // Files starting with "1" have highest priority
    if (aHas1 && !bHas1) return -1;
    if (!aHas1 && bHas1) return 1;
    
    // Files with "front" have second priority
    if (aHasFront && !bHasFront) return -1;
    if (!aHasFront && bHasFront) return 1;
    
    return 0;
  });

  // Try to get a permanent link for the first prioritized file
  const bestMatch = prioritized[0];
  const coverPath = `${coverFolderPath}/${bestMatch}`;
  console.log(`[COVER DEBUG] Album: ${album.title}, Found: ${bestMatch}, Path: ${coverPath}`);
  const link = await getPermanentLink(env, coverPath);
  if (link) {
    console.log(`[COVER DEBUG] Successfully got permanent link for ${album.title}`);
  } else {
    console.log(`[COVER DEBUG] Failed to get link for ${album.title} at ${coverPath}`);
  }
  return link;
}

async function getCoverUrl(
  album: Album,
  env: EnvBindings,
): Promise<string | undefined> {
  if (!env.DROPBOX_TOKEN) {
    return album.coverUrl;
  }

  // If coverUrl is already an HTTP URL, return it
  if (album.coverUrl?.startsWith('http')) {
    return album.coverUrl;
  }

  // Find cover art in the Cover folder, prioritizing "1" or "front" images
  return await findCoverArt(env, album);
}

export const onRequestGet: PagesFunction<EnvBindings> = async (context) => {
  const { request, env } = context;
  const snapshot = await loadLibrarySnapshot(env);
  const url = new URL(request.url);

  const query: LibraryQuery = {
    q: url.searchParams.get('q') ?? undefined,
    formats: url.searchParams.getAll('format'),
    era: url.searchParams.get('era') ?? undefined,
    year: url.searchParams.get('year')
      ? Number(url.searchParams.get('year'))
      : undefined,
    sort: (url.searchParams.get('sort') as LibraryQuery['sort']) ?? 'title',
    page: url.searchParams.get('page')
      ? Number(url.searchParams.get('page'))
      : 1,
    pageSize: url.searchParams.get('pageSize')
      ? Number(url.searchParams.get('pageSize'))
      : DEFAULT_PAGE_SIZE,
  };

  const result = applyLibraryQuery(snapshot, query);

  // Generate cover URLs for albums on the current page
  // Use Promise.allSettled to handle failures gracefully
  const albumsWithCovers = env.DROPBOX_TOKEN
    ? await Promise.allSettled(
        result.results.map(async (album) => {
          try {
            const coverUrl = await getCoverUrl(album, env);
            // Only use the new coverUrl if it's an HTTP URL, otherwise keep undefined
            // This prevents local file paths from being returned
            const finalCoverUrl = coverUrl?.startsWith('http') ? coverUrl : undefined;
            if (!finalCoverUrl) {
              console.log(`[COVER DEBUG] No cover URL generated for ${album.title}`);
            }
            return {
              ...album,
              coverUrl: finalCoverUrl,
            };
          } catch (error) {
            console.log(`[COVER DEBUG] Error generating cover for ${album.title}:`, error);
            return {
              ...album,
              coverUrl: undefined,
            };
          }
        }),
      ).then((results) =>
        results.map((result) =>
          result.status === 'fulfilled' ? result.value : result.reason,
        ),
      )
    : result.results;

  return new Response(
    JSON.stringify({
      query,
      ...result,
      results: albumsWithCovers,
    }),
    {
      headers: {
        'content-type': 'application/json',
        // Permanent links don't expire, so we can cache longer
        'cache-control': 'public, max-age=3600',
      },
    },
  );
};

