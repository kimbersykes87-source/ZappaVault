import {
  loadLibrarySnapshot,
} from '../../../utils/library.ts';
import type { EnvBindings } from '../../../utils/library.ts';
import { getValidDropboxToken } from '../../../utils/dropboxToken.ts';
import { getSecurityHeaders } from '../../../utils/security.ts';

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
    const dropboxIndex = localPath.toLowerCase().indexOf('/dropbox/');
    if (dropboxIndex !== -1) {
      const afterDropbox = localPath.substring(dropboxIndex + '/dropbox'.length);
      return afterDropbox.startsWith('/') ? afterDropbox : `/${afterDropbox}`;
    }
  }
  
  // Otherwise, assume it's relative and add /
  return `/${localPath.replace(/\\/g, '/')}`;
}

function getFolderNameFromPath(path: string): string {
  // Extract folder name from path
  // C:/Users/kimbe/Dropbox/Apps/ZappaVault/ZappaLibrary/Buffalo (April 2007) -> Buffalo (April 2007)
  const normalized = path.replace(/\\/g, '/');
  const parts = normalized.split('/');
  return parts[parts.length - 1] || 'album';
}

export const onRequestGet: PagesFunction<EnvBindings> = async (context) => {
  const { env, params, request } = context;
  const albumId = params?.id;

  if (!albumId) {
    return new Response('Missing album id', { status: 400 });
  }

  let token = await getValidDropboxToken(env);
  if (!token) {
    return new Response('Dropbox token not configured', { status: 500 });
  }

  const snapshot = await loadLibrarySnapshot(env, request);
  const album = snapshot.albums.find((entry) => entry.id === albumId);

  if (!album) {
    return new Response('Album not found', { status: 404 });
  }

  // Convert Windows path to Dropbox path
  const dropboxPath = convertToDropboxPath(album.locationPath);

  let response = await fetch(
    'https://content.dropboxapi.com/2/files/download_zip',
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
          'https://content.dropboxapi.com/2/files/download_zip',
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

  // Use folder name from path for zip filename
  const folderName = getFolderNameFromPath(album.locationPath);
  // Sanitize filename - remove invalid characters for Windows
  const filename = `${folderName}.zip`
    .replace(/"/g, '')
    .replace(/[<>:"/\\|?*]/g, '_')
    .trim();
  
  // Simple Content-Disposition - some browsers prefer this format
  const contentDisposition = `attachment; filename="${filename}"`;

  // Get the response body as a stream
  const body = response.body;
  if (!body) {
    return new Response('No content', { status: 500 });
  }

  return new Response(body, {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': contentDisposition,
      'cache-control': 'no-cache',
      'x-content-type-options': 'nosniff',
      ...getSecurityHeaders(),
    },
  });
};

