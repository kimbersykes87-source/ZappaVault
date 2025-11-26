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

/**
 * Load library snapshot from Function endpoint (library-data.ts)
 * Falls back to KV cache, then sample library
 */
async function loadLibraryFromFunction(request?: Request): Promise<LibrarySnapshot | null> {
  if (!request) {
    return null;
  }
  
  try {
    // Try to fetch from Function endpoint (more reliable than static assets)
    const url = new URL('/api/library-data', request.url);
    const response = await fetch(url, {
      cache: 'default',
    });
    
    if (response.ok) {
      const snapshot = await response.json() as LibrarySnapshot;
      console.log(`[LIBRARY] ✅ Loaded library from Function endpoint: ${snapshot.albumCount} albums, ${snapshot.trackCount} tracks`);
      return snapshot;
    } else {
      console.warn(`[LIBRARY] ⚠️  Failed to load from Function endpoint: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.warn(`[LIBRARY] ⚠️  Error loading from Function endpoint:`, error instanceof Error ? error.message : String(error));
  }
  
  return null;
}

export async function loadLibrarySnapshot(
  env: EnvBindings,
  request?: Request,
): Promise<LibrarySnapshot> {
  // First, try KV cache (fastest, but may be stale)
  if (env.LIBRARY_KV) {
    const cached = await env.LIBRARY_KV.get(LIBRARY_CACHE_KEY, 'json');
    if (cached) {
      console.log(`[LIBRARY] ✅ Loaded library from KV cache: ${(cached as LibrarySnapshot).albumCount} albums`);
      return cached as LibrarySnapshot;
    }
  }

  // Second, try loading from Function endpoint (library-data.ts)
  if (request) {
    const functionLibrary = await loadLibraryFromFunction(request);
    if (functionLibrary) {
      return functionLibrary;
    }
  }

  // Fallback to sample library (for development/testing)
  console.warn(`[LIBRARY] ⚠️  Using sample library as fallback`);
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

