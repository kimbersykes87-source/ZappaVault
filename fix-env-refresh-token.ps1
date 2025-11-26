# Fix malformed DROPBOX_REFRESH_TOKEN in webapp/.env
$envFile = "webapp\.env"

if (-not (Test-Path $envFile)) {
    Write-Host "❌ .env file not found at: $envFile" -ForegroundColor Red
    Write-Host "Current directory: $(Get-Location)" -ForegroundColor Yellow
    exit 1
}

Write-Host "Reading .env file..." -ForegroundColor Yellow
$content = Get-Content $envFile -Raw

# Check for malformed DROPBOX_REFRESH_TOKEN (two tokens concatenated)
if ($content -match 'DROPBOX_REFRESH_TOKEN=rrs48oSaAy8AAAAAAAe7obQT48p_Ju5fbZ4nlpCINKADROPBOX_REFRESH_TOKEN=(.+)') {
    Write-Host "⚠️  Found malformed DROPBOX_REFRESH_TOKEN line" -ForegroundColor Yellow
    
    $correctToken = $matches[1].Trim()
    
    # Remove any trailing whitespace or newline characters
    $correctToken = $correctToken -replace '\s+$', ''
    
    Write-Host "`nExtracted correct token: $($correctToken.Substring(0, [Math]::Min(30, $correctToken.Length)))..." -ForegroundColor Gray
    Write-Host "Token length: $($correctToken.Length) characters" -ForegroundColor Cyan
    
    # Create backup
    $backupFile = "$envFile.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item $envFile $backupFile
    Write-Host "✅ Created backup: $backupFile" -ForegroundColor Green
    
    # Fix the malformed line
    # Replace the entire malformed line with the correct one
    $pattern = 'DROPBOX_REFRESH_TOKEN=rrs48oSaAy8AAAAAAAe7obQT48p_Ju5fbZ4nlpCINKADROPBOX_REFRESH_TOKEN=.*'
    $replacement = "DROPBOX_REFRESH_TOKEN=$correctToken"
    
    $newContent = $content -replace $pattern, $replacement
    
    # Write fixed content
    Set-Content -Path $envFile -Value $newContent -NoNewline
    Write-Host "✅ Fixed: Replaced malformed DROPBOX_REFRESH_TOKEN with correct token" -ForegroundColor Green
    
    # Verify fix
    Write-Host "`nVerifying fix..." -ForegroundColor Yellow
    $lines = Get-Content $envFile
    $refreshLine = $lines | Where-Object { $_ -match '^DROPBOX_REFRESH_TOKEN=' }
    
    if ($refreshLine) {
        if ($refreshLine -match '^DROPBOX_REFRESH_TOKEN=([^\r\n]+)$') {
            $token = $matches[1].Trim()
            Write-Host "✅ Verification passed: DROPBOX_REFRESH_TOKEN is now correctly formatted" -ForegroundColor Green
            Write-Host "   Token starts with: $($token.Substring(0, [Math]::Min(30, $token.Length)))..." -ForegroundColor Gray
            Write-Host "   Token length: $($token.Length) characters" -ForegroundColor Cyan
        } else {
            Write-Host "⚠️  Warning: Token format may still be incorrect. Please check manually." -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ ERROR: DROPBOX_REFRESH_TOKEN line not found after fix!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "ℹ️  Malformed DROPBOX_REFRESH_TOKEN not found in expected format." -ForegroundColor Cyan
    Write-Host "   Checking current state..." -ForegroundColor Yellow
    
    $lines = Get-Content $envFile
    $refreshLine = $lines | Where-Object { $_ -match '^DROPBOX_REFRESH_TOKEN=' }
    
    if ($refreshLine) {
        Write-Host "   Found DROPBOX_REFRESH_TOKEN line" -ForegroundColor Gray
        if ($refreshLine -match '^DROPBOX_REFRESH_TOKEN=([^\r\n]+)$') {
            $token = $matches[1].Trim()
            Write-Host "   Token appears to be correctly formatted" -ForegroundColor Green
            Write-Host "   Token length: $($token.Length) characters" -ForegroundColor Cyan
        } else {
            Write-Host "   ⚠️  Token format may be incorrect. Please review manually." -ForegroundColor Yellow
            Write-Host "   Line: $($refreshLine.Substring(0, [Math]::Min(80, $refreshLine.Length)))..." -ForegroundColor Gray
        }
    } else {
        Write-Host "   ❌ DROPBOX_REFRESH_TOKEN not found in .env file" -ForegroundColor Yellow
    }
}

Write-Host "`nDone!" -ForegroundColor Cyan

