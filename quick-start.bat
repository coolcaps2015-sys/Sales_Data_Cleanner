@echo off
REM quick-start.bat
REM Windows batch script for quick start

setlocal enabledelayedexpansion

echo.
echo 🚀 Sales Data App - Quick Start (Windows)
echo ==========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js is not installed!
    echo 📥 Download from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
for /f "tokens=*" %%i in ('npm -v') do set NPM_VER=%%i

echo ✅ Node.js version: %NODE_VER%
echo ✅ npm version: %NPM_VER%
echo.

REM Check if in correct directory
if not exist package.json (
    echo ❌ package.json not found!
    echo 📂 Please run this script from the project root directory
    echo.
    pause
    exit /b 1
)

echo 📦 Installing dependencies...
echo (This may take a few minutes...)
echo.
call npm install

echo.
echo ✅ Setup complete!
echo.
echo Choose an option:
echo 1 = Start local development server
echo 2 = Deploy to Vercel
echo 3 = View documentation
echo.
set /p choice=Enter your choice (1-3): 

if "%choice%"=="1" (
    echo.
    echo 🔥 Starting development server...
    echo 📍 Open: http://localhost:3000
    echo.
    call npm run dev
) else if "%choice%"=="2" (
    echo.
    echo ☁️  Deploying to Vercel...
    echo 🔗 Install Vercel CLI: npm install -g vercel
    echo 📝 Then run: vercel --prod
    echo.
    call npx vercel --prod
) else if "%choice%"=="3" (
    echo.
    echo 📖 Opening documentation...
    echo.
    start notepad README.md
    echo 📄 Also see: DEPLOYMENT_GUIDE.md
) else (
    echo ❌ Invalid choice
    pause
    exit /b 1
)

pause
