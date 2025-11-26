# How to Check sync-dropbox Workflow Logs

## View Workflow Runs

1. Go to: https://github.com/kimbersykes87-source/ZappaVault/actions/workflows/sync-dropbox.yml

2. Click on the latest workflow run

3. Click on the "sync" job

4. Expand the "Sync Dropbox snapshot" step to see the logs

## What to Look For

### ✅ Success Indicators:
- `📤 Uploading library snapshot to Cloudflare KV...`
- `✅ Cloudflare KV updated successfully!`
- `Wrote X albums / Y tracks to data/library.generated.json`

### ⚠️ Warning Indicators:
- `⚠️ Cloudflare KV credentials not provided`
- Shows which credentials are missing (CF_ACCOUNT_ID, CF_KV_NAMESPACE_ID, CLOUDFLARE_API_TOKEN)

### ❌ Error Indicators:
- `❌ Cloudflare KV upload failed:`
- Shows HTTP status code and error message
- `Cloudflare KV bulk write failed:`

## Trigger a New Run

1. Go to: https://github.com/kimbersykes87-source/ZappaVault/actions/workflows/sync-dropbox.yml
2. Click "Run workflow" button (top right)
3. Select branch: `master`
4. Click "Run workflow"
5. Wait for it to complete (usually 1-2 minutes)
6. Check the logs as described above

## Verify Cloudflare KV Update

After a successful upload, the webapp should show:
- Updated album metadata (year, description, etc.)
- All 106 albums visible
- Cover art displaying correctly



