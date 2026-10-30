@echo off
setlocal
set /p PROJECT_NODE_VERSION=<"%~dp0.nvmrc"
if not defined NVM_HOME set "NVM_HOME=%LOCALAPPDATA%\nvm"
set "PROJECT_NODE_ROOT=%NVM_HOME%\v%PROJECT_NODE_VERSION%"
if not exist "%PROJECT_NODE_ROOT%\node.exe" (
  echo Install the pinned version first: nvm install %PROJECT_NODE_VERSION%
  exit /b 1
)
set "PATH=%PROJECT_NODE_ROOT%;%PATH%"
set "PROJECT_TASK=%~1"
if not defined PROJECT_TASK set "PROJECT_TASK=start"
pushd "%~dp0"
if "%PROJECT_TASK%"=="install" (
  call "%PROJECT_NODE_ROOT%\npm.cmd" ci
) else (
  call "%PROJECT_NODE_ROOT%\npm.cmd" run "%PROJECT_TASK%"
)
set "PROJECT_EXIT=%ERRORLEVEL%"
popd
exit /b %PROJECT_EXIT%
