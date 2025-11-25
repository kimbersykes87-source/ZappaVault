import { readFile } from 'fs/promises';
import { resolve } from 'path';
import type { LibrarySnapshot } from '../../../shared/library.ts';

/**
 * Upload the generated library to the backend API
 */
async function uploadLibrary() {
  const libraryPath = resolve(process.cwd(), 'data/library.generated.json');
  const apiUrl = process.env.VITE_API_BASE || 'http://localhost:8788';
  const adminToken = process.env.ADMIN_TOKEN;

  console.log(`Reading library from: ${libraryPath}`);

  try {
    const fileContent = await readFile(libraryPath, 'utf-8');
    const snapshot = JSON.parse(fileContent) as LibrarySnapshot;

    console.log(
      `Loaded ${snapshot.albumCount} albums with ${snapshot.trackCount} tracks`,
    );

    const url = `${apiUrl}/api/refresh`;
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };

    if (adminToken) {
      headers['x-admin-token'] = adminToken;
    }

    console.log(`Uploading to: ${url}`);
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ snapshot }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Upload failed: ${response.status} ${text}`);
    }

    const result = (await response.json()) as {
      status: string;
      albums: number;
    };

    console.log(`✅ Successfully uploaded ${result.albums} albums to backend`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('ENOENT')) {
      console.error(
        `❌ Library file not found at ${libraryPath}`,
      );
      console.error(
        'Run `npm run sync:dropbox` first to generate the library file.',
      );
    } else {
      console.error('❌ Upload failed:', error);
    }
    process.exit(1);
  }
}

uploadLibrary().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});


