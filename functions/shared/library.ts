export type AudioFormat = 'FLAC' | 'MP3' | 'WAV' | 'AIFF' | 'OGG' | string;

export interface Track {
  id: string;
  title: string;
  durationMs: number;
  trackNumber: number;
  discNumber?: number;
  format: AudioFormat;
  filePath: string;
  sizeBytes: number;
  streamingUrl?: string;
  downloadUrl?: string;
}

export interface Album {
  id: string;
  title: string;
  subtitle?: string;
  year?: number;
  era?: string;
  genre?: string;
  description?: string;
  coverUrl?: string;
  locationPath: string;
  lastSyncedAt: string;
  tags: string[];
  tracks: Track[];
  formats: AudioFormat[];
  totalDurationMs: number;
  totalSizeBytes: number;
}

export interface LibrarySnapshot {
  generatedAt: string;
  albumCount: number;
  trackCount: number;
  albums: Album[];
}

export interface LibraryQuery {
  q?: string;
  formats?: AudioFormat[];
  era?: string;
  year?: number;
  sort?: 'title' | 'year' | 'recent';
  page?: number;
  pageSize?: number;
}

const normalise = (value?: string) =>
  value?.toLowerCase().normalize('NFKD') ?? '';

export interface LibraryResult {
  total: number;
  page: number;
  pageSize: number;
  results: Album[];
}

export const DEFAULT_PAGE_SIZE = 24;

export function applyLibraryQuery(
  snapshot: LibrarySnapshot,
  query: LibraryQuery,
): LibraryResult {
  const {
    q,
    formats,
    era,
    year,
    sort = 'title',
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
  } = query;

  const searchTerm = normalise(q);
  const formatSet = new Set(
    (formats ?? []).map((value) => value.toUpperCase()),
  );

  let filtered = snapshot.albums.filter((album) => {
    if (searchTerm) {
      const haystack = [
        album.title,
        album.subtitle,
        album.genre,
        album.era,
        album.description,
        album.tags.join(' '),
        album.tracks.map((track) => track.title).join(' '),
      ]
        .map(normalise)
        .join(' ');

      if (!haystack.includes(searchTerm)) {
        return false;
      }
    }

    if (era && album.era !== era) {
      return false;
    }

    if (year && album.year !== year) {
      return false;
    }

    if (formatSet.size > 0) {
      const albumFormats = new Set(
        album.formats.map((value) => value.toUpperCase()),
      );

      for (const format of formatSet) {
        if (!albumFormats.has(format)) {
          return false;
        }
      }
    }

    return true;
  });

  filtered = filtered.sort((a, b) => {
    switch (sort) {
      case 'year':
        return (b.year ?? 0) - (a.year ?? 0);
      case 'recent':
        return (
          Date.parse(b.lastSyncedAt ?? '1970-01-01') -
          Date.parse(a.lastSyncedAt ?? '1970-01-01')
        );
      case 'title':
      default:
        return normalise(a.title).localeCompare(normalise(b.title));
    }
  });

  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  return {
    total,
    page,
    pageSize,
    results: filtered.slice(start, end),
  };
}

