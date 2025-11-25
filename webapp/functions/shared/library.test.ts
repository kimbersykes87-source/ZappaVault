import { describe, it, expect } from 'vitest';
import {
  applyLibraryQuery,
  DEFAULT_PAGE_SIZE,
  type LibraryQuery,
  type LibrarySnapshot,
} from '../../../functions/shared/library.ts';

const sampleSnapshot: LibrarySnapshot = {
  generatedAt: '2024-01-01T00:00:00Z',
  albumCount: 5,
  trackCount: 25,
  albums: [
    {
      id: 'album-1',
      title: 'Hot Rats',
      subtitle: '1969 Studio Album',
      year: 1969,
      era: 'Mothers Of Invention',
      genre: 'Jazz Fusion',
      description: 'Groundbreaking fusion album',
      tags: ['classic', 'fusion'],
      locationPath: '/path/to/hot-rats',
      lastSyncedAt: '2024-01-01T00:00:00Z',
      formats: ['FLAC', 'MP3'],
      totalDurationMs: 2520_000,
      totalSizeBytes: 950_000_000,
      tracks: [
        {
          id: 'track-1',
          title: 'Peaches En Regalia',
          durationMs: 210_000,
          trackNumber: 1,
          format: 'FLAC',
          filePath: '/path/to/track.flac',
          sizeBytes: 120_000_000,
        },
      ],
    },
    {
      id: 'album-2',
      title: 'Sheik Yerbouti',
      subtitle: '1979 Double Album',
      year: 1979,
      era: 'Solo',
      genre: 'Rock',
      description: 'Live/studio hybrid',
      tags: ['live', 'satire'],
      locationPath: '/path/to/sheik',
      lastSyncedAt: '2024-01-02T00:00:00Z',
      formats: ['MP3'],
      totalDurationMs: 4320_000,
      totalSizeBytes: 650_000_000,
      tracks: [
        {
          id: 'track-2',
          title: 'I Have Been In You',
          durationMs: 200_000,
          trackNumber: 1,
          format: 'MP3',
          filePath: '/path/to/track.mp3',
          sizeBytes: 45_000_000,
        },
      ],
    },
    {
      id: 'album-3',
      title: 'Apostrophe',
      year: 1974,
      era: 'Mothers Of Invention',
      genre: 'Rock',
      description: 'Classic rock album',
      tags: ['classic'],
      locationPath: '/path/to/apostrophe',
      lastSyncedAt: '2024-01-03T00:00:00Z',
      formats: ['FLAC'],
      totalDurationMs: 1800_000,
      totalSizeBytes: 500_000_000,
      tracks: [],
    },
    {
      id: 'album-4',
      title: 'Joe\'s Garage',
      year: 1979,
      era: 'Solo',
      genre: 'Rock',
      description: 'Concept album',
      tags: ['concept'],
      locationPath: '/path/to/joes-garage',
      lastSyncedAt: '2024-01-04T00:00:00Z',
      formats: ['MP3', 'FLAC'],
      totalDurationMs: 5400_000,
      totalSizeBytes: 800_000_000,
      tracks: [],
    },
    {
      id: 'album-5',
      title: 'Zappa in New York',
      year: 1978,
      era: 'Solo',
      genre: 'Jazz Rock',
      description: 'Live album',
      tags: ['live'],
      locationPath: '/path/to/zappa-ny',
      lastSyncedAt: '2024-01-05T00:00:00Z',
      formats: ['FLAC'],
      totalDurationMs: 3600_000,
      totalSizeBytes: 700_000_000,
      tracks: [],
    },
  ],
};

