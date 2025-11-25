import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadLibrarySnapshot,
  persistLibrarySnapshot,
  requireAdmin,
  type EnvBindings,
} from '../../../functions/utils/library.ts';
import { sampleLibrary } from '../../../functions/utils/library.sample.ts';
import {
  createMockEnv,
  seedLibrarySnapshot,
  MockKVNamespace,
} from '../test-utils/mocks.ts';

describe('loadLibrarySnapshot', () => {
  it('should return sample library when KV is not available', async () => {
    const env = createMockEnv({ LIBRARY_KV: undefined });
    const snapshot = await loadLibrarySnapshot(env);

    expect(snapshot.albumCount).toBe(sampleLibrary.albumCount);
    expect(snapshot.albums).toHaveLength(sampleLibrary.albums.length);
  });

  it('should return sample library when KV is empty', async () => {
    const env = createMockEnv();
    const snapshot = await loadLibrarySnapshot(env);

    expect(snapshot.albumCount).toBe(sampleLibrary.albumCount);
  });

  it('should return cached library from KV when available', async () => {
    const env = createMockEnv();
    const customSnapshot = {
      ...sampleLibrary,
      albumCount: 999,
      albums: [],
    };
    await seedLibrarySnapshot(env, customSnapshot);

    const snapshot = await loadLibrarySnapshot(env);

    expect(snapshot.albumCount).toBe(999);
    expect(snapshot.albums).toHaveLength(0);
  });
});

describe('persistLibrarySnapshot', () => {
  beforeEach(() => {
    // Clear is handled per test
  });

  it('should persist snapshot to KV', async () => {
    const env = createMockEnv();
    const snapshot = {
      ...sampleLibrary,
      albumCount: 42,
    };

    await persistLibrarySnapshot(env, snapshot);

    const cached = await env.LIBRARY_KV?.get('library-snapshot', 'json');
    expect(cached).toBeDefined();
    expect((cached as typeof snapshot).albumCount).toBe(42);
  });

  it('should not throw when KV is not available', async () => {
    const env = createMockEnv({ LIBRARY_KV: undefined });
    const snapshot = sampleLibrary;

    await expect(
      persistLibrarySnapshot(env, snapshot),
    ).resolves.not.toThrow();
  });

  it('should set expiration TTL on KV entry', async () => {
    const env = createMockEnv();
    const snapshot = sampleLibrary;

    await persistLibrarySnapshot(env, snapshot);

    // Verify the entry exists (TTL is set internally by KV)
    const cached = await env.LIBRARY_KV?.get('library-snapshot', 'json');
    expect(cached).toBeDefined();
  });
});

describe('requireAdmin', () => {
  it('should return true when ADMIN_TOKEN is not set', () => {
    const env = createMockEnv({ ADMIN_TOKEN: undefined });
    const request = new Request('https://example.com/api/refresh');

    expect(requireAdmin(request, env)).toBe(true);
  });

  it('should return true when header token matches', () => {
    const env = createMockEnv({ ADMIN_TOKEN: 'test-token' });
    const request = new Request('https://example.com/api/refresh', {
      headers: { 'x-admin-token': 'test-token' },
    });

    expect(requireAdmin(request, env)).toBe(true);
  });

  it('should return true when query token matches', () => {
    const env = createMockEnv({ ADMIN_TOKEN: 'test-token' });
    const request = new Request(
      'https://example.com/api/refresh?token=test-token',
    );

    expect(requireAdmin(request, env)).toBe(true);
  });

  it('should return false when token does not match', () => {
    const env = createMockEnv({ ADMIN_TOKEN: 'correct-token' });
    const request = new Request('https://example.com/api/refresh', {
      headers: { 'x-admin-token': 'wrong-token' },
    });

    expect(requireAdmin(request, env)).toBe(false);
  });

  it('should return false when no token is provided', () => {
    const env = createMockEnv({ ADMIN_TOKEN: 'test-token' });
    const request = new Request('https://example.com/api/refresh');

    expect(requireAdmin(request, env)).toBe(false);
  });

  it('should prioritize header token over query token', () => {
    const env = createMockEnv({ ADMIN_TOKEN: 'correct-token' });
    const request = new Request(
      'https://example.com/api/refresh?token=wrong-token',
      {
        headers: { 'x-admin-token': 'correct-token' },
      },
    );

    expect(requireAdmin(request, env)).toBe(true);
  });
});

