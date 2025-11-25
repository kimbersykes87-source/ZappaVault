import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const DROPBOX_TOKEN = process.env.DROPBOX_TOKEN;

if (!DROPBOX_TOKEN) {
  console.error('❌ DROPBOX_TOKEN not found in environment variables');
  console.error('   Make sure you have a .env file with DROPBOX_TOKEN=your_token');
  process.exit(1);
}

console.log('🔑 Token found (length:', DROPBOX_TOKEN.length, 'chars)');
console.log('🔑 Token preview:', DROPBOX_TOKEN.substring(0, 10) + '...');
console.log('');

// Convert Windows path to Dropbox path (same logic as in the API)
function convertToDropboxPath(localPath: string): string {
  if (localPath.startsWith('C:/') || localPath.startsWith('c:/')) {
    const dropboxIndex = localPath.toLowerCase().indexOf('/dropbox/');
    if (dropboxIndex !== -1) {
      const afterDropbox = localPath.substring(dropboxIndex + '/dropbox'.length);
      return afterDropbox.startsWith('/') ? afterDropbox : `/${afterDropbox}`;
    }
  }
  if (localPath.startsWith('/')) {
    return localPath;
  }
  return `/${localPath}`;
}

// Convert shared link to direct download link
function convertToDirectLink(sharedUrl: string): string {
  let directUrl = sharedUrl
    .replace(/^https?:\/\/(www\.)?dropbox\.com/, 'https://dl.dropboxusercontent.com')
    .replace(/\?dl=[01]/, '')
    .split('?')[0];
  
  if (!directUrl.startsWith('https://dl.dropboxusercontent.com')) {
    const match = sharedUrl.match(/dropbox\.com\/([^?]+)/);
    if (match) {
      directUrl = `https://dl.dropboxusercontent.com/${match[1]}`;
    }
  }
  
  return directUrl;
}

async function testListSharedLinks(filePath: string): Promise<void> {
  console.log(`\n📋 Testing list_shared_links for: ${filePath}`);
  
  try {
    const response = await fetch(
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

    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const payload = await response.json() as { links: Array<{ url: string }> };
      if (payload.links && payload.links.length > 0) {
        console.log(`   ✅ Found ${payload.links.length} existing link(s)`);
        const directLink = convertToDirectLink(payload.links[0].url);
        console.log(`   📎 Direct link: ${directLink}`);
        return;
      } else {
        console.log(`   ℹ️  No existing links found`);
      }
    } else {
      const errorText = await response.text();
      console.log(`   ❌ Error: ${errorText}`);
      if (response.status === 401) {
        console.log(`   ⚠️  401 Unauthorized - Token might be invalid or expired`);
      } else if (response.status === 403) {
        console.log(`   ⚠️  403 Forbidden - Token might not have 'sharing.read' permission`);
      } else if (response.status === 409 || response.status === 404) {
        console.log(`   ℹ️  ${response.status} is expected - no link exists yet`);
      }
    }
  } catch (error) {
    console.log(`   ❌ Exception:`, error);
  }
}

async function testCreateSharedLink(filePath: string): Promise<void> {
  console.log(`\n🔗 Testing create_shared_link_with_settings for: ${filePath}`);
  
  try {
    const response = await fetch(
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

    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const payload = await response.json() as { url: string };
      const directLink = convertToDirectLink(payload.url);
      console.log(`   ✅ Successfully created shared link`);
      console.log(`   📎 Shared URL: ${payload.url}`);
      console.log(`   📎 Direct link: ${directLink}`);
    } else {
      const errorText = await response.text();
      console.log(`   ❌ Error: ${errorText}`);
      
      if (response.status === 401) {
        console.log(`   ⚠️  401 Unauthorized - Token might be invalid or expired`);
      } else if (response.status === 403) {
        console.log(`   ⚠️  403 Forbidden - Token might not have 'sharing.write' permission`);
      } else if (response.status === 409) {
        console.log(`   ℹ️  409 Conflict - Link already exists, this is OK`);
        // Try to retrieve it
        await testListSharedLinks(filePath);
      } else if (response.status === 404) {
        console.log(`   ⚠️  404 Not Found - File path might be incorrect`);
      }
    }
  } catch (error) {
    console.log(`   ❌ Exception:`, error);
  }
}

