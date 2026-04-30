param(
    [string]$SourceDir = "dist\client\win-unpacked",
    [string]$OutputDir = "dist\client"
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$OutputEncoding = [Console]::OutputEncoding

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$FullSourceDir = Join-Path $ProjectRoot $SourceDir
$FullOutputDir = Join-Path $ProjectRoot $OutputDir
$ZipPath = Join-Path $FullOutputDir "WeChatAI-TestClient-win-x64.zip"

if (-not (Test-Path $FullSourceDir)) {
    throw "Client directory does not exist: $FullSourceDir"
}

New-Item -ItemType Directory -Force -Path $FullOutputDir | Out-Null
if (Test-Path $ZipPath) {
    Remove-Item $ZipPath -Force
}

Compress-Archive -Path (Join-Path $FullSourceDir "*") -DestinationPath $ZipPath -Force
Write-Host "[client-zip] $ZipPath" -ForegroundColor Green
