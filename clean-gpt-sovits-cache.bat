@echo off
setlocal

set "VOICE_DIR=D:\openxData\GPT-SoVITS-Package\GPT-SoVITS-v3lora-20250228"

if not exist "%VOICE_DIR%" (
  echo [ClawMuse] GPT-SoVITS directory was not found:
  echo %VOICE_DIR%
  pause
  exit /b 1
)

echo [ClawMuse] Cleaning GPT-SoVITS cache only.
echo [ClawMuse] Safe targets:
echo   - __pycache__ folders
echo   - *.pyc / *.pyo files
echo   - TEMP contents
echo   - logs contents
echo   - output contents
echo [ClawMuse] Protected:
echo   - model weights
echo   - runtime
echo   - config files
echo   - reference audio
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$root = '%VOICE_DIR%';" ^
  "$cacheDirs = Get-ChildItem -Path $root -Recurse -Force -Directory -Filter '__pycache__' -ErrorAction SilentlyContinue;" ^
  "$pyFiles = Get-ChildItem -Path $root -Recurse -Force -File -Include '*.pyc','*.pyo' -ErrorAction SilentlyContinue;" ^
  "$tempFiles = @(); if (Test-Path (Join-Path $root 'TEMP')) { $tempFiles += Get-ChildItem -Path (Join-Path $root 'TEMP') -Force -ErrorAction SilentlyContinue; }" ^
  "$logFiles = @(); if (Test-Path (Join-Path $root 'logs')) { $logFiles += Get-ChildItem -Path (Join-Path $root 'logs') -Force -ErrorAction SilentlyContinue; }" ^
  "$outFiles = @(); if (Test-Path (Join-Path $root 'output')) { $outFiles += Get-ChildItem -Path (Join-Path $root 'output') -Force -ErrorAction SilentlyContinue; }" ^
  "$beforeDirs = $cacheDirs.Count;" ^
  "$beforePy = $pyFiles.Count;" ^
  "$cacheBytes = ($cacheDirs | ForEach-Object { (Get-ChildItem -Path $_.FullName -Recurse -Force -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum } | Measure-Object -Sum).Sum;" ^
  "$pyBytes = ($pyFiles | Measure-Object Length -Sum).Sum;" ^
  "$tempBytes = ($tempFiles | Where-Object { -not $_.PSIsContainer } | Measure-Object Length -Sum).Sum;" ^
  "$logBytes = ($logFiles | Where-Object { -not $_.PSIsContainer } | Measure-Object Length -Sum).Sum;" ^
  "$outBytes = ($outFiles | Where-Object { -not $_.PSIsContainer } | Measure-Object Length -Sum).Sum;" ^
  "Write-Host ('[ClawMuse] __pycache__ dirs: ' + $beforeDirs);" ^
  "Write-Host ('[ClawMuse] .pyc/.pyo files: ' + $beforePy);" ^
  "Write-Host ('[ClawMuse] Cache size before cleanup: ' + [math]::Round((($cacheBytes + $pyBytes + $tempBytes + $logBytes + $outBytes) / 1MB), 2) + ' MB');" ^
  "if ($cacheDirs) { $cacheDirs | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue; }" ^
  "if ($pyFiles) { $pyFiles | Remove-Item -Force -ErrorAction SilentlyContinue; }" ^
  "if (Test-Path (Join-Path $root 'TEMP')) { Get-ChildItem -Path (Join-Path $root 'TEMP') -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue; }" ^
  "if (Test-Path (Join-Path $root 'logs')) { Get-ChildItem -Path (Join-Path $root 'logs') -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue; }" ^
  "if (Test-Path (Join-Path $root 'output')) { Get-ChildItem -Path (Join-Path $root 'output') -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue; }" ^
  "$remainDirs = (Get-ChildItem -Path $root -Recurse -Force -Directory -Filter '__pycache__' -ErrorAction SilentlyContinue).Count;" ^
  "$remainPy = (Get-ChildItem -Path $root -Recurse -Force -File -Include '*.pyc','*.pyo' -ErrorAction SilentlyContinue).Count;" ^
  "Write-Host ('[ClawMuse] Remaining __pycache__ dirs: ' + $remainDirs);" ^
  "Write-Host ('[ClawMuse] Remaining .pyc/.pyo files: ' + $remainPy);" ^
  "Write-Host '[ClawMuse] GPT-SoVITS cache cleanup finished.'"

echo.
echo [ClawMuse] Tip:
echo   Stop the GPT-SoVITS service first for the cleanest result.
echo   Start it again with start-clawmuse.bat after cleanup.
echo.
pause
