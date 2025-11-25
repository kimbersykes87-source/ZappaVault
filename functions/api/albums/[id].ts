import type { Album } from '../../shared/library.ts';
import {
  loadLibrarySnapshot,
} from '../../utils/library.ts';
import type { EnvBindings } from '../../utils/library.ts';

async function getTemporaryLink(
  env: EnvBindings,
  filePath: string,
): Promise<string | undefined> {
  if (!env.DROPBOX_TOKEN) {
    return undefined;
  }

  try {
    const response = await fetch(
      'https://api.dropboxapi.com/2/files/get_temporary_link',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.DROPBOX_TOKEN}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ path: filePath }),
      },
    );

    if (!response.ok) {
      return undefined;
    }

    const payload = (await response.json()) as { link: string };
    return payload.link;
  } catch {
    return undefined;
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
  const coverFolderPath = `${dropboxLocationPath}/Cover`;

  console.log(`[COVER DEBUG] Album: ${album.title}, Location: ${album.locationPath}, Dropbox: ${dropboxLocationPath}, Cover folder: ${coverFolderPath}`);

  // List files in the Cover folder
  const coverFiles = await listCoverFolder(env, coverFolderPath);

  if (coverFiles.length === 0) {
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

  // Try to get a temporary link for the first prioritized file
  const bestMatch = prioritized[0];
  const coverPath = `${coverFolderPath}/${bestMatch}`;
  console.log(`[COVER DEBUG] Album: ${album.title}, Found: ${bestMatch}, Path: ${coverPath}`);
  const link = await getTemporaryLink(env, coverPath);
  if (link) {
    console.log(`[COVER DEBUG] Successfully got link for ${album.title}`);
  } else {
    console.log(`[COVER DEBUG] Failed to get link for ${album.title} at ${coverPath}`);
  }
  return link;
}

async function attachSignedLinks(
  album: Album,
  env: EnvBindings,
): Promise<Album> {
  if (!env.DROPBOX_TOKEN) {
    return album;
  }

  const updatedTracks = await Promise.all(
    album.tracks.map(async (track) => {
      // Convert Windows path to Dropbox path before getting temporary link
      const dropboxFilePath = convertToDropboxPath(track.filePath);
      const link = await getTemporaryLink(env, dropboxFilePath);
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
  } else {
    // Find cover art in the Cover folder, prioritizing "1" or "front" images
    const foundCover = await findCoverArt(env, album);
    if (foundCover) {
      coverUrl = foundCover;
    }
  }

  return {
    ...album,
    tracks: updatedTracks,
    coverUrl,
  };
}

export const onRequestGet: PagesFunction<EnvBindings> = async (context) => {
  const { request, env, params } = context;
  const snapshot = await loadLibrarySnapshot(env);
  const albumId = params?.id;

  if (!albumId) {
    return new Response('Missing album id', { status: 400 });
  }

  const album = snapshot.albums.find((entry) => entry.id === albumId);

  if (!album) {
    return new Response('Album not found', { status: 404 });
  }

  const url = new URL(request.url);
  const includeLinks = url.searchParams.get('links') === '1';

  const payload = includeLinks ? await attachSignedLinks(album, env) : album;

  return new Response(JSON.stringify({ album: payload }), {
    headers: {
      'content-type': 'application/json',
      'cache-control': includeLinks
        ? 'private, max-age=30'
        : 'public, max-age=300',
    },
  });
};

