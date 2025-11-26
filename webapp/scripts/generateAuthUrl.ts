// Simple script to generate the Dropbox OAuth authorization URL
const APP_KEY = 'xuy9c57kmvekqvv';
const REDIRECT_URI = 'http://localhost:8080/callback';

const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${APP_KEY}&response_type=code&token_access_type=offline&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;

console.log('🔐 Dropbox OAuth Authorization URL\n');
console.log('─'.repeat(80));
console.log(authUrl);
console.log('─'.repeat(80));
console.log('\n📋 Instructions:');
console.log('1. Open the URL above in your browser');
console.log('2. Authorize the app');
console.log('3. You\'ll be redirected to: http://localhost:8080/callback?code=YOUR_CODE');
console.log('4. Copy the code from the URL');
console.log('5. Run: npm run exchange-token YOUR_CODE YOUR_APP_SECRET');
console.log('\n💡 To get your App Secret:');
console.log('   - Go to: https://www.dropbox.com/developers/apps/info/xuy9c57kmvekqvv');
console.log('   - Click "Show" next to "App secret"');
console.log('   - Copy the secret value');

