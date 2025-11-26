# How to Get Your Refresh Token from GitHub

## Option 1: View in GitHub UI (Easiest)

1. Go to: https://github.com/kimbersykes87-source/ZappaVault/settings/secrets/actions
2. Look for the secret named `DROPBOX_REFRESH_TOKEN`
3. Click the **eye icon** 👁️ to reveal the value
4. Copy the entire token (it should be 100+ characters long)
5. Add it to your local `.env` file:
   ```
   DROPBOX_REFRESH_TOKEN=your_token_here
   ```

## Option 2: From Cloudflare Pages

1. Go to your Cloudflare Pages dashboard
2. Select your project
3. Go to **Settings** → **Environment variables**
4. Look for `DROPBOX_REFRESH_TOKEN`
5. Click to view/copy the value
6. Add it to your local `.env` file

## Option 3: Check Recent Workflow Logs

If the token is working in GitHub Actions, you can verify it exists by checking a recent successful workflow run - the token won't be visible in logs, but if the workflow succeeded, the token is valid.

## After Adding to .env

Once you've added `DROPBOX_REFRESH_TOKEN` to `webapp/.env`, run:
```powershell
cd webapp
npm run sync:dropbox
```

The script will automatically use the refresh token to get a fresh access token.

