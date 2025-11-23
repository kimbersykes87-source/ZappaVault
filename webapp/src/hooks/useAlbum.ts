import { useEffect, useState } from 'react';
import type { Album } from '../../../shared/library.ts';
import { fetchAlbum } from '../lib/api.ts';

export function useAlbum(albumId?: string, includeLinks = false) {
  const [album, setAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!albumId) {
      setAlbum(null);
      return;
    }

    const id = albumId;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchAlbum(id, includeLinks);
        if (!cancelled) {
          setAlbum(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [albumId, includeLinks]);

  return { album, loading, error };
}

