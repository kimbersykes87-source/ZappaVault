import { describe, it, expect, beforeEach, vi } from 'vitest';
import { onRequestPost } from '../../../functions/api/refresh.ts';
import { sampleLibrary } from '../../../functions/utils/library.sample.ts';
import {
  createMockEnv,
  createMockRequest,
  createMockContext,
  type MockKVNamespace,
} from '../test-utils/mocks.ts';

// Mock the utility functions
vi.mock('../../../functions/utils/library.ts', async () => {
  const actual = await vi.importActual('../../../functions/utils/library.ts');
  return {
    ...actual,
    requireAdmin: vi.fn(),
    persistLibrarySnapshot: vi.fn(),
  };
});

import { requireAdmin, persistLibrarySnapshot } from '../../../functions/utils/library.ts';

describe('/api/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAdmin).mockReturnValue(true);
    vi.mocked(persistLibrarySnapshot).mockResolvedValue(undefined);
  });

  it('should return 401 when not authenticated', async () => {
    vi.mocked(requireAdmin).mockReturnValue(false);
    const env = createMockEnv();
    const request = createMockRequest('https://example.com/api/refresh', {
      method: 'POST',
      body: { snapshot: sampleLibrary },
    });
    const context = createMockContext(request, env);
    const response = await onRequestPost(context);

    expect(response.status).toBe(401);
    expect(await response.text()).toBe('Unauthorized');
  });

  it('should return 400 when payload is invalid JSON', async () => {
    const env = createMockEnv();
    const request = new Request('https://example.com/api/refresh', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'invalid json',
    });
    const context = createMockContext(request, env);
    const response = await onRequestPost(context);

    expect(response.status).toBe(400);
    expect(await response.text()).toBe('Invalid payload');
  });

  it('should return 422 when snapshot is missing albums', async () => {
    const env = createMockEnv();
    const request = createMockRequest('https://example.com/api/refresh', {
      method: 'POST',
      body: { snapshot: { generatedAt: '2024-01-01', albumCount: 0 } },
    });
    const context = createMockContext(request, env);
    const response = await onRequestPost(context);

    expect(response.status).toBe(422);
    expect(await response.text()).toBe('Snapshot missing albums');
  });

  it('should return 422 when snapshot albums is not an array', async () => {
    const env = createMockEnv();
    const request = createMockRequest('https://example.com/api/refresh', {
      method: 'POST',
      body: { snapshot: { albums: 'not-an-array' } },
    });
    const context = createMockContext(request, env);
    const response = await onRequestPost(context);

    expect(response.status).toBe(422);
    expect(await response.text()).toBe('Snapshot missing albums');
  });

  it('should persist valid snapshot', async () => {
    const env = createMockEnv();
    const request = createMockRequest('https://example.com/api/refresh', {
      method: 'POST',
      body: { snapshot: sampleLibrary },
    });
    const context = createMockContext(request, env);
    const response = await onRequestPost(context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.albums).toBe(sampleLibrary.albums.length);
    expect(persistLibrarySnapshot).toHaveBeenCalledWith(env, sampleLibrary);
  });

  it('should return JSON response with correct content-type', async () => {
    const env = createMockEnv();
    const request = createMockRequest('https://example.com/api/refresh', {
      method: 'POST',
      body: { snapshot: sampleLibrary },
    });
    const context = createMockContext(request, env);
    const response = await onRequestPost(context);

    expect(response.headers.get('content-type')).toBe('application/json');
  });

  it('should handle snapshot with empty albums array', async () => {
    const env = createMockEnv();
    const emptySnapshot = {
      ...sampleLibrary,
      albums: [],
      albumCount: 0,
    };
    const request = createMockRequest('https://example.com/api/refresh', {
      method: 'POST',
      body: { snapshot: emptySnapshot },
    });
    const context = createMockContext(request, env);
    const response = await onRequestPost(context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.albums).toBe(0);
  });
});

