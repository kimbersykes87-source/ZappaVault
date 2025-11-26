import type { EnvBindings } from '../../utils/library.ts';
import type { LibrarySnapshot } from '../../shared/library.ts';

/**
 * Serve library.generated.json file
 * This endpoint makes library.generated.json accessible to other Functions
 * We fetch it from the static asset URL (works reliably in CF Pages)
 */
export const onRequestGet: PagesFunction<EnvBindings> = async ({ request }) => {
  try {
    // Fetch from static asset using absolute URL
    // In Cloudflare Pages, static assets are served from the root
    const url = new URL(request.url);
    const libraryUrl = new URL('/data/library.generated.json', url.origin);
    
    console.log(`[LIBRARY-DATA] Fetching from: ${libraryUrl.toString()}`);
    
    const response = await fetch(libraryUrl.toString(), {
      // Use cache: 'default' to allow Cloudflare's edge cache
      cache: 'default',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch library: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json() as LibrarySnapshot;
    console.log(`[LIBRARY-DATA] ✅ Serving library: ${data.albumCount} albums, ${data.trackCount} tracks`);
    
    // Verify it has durations
    const tracksWithDurations = data.albums.reduce((sum, album) => 
      sum + album.tracks.filter(t => t.durationMs > 0).length, 0
    );
    console.log(`[LIBRARY-DATA] Tracks with durations: ${tracksWithDurations} out of ${data.trackCount}`);
    
    return new Response(JSON.stringify(data), {
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error(`[LIBRARY-DATA] ❌ Exception serving library:`, error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to serve library',
        message: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }
    );
  }
};

