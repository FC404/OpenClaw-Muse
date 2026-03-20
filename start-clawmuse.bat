@echo off
setlocal

set "APP_DIR=%~dp0"
if "%APP_DIR:~-1%"=="\" set "APP_DIR=%APP_DIR:~0,-1%"
set "VOICE_DIR=D:\openxData\GPT-SoVITS-Package\GPT-SoVITS-v3lora-20250228"
set "VOICE_PY=%VOICE_DIR%\runtime\python.exe"
set "VOICE_API=%VOICE_DIR%\api_v2.py"
set "VOICE_CONFIG=%VOICE_DIR%\GPT_SoVITS\configs\tts_infer.yaml"

if not exist "%APP_DIR%\package.json" (
  echo [ClawMuse] App directory is missing or package.json was not found:
  echo %APP_DIR%
  pause
  exit /b 1
)

if not exist "%VOICE_PY%" (
  echo [ClawMuse] GPT-SoVITS runtime\python.exe was not found:
  echo %VOICE_DIR%
  pause
  exit /b 1
)

if not exist "%VOICE_API%" (
  echo [ClawMuse] GPT-SoVITS api_v2.py was not found:
  echo %VOICE_API%
  pause
  exit /b 1
)

if not exist "%VOICE_CONFIG%" (
  echo [ClawMuse] GPT-SoVITS config file was not found:
  echo %VOICE_CONFIG%
  pause
  exit /b 1
)

echo [ClawMuse] Stopping stale services on ports 9880 and 8787...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ports = 9880, 8787;" ^
  "foreach ($port in $ports) {" ^
  "  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object {" ^
  "    try { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } catch {}" ^
  "  }" ^
  "}"

echo [ClawMuse] Cleaning GPT-SoVITS cache...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$root = '%VOICE_DIR%';" ^
  "$cacheDirs = Get-ChildItem -Path $root -Recurse -Force -Directory -Filter '__pycache__' -ErrorAction SilentlyContinue;" ^
  "$pyFiles = Get-ChildItem -Path $root -Recurse -Force -File -Include '*.pyc','*.pyo' -ErrorAction SilentlyContinue;" ^
  "if ($cacheDirs) { $cacheDirs | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue; }" ^
  "if ($pyFiles) { $pyFiles | Remove-Item -Force -ErrorAction SilentlyContinue; }" ^
  "if (Test-Path (Join-Path $root 'TEMP')) { Get-ChildItem -Path (Join-Path $root 'TEMP') -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue; }" ^
  "if (Test-Path (Join-Path $root 'logs')) { Get-ChildItem -Path (Join-Path $root 'logs') -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue; }" ^
  "if (Test-Path (Join-Path $root 'output')) { Get-ChildItem -Path (Join-Path $root 'output') -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue; }"

echo [ClawMuse] Starting GPT-SoVITS voice service...
set "PYTHONDONTWRITEBYTECODE=1"
start "ClawMuse Voice" /D "%VOICE_DIR%" "%VOICE_PY%" -B "%VOICE_API%" -a 127.0.0.1 -p 9880 -c GPT_SoVITS/configs/tts_infer.yaml

timeout /t 3 /nobreak >nul

echo [ClawMuse] Starting app service...
start "ClawMuse App" cmd /k "cd /d ""%APP_DIR%"" && npm start"

timeout /t 2 /nobreak >nul

if exist "%APP_DIR%\open-clawmuse-desktop.bat" (
  call "%APP_DIR%\open-clawmuse-desktop.bat"
)

echo.
echo [ClawMuse] Both services were launched:
echo   - Voice service: http://127.0.0.1:9880
echo   - App service:   http://127.0.0.1:8787
echo   - Desktop window: launched if Edge/Chrome was found
echo.
echo If OpenClaw Gateway is not running yet, chat requests will still fail.
echo.
pause
