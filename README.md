# Frank Zappa Vault

A Cloudflare Pages application that indexes a Dropbox-hosted Frank Zappa collection, provides search/filter tooling, streams audio via temporary links, and exposes full-album downloads for family playback.

## 🎯 Project Status

**Current Status:** ✅ Production Ready
- **Total Albums:** 102
- **Total Tracks:** 1,897
- **Metadata Completion:** 100% (era, genre, description, tags, cover art, track durations)
- **Cover Art:** All URLs pre-generated with `raw=1` for proper image display
- **Social Sharing:** Open Graph and Twitter Card meta tags configured
- **Analytics:** Free privacy-focused analytics tracking (city, device, dwell time)
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
├── docs/                   # Documentation
│   ├── legal/             # Legal documents (Privacy Policy, Terms, DMCA)
│   ├── security/          # Security documentation and analysis
│   ├── testing/           # Test reports and verification
│   ├── ui-ux/             # UI/UX reviews and improvements
│   ├── ANALYTICS.md       # Analytics implementation documentation
│   ├── ANALYTICS_VIEWING_GUIDE.md  # How to view analytics data
│   ├── CLOUDFLARE_ENV_SETUP.md
│   ├── DROPBOX_TOKEN_SETUP.md
│   └── LIBRARY_ARCHITECTURE.md
├── functions/              # Cloudflare Pages Functions (API endpoints)
│   ├── api/
│   │   ├── library.ts     # GET /api/library
│   │   ├── refresh.ts     # POST /api/refresh
│   │   ├── analytics.ts   # POST /api/analytics, GET /api/analytics
│   │   ├── analytics-viewer.ts  # GET /api/analytics-viewer
│   │   └── albums/
│   ├── shared/            # Shared types and query logic
│   └── utils/             # Utility functions
├── scripts/               # Utility scripts (Python & Node.js)
│   ├── create_comprehensive_library.py
│   ├── generate_track_links.py
│   └── upload_library_to_kv.js
├── shared/                 # Shared TypeScript types (used by functions)
├── webapp/
│   ├── src/               # React frontend
│   ├── functions/         # Test files for backend functions
│   ├── scripts/           # Frontend utility scripts
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
- If `links=1` is provided, the API loads the comprehensive library from the static asset (`/data/library.comprehensive.json`)
- The comprehensive library contains all streaming links directly in the track objects (pre-generated during sync workflow)
- Cloudflare Functions fetch the static asset with forwarded authentication cookies to bypass middleware protection
- KV cache is used as a fallback if static asset fetch fails (contains metadata only, links stripped to stay under 25MB)
- Links are pre-generated during the sync workflow and stored in the comprehensive library file (single source of truth)
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

### `POST /api/analytics`
Record an analytics event (automatically called by frontend).

**Body:**
```json
{
  "path": "/album/123",
  "timestamp": 1704067200000,
  "dwellTime": 45000,
  "referrer": "https://example.com"
}
```

### `GET /api/analytics`
Retrieve raw analytics data for the last N days.

**Query Parameters:**
- `days` (optional) - Number of days to retrieve (default: 7)

### `GET /api/analytics-viewer`
Get formatted analytics summary with top cities, devices, browsers, and OS.

**Query Parameters:**
- `days` (optional) - Number of days to analyze (default: 30)

**Response includes:**
- Summary statistics (total page views, sessions, average dwell time)
- Top cities, devices, browsers, and operating systems
- Daily breakdown table

**View Analytics:** Visit `/analytics` on your site for a visual dashboard.

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

**Required for Site Access (Password Protection):**
- `SITE_PASSWORD` - Global password for family access (anyone with this password can access the site)

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

The library includes comprehensive metadata for all 102 albums:

- ✅ **Era:** 100% - Mothers Of Invention / Solo classification
- ✅ **Genre:** 100% - Genre classification
- ✅ **Description:** 100% - Album descriptions
- ✅ **Tags:** 100% - Categorization tags
- ✅ **Cover Art:** 100% - Album cover images with pre-generated `raw=1` URLs
- ✅ **Track Durations:** 100% - All track durations extracted
- ✅ **Permanent Links:** 100% - Pre-generated Dropbox links for all tracks and covers (stored in separate links database)

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
8. **Extracts links to separate file** (`library.comprehensive.links.json`) to keep KV payload small
9. Uploads metadata-only library to Cloudflare KV (stays under 25MB limit)
10. Commits and pushes updated library files to repository (including links file)

