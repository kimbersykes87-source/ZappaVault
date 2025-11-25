import { useState } from 'react';
import { useLibraryQuery } from '../hooks/useLibraryQuery.ts';
import { SearchBar } from '../components/SearchBar.tsx';
import { FilterPanel } from '../components/FilterPanel.tsx';
import { AlbumGrid } from '../components/AlbumGrid.tsx';
import { LoadingState } from '../components/LoadingState.tsx';
import { ErrorState } from '../components/ErrorState.tsx';
import { usePlayerStore } from '../store/player.ts';
import { fetchAlbum } from '../lib/api.ts';

export function LibraryPage() {
  const { request, setRequest, albums, loading, error, refresh, total } =
    useLibraryQuery();
  const setQueue = usePlayerStore((state) => state.setQueue);
  const [busyAlbum, setBusyAlbum] = useState<string | null>(null);

  const handleSearch = (value: string) => {
    setRequest((prev) => ({ ...prev, q: value, page: 1 }));
  };

  const handleFilters = (filters: {
    sort?: 'title' | 'year' | 'recent';
    year?: number;
  }) => {
    setRequest((prev) => ({ ...prev, ...filters, page: 1 }));
  };

  const handleReset = () => {
    setRequest({ q: '', sort: 'title', page: 1, pageSize: 24 });
  };

  const handlePlay = async (albumId: string) => {
    setBusyAlbum(albumId);
    try {
      const album = await fetchAlbum(albumId, true);
      const playable = album.tracks.filter((track) => track.streamingUrl);
      if (playable.length === 0) {
        alert('Streaming links are not available for this album yet.');
        return;
      }
      setQueue(playable, album.title, album.coverUrl);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setBusyAlbum(null);
    }
  };

  return (
    <div className="library-page">
      <header className="library-header">
        <div>
          <p className="meta">Vault size</p>
          <h2>{total} albums indexed</h2>
        </div>
        <SearchBar value={request.q ?? ''} onSearch={handleSearch} />
      </header>

      <FilterPanel
        sort={request.sort ?? 'title'}
        year={request.year}
        onChange={handleFilters}
        onReset={handleReset}
      />

      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={refresh} />}

      {!loading && !error && (
        <>
          {busyAlbum && (
            <p className="status-banner">
              Preparing {albums.find((album) => album.id === busyAlbum)?.title ?? 'album'}…
            </p>
          )}
          <AlbumGrid albums={albums} onPlay={handlePlay} />
        </>
      )}
    </div>
  );
}

