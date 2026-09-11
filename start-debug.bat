@echo off
setlocal EnableExtensions

REM ============================================================
REM  start.bat - AI Video Studio
REM  Nhiem vu: kiem tra moi truong roi mo app (neu mo duoc).
REM
REM  Cac buoc:
REM    1. Kiem tra Node.js va npm.
REM    2. Nap thu vien (node_modules) neu chua co.
REM    3. Nap electron neu chua co.
REM    4. Kiem tra file vao cua app (truong "main" trong package.json).
REM    5. Kiem tra app DA DANG CHAY qua Agent Bridge (port 47280-47283):
REM       - Neu dang chay -> focus cua so do va thoat (khong mo instance thu hai).
REM       - Neu chua chay -> khoi chay electron TACH ROI console (dong cua so
REM         console khong lam chet app), doi bridge len roi bao OK.
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

REM ---------- 5. App da dang chay chua? (ping Agent Bridge) ----------
call :probe_bridge
if not errorlevel 1 goto :already_running

REM ---------- 6. Khoi chay app (tach roi console) ----------
echo [start] Dang khoi chay ung dung (doc lap console - dong cua so nay khong tat app)...
start "" /D "%~dp0" "node_modules\electron\dist\electron.exe" . --remote-debugging-port=9334

REM Doi Agent Bridge len (toi da 30 giay) de chac chan app song that su.
set /a TRIES=0
:waitloop
call :probe_bridge
if not errorlevel 1 goto :started_ok
set /a TRIES+=1
if %TRIES% GEQ 30 goto :wait_timeout
ping -n 2 127.0.0.1 >nul
goto :waitloop

:started_ok
echo [start] Ung dung da chay (Agent Bridge lang nghe port %RUN_PORT%).
exit /b 0

:already_running
echo [start] Ung dung DANG CHAY (port %RUN_PORT%) - khong mo instance thu hai.
echo [start] Dang dua cua so app len truoc...
call :focus_bridge
if errorlevel 1 (
  echo [start] App dang chay nhung khong focus duoc cua so - hay mo thu cong.
) else (
  echo [start] Da dua cua so AI Video Studio len truoc.
)
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

REM ============================================================
REM  Thu tuc con: ping Agent Bridge tren 47280-47283
REM  Dat RUN_PORT khi tim thay; errorlevel 0 = dang chay, 1 = chua.
REM ============================================================
:probe_bridge
set "RUN_PORT="
for /f "delims=" %%p in ('node -e "const h=require('http');const ps=[47280,47281,47282,47283];let i=0;const t=()=>{if(i>=ps.length)process.exit(1);const p=ps[i++];const r=h.request({host:'127.0.0.1',port:p,path:'/agent/command',method:'POST',headers:{'Content-Type':'application/json'}},res=>{let b='';res.on('data',c=>b+=c);res.on('end',()=>{let j=null;try{j=JSON.parse(b)}catch(e){}if(j){if(j.ok){console.log(p);process.exit(0)}}t()})});r.on('error',()=>t());r.end(JSON.stringify({action:'ping'}))};t()" 2^>nul') do set "RUN_PORT=%%p"
if not defined RUN_PORT exit /b 1
exit /b 0

REM ============================================================
REM  Thu tuc con: gui lenh focus sang Agent Bridge (dung RUN_PORT)
REM ============================================================
:focus_bridge
if not defined RUN_PORT exit /b 1
node -e "const h=require('http');const r=h.request({host:'127.0.0.1',port:%RUN_PORT%,path:'/agent/command',method:'POST',headers:{'Content-Type':'application/json'}},res=>{let b='';res.on('data',c=>b+=c);res.on('end',()=>{let j=null;try{j=JSON.parse(b)}catch(e){}if(j){if(j.ok){process.exit(0)}}process.exit(1)})});r.on('error',()=>process.exit(1));r.end(JSON.stringify({action:'focus'}))"
exit /b %errorlevel%

:wait_timeout
echo.
echo [LOI] App da duoc khoi dong nhung Agent Bridge khong len sau 30 giay.
echo       Co the app chua chay den local server - kiem tra lai process electron.
goto :fail

:fail
echo.
echo [start] KHONG the mo ung dung - xem loi ben tren.
if not "%~1"=="--silent" pause
exit /b 1