async function testListFolder(folderPath: string): Promise<void> {
  console.log(`\n📁 Testing list_folder for: ${folderPath}`);
  
  try {
    const response = await fetch(
      'https://api.dropboxapi.com/2/files/list_folder',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${DROPBOX_TOKEN}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ path: folderPath }),
      },
    );

    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const payload = await response.json() as {
        entries: Array<{ name: string; '.tag': string }>;
      };
      console.log(`   ✅ Found ${payload.entries.length} items`);
      const files = payload.entries.filter(e => e['.tag'] === 'file');
      const folders = payload.entries.filter(e => e['.tag'] === 'folder');
      console.log(`   📄 Files: ${files.length}`);
      console.log(`   📁 Folders: ${folders.length}`);
      if (files.length > 0) {
        console.log(`   Sample files:`, files.slice(0, 3).map(f => f.name).join(', '));
      }
    } else {
      const errorText = await response.text();
      console.log(`   ❌ Error: ${errorText}`);
      
      if (response.status === 401) {
        console.log(`   ⚠️  401 Unauthorized - Token might be invalid or expired`);
      } else if (response.status === 403) {
        console.log(`   ⚠️  403 Forbidden - Token might not have 'files.metadata.read' permission`);
      } else if (response.status === 404) {
        console.log(`   ⚠️  404 Not Found - Folder path might be incorrect`);
      }
    }
  } catch (error) {
    console.log(`   ❌ Exception:`, error);
  }
}

async function main() {
  console.log('🧪 Dropbox API Link Generation Test');
  console.log('=====================================\n');

  // Load library to get a real album path
  let testFilePath: string | undefined;
  let testFolderPath: string | undefined;
  
  try {
    const snapshotPath = path.resolve(process.cwd(), 'data/library.generated.json');
    const snapshotContent = await readFile(snapshotPath, 'utf-8');
    const snapshot = JSON.parse(snapshotContent);
    
    if (snapshot.albums && snapshot.albums.length > 0) {
      const album = snapshot.albums[0];
      console.log(`📚 Using test album: "${album.title}"`);
      console.log(`   Location: ${album.locationPath}`);
      
      // Convert to Dropbox path
      const dropboxPath = convertToDropboxPath(album.locationPath);
      console.log(`   Dropbox path: ${dropboxPath}`);
      
      // Get first track if available
      if (album.tracks && album.tracks.length > 0) {
        const track = album.tracks[0];
        testFilePath = convertToDropboxPath(track.filePath);
        console.log(`   Test file: ${track.filePath}`);
        console.log(`   Dropbox file path: ${testFilePath}`);
      }
      
      // Use album folder for folder test
      testFolderPath = dropboxPath;
      
      // Try to find cover art folder
      const coverFolderPath = `${dropboxPath}/Cover`;
      console.log(`   Cover folder: ${coverFolderPath}`);
      
      console.log('\n' + '='.repeat(60));
      
      // Test 1: List folder (for cover art)
      await testListFolder(coverFolderPath);
      
      // Test 2: List shared links for a file
      if (testFilePath) {
        await testListSharedLinks(testFilePath);
      }
      
      // Test 3: Create shared link for a file
      if (testFilePath) {
        await testCreateSharedLink(testFilePath);
      }
      
      // Test 4: List shared links for cover art
      // First, try to find a cover image
      await testListFolder(coverFolderPath);
      
    } else {
      console.log('⚠️  No albums found in library snapshot');
      console.log('   Using default test paths...\n');
      
      // Use default paths
      testFolderPath = '/Apps/ZappaVault/ZappaLibrary';
      testFilePath = '/Apps/ZappaVault/ZappaLibrary/Apostrophe (March 1974)/01 - Don\'t Eat the Yellow Snow.mp3';
      
      await testListFolder(testFolderPath);
      if (testFilePath) {
        await testListSharedLinks(testFilePath);
        await testCreateSharedLink(testFilePath);
      }
    }
  } catch (error) {
    console.error('❌ Error loading library:', error);
    console.log('\n   Using default test paths...\n');
    
    testFolderPath = '/Apps/ZappaVault/ZappaLibrary';
    testFilePath = '/Apps/ZappaVault/ZappaLibrary/Apostrophe (March 1974)/01 - Don\'t Eat the Yellow Snow.mp3';
    
    await testListFolder(testFolderPath);
    if (testFilePath) {
      await testListSharedLinks(testFilePath);
      await testCreateSharedLink(testFilePath);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Test complete!');
  console.log('\n📝 Summary:');
  console.log('   - If you see 401 errors: Token is invalid or expired');
  console.log('   - If you see 403 errors: Token lacks required permissions');
  console.log('   - If you see 404 errors: File/folder path is incorrect');
  console.log('   - If you see 409 errors: Link already exists (this is OK)');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

