param(
    [switch]$InstallMissing,
    [switch]$DirOnly,
    [switch]$SkipBackend
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$OutputEncoding = [Console]::OutputEncoding

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$FrontendDir = Join-Path $ProjectRoot "desktop_app\frontend"
$ElectronDir = Join-Path $ProjectRoot "desktop_app\electron"

function Ensure-NpmInstall([string]$Name, [string]$Directory, [string]$Marker) {
    if (Test-Path $Marker) { return }
    if (-not $InstallMissing) {
        throw "$Name dependencies are missing. Re-run with -InstallMissing."
    }
    Push-Location $Directory
    try {
        npm.cmd install
    } finally {
        Pop-Location
    }
}

Ensure-NpmInstall "frontend" $FrontendDir (Join-Path $FrontendDir "node_modules\next\package.json")
Ensure-NpmInstall "electron" $ElectronDir (Join-Path $ElectronDir "node_modules\.bin\electron-builder.cmd")

if (-not $SkipBackend) {
    $backendArgs = @()
    if ($InstallMissing) { $backendArgs += "-InstallPyInstaller" }
    powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "build_backend_exe.ps1") @backendArgs
}

Push-Location $FrontendDir
try {
    npm.cmd run build:static
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
    Pop-Location
}

Push-Location $ElectronDir
try {
    if ($DirOnly) {
        npm.cmd run pack:win
    } else {
        npm.cmd run dist:win
    }
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
    Pop-Location
}

Write-Host "[client-build] output: dist\client" -ForegroundColor Green
