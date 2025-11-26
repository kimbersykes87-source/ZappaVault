import 'dotenv/config';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try to load .env file from multiple possible locations
const possibleEnvPaths = [
  join(__dirname, '../../.env'),
  join(__dirname, '../.env'),
  resolve('.env'),
  resolve('webapp/.env'),
];

for (const envPath of possibleEnvPaths) {
  if (existsSync(envPath)) {
    try {
      const envContent = readFileSync(envPath, 'utf-8');
      envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const match = trimmed.match(/^([^#=]+)=(.*)$/);
          if (match) {
            const key = match[1].trim();
            const value = match[2].trim().replace(/^["']|["']$/g, '');
            if (!process.env[key]) {
              process.env[key] = value;
            }
          }
        }
      });
      console.log(`📁 Loaded .env from: ${envPath}\n`);
      break;
    } catch {
      // Continue to next path
    }
  }
}

const APP_KEY = process.env.DROPBOX_APP_KEY || process.argv[2];
const APP_SECRET = process.env.DROPBOX_APP_SECRET || process.argv[3];
const REDIRECT_URI = 'http://localhost:8080/callback';

if (!APP_KEY || !APP_SECRET) {
  console.error('❌ Missing required parameters');
  console.error('\nUsage:');
  console.error('  tsx scripts/getDropboxRefreshToken.ts <APP_KEY> <APP_SECRET>');
  console.error('\nOr set environment variables:');
  console.error('  DROPBOX_APP_KEY=your_key');
  console.error('  DROPBOX_APP_SECRET=your_secret');
  console.error('\nOr add them to .env file:');
  console.error('  DROPBOX_APP_KEY=your_key');
  console.error('  DROPBOX_APP_SECRET=your_secret');
  process.exit(1);
}

console.log('🔐 Dropbox Refresh Token Generator\n');
console.log('Step 1: Open this URL in your browser:');
console.log('─'.repeat(80));
const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${APP_KEY}&response_type=code&token_access_type=offline&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
console.log(authUrl);
console.log('─'.repeat(80));
console.log('\nStep 2: After authorizing, you\'ll be redirected to a URL like:');
console.log(`   ${REDIRECT_URI}?code=YOUR_CODE_HERE`);
console.log('\nStep 3: Copy the code from the URL and paste it below, then press Enter.\n');
console.log('Waiting for authorization code...');

// Read from stdin
process.stdin.setEncoding('utf8');
process.stdin.once('data', async (code: string) => {
  const authCode = code.trim();
  
  if (!authCode) {
    console.error('❌ No authorization code provided');
    process.exit(1);
  }

  console.log('\n🔄 Exchanging authorization code for tokens...\n');

  try {
    const credentials = Buffer.from(`${APP_KEY}:${APP_SECRET}`).toString('base64');
    const response = await fetch('https://api.dropbox.com/oauth2/token', {
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
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Failed to exchange code for tokens:');
      console.error(`   Status: ${response.status}`);
      console.error(`   Error: ${errorText}`);
      process.exit(1);
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token: string;
      token_type: string;
      expires_in: number;
      scope: string;
    };

    console.log('✅ Successfully obtained tokens!\n');
    console.log('─'.repeat(80));
    console.log('📋 Add these to your secrets:\n');
    console.log(`DROPBOX_REFRESH_TOKEN=${data.refresh_token}`);
    console.log(`DROPBOX_APP_KEY=${APP_KEY}`);
    console.log(`DROPBOX_APP_SECRET=${APP_SECRET}`);
    console.log('─'.repeat(80));
    console.log('\n💡 Next steps:');
    console.log('   1. Add DROPBOX_REFRESH_TOKEN to GitHub Actions secrets');
    console.log('   2. Add DROPBOX_APP_KEY to GitHub Actions secrets');
    console.log('   3. Add DROPBOX_APP_SECRET to GitHub Actions secrets');
    console.log('   4. Add the same variables to Cloudflare Pages environment variables');
    console.log('\n⚠️  Note: You may need to add this redirect URI to your Dropbox app:');
    console.log(`   ${REDIRECT_URI}`);
    console.log('\n   If you can\'t add it due to network issues, try:');
    console.log('   - Using a different browser');
    console.log('   - Disabling browser extensions');
    console.log('   - Checking your network/DNS settings');
    console.log('   - Trying again later if Dropbox is having issues');
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
});

