# Linking Frontend with Full Library

## Overview

The frontend is already configured to connect to the backend API endpoints. The connection happens automatically when you run the dev server. However, the backend needs to have the full library data loaded.

## Current Setup

✅ **Frontend is already connected:**
- `webapp/src/lib/api.ts` - Contains `fetchLibrary()` that calls `/api/library`
- `webapp/src/hooks/useLibraryQuery.ts` - React hook that fetches library data
- `webapp/src/pages/LibraryPage.tsx` - Displays albums from the API

✅ **Backend API endpoints:**
- `GET /api/library` - Returns library data (currently falls back to sample if KV is empty)
- `POST /api/refresh` - Uploads library snapshot to KV

## Loading the Full Library

You have **98 albums** in `webapp/data/library.generated.json`. To make them available to the frontend:

### Option 1: Upload to Backend API (Recommended for Development)

1. **Set up environment variables** in `webapp/.env`:
   ```env
   ADMIN_TOKEN=your-admin-token-here
   VITE_API_BASE=http://localhost:8788  # or your Cloudflare Pages URL
   ```

2. **Start your backend** (if running locally with Wrangler):
   ```bash
   npx wrangler pages dev ./webapp/dist --functions ./functions
   ```

3. **Upload the library**:
   ```bash
   cd webapp
   npm run upload:library
   ```

   This will:
   - Read `data/library.generated.json`
   - POST it to `/api/refresh` endpoint
   - Store it in Cloudflare KV (or local KV if using Wrangler)

### Option 2: Direct KV Upload (For Production)

If you have Cloudflare credentials set up, the `sync:dropbox` script automatically uploads to KV:

```bash
cd webapp
npm run sync:dropbox
```

This requires:
- `CF_ACCOUNT_ID`
- `CF_KV_NAMESPACE_ID`
- `CLOUDFLARE_API_TOKEN`

### Option 3: Manual Upload via API

You can also manually upload the library using curl or any HTTP client:

```bash
curl -X POST http://localhost:8788/api/refresh \
  -H "Content-Type: application/json" \
  -H "x-admin-token: your-admin-token" \
  -d @data/library.generated.json
```

## Verifying the Connection

1. **Start the frontend dev server**:
   ```bash
   cd webapp
   npm run dev
   ```

2. **Check the browser console** - You should see:
   - Network requests to `/api/library`
   - Library data loading successfully
   - Album count showing **98 albums** (not 2 from sample)

3. **Test the API directly**:
   ```bash
   curl http://localhost:8788/api/library
   ```

   Should return JSON with `albumCount: 98` (or whatever is in your library)

## Troubleshooting

### Frontend shows only 2 albums (sample data)

**Problem:** Backend is falling back to sample library because KV is empty.

**Solution:**
1. Upload the library using `npm run upload:library`
2. Or ensure KV is properly configured and populated

### API returns 401 Unauthorized

**Problem:** `ADMIN_TOKEN` is required for `/api/refresh` endpoint.

**Solution:**
1. Set `ADMIN_TOKEN` in your `.env` file
2. Or set it as an environment variable when running the upload script

### API endpoint not found

**Problem:** Backend functions aren't running or not accessible.

**Solution:**
1. For local dev: Use Wrangler to run Pages Functions locally
2. For production: Ensure Cloudflare Pages is deployed with Functions enabled
3. Check that `VITE_API_BASE` is set correctly in your `.env`

## Development Workflow

1. **Generate/update library**:
   ```bash
   npm run sync:dropbox
   ```

2. **Upload to backend**:
   ```bash
   npm run upload:library
   ```

3. **Start frontend**:
   ```bash
   npm run dev
   ```

4. **View in browser** - Should see all 98 albums!

## Production Deployment

For production on Cloudflare Pages:

1. The library is automatically uploaded to KV via GitHub Actions (see `.github/workflows/sync-dropbox.yml`)
2. Or manually upload after deployment using the upload script pointing to your production URL:
   ```bash
   VITE_API_BASE=https://your-site.pages.dev npm run upload:library
   ```

## Notes

- The frontend automatically calls `/api/library` on page load
- The API caches responses for 60 seconds (see `cache-control` headers)
- Library data is stored in Cloudflare KV with a 24-hour TTL
- The backend falls back to sample data if KV is empty (for development/testing)


