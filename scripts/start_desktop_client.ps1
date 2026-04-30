param(
    [int]$FrontendPort = 3000,
    [int]$BackendPort = 8765,
    [int]$TimeoutSeconds = 60,
    [switch]$Restart
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$OutputEncoding = [Console]::OutputEncoding

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$FrontendDir = Join-Path $ProjectRoot "desktop_app\frontend"
$ElectronDir = Join-Path $ProjectRoot "desktop_app\electron"
$StateDir = Join-Path $ProjectRoot "wechat_ai\data\app\processes"
$LogDir = Join-Path $ProjectRoot "wechat_ai\data\app\logs"
$FrontendPidFile = Join-Path $StateDir "frontend.pid"
$DesktopPidFile = Join-Path $StateDir "desktop-client.pid"
$FrontendLog = Join-Path $LogDir "frontend_$FrontendPort.log"
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

function Ensure-NpmDependencies([string]$Name, [string]$Directory, [string]$MarkerPath) {
    if (Test-Path $MarkerPath) { return }
    Write-Host "[$Name] dependencies missing, running npm install..."
    Push-Location $Directory
    try {
        npm.cmd install
    } finally {
        Pop-Location
    }
    if (-not (Test-Path $MarkerPath)) {
        throw "$Name dependencies are still missing after npm install"
    }
}

function Start-Frontend() {
    $existingPid = Get-ListeningPortPid $FrontendPort
    if ($existingPid) {
        Set-Content -Path $FrontendPidFile -Value $existingPid -Encoding UTF8
        Write-Host "[frontend] already listening pid=$existingPid"
        return
    }

    $cmdLine = "/k cd /d `"$FrontendDir`" && npm.cmd run dev -- --hostname 127.0.0.1 --port $FrontendPort"
    $process = Start-Process -FilePath "cmd.exe" -ArgumentList $cmdLine -WindowStyle Normal -PassThru
    Set-Content -Path $FrontendPidFile -Value $process.Id -Encoding UTF8
    Write-Host "[frontend] started pid=$($process.Id) log=$FrontendLog"
}

function Start-DesktopClient() {
    $cmdLine = "/k cd /d `"$ElectronDir`" && set WECHAT_AI_FRONTEND_URL=$FrontendUrl&& set WECHAT_AI_BACKEND_VISIBLE=1&& set WECHAT_AI_BACKEND_PORT=$BackendPort&& npm.cmd run dev"
    $process = Start-Process -FilePath "cmd.exe" -ArgumentList $cmdLine -WindowStyle Normal -PassThru
    Set-Content -Path $DesktopPidFile -Value $process.Id -Encoding UTF8
    Write-Host "[desktop] started pid=$($process.Id)"
}

try {
    Ensure-NpmDependencies "frontend" $FrontendDir (Join-Path $FrontendDir "node_modules\next\package.json")
    Ensure-NpmDependencies "desktop" $ElectronDir (Join-Path $ElectronDir "node_modules\.bin\electron.cmd")

    if ($Restart) {
        Stop-PidFileProcess "desktop" $DesktopPidFile
        Stop-PidFileProcess "frontend" $FrontendPidFile

        $frontendPortPid = Get-ListeningPortPid $FrontendPort
        if ($frontendPortPid) { Stop-ProcessTree "frontend-port-$FrontendPort" $frontendPortPid }
    }

    Start-Frontend
    Wait-Until { Test-FrontendReady $FrontendUrl } "frontend" $TimeoutSeconds
    Start-DesktopClient

    Write-Host ""
    Write-Host "Desktop test client is starting:" -ForegroundColor Green
    Write-Host ("Frontend: " + $FrontendUrl)
    Write-Host ("Backend:  started from the client when clicking 启动本地服务")
    Write-Host "Backend mode: visible desktop session"
    Write-Host ""
    Write-Host "Usage:"
    Write-Host "1. Wait for the Electron window to open."
    Write-Host "2. Click 启动本地服务 on the home page."
    Write-Host "3. Click 检测微信环境."
    Write-Host "4. Click 确认开始自动回复 after the check passes."
} catch {
    Write-Host ""
    Write-Host ("Desktop client startup failed: " + $_.Exception.Message) -ForegroundColor Red
    Write-Host ("Frontend log: " + $FrontendLog)
    exit 1
}
