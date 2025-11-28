import {
  applyLibraryQuery,
  DEFAULT_PAGE_SIZE,
} from '../shared/library.ts';
import type { LibraryQuery } from '../shared/library.ts';
import {
  loadLibrarySnapshot,
} from '../utils/library.ts';
import type { EnvBindings } from '../utils/library.ts';

export const onRequestGet = async (context: {
  request: Request;
  env: EnvBindings;
}) => {
  const { request, env } = context;
  const snapshot = await loadLibrarySnapshot(env, request);
  const url = new URL(request.url);

  const query: LibraryQuery = {
    q: url.searchParams.get('q') ?? undefined,
    formats: url.searchParams.getAll('format'),
    era: url.searchParams.get('era') ?? undefined,
    year: url.searchParams.get('year')
      ? Number(url.searchParams.get('year'))
      : undefined,
    sort: (url.searchParams.get('sort') as LibraryQuery['sort']) ?? 'title',
    page: url.searchParams.get('page')
      ? Number(url.searchParams.get('page'))
      : 1,
    pageSize: url.searchParams.get('pageSize')
      ? Number(url.searchParams.get('pageSize'))
      : DEFAULT_PAGE_SIZE,
  };

  const result = applyLibraryQuery(snapshot, query);

  // Use pre-generated cover URLs from comprehensive library (single source of truth)
  // All cover URLs should be HTTP URLs with raw=1 parameter, pre-generated during build
  // No runtime conversion needed - comprehensive library has all URLs ready
  console.log(`[COVER] Using pre-generated cover URLs from comprehensive library for ${result.results.length} albums`);
  
  const albumsWithCovers = result.results.map((album) => {
    // Use coverUrl directly from comprehensive library
    // It should be an HTTP URL with raw=1, or undefined for placeholder
    if (album.coverUrl?.startsWith('http')) {
      // Fix URLs that have dl=0 or dl=1 instead of raw=1 for images
      let fixedUrl = album.coverUrl;
      if (fixedUrl.includes('dl=0') || fixedUrl.includes('dl=1')) {
        // Convert dl=0 or dl=1 to raw=1 for images
        fixedUrl = fixedUrl.replace(/[?&]dl=[01]/, '').replace(/\?/, '?').replace(/\?$/, '') + (fixedUrl.includes('?') ? '&' : '?') + 'raw=1';
        console.warn(`[COVER] Fixed cover URL (dl=0/1 -> raw=1) for ${album.title}: ${fixedUrl.substring(0, 80)}...`);
        return { ...album, coverUrl: fixedUrl };
      } else if (fixedUrl.includes('raw=1')) {
        return { ...album, coverUrl: fixedUrl };
      } else {
        // Missing raw=1, add it
        fixedUrl = fixedUrl + (fixedUrl.includes('?') ? '&' : '?') + 'raw=1';
        console.warn(`[COVER] Added raw=1 to cover URL for ${album.title}: ${fixedUrl.substring(0, 80)}...`);
        return { ...album, coverUrl: fixedUrl };
      }
    }
    
    // File path or no cover URL - frontend will show placeholder
    // Note: Runtime conversion for file paths is handled in the album detail endpoint
    return { ...album, coverUrl: album.coverUrl };
  });
  
  const httpCovers = albumsWithCovers.filter(a => a.coverUrl?.startsWith('http')).length;
  const noCovers = albumsWithCovers.filter(a => !a.coverUrl).length;
  console.log(`[COVER] HTTP covers: ${httpCovers}, No covers (placeholder): ${noCovers}`);

  return new Response(
    JSON.stringify({
      query,
      ...result,
      results: albumsWithCovers,
    }),
    {
      headers: {
        'content-type': 'application/json',
        // Permanent links don't expire, so we can cache longer
        'cache-control': 'public, max-age=3600',
      },
    },
  );
};
