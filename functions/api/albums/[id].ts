import type { Album } from '../../shared/library.ts';
import {
  loadLibrarySnapshot,
} from '../../utils/library.ts';
import type { EnvBindings } from '../../utils/library.ts';
import { getValidDropboxToken } from '../../utils/dropboxToken.ts';

/**
 * Make a Dropbox API request with automatic token refresh on expiration
 */
async function dropboxRequestWithRefresh<T>(
  endpoint: string,
  body: Record<string, unknown>,
  env: EnvBindings,
): Promise<Response> {
  let token = await getValidDropboxToken(env);
  
  if (!token) {
    throw new Error('No Dropbox token available. Please configure DROPBOX_TOKEN or refresh token credentials.');
  }

  let response = await fetch(`https://api.dropboxapi.com/2/${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  // If token expired, refresh and retry once
  if (!response.ok && response.status === 401) {
    const text = await response.text();
    try {
      const errorData = JSON.parse(text);
      
      if (errorData.error?.['.tag'] === 'expired_access_token' && env.DROPBOX_REFRESH_TOKEN) {
        console.log('[LINK DEBUG] Access token expired, refreshing...');
        try {
          const { refreshDropboxToken } = await import('../../utils/dropboxToken.ts');
          token = await refreshDropboxToken(
            env.DROPBOX_REFRESH_TOKEN,
            env.DROPBOX_APP_KEY!,
            env.DROPBOX_APP_SECRET!,
          );
          console.log('[LINK DEBUG] Successfully refreshed access token, retrying request...');
          
          // Retry the request with new token
          response = await fetch(`https://api.dropboxapi.com/2/${endpoint}`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify(body),
          });
        } catch (refreshError) {
          console.error('[LINK DEBUG] Failed to refresh token:', refreshError);
        }
      }
    } catch {
      // If parsing fails, continue with original response
    }
  }

  return response;
}

