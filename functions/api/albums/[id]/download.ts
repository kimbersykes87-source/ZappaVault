import {
  loadLibrarySnapshot,
} from '../../../utils/library.ts';
import type { EnvBindings } from '../../../utils/library.ts';

export const onRequestGet: PagesFunction<EnvBindings> = async (context) => {
  const { env, params } = context;
  const albumId = params?.id;

  if (!albumId) {
    return new Response('Missing album id', { status: 400 });
  }

  if (!env.DROPBOX_TOKEN) {
    return new Response('Dropbox token not configured', { status: 500 });
  }

  const snapshot = await loadLibrarySnapshot(env);
  const album = snapshot.albums.find((entry) => entry.id === albumId);

  if (!album) {
    return new Response('Album not found', { status: 404 });
  }

  const response = await fetch(
    'https://content.dropboxapi.com/2/files/download_zip',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.DROPBOX_TOKEN}`,
        'Dropbox-API-Arg': JSON.stringify({
          path: album.locationPath,
        }),
      },
    },
  );

  if (!response.ok) {
    return new Response(await response.text(), { status: response.status });
  }

  const filename = `${album.title}.zip`.replace(/"/g, '');

  return new Response(response.body, {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${filename}"`,
    },
  });
};

