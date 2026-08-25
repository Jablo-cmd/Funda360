@echo off
title Funda360 Local Development

echo.
echo ========================================
echo        FUNDA360 LOCAL DEVELOPMENT
echo ========================================
echo.

REM ------------------------------------------------
REM Check Docker
REM ------------------------------------------------
echo [1/5] Checking Docker...

docker info >nul 2>&1

if errorlevel 1 (
    echo.
    echo ERROR: Docker is not running or Docker is not installed.
    echo.
    echo Please start Docker Desktop and run this file again.
    echo.
    pause
    exit /b 1
)

echo Docker is running.
echo.

REM ------------------------------------------------
REM Check Supabase CLI
REM ------------------------------------------------
echo [2/5] Checking Supabase CLI...

supabase --version >nul 2>&1

if errorlevel 1 (
    echo.
    echo ERROR: Supabase CLI is not installed or not available in PATH.
    echo.
    echo Install the Supabase CLI, then run this file again.
    echo.
    pause
    exit /b 1
)

echo Supabase CLI is available.
echo.

REM ------------------------------------------------
REM Check the local Supabase project has been initialised
REM ------------------------------------------------
echo [3/5] Checking Supabase project config...

if not exist "supabase\config.toml" (
    echo.
    echo ERROR: supabase\config.toml not found.
    echo.
    echo This local Supabase project has not been initialised yet.
    echo Run "supabase init" once in the repo root, then run this file again.
    echo.
    pause
    exit /b 1
)

echo Config found.
echo.

REM ------------------------------------------------
REM Check .env.local exists
REM ------------------------------------------------
echo [4/5] Checking .env.local...

if not exist ".env.local" (
    echo.
    echo ERROR: .env.local not found.
    echo.
    echo Copy .env.example to .env.local, then fill in VITE_SUPABASE_URL
    echo and VITE_SUPABASE_ANON_KEY with the values "supabase start" prints
    echo below, then run this file again.
    echo.
    pause
    exit /b 1
)

echo .env.local found.
echo NOTE: confirm VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env.local
echo match the values Supabase prints below before signing in.
echo.

REM ------------------------------------------------
REM Start local Supabase
REM ------------------------------------------------
echo [5/5] Starting local Supabase...
echo This does NOT reset your local database — existing data is kept.
echo Run "supabase db reset" yourself if you want a fresh seed instead.
echo.

supabase start

if errorlevel 1 (
    echo.
    echo ERROR: Supabase failed to start.
    echo.
    pause
    exit /b 1
)

echo.
echo Supabase is running.
echo.
echo Seeded local login accounts (supabase/seed.sql), all sharing the
echo password Funda360!LOCALDEV-ONLY-2026:
echo   super.admin@funda360.dev
echo   principal@riverside.funda360.dev
echo   teacher@riverside.funda360.dev
echo.

REM ------------------------------------------------
REM Start Funda360
REM ------------------------------------------------
echo Starting Funda360...
echo.
echo Funda360 will be available at:
echo.
echo     http://localhost:5173
echo.
echo Press CTRL+C to stop the development server.
echo.

npm run dev

pause
