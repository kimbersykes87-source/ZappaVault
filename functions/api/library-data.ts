import type { EnvBindings } from '../../utils/library.ts';
import type { LibrarySnapshot } from '../../shared/library.ts';

/**
 * Serve library.generated.json file
 * This endpoint makes library.generated.json accessible to other Functions
 * Since Cloudflare Workers can't reliably fetch static assets, we'll try multiple approaches
 */
export const onRequestGet: PagesFunction<EnvBindings> = async ({ request }) => {
  try {
    // Try multiple approaches to load the library file
    
    // Approach 1: Try fetching from static asset (may work in some cases)
    const staticUrl = new URL('/data/library.generated.json', request.url);
    let response = await fetch(staticUrl);
    
    // Approach 2: If that fails, try the Function endpoint pattern
    // (This shouldn't be needed, but as a fallback)
    if (!response.ok) {
      // Try constructing URL differently
      const baseUrl = new URL(request.url);
      const functionUrl = new URL(`${baseUrl.origin}/data/library.generated.json`);
      response = await fetch(functionUrl);
    }
    
    if (response.ok) {
      const data = await response.json() as LibrarySnapshot;
      console.log(`[LIBRARY-DATA] ✅ Loaded library: ${data.albumCount} albums, ${data.trackCount} tracks`);
      
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
    } else {
      const errorText = await response.text().catch(() => 'Unable to read error');
      console.error(`[LIBRARY-DATA] ❌ Failed to load library file: ${response.status} ${response.statusText}`);
      console.error(`[LIBRARY-DATA] Error details: ${errorText.substring(0, 200)}`);
      
      return new Response(
        JSON.stringify({ 
          error: 'Library file not found', 
          status: response.status,
          details: errorText.substring(0, 200)
        }),
        {
          status: 404,
          headers: { 'content-type': 'application/json' },
        }
      );
    }
  } catch (error) {
    console.error(`[LIBRARY-DATA] ❌ Exception loading library:`, error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to load library',
        message: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }
    );
  }
};

