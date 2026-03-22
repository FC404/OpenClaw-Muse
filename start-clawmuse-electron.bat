@echo off
setlocal

set "APP_DIR=%~dp0"
if "%APP_DIR:~-1%"=="\" set "APP_DIR=%APP_DIR:~0,-1%"
set "ELECTRON_EXE=%APP_DIR%\node_modules\electron\dist\electron.exe"
set "NPM_CMD=D:\develop\NodeJS\npm.cmd"
set "CLEANUP_SCRIPT=%APP_DIR%\cleanup-clawmuse-processes.ps1"

if not exist "%APP_DIR%\package.json" (
  echo [ClawMuse] package.json was not found:
  echo %APP_DIR%
  pause
  exit /b 1
)

if exist "%CLEANUP_SCRIPT%" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%CLEANUP_SCRIPT%" -AppDir "%APP_DIR%"
)

if exist "%ELECTRON_EXE%" (
  start "OpenClaw-Muse" "%ELECTRON_EXE%" "%APP_DIR%"
) else if exist "%APP_DIR%\launch-clawmuse-electron.vbs" (
  wscript //nologo "%APP_DIR%\launch-clawmuse-electron.vbs"
) else if exist "%NPM_CMD%" (
  start "OpenClaw-Muse" cmd /c "cd /d ""%APP_DIR%"" && ""%NPM_CMD%"" run desktop"
) else (
  echo [ClawMuse] Electron executable and npm.cmd were not found.
  pause
  exit /b 1
)

endlocal
