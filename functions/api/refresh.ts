import type { LibrarySnapshot } from '../shared/library.ts';
import {
  persistLibrarySnapshot,
  requireAdmin,
} from '../utils/library.ts';
import type { EnvBindings } from '../utils/library.ts';
import { getSecurityHeaders } from '../utils/security.ts';

const MAX_BODY_SIZE = 25 * 1024 * 1024; // 25MB (Cloudflare KV limit)

export const onRequestPost: PagesFunction<EnvBindings> = async (context) => {
  const { request, env } = context;

  if (!requireAdmin(request, env)) {
    return new Response('Unauthorized', { 
      status: 401,
      headers: getSecurityHeaders(),
    });
  }

  // Check request size
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > MAX_BODY_SIZE) {
    return new Response('Request body too large', { 
      status: 413,
      headers: getSecurityHeaders(),
    });
  }

  let snapshot: LibrarySnapshot | undefined;

  try {
    const bodyText = await request.text();
    
    // Check actual body size
    if (bodyText.length > MAX_BODY_SIZE) {
      return new Response('Request body too large', { 
        status: 413,
        headers: getSecurityHeaders(),
      });
    }
    
    const body = JSON.parse(bodyText) as { snapshot: LibrarySnapshot };
    snapshot = body.snapshot;
  } catch {
    return new Response('Invalid payload', { 
      status: 400,
      headers: getSecurityHeaders(),
    });
  }

  if (!snapshot || !Array.isArray(snapshot.albums)) {
    return new Response('Snapshot missing albums', { 
      status: 422,
      headers: getSecurityHeaders(),
    });
  }

  await persistLibrarySnapshot(env, snapshot);

  return new Response(
    JSON.stringify({
      status: 'ok',
      albums: snapshot.albums.length,
    }),
    { 
      headers: { 
        'content-type': 'application/json',
        ...getSecurityHeaders(),
      } 
    },
  );
};

