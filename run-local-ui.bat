@echo off
setlocal

set "UI_DIR=%~dp0"
set "PORT=5173"
set "NPM=C:\Program Files\nodejs\npm.cmd"
set "PACKAGE_JSON=%UI_DIR%package.json"

if not exist "%PACKAGE_JSON%" (
  echo UI package.json not found at "%PACKAGE_JSON%"
  exit /b 1
)

if not exist "%NPM%" (
  where npm >nul 2>nul
  if errorlevel 1 (
    echo npm not found at "%NPM%" and is not available on PATH.
    exit /b 1
  )
  set "NPM=npm"
)

set "PID="
for /f %%P in ('powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess)"') do set "PID=%%P"

if defined PID (
  echo Found process listening on port %PORT% with PID %PID%.
  powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter 'ProcessId = %PID%' | Select-Object ProcessId, Name, CommandLine | Format-List"
  echo Stopping PID %PID% so port %PORT% is free...
  taskkill /PID %PID% /F
  if errorlevel 1 exit /b 1
) else (
  echo No process is listening on port %PORT%.
)

cd /d "%UI_DIR%"

echo Running UI build...
call "%NPM%" run build
if errorlevel 1 exit /b 1

echo Starting UI dev server locally...
call "%NPM%" run dev
if errorlevel 1 exit /b 1

endlocal