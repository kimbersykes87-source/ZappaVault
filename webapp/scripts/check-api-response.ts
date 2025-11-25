// Quick script to check what the API is actually returning
const albumId = 'c-users-kimbe-dropbox-apps-zappavault-zappalibrary-apostrophe-march-1974';

async function checkAPI() {
  console.log('🔍 Checking API response...\n');
  console.log(`URL: https://zappavault.pages.dev/api/albums/${albumId}?links=1\n`);
  
  try {
    const response = await fetch(`https://zappavault.pages.dev/api/albums/${albumId}?links=1`);
    console.log(`Status: ${response.status} ${response.statusText}\n`);
    
    const data = await response.json();
    const album = data.album;
    
    console.log(`Album: ${album.title}`);
    console.log(`Cover URL: ${album.coverUrl || 'MISSING'}\n`);
    
    console.log(`Tracks: ${album.tracks.length}`);
    console.log('\nFirst 3 tracks:');
    album.tracks.slice(0, 3).forEach((track: any, i: number) => {
      console.log(`\n${i + 1}. ${track.title}`);
      console.log(`   Streaming URL: ${track.streamingUrl || 'MISSING'}`);
      console.log(`   Download URL: ${track.downloadUrl || 'MISSING'}`);
    });
    
    const tracksWithLinks = album.tracks.filter((t: any) => t.streamingUrl).length;
    const tracksWithoutLinks = album.tracks.length - tracksWithLinks;
    
    console.log(`\n📊 Summary:`);
    console.log(`   Tracks with links: ${tracksWithLinks}`);
    console.log(`   Tracks without links: ${tracksWithoutLinks}`);
    console.log(`   Cover art: ${album.coverUrl ? '✅' : '❌'}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAPI();


