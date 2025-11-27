# Frank Zappa Vault

A Cloudflare Pages application that indexes a Dropbox-hosted Frank Zappa collection, provides search/filter tooling, streams audio via temporary links, and exposes full-album downloads for family playback.

## 🎯 Project Status

**Current Status:** ✅ Production Ready
- **Total Albums:** 98
- **Total Tracks:** 1,838
- **Metadata Completion:** 100% (era, genre, description, tags, cover art, track durations)
- **Deployment:** Live at https://zappavault.pages.dev
- **Auto-Deployment:** Configured via GitHub Actions

## 🛠️ Tech Stack

- **Frontend:** Vite + React 19 + TypeScript
- **Backend:** Cloudflare Pages Functions (serverless API)
- **Storage:** Dropbox API for file hosting + Cloudflare KV for library caching
- **Testing:** Vitest (unit tests for backend functions)
- **Deployment:** Cloudflare Pages with automatic GitHub Actions deployment
- **Viewing:** Site is viewed via Chromium on Cloudflare Pages (https://zappavault.pages.dev)

## 🚀 Quick Start

### Viewing the Site

The site is deployed and viewable at **https://zappavault.pages.dev** via Chromium on Cloudflare Pages.

All changes are automatically deployed via GitHub Actions when you push to the `master` branch.

### Environment Setup

For library management scripts, create `webapp/.env` file (not checked in):

```env
DROPBOX_TOKEN=your-dropbox-token
DROPBOX_LIBRARY_PATH=/ZappaLibrary
ADMIN_TOKEN=your-admin-token
```

## 📁 Project Structure

```
ZappaVault/
├── functions/              # Cloudflare Pages Functions (API endpoints)
│   ├── api/
│   │   ├── library.ts     # GET /api/library
│   │   ├── refresh.ts     # POST /api/refresh
│   │   └── albums/
│   ├── shared/            # Shared types and query logic
│   └── utils/             # Utility functions
├── shared/                 # Shared TypeScript types (used by functions)
├── webapp/
│   ├── src/               # React frontend
│   ├── functions/         # Test files for backend functions
│   ├── scripts/           # Utility scripts
│   ├── data/              # Generated library snapshot
│   └── dist/              # Build output (deployed to Pages)
└── .github/workflows/      # GitHub Actions CI/CD
```

## 🔄 Deployment

### Automatic Deployment (Recommended)

The project is configured for **automatic deployment to Cloudflare Pages on every commit**:

1. **GitHub Actions** automatically builds and deploys on push to `master`
2. **Cloudflare Pages** is connected to the GitHub repository
3. Every commit triggers a new deployment

**Workflow:** `.github/workflows/ci.yml`
- Runs on every push to `master`
- Lints, type-checks, and builds the project
- Cloudflare Pages automatically deploys the build

### Manual Deployment

If you need to deploy manually:

```bash
cd webapp
npm run build
npx wrangler pages deploy webapp/dist --project-name=zappavault
```

## 📚 API Endpoints

### `GET /api/library`
Search, filter, and paginate albums.

**Query Parameters:**
- `q` - Search query (searches title, subtitle, genre, era, description, tags, tracks)
- `formats` - Filter by audio format (comma-separated: `FLAC,MP3`)
- `era` - Filter by era (`Mothers Of Invention` or `Solo`)
- `year` - Filter by release year
- `sort` - Sort order: `title`, `year`, or `recent`
- `page` - Page number (default: 1)
- `pageSize` - Results per page (default: 24)

**Example:**
```
GET /api/library?q=hot&formats=FLAC&era=Solo&sort=year&page=1
```

### `GET /api/albums/:id`
Fetch album details.

**Query Parameters:**
- `links=1` - Include streaming/download URLs (uses pre-generated links from comprehensive library)

**Behavior:**
- If `links=1` is provided, the API loads the comprehensive library which contains pre-generated Dropbox permanent links for all tracks
- Links are pre-generated during the sync workflow, eliminating timeout issues and improving response times
- If a track is missing a link (e.g., newly added track), the API will attempt to generate it at runtime as a fallback

### `GET /api/albums/:id/download`
Download entire album as ZIP file (proxies Dropbox `download_zip`).

### `POST /api/refresh`
Upload a new library snapshot to Cloudflare KV.

**Headers:**
- `x-admin-token` - Admin authentication token
- `Content-Type: application/json`

**Body:**
```json
{
  "snapshot": {
    "generatedAt": "2025-01-01T00:00:00.000Z",
    "albumCount": 98,
    "trackCount": 1838,
    "albums": [...]
  }
}
```

## 🔧 Scripts

### Build & Quality
- `npm run build` - Type-check + production build
- `npm run build:skip-check` - Production build without type checking
- `npm run lint` - Run ESLint
- `npm run typecheck` - Standalone TypeScript type checking

### Library Management
- `npm run sync:dropbox` - Sync Dropbox and generate library snapshot
- `npm run upload:library` - Upload library to backend API (requires `ADMIN_TOKEN`)
- `npm run upload:cloudflare` - Upload library to Cloudflare Pages API
- `npm run upload:kv` - Upload library directly to Cloudflare KV
- `npm run verify:kv` - Verify library data in Cloudflare KV

### Testing
- `npm test` - Run Vitest unit tests (backend functions only)
- `npm run test:watch` - Run tests in watch mode
- `npm run test:ui` - Run tests with Vitest UI

## 🔐 Environment Variables

### Library Management Scripts (`webapp/.env`)
```env
# Dropbox Configuration (Required)
DROPBOX_REFRESH_TOKEN=your-refresh-token  # Recommended: long-lived refresh token
DROPBOX_APP_KEY=your-app-key
DROPBOX_APP_SECRET=your-app-secret
DROPBOX_TOKEN=your-access-token  # Optional: short-lived access token (expires in 4 hours)
DROPBOX_LIBRARY_PATH=/Apps/ZappaVault/ZappaLibrary

# Cloudflare Configuration
CF_ACCOUNT_ID=your-account-id
CF_KV_NAMESPACE_ID=your-kv-namespace-id
CLOUDFLARE_API_TOKEN=your-api-token

# Application Configuration
ADMIN_TOKEN=your-secure-admin-token  # Generate a secure random token (32-64 chars)
VITE_API_BASE=https://zappavault.pages.dev
```

### Cloudflare Pages (Dashboard → Settings → Environment variables)

**Required for Streaming:**
- `DROPBOX_REFRESH_TOKEN` - Dropbox OAuth refresh token (recommended)
- `DROPBOX_APP_KEY` - Dropbox app key
- `DROPBOX_APP_SECRET` - Dropbox app secret
- `DROPBOX_TOKEN` - Dropbox access token (optional fallback, expires in 4 hours)

**Required for API:**
- `ADMIN_TOKEN` - Secret token for `/api/refresh` endpoint

**KV Binding:**
- `LIBRARY_KV` - KV namespace binding (configured in `wrangler.toml`)

### GitHub Secrets (for Actions workflows)

**Required Secrets:**
- `DROPBOX_REFRESH_TOKEN` - Dropbox OAuth refresh token
- `DROPBOX_APP_KEY` - Dropbox app key
- `DROPBOX_APP_SECRET` - Dropbox app secret
- `DROPBOX_TOKEN` - Dropbox access token (optional if refresh token works)
- `DROPBOX_LIBRARY_PATH` - Usually `/Apps/ZappaVault/ZappaLibrary`
- `CF_ACCOUNT_ID` - Cloudflare account ID
- `CF_KV_NAMESPACE_ID` - KV namespace ID bound as `LIBRARY_KV`
- `CLOUDFLARE_API_TOKEN` - Token with KV write access

**Optional:**
- `CURSOR_PAT` - GitHub Personal Access Token for Cursor IDE integration
- `GITHUB_ACCESS_TOKEN` - GitHub token for workflow automation

### Dropbox Token Setup

**Recommended: Use Refresh Tokens**

Refresh tokens don't expire and automatically refresh access tokens. Setup:

1. **Get App Credentials:**
   - Go to [Dropbox App Console](https://www.dropbox.com/developers/apps)
   - Note your **App key** and **App secret**

2. **Get Refresh Token:**
   ```bash
   cd webapp
   npm run get:refresh-token YOUR_APP_KEY YOUR_APP_SECRET
   ```
   - Follow the prompts to authorize and get your refresh token

3. **Configure Required Permissions:**
   Your Dropbox app must have these permissions:
   - ✅ `files.content.read` - Read files (required for streaming)
   - ✅ `files.metadata.read` - Read file metadata (required for library sync)
   - ✅ `sharing.read` - **REQUIRED** - Read shared links (for cover art)
   - ✅ `sharing.write` - **REQUIRED** - Create shared links (for streaming)

4. **Add to Environment:**
   - Add `DROPBOX_REFRESH_TOKEN`, `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET` to:
     - `webapp/.env` (local development)
     - GitHub Secrets (for workflows)
     - Cloudflare Pages Environment Variables (for production)

**Alternative: Direct Access Token**
- Generate at [Dropbox App Console](https://www.dropbox.com/developers/apps)
- ⚠️ Expires after 4 hours - requires manual refresh
- Set as `DROPBOX_TOKEN` in environment variables

### Generate Secure ADMIN_TOKEN

**PowerShell:**
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
```

**Bash/Linux/Mac:**
```bash
openssl rand -base64 48
```

**Online:** https://www.random.org/strings/ (32-64 characters, letters and numbers)

## 📊 Library Metadata

The library includes comprehensive metadata for all 98 albums:

- ✅ **Era:** 100% (98/98) - Mothers Of Invention / Solo classification
- ✅ **Genre:** 100% (98/98) - Genre classification
- ✅ **Description:** 100% (98/98) - Album descriptions
- ✅ **Tags:** 100% (98/98) - Categorization tags
- ✅ **Cover Art:** 100% (98/98) - Album cover images
- ✅ **Track Durations:** 100% (1,838/1,838) - All track durations extracted
- ⚠️ **Year:** 99% (97/98) - Only "Zappa Erie" missing year

## 🔄 Dropbox Sync Workflow

### Automated Sync (GitHub Actions)

The `.github/workflows/sync-dropbox.yml` workflow runs:
- **Daily at 08:00 UTC**
- **On manual dispatch** (GitHub Actions → sync-dropbox → Run workflow)

**Process:**
1. Checks out repository
2. Installs dependencies (Node.js and Python)
3. Runs `npm run sync:dropbox` to crawl Dropbox folder
4. Generates `webapp/data/library.generated.json` (base library with metadata)
5. Exports track durations from `zappa_tracks.db` to JSON
6. Creates `webapp/data/library.comprehensive.json` (merges durations into library)
7. **Generates Dropbox permanent links** for all tracks (pre-indexed for fast API responses)
8. Uploads comprehensive library to Cloudflare KV (if credentials provided)
9. Commits and pushes updated library files to repository

**Key Files Generated:**
- `library.generated.json` - Base library from Dropbox sync (metadata only)
- `library.comprehensive.json` - **Single source of truth** with:
  - All album and track metadata
  - Track durations (from SQLite database)
  - Pre-generated Dropbox permanent links (`streamingUrl` and `downloadUrl`)

### Manual Sync

```bash
cd webapp
npm run sync:dropbox
# This generates library.generated.json

# Then run Python scripts to create comprehensive library:
cd ..
python create_comprehensive_library.py webapp/data/library.generated.json zappa_tracks.db webapp/data/library.comprehensive.json
python generate_track_links.py webapp/data/library.comprehensive.json webapp/data/library.comprehensive.json

# Upload to Cloudflare KV
npm run upload:cloudflare
```

**Note:** The comprehensive library (`library.comprehensive.json`) is the single source of truth used by the API. It includes:
- All metadata from Dropbox sync
- Track durations from the SQLite database
- Pre-generated Dropbox permanent links for all tracks

## 🧪 Testing

### Backend Tests (Vitest)

Comprehensive test coverage for all API endpoints and utilities:
- **59 tests** across 6 test files
- All tests passing ✅

**Test Files:**
- `functions/shared/library.test.ts` - Query logic (17 tests)
- `functions/utils/library.test.ts` - Library loading/persistence (12 tests)
- `functions/api/library.test.ts` - Library endpoint (9 tests)
- `functions/api/albums/[id].test.ts` - Album endpoint (8 tests)
- `functions/api/albums/[id]/download.test.ts` - Download endpoint (6 tests)
- `functions/api/refresh.test.ts` - Refresh endpoint (7 tests)

### Viewing Changes

All changes are viewed directly on **Cloudflare Pages** at https://zappavault.pages.dev using Chromium. The site automatically deploys on every push to `master` branch.

## 📝 Development Workflow

1. **Make changes** to frontend/backend code
2. **Commit and push** to `master` branch
3. **GitHub Actions** automatically:
   - Lints and type-checks
   - Builds the project
   - Deploys to Cloudflare Pages
4. **View changes** at https://zappavault.pages.dev (Chromium on Cloudflare Pages)
5. **No local development server needed** - all viewing is done on the deployed site

## 🔍 Troubleshooting

### API Returns HTML Instead of JSON
- Check that `functions/` directory is at project root
- Verify environment variables are set in Cloudflare Pages
- Check Cloudflare Pages Functions logs
- Ensure KV namespace binding is configured in `wrangler.toml`

### Dropbox Access Issues

**"No Dropbox token available"**
- Verify `DROPBOX_REFRESH_TOKEN`, `DROPBOX_APP_KEY`, and `DROPBOX_APP_SECRET` are set in Cloudflare Pages
- Check that refresh token is valid (not truncated or malformed)
- Verify app has required permissions (`sharing.read`, `sharing.write`, `files.content.read`, `files.metadata.read`)

**"Streaming links are not available" or "No stream"**
- **Most common cause:** Links haven't been pre-generated yet. Run the GitHub Actions sync workflow to generate links for all tracks
- Check that `library.comprehensive.json` exists and contains `streamingUrl` fields for tracks
- Verify the sync workflow completed successfully (check GitHub Actions logs)
- Check Cloudflare Pages environment variables are set for **Production** environment
- Trigger a new deployment after adding variables (Deployments → Retry deployment)
- Check Cloudflare Functions logs for token refresh errors
- Test API directly: `https://zappavault.pages.dev/api/albums/[album-id]?links=1`
- **For large albums (30+ tracks):** Links are pre-generated to avoid timeout issues. If you see "No stream" for tracks 9+, the sync workflow may have failed or not completed link generation

**Token Refresh Failing**
- Verify `DROPBOX_REFRESH_TOKEN` is the complete token (100+ characters)
- Check `DROPBOX_APP_KEY` and `DROPBOX_APP_SECRET` match your Dropbox app
- Test locally: `cd webapp && npm run get:refresh-token`
- Check Cloudflare Functions logs for specific error messages

**Expired Access Token**
- If using `DROPBOX_TOKEN` directly, it expires after 4 hours
- Switch to refresh token system (recommended) for automatic token refresh
- Or manually regenerate token at [Dropbox App Console](https://www.dropbox.com/developers/apps)

### Library Not Showing
- Check KV namespace is bound in Cloudflare Pages (`wrangler.toml` configured)
- Verify library was uploaded via `/api/refresh` or `npm run upload:cloudflare`
- Check `loadLibrarySnapshot()` in `functions/utils/library.ts`
- Verify `CF_KV_NAMESPACE_ID` matches your KV namespace ID

### Build Failures
- Ensure Node.js version is compatible (18+)
- Check that all dependencies are in `package.json`
- Review build logs in Cloudflare dashboard
- Verify GitHub Actions secrets are configured correctly

### Environment Variable Issues

**Malformed Refresh Token**
- Ensure `DROPBOX_REFRESH_TOKEN` is on a single line with no line breaks
- Remove any duplicate token values
- Verify token is complete (100+ characters)

**Missing GitHub Secrets**
- Go to: https://github.com/kimbersykes87-source/ZappaVault/settings/secrets/actions
- Verify all required secrets are present
- Update secrets if values have changed

**Cloudflare Configuration**
- Verify `CF_ACCOUNT_ID` matches your Cloudflare account
- Check `CF_KV_NAMESPACE_ID` matches your KV namespace
- Ensure `CLOUDFLARE_API_TOKEN` has KV write permissions

### Workflow Issues

**Check Workflow Logs:**
1. Go to: https://github.com/kimbersykes87-source/ZappaVault/actions/workflows/sync-dropbox.yml
2. Click latest workflow run → "sync" job
3. Look for:
   - ✅ `✅ Cloudflare KV updated successfully!`
   - ⚠️ `⚠️ Cloudflare KV credentials not provided`
   - ❌ `❌ Cloudflare KV upload failed:`

**Trigger Manual Sync:**
1. Go to Actions → sync-dropbox workflow
2. Click "Run workflow" → "Run workflow"
3. Wait for completion (1-2 minutes)
4. Check logs for success/errors

## 📖 Additional Resources

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Cloudflare Workers API](https://developers.cloudflare.com/workers/api/)
- [Dropbox API Documentation](https://www.dropbox.com/developers/documentation)
- [React 19 Documentation](https://react.dev/)
- [Vite Documentation](https://vite.dev/)

## 📄 License

Private project - Family use only

---

**Last Updated:** 2025-02-10  
**Deployment Status:** ✅ Live at https://zappavault.pages.dev  
**Auto-Deployment:** ✅ Enabled via GitHub Actions

