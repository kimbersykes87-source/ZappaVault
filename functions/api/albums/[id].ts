import type { Album } from '../../shared/library.ts';
import {
  loadLibrarySnapshot,
} from '../../utils/library.ts';
import type { EnvBindings } from '../../utils/library.ts';

async function getPermanentLink(
  env: EnvBindings,
  filePath: string,
): Promise<string | undefined> {
  if (!env.DROPBOX_TOKEN) {
    console.log(`[LINK DEBUG] No DROPBOX_TOKEN for ${filePath}`);
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
        const directLink = convertToDirectLink(sharedUrl);
        console.log(`[LINK DEBUG] Found existing link for ${filePath}: ${directLink}`);
        return directLink;
      } else {
        console.log(`[LINK DEBUG] No existing links found for ${filePath}, will create new one`);
      }
    } else {
      const errorText = await response.text();
      // 409 (conflict) or 404 (not found) are expected - just log and continue
      if (response.status === 409 || response.status === 404) {
        console.log(`[LINK DEBUG] No existing link for ${filePath} (${response.status}), will create new one`);
      } else {
        console.log(`[LINK DEBUG] list_shared_links failed for ${filePath}: ${response.status} ${errorText}`);
        // Log specific error codes
        if (response.status === 401) {
          console.log(`[LINK DEBUG] ❌ 401 Unauthorized - Token is invalid or expired`);
        } else if (response.status === 403) {
          console.log(`[LINK DEBUG] ❌ 403 Forbidden - Token lacks 'sharing.read' permission`);
        }
      }
    }

    // If no existing link, create a new permanent shared link using the correct API
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
          settings: {
            requested_visibility: {
              '.tag': 'public'
            }
          }
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[LINK DEBUG] create_shared_link_with_settings failed for ${filePath}: ${response.status} ${errorText}`);
      
      // If it's a 409 conflict, the link might already exist - try to get it
      if (response.status === 409) {
        console.log(`[LINK DEBUG] Link already exists for ${filePath}, attempting to retrieve it`);
        const conflictResponse = await fetch(
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
        if (conflictResponse.ok) {
          const conflictPayload = (await conflictResponse.json()) as { 
            links: Array<{ url: string }> 
          };
          if (conflictPayload.links && conflictPayload.links.length > 0) {
            const sharedUrl = conflictPayload.links[0].url;
            const directLink = convertToDirectLink(sharedUrl);
            console.log(`[LINK DEBUG] Retrieved existing link after conflict: ${directLink}`);
            return directLink;
          }
        } else {
          const conflictError = await conflictResponse.text();
          console.log(`[LINK DEBUG] Failed to retrieve existing link after 409: ${conflictResponse.status} ${conflictError}`);
        }
      }
      
      // Log specific error codes for debugging
      if (response.status === 401) {
        console.log(`[LINK DEBUG] ❌ 401 Unauthorized - Token is invalid or expired`);
      } else if (response.status === 403) {
        console.log(`[LINK DEBUG] ❌ 403 Forbidden - Token lacks 'sharing.write' permission`);
      } else if (response.status === 404) {
        console.log(`[LINK DEBUG] ❌ 404 Not Found - File path does not exist: ${filePath}`);
      }
      
      return undefined;
    }

    const payload = (await response.json()) as { url: string };
    // Convert shared link to direct download link
    const directLink = convertToDirectLink(payload.url);
    console.log(`[LINK DEBUG] Created new link for ${filePath}: ${directLink}`);
    return directLink;
  } catch (error) {
    console.log(`[LINK DEBUG] getPermanentLink error for ${filePath}:`, error);
    return undefined;
  }
}

function convertToDirectLink(sharedUrl: string): string {
  // Convert Dropbox shared link to direct download link
  // https://www.dropbox.com/s/abc123/file.jpg?dl=0
  // -> https://dl.dropboxusercontent.com/s/abc123/file.jpg
  // Also handles dropbox.com (without www)
  let directUrl = sharedUrl
    .replace(/^https?:\/\/(www\.)?dropbox\.com/, 'https://dl.dropboxusercontent.com')
    .replace(/\?dl=[01]/, '')
    .split('?')[0];
  
  // Ensure we have the correct format
  if (!directUrl.startsWith('https://dl.dropboxusercontent.com')) {
    // Fallback: try to extract the path and rebuild
    const match = sharedUrl.match(/dropbox\.com\/([^?]+)/);
    if (match) {
      directUrl = `https://dl.dropboxusercontent.com/${match[1]}`;
    }
  }
  
  return directUrl;
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
      return afterDropbox.startsWith('/') ? afterDropbox : `/${afterDropbox}`;
    }
  }
  // If already a Dropbox path (starts with /), return as is
  if (localPath.startsWith('/')) {
    return localPath;
  }
  // Otherwise, assume it's relative and add /
  return `/${localPath}`;
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
      const errorText = await response.text();
      console.log(`[COVER DEBUG] list_folder failed for ${coverFolderPath}: ${errorText}`);
      return [];
    }

    const payload = (await response.json()) as {
      entries: Array<{ name: string; '.tag': string }>;
    };

    return payload.entries
      .filter((entry) => entry['.tag'] === 'file')
      .map((entry) => entry.name);
  } catch (error) {
    console.log(`[COVER DEBUG] list_folder error for ${coverFolderPath}:`, error);
    return [];
  }
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
  
  // Try multiple folder names (case-insensitive search)
  const possibleFolderNames = ['Cover', 'cover', 'Covers', 'covers', 'Artwork', 'artwork', 'Images', 'images'];
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
  
  // First, try looking in subfolders
  for (const folderName of possibleFolderNames) {
    const coverFolderPath = `${dropboxLocationPath}/${folderName}`;
    const coverFiles = await listCoverFolder(env, coverFolderPath);
    
    if (coverFiles.length > 0) {
      const imageFiles = coverFiles.filter((file) => {
        const ext = file.toLowerCase().substring(file.lastIndexOf('.'));
        return imageExtensions.includes(ext);
      });
      
      if (imageFiles.length > 0) {
        const prioritized = prioritizeCoverFiles(imageFiles);
        const bestMatch = prioritized[0];
        const coverPath = `${coverFolderPath}/${bestMatch}`;
        console.log(`[COVER DEBUG] Album: ${album.title}, Found in ${folderName}: ${bestMatch}`);
        const link = await getPermanentLink(env, coverPath);
        if (link) {
          console.log(`[COVER DEBUG] Successfully got permanent link for ${album.title}`);
          return link;
        }
      }
    }
  }
  
  // If no cover found in subfolders, try looking in the album root folder
  const rootFiles = await listCoverFolder(env, dropboxLocationPath);
  const rootImageFiles = rootFiles.filter((file) => {
    const ext = file.toLowerCase().substring(file.lastIndexOf('.'));
    return imageExtensions.includes(ext);
  });
  
  if (rootImageFiles.length > 0) {
    const prioritized = prioritizeCoverFiles(rootImageFiles);
    const bestMatch = prioritized[0];
    const coverPath = `${dropboxLocationPath}/${bestMatch}`;
    console.log(`[COVER DEBUG] Album: ${album.title}, Found in root: ${bestMatch}`);
    const link = await getPermanentLink(env, coverPath);
    if (link) {
      console.log(`[COVER DEBUG] Successfully got permanent link for ${album.title}`);
      return link;
    }
  }
  
  console.log(`[COVER DEBUG] No cover art found for ${album.title} at ${dropboxLocationPath}`);
  return undefined;
}

