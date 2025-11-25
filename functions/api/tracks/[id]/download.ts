import {
  loadLibrarySnapshot,
} from '../../../utils/library.ts';
import type { EnvBindings } from '../../../utils/library.ts';

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

  if (!env.DROPBOX_TOKEN) {
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

  const response = await fetch(
    'https://content.dropboxapi.com/2/files/download',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.DROPBOX_TOKEN}`,
        'Dropbox-API-Arg': JSON.stringify({
          path: dropboxPath,
        }),
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    return new Response(errorText, { status: response.status });
  }

  // Use filename from path for download
  let filename = getFileNameFromPath(track.filePath);
  // Sanitize filename - remove invalid characters
  filename = filename.replace(/[<>:"/\\|?*]/g, '_');
  
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

  // Encode filename for Content-Disposition header (RFC 5987)
  const encodedFilename = encodeURIComponent(filename);
  const contentDisposition = `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`;

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
    },
  });
};

