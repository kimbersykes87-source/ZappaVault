import type { LibrarySnapshot } from '../shared/library.ts';
import {
  persistLibrarySnapshot,
  requireAdmin,
} from '../utils/library.ts';
import type { EnvBindings } from '../utils/library.ts';

export const onRequestPost: PagesFunction<EnvBindings> = async (context) => {
  const { request, env } = context;

  if (!requireAdmin(request, env)) {
    return new Response('Unauthorized', { status: 401 });
  }

  let snapshot: LibrarySnapshot | undefined;

  try {
    const body = (await request.json()) as { snapshot: LibrarySnapshot };
    snapshot = body.snapshot;
  } catch {
    return new Response('Invalid payload', { status: 400 });
  }

  if (!snapshot || !Array.isArray(snapshot.albums)) {
    return new Response('Snapshot missing albums', { status: 422 });
  }

  await persistLibrarySnapshot(env, snapshot);

  return new Response(
    JSON.stringify({
      status: 'ok',
      albums: snapshot.albums.length,
    }),
    { headers: { 'content-type': 'application/json' } },
  );
};