async function getPermanentLink(
  env: EnvBindings,
  filePath: string,
  errors?: string[],
): Promise<string | undefined> {
  const token = await getValidDropboxToken(env);
  if (!token) {
    const msg = `No DROPBOX_TOKEN or refresh token credentials for ${filePath}`;
    console.log(`[LINK DEBUG] ${msg}`);
    if (errors) errors.push(msg);
    return undefined;
  }

  try {
    // First, try to get existing shared link
    let response = await dropboxRequestWithRefresh(
      'sharing/list_shared_links',
      { 
        path: filePath,
        direct_only: false 
      },
      env,
    );

    if (response.ok) {
      const listPayload = (await response.json()) as { 
        links: Array<{ url: string }> 
      };
      if (listPayload.links && listPayload.links.length > 0) {
        // Convert shared link to direct download link
        const sharedUrl = listPayload.links[0].url;
        // Determine if this is an image based on file extension
        const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(filePath);
        const directLink = convertToDirectLink(sharedUrl, isImage);
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
    response = await dropboxRequestWithRefresh(
      'sharing/create_shared_link_with_settings',
      { 
        path: filePath,
        settings: {
          requested_visibility: {
            '.tag': 'public'
          }
        }
      },
      env,
    );

    if (!response.ok) {
      const errorText = await response.text();
      const errorMsg = `create_shared_link_with_settings failed for ${filePath}: ${response.status} ${errorText}`;
      console.log(`[LINK DEBUG] ${errorMsg}`);
      if (errors) errors.push(errorMsg);
      
      // If it's a 409 conflict, the link might already exist - try to get it
      if (response.status === 409) {
        console.log(`[LINK DEBUG] Link already exists for ${filePath}, attempting to retrieve it`);
        const conflictResponse = await dropboxRequestWithRefresh(
          'sharing/list_shared_links',
          { 
            path: filePath,
            direct_only: false 
          },
          env,
        );
        if (conflictResponse.ok) {
          const conflictPayload = (await conflictResponse.json()) as { 
            links: Array<{ url: string }> 
          };
          if (conflictPayload.links && conflictPayload.links.length > 0) {
            const sharedUrl = conflictPayload.links[0].url;
            // Determine if this is an image based on file extension
            const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(filePath);
            const directLink = convertToDirectLink(sharedUrl, isImage);
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
        const msg = `401 Unauthorized - Token is invalid or expired`;
        console.log(`[LINK DEBUG] ❌ ${msg}`);
        if (errors) errors.push(msg);
      } else if (response.status === 403) {
        const msg = `403 Forbidden - Token lacks 'sharing.write' permission`;
        console.log(`[LINK DEBUG] ❌ ${msg}`);
        if (errors) errors.push(msg);
      } else if (response.status === 404) {
        const msg = `404 Not Found - File path does not exist: ${filePath}`;
        console.log(`[LINK DEBUG] ❌ ${msg}`);
        if (errors) errors.push(msg);
      }
      
      return undefined;
    }

    const payload = (await response.json()) as { url: string };
    // Convert shared link to direct download link
    // Determine if this is an image based on file extension
    const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(filePath);
    const directLink = convertToDirectLink(payload.url, isImage);
    console.log(`[LINK DEBUG] Created new link for ${filePath}: ${directLink}`);
    return directLink;
  } catch (error) {
    console.log(`[LINK DEBUG] getPermanentLink error for ${filePath}:`, error);
    return undefined;
  }
}

function convertToDirectLink(sharedUrl: string, isImage = false): string {
  // Convert Dropbox shared link to direct download link
  // Handles multiple formats:
  // 1. Regular links: https://www.dropbox.com/s/abc123/file.jpg?dl=0
  //    -> https://dl.dropboxusercontent.com/s/abc123/file.jpg
  // 2. scl/fo or scl/fi links: https://www.dropbox.com/scl/fo/abc123/file.jpg?rlkey=xyz&dl=0
  //    -> For images: https://www.dropbox.com/scl/fo/abc123/file.jpg?rlkey=xyz&raw=1
  //    -> For audio: https://www.dropbox.com/scl/fo/abc123/file.jpg?rlkey=xyz&dl=1
  //    NOTE: scl/fo and scl/fi links MUST stay on www.dropbox.com, NOT converted to dl.dropboxusercontent.com
  
  // Check if it's an scl/fo or scl/fi link (newer Dropbox format)
  if (sharedUrl.includes('scl/fo/') || sharedUrl.includes('scl/fi/')) {
    // For scl/fo and scl/fi links, MUST keep them on www.dropbox.com
    // Do NOT convert to dl.dropboxusercontent.com - it won't work!
    // Preserve the rlkey parameter and use ?raw=1 for images, ?dl=1 for audio files
    try {
      const url = new URL(sharedUrl);
      // Ensure we're using www.dropbox.com, not dl.dropboxusercontent.com
      if (url.hostname === 'dl.dropboxusercontent.com') {
        url.hostname = 'www.dropbox.com';
      }
      url.searchParams.delete('dl');
      if (isImage) {
        url.searchParams.set('raw', '1');
      } else {
        url.searchParams.set('dl', '1');
      }
      return url.toString();
    } catch {
      // If URL parsing fails, try string replacement
      let baseUrl = sharedUrl.split('?')[0];
      // Fix if already converted to dl.dropboxusercontent.com
      baseUrl = baseUrl.replace('dl.dropboxusercontent.com', 'www.dropbox.com');
      const rlkeyMatch = sharedUrl.match(/[?&]rlkey=([^&]+)/);
      const rlkey = rlkeyMatch ? rlkeyMatch[1] : '';
      if (rlkey) {
        return `${baseUrl}?rlkey=${rlkey}&${isImage ? 'raw=1' : 'dl=1'}`;
      }
      return `${baseUrl}?${isImage ? 'raw=1' : 'dl=1'}`;
    }
  }
  
  // For regular links, convert to direct download link
  // For audio files, we need to ensure the URL works with HTML5 audio
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
  
  // For audio files (not images), ensure we're using the direct download format
  // HTML5 audio elements need direct download URLs, not shared links
  if (!isImage) {
    // Make sure it's a direct download URL (dl.dropboxusercontent.com)
    // This format works better for streaming audio
    return directUrl;
  }
  
  return directUrl;
}

function convertToDropboxPath(localPath: string): string {
  // Convert Windows path to Dropbox path, or return Dropbox path as-is
  // Handles both:
  // - Windows paths: C:/Users/kimbe/Dropbox/Apps/ZappaVault/ZappaLibrary/... -> /Apps/ZappaVault/ZappaLibrary/...
  // - Dropbox paths: /Apps/ZappaVault/ZappaLibrary/... -> /Apps/ZappaVault/ZappaLibrary/... (unchanged)
  
  // If already a Dropbox path (starts with /), return as is
  if (localPath.startsWith('/')) {
    return localPath;
  }
  
  // Handle Windows paths
  if (localPath.startsWith('C:/') || localPath.startsWith('c:/')) {
    // Find /Dropbox/ in the path and extract everything after it
    const dropboxIndex = localPath.toLowerCase().indexOf('/dropbox/');
    if (dropboxIndex !== -1) {
      const afterDropbox = localPath.substring(dropboxIndex + '/dropbox'.length);
      return afterDropbox.startsWith('/') ? afterDropbox : `/${afterDropbox}`;
    }
    
    // Fallback: Find ZappaLibrary folder
    const zappaLibraryIndex = localPath.toLowerCase().indexOf('zappalibrary');
    if (zappaLibraryIndex !== -1) {
      const afterZappaLibrary = localPath.substring(zappaLibraryIndex + 'zappalibrary'.length);
      const cleanPath = afterZappaLibrary.replace(/^[\/\\]+/, '');
      return `/Apps/ZappaVault/ZappaLibrary/${cleanPath.replace(/\\/g, '/')}`;
    }
  }
  
  // Otherwise, assume it's relative to ZappaLibrary
  return `/Apps/ZappaVault/ZappaLibrary/${localPath.replace(/\\/g, '/')}`;
}

async function listCoverFolder(
  env: EnvBindings,
  coverFolderPath: string,
): Promise<string[]> {
  const token = await getValidDropboxToken(env);
  if (!token) {
    return [];
  }

  try {
    const response = await dropboxRequestWithRefresh(
      'files/list_folder',
      { path: coverFolderPath },
      env,
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
  // Check if we have any way to get a token
  const hasToken = !!(env.DROPBOX_TOKEN || (env.DROPBOX_REFRESH_TOKEN && env.DROPBOX_APP_KEY && env.DROPBOX_APP_SECRET));
  if (!hasToken) {
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
    const aHasFront = aLower.includes('front') || aLower.includes('cover') || aLower.includes('folder');
    const bHasFront = bLower.includes('front') || bLower.includes('cover') || bLower.includes('folder');
    
    // Exact match for "folder" has highest priority
    const aIsFolder = aLower.replace(/\.[^.]+$/, '') === 'folder';
    const bIsFolder = bLower.replace(/\.[^.]+$/, '') === 'folder';
    
    if (aIsFolder && !bIsFolder) return -1;
    if (!aIsFolder && bIsFolder) return 1;
    
    // Files starting with "1" have second priority
    if (aHas1 && !bHas1) return -1;
    if (!aHas1 && bHas1) return 1;
    
    // Files with "front", "cover", or "folder" have third priority
    if (aHasFront && !bHasFront) return -1;
    if (!aHasFront && bHasFront) return 1;
    
    return 0;
  });
}

async function attachSignedLinks(
  album: Album,
  env: EnvBindings,
): Promise<Album> {
  // Check if we have any way to get a token (either DROPBOX_TOKEN or refresh token credentials)
  const hasToken = !!(env.DROPBOX_TOKEN || (env.DROPBOX_REFRESH_TOKEN && env.DROPBOX_APP_KEY && env.DROPBOX_APP_SECRET));
  if (!hasToken) {
    console.log(`[LINK DEBUG] No Dropbox token available for album: ${album.title}`);
    console.error(`[ERROR] DROPBOX_TOKEN or refresh token credentials are missing in environment variables`);
    return album;
  }

  console.log(`[LINK DEBUG] Processing album: ${album.title} (${album.tracks.length} tracks)`);
  const token = await getValidDropboxToken(env);
  console.log(`[LINK DEBUG] Token available: ${!!token}, Token length: ${token?.length || 0} chars`);

  const errors: string[] = [];
  const updatedTracks = await Promise.all(
    album.tracks.map(async (track) => {
      // Convert Windows path to Dropbox path before getting permanent link
      const dropboxFilePath = convertToDropboxPath(track.filePath);
      console.log(`[LINK DEBUG] Getting link for track: ${track.title}`);
      console.log(`[LINK DEBUG]   Original path: ${track.filePath}`);
      console.log(`[LINK DEBUG]   Dropbox path: ${dropboxFilePath}`);
      const link = await getPermanentLink(env, dropboxFilePath, errors);
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

  // Generate static cover URL (same logic as library endpoint)
  // Static covers are served from /covers/ directory in Cloudflare Pages
  let coverUrl = album.coverUrl;
  if (coverUrl && coverUrl.startsWith('http')) {
    // Already an HTTP URL (Dropbox link), keep it as fallback
    console.log(`[LINK DEBUG] Cover URL already HTTP: ${coverUrl}`);
  } else {
    // Use static URL from /covers/ directory
    // Extract extension from original coverUrl if it exists
    let extension = '.jpg'; // default
    if (coverUrl && coverUrl.startsWith('/')) {
      // Extract extension from path like "/Apps/.../file.jpg" or "/Apps/.../file.png"
      const match = coverUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i);
      if (match) {
        extension = `.${match[1].toLowerCase()}`;
        // Normalize .jpeg to .jpg for consistency
        if (extension === '.jpeg') {
          extension = '.jpg';
        }
      }
    }
    
    // Special case: quAUDIOPHILIAc - the copy script used cover.png from Cover folder
    // but library data says 1 DVD-Front.jpg. Try .png first for this album.
    if (album.id === 'apps-zappavault-zappalibrary-quaudiophiliac') {
      extension = '.png';
    }
    
    // Use static URL with the correct extension
    coverUrl = `/covers/${album.id}${extension}`;
    console.log(`[LINK DEBUG] Using static cover URL: ${coverUrl}`);
  }

  const tracksWithLinks = updatedTracks.filter(t => t.streamingUrl).length;
  console.log(`[LINK DEBUG] Album ${album.title}: ${tracksWithLinks}/${updatedTracks.length} tracks have links`);
  
  // Collect unique errors
  const uniqueErrors = [...new Set(errors)];
  if (uniqueErrors.length > 0) {
    console.error(`[ERROR] Collected ${uniqueErrors.length} unique errors during link generation`);
  }

  return {
    ...album,
    tracks: updatedTracks,
    coverUrl,
    __linkErrors: uniqueErrors.slice(0, 5), // Return first 5 errors
  } as Album & { __linkErrors?: string[] };
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
      console.log(`[API DEBUG] Generating links for album: ${album.title}`);
      payload = await attachSignedLinks(album, env);
      console.log(`[API DEBUG] Links generated successfully for: ${album.title}`);
      // Add debug info to response if no links were generated
      const tracksWithLinks = payload.tracks.filter(t => t.streamingUrl).length;
      if (tracksWithLinks === 0 && payload.tracks.length > 0) {
        console.error(`[ERROR] No links generated for album: ${album.title}`);
        console.error(`[ERROR] This suggests Dropbox API calls are failing`);
        // Get errors from attachSignedLinks - we need to pass them through
        // For now, add a debug field to help diagnose
        (payload as any).__debug = {
          tokenPresent: !!env.DROPBOX_TOKEN,
          tokenLength: env.DROPBOX_TOKEN?.length || 0,
          tracksProcessed: payload.tracks.length,
          tracksWithLinks: 0,
          errors: (payload as any).__linkErrors || [],
          note: 'Errors from Dropbox API calls are shown above',
        };
      }
    } catch (error) {
      console.error(`[ERROR] attachSignedLinks failed for ${album.title}:`, error);
      console.error(`[ERROR] Error details:`, error instanceof Error ? error.message : String(error));
      console.error(`[ERROR] Stack:`, error instanceof Error ? error.stack : 'No stack');
      // Return album without links if there's an error - don't fail the request
      payload = {
        ...album,
        tracks: album.tracks.map(t => ({ ...t, streamingUrl: undefined, downloadUrl: undefined })),
      };
      console.log(`[API DEBUG] Returning album without links due to error`);
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

