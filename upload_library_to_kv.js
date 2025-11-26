#!/usr/bin/env node
/**
 * Upload library.generated.json to Cloudflare KV
 * This script is used after durations are merged into the library file
 */
import { readFile } from 'node:fs/promises';
import process from 'node:process';

const accountId = process.env.CF_ACCOUNT_ID;
const namespaceId = process.env.CF_KV_NAMESPACE_ID;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const libraryPath = process.argv[2] || 'webapp/data/library.generated.json';

if (!accountId || !namespaceId || !apiToken) {
  console.warn('⚠️  Cloudflare KV credentials not provided. Skipping KV upload.');
  console.warn('   Set CF_ACCOUNT_ID, CF_KV_NAMESPACE_ID, and CLOUDFLARE_API_TOKEN to enable.');
  process.exit(0);
}

async function uploadToKV() {
  try {
    console.log(`📤 Reading library file: ${libraryPath}`);
    const libraryContent = await readFile(libraryPath, 'utf-8');
    const library = JSON.parse(libraryContent);
    
    console.log(`📤 Uploading library snapshot to Cloudflare KV...`);
    console.log(`   Albums: ${library.albumCount}, Tracks: ${library.trackCount}`);
    
    // Count tracks with durations
    const tracksWithDurations = library.albums.reduce((sum, album) => 
      sum + album.tracks.filter(t => t.durationMs > 0).length, 0
    );
    console.log(`   Tracks with durations: ${tracksWithDurations}/${library.trackCount}`);
    
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/bulk`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          {
            key: 'library-snapshot',
            value: libraryContent,
          },
        ]),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Cloudflare KV upload failed:');
      console.error(`   Status: ${response.status} ${response.statusText}`);
      console.error(`   Error: ${errorText.substring(0, 500)}`);
      throw new Error(`Cloudflare KV bulk write failed: ${response.status} ${errorText}`);
    }

    console.log('✅ Cloudflare KV updated successfully with library (including durations)!');
  } catch (error) {
    console.error('❌ Error uploading to Cloudflare KV:', error);
    throw error;
  }
}

uploadToKV().catch((error) => {
  console.error('❌ Cloudflare KV update failed:', error);
  process.exit(1);
});