describe('applyLibraryQuery', () => {
  it('should return all albums when no filters are applied', () => {
    const query: LibraryQuery = {};
    const result = applyLibraryQuery(sampleSnapshot, query);

    expect(result.total).toBe(5);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(result.results).toHaveLength(5);
  });

  it('should filter by search query in title', () => {
    const query: LibraryQuery = { q: 'Hot Rats' };
    const result = applyLibraryQuery(sampleSnapshot, query);

    expect(result.total).toBe(1);
    expect(result.results[0].title).toBe('Hot Rats');
  });

  it('should filter by search query in subtitle', () => {
    const query: LibraryQuery = { q: 'Double Album' };
    const result = applyLibraryQuery(sampleSnapshot, query);

    expect(result.total).toBe(1);
    expect(result.results[0].title).toBe('Sheik Yerbouti');
  });

  it('should filter by search query in track titles', () => {
    const query: LibraryQuery = { q: 'Peaches' };
    const result = applyLibraryQuery(sampleSnapshot, query);

    expect(result.total).toBe(1);
    expect(result.results[0].title).toBe('Hot Rats');
  });

  it('should filter by era', () => {
    const query: LibraryQuery = { era: 'Solo' };
    const result = applyLibraryQuery(sampleSnapshot, query);

    expect(result.total).toBe(3);
    expect(result.results.every((a) => a.era === 'Solo')).toBe(true);
  });

  it('should filter by year', () => {
    const query: LibraryQuery = { year: 1979 };
    const result = applyLibraryQuery(sampleSnapshot, query);

    expect(result.total).toBe(2);
    expect(result.results.every((a) => a.year === 1979)).toBe(true);
  });

  it('should filter by format', () => {
    const query: LibraryQuery = { formats: ['FLAC'] };
    const result = applyLibraryQuery(sampleSnapshot, query);

    expect(result.total).toBe(4);
    expect(
      result.results.every((a) => a.formats.includes('FLAC')),
    ).toBe(true);
  });

  it('should filter by multiple formats (AND logic)', () => {
    const query: LibraryQuery = { formats: ['MP3', 'FLAC'] };
    const result = applyLibraryQuery(sampleSnapshot, query);

    expect(result.total).toBe(2);
    expect(
      result.results.every(
        (a) => a.formats.includes('MP3') && a.formats.includes('FLAC'),
      ),
    ).toBe(true);
  });

  it('should combine multiple filters', () => {
    const query: LibraryQuery = {
      era: 'Solo',
      year: 1979,
      formats: ['MP3'],
    };
    const result = applyLibraryQuery(sampleSnapshot, query);

    // Both Sheik Yerbouti and Joe's Garage match (1979, Solo, MP3)
    expect(result.total).toBe(2);
    expect(result.results.map((a) => a.title)).toContain('Sheik Yerbouti');
    expect(result.results.map((a) => a.title)).toContain('Joe\'s Garage');
  });

  it('should sort by title (default)', () => {
    const query: LibraryQuery = {};
    const result = applyLibraryQuery(sampleSnapshot, query);

    const titles = result.results.map((a) => a.title);
    expect(titles).toEqual([
      'Apostrophe',
      'Hot Rats',
      'Joe\'s Garage',
      'Sheik Yerbouti',
      'Zappa in New York',
    ]);
  });

  it('should sort by year descending', () => {
    const query: LibraryQuery = { sort: 'year' };
    const result = applyLibraryQuery(sampleSnapshot, query);

    const years = result.results.map((a) => a.year ?? 0);
    expect(years).toEqual([1979, 1979, 1978, 1974, 1969]);
  });

  it('should sort by recent (lastSyncedAt)', () => {
    const query: LibraryQuery = { sort: 'recent' };
    const result = applyLibraryQuery(sampleSnapshot, query);

    const dates = result.results.map((a) => a.lastSyncedAt);
    expect(dates).toEqual([
      '2024-01-05T00:00:00Z',
      '2024-01-04T00:00:00Z',
      '2024-01-03T00:00:00Z',
      '2024-01-02T00:00:00Z',
      '2024-01-01T00:00:00Z',
    ]);
  });

  it('should paginate results', () => {
    const query: LibraryQuery = { page: 1, pageSize: 2 };
    const result = applyLibraryQuery(sampleSnapshot, query);

    expect(result.total).toBe(5);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(2);
    expect(result.results).toHaveLength(2);
  });

  it('should handle pagination beyond available results', () => {
    const query: LibraryQuery = { page: 10, pageSize: 2 };
    const result = applyLibraryQuery(sampleSnapshot, query);

    expect(result.total).toBe(5);
    expect(result.page).toBe(10);
    expect(result.results).toHaveLength(0);
  });

  it('should be case-insensitive for search', () => {
    const query: LibraryQuery = { q: 'HOT RATS' };
    const result = applyLibraryQuery(sampleSnapshot, query);

    expect(result.total).toBe(1);
    expect(result.results[0].title).toBe('Hot Rats');
  });

  it('should handle empty snapshot', () => {
    const emptySnapshot: LibrarySnapshot = {
      generatedAt: '2024-01-01T00:00:00Z',
      albumCount: 0,
      trackCount: 0,
      albums: [],
    };
    const query: LibraryQuery = {};
    const result = applyLibraryQuery(emptySnapshot, query);

    expect(result.total).toBe(0);
    expect(result.results).toHaveLength(0);
  });

  it('should normalize unicode characters in search', () => {
    const snapshotWithUnicode: LibrarySnapshot = {
      ...sampleSnapshot,
      albums: [
        {
          ...sampleSnapshot.albums[0],
          title: 'Café Zappa',
        },
      ],
    };
    const query: LibraryQuery = { q: 'cafe' };
    const result = applyLibraryQuery(snapshotWithUnicode, query);

    expect(result.total).toBe(1);
  });
});

