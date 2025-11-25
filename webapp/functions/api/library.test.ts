import { describe, it, expect, beforeEach, vi } from 'vitest';
import { onRequestGet } from '../../../functions/api/library.ts';
import { sampleLibrary } from '../../../functions/utils/library.sample.ts';
import {
  createMockEnv,
  createMockRequest,
  createMockContext,
  seedLibrarySnapshot,
} from '../test-utils/mocks.ts';

// Mock the loadLibrarySnapshot function
vi.mock('../../../functions/utils/library.ts', async () => {
  const actual = await vi.importActual('../../../functions/utils/library.ts');
  return {
    ...actual,
    loadLibrarySnapshot: vi.fn(),
  };
});

import { loadLibrarySnapshot } from '../../../functions/utils/library.ts';

describe('/api/library', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return library with default query', async () => {
    const env = createMockEnv();
    await seedLibrarySnapshot(env, sampleLibrary);
    vi.mocked(loadLibrarySnapshot).mockResolvedValue(sampleLibrary);

    const request = createMockRequest('https://example.com/api/library');
    const context = createMockContext(request, env);
    const response = await onRequestGet(context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(data.query).toEqual({
      q: undefined,
      formats: [],
      era: undefined,
      year: undefined,
      sort: 'title',
      page: 1,
      pageSize: 24,
    });
    expect(data.total).toBe(sampleLibrary.albumCount);
    expect(data.results).toHaveLength(sampleLibrary.albums.length);
  });

  it('should handle search query parameter', async () => {
    const env = createMockEnv();
    vi.mocked(loadLibrarySnapshot).mockResolvedValue(sampleLibrary);

    const request = createMockRequest(
      'https://example.com/api/library?q=Hot+Rats',
    );
    const context = createMockContext(request, env);
    const response = await onRequestGet(context);
    const data = await response.json();

    expect(data.query.q).toBe('Hot Rats');
    expect(data.results.length).toBeGreaterThan(0);
    expect(
      data.results.some((a: { title: string }) =>
        a.title.toLowerCase().includes('hot'),
      ),
    ).toBe(true);
  });

  it('should handle format filter', async () => {
    const env = createMockEnv();
    vi.mocked(loadLibrarySnapshot).mockResolvedValue(sampleLibrary);

    const request = createMockRequest(
      'https://example.com/api/library?format=FLAC&format=MP3',
    );
    const context = createMockContext(request, env);
    const response = await onRequestGet(context);
    const data = await response.json();

    expect(data.query.formats).toEqual(['FLAC', 'MP3']);
  });

  it('should handle era filter', async () => {
    const env = createMockEnv();
    vi.mocked(loadLibrarySnapshot).mockResolvedValue(sampleLibrary);

    const request = createMockRequest(
      'https://example.com/api/library?era=Solo',
    );
    const context = createMockContext(request, env);
    const response = await onRequestGet(context);
    const data = await response.json();

    expect(data.query.era).toBe('Solo');
    expect(
      data.results.every(
        (a: { era: string }) => a.era === 'Solo',
      ),
    ).toBe(true);
  });

  it('should handle year filter', async () => {
    const env = createMockEnv();
    vi.mocked(loadLibrarySnapshot).mockResolvedValue(sampleLibrary);

    const request = createMockRequest(
      'https://example.com/api/library?year=1969',
    );
    const context = createMockContext(request, env);
    const response = await onRequestGet(context);
    const data = await response.json();

    expect(data.query.year).toBe(1969);
    expect(
      data.results.every((a: { year?: number }) => a.year === 1969),
    ).toBe(true);
  });

  it('should handle sort parameter', async () => {
    const env = createMockEnv();
    vi.mocked(loadLibrarySnapshot).mockResolvedValue(sampleLibrary);

    const request = createMockRequest(
      'https://example.com/api/library?sort=year',
    );
    const context = createMockContext(request, env);
    const response = await onRequestGet(context);
    const data = await response.json();

    expect(data.query.sort).toBe('year');
  });

  it('should handle pagination', async () => {
    const env = createMockEnv();
    vi.mocked(loadLibrarySnapshot).mockResolvedValue(sampleLibrary);

    const request = createMockRequest(
      'https://example.com/api/library?page=1&pageSize=1',
    );
    const context = createMockContext(request, env);
    const response = await onRequestGet(context);
    const data = await response.json();

    expect(data.query.page).toBe(1);
    expect(data.query.pageSize).toBe(1);
    expect(data.results).toHaveLength(1);
  });

  it('should set cache-control header', async () => {
    const env = createMockEnv();
    vi.mocked(loadLibrarySnapshot).mockResolvedValue(sampleLibrary);

    const request = createMockRequest('https://example.com/api/library');
    const context = createMockContext(request, env);
    const response = await onRequestGet(context);

    expect(response.headers.get('cache-control')).toBe('public, max-age=60');
  });

  it('should handle complex query with multiple filters', async () => {
    const env = createMockEnv();
    vi.mocked(loadLibrarySnapshot).mockResolvedValue(sampleLibrary);

    const request = createMockRequest(
      'https://example.com/api/library?q=Hot&format=FLAC&era=Mothers+Of+Invention&year=1969&sort=year&page=1&pageSize=10',
    );
    const context = createMockContext(request, env);
    const response = await onRequestGet(context);
    const data = await response.json();

    expect(data.query.q).toBe('Hot');
    expect(data.query.formats).toEqual(['FLAC']);
    expect(data.query.era).toBe('Mothers Of Invention');
    expect(data.query.year).toBe(1969);
    expect(data.query.sort).toBe('year');
  });
});

