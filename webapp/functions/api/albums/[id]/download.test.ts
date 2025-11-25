import { describe, it, expect, beforeEach, vi } from 'vitest';
import { onRequestGet } from '../../../../../functions/api/albums/[id]/download.ts';
import { sampleLibrary } from '../../../../../functions/utils/library.sample.ts';
import {
  createMockEnv,
  createMockRequest,
  createMockContext,
} from '../../../test-utils/mocks.ts';

// Mock the loadLibrarySnapshot function
vi.mock('../../../../../functions/utils/library.ts', async () => {
  const actual = await vi.importActual('../../../../../functions/utils/library.ts');
  return {
    ...actual,
    loadLibrarySnapshot: vi.fn(),
  };
});

import { loadLibrarySnapshot } from '../../../../../functions/utils/library.ts';

// Mock fetch for Dropbox API calls
global.fetch = vi.fn();

describe('/api/albums/[id]/download', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadLibrarySnapshot).mockResolvedValue(sampleLibrary);
  });

  it('should return 400 when album id is missing', async () => {
    const env = createMockEnv();
    const request = createMockRequest('https://example.com/api/albums//download');
    const context = createMockContext(request, env, {});
    const response = await onRequestGet(context);

    expect(response.status).toBe(400);
    expect(await response.text()).toBe('Missing album id');
  });

  it('should return 500 when Dropbox token is not configured', async () => {
    const env = createMockEnv({ DROPBOX_TOKEN: undefined });
    const albumId = sampleLibrary.albums[0].id;
    const request = createMockRequest(
      `https://example.com/api/albums/${albumId}/download`,
    );
    const context = createMockContext(request, env, { id: albumId });
    const response = await onRequestGet(context);

    expect(response.status).toBe(500);
    expect(await response.text()).toBe('Dropbox token not configured');
  });

  it('should return 404 when album is not found', async () => {
    const env = createMockEnv();
    const request = createMockRequest(
      'https://example.com/api/albums/non-existent-id/download',
    );
    const context = createMockContext(request, env, {
      id: 'non-existent-id',
    });
    const response = await onRequestGet(context);

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('Album not found');
  });

  it('should download album zip from Dropbox', async () => {
    const env = createMockEnv();
    const albumId = sampleLibrary.albums[0].id;
    const album = sampleLibrary.albums[0];
    const mockZipData = new Uint8Array([0x50, 0x4b, 0x03, 0x04]); // ZIP file header

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(mockZipData);
          controller.close();
        },
      }),
    } as Response);

    const request = createMockRequest(
      `https://example.com/api/albums/${albumId}/download`,
    );
    const context = createMockContext(request, env, { id: albumId });
    const response = await onRequestGet(context);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/zip');
    expect(response.headers.get('content-disposition')).toContain(
      `${album.title}.zip`,
    );

    // Verify Dropbox API was called correctly
    expect(global.fetch).toHaveBeenCalledWith(
      'https://content.dropboxapi.com/2/files/download_zip',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${env.DROPBOX_TOKEN}`,
          'Dropbox-API-Arg': JSON.stringify({
            path: album.locationPath,
          }),
        }),
      }),
    );
  });

  it('should sanitize filename in content-disposition', async () => {
    const env = createMockEnv();
    const albumWithQuotes = {
      ...sampleLibrary.albums[0],
      title: 'Album "With" Quotes',
    };
    const modifiedLibrary = {
      ...sampleLibrary,
      albums: [albumWithQuotes],
    };
    vi.mocked(loadLibrarySnapshot).mockResolvedValue(modifiedLibrary);

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
    } as Response);

    const request = createMockRequest(
      `https://example.com/api/albums/${albumWithQuotes.id}/download`,
    );
    const context = createMockContext(request, env, { id: albumWithQuotes.id });
    const response = await onRequestGet(context);

    const disposition = response.headers.get('content-disposition');
    // The code removes quotes from the title, but the header still has quotes around the filename (standard)
    expect(disposition).toContain('Album With Quotes.zip');
    // Verify quotes were removed from the title (not in the filename part)
    expect(disposition?.match(/filename="([^"]+)"/)?.[1]).not.toContain('"');
  });

  it('should return error when Dropbox API fails', async () => {
    const env = createMockEnv();
    const albumId = sampleLibrary.albums[0].id;

    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => 'Path not found',
    } as Response);

    const request = createMockRequest(
      `https://example.com/api/albums/${albumId}/download`,
    );
    const context = createMockContext(request, env, { id: albumId });
    const response = await onRequestGet(context);

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('Path not found');
  });
});

