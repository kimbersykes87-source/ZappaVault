# Frank Zappa Vault

A Cloudflare Pages app that indexes a Dropbox-hosted Frank Zappa collection, provides search/filter tooling, streams audio via temporary links, and exposes full-album downloads for family playback.

## Stack

- Vite + React + TypeScript UI
- Cloudflare Pages Functions for the JSON API + Dropbox signing
- Dropbox API for metadata + temporary links
- Cloudflare KV (optional) to cache the latest library snapshot

## Getting started

```bash
cd webapp
npm install
npm run dev
```

Environment variables live in `env.example`; copy it to `.env` (not checked in) and fill in your Dropbox + Cloudflare credentials.

## Dropbox sync workflow

The sync workflow creates a **comprehensive library file** that serves as the single source of truth for all library data, including pre-generated streaming links.

### Manual Sync Process

1. Configure Dropbox credentials (`DROPBOX_REFRESH_TOKEN`, `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`) and `DROPBOX_LIBRARY_PATH` (e.g. `/Apps/ZappaVault/ZappaLibrary`).
2. Run `npm run sync:dropbox` to crawl the folder and produce `data/library.generated.json` (base library with metadata).
3. Create comprehensive library with durations:
   ```bash
   python scripts/create_comprehensive_library.py webapp/data/library.generated.json zappa_tracks.db webapp/data/library.comprehensive.json
   ```
4. Generate Dropbox permanent links for all tracks:
   ```bash
   python scripts/generate_track_links.py webapp/data/library.comprehensive.json webapp/data/library.comprehensive.json
   ```
5. Upload to Cloudflare KV (if credentials provided):
   ```bash
   npm run upload:cloudflare
   ```

**Note:** The comprehensive library (`library.comprehensive.json`) includes:
- All album and track metadata from Dropbox
- Track durations from SQLite database
- Pre-generated cover art URLs with `raw=1` parameter for proper image display

**Links Database:** To keep the KV payload under Cloudflare's 25MB limit, track links are extracted to a separate file:
- `library.comprehensive.links.json` - Contains all pre-generated Dropbox permanent links
- Stored in GitHub as a static asset (served at `/data/library.comprehensive.links.json`)
- Cloudflare Functions automatically merge links at runtime when serving API requests
- This eliminates timeout issues while keeping KV payload small

### Automated sync via GitHub Actions

`sync-dropbox.yml` runs every day at 08:00 UTC (and on manual dispatch):

1. Checkout → Setup Node.js and Python
2. `npm run sync:dropbox -- --out data/library.generated.json` (generates base library)
3. Export track durations from SQLite database
4. Create comprehensive library (merges durations)
5. **Generate Dropbox permanent links** for all tracks (pre-indexed for fast API responses)
6. **Extract links to separate file** (`library.comprehensive.links.json`) to keep KV payload small
7. Upload metadata-only library to Cloudflare KV (stays under 25MB limit)
8. Commit and push updated library files to repository (including links file)

**Repository Secrets Required:**

| Secret | Description |
| --- | --- |
| `DROPBOX_REFRESH_TOKEN` | Dropbox OAuth refresh token (recommended) |
| `DROPBOX_APP_KEY` | Dropbox app key |
| `DROPBOX_APP_SECRET` | Dropbox app secret |
| `DROPBOX_TOKEN` | Dropbox access token (optional, expires in 4 hours) |
| `DROPBOX_LIBRARY_PATH` | Usually `/Apps/ZappaVault/ZappaLibrary` |
| `CF_ACCOUNT_ID` | Cloudflare account ID |
| `CF_KV_NAMESPACE_ID` | The Pages KV namespace ID bound as `LIBRARY_KV` |
| `CLOUDFLARE_API_TOKEN` | Token with KV write access |

`scripts/dropboxSync.ts` is TypeScript + `fetch`, so it runs anywhere Node 18+ is available.

## API surface

- `GET /api/library` – search, filter, paginate albums (loads from comprehensive library)
- `GET /api/albums/:id` – fetch album details; `?links=1` includes pre-generated streaming/download URLs from comprehensive library
- `GET /api/albums/:id/download` – proxies Dropbox `download_zip` for album-level download
- `POST /api/refresh` – authenticated endpoint to push a new snapshot into KV

**Link Generation:**
- Links are **pre-generated** during the sync workflow and stored in `library.comprehensive.links.json` (separate from main library)
- Links are stored in GitHub as a static asset and merged at runtime by Cloudflare Functions
- This architecture keeps KV payload under 25MB while preserving all pre-generated links
- This eliminates timeout issues for large albums and improves API response times
- Audio files use `dl=1` parameter, images (cover art) use `raw=1` parameter
- If a track is missing a link (e.g., newly added), the API will attempt to generate it at runtime as a fallback
- Cover art URLs are pre-generated with `raw=1` for direct image access

All functions share types defined in `shared/library.ts` to keep the UI, scripts, and API aligned.

## Deployment

1. Create a Cloudflare Pages project pointing at this directory.
2. Provide `DROPBOX_TOKEN`, `ADMIN_TOKEN`, and KV bindings in the Pages dashboard.
3. Connect the GitHub repo; default build command `npm run build`, output `dist/`.
4. (Optional) Add a GitHub Actions workflow to run `npm run lint && npm run build` before deploying.

## Useful scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Local Vite dev server |
| `npm run build` | Type-check + production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Standalone TS project references |
| `npm run sync:dropbox` | Crawl Dropbox and refresh the vault snapshot |
| `npm run upload:library` | Upload generated library to backend API (requires `ADMIN_TOKEN` and `VITE_API_BASE` in `.env`) |
