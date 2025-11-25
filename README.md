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
- `links=1` - Include signed streaming/download URLs (requires Dropbox token)

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
DROPBOX_TOKEN=your-dropbox-token
DROPBOX_LIBRARY_PATH=/ZappaLibrary
ADMIN_TOKEN=your-admin-token
```

### Cloudflare Pages (Dashboard → Settings → Environment variables)
- `DROPBOX_TOKEN` - Dropbox API token for generating temporary links
- `ADMIN_TOKEN` - Secret token for `/api/refresh` endpoint
- `LIBRARY_KV` - KV namespace binding (configured in Functions settings)

### GitHub Secrets (for Actions workflows)
- `DROPBOX_TOKEN` - Dropbox long-lived token
- `DROPBOX_LIBRARY_PATH` - Usually `/ZappaLibrary`
- `CF_ACCOUNT_ID` - Cloudflare account ID
- `CF_KV_NAMESPACE_ID` - KV namespace ID bound as `LIBRARY_KV`
- `CLOUDFLARE_API_TOKEN` - Token with KV write access

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
2. Installs dependencies
3. Runs `npm run sync:dropbox` to crawl Dropbox folder
4. Generates `webapp/data/library.generated.json`
5. Uploads to Cloudflare KV (if credentials provided)

### Manual Sync

```bash
cd webapp
npm run sync:dropbox
npm run upload:cloudflare
```

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

### Dropbox Access Issues
- Verify `DROPBOX_TOKEN` is correct
- Check token has access to the library path
- Verify `DROPBOX_LIBRARY_PATH` is set correctly

### Library Not Showing
- Check KV namespace is bound in Cloudflare Pages
- Verify library was uploaded via `/api/refresh` or KV
- Check `loadLibrarySnapshot()` in `functions/utils/library.ts`

### Build Failures
- Ensure Node.js version is compatible (18+)
- Check that all dependencies are in `package.json`
- Review build logs in Cloudflare dashboard

## 📖 Additional Resources

- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Cloudflare Workers API](https://developers.cloudflare.com/workers/api/)
- [Dropbox API Documentation](https://www.dropbox.com/developers/documentation)
- [React 19 Documentation](https://react.dev/)
- [Vite Documentation](https://vite.dev/)

## 📄 License

Private project - Family use only

---

**Last Updated:** 2025-01-27  
**Deployment Status:** ✅ Live at https://zappavault.pages.dev  
**Auto-Deployment:** ✅ Enabled via GitHub Actions

