import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Album } from '../../../shared/library.ts';
import { fetchLibrary } from '../lib/api.ts';
import type { LibraryRequest, LibraryResponse } from '../lib/api.ts';

const defaultRequest: LibraryRequest = {
  q: '',
  sort: 'year-asc',
  page: 1,
  pageSize: 200, // Show all albums on homepage
};

export function useLibraryQuery() {
  const [request, setRequest] = useState<LibraryRequest>(defaultRequest);
  const [data, setData] = useState<LibraryResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchLibrary(request);
      setData(response);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    void load();
  }, [load]);

  const albums = useMemo<Album[]>(() => {
    if (!data) {
      return [];
    }

    const sortKey = request.sort ?? (data.query?.sort as LibraryRequest['sort']) ?? 'year-asc';
    const sorted = [...data.results];

    sorted.sort((a, b) => {
      switch (sortKey) {
        case 'year':
          return (b.year ?? 0) - (a.year ?? 0);
        case 'year-asc':
          return (a.year ?? 0) - (b.year ?? 0);
        case 'recent':
          return (
            Date.parse(b.lastSyncedAt ?? '1970-01-01') -
            Date.parse(a.lastSyncedAt ?? '1970-01-01')
          );
        case 'title':
        default:
          return (a.title ?? '').localeCompare(b.title ?? '');
      }
    });

    return sorted;
  }, [data, request.sort]);

  return {
    request,
    setRequest,
    data,
    albums,
    loading,
    error,
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    pageSize: data?.pageSize ?? request.pageSize ?? 200,
    refresh: load,
  };
}

