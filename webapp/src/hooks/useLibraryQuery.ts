import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Album } from '../../../shared/library.ts';
import { fetchLibrary } from '../lib/api.ts';
import type { LibraryRequest, LibraryResponse } from '../lib/api.ts';

const defaultRequest: LibraryRequest = {
  q: '',
  formats: [],
  sort: 'title',
  page: 1,
  pageSize: 24,
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

  const albums = useMemo<Album[]>(() => data?.results ?? [], [data]);

  return {
    request,
    setRequest,
    data,
    albums,
    loading,
    error,
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    pageSize: data?.pageSize ?? request.pageSize ?? 24,
    refresh: load,
  };
}