function prioritizeCoverFiles(imageFiles: string[]): string[] {
  return imageFiles.sort((a, b) => {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    
    const aHas1 = aLower.startsWith('1') || aLower.includes(' 1 ') || aLower.includes('_1_') || aLower.includes('-1-');
    const bHas1 = bLower.startsWith('1') || bLower.includes(' 1 ') || bLower.includes('_1_') || bLower.includes('-1-');
    const aHasFront = aLower.includes('front') || aLower.includes('cover');
    const bHasFront = bLower.includes('front') || bLower.includes('cover');

    // Files starting with "1" have highest priority
    if (aHas1 && !bHas1) return -1;
    if (!aHas1 && bHas1) return 1;
    
    // Files with "front" or "cover" have second priority
    if (aHasFront && !bHasFront) return -1;
    if (!aHasFront && bHasFront) return 1;
    
    return 0;
  });
}

async function attachSignedLinks(
  album: Album,
  env: EnvBindings,
): Promise<Album> {
  if (!env.DROPBOX_TOKEN) {
    console.log(`[LINK DEBUG] No DROPBOX_TOKEN available for album: ${album.title}`);
    console.error(`[ERROR] DROPBOX_TOKEN is missing in environment variables`);
    return album;
  }

  console.log(`[LINK DEBUG] Processing album: ${album.title} (${album.tracks.length} tracks)`);
  console.log(`[LINK DEBUG] Token length: ${env.DROPBOX_TOKEN.length} chars`);

  const updatedTracks = await Promise.all(
    album.tracks.map(async (track) => {
      // Convert Windows path to Dropbox path before getting permanent link
      const dropboxFilePath = convertToDropboxPath(track.filePath);
      console.log(`[LINK DEBUG] Getting link for track: ${track.title}`);
      console.log(`[LINK DEBUG]   Original path: ${track.filePath}`);
      console.log(`[LINK DEBUG]   Dropbox path: ${dropboxFilePath}`);
      const link = await getPermanentLink(env, dropboxFilePath);
      if (!link) {
        console.log(`[LINK DEBUG]   ❌ Failed to get link for: ${dropboxFilePath}`);
      } else {
        console.log(`[LINK DEBUG]   ✅ Got link: ${link.substring(0, 50)}...`);
      }
      return {
        ...track,
        streamingUrl: link,
        downloadUrl: link,
      };
    }),
  );

  // Generate cover URL - always look in the Cover folder for best match
  let coverUrl = album.coverUrl;
  if (coverUrl && coverUrl.startsWith('http')) {
    // Already an HTTP URL, keep it
    console.log(`[LINK DEBUG] Cover URL already HTTP: ${coverUrl}`);
  } else {
    // Find cover art in the Cover folder, prioritizing "1" or "front" images
    console.log(`[LINK DEBUG] Finding cover art for: ${album.title}`);
    const foundCover = await findCoverArt(env, album);
    if (foundCover) {
      console.log(`[LINK DEBUG] ✅ Found cover art: ${foundCover}`);
      coverUrl = foundCover;
    } else {
      console.log(`[LINK DEBUG] ❌ No cover art found for: ${album.title}`);
    }
  }

  const tracksWithLinks = updatedTracks.filter(t => t.streamingUrl).length;
  console.log(`[LINK DEBUG] Album ${album.title}: ${tracksWithLinks}/${updatedTracks.length} tracks have links`);

  return {
    ...album,
    tracks: updatedTracks,
    coverUrl,
  };
}

