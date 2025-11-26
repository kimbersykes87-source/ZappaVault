# Check GitHub Actions workflow logs for sync-dropbox
$envLines = Get-Content "webapp\.env"
$token = ($envLines | Where-Object { $_ -match "^CURSOR_PAT\s*=" }) -replace ".*=", "" | ForEach-Object { $_.Trim() }

if (-not $token) {
    Write-Host "CURSOR_PAT not found in webapp\.env" -ForegroundColor Red
    exit 1
}

$headers = @{
    "Accept" = "application/vnd.github+json"
    "Authorization" = "Bearer $token"
    "X-GitHub-Api-Version" = "2022-11-28"
}

Write-Host "Fetching latest workflow runs..." -ForegroundColor Cyan

try {
    $runs = Invoke-RestMethod -Uri "https://api.github.com/repos/kimbersykes87-source/ZappaVault/actions/workflows/sync-dropbox.yml/runs?per_page=1" -Method Get -Headers $headers
    
    if ($runs.workflow_runs.Count -eq 0) {
        Write-Host "No workflow runs found" -ForegroundColor Yellow
        exit 0
    }
    
    $run = $runs.workflow_runs[0]
    Write-Host ""
    Write-Host "Latest Run:" -ForegroundColor Yellow
    Write-Host "  Status: $($run.status)" -ForegroundColor $(if ($run.status -eq "completed") { "Green" } else { "Yellow" })
    Write-Host "  Conclusion: $($run.conclusion)" -ForegroundColor $(if ($run.conclusion -eq "success") { "Green" } elseif ($run.conclusion -eq "failure") { "Red" } else { "Yellow" })
    Write-Host "  Created: $($run.created_at)" -ForegroundColor Gray
    Write-Host "  URL: $($run.html_url)" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "Fetching job logs..." -ForegroundColor Cyan
    $jobs = Invoke-RestMethod -Uri "https://api.github.com/repos/kimbersykes87-source/ZappaVault/actions/runs/$($run.id)/jobs" -Method Get -Headers $headers
    
    if ($jobs.jobs.Count -eq 0) {
        Write-Host "No jobs found for this run" -ForegroundColor Yellow
        exit 0
    }
    
    $job = $jobs.jobs[0]
    Write-Host "Job: $($job.name) (ID: $($job.id))" -ForegroundColor Gray
    Write-Host ""
    
    $logs = Invoke-WebRequest -Uri "https://api.github.com/repos/kimbersykes87-source/ZappaVault/actions/jobs/$($job.id)/logs" -Method Get -Headers $headers
    $logContent = $logs.Content
    
    Write-Host "=== Cloudflare KV Upload Logs ===" -ForegroundColor Cyan
    Write-Host ""
    
    $lines = $logContent -split "`n"
    $kvLines = $lines | Where-Object { 
        $_ -match "Uploading|Cloudflare|CF_|KV|library snapshot|credentials not provided|KV updated|KV upload" 
    }
    
    if ($kvLines.Count -gt 0) {
        foreach ($line in $kvLines) {
            $color = "White"
            if ($line -match "success|KV updated successfully") { $color = "Green" }
            elseif ($line -match "warning|missing|not provided|credentials not") { $color = "Yellow" }
            elseif ($line -match "failed|error|Error") { $color = "Red" }
            Write-Host $line -ForegroundColor $color
        }
    } else {
        Write-Host "No Cloudflare KV-related messages found" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Last 30 lines of log:" -ForegroundColor Gray
        $lines | Select-Object -Last 30 | ForEach-Object { Write-Host $_ }
    }
    
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response:" -ForegroundColor Yellow
        Write-Host $responseBody -ForegroundColor Yellow
    }
}
