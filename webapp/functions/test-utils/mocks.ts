import type { EnvBindings } from '../../../functions/utils/library.ts';
import type { LibrarySnapshot } from '../../../functions/shared/library.ts';

/**
 * Mock KV Namespace for testing
 */
export class MockKVNamespace implements KVNamespace {
  private store: Map<string, string> = new Map();

  async get<T = unknown>(
    key: string,
    type?: 'text' | 'json' | 'arrayBuffer' | 'stream',
  ): Promise<T | null> {
    const value = this.store.get(key);
    if (!value) return null;

    switch (type) {
      case 'json':
        return JSON.parse(value) as T;
      case 'text':
        return value as T;
      case 'arrayBuffer':
        return new TextEncoder().encode(value).buffer as T;
      default:
        return value as T;
    }
  }

  async put(
    key: string,
    value: string | ArrayBuffer | ArrayBufferView | ReadableStream,
    options?: KVNamespacePutOptions,
  ): Promise<void> {
    if (typeof value === 'string') {
      this.store.set(key, value);
    } else if (value instanceof ArrayBuffer) {
      this.store.set(key, new TextDecoder().decode(value));
    } else if (value instanceof ReadableStream) {
      const reader = value.getReader();
      const chunks: Uint8Array[] = [];
      let done = false;
      while (!done) {
        const result = await reader.read();
        done = result.done;
        if (result.value) chunks.push(result.value);
      }
      const combined = new Uint8Array(
        chunks.reduce((acc, chunk) => acc + chunk.length, 0),
      );
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      this.store.set(key, new TextDecoder().decode(combined));
    }
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async list(options?: KVNamespaceListOptions): Promise<KVNamespaceListResult<unknown>> {
    const keys = Array.from(this.store.keys());
    const filtered = options?.prefix
      ? keys.filter((k) => k.startsWith(options.prefix))
      : keys;

    return {
      keys: filtered.map((name) => ({
        name,
        expiration: undefined,
        metadata: undefined,
      })),
      list_complete: true,
      cursor: '',
    };
  }

  clear(): void {
    this.store.clear();
  }
}

/**
 * Create a mock environment for testing
 */
export function createMockEnv(
  overrides?: Partial<EnvBindings>,
): EnvBindings {
  return {
    LIBRARY_KV: new MockKVNamespace(),
    ADMIN_TOKEN: 'test-admin-token',
    DROPBOX_TOKEN: 'test-dropbox-token',
    ...overrides,
  };
}

/**
 * Create a mock request
 */
export function createMockRequest(
  url: string,
  options?: {
    method?: string;
    headers?: Record<string, string>;
    body?: unknown;
  },
): Request {
  const headers = new Headers(options?.headers);
  const method = options?.method || 'GET';

  let body: BodyInit | undefined;
  if (options?.body) {
    body = JSON.stringify(options.body);
    headers.set('content-type', 'application/json');
  }

  return new Request(url, {
    method,
    headers,
    body,
  });
}

/**
 * Create a mock PagesFunction context
 */
export function createMockContext(
  request: Request,
  env: EnvBindings,
  params?: Record<string, string>,
): {
  request: Request;
  env: EnvBindings;
  params: Record<string, string> | undefined;
  waitUntil: (promise: Promise<unknown>) => void;
  passThroughOnException: () => void;
  next: () => Promise<Response>;
  data: unknown;
} {
  return {
    request,
    env,
    params,
    waitUntil: () => {},
    passThroughOnException: () => {},
    next: async () => new Response('Not found', { status: 404 }),
    data: undefined,
  };
}

/**
 * Helper to seed KV with a library snapshot
 */
export async function seedLibrarySnapshot(
  env: EnvBindings,
  snapshot: LibrarySnapshot,
): Promise<void> {
  if (env.LIBRARY_KV) {
    await env.LIBRARY_KV.put(
      'library-snapshot',
      JSON.stringify(snapshot),
    );
  }
}

