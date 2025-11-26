# Fix .env file - ensure DROPBOX_AUTH_CODE and DROPBOX_REFRESH_TOKEN are on separate lines
$envFile = "webapp\.env"

if (-not (Test-Path $envFile)) {
    Write-Host "❌ .env file not found at: $envFile" -ForegroundColor Red
    exit 1
}

Write-Host "Reading .env file..." -ForegroundColor Yellow
$content = Get-Content $envFile -Raw

# Check if AUTH_CODE and REFRESH_TOKEN are on the same line
if ($content -match 'DROPBOX_AUTH_CODE=([^\r\n]+)DROPBOX_REFRESH_TOKEN=') {
    Write-Host "⚠️  Found issue: DROPBOX_AUTH_CODE and DROPBOX_REFRESH_TOKEN are on the same line" -ForegroundColor Yellow
    
    # Fix: Add newline between them
    $newContent = $content -replace '(DROPBOX_AUTH_CODE=[^\r\n]+)(DROPBOX_REFRESH_TOKEN=)', "`$1`n`$2"
    
    # Backup original
    $backupFile = "$envFile.backup"
    Copy-Item $envFile $backupFile
    Write-Host "✅ Created backup: $backupFile" -ForegroundColor Green
    
    # Write fixed content
    Set-Content -Path $envFile -Value $newContent -NoNewline
    Write-Host "✅ Fixed: Added newline between DROPBOX_AUTH_CODE and DROPBOX_REFRESH_TOKEN" -ForegroundColor Green
    
    Write-Host "`nVerifying fix..." -ForegroundColor Yellow
    $lines = Get-Content $envFile
    $authLine = $lines | Where-Object { $_ -match '^DROPBOX_AUTH_CODE=' }
    $refreshLine = $lines | Where-Object { $_ -match '^DROPBOX_REFRESH_TOKEN=' }
    
    if ($authLine -and $refreshLine -and $authLine -ne $refreshLine) {
        Write-Host "✅ Verification passed: They are now on separate lines" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Verification failed. Please check the file manually." -ForegroundColor Yellow
    }
} else {
    Write-Host "✅ .env file format looks correct" -ForegroundColor Green
    $lines = Get-Content $envFile
    $authLine = $lines | Where-Object { $_ -match '^DROPBOX_AUTH_CODE=' }
    $refreshLine = $lines | Where-Object { $_ -match '^DROPBOX_REFRESH_TOKEN=' }
    
    if ($authLine) { Write-Host "   Found: DROPBOX_AUTH_CODE" -ForegroundColor Gray }
    if ($refreshLine) { Write-Host "   Found: DROPBOX_REFRESH_TOKEN" -ForegroundColor Gray }
    if (-not $refreshLine) {
        Write-Host "⚠️  WARNING: DROPBOX_REFRESH_TOKEN not found in .env file" -ForegroundColor Yellow
    }
}

Write-Host "`nDone!" -ForegroundColor Cyan

