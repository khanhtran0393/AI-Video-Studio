@echo off
setlocal EnableExtensions

REM ============================================================
REM  start.bat - AI Video Studio
REM  Nhiem vu duy nhat: kiem tra moi truong roi mo app (neu mo duoc).
REM
REM  Cac buoc:
REM    1. Kiem tra Node.js va npm.
REM    2. Nap thu vien (node_modules) neu chua co.
REM    3. Nap electron neu chua co.
REM    4. Kiem tra file vao cua app (truong "main" trong package.json).
REM    5. Mo app bang "npm start".
REM
REM  Khi gap loi: in ro nguyen nhan va dung (exit code khac 0).
REM  Chay "start.bat --silent" de khong dung lai cho nhan phim khi loi.
REM ============================================================

cd /d "%~dp0"

echo.
echo [start] AI Video Studio - %date% %time%
echo [start] Thu muc lam viec: %~dp0

REM ---------- 1. Node.js ----------
where node >nul 2>nul
if errorlevel 1 goto :missing_node
for /f "delims=" %%v in ('node -v') do echo [start] Node.js: %%v

REM ---------- 2. npm ----------
where npm >nul 2>nul
if errorlevel 1 goto :missing_npm
for /f "delims=" %%v in ('npm -v') do echo [start] npm: %%v

REM ---------- 3. Thu vien va electron ----------
if not exist "node_modules\" (
  echo [start] Chua co thu vien, dang cai lan dau - cho vai phut...
  call npm install
  if errorlevel 1 goto :install_fail
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo [start] Electron chua duoc nap, dang nap electron...
  call npm install
  if errorlevel 1 goto :install_fail
)

REM ---------- 4. File vao cua app ----------
set "ENTRY="
for /f "delims=" %%m in ('node -e "try{process.stdout.write(require('./package.json').main||'')}catch(e){process.stdout.write('')}"') do set "ENTRY=%%m"
if not defined ENTRY set "ENTRY=nova\main.plain.js"
if not exist "%ENTRY%" goto :missing_entry
echo [start] File vao cua app: %ENTRY%

REM ---------- 5. Mo app ----------
echo [start] Dang mo ung dung... (dong cua so console nay se tat app)
call npm start
if errorlevel 1 goto :app_fail

echo [start] Ung dung da dong binh thuong.
exit /b 0

REM ============================================================
REM  Cac truong hop loi - in ro nguyen nhan
REM ============================================================
:missing_node
echo.
echo [LOI] Khong tim thay Node.js.
echo       Vui long cai Node.js ban LTS tai https://nodejs.org/ roi chay lai.
goto :fail

:missing_npm
echo.
echo [LOI] Khong tim thay npm. Hay cai lai Node.js de co kem npm.
goto :fail

:install_fail
echo.
echo [LOI] Nap thu vien / electron that bai. Kiem tra mang va quyen ghi,
echo       roi thu chay lai start.bat.
goto :fail

:missing_entry
echo.
echo [LOI] Khong tim thay file vao cua app: %ENTRY%
echo       Hay kiem tra lai truong "main" trong package.json.
goto :fail

:app_fail
echo.
echo [LOI] Ung dung dong kem ma loi (crash / exit code khac 0).
echo       Chi tiet co the co trong cac file npm-start*.log trong thu muc nay.
goto :fail

:fail
echo.
echo [start] KHONG the mo ung dung - xem loi ben tren.
if not "%~1"=="--silent" pause
exit /b 1