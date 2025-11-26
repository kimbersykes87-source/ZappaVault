import 'dotenv/config';
import { readFile } from 'node:fs/promises';

const DROPBOX_TOKEN = process.env.DROPBOX_TOKEN;

if (!DROPBOX_TOKEN) {
  console.error('❌ DROPBOX_TOKEN not found in environment variables');
  process.exit(1);
}

// Convert shared link to direct download link
function convertToDirectLink(sharedUrl: string): string {
  try {
    const url = new URL(sharedUrl);
    
    // For new Dropbox format with /scl/, preserve rlkey and set dl=1
    if (url.pathname.includes('/scl/')) {
      url.searchParams.set('dl', '1');
      // Convert domain
      url.hostname = 'dl.dropboxusercontent.com';
      return url.toString();
    }
    
    // Old format: convert dropbox.com to dl.dropboxusercontent.com and set dl=1
    url.hostname = 'dl.dropboxusercontent.com';
    url.searchParams.set('dl', '1');
    return url.toString();
  } catch (error) {
    // Fallback: simple string replacement
    return sharedUrl
      .replace(/^https?:\/\/(www\.)?dropbox\.com/, 'https://dl.dropboxusercontent.com')
      .replace(/[?&]dl=[01]/, '')
      .replace(/\?/, '?')
      .replace(/\?$/, '') + (sharedUrl.includes('?') ? '&' : '?') + 'dl=1';
  }
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
        const sharedUrl = listPayload.links[0].url;
        console.log(`   Original shared URL: ${sharedUrl}`);
        
        // For images, use the raw parameter format which works better
        // Remove existing dl parameter and add raw=1
        const url = new URL(sharedUrl);
        url.searchParams.delete('dl');
        url.searchParams.set('raw', '1');
        const rawLink = url.toString();
        console.log(`   Raw parameter link: ${rawLink}`);
        
        // Also try the direct link format
        const directLink = convertToDirectLink(sharedUrl);
        console.log(`   Converted direct link: ${directLink}`);
        
        // Return the raw link as it's more reliable for images
        return rawLink;
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
      if (response.status === 409) {
        // Link already exists, try to get it
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
            console.log(`✅ Retrieved existing link after conflict`);
            return directLink;
          }
        }
      }
      console.error(`❌ Failed to create link: ${response.status} ${errorText}`);
      return undefined;
    }

    const payload = (await response.json()) as { url: string };
    const directLink = convertToDirectLink(payload.url);
    console.log(`✅ Created new permanent link`);
    return directLink;
  } catch (error) {
    console.error(`❌ Error:`, error);
    return undefined;
  }
}

async function main() {
  // Load the library file
  const libraryPath = 'data/library.generated.json';
  const libraryContent = await readFile(libraryPath, 'utf-8');
  const library = JSON.parse(libraryContent);
  
  // Get the first album (sorted by title)
  const firstAlbum = library.albums.sort((a: any, b: any) => 
    a.title.localeCompare(b.title)
  )[0];
  
  console.log('🎵 First Album:');
  console.log(`   Title: ${firstAlbum.title}`);
  console.log(`   Cover Path: ${firstAlbum.coverUrl}`);
  console.log('');
  
  if (!firstAlbum.coverUrl) {
    console.error('❌ No cover URL found for this album');
    process.exit(1);
  }
  
  console.log('🔗 Getting permanent link for cover art...');
  const coverUrl = await getPermanentLink(firstAlbum.coverUrl);
  
  if (coverUrl) {
    console.log('');
    console.log('✅ Cover Art URL:');
    console.log(`   ${coverUrl}`);
    
    // Also try getting the raw shared link
    const response = await fetch(
      'https://api.dropboxapi.com/2/sharing/list_shared_links',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${DROPBOX_TOKEN}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ 
          path: firstAlbum.coverUrl,
          direct_only: false 
        }),
      },
    );
    
    if (response.ok) {
      const listPayload = (await response.json()) as { 
        links: Array<{ url: string }> 
      };
      if (listPayload.links && listPayload.links.length > 0) {
        const sharedUrl = listPayload.links[0].url;
        const rawLink = sharedUrl.replace(/\?dl=[01]/, '') + '?raw=1';
        console.log('');
        console.log('🖼️  Alternative URLs to try:');
        console.log(`   Direct link: ${coverUrl}`);
        console.log(`   Raw parameter: ${rawLink}`);
        console.log(`   Original shared: ${sharedUrl}`);
        console.log('');
        console.log('📋 HTML to display (try both):');
        console.log(`   <img src="${coverUrl}" alt="${firstAlbum.title}" />`);
        console.log(`   <img src="${rawLink}" alt="${firstAlbum.title}" />`);
      }
    }
  } else {
    console.error('❌ Failed to get cover art URL');
    process.exit(1);
  }
}

main().catch(console.error);
