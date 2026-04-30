$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$OutputEncoding = [Console]::OutputEncoding

$FrontendRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$OutDir = Join-Path $FrontendRoot "out"
$ExportDir = Join-Path $FrontendRoot ".next-export"
$ArtifactsDir = Join-Path $FrontendRoot "build-artifacts"
$TsconfigPath = Join-Path $FrontendRoot "tsconfig.json"
$OriginalTsconfig = Get-Content -Raw -Encoding utf8 $TsconfigPath

New-Item -ItemType Directory -Force -Path $ArtifactsDir | Out-Null
if (Test-Path $OutDir) {
  Remove-Item $OutDir -Recurse -Force
}
if (Test-Path $ExportDir) {
  Remove-Item $ExportDir -Recurse -Force
}

$env:NEXT_OUTPUT_EXPORT = "1"
$env:NEXT_DIST_DIR = ".next-export"

try {
  node .\node_modules\next\dist\bin\next build --webpack
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}
finally {
  Remove-Item Env:\NEXT_OUTPUT_EXPORT -ErrorAction SilentlyContinue
  Remove-Item Env:\NEXT_DIST_DIR -ErrorAction SilentlyContinue
  Set-Content -Path $TsconfigPath -Value $OriginalTsconfig -Encoding utf8
}

if (-not (Test-Path (Join-Path $ExportDir "index.html"))) {
  throw "Static frontend export failed: $ExportDir\index.html was not created"
}

Copy-Item -Path $ExportDir -Destination $OutDir -Recurse -Force

Set-Content -Path (Join-Path $ArtifactsDir "last-static-export-dir.txt") -Value "out" -Encoding utf8
Write-Host "[frontend-export] $OutDir" -ForegroundColor Green
