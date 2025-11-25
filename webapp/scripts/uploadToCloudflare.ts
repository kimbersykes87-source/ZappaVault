import 'dotenv/config';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import type { LibrarySnapshot } from '../../../shared/library.ts';

/**
 * Upload library to Cloudflare Pages API
 */
async function uploadToCloudflare() {
  const libraryPath = resolve(process.cwd(), 'data/library.generated.json');
  const apiUrl = process.env.VITE_API_BASE || 'https://zappavault.pages.dev';
  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken) {
    console.error('❌ ADMIN_TOKEN is required. Set it in .env file or as environment variable.');
    console.error('   You can find it in Cloudflare Pages → Settings → Environment variables');
    process.exit(1);
  }

  console.log(`Reading library from: ${libraryPath}`);

  try {
    const fileContent = await readFile(libraryPath, 'utf-8');
    const snapshot = JSON.parse(fileContent) as LibrarySnapshot;

    console.log(
      `✅ Loaded ${snapshot.albumCount} albums with ${snapshot.trackCount} tracks`,
    );

    const url = `${apiUrl}/api/refresh`;
    console.log(`Uploading to: ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({ snapshot }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Upload failed: ${response.status} ${response.statusText}\n${text}`);
    }

    const result = (await response.json()) as {
      status: string;
      albums: number;
    };

    console.log(`✅ Successfully uploaded ${result.albums} albums to Cloudflare Pages!`);
    console.log(`   Your library is now live at: ${apiUrl}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('ENOENT')) {
      console.error(`❌ Library file not found at ${libraryPath}`);
      console.error('   Run `npm run sync:dropbox` first to generate the library file.');
    } else {
      console.error('❌ Upload failed:', error);
    }
    process.exit(1);
  }
}

uploadToCloudflare().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});


