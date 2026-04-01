@echo off
title ResolutionSwap - Build
echo.
echo  ResolutionSwap - Build Installer
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  node.js not found, grab it from https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do echo  found node %%v
echo.

echo  installing deps...
call npm install
if %errorlevel% neq 0 ( echo  failed & pause & exit /b 1 )

echo  generating icon...
call node scripts/gen-icon.js
if %errorlevel% neq 0 ( echo  failed & pause & exit /b 1 )

echo  building ui...
call npx vite build --config vite.config.js
if %errorlevel% neq 0 ( echo  failed & pause & exit /b 1 )

echo  packaging installer...
call npx electron-builder --win
if %errorlevel% neq 0 ( echo  failed & pause & exit /b 1 )

echo.
echo  done, installer is in the release folder
pause
