# Dropbox Token Setup Guide

## Problem
If you see this error in the sync workflow:
```
Error: Dropbox error (files/list_folder): {"error":{".tag":"expired_access_token"},"error_summary":"expired_access_token/"}
```

Your Dropbox access token has expired and needs to be regenerated.

## Solution

### Step 1: Generate a New Dropbox Access Token

1. Go to [Dropbox App Console](https://www.dropbox.com/developers/apps)
2. Sign in with your Dropbox account
3. Click **"Create app"** (or select your existing app if you have one)
4. Choose:
   - **Scoped access** (not full Dropbox)
   - **App folder** or **Full Dropbox** (depending on your needs)
5. Name your app (e.g., "ZappaVault Sync")
6. Click **"Create app"**
7. Scroll down to **"OAuth 2"** section
8. Under **"Generated access token"**, click **"Generate"**
9. **Copy the token immediately** - you won't be able to see it again!

### Step 2: Update GitHub Actions Secret

1. Go to your GitHub repository: `https://github.com/kimbersykes87-source/ZappaVault`
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Find the `DROPBOX_TOKEN` secret
4. Click **"Update"** (or **"New repository secret"** if it doesn't exist)
5. Paste your new token
6. Click **"Update secret"**

### Step 3: Verify Required Permissions

Make sure your Dropbox app has these permissions:
- `files.content.read` - Read files
- `files.metadata.read` - Read file metadata
- `sharing.read` - Read shared links
- `sharing.write` - Create shared links

### Step 4: Test the Sync

1. Go to **Actions** tab in your GitHub repository
2. Click **"sync-dropbox"** workflow
3. Click **"Run workflow"** → **"Run workflow"**
4. Check the logs to verify it works

## Token Expiration

Dropbox access tokens can expire. If this happens again:
- Short-lived tokens: Expire after a few hours/days
- Long-lived tokens: Can last indefinitely but may still expire

**Tip**: Consider using a refresh token flow for long-term reliability, or set up alerts to monitor token expiration.

