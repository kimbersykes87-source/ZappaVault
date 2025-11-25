import type { Album, LibraryResult, LibrarySnapshot } from '../../../shared/library.ts';

const API_BASE =
  import.meta.env.VITE_API_BASE?.replace(/\/$/, '') ?? '';

export interface LibraryResponse extends LibraryResult {
  query: Record<string, unknown>;
}

export interface LibraryRequest {
  q?: string;
  formats?: string[];
  era?: string;
  year?: number;
  sort?: 'title' | 'year' | 'recent';
  page?: number;
  pageSize?: number;
}

type Primitive = string | number | boolean | string[];

const buildUrl = (
  path: string,
  params?: Record<string, Primitive | undefined> | LibraryRequest,
): string => {
  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  const url = new URL(`${API_BASE}${path}`, origin);

  if (params) {
    Object.entries(params as Record<string, Primitive | undefined>).forEach(
      ([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }

        const paramKey = key === 'formats' ? 'format' : key;

      if (Array.isArray(value)) {
          value.forEach((entry) =>
            url.searchParams.append(paramKey, String(entry)),
          );
      } else {
          url.searchParams.set(paramKey, String(value));
      }
      },
    );
  }

  return API_BASE ? url.toString() : `${url.pathname}${url.search}`;
};

export async function fetchLibrary(
  params: LibraryRequest,
): Promise<LibraryResponse> {
  const url = buildUrl('/api/library', params);
  const response = await fetch(url);
  
  const contentType = response.headers.get('content-type');
  
  if (!response.ok) {
    if (contentType?.includes('text/html')) {
      const text = await response.text();
      throw new Error(
        `API endpoint not found. The server returned HTML instead of JSON. ` +
        `Please check that the API is running and accessible at: ${url}. ` +
        `Response preview: ${text.substring(0, 200)}`
      );
    }
    throw new Error(`Unable to load library: ${response.status} ${response.statusText}`);
  }

  if (!contentType?.includes('application/json')) {
    const text = await response.text();
    throw new Error(
      `Expected JSON response but received ${contentType}. ` +
      `Response preview: ${text.substring(0, 200)}`
    );
  }

  try {
    return (await response.json()) as LibraryResponse;
  } catch (err) {
    // If JSON parsing fails, we can't read the response again, so use the error
    throw new Error(
      `Failed to parse JSON response. ` +
      `This usually means the API returned HTML instead of JSON. ` +
      `Please check that the API endpoint is correct: ${url}. ` +
      `Original error: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export async function fetchAlbum(
  albumId: string,
  includeLinks = false,
): Promise<Album> {
  const url = buildUrl(`/api/albums/${albumId}`, includeLinks ? { links: '1' } : undefined);
  const response = await fetch(url);

  const contentType = response.headers.get('content-type');

  if (!response.ok) {
    if (contentType?.includes('text/html')) {
      const text = await response.text();
      throw new Error(
        `API endpoint not found. The server returned HTML instead of JSON. ` +
        `Please check that the API is running and accessible at: ${url}. ` +
        `Response preview: ${text.substring(0, 200)}`
      );
    }
    throw new Error(`Album not found: ${response.status} ${response.statusText}`);
  }

  if (!contentType?.includes('application/json')) {
    const text = await response.text();
    throw new Error(
      `Expected JSON response but received ${contentType}. ` +
      `Response preview: ${text.substring(0, 200)}`
    );
  }

  try {
    const payload = (await response.json()) as { album: Album };
    return payload.album;
  } catch (err) {
    // If JSON parsing fails, we can't read the response again, so use the error
    throw new Error(
      `Failed to parse JSON response. ` +
      `This usually means the API returned HTML instead of JSON. ` +
      `Please check that the API endpoint is correct: ${url}. ` +
      `Original error: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export async function refreshLibrary(
  snapshot: LibrarySnapshot,
  adminToken?: string,
): Promise<void> {
  const response = await fetch('/api/refresh', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(adminToken ? { 'x-admin-token': adminToken } : {}),
    },
    body: JSON.stringify({ snapshot }),
  });

  if (!response.ok) {
    throw new Error('Refresh failed');
  }
}

export function getAlbumDownloadUrl(albumId: string): string {
  return buildUrl(`/api/albums/${albumId}/download`);
}

export function getTrackDownloadUrl(trackId: string): string {
  return buildUrl(`/api/tracks/${trackId}/download`);
}

