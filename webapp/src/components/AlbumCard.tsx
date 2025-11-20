import { Link } from 'react-router-dom';
import type { Album } from '../../shared/library.ts';
import { formatFileSize } from '../utils/format.ts';

interface AlbumCardProps {
  album: Album;
  onPlay: (albumId: string) => void | Promise<void>;
}

export function AlbumCard({ album, onPlay }: AlbumCardProps) {
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
          <span>{album.tracks.length} tracks</span>
          <span>{album.formats.join(' / ')}</span>
          <span>{formatFileSize(album.totalSizeBytes)}</span>
        </div>
      </div>

      <footer className="album-actions">
        <button type="button" onClick={() => onPlay(album.id)}>
          ▶ Play
        </button>
        <Link to={`/album/${album.id}`} className="ghost">
          Details
        </Link>
      </footer>
    </article>
  );
}

