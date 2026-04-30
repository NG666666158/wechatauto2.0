param(
    [string]$OutputDir = "dist\backend",
    [switch]$InstallPyInstaller
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$OutputEncoding = [Console]::OutputEncoding

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$Entry = Join-Path $ProjectRoot "scripts\backend_entry.py"
$BuildRoot = Join-Path $ProjectRoot ".tmp\pyinstaller-backend"
$SpecDir = Join-Path $BuildRoot "spec"
$WorkDir = Join-Path $BuildRoot "work"
$DistDir = Join-Path $ProjectRoot $OutputDir

function Test-PyInstallerAvailable {
    try {
        py -3 -m PyInstaller --version *> $null
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

if (-not (Test-PyInstallerAvailable)) {
    if (-not $InstallPyInstaller) {
        throw "PyInstaller is not installed. Re-run with -InstallPyInstaller or install it with: py -3 -m pip install pyinstaller"
    }
    py -3 -m pip install pyinstaller
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

New-Item -ItemType Directory -Force -Path $SpecDir, $WorkDir, $DistDir | Out-Null

$args = @(
    "--noconfirm",
    "--clean",
    "--name", "wechat-ai-backend",
    "--distpath", $DistDir,
    "--workpath", $WorkDir,
    "--specpath", $SpecDir,
    "--hidden-import", "win32timezone",
    "--hidden-import", "pythoncom",
    "--hidden-import", "pywintypes",
    "--hidden-import", "uvicorn.loops.auto",
    "--hidden-import", "uvicorn.protocols.http.auto",
    "--hidden-import", "uvicorn.protocols.websockets.auto",
    "--hidden-import", "uvicorn.lifespan.on",
    "--collect-submodules", "wechat_ai",
    "--collect-submodules", "pyweixin",
    "--collect-submodules", "pywechat",
    "--collect-all", "docx",
    "--collect-all", "pypdf",
    "--collect-all", "lxml",
    "--hidden-import", "docx",
    "--hidden-import", "docx.document",
    "--hidden-import", "docx.oxml",
    "--hidden-import", "pypdf",
    "--hidden-import", "lxml",
    "--hidden-import", "lxml.etree",
    $Entry
)

py -3 -m PyInstaller @args
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$Exe = Join-Path $DistDir "wechat-ai-backend\wechat-ai-backend.exe"
if (-not (Test-Path $Exe)) {
    throw "Backend exe was not created: $Exe"
}

Write-Host "[backend-build] $Exe" -ForegroundColor Green
