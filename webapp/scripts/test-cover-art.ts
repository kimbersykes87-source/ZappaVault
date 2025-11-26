import { config } from 'dotenv';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

config();

const DROPBOX_TOKEN = process.env.DROPBOX_TOKEN;

if (!DROPBOX_TOKEN) {
  console.error('DROPBOX_TOKEN not found in environment');
  process.exit(1);
}

async function getPermanentLink(filePath: string): Promise<string | undefined> {
  try {
    // First, try to get existing shared link
    let response = await fetch(
      'https://api.dropboxapi.com/2/sharing/list_shared_links',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${DROPBOX_TOKEN}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ 
          path: filePath,
          direct_only: false 
        }),
      },
    );

    if (response.ok) {
      const listPayload = (await response.json()) as { 
        links: Array<{ url: string }> 
      };
      if (listPayload.links && listPayload.links.length > 0) {
        // Get the shared link
        const sharedUrl = listPayload.links[0].url;
        console.log(`📋 Original shared link: ${sharedUrl}`);
        
        // For scl/fo links, we need to preserve the rlkey parameter and add raw=1
        if (sharedUrl.includes('scl/fo/')) {
          // For scl/fo links, replace dl=0 or dl=1 with raw=1, preserving other params
          const url = new URL(sharedUrl);
          url.searchParams.delete('dl');
          url.searchParams.set('raw', '1');
          const directLink = url.toString();
          console.log(`✅ Using scl/fo format with ?raw=1: ${directLink}`);
          return directLink;
        } else {
          // For regular links, convert to direct download link
          const directLink = convertToDirectLink(sharedUrl);
          console.log(`✅ Converted to direct link: ${directLink}`);
          return directLink;
        }
      }
    }

    // If no existing link, create a new permanent shared link
    response = await fetch(
      'https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${DROPBOX_TOKEN}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ 
          path: filePath,
          settings: {
            requested_visibility: {
              '.tag': 'public'
            }
          }
        }),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Failed to create link: ${response.status} ${errorText}`);
      
      // If it's a 409 conflict, try to get existing link
      if (response.status === 409) {
        const conflictResponse = await fetch(
          'https://api.dropboxapi.com/2/sharing/list_shared_links',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${DROPBOX_TOKEN}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({ 
              path: filePath,
              direct_only: false 
            }),
          },
        );
        if (conflictResponse.ok) {
          const conflictPayload = (await conflictResponse.json()) as { 
            links: Array<{ url: string }> 
          };
          if (conflictPayload.links && conflictPayload.links.length > 0) {
            const sharedUrl = conflictPayload.links[0].url;
            const directLink = convertToDirectLink(sharedUrl);
            console.log(`✅ Retrieved existing link after conflict: ${directLink}`);
            return directLink;
          }
        }
      }
      
      return undefined;
    }

    const payload = (await response.json()) as { url: string };
    const directLink = convertToDirectLink(payload.url);
    console.log(`✅ Created new link: ${directLink}`);
    return directLink;
  } catch (error) {
    console.error(`❌ Error getting permanent link:`, error);
    return undefined;
  }
}

function convertToDirectLink(sharedUrl: string): string {
  // Convert Dropbox shared link to direct download link
  // Handle both formats:
  // - https://www.dropbox.com/s/abc123/file.jpg?dl=0 -> https://dl.dropboxusercontent.com/s/abc123/file.jpg
  // - https://www.dropbox.com/scl/fo/abc123/file.jpg -> https://dl.dropboxusercontent.com/scl/fo/abc123/file.jpg
  
  // First, try to extract the path after dropbox.com
  const match = sharedUrl.match(/dropbox\.com\/([^?]+)/);
  if (match) {
    const path = match[1];
    // Remove ?dl=0 or ?dl=1 if present
    const cleanPath = path.split('?')[0];
    return `https://dl.dropboxusercontent.com/${cleanPath}`;
  }
  
  // Fallback to original logic
  let directUrl = sharedUrl
    .replace(/^https?:\/\/(www\.)?dropbox\.com/, 'https://dl.dropboxusercontent.com')
    .replace(/\?dl=[01]/, '')
    .split('?')[0];
  
  return directUrl;
}

async function main() {
  // Load the library file to get the first album
  // Script runs from webapp directory, so data is in ./data
  const libraryPath = join(process.cwd(), 'data', 'library.generated.json');
  const libraryContent = await readFile(libraryPath, 'utf-8');
  const library = JSON.parse(libraryContent);
  
  // Get first album (sorted by title)
  const firstAlbum = library.albums.sort((a: any, b: any) => 
    a.title.localeCompare(b.title)
  )[0];
  
  console.log(`\n🎵 First Album: ${firstAlbum.title}`);
  console.log(`📁 Cover Path: ${firstAlbum.coverUrl}`);
  console.log(`\n🔄 Converting Dropbox path to HTTP URL...\n`);
  
  if (!firstAlbum.coverUrl) {
    console.error('❌ No cover URL found for this album');
    process.exit(1);
  }
  
  const httpUrl = await getPermanentLink(firstAlbum.coverUrl);
  
  if (httpUrl) {
    console.log(`\n✅ SUCCESS! Cover art HTTP URL:`);
    console.log(`\n${httpUrl}\n`);
    console.log(`📸 You can view this image in your browser or use it in the app.\n`);
    
    // Save to file for easy access
    const output = {
      album: firstAlbum.title,
      dropboxPath: firstAlbum.coverUrl,
      httpUrl: httpUrl,
    };
    
    const fs = await import('node:fs/promises');
    await fs.writeFile(
      join(process.cwd(), 'cover-art-test.json'),
      JSON.stringify(output, null, 2)
    );
    console.log(`💾 Saved to: cover-art-test.json\n`);
  } else {
    console.error('\n❌ Failed to get HTTP URL for cover art');
    process.exit(1);
  }
}

main().catch(console.error);

