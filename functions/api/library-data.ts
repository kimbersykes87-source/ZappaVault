import type { EnvBindings } from '../../utils/library.ts';
import type { LibrarySnapshot } from '../../shared/library.ts';

// Import the library data from TypeScript file (more reliable than JSON import in CF Workers)
import { libraryData } from '../data/library.generated.ts';

/**
 * Serve library.generated.json file
 * This endpoint makes library.generated.json accessible to other Functions
 * We import it directly to avoid issues with fetching static assets
 */
export const onRequestGet: PagesFunction<EnvBindings> = async () => {
  try {
    const data = libraryData as LibrarySnapshot;
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

