import 'dotenv/config';

const authCode = process.argv[2];
const appSecret = process.argv[3] || process.env.DROPBOX_APP_SECRET;
const APP_KEY = 'xuy9c57kmvekqvv';
const REDIRECT_URI = 'http://localhost:8080/callback';

if (!authCode) {
  console.error('❌ Missing authorization code');
  console.error('\nUsage: npm run exchange-token YOUR_CODE [APP_SECRET]');
  console.error('   Or set DROPBOX_APP_SECRET in .env file');
  process.exit(1);
}

if (!appSecret) {
  console.error('❌ Missing App Secret');
  console.error('\nUsage: npm run exchange-token YOUR_CODE YOUR_APP_SECRET');
  console.error('   Or set DROPBOX_APP_SECRET in .env file');
  process.exit(1);
}

console.log('🔄 Exchanging authorization code for tokens...\n');

const credentials = Buffer.from(`${APP_KEY}:${appSecret}`).toString('base64');

fetch('https://api.dropbox.com/oauth2/token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': `Basic ${credentials}`,
  },
  body: new URLSearchParams({
    code: authCode,
    grant_type: 'authorization_code',
    redirect_uri: REDIRECT_URI,
  }),
})
  .then(async (response) => {
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to exchange code for tokens:');
      console.error(`   Status: ${response.status}`);
      console.error(`   Error: ${errorText}`);
      process.exit(1);
    }
    return response.json();
  })
  .then((data: {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
  }) => {
    console.log('✅ Successfully obtained tokens!\n');
    console.log('─'.repeat(80));
    console.log('📋 Add these to your secrets:\n');
    console.log(`DROPBOX_REFRESH_TOKEN=${data.refresh_token}`);
    console.log(`DROPBOX_APP_KEY=${APP_KEY}`);
    console.log(`DROPBOX_APP_SECRET=${appSecret}`);
    console.log('─'.repeat(80));
    console.log('\n💡 Next steps:');
    console.log('   1. Add DROPBOX_REFRESH_TOKEN to GitHub Actions secrets');
    console.log('   2. Add DROPBOX_APP_KEY to GitHub Actions secrets');
    console.log('   3. Add DROPBOX_APP_SECRET to GitHub Actions secrets');
    console.log('   4. Add the same variables to Cloudflare Pages environment variables');
  })
  .catch((error) => {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  });

