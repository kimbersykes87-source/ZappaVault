import { Link } from 'react-router-dom';
import type { Album } from '../../../shared/library.ts';
import { formatFileSize } from '../utils/format.ts';
import { getAlbumDownloadUrl } from '../lib/api.ts';

interface AlbumCardProps {
  album: Album;
  onPlay: (albumId: string) => void | Promise<void>;
}

// Small inline SVG icons
const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M3 2.5L13 8L3 13.5V2.5Z" fill="currentColor" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M8 2V10M8 10L5 7M8 10L11 7M2 12H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 6V8M8 10H8.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export function AlbumCard({ album, onPlay }: AlbumCardProps) {
  const trackCount = album.tracks.length;
  const fileFormat = album.formats.length > 0 ? album.formats[0] : 'Unknown';
  const fileSize = formatFileSize(album.totalSizeBytes);
  const playableTracks = album.tracks.filter((track) => track.streamingUrl).length;

  return (
    <article className="album-card">
      <div className="album-cover">
        {album.coverUrl ? (
          <img src={album.coverUrl} alt={album.title} loading="lazy" />
        ) : (
          <div className="album-cover-placeholder">
            <span>{album.title.slice(0, 2).toUpperCase()}</span>
          </div>
        )}
      </div>

      <div className="album-content">
        <header>
          <p className="album-era">{album.year ?? 'Year unknown'}</p>
          <h3>{album.title}</h3>
          {album.subtitle && <p className="album-subtitle">{album.subtitle}</p>}
        </header>

        <p className="album-description">
          {album.description ?? 'No description yet.'}
        </p>

        <div className="album-metadata">
          <span>{trackCount} tracks</span>
          <span>{album.formats.join(' / ')}</span>
          <span>{fileSize}</span>
        </div>
      </div>

      <footer className="album-actions">
        <button
          type="button"
          onClick={() => onPlay(album.id)}
          className="album-action-button album-action-button--primary"
          aria-label={`Play '${album.title}' (${trackCount} tracks)`}
        >
          <span className="album-action-icon">
            <PlayIcon />
          </span>
          <span className="album-action-content">
            <span className="album-action-label">Play</span>
            <span className="album-action-sublabel">
              Stream {playableTracks > 0 ? playableTracks : trackCount} {playableTracks === 1 ? 'track' : 'tracks'} in browser
            </span>
          </span>
        </button>
        <a
          href={getAlbumDownloadUrl(album.id)}
          target="_blank"
          rel="noreferrer"
          className="album-action-button album-action-button--secondary"
          aria-label={`Download '${album.title}' (${fileFormat} album, ${fileSize})`}
        >
          <span className="album-action-icon">
            <DownloadIcon />
          </span>
          <span className="album-action-content">
            <span className="album-action-label">Download</span>
            <span className="album-action-sublabel">
              {fileFormat} album • {fileSize}
            </span>
          </span>
        </a>
        <Link
          to={`/album/${album.id}`}
          className="album-action-button album-action-button--secondary"
          aria-label={`View details for '${album.title}'`}
        >
          <span className="album-action-icon">
            <InfoIcon />
          </span>
          <span className="album-action-content">
            <span className="album-action-label">Details</span>
            <span className="album-action-sublabel">
              Track list & liner notes
            </span>
          </span>
        </Link>
      </footer>
    </article>
  );
}

