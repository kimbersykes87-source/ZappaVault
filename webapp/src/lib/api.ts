import type { Album, LibraryResult, LibrarySnapshot } from '../../shared/library.ts';

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
  const response = await fetch(buildUrl('/api/library', params));
  if (!response.ok) {
    throw new Error('Unable to load library');
  }

  return (await response.json()) as LibraryResponse;
}

export async function fetchAlbum(
  albumId: string,
  includeLinks = false,
): Promise<Album> {
  const response = await fetch(
    buildUrl(`/api/albums/${albumId}`, includeLinks ? { links: '1' } : undefined),
  );

  if (!response.ok) {
    throw new Error('Album not found');
  }

  const payload = (await response.json()) as { album: Album };
  return payload.album;
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

