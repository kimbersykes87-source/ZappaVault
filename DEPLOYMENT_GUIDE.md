# Cloudflare Pages Deployment Guide

## ✅ Build Status
The application has been successfully built! The production files are in `webapp/dist/`.

## Deployment Options

### Option 1: Deploy via Cloudflare Dashboard (Recommended)

1. **Go to Cloudflare Dashboard**
   - Visit: https://dash.cloudflare.com/
   - Navigate to: **Workers & Pages** → **Pages** → **Create a project**

2. **Connect Repository** (if using Git)
   - Connect your GitHub/GitLab repository
   - Or choose "Upload assets" for manual deployment

3. **Build Configuration**
   - **Framework preset**: None (or Vite if available)
   - **Build command**: `cd webapp && npm install && npm run build:skip-check`
   - **Build output directory**: `webapp/dist`
   - **Root directory**: (leave empty)

4. **Environment Variables** (in Settings → Environment variables)
   Add these variables for **Production**:
   - `DROPBOX_TOKEN` - Your Dropbox API access token
   - `ADMIN_TOKEN` - A secret token for admin operations (generate a random string)
   - `DROPBOX_LIBRARY_PATH` - Path to your Dropbox library (e.g., `/ZappaLibrary`)

5. **KV Namespace** (Optional but recommended)
   - In **Settings** → **Functions** → **KV Namespace Bindings**
   - Create a KV namespace and bind it as `LIBRARY_KV`
   - This caches your library snapshot for faster access

6. **Functions**
   - The `functions/` directory at the project root will be automatically detected
   - Cloudflare Pages will automatically deploy these as serverless functions

7. **Deploy**
   - Click "Save and Deploy"
   - Your site will be available at: `https://frank-zappa-vault.pages.dev` (or your custom domain)

### Option 2: Deploy via Wrangler CLI

1. **Get Cloudflare API Token**
   - Go to: https://dash.cloudflare.com/profile/api-tokens
   - Click "Create Token"
   - Use "Edit Cloudflare Workers" template
   - Grant permissions for Pages
   - Copy the token

2. **Set Environment Variable**
   ```powershell
   $env:CLOUDFLARE_API_TOKEN = "your-token-here"
   ```

3. **Deploy**
   ```powershell
   npx wrangler pages deploy webapp/dist --project-name=frank-zappa-vault
   ```

4. **Set Environment Variables in Dashboard**
   - After first deployment, go to your Pages project settings
   - Add environment variables as described in Option 1

### Option 3: Manual Upload

1. **Zip the dist folder**
   - Create a zip file of `webapp/dist/` contents

2. **Upload via Dashboard**
   - Go to Pages → Create project → Upload assets
   - Upload the zip file

3. **Configure Functions**
   - You'll need to manually configure the functions directory
   - Or use Git integration for automatic deployments

## Post-Deployment Configuration

### 1. Upload Library Data
After deployment, you need to populate the library:

```bash
cd webapp
npm run sync:dropbox
npm run upload:library
```

This requires:
- `VITE_API_BASE` set to your Cloudflare Pages URL
- `ADMIN_TOKEN` matching the one in Cloudflare Pages environment variables

### 2. Test the Application
- Visit your Pages URL
- Check that `/api/library` returns JSON (not HTML)
- Verify Dropbox file access is working

### 3. Monitor
- Check Cloudflare Pages logs for any errors
- Verify environment variables are set correctly
- Test the Dropbox API token has proper permissions

## Troubleshooting

### API Returns HTML Instead of JSON
- Check that `functions/` directory is at the project root
- Verify environment variables are set
- Check Cloudflare Pages Functions logs

### Dropbox Access Issues
- Verify `DROPBOX_TOKEN` is correct
- Check token has access to the library path
- Verify `DROPBOX_LIBRARY_PATH` is set correctly

### Build Failures
- Ensure Node.js version is compatible (18+)
- Check that all dependencies are in `package.json`
- Review build logs in Cloudflare dashboard

## Current Build Output
- ✅ Frontend built successfully: `webapp/dist/`
- ✅ Functions ready: `functions/`
- ⚠️ Need to deploy and configure environment variables


