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
 * Load library snapshot from static asset URL
 * Falls back to KV cache, then sample library
 */
async function loadLibraryFromStaticAsset(request?: Request): Promise<LibrarySnapshot | null> {
  if (!request) {
    return null;
  }
  
  try {
    // Fetch directly from static asset
    // Use the origin from the request URL to construct absolute URL
    const requestUrl = new URL(request.url);
    const staticAssetUrl = `${requestUrl.origin}/data/library.generated.json`;
    console.log(`[LIBRARY] Fetching from static asset: ${staticAssetUrl}`);
    
    const response = await fetch(staticAssetUrl, {
      cache: 'default',
      // Add headers to ensure we get the file
      headers: {
        'Accept': 'application/json',
      },
    });
    
    console.log(`[LIBRARY] Static asset fetch response: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const text = await response.text();
      console.log(`[LIBRARY] Static asset response length: ${text.length} bytes`);
      
      if (text.length === 0) {
        console.warn(`[LIBRARY] ⚠️  Static asset response is empty`);
        return null;
      }
      
      const snapshot = JSON.parse(text) as LibrarySnapshot;
      console.log(`[LIBRARY] ✅ Loaded library from static asset: ${snapshot.albumCount} albums, ${snapshot.trackCount} tracks`);
      
      // Verify durations - check specific album
      const apostropheAlbum = snapshot.albums.find(a => a.id.includes('apostrophe'));
      if (apostropheAlbum) {
        const tracksWithDurations = apostropheAlbum.tracks.filter(t => t.durationMs > 0).length;
        console.log(`[LIBRARY] Apostrophe album: ${tracksWithDurations}/${apostropheAlbum.tracks.length} tracks have durations`);
        if (tracksWithDurations > 0) {
          console.log(`[LIBRARY] First track duration: ${apostropheAlbum.tracks[0].durationMs}ms`);
        }
      }
      
      const totalTracksWithDurations = snapshot.albums.reduce((sum, album) => 
        sum + album.tracks.filter(t => t.durationMs > 0).length, 0
      );
      console.log(`[LIBRARY] Total tracks with durations: ${totalTracksWithDurations} out of ${snapshot.trackCount}`);
      
      return snapshot;
    } else {
      const errorText = await response.text().catch(() => 'Unable to read error');
      console.warn(`[LIBRARY] ⚠️  Failed to load from static asset: ${response.status} ${response.statusText}`);
      console.warn(`[LIBRARY] Error response: ${errorText.substring(0, 200)}`);
    }
  } catch (error) {
    console.error(`[LIBRARY] ❌ Error loading from static asset:`, error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error(`[LIBRARY] Stack: ${error.stack.substring(0, 500)}`);
    }
  }
  
  return null;
}

export async function loadLibrarySnapshot(
  env: EnvBindings,
  request?: Request,
): Promise<LibrarySnapshot> {
  // First, try loading from static asset - most up-to-date
  // This ensures we get the latest library with all durations merged in
  if (request) {
    const staticLibrary = await loadLibraryFromStaticAsset(request);
    if (staticLibrary) {
      return staticLibrary;
    }
  }

  // Second, try KV cache (fastest, but may be stale)
  // Only use if Function endpoint failed
  if (env.LIBRARY_KV) {
    const cached = await env.LIBRARY_KV.get(LIBRARY_CACHE_KEY, 'json');
    if (cached) {
      const cachedSnapshot = cached as LibrarySnapshot;
      // Check if cached data has durations (sample library won't have real durations)
      const hasDurations = cachedSnapshot.albums.some(album => 
        album.tracks.some(track => track.durationMs > 0)
      );
      if (hasDurations) {
        console.log(`[LIBRARY] ✅ Loaded library from KV cache: ${cachedSnapshot.albumCount} albums (has durations)`);
        return cachedSnapshot;
      } else {
        console.log(`[LIBRARY] ⚠️  KV cache exists but lacks durations, skipping cache`);
      }
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

