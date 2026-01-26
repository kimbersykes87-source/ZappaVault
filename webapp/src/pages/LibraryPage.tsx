import { useState } from 'react';
import { useLibraryQuery } from '../hooks/useLibraryQuery.ts';
import { SearchBar } from '../components/SearchBar.tsx';
import { AlbumGrid } from '../components/AlbumGrid.tsx';
import { LoadingState } from '../components/LoadingState.tsx';
import { ErrorState } from '../components/ErrorState.tsx';
import { usePlayerStore } from '../store/player.ts';
import { fetchAlbum } from '../lib/api.ts';
import { useToastContext } from '../context/ToastContext.tsx';

export function LibraryPage() {
  const { request, setRequest, albums, loading, error, refresh } =
    useLibraryQuery();
  const setQueue = usePlayerStore((state) => state.setQueue);
  const [busyAlbum, setBusyAlbum] = useState<string | null>(null);
  const { showToast } = useToastContext();

  const handleSearch = (value: string) => {
    setRequest((prev) => ({ ...prev, q: value, page: 1 }));
  };

  const setLoading = usePlayerStore((state) => state.setLoading);
  
  const handlePlay = async (albumId: string) => {
    setBusyAlbum(albumId);
    setLoading(true);
    try {
      const album = await fetchAlbum(albumId, true);
      const playable = album.tracks.filter((track) => track.streamingUrl);
      if (playable.length === 0) {
        console.error(`No streaming links available for album: ${album.title}`);
        console.error(`Total tracks: ${album.tracks.length}`);
        // Check if there are any tracks at all
        if (album.tracks.length === 0) {
          showToast('This album has no tracks.', 'error');
        } else {
          showToast(`Streaming links are not available for this album yet. ${album.tracks.length} tracks found but no streaming URLs generated.`, 'error');
        }
        setLoading(false);
        return;
      }
      console.log(`Playing album: ${album.title} with ${playable.length} playable tracks out of ${album.tracks.length} total`);
      setQueue(playable, album.title, album.coverUrl);
    } catch (err) {
      console.error('Error loading album:', err);
      showToast((err as Error).message, 'error');
      setLoading(false);
    } finally {
      setBusyAlbum(null);
    }
  };

  return (
    <div className="library-page">
      <header className="library-header">
        <SearchBar value={request.q ?? ''} onSearch={handleSearch} />
        <select
          className="sort-dropdown"
          value={request.sort ?? 'year-asc'}
          onChange={(e) => {
            const sortValue = e.target.value as 'title' | 'year' | 'year-asc';
            setRequest((prev) => ({ ...prev, sort: sortValue, page: 1 }));
          }}
        >
          <option value="title">Alphabetically (A-Z)</option>
          <option value="year">Newest to Oldest</option>
          <option value="year-asc">Oldest to Newest</option>
        </select>
      </header>

      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={refresh} />}

      {!loading && !error && (
        <>
          {busyAlbum && (
            <p className="status-banner">
              Preparing {albums.find((album) => album.id === busyAlbum)?.title ?? 'album'}…
            </p>
          )}
          {albums.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state-message">No albums found</p>
              {request.q && (
                <button 
                  type="button"
                  className="empty-state-button"
                  onClick={() => setRequest((prev) => ({ ...prev, q: '' }))}
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <AlbumGrid albums={albums} onPlay={handlePlay} busyAlbum={busyAlbum} />
          )}
        </>
      )}
    </div>
  );
}

