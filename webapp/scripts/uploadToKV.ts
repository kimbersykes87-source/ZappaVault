import 'dotenv/config';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import type { LibrarySnapshot } from '../../../shared/library.ts';

/**
 * Upload library directly to Cloudflare KV namespace
 */
async function uploadToKV() {
  const libraryPath = resolve(process.cwd(), 'data/library.generated.json');
  const namespaceId = process.env.CF_KV_NAMESPACE_ID;
  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!namespaceId || !accountId || !apiToken) {
    console.error('❌ Missing required environment variables:');
    if (!namespaceId) console.error('   - CF_KV_NAMESPACE_ID');
    if (!accountId) console.error('   - CF_ACCOUNT_ID');
    if (!apiToken) console.error('   - CLOUDFLARE_API_TOKEN');
    console.error('\nThese can be found in:');
    console.error('   - Cloudflare Dashboard → Workers & Pages → KV → Your namespace ID');
    console.error('   - Cloudflare Dashboard → Your Account ID (right sidebar)');
    console.error('   - Cloudflare Dashboard → My Profile → API Tokens');
    process.exit(1);
  }

  console.log(`Reading library from: ${libraryPath}`);
  console.log(`KV Namespace ID: ${namespaceId}`);
  console.log(`Account ID: ${accountId}`);

  try {
    const fileContent = await readFile(libraryPath, 'utf-8');
    const snapshot = JSON.parse(fileContent) as LibrarySnapshot;

    console.log(
      `✅ Loaded ${snapshot.albumCount} albums with ${snapshot.trackCount} tracks`,
    );

    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/bulk`;
    console.log(`Uploading to KV: ${url}`);

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify([
        {
          key: 'library-snapshot',
          value: JSON.stringify(snapshot),
        },
      ]),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`KV upload failed: ${response.status} ${response.statusText}\n${text}`);
    }

    const result = await response.json();
    console.log(`✅ Successfully uploaded library to Cloudflare KV!`);
    console.log(`   Albums: ${snapshot.albumCount}`);
    console.log(`   Tracks: ${snapshot.trackCount}`);
    console.log(`\n   The library should now be available at: https://zappavault.pages.dev`);
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

uploadToKV().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});



