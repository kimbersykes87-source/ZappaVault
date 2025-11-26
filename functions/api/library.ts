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
    console.log(`[COVER DEBUG] No DROPBOX_TOKEN for ${filePath}`);
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
        // This is for cover art, so it's an image
        const directLink = convertToDirectLink(sharedUrl, true);
        console.log(`[COVER DEBUG] Found existing link for ${filePath}: ${directLink.substring(0, 80)}...`);
        return directLink;
      } else {
        console.log(`[COVER DEBUG] No existing links found for ${filePath}, will create new one`);
      }
    } else {
      const errorText = await response.text();
      // 409 (conflict) or 404 (not found) are expected - just log and continue
      if (response.status === 409 || response.status === 404) {
        console.log(`[COVER DEBUG] No existing link for ${filePath} (${response.status}), will create new one`);
      } else {
        console.log(`[COVER DEBUG] list_shared_links failed for ${filePath}: ${response.status} ${errorText}`);
        // Log specific error codes for debugging
        if (response.status === 401) {
          console.log(`[COVER DEBUG] ❌ 401 Unauthorized - Token is invalid or expired`);
        } else if (response.status === 403) {
          console.log(`[COVER DEBUG] ❌ 403 Forbidden - Token lacks 'sharing.read' permission`);
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
            // This is for cover art, so it's an image
            const directLink = convertToDirectLink(sharedUrl, true);
            console.log(`[LINK DEBUG] Retrieved existing link after conflict: ${directLink}`);
            return directLink;
          }
        }
      }
      
      return undefined;
    }

    const payload = (await response.json()) as { url: string };
    // Convert shared link to direct download link
    // This is for cover art, so it's an image
    const directLink = convertToDirectLink(payload.url, true);
    console.log(`[COVER DEBUG] Created new link for ${filePath}: ${directLink.substring(0, 80)}...`);
    return directLink;
  } catch (error) {
    console.log(`[COVER DEBUG] getPermanentLink error for ${filePath}:`, error);
    if (error instanceof Error) {
      console.log(`[COVER DEBUG] Error message: ${error.message}`);
      console.log(`[COVER DEBUG] Error stack: ${error.stack}`);
    }
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
      // Don't log 409 (path not found) as it's expected when folder doesn't exist
      if (response.status !== 409) {
        console.log(`[COVER DEBUG] list_folder failed for ${coverFolderPath}: ${response.status} ${errorText}`);
      }
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
    
    // Extract base name (without extension) for exact matching
    const aBase = aLower.replace(/\.[^.]+$/, '');
    const bBase = bLower.replace(/\.[^.]+$/, '');
    
    const aHas1 = aLower.startsWith('1') || aLower.includes(' 1 ') || aLower.includes('_1_') || aLower.includes('-1-');
    const bHas1 = bLower.startsWith('1') || bLower.includes(' 1 ') || bLower.includes('_1_') || bLower.includes('-1-');
    const aHasFront = aLower.includes('front') || aLower.includes('cover') || aLower.includes('folder');
    const bHasFront = bLower.includes('front') || bLower.includes('cover') || bLower.includes('folder');
    
    // Exact match for "folder" has highest priority (as per user's note that some covers are named "folder")
    const aIsFolder = aBase === 'folder';
    const bIsFolder = bBase === 'folder';
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

async function getCoverUrl(
  album: Album,
  env: EnvBindings,
): Promise<string | undefined> {
  if (!env.DROPBOX_TOKEN) {
    console.log(`[COVER DEBUG] No DROPBOX_TOKEN for ${album.title}`);
    return undefined;
  }

  // If coverUrl is already an HTTP URL, return it
  if (album.coverUrl?.startsWith('http')) {
    console.log(`[COVER DEBUG] ${album.title}: Cover URL already HTTP`);
    return album.coverUrl;
  }

  // If coverUrl is a Dropbox path, convert it to an HTTP URL
  if (album.coverUrl && album.coverUrl.startsWith('/')) {
    console.log(`[COVER DEBUG] ${album.title}: Converting Dropbox path to HTTP URL: ${album.coverUrl}`);
    const coverLink = await getPermanentLink(env, album.coverUrl);
    if (coverLink) {
      console.log(`[COVER DEBUG] ${album.title}: ✅ Converted to HTTP URL`);
      return coverLink;
    } else {
      console.log(`[COVER DEBUG] ${album.title}: ❌ Failed to convert, trying fallback search`);
      // Fallback: Try to find cover art if conversion failed
      const foundCover = await findCoverArt(env, album);
      if (foundCover) {
        console.log(`[COVER DEBUG] ${album.title}: ✅ Found via fallback search`);
        return foundCover;
      }
    }
  }

  // Fallback: Find cover art in the Cover folder if no coverUrl exists
  if (!album.coverUrl) {
    console.log(`[COVER DEBUG] ${album.title}: No coverUrl, searching for cover art`);
    const foundCover = await findCoverArt(env, album);
    if (foundCover) {
      console.log(`[COVER DEBUG] ${album.title}: ✅ Found via search`);
      return foundCover;
    } else {
      console.log(`[COVER DEBUG] ${album.title}: ❌ No cover art found`);
    }
  }

  return undefined;
}

export const onRequestGet = async (context: {
  request: Request;
  env: EnvBindings;
}) => {
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

  // Generate static cover URLs for albums
  // Static covers are served from /covers/ directory in Cloudflare Pages
  // This is much faster and more reliable than Dropbox API calls
  console.log(`[COVER DEBUG] Generating cover URLs for ${result.results.length} albums`);
  
  const albumsWithCovers = result.results.map((album) => {
    // If album already has an HTTP URL (Dropbox link), keep it as fallback
    if (album.coverUrl?.startsWith('http')) {
      return {
        ...album,
        coverUrl: album.coverUrl,
      };
    }
    
    // Extract extension from original coverUrl if it exists
    // The copy script preserves the original extension, so we should match it exactly
    let extension = '.jpg'; // default
    if (album.coverUrl) {
      // Extract extension from path like "/Apps/.../file.jpg" or "/Apps/.../file.png"
      const match = album.coverUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i);
      if (match) {
        // Keep the original extension (don't normalize .jpeg to .jpg)
        extension = `.${match[1].toLowerCase()}`;
      }
    }
    
    // Special case: quAUDIOPHILIAc - the copy script used cover.png from Cover folder
    // but library data says 1 DVD-Front.jpg. Try .png first for this album.
    if (album.id === 'apps-zappavault-zappalibrary-quaudiophiliac') {
      extension = '.png';
    }
    
    // Use static URL with the correct extension
    const staticCoverUrl = `/covers/${album.id}${extension}`;
    
    return {
      ...album,
      coverUrl: staticCoverUrl,
    };
  });
  
  const staticCovers = albumsWithCovers.filter(a => a.coverUrl?.startsWith('/')).length;
  const dropboxCovers = albumsWithCovers.filter(a => a.coverUrl?.startsWith('http')).length;
  console.log(`[COVER DEBUG] Static covers: ${staticCovers}, Dropbox covers: ${dropboxCovers}`);

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

