import { Link, useParams } from 'react-router-dom';
import { useAlbum } from '../hooks/useAlbum.ts';
import { LoadingState } from '../components/LoadingState.tsx';
import { ErrorState } from '../components/ErrorState.tsx';
import { formatDuration, formatFileSize } from '../utils/format.ts';
import { getAlbumDownloadUrl, getTrackDownloadUrl } from '../lib/api.ts';
import { usePlayerStore } from '../store/player.ts';

export function AlbumPage() {
  const { albumId } = useParams<{ albumId: string }>();
  const { album, loading, error } = useAlbum(albumId, true);
  const setQueue = usePlayerStore((state) => state.setQueue);
  const playTrackAt = usePlayerStore((state) => state.playTrackAt);

  if (loading) {
    return <LoadingState message="Loading album…" />;
  }

  if (error || !album) {
    return <ErrorState message={error ?? 'Album missing'} />;
  }

  const playableTracks = album.tracks.filter((track) => track.streamingUrl);

  const handlePlayAlbum = () => {
    if (playableTracks.length === 0) {
      alert('No streaming links for this album yet.');
      return;
    }
    setQueue(playableTracks, album.title, album.coverUrl);
  };

  const handlePlayTrack = (index: number) => {
    if (playableTracks.length === 0) {
      alert('No streaming links for this album yet.');
      return;
    }
    const requested = album.tracks[index];
    const startIndex = playableTracks.findIndex(
      (track) => track.id === requested.id,
    );
    setQueue(playableTracks, album.title, album.coverUrl);
    if (startIndex >= 0) {
      playTrackAt(startIndex);
    }
  };

  return (
    <div className="album-page">
      <header className="album-page-header">
        <div>
          <p className="meta">
            {album.genre ?? 'Uncategorised'} ·{' '}
            {album.formats.join(' / ')}
          </p>
          <h1>{album.title}</h1>
          {album.subtitle && <p className="album-subtitle">{album.subtitle}</p>}
          {album.description && <p>{album.description}</p>}
          <div className="album-page-actions">
            <button type="button" onClick={handlePlayAlbum}>
              ▶ Play album
            </button>
            <a
              href={getAlbumDownloadUrl(album.id)}
              target="_blank"
              rel="noreferrer"
            >
              ⬇ Download .zip
            </a>
          </div>
        </div>
        <div>
          <Link to="/" className="ghost">
            ← Back to library
          </Link>
        </div>
      </header>

      <section className="tracklist">
        <header>
          <p>Tracks</p>
          <p>{album.tracks.length} total · {formatFileSize(album.totalSizeBytes)}</p>
        </header>
        <ol>
          {album.tracks.map((track, index) => (
            <li key={track.id}>
              <div className="track-info">
                <span>{track.trackNumber}.</span>
                <div>
                  <strong>{track.title}</strong>
                  <p>{track.format}</p>
                </div>
              </div>
              <div className="track-actions">
                <span>{formatDuration(track.durationMs)}</span>
                {track.streamingUrl ? (
                  <button type="button" onClick={() => handlePlayTrack(index)}>
                    ▶
                  </button>
                ) : (
                  <span className="badge">No stream</span>
                )}
                <a href={getTrackDownloadUrl(track.id)} target="_blank" rel="noreferrer">
                  ⬇
                </a>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

