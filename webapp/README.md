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

1. Configure `DROPBOX_TOKEN` (app token) and `DROPBOX_LIBRARY_PATH` (e.g. `/ZappaLibrary`).
2. Run `npm run sync:dropbox` to crawl the folder, produce `data/library.generated.json`, and optionally push to Cloudflare KV if `CF_ACCOUNT_ID`, `CF_KV_NAMESPACE_ID`, and `CLOUDFLARE_API_TOKEN` are set.
3. Deploy or call `POST /api/refresh` with the generated snapshot to update production.

`scripts/dropboxSync.ts` is TypeScript + `fetch`, so it runs anywhere Node 18+ is available.

### Automated sync via GitHub Actions

`sync-dropbox.yml` runs every day at 08:00 UTC (and on manual dispatch):

1. Checkout → `npm ci`
2. `npm run sync:dropbox -- --out data/library.generated.json`
3. Script writes to the repo and, if the Cloudflare secrets are present, updates KV so Pages Functions instantly serve the new snapshot.

Add these repository secrets before enabling the workflow:

| Secret | Description |
| --- | --- |
| `DROPBOX_TOKEN` | Dropbox long-lived token |
| `DROPBOX_LIBRARY_PATH` | Usually `/ZappaLibrary` |
| `CF_ACCOUNT_ID` | Cloudflare account ID |
| `CF_KV_NAMESPACE_ID` | The Pages KV namespace ID bound as `LIBRARY_KV` |
| `CLOUDFLARE_API_TOKEN` | Token with KV write access |

## API surface

- `GET /api/library` – search, filter, paginate albums
- `GET /api/albums/:id` – fetch album details; `?links=1` hydrates signed stream/download URLs
- `GET /api/albums/:id/download` – proxies Dropbox `download_zip` for album-level download
- `POST /api/refresh` – authenticated endpoint to push a new snapshot into KV

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
