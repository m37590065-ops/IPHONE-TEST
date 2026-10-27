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

echo Python 3 is required to run the local server.
echo Install it from https://www.python.org/downloads/ and try again.
pause

:end
endlocal
