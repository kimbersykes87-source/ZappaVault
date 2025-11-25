import { describe, it, expect, beforeEach, vi } from 'vitest';
import { onRequestGet } from '../../../../functions/api/albums/[id].ts';
import { sampleLibrary } from '../../../../functions/utils/library.sample.ts';
import {
  createMockEnv,
  createMockRequest,
  createMockContext,
} from '../../test-utils/mocks.ts';

// Mock the loadLibrarySnapshot function
vi.mock('../../../../functions/utils/library.ts', async () => {
  const actual = await vi.importActual('../../../../functions/utils/library.ts');
  return {
    ...actual,
    loadLibrarySnapshot: vi.fn(),
  };
});

import { loadLibrarySnapshot } from '../../../../functions/utils/library.ts';

// Mock fetch for Dropbox API calls
global.fetch = vi.fn();

describe('/api/albums/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadLibrarySnapshot).mockResolvedValue(sampleLibrary);
  });

  it('should return album by id', async () => {
    const env = createMockEnv();
    const albumId = sampleLibrary.albums[0].id;
    const request = createMockRequest(
      `https://example.com/api/albums/${albumId}`,
    );
    const context = createMockContext(request, env, { id: albumId });
    const response = await onRequestGet(context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.album.id).toBe(albumId);
    expect(data.album.title).toBe(sampleLibrary.albums[0].title);
  });

  it('should return 400 when album id is missing', async () => {
    const env = createMockEnv();
    const request = createMockRequest('https://example.com/api/albums/');
    const context = createMockContext(request, env, {});
    const response = await onRequestGet(context);

    expect(response.status).toBe(400);
    expect(await response.text()).toBe('Missing album id');
  });

  it('should return 404 when album is not found', async () => {
    const env = createMockEnv();
    const request = createMockRequest(
      'https://example.com/api/albums/non-existent-id',
    );
    const context = createMockContext(request, env, {
      id: 'non-existent-id',
    });
    const response = await onRequestGet(context);

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('Album not found');
  });

  it('should not include signed links by default', async () => {
    const env = createMockEnv();
    const albumId = sampleLibrary.albums[0].id;
    const request = createMockRequest(
      `https://example.com/api/albums/${albumId}`,
    );
    const context = createMockContext(request, env, { id: albumId });
    const response = await onRequestGet(context);
    const data = await response.json();

    expect(data.album.tracks[0].streamingUrl).toBeUndefined();
    expect(data.album.tracks[0].downloadUrl).toBeUndefined();
    expect(response.headers.get('cache-control')).toBe('public, max-age=300');
  });

  it('should include signed links when links=1', async () => {
    const env = createMockEnv();
    const albumId = sampleLibrary.albums[0].id;
    const mockLink = 'https://dl.dropboxusercontent.com/temp-link.mp3';

    // Mock fetch for each track
    const trackCount = sampleLibrary.albums[0].tracks.length;
    for (let i = 0; i < trackCount; i++) {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ link: mockLink }),
      } as Response);
    }

    const request = createMockRequest(
      `https://example.com/api/albums/${albumId}?links=1`,
    );
    const context = createMockContext(request, env, { id: albumId });
    const response = await onRequestGet(context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.album.tracks[0].streamingUrl).toBe(mockLink);
    expect(data.album.tracks[0].downloadUrl).toBe(mockLink);
    expect(response.headers.get('cache-control')).toBe('private, max-age=30');
  });

  it('should handle missing Dropbox token gracefully', async () => {
    const env = createMockEnv({ DROPBOX_TOKEN: undefined });
    const albumId = sampleLibrary.albums[0].id;
    const request = createMockRequest(
      `https://example.com/api/albums/${albumId}?links=1`,
    );
    const context = createMockContext(request, env, { id: albumId });
    const response = await onRequestGet(context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.album.tracks[0].streamingUrl).toBeUndefined();
  });

  it('should handle Dropbox API errors gracefully', async () => {
    const env = createMockEnv();
    const albumId = sampleLibrary.albums[0].id;

    // Mock fetch for each track to return error
    const trackCount = sampleLibrary.albums[0].tracks.length;
    for (let i = 0; i < trackCount; i++) {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'File not found',
      } as Response);
    }

    const request = createMockRequest(
      `https://example.com/api/albums/${albumId}?links=1`,
    );
    const context = createMockContext(request, env, { id: albumId });
    const response = await onRequestGet(context);
    const data = await response.json();

    // Should still return album, but without links
    expect(response.status).toBe(200);
    expect(data.album.tracks[0].streamingUrl).toBeUndefined();
  });

  it('should request temporary links for all tracks', async () => {
    const env = createMockEnv();
    const albumId = sampleLibrary.albums[0].id;
    const mockLink = 'https://dl.dropboxusercontent.com/temp-link.mp3';

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ link: mockLink }),
    } as Response);

    const request = createMockRequest(
      `https://example.com/api/albums/${albumId}?links=1`,
    );
    const context = createMockContext(request, env, { id: albumId });
    const response = await onRequestGet(context);
    const data = await response.json();

    const trackCount = sampleLibrary.albums[0].tracks.length;
    expect(global.fetch).toHaveBeenCalledTimes(trackCount);
    expect(data.album.tracks.every((t: { streamingUrl: string }) => t.streamingUrl === mockLink)).toBe(true);
  });
});

