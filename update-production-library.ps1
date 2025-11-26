# Script to update production library in Cloudflare KV
# Run this after the sync workflow completes

Write-Host "=== Updating Production Library ===" -ForegroundColor Cyan
Write-Host ""

# Step 1: Pull latest changes
Write-Host "1. Pulling latest changes from repo..." -ForegroundColor Yellow
git pull

# Step 2: Check if library file exists
if (-not (Test-Path "webapp\data\library.generated.json")) {
    Write-Host "❌ Library file not found!" -ForegroundColor Red
    Write-Host "   Make sure the sync workflow completed successfully." -ForegroundColor Yellow
    exit 1
}

# Step 3: Check library file
$lib = Get-Content "webapp\data\library.generated.json" -Raw | ConvertFrom-Json
Write-Host ""
Write-Host "2. Library file found:" -ForegroundColor Yellow
Write-Host "   Albums: $($lib.albumCount)" -ForegroundColor White
Write-Host "   Tracks: $($lib.trackCount)" -ForegroundColor White
Write-Host "   Generated: $($lib.generatedAt)" -ForegroundColor White

# Step 4: Check Congress album
$congress = $lib.albums | Where-Object { $_.title -like "*Congress*" }
if ($congress) {
    Write-Host ""
    Write-Host "3. Congress album:" -ForegroundColor Yellow
    Write-Host "   Title: '$($congress.title)'" -ForegroundColor White
    Write-Host "   Location: $($congress.locationPath)" -ForegroundColor Gray
}

# Step 5: Upload to KV
Write-Host ""
Write-Host "4. Uploading to Cloudflare KV..." -ForegroundColor Yellow
cd webapp
npm run upload:kv

Write-Host ""
Write-Host "✅ Done! The production site should update within a few minutes." -ForegroundColor Green
Write-Host "   If changes don't appear, try:" -ForegroundColor Yellow
Write-Host "   - Hard refresh (Ctrl+Shift+R)" -ForegroundColor Gray
Write-Host "   - Clear browser cache" -ForegroundColor Gray
Write-Host "   - Wait 1-2 minutes for Cloudflare cache to clear" -ForegroundColor Gray

