import type { EnvBindings } from '../../utils/library.ts';
import type { LibrarySnapshot } from '../../shared/library.ts';
import { loadLibrarySnapshot } from '../../utils/library.ts';

/**
 * Serve library.generated.json file
 * This endpoint proxies the library data loaded via loadLibrarySnapshot
 * which fetches from the static asset
 */
export const onRequestGet: PagesFunction<EnvBindings> = async (context) => {
  try {
    const { env, request } = context;
    const data = await loadLibrarySnapshot(env, request);
    
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

