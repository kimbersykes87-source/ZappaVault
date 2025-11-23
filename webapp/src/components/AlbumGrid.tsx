import type { Album } from '../../../shared/library.ts';
import { AlbumCard } from './AlbumCard.tsx';

interface AlbumGridProps {
  albums: Album[];
  onPlay: (albumId: string) => void | Promise<void>;
}

export function AlbumGrid({ albums, onPlay }: AlbumGridProps) {
  if (albums.length === 0) {
    return <p className="empty-state">No albums match your filters.</p>;
  }

  return (
    <div className="album-grid">
      {albums.map((album) => (
        <AlbumCard key={album.id} album={album} onPlay={onPlay} />
      ))}
    </div>
  );
}

