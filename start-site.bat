@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel%==0 (
  py -3 "%~dp0server.py" %*
  goto :end
)

where python >nul 2>nul
if %errorlevel%==0 (
  python "%~dp0server.py" %*
  goto :end
)

where node >nul 2>nul
if %errorlevel%==0 (
  node "%~dp0server.js" %*
  goto :end
)

echo Neither Python 3 nor Node.js was found.
echo Please install Node.js from https://nodejs.org/ or Python from https://www.python.org/
pause

:end
endlocal
