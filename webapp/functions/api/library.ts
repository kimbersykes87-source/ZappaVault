import {
  applyLibraryQuery,
  DEFAULT_PAGE_SIZE,
} from '../../shared/library.ts';
import type { LibraryQuery } from '../../shared/library.ts';
import {
  loadLibrarySnapshot,
} from '../utils/library.ts';
import type { EnvBindings } from '../utils/library.ts';

export const onRequestGet: PagesFunction<EnvBindings> = async (context) => {
  const { request, env } = context;
  const snapshot = await loadLibrarySnapshot(env);
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

  return new Response(
    JSON.stringify({
      query,
      ...result,
    }),
    {
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, max-age=60',
      },
    },
  );
};

