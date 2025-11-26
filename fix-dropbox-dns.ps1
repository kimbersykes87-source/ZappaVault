# Fix Dropbox DNS by adding entries to hosts file
# Run this script as Administrator

$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$ip = "162.125.5.19"

Write-Host "Adding Dropbox API entries to hosts file..." -ForegroundColor Yellow
Write-Host "Hosts file path: $hostsPath" -ForegroundColor Gray

# Check if entries already exist
$existing = Get-Content $hostsPath | Select-String -Pattern "api.dropboxapi.com|api.dropbox.com"
if ($existing) {
    Write-Host "⚠️  Dropbox entries already exist in hosts file:" -ForegroundColor Yellow
    $existing | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
    $response = Read-Host "Do you want to remove existing entries and add new ones? (y/n)"
    if ($response -eq 'y' -or $response -eq 'Y') {
        # Remove existing entries
        $content = Get-Content $hostsPath | Where-Object { $_ -notmatch "api.dropboxapi.com|api.dropbox.com" }
        $content | Set-Content $hostsPath
        Write-Host "✅ Removed existing entries" -ForegroundColor Green
    } else {
        Write-Host "Keeping existing entries. Exiting." -ForegroundColor Yellow
        exit 0
    }
}

# Add new entries
$entries = @(
    "",
    "# Dropbox API DNS fix (added $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))",
    "$ip api.dropboxapi.com",
    "$ip api.dropbox.com"
)

try {
    Add-Content -Path $hostsPath -Value $entries -ErrorAction Stop
    Write-Host "✅ Successfully added Dropbox API entries to hosts file" -ForegroundColor Green
    Write-Host "" 
    Write-Host "Added entries:" -ForegroundColor Cyan
    Write-Host "   $ip api.dropboxapi.com" -ForegroundColor Gray
    Write-Host "   $ip api.dropbox.com" -ForegroundColor Gray
} catch {
    Write-Host "❌ Failed to add entries: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Make sure you're running PowerShell as Administrator!" -ForegroundColor Yellow
    exit 1
}

# Flush DNS cache
Write-Host ""
Write-Host "Flushing DNS cache..." -ForegroundColor Yellow
ipconfig /flushdns | Out-Null
Write-Host "✅ DNS cache flushed" -ForegroundColor Green

# Test connection
Write-Host ""
Write-Host "Testing connection to api.dropboxapi.com..." -ForegroundColor Yellow
$test = Test-NetConnection -ComputerName api.dropboxapi.com -Port 443 -InformationLevel Quiet -WarningAction SilentlyContinue
if ($test) {
    Write-Host "✅ Connection successful!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Connection test failed, but hosts file entry was added." -ForegroundColor Yellow
    Write-Host "   You may need to restart your computer or wait a few minutes." -ForegroundColor Gray
}

Write-Host ""
Write-Host "Done! You can now run: npm run sync:dropbox" -ForegroundColor Cyan

