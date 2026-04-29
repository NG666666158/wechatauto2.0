param(
    [int]$BackendPort = 8765,
    [int]$FrontendPort = 3000,
    [int]$TimeoutSeconds = 60,
    [switch]$Restart,
    [switch]$NoBrowser,
    [switch]$Hidden
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$OutputEncoding = [Console]::OutputEncoding

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$FrontendDir = Join-Path $ProjectRoot "desktop_app\frontend"
$StateDir = Join-Path $ProjectRoot "wechat_ai\data\app\processes"
$LogDir = Join-Path $ProjectRoot "wechat_ai\data\app\logs"
$BackendPidFile = Join-Path $StateDir "backend.pid"
$FrontendPidFile = Join-Path $StateDir "frontend.pid"
$BackendLog = Join-Path $LogDir "backend_$BackendPort.log"
$FrontendLog = Join-Path $LogDir "frontend_$FrontendPort.log"
$BackendBaseUrl = "http://127.0.0.1:$BackendPort/api/v1"
$FrontendUrl = "http://127.0.0.1:$FrontendPort"

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

function Stop-ProcessTree([string]$Name, [int]$PidValue) {
    if ($PidValue -le 0) { return }
    try {
        taskkill /PID $PidValue /T /F | Out-Null
        Write-Host "[$Name] stopped pid=$PidValue"
    } catch {
        Write-Host "[$Name] stop failed pid=${PidValue}: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

function Stop-PidFileProcess([string]$Name, [string]$PidFile) {
    if (-not (Test-Path $PidFile)) { return }
    $raw = Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
    $pidValue = 0
    if ([int]::TryParse([string]$raw, [ref]$pidValue)) {
        Stop-ProcessTree $Name $pidValue
    }
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

function Test-BackendReady([string]$BaseUrl) {
    try {
        $response = Invoke-RestMethod -Uri "$BaseUrl/ping" -TimeoutSec 3
        return $response.success -eq $true
    } catch {
        return $false
    }
}

function Test-FrontendReady([string]$Url) {
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
        return [int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 500
    } catch {
        return $false
    }
}

function Wait-Until([scriptblock]$Probe, [string]$Name, [int]$Timeout) {
    $deadline = (Get-Date).AddSeconds([Math]::Max($Timeout, 1))
    while ((Get-Date) -lt $deadline) {
        if (& $Probe) {
            Write-Host "[$Name] ready"
            return
        }
        Start-Sleep -Milliseconds 700
    }
    throw "$Name did not become ready within $Timeout seconds"
}

function Start-Backend() {
    $existingPid = Get-ListeningPortPid $BackendPort
    if ($existingPid) {
        Set-Content -Path $BackendPidFile -Value $existingPid -Encoding UTF8
        Write-Host "[backend] already listening pid=$existingPid"
        return
    }

    if ($Hidden) {
        $command = "Set-Location -LiteralPath '$ProjectRoot'; `$env:PYTHONIOENCODING='utf-8'; py -3 -m uvicorn wechat_ai.server:create_app --factory --host 127.0.0.1 --port $BackendPort --log-level info *>> '$BackendLog'"
        $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
        $process = Start-Process -FilePath "powershell.exe" -ArgumentList "-NoProfile -ExecutionPolicy Bypass -EncodedCommand $encoded" -WindowStyle Hidden -PassThru
    } else {
        $cmdLine = "/k cd /d `"$ProjectRoot`" && set PYTHONIOENCODING=utf-8 && py -3 -m uvicorn wechat_ai.server:create_app --factory --host 127.0.0.1 --port $BackendPort --log-level info"
        $process = Start-Process -FilePath "cmd.exe" -ArgumentList $cmdLine -WindowStyle Normal -PassThru
    }
    Set-Content -Path $BackendPidFile -Value $process.Id -Encoding UTF8
    Write-Host "[backend] started pid=$($process.Id) log=$BackendLog"
}

function Start-Frontend() {
    $existingPid = Get-ListeningPortPid $FrontendPort
    if ($existingPid) {
        Set-Content -Path $FrontendPidFile -Value $existingPid -Encoding UTF8
        Write-Host "[frontend] already listening pid=$existingPid"
        return
    }

    if ($Hidden) {
        $cmdLine = "/c cd /d `"$FrontendDir`" && npm.cmd run dev -- --hostname 127.0.0.1 --port $FrontendPort >> `"$FrontendLog`" 2>&1"
        $process = Start-Process -FilePath "cmd.exe" -ArgumentList $cmdLine -WindowStyle Hidden -PassThru
    } else {
        $cmdLine = "/k cd /d `"$FrontendDir`" && npm.cmd run dev -- --hostname 127.0.0.1 --port $FrontendPort"
        $process = Start-Process -FilePath "cmd.exe" -ArgumentList $cmdLine -WindowStyle Normal -PassThru
    }
    Set-Content -Path $FrontendPidFile -Value $process.Id -Encoding UTF8
    Write-Host "[frontend] started pid=$($process.Id) log=$FrontendLog"
}

try {
    if ($Restart) {
        Stop-PidFileProcess "backend" $BackendPidFile
        Stop-PidFileProcess "frontend" $FrontendPidFile

        $backendPortPid = Get-ListeningPortPid $BackendPort
        if ($backendPortPid) { Stop-ProcessTree "backend-port-$BackendPort" $backendPortPid }

        $frontendPortPid = Get-ListeningPortPid $FrontendPort
        if ($frontendPortPid) { Stop-ProcessTree "frontend-port-$FrontendPort" $frontendPortPid }
    }

    Start-Backend
    Wait-Until { Test-BackendReady $BackendBaseUrl } "backend" $TimeoutSeconds

    Start-Frontend
    Wait-Until { Test-FrontendReady $FrontendUrl } "frontend" $TimeoutSeconds

    Write-Host ""
    Write-Host "Local web services are ready:" -ForegroundColor Green
    Write-Host ("Frontend: " + $FrontendUrl)
    Write-Host ("Backend: " + $BackendBaseUrl + "/ping")
    if ($Hidden) {
        Write-Host "Mode: hidden background windows"
    } else {
        Write-Host "Mode: visible interactive windows"
    }
    Write-Host ""
    Write-Host "Stop services: powershell -ExecutionPolicy Bypass -File scripts\dev_stop.ps1"

    if (-not $NoBrowser) {
        Start-Process $FrontendUrl | Out-Null
    }
} catch {
    Write-Host ""
    Write-Host ("Startup failed: " + $_.Exception.Message) -ForegroundColor Red
    Write-Host ("Backend log: " + $BackendLog)
    Write-Host ("Frontend log: " + $FrontendLog)
    exit 1
}
