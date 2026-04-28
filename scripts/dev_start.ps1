param(
    [int]$BackendPort = 8765,
    [int]$FrontendPort = 3000,
    [int]$StartupTimeoutSeconds = 45,
    [int]$BootstrapReadyTimeoutSeconds = 20,
    [switch]$Restart,
    [switch]$SkipBootstrapCheck
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$OutputEncoding = [Console]::OutputEncoding
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$StateDir = Join-Path $ProjectRoot "wechat_ai\data\app\processes"
$LogDir = Join-Path $ProjectRoot "wechat_ai\data\app\logs"
$FrontendDir = Join-Path $ProjectRoot "desktop_app\frontend"
New-Item -ItemType Directory -Force -Path $StateDir, $LogDir | Out-Null

function Get-ListeningPortPid([int]$Port) {
    $match = netstat -ano | Select-String ":$Port\s+.*LISTENING" | Select-Object -First 1
    if (-not $match) { return $null }
    $parts = ([string]$match).Trim() -split "\s+"
    $pidValue = 0
    if ($parts.Length -gt 0 -and [int]::TryParse($parts[-1], [ref]$pidValue)) {
        return $pidValue
    }
    return $null
}

function Stop-PidFileProcess([string]$PidFile) {
    if (-not (Test-Path $PidFile)) { return }
    $raw = (Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    $pidValue = 0
    if ([int]::TryParse([string]$raw, [ref]$pidValue)) {
        $process = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
        if ($process) {
            Stop-Process -Id $pidValue -Force
        }
    }
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

function Stop-TrackedProcess([string]$Name, [string]$PidFile) {
    if (-not (Test-Path $PidFile)) { return }
    $raw = (Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    $pidValue = 0
    if ([int]::TryParse([string]$raw, [ref]$pidValue) -and (Get-Process -Id $pidValue -ErrorAction SilentlyContinue)) {
        taskkill /PID $pidValue /T /F | Out-Null
        Write-Host "[$Name] stopped pid=$pidValue"
    }
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

function Start-LoggedProcess([string]$Name, [string]$Command, [string]$WorkingDirectory, [string]$PidFile, [string]$LogFile, [string]$Shell = "powershell", [switch]$Visible) {
    if (Test-Path $PidFile) {
        $existing = Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
        $existingPid = 0
        if ([int]::TryParse([string]$existing, [ref]$existingPid) -and (Get-Process -Id $existingPid -ErrorAction SilentlyContinue)) {
            Write-Host "[$Name] stale pid-file process pid=$existingPid found while port is not listening; stopping it"
            Stop-Process -Id $existingPid -Force -ErrorAction SilentlyContinue
        }
        Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    }

    if ($Shell -eq "cmd") {
        $mode = if ($Visible) { "/k" } else { "/c" }
        $cmdLine = "$mode cd /d `"$WorkingDirectory`" && $Command"
        if (-not $Visible) {
            $cmdLine = "$cmdLine >> `"$LogFile`" 2>&1"
        }
        $windowStyle = if ($Visible) { "Normal" } else { "Hidden" }
        $process = Start-Process -FilePath "cmd.exe" -ArgumentList $cmdLine -WindowStyle $windowStyle -PassThru
    } else {
        $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes(
            "Set-Location -LiteralPath '$WorkingDirectory'; `$ErrorActionPreference='Continue'; $Command *>> '$LogFile'"
        ))
        $process = Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -EncodedCommand $encoded" -WindowStyle Hidden -PassThru
    }
    Set-Content -Path $PidFile -Value $process.Id -Encoding UTF8
    Write-Host "[$Name] started pid=$($process.Id) log=$LogFile"
}

function Wait-BackendPing([string]$BaseUrl, [int]$TimeoutSeconds) {
    $deadline = (Get-Date).AddSeconds([Math]::Max($TimeoutSeconds, 1))
    $lastError = ""
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-RestMethod -Uri "$BaseUrl/ping" -TimeoutSec 3
            if ($response.success -eq $true) {
                Write-Host "[backend] ping ok"
                return
            }
        } catch {
            $lastError = $_.Exception.Message
        }
        Start-Sleep -Milliseconds 500
    }
    throw "backend did not become ready at $BaseUrl/ping within $TimeoutSeconds seconds. $lastError"
}

function Invoke-BootstrapEnvironmentCheck([string]$BaseUrl, [int]$ReadyTimeoutSeconds) {
    $body = @{
        mode = "global"
        ready_timeout_seconds = [Math]::Max($ReadyTimeoutSeconds, 1)
        poll_interval_seconds = 1
        narrator_settle_seconds = 2
        wait_for_ui_ready_before_guardian = $true
    } | ConvertTo-Json -Depth 8

    try {
        $response = Invoke-RestMethod -Uri "$BaseUrl/runtime/bootstrap-check" -Method Post -ContentType "application/json" -Body $body -TimeoutSec ([Math]::Max($ReadyTimeoutSeconds + 20, 30))
        if ($response.success -eq $true -and $response.data.bootstrap.ui_ready -eq $true) {
            Write-Host "[backend] bootstrap-check ok: $($response.data.bootstrap.message)"
            return
        }
        throw "bootstrap-check did not report ui_ready=true"
    } catch {
        $message = $_.Exception.Message
        $detail = $null
        if ($_.Exception.Response) {
            try {
                $stream = $_.Exception.Response.GetResponseStream()
                if ($stream) {
                    $reader = New-Object System.IO.StreamReader($stream)
                    $detail = $reader.ReadToEnd()
                }
            } catch {
                $detail = $null
            }
        }
        if ($detail) {
            throw "bootstrap-check failed: $message`n$detail"
        }
        throw "bootstrap-check failed: $message"
    }
}

if ($Restart) {
    & (Join-Path $PSScriptRoot "dev_stop.ps1")
}

$backendPid = Join-Path $StateDir "backend.pid"
$frontendPid = Join-Path $StateDir "frontend.pid"
$backendLog = Join-Path $LogDir "backend_$BackendPort.log"
$frontendLog = Join-Path $LogDir "frontend_$FrontendPort.log"
$backendBaseUrl = "http://127.0.0.1:$BackendPort/api/v1"
$backendWasReused = $false

$backendExistingPid = Get-ListeningPortPid $BackendPort
if ($backendExistingPid) {
    Set-Content -Path $backendPid -Value $backendExistingPid -Encoding UTF8
    Write-Host "[backend] port $BackendPort already listening pid=$backendExistingPid; recorded pid file"
    $backendWasReused = $true
} else {
    Start-LoggedProcess `
        -Name "backend" `
        -Command "py -3 -m uvicorn wechat_ai.server:create_app --factory --host 127.0.0.1 --port $BackendPort --log-level info" `
        -WorkingDirectory $ProjectRoot `
        -PidFile $backendPid `
        -LogFile $backendLog `
        -Shell "cmd" `
        -Visible
}

try {
    Wait-BackendPing $backendBaseUrl $StartupTimeoutSeconds
    if (-not $SkipBootstrapCheck) {
        try {
            Invoke-BootstrapEnvironmentCheck $backendBaseUrl $BootstrapReadyTimeoutSeconds
        } catch {
            if (-not $backendWasReused) {
                throw
            }
            Write-Host "[backend] reused backend failed bootstrap-check; restarting it from this interactive desktop..."
            Stop-TrackedProcess "backend" $backendPid
            Start-Sleep -Seconds 2
            Start-LoggedProcess `
                -Name "backend" `
                -Command "py -3 -m uvicorn wechat_ai.server:create_app --factory --host 127.0.0.1 --port $BackendPort --log-level info" `
                -WorkingDirectory $ProjectRoot `
                -PidFile $backendPid `
                -LogFile $backendLog `
                -Shell "cmd" `
                -Visible
            Wait-BackendPing $backendBaseUrl $StartupTimeoutSeconds
            Invoke-BootstrapEnvironmentCheck $backendBaseUrl $BootstrapReadyTimeoutSeconds
        }
    } else {
        Write-Host "[backend] bootstrap-check skipped by -SkipBootstrapCheck"
    }
} catch {
    Write-Host "[backend] startup verification failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Run scripts\dev_start.ps1 from an interactive desktop PowerShell. Restricted, hidden, or sandbox contexts may not see the WeChat window." -ForegroundColor Yellow
    & (Join-Path $PSScriptRoot "dev_stop.ps1")
    throw
}

$frontendExistingPid = Get-ListeningPortPid $FrontendPort
if ($frontendExistingPid) {
    Set-Content -Path $frontendPid -Value $frontendExistingPid -Encoding UTF8
    Write-Host "[frontend] port $FrontendPort already listening pid=$frontendExistingPid; recorded pid file"
} else {
    Start-LoggedProcess `
        -Name "frontend" `
        -Command "npm.cmd run dev -- --hostname 127.0.0.1 --port $FrontendPort" `
        -WorkingDirectory $FrontendDir `
        -PidFile $frontendPid `
        -LogFile $frontendLog `
        -Shell "cmd" `
        -Visible
}

Write-Host "dev services ready. Frontend: http://127.0.0.1:$FrontendPort  Backend: $backendBaseUrl/ping"
