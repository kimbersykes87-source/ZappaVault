import type { LibrarySnapshot } from '../shared/library.ts';
import { sampleLibrary } from './library.sample.ts';

const LIBRARY_CACHE_KEY = 'library-snapshot';

export interface EnvBindings {
  LIBRARY_KV?: KVNamespace;
  ADMIN_TOKEN?: string;
  DROPBOX_TOKEN?: string;
  DROPBOX_REFRESH_TOKEN?: string;
  DROPBOX_APP_KEY?: string;
  DROPBOX_APP_SECRET?: string;
}

export async function loadLibrarySnapshot(
  env: EnvBindings,
): Promise<LibrarySnapshot> {
  if (env.LIBRARY_KV) {
    const cached = await env.LIBRARY_KV.get(LIBRARY_CACHE_KEY, 'json');
    if (cached) {
      return cached as LibrarySnapshot;
    }
  }

  return sampleLibrary;
}

export async function persistLibrarySnapshot(
  env: EnvBindings,
  snapshot: LibrarySnapshot,
): Promise<void> {
  if (!env.LIBRARY_KV) {
    return;
  }

  await env.LIBRARY_KV.put(
    LIBRARY_CACHE_KEY,
    JSON.stringify(snapshot),
    { expirationTtl: 60 * 60 * 24 }, // 24 hours
  );
}

export function requireAdmin(request: Request, env: EnvBindings): boolean {
  const headerToken = request.headers.get('x-admin-token');
  const queryToken = new URL(request.url).searchParams.get('token');
  const expected = env.ADMIN_TOKEN;
  if (!expected) {
    return true;
  }

  return headerToken === expected || queryToken === expected;
}

