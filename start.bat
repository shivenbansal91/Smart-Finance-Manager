@echo off
title Smart Finance Manager
color 0A
cls
echo.
echo  ============================================================
echo   SMART FINANCE MANAGER  ^|  DBMS Mini Project
echo   Thapar Institute of Engineering ^& Technology
echo  ============================================================
echo.

:: ── Step 1: Check MySQL ─────────────────────────────────────────────────
echo  [1/3] Checking MySQL connection...
node -e "const m=require('mysql2/promise');m.createConnection({host:'localhost',user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||''}).then(c=>{console.log('  OK');c.end();process.exit(0)}).catch(e=>{if(e.code==='ECONNREFUSED'){console.error('  ERROR: MySQL is not running!');console.error('');console.error('  Fix: Press Win+R, type services.msc, find MySQL and Start it');console.error('  Or:  Run net start mysql   in an admin terminal');}else{console.error('  ERROR:',e.message);}process.exit(1);})" 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  *** Start MySQL first, then run this script again ***
    echo.
    pause
    exit /b 1
)   

:: ── Step 2: Setup DB (creates tables if they don't exist) ────────────────
echo.
echo  [2/3] Setting up database...
cd /d "%~dp0server"
node setup.js
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  *** Database setup failed. Check the error above. ***
    pause
    exit /b 1
)

:: ── Step 3: Start servers ────────────────────────────────────────────────
echo.
echo  [3/3] Starting servers...
echo.
start "Smart Finance API (port 3001)" cmd /k "cd /d %~dp0server && node server.js"
timeout /t 2 /nobreak >nul
start "Smart Finance Frontend (port 8080)" cmd /k "cd /d %~dp0 && npm run dev"
timeout /t 3 /nobreak >nul

echo.
echo  ============================================================
echo   App is running!
echo.
echo   Frontend  →  http://localhost:8080
echo   API       →  http://localhost:3001
echo  ============================================================
echo.
echo  (You can close this window — the server windows stay open)
pause