**Key Files Generated:**
- `library.generated.json` - Base library from Dropbox sync (metadata only)
- `library.comprehensive.json` - **Single source of truth** with:
  - All album and track metadata
  - Track durations (from SQLite database)
  - Pre-generated cover art URLs with `raw=1` parameter for images
  - **Pre-generated streaming and download links** (`streamingUrl` and `downloadUrl` for all tracks)
  - Deployed as static asset at `/data/library.comprehensive.json`
  - Loaded by Cloudflare Functions with forwarded authentication cookies
- `library.comprehensive.links.json` - **Links backup** (extracted during KV upload):
  - Extracted links stored separately (backup/fallback, also in GitHub)
  - Used only if comprehensive library cannot be loaded from static asset

### Manual Sync

```bash
cd webapp
npm run sync:dropbox
# This generates library.generated.json

# Then run Python scripts to create comprehensive library:
cd ..
python scripts/create_comprehensive_library.py webapp/data/library.generated.json zappa_tracks.db webapp/data/library.comprehensive.json
python scripts/generate_track_links.py webapp/data/library.comprehensive.json webapp/data/library.comprehensive.json

# Upload to Cloudflare KV
npm run upload:cloudflare
```

**Note:** The comprehensive library (`library.comprehensive.json`) is the single source of truth used by the API. It contains all metadata including streaming links. The architecture works as follows:

- **Comprehensive library** (`library.comprehensive.json` in GitHub): Contains all metadata including streaming links
  - Deployed as static asset at `/data/library.comprehensive.json`
  - Loaded by Cloudflare Functions via authenticated fetch (cookies forwarded)
  - Protected by middleware (requires authentication)
- **KV cache** (metadata only): Links stripped to stay under 25MB limit
  - Used as fast fallback if static asset fetch fails
  - Contains albums, tracks, durations, cover art URLs (no links)
- **Links backup** (`library.comprehensive.links.json`): Extracted during KV upload as backup

This architecture ensures:
- Comprehensive library (with links) is always the primary source (loaded from static asset)
- KV payload stays small (metadata only, used as fallback)
- All pre-generated links are preserved (stored in comprehensive library, version controlled)
- Fast access (static asset with forwarded authentication)
- Automatic updates (workflow commits comprehensive library file)

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
- Verify the sync workflow completed successfully and committed `library.comprehensive.json` to GitHub
- Ensure the comprehensive library file is deployed as static asset (check Cloudflare Pages build logs for file copy)
- Verify Cloudflare Functions can access the static asset (check Functions logs for authentication/access errors)
- The library loader forwards authentication cookies when fetching static assets - verify middleware allows authenticated access
- Check Cloudflare Pages environment variables are set for **Production** environment
- Trigger a new deployment after adding variables (Deployments → Retry deployment)
- Check Cloudflare Functions logs for:
  - `[LIBRARY] ✅ Loaded library from static asset` (successful load)
  - `[LIBRARY] Loaded library from KV cache` (fallback to KV, may indicate static asset fetch failed)
  - `[LINK DEBUG] Pre-generated links: X/Y tracks already have links` (shows how many tracks have links)
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

## 📚 Documentation

### Project Documentation
- [`docs/LIBRARY_ARCHITECTURE.md`](docs/LIBRARY_ARCHITECTURE.md) - Library data structure and architecture
- [`docs/DROPBOX_TOKEN_SETUP.md`](docs/DROPBOX_TOKEN_SETUP.md) - Dropbox authentication setup guide
- [`docs/CLOUDFLARE_ENV_SETUP.md`](docs/CLOUDFLARE_ENV_SETUP.md) - Cloudflare environment configuration
- [`docs/ANALYTICS.md`](docs/ANALYTICS.md) - Analytics implementation and API documentation
- [`docs/ANALYTICS_VIEWING_GUIDE.md`](docs/ANALYTICS_VIEWING_GUIDE.md) - Complete guide to viewing analytics data

