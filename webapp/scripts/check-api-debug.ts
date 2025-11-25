// Check API response for debug information
const albumId = 'c-users-kimbe-dropbox-apps-zappavault-zappalibrary-apostrophe-march-1974';

async function checkDebug() {
  console.log('🔍 Checking API response for debug info...\n');
  
  try {
    const response = await fetch(`https://zappavault.pages.dev/api/albums/${albumId}?links=1`);
    const data = await response.json();
    const album = data.album;
    
    console.log(`Album: ${album.title}`);
    console.log(`Tracks: ${album.tracks.length}`);
    
    // Check for debug info
    if ((album as any).__debug) {
      console.log('\n📊 Debug Info:');
      console.log(JSON.stringify((album as any).__debug, null, 2));
    }
    
    // Check for link errors
    if ((album as any).__linkErrors && (album as any).__linkErrors.length > 0) {
      console.log('\n❌ Dropbox API Errors:');
      (album as any).__linkErrors.forEach((error: string, i: number) => {
        console.log(`   ${i + 1}. ${error}`);
      });
    }
    
    const tracksWithLinks = album.tracks.filter((t: any) => t.streamingUrl).length;
    console.log(`\n📈 Links Status:`);
    console.log(`   Tracks with links: ${tracksWithLinks}`);
    console.log(`   Tracks without links: ${album.tracks.length - tracksWithLinks}`);
    
    if (tracksWithLinks === 0) {
      console.log('\n❌ No links generated!');
      console.log('   Possible causes:');
      console.log('   1. DROPBOX_TOKEN not set in Cloudflare Pages environment variables');
      console.log('   2. Token lacks required permissions (sharing.write, files.content.read)');
      console.log('   3. File paths are incorrect');
      console.log('   4. Dropbox API is returning errors');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkDebug();

