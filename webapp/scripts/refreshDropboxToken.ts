import 'dotenv/config';

/**
 * Refresh a Dropbox access token using a refresh token
 */
export async function refreshAccessToken(): Promise<string> {
  const DROPBOX_APP_KEY = process.env.DROPBOX_APP_KEY;
  const DROPBOX_APP_SECRET = process.env.DROPBOX_APP_SECRET;
  const DROPBOX_REFRESH_TOKEN = process.env.DROPBOX_REFRESH_TOKEN;

  if (!DROPBOX_APP_KEY || !DROPBOX_APP_SECRET || !DROPBOX_REFRESH_TOKEN) {
    const missing = [];
    if (!DROPBOX_APP_KEY) missing.push('DROPBOX_APP_KEY');
    if (!DROPBOX_APP_SECRET) missing.push('DROPBOX_APP_SECRET');
    if (!DROPBOX_REFRESH_TOKEN) missing.push('DROPBOX_REFRESH_TOKEN');
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const credentials = Buffer.from(`${DROPBOX_APP_KEY}:${DROPBOX_APP_SECRET}`).toString('base64');
  
  const response = await fetch('https://api.dropbox.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: DROPBOX_REFRESH_TOKEN,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
  }

  const data = await response.json() as { access_token: string };
  return data.access_token;
}

// If run directly, refresh and output the new token
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('refreshDropboxToken.ts')) {
  refreshAccessToken()
    .then(token => {
      console.log('✅ Successfully refreshed access token');
      console.log('\nNew access token:', token);
      console.log('\n💡 Update your DROPBOX_TOKEN with this value in:');
      console.log('   - GitHub Actions secrets');
      console.log('   - Cloudflare Pages environment variables');
    })
    .catch(error => {
      console.error('❌ Failed to refresh token:', error);
      process.exit(1);
    });
}

