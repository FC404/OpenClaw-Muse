@echo off
setlocal

set "APP_DIR=%~dp0"
if "%APP_DIR:~-1%"=="\" set "APP_DIR=%APP_DIR:~0,-1%"

if not exist "%APP_DIR%\package.json" (
  echo [ClawMuse] package.json was not found:
  echo %APP_DIR%
  pause
  exit /b 1
)

if exist "%APP_DIR%\launch-clawmuse-electron.vbs" (
  wscript //nologo "%APP_DIR%\launch-clawmuse-electron.vbs"
) else (
  start "ClawMuse Electron" cmd /c "cd /d ""%APP_DIR%"" && npm run desktop"
)

endlocal
