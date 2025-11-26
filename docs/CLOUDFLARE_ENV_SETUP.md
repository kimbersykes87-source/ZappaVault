# Cloudflare Pages Environment Variables Setup

This guide will help you verify and configure the required environment variables in Cloudflare Pages for streaming to work.

## Required Environment Variables

For streaming links to work, you need to configure these environment variables in Cloudflare Pages:

### Option 1: Refresh Token (Recommended)
- `DROPBOX_REFRESH_TOKEN` - Your Dropbox OAuth refresh token
- `DROPBOX_APP_KEY` - Your Dropbox app key
- `DROPBOX_APP_SECRET` - Your Dropbox app secret

### Option 2: Direct Token (Fallback)
- `DROPBOX_TOKEN` - A Dropbox access token (expires every 3-4 hours)

**Note:** Option 1 (refresh token) is recommended because it automatically refreshes expired tokens. Option 2 requires manual token updates.

## How to Add Environment Variables in Cloudflare Pages

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. Navigate to **Workers & Pages** → **ZappaVault** (or your project name)
3. Click on **Settings** tab
4. Scroll down to **Environment Variables** section
5. Click **Add variable** for each required variable:
   - Variable name: `DROPBOX_REFRESH_TOKEN`
   - Value: (paste your refresh token)
   - Environment: Select **Production** (and **Preview** if you want)
6. Repeat for `DROPBOX_APP_KEY` and `DROPBOX_APP_SECRET`
7. Click **Save** after adding all variables

## Verification Steps

### Step 1: Check Environment Variables are Set

After adding the variables, trigger a new deployment:
- Go to **Deployments** tab
- Click **Retry deployment** on the latest deployment, OR
- Push a new commit to trigger automatic deployment

### Step 2: Test the API Endpoint

Once deployed, test if streaming links are being generated:

1. Open your browser's Developer Console (F12)
2. Navigate to: `https://zappavault.pages.dev`
3. Open the **Network** tab
4. Click on any album to view it
5. Look for a request to `/api/albums/[album-id]?links=1`
6. Check the response - it should include `streamingUrl` for each track

### Step 3: Check Browser Console for Errors

If streaming still doesn't work, check the browser console for:
- `[LINK DEBUG]` messages - these show what's happening during link generation
- `[ERROR]` messages - these indicate what went wrong
- `No Dropbox token available` - means environment variables are missing

### Step 4: Check Cloudflare Functions Logs

1. Go to Cloudflare Dashboard → **Workers & Pages** → **ZappaVault**
2. Click on **Logs** tab (or **Real-time Logs**)
3. Look for log entries when you access an album page
4. Check for:
   - `[LINK DEBUG]` messages showing link generation
   - `[ERROR]` messages indicating problems
   - Token refresh messages

## Troubleshooting

### "Streaming links are not available for this album yet"

This means the API is not generating streaming URLs. Common causes:

1. **Environment variables not set:**
   - Check Cloudflare Pages → Settings → Environment Variables
   - Ensure all three refresh token variables are set for **Production** environment

2. **Variables not deployed:**
   - After adding variables, you need to trigger a new deployment
   - Go to Deployments → Retry deployment

3. **Token refresh failing:**
   - Check Cloudflare Functions logs for token refresh errors
   - Verify your `DROPBOX_REFRESH_TOKEN`, `DROPBOX_APP_KEY`, and `DROPBOX_APP_SECRET` are correct
   - You can test them locally using: `npm run get:refresh-token` (in webapp directory)

4. **API endpoint not working:**
   - Test the API directly: `https://zappavault.pages.dev/api/albums/[album-id]?links=1`
   - Should return JSON with `streamingUrl` for each track

### "No Dropbox token available"

This error means:
- None of the required environment variables are set
- Or the refresh token mechanism is failing
- Check Cloudflare Pages environment variables are configured correctly

### Token Refresh Errors

If you see token refresh errors in the logs:
1. Verify your `DROPBOX_REFRESH_TOKEN` is still valid (they don't expire, but can be revoked)
2. Check `DROPBOX_APP_KEY` and `DROPBOX_APP_SECRET` match your Dropbox app
3. Test locally: `cd webapp && npm run get:refresh-token`

## Quick Test Script

You can test if your environment variables are working by:

1. Opening browser console on `https://zappavault.pages.dev`
2. Running this JavaScript:
   ```javascript
   fetch('/api/albums/apps-zappavault-zappalibrary-absolutely-free?links=1')
     .then(r => r.json())
     .then(data => {
       const tracksWithLinks = data.album.tracks.filter(t => t.streamingUrl).length;
       console.log(`✅ ${tracksWithLinks}/${data.album.tracks.length} tracks have streaming URLs`);
       if (tracksWithLinks === 0) {
         console.error('❌ No streaming URLs generated - check environment variables');
       }
     });
   ```

## Next Steps

After verifying environment variables are set:
1. Wait for the deployment to complete (usually 1-2 minutes)
2. Refresh the page and try playing an album
3. Check browser console for any errors
4. If still not working, check Cloudflare Functions logs


