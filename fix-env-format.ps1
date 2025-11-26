# Fix .env file - separate DROPBOX_AUTH_CODE and DROPBOX_REFRESH_TOKEN
$envFile = "webapp\.env"

if (-not (Test-Path $envFile)) {
    Write-Host "❌ .env file not found at: $envFile" -ForegroundColor Red
    Write-Host "Current directory: $(Get-Location)" -ForegroundColor Yellow
    exit 1
}

Write-Host "Reading .env file..." -ForegroundColor Yellow
$content = Get-Content $envFile -Raw

# Check if AUTH_CODE and REFRESH_TOKEN are on the same line
if ($content -match 'DROPBOX_AUTH_CODE=([^\r\n]+)DROPBOX_REFRESH_TOKEN=([^\r\n]+)') {
    Write-Host "⚠️  Found issue: DROPBOX_AUTH_CODE and DROPBOX_REFRESH_TOKEN are on the same line" -ForegroundColor Yellow
    
    # Extract the values
    $authCode = $matches[1]
    $refreshToken = $matches[2]
    
    Write-Host "`nAuth Code: $($authCode.Substring(0, [Math]::Min(30, $authCode.Length)))..." -ForegroundColor Gray
    Write-Host "Refresh Token: $($refreshToken.Substring(0, [Math]::Min(30, $refreshToken.Length)))..." -ForegroundColor Gray
    Write-Host "Refresh Token length: $($refreshToken.Length) characters" -ForegroundColor Cyan
    
    # Fix: Replace with separate lines
    # Option 1: Comment out AUTH_CODE and keep REFRESH_TOKEN
    $newContent = $content -replace '(DROPBOX_AUTH_CODE=[^\r\n]+)(DROPBOX_REFRESH_TOKEN=)', "# `$1`n`$2"
    
    # Backup original
    $backupFile = "$envFile.backup"
    Copy-Item $envFile $backupFile
    Write-Host "✅ Created backup: $backupFile" -ForegroundColor Green
    
    # Write fixed content
    Set-Content -Path $envFile -Value $newContent -NoNewline
    Write-Host "✅ Fixed: Separated DROPBOX_AUTH_CODE and DROPBOX_REFRESH_TOKEN" -ForegroundColor Green
    Write-Host "   (AUTH_CODE is now commented out since you have the refresh token)" -ForegroundColor Gray
    
} else {
    Write-Host "✅ .env file format looks correct" -ForegroundColor Green
    $lines = Get-Content $envFile
    $authLine = $lines | Where-Object { $_ -match '^DROPBOX_AUTH_CODE=' }
    $refreshLine = $lines | Where-Object { $_ -match '^DROPBOX_REFRESH_TOKEN=' }
    
    if ($authLine) { Write-Host "   Found: DROPBOX_AUTH_CODE" -ForegroundColor Gray }
    if ($refreshLine) { 
        Write-Host "   Found: DROPBOX_REFRESH_TOKEN" -ForegroundColor Gray
        if ($refreshLine -match 'DROPBOX_REFRESH_TOKEN=([^\r\n]+)') {
            $token = $matches[1].Trim()
            Write-Host "   Token length: $($token.Length) characters" -ForegroundColor Cyan
        }
    }
    if (-not $refreshLine) {
        Write-Host "⚠️  WARNING: DROPBOX_REFRESH_TOKEN not found in .env file" -ForegroundColor Yellow
    }
}

Write-Host "`nDone! You can now run: cd webapp; npm run sync:dropbox" -ForegroundColor Cyan

