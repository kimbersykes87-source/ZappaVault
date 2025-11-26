import {
  loadLibrarySnapshot,
} from '../../../utils/library.ts';
import type { EnvBindings } from '../../../utils/library.ts';
import { getValidDropboxToken } from '../../../utils/dropboxToken.ts';

function convertToDropboxPath(localPath: string): string {
  // Convert Windows path to Dropbox path
  // C:/Users/kimbe/Dropbox/Apps/ZappaVault/ZappaLibrary/... -> /Apps/ZappaVault/ZappaLibrary/...
  if (localPath.startsWith('C:/') || localPath.startsWith('c:/')) {
    const dropboxIndex = localPath.toLowerCase().indexOf('/dropbox/');
    if (dropboxIndex !== -1) {
      const afterDropbox = localPath.substring(dropboxIndex + '/dropbox'.length);
      return afterDropbox.startsWith('/') ? afterDropbox : `/${afterDropbox}`;
    }
  }
  if (localPath.startsWith('/')) {
    return localPath;
  }
  return `/${localPath}`;
}

function getFileNameFromPath(path: string): string {
  // Extract filename from path
  // C:/Users/kimbe/Dropbox/.../track.mp3 -> track.mp3
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || 'track';
}

export const onRequestGet: PagesFunction<EnvBindings> = async (context) => {
  const { env, params } = context;
  const trackId = params?.id;

  if (!trackId) {
    return new Response('Missing track id', { status: 400 });
  }

  let token = await getValidDropboxToken(env);
  if (!token) {
    return new Response('Dropbox token not configured', { status: 500 });
  }

  const snapshot = await loadLibrarySnapshot(env);
  
  // Find the track by searching through all albums
  let track = null;
  for (const album of snapshot.albums) {
    const found = album.tracks.find((t) => t.id === trackId);
    if (found) {
      track = found;
      break;
    }
  }

  if (!track) {
    return new Response('Track not found', { status: 404 });
  }

  // Convert Windows path to Dropbox path
  const dropboxPath = convertToDropboxPath(track.filePath);

  let response = await fetch(
    'https://content.dropboxapi.com/2/files/download',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Dropbox-API-Arg': JSON.stringify({
          path: dropboxPath,
        }),
      },
    },
  );

  // If token expired, refresh and retry once
  if (!response.ok && response.status === 401) {
    const text = await response.text();
    try {
      const errorData = JSON.parse(text);
      if (errorData.error?.['.tag'] === 'expired_access_token' && env.DROPBOX_REFRESH_TOKEN) {
        const { refreshDropboxToken } = await import('../../../utils/dropboxToken.ts');
        token = await refreshDropboxToken(
          env.DROPBOX_REFRESH_TOKEN,
          env.DROPBOX_APP_KEY!,
          env.DROPBOX_APP_SECRET!,
        );
        
        // Retry with new token
        response = await fetch(
          'https://content.dropboxapi.com/2/files/download',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Dropbox-API-Arg': JSON.stringify({
                path: dropboxPath,
              }),
            },
          },
        );
      }
    } catch {
      // If parsing fails, continue with original response
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    return new Response(errorText, { status: response.status });
  }

  // Use filename from path for download
  let filename = getFileNameFromPath(track.filePath);
  // Sanitize filename - remove invalid characters for Windows
  filename = filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .trim();
  
  // Determine content type from file extension
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  const contentTypeMap: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.flac': 'audio/flac',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4',
    '.ogg': 'audio/ogg',
  };
  const contentType = contentTypeMap[ext] || 'application/octet-stream';

  // Simple Content-Disposition - some browsers prefer this format
  const contentDisposition = `attachment; filename="${filename}"`;

  // Get the response body as a stream
  const body = response.body;
  if (!body) {
    return new Response('No content', { status: 500 });
  }

  return new Response(body, {
    headers: {
      'content-type': contentType,
      'content-disposition': contentDisposition,
      'cache-control': 'no-cache',
      'x-content-type-options': 'nosniff',
    },
  });
};

