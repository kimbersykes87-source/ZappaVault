/**
 * Serve track durations JSON file
 * This endpoint makes track_durations.json accessible to other Functions
 * The file is deployed as a static asset at /data/track_durations.json
 */
export const onRequestGet: PagesFunction = async ({ request }) => {
  try {
    // Fetch from the static asset using the absolute URL
    const url = new URL('/data/track_durations.json', request.url);
    const response = await fetch(url);
    
    if (response.ok) {
      const data = await response.json();
      return new Response(JSON.stringify(data), {
        headers: {
          'content-type': 'application/json',
          'cache-control': 'public, max-age=3600', // Cache for 1 hour
        },
      });
    } else {
      return new Response(
        JSON.stringify({ error: 'Track durations file not found', status: response.status }),
        {
          status: 404,
          headers: { 'content-type': 'application/json' },
        }
      );
    }
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        error: 'Failed to load track durations',
        message: error instanceof Error ? error.message : String(error)
      }),
      {
        status: 500,
        headers: { 'content-type': 'application/json' },
      }
    );
  }
};

