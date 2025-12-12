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
 * Load track links from separate links file (stored in GitHub as static asset)
 */
async function loadTrackLinks(request: Request, libraryPath: string): Promise<Record<string, { streamingUrl?: string; downloadUrl?: string }> | null> {
  try {
    const requestUrl = new URL(request.url);
    // Try comprehensive links first, then generated links
    const linksPath = libraryPath.includes('comprehensive')
      ? `${requestUrl.origin}/data/library.comprehensive.links.json`
      : `${requestUrl.origin}/data/library.generated.links.json`;
    
    console.log(`[LINKS] Fetching track links from: ${linksPath}`);
    const response = await fetch(linksPath, {
      cache: 'default', // Links don't change often, cache is fine
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (response.ok) {
      const linksData = await response.json() as { links: Record<string, { streamingUrl?: string; downloadUrl?: string }> };
      const linkCount = Object.keys(linksData.links || {}).length;
      console.log(`[LINKS] ✅ Loaded ${linkCount} track links from static asset`);
      return linksData.links || null;
    } else {
      console.log(`[LINKS] Links file not found (${response.status}), will generate links on-demand`);
      return null;
    }
  } catch (error) {
    console.warn(`[LINKS] ⚠️  Error loading links file:`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

/**
 * Merge track links into library snapshot
 */
function mergeTrackLinks(
  snapshot: LibrarySnapshot,
  links: Record<string, { streamingUrl?: string; downloadUrl?: string }> | null
): LibrarySnapshot {
  if (!links) {
    return snapshot;
  }
  
  let linksMerged = 0;
  for (const album of snapshot.albums) {
    for (const track of album.tracks) {
      const trackLinks = links[track.id];
      if (trackLinks) {
        if (trackLinks.streamingUrl) {
          track.streamingUrl = trackLinks.streamingUrl;
        }
        if (trackLinks.downloadUrl) {
          track.downloadUrl = trackLinks.downloadUrl;
        }
        if (trackLinks.streamingUrl || trackLinks.downloadUrl) {
          linksMerged++;
        }
      }
    }
  }
  
  if (linksMerged > 0) {
    console.log(`[LINKS] ✅ Merged ${linksMerged} track links into library`);
  }
  
  return snapshot;
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
    // Try comprehensive library first (single source of truth with all metadata)
    const requestUrl = new URL(request.url);
    let staticAssetUrl = `${requestUrl.origin}/data/library.comprehensive.json`;
    let libraryPath = 'library.comprehensive.json';
    console.log(`[LIBRARY] Fetching comprehensive library from: ${staticAssetUrl}`);
    
    let response = await fetch(staticAssetUrl, {
      cache: 'no-store', // Don't use cache - always fetch fresh comprehensive library
      headers: {
        'Accept': 'application/json',
      },
    });
    
    console.log(`[LIBRARY] Comprehensive library fetch: ${response.status} ${response.statusText}`);
    
    // Fallback to library.generated.json if comprehensive doesn't exist
    if (!response.ok) {
      console.log(`[LIBRARY] Comprehensive library not found (${response.status}), trying library.generated.json...`);
      staticAssetUrl = `${requestUrl.origin}/data/library.generated.json`;
      libraryPath = 'library.generated.json';
      console.log(`[LIBRARY] Fetching from static asset: ${staticAssetUrl}`);
    
      response = await fetch(staticAssetUrl, {
        cache: 'no-store', // Don't use cache
        headers: {
          'Accept': 'application/json',
        },
      });
      console.log(`[LIBRARY] Fallback fetch: ${response.status} ${response.statusText}`);
    }
    
    console.log(`[LIBRARY] Static asset fetch response: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const text = await response.text();
      console.log(`[LIBRARY] Static asset response length: ${text.length} bytes`);
      
      if (text.length === 0) {
        console.warn(`[LIBRARY] ⚠️  Static asset response is empty`);
        return null;
      }
      
      let snapshot = JSON.parse(text) as LibrarySnapshot;
      console.log(`[LIBRARY] ✅ Loaded library from static asset: ${snapshot.albumCount} albums, ${snapshot.trackCount} tracks`);
      
      // Check if library already has streaming links (comprehensive library should have them)
      const tracksWithLinks = snapshot.albums.reduce((sum, album) => 
        sum + album.tracks.filter(t => t.streamingUrl).length, 0
      );
      
      if (tracksWithLinks > 0) {
        console.log(`[LIBRARY] Library already has ${tracksWithLinks} tracks with streaming links - no need to merge from links file`);
      } else {
        // Only merge links from separate file if library doesn't have them (e.g., loaded from KV)
        console.log(`[LIBRARY] No streaming links found in library - attempting to merge from links file`);
        const links = await loadTrackLinks(request, libraryPath);
        if (links) {
          snapshot = mergeTrackLinks(snapshot, links);
        } else {
          console.warn(`[LIBRARY] ⚠️  Links file not found and library has no streaming links - tracks may not be playable`);
        }
      }
      
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
  // ALWAYS try loading from static asset first - comprehensive library has all durations
  // This is the single source of truth with all metadata including durations
  if (request) {
    const staticLibrary = await loadLibraryFromStaticAsset(request);
    if (staticLibrary) {
      // Verify it has durations before using it
      const hasDurations = staticLibrary.albums.some(album => 
        album.tracks.some(track => track.durationMs > 0)
      );
      if (hasDurations) {
        console.log(`[LIBRARY] Using comprehensive library from static asset (has durations)`);
        return staticLibrary;
      } else {
        console.warn(`[LIBRARY] Static asset loaded but lacks durations, will try KV cache`);
      }
    } else {
      console.warn(`[LIBRARY] Failed to load from static asset, will try KV cache`);
    }
  }

  // Second, try KV cache (fastest, but may be stale)
  // Only use if static asset fetch failed
  if (env.LIBRARY_KV) {
    const cached = await env.LIBRARY_KV.get(LIBRARY_CACHE_KEY, 'json');
    if (cached) {
      let cachedSnapshot = cached as LibrarySnapshot;
      // Check if cached data has durations
      const hasDurations = cachedSnapshot.albums.some(album => 
        album.tracks.some(track => track.durationMs > 0)
      );
      if (hasDurations) {
        console.log(`[LIBRARY] Loaded library from KV cache: ${cachedSnapshot.albumCount} albums (has durations)`);
        
        // Try to load and merge links from static asset (KV doesn't store links)
        if (request) {
          const links = await loadTrackLinks(request, 'library.comprehensive.json');
          if (links) {
            cachedSnapshot = mergeTrackLinks(cachedSnapshot, links);
          }
        }
        
        return cachedSnapshot;
      } else {
        console.log(`[LIBRARY] KV cache exists but lacks durations, will use sample library`);
      }
    }
  }

  // Fallback to sample library (for development/testing)
  console.warn(`[LIBRARY] Using sample library as fallback`);
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

/**
 * Constant-time string comparison to prevent timing attacks
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export function requireAdmin(request: Request, env: EnvBindings): boolean {
  const expected = env.ADMIN_TOKEN;
  
  // Security by default: deny access if token not configured
  if (!expected) {
    console.error('[AUTH] ADMIN_TOKEN not configured - denying access');
    return false;
  }

  // Only accept token in header, never in query string (query strings are logged/exposed)
  const headerToken = request.headers.get('x-admin-token');
  if (!headerToken) {
    return false;
  }

  // Use constant-time comparison to prevent timing attacks
  return constantTimeEqual(headerToken, expected);
}

