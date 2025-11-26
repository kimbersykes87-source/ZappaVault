# Dropbox Token Setup Guide

## Problem
If you see this error in the sync workflow:
```
Error: Dropbox error (files/list_folder): {"error":{".tag":"expired_access_token"},"error_summary":"expired_access_token/"}
```

Your Dropbox access token has expired. Dropbox now uses short-lived access tokens that expire after approximately 4 hours.

## Solution: Use Refresh Tokens (Recommended)

The app now supports automatic token refresh using refresh tokens. This eliminates the need to manually regenerate tokens every few hours.

### Step 1: Get Your App Credentials

1. Go to [Dropbox App Console](https://www.dropbox.com/developers/apps)
2. Select your app (or create a new one)
3. Note your **App key** (e.g., `xuy9c57kmvekqvv`)
4. Click **"Show"** next to **App secret** and copy it

### Step 2: Configure Redirect URI (If Possible)

**Note:** If you're experiencing network errors when trying to add a redirect URI, you can skip this step and use the helper script method below.

1. In your Dropbox app, scroll down to **"OAuth 2"** section
2. Under **"Redirect URIs"**, add: `http://localhost:8080/callback`
3. Click **"Add"** to save the redirect URI

**If you can't add the redirect URI due to network errors:**
- Try a different browser or incognito mode
- Disable browser extensions
- Check your DNS settings (try using Google DNS: 8.8.8.8)
- Try again later if Dropbox is having issues
- Or use the helper script method below which may work without configuring the redirect URI first

### Step 3: Get a Refresh Token

**Option A: Using the Helper Script (Easier)**

1. Run the helper script:
   ```bash
   cd webapp
   npm run get:refresh-token YOUR_APP_KEY YOUR_APP_SECRET
   ```
   Or set environment variables:
   ```bash
   DROPBOX_APP_KEY=your_key DROPBOX_APP_SECRET=your_secret npm run get:refresh-token
   ```

2. The script will display an authorization URL - open it in your browser
3. After authorizing, copy the `code` from the redirect URL
4. Paste the code into the script and press Enter
5. The script will output your refresh token and credentials

**Option B: Manual Method**

1. Generate an authorization URL:
   ```
   https://www.dropbox.com/oauth2/authorize?client_id=YOUR_APP_KEY&response_type=code&token_access_type=offline&redirect_uri=http://localhost:8080/callback
   ```
   Replace `YOUR_APP_KEY` with your actual App key (e.g., `xuy9c57kmvekqvv`)

2. Open this URL in your browser and authorize the app
3. You'll be redirected to `http://localhost:8080/callback?code=YOUR_AUTHORIZATION_CODE`
   - The page may show an error (that's okay)
   - Copy the `code` value from the URL (everything after `code=` and before any `&` or `#`)

4. Exchange the code for tokens using curl:
   ```bash
   curl https://api.dropbox.com/oauth2/token \
     -d code=YOUR_AUTHORIZATION_CODE \
     -d grant_type=authorization_code \
     -d redirect_uri=http://localhost:8080/callback \
     -u YOUR_APP_KEY:YOUR_APP_SECRET
   ```
   Replace:
   - `YOUR_AUTHORIZATION_CODE` with the code from step 3
   - `http://localhost:8080/callback` with your redirect URI
   - `YOUR_APP_KEY` and `YOUR_APP_SECRET` with your app credentials

6. The response will include:
   ```json
   {
     "access_token": "short-lived-token",
     "token_type": "bearer",
     "expires_in": 14400,
     "refresh_token": "long-lived-refresh-token",
     "scope": "..."
   }
   ```

7. **Save the refresh token** - you'll need it for the next step. The `refresh_token` is the long-lived token that doesn't expire.

### Step 4: Configure Secrets

Add these secrets to both **GitHub Actions** and **Cloudflare Pages**:

#### GitHub Actions Secrets
1. Go to your repository: `https://github.com/kimbersykes87-source/ZappaVault`
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Add/Update these secrets:
   - `DROPBOX_REFRESH_TOKEN` - The refresh token from Step 1
   - `DROPBOX_APP_KEY` - Your App key
   - `DROPBOX_APP_SECRET` - Your App secret
   - `DROPBOX_TOKEN` - (Optional) You can leave this empty if using refresh tokens

#### Cloudflare Pages Environment Variables
1. Go to your Cloudflare Pages project
2. Click **Settings** → **Environment variables**
3. Add/Update these variables:
   - `DROPBOX_REFRESH_TOKEN` - The refresh token from Step 1
   - `DROPBOX_APP_KEY` - Your App key
   - `DROPBOX_APP_SECRET` - Your App secret
   - `DROPBOX_TOKEN` - (Optional) You can leave this empty if using refresh tokens

### Step 5: Verify Required Permissions

**CRITICAL**: Make sure your Dropbox app has ALL of these permissions enabled:

- ✅ `files.content.read` - Read files (required for streaming)
- ✅ `files.metadata.read` - Read file metadata (required for library sync)
- ✅ `files.content.write` - Write files (if needed)
- ✅ `files.metadata.write` - Write metadata (if needed)
- ✅ `sharing.read` - **REQUIRED** - Read shared links (for cover art and existing links)
- ✅ `sharing.write` - **REQUIRED** - Create shared links (for streaming and cover art)

**⚠️ Without `sharing.read`, cover art will NOT load!**

The app needs `sharing.read` to:
- List existing shared links before creating new ones
- Find cover art images that already have shared links
- Avoid creating duplicate links

Without `sharing.write`, the app cannot:
- Create new shared links for streaming
- Generate cover art URLs

### Step 6: Test the Sync

1. Go to **Actions** tab in your GitHub repository
2. Click **"sync-dropbox"** workflow
3. Click **"Run workflow"** → **"Run workflow"**
4. Check the logs to verify it works

The app will automatically refresh the access token when it expires, so you won't need to manually update tokens anymore.

## Alternative: Manual Token Refresh (Not Recommended)

If you prefer to manually refresh tokens:

1. Generate a new token at [Dropbox App Console](https://www.dropbox.com/developers/apps)
2. Under **"OAuth 2"** → **"Generated access token"**, click **"Generate"**
3. Update `DROPBOX_TOKEN` in GitHub Actions and Cloudflare Pages
4. **Note**: This token will expire in ~4 hours, so you'll need to repeat this process frequently

## How It Works

- The app checks for `DROPBOX_REFRESH_TOKEN` first
- If a refresh token is available, it automatically refreshes expired access tokens
- If no refresh token is configured, it falls back to `DROPBOX_TOKEN`
- When an access token expires, the app automatically refreshes it and retries the request
- Refresh tokens don't expire, so you only need to set them up once

## Troubleshooting

### Token refresh fails
- Verify `DROPBOX_APP_KEY` and `DROPBOX_APP_SECRET` are correct
- Check that `DROPBOX_REFRESH_TOKEN` is the full token (not truncated)
- Ensure the app has all required permissions

### Still getting expired token errors
- Make sure you've added all three secrets: `DROPBOX_REFRESH_TOKEN`, `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`
- Verify the secrets are set in both GitHub Actions and Cloudflare Pages
- Check the logs for specific error messages