### Security Documentation
- [`docs/security/SECURITY_LEGAL_REVIEW.md`](docs/security/SECURITY_LEGAL_REVIEW.md) - Comprehensive security analysis
- [`docs/security/SECURITY_LEGAL_IMPLEMENTATION.md`](docs/security/SECURITY_LEGAL_IMPLEMENTATION.md) - Security implementation details
- [`docs/security/EXPOSED_FILES_ANALYSIS.md`](docs/security/EXPOSED_FILES_ANALYSIS.md) - File exposure analysis
- [`docs/security/ACCESS_CONTROL_OPTIONS.md`](docs/security/ACCESS_CONTROL_OPTIONS.md) - Access control options
- [`docs/security/PASSWORD_SETUP.md`](docs/security/PASSWORD_SETUP.md) - Password protection setup

### Legal Documents
- [`docs/legal/PRIVACY_POLICY.md`](docs/legal/PRIVACY_POLICY.md) - Privacy Policy
- [`docs/legal/TERMS_OF_SERVICE.md`](docs/legal/TERMS_OF_SERVICE.md) - Terms of Service
- [`docs/legal/DMCA_POLICY.md`](docs/legal/DMCA_POLICY.md) - DMCA Policy

### UI/UX Documentation
- [`docs/ui-ux/UI_UX_REVIEW.md`](docs/ui-ux/UI_UX_REVIEW.md) - UI/UX design review
- [`docs/ui-ux/UI_UX_IMPROVEMENTS_IMPLEMENTED.md`](docs/ui-ux/UI_UX_IMPROVEMENTS_IMPLEMENTED.md) - Implemented improvements

## 📖 Additional Resources

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Cloudflare Workers API](https://developers.cloudflare.com/workers/api/)
- [Dropbox API Documentation](https://www.dropbox.com/developers/documentation)
- [React 19 Documentation](https://react.dev/)
- [Vite Documentation](https://vite.dev/)

## 🌐 Social Sharing

The site includes Open Graph and Twitter Card meta tags for rich link previews:

- **Open Graph tags** for Facebook, WhatsApp, LinkedIn
- **Twitter Card tags** for Twitter/X
- **Preview image:** Uses `Zappa-Logo.png` (1200x630px) for optimal social media display
- **Meta description:** "Explore Frank Zappa's complete discography. Stream albums, browse tracks, and discover rare recordings from the Zappa vault."

**Testing:**
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)

## 🔒 Security & Legal

### Security
- **Password Protection:** Global password authentication protects the entire site (family members only)
- Admin authentication uses secure header-based tokens (no query strings)
- CORS restricted to whitelisted origins
- Security headers enabled on all API endpoints
- URL validation prevents SSRF attacks
- Request size limits prevent DoS attacks

**Password Setup:**
1. Set `SITE_PASSWORD` environment variable in Cloudflare Pages
2. Family members visit the site and enter the password
3. Session lasts 24 hours (no need to re-enter password)

See [`docs/security/SECURITY_LEGAL_REVIEW.md`](docs/security/SECURITY_LEGAL_REVIEW.md) for full security analysis and [`docs/security/SECURITY_LEGAL_IMPLEMENTATION.md`](docs/security/SECURITY_LEGAL_IMPLEMENTATION.md) for implementation details.

### Legal Documents
- [Privacy Policy](docs/legal/PRIVACY_POLICY.md)
- [Terms of Service](docs/legal/TERMS_OF_SERVICE.md)
- [DMCA Policy](docs/legal/DMCA_POLICY.md)

**Important:** These documents are templates. Review and customize with your information, and consult with legal counsel for specific legal questions.

## 📄 License

Private project - Family use only

**Copyright Notice:** All music content is the property of the Zappa Family Trust. This site is a private family collection and does not grant any rights to use, reproduce, or distribute copyrighted material.

---

**Last Updated:** 2025-12-16  
**Deployment Status:** ✅ Live at https://zappavault.pages.dev  
**Auto-Deployment:** ✅ Enabled via GitHub Actions  
**Analytics:** ✅ Free privacy-focused analytics with dashboard at `/analytics`

