import 'dotenv/config';
import type { LibrarySnapshot } from '../../../shared/library.ts';

/**
 * Verify what's stored in Cloudflare KV
 */
async function verifyKV() {
  const namespaceId = process.env.CF_KV_NAMESPACE_ID;
  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!namespaceId || !accountId || !apiToken) {
    console.error('❌ Missing required environment variables');
    process.exit(1);
  }

  console.log(`Reading from KV namespace: ${namespaceId}`);

  try {
    // Read the key
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/library-snapshot`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`KV read failed: ${response.status} ${response.statusText}\n${text}`);
    }

    const text = await response.text();
    const snapshot = JSON.parse(text) as LibrarySnapshot;

    console.log(`✅ Successfully read from KV:`);
    console.log(`   Albums: ${snapshot.albumCount}`);
    console.log(`   Tracks: ${snapshot.trackCount}`);
    console.log(`   Generated at: ${snapshot.generatedAt}`);
    console.log(`\n   First few albums:`);
    snapshot.albums.slice(0, 5).forEach((album, i) => {
      console.log(`   ${i + 1}. ${album.title} (${album.tracks.length} tracks)`);
    });
  } catch (error) {
    console.error('❌ Failed to read from KV:', error);
    process.exit(1);
  }
}

verifyKV().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});








