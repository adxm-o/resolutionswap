@echo off
title ResolutionSwap
if not exist "node_modules" (
    echo  first run, installing deps...
    call npm install
)
call npm start
if %errorlevel% neq 0 (
    echo.
    echo  something went wrong, check the output above
    pause
)