export const onRequestGet: PagesFunction<EnvBindings> = async (context) => {
  const { request, env, params } = context;
  console.log(`[API DEBUG] Album API called: ${request.url}`);
  console.log(`[API DEBUG] DROPBOX_TOKEN present: ${!!env.DROPBOX_TOKEN}`);
  
  const snapshot = await loadLibrarySnapshot(env);
  const albumId = params?.id;

  if (!albumId) {
    console.log(`[API DEBUG] Missing album id`);
    return new Response('Missing album id', { status: 400 });
  }

  console.log(`[API DEBUG] Looking for album: ${albumId}`);
  const album = snapshot.albums.find((entry) => entry.id === albumId);

  if (!album) {
    console.log(`[API DEBUG] Album not found: ${albumId}`);
    return new Response('Album not found', { status: 404 });
  }

  const url = new URL(request.url);
  const includeLinks = url.searchParams.get('links') === '1';
  console.log(`[API DEBUG] includeLinks: ${includeLinks}`);

  let payload: Album;
  if (includeLinks) {
    try {
      payload = await attachSignedLinks(album, env);
      // Add debug info to response if no links were generated
      const tracksWithLinks = payload.tracks.filter(t => t.streamingUrl).length;
      if (tracksWithLinks === 0 && payload.tracks.length > 0) {
        console.error(`[ERROR] No links generated for album: ${album.title}`);
        console.error(`[ERROR] This suggests Dropbox API calls are failing`);
        // Add a debug field to help diagnose
        (payload as any).__debug = {
          tokenPresent: !!env.DROPBOX_TOKEN,
          tokenLength: env.DROPBOX_TOKEN?.length || 0,
          tracksProcessed: payload.tracks.length,
          tracksWithLinks: 0,
        };
      }
    } catch (error) {
      console.error(`[ERROR] attachSignedLinks failed:`, error);
      // Return album without links if there's an error
      payload = album;
    }
  } else {
    payload = album;
  }

  return new Response(JSON.stringify({ album: payload }), {
    headers: {
      'content-type': 'application/json',
      // Permanent links don't expire, so we can cache longer
      'cache-control': includeLinks
        ? 'private, max-age=3600'
        : 'public, max-age=300',
    },
  });
};

