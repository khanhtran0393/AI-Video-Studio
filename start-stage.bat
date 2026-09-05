@echo off
setlocal EnableExtensions

set "ROOT=%~dp0"

if "%~1"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%start-stage-ui.ps1"
  exit /b %ERRORLEVEL%
)

set "ARG1=%~1"
if /I "%ARG1%"=="gui" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%start-stage-ui.ps1"
  exit /b %ERRORLEVEL%
)

if /I "%ARG1%"=="-gui" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%start-stage-ui.ps1"
  exit /b %ERRORLEVEL%
)

if /I "%ARG1%"=="/gui" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%start-stage-ui.ps1"
  exit /b %ERRORLEVEL%
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%start-stage.ps1" %*
