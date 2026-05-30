@echo off
setlocal

set "ROOT=C:\Users\naudi\OneDrive\workspace\FinancialPlanning"
set "UI_DIR=%ROOT%\FinancialPlanningUI"
set "NPM=C:\Program Files\nodejs\npm.cmd"

if not exist "%NPM%" (
  echo npm not found at "%NPM%"
  exit /b 1
)

if not exist "%UI_DIR%\package.json" (
  echo UI package.json not found at "%UI_DIR%\package.json"
  exit /b 1
)

cd /d "%UI_DIR%"

echo Installing UI dependencies...
call "%NPM%" install
if errorlevel 1 exit /b 1

echo Building UI...
call "%NPM%" run build
if errorlevel 1 exit /b 1

echo Starting UI dev server...
call "%NPM%" run dev
if errorlevel 1 exit /b 1

endlocal
