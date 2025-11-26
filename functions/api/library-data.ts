import type { EnvBindings } from '../../utils/library.ts';

// Import the JSON file directly
import libraryData from '../data/library.generated.json';

export const onRequestGet: PagesFunction<EnvBindings> = async () => {
  return new Response(JSON.stringify(libraryData), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=3600', // Cache for 1 hour
    },
  });
};

