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
    console.warn('Failed to obtain temporary link', await response.text());
    return undefined;
  }

  const payload = (await response.json()) as { link: string };
  return payload.link;
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
      const link = await getTemporaryLink(env, track.filePath);
      return {
        ...track,
        streamingUrl: link,
        downloadUrl: link,
      };
    }),
  );

  return {
    ...album,
    tracks: updatedTracks,
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

