@echo off
REM ============================================================
REM  Khoi dong AI Video Studio (Windows) - TU AN CONSOLE
REM  TU DONG: an cua so console -> kiem tra Node -> cai depend
REM  (neu thieu) -> chuan bi backend giong noi OmniVoice -> mo app.
REM
REM  Cach chay:
REM    start.bat            : chay AN CONSOLE (mac dinh)
REM                           log duoc ghi tai start-hidden.log
REM    start.bat --show     : chay HIEN CONSOLE nhu cu (de debug)
REM    start.bat --hidden   : che do an - do noi bo tu dong goi
REM
REM  Khi an console: khong hien cua so den, loi nghiem trong
REM  se hien hop thoai canh bao, chi tiet xem start-hidden.log.
REM  Sau khi app mo: tab "Tao giong noi" -> bam "Kiem tra lai".
REM ============================================================
setlocal
cd /d "%~dp0"

REM ---- Tu dong chay lai o che do AN CONSOLE khi goi binh thuong ----
if /i "%~1"=="" (
  where powershell >nul 2>nul
  if not errorlevel 1 (
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -ArgumentList '--hidden' -WindowStyle Hidden"
    exit /b 0
  )
  REM Khong co PowerShell -> chay hien console binh thuong
)

if /i "%~1"=="--hidden" (
  set "HIDE=1"
  set "LOG=%~dp0start-hidden.log"
) else (
  set "HIDE="
)
if defined HIDE type nul > "%LOG%"

call :log ============================================================
call :log   Khoi dong AI Video Studio - %date% %time%
call :log   Che do: %~1
call :log ============================================================

REM ---- Kiem tra Node.js ----
where node >nul 2>nul
if %errorlevel% neq 0 (
  call :log [LOI] Chua cai Node.js. Tai va cai tu https://nodejs.org/ - chon ban LTS.
  call :alert "Loi: Chua cai Node.js. Vui long cai Node.js ban LTS tai nodejs.org roi chay lai file nay."
  if not defined HIDE pause
  exit /b 1
)
for /f "delims=" %%v in ('node -v') do call :log     Node: %%v

REM ---- Cai depend neu thieu ----
if not exist "node_modules\" (
  call :log
  call :log Dang cai thu vien lan dau - cho vai phut ...
  if defined HIDE (
    call npm install >> "%LOG%" 2>&1
  ) else (
    call npm install
  )
  if errorlevel 1 (
    call :log
    call :log [LOI] Cai thu vien that bai. Kiem tra mang roi chay lai.
    call :alert "Loi: Cai thu vien npm that bai. Xem file start-hidden.log de biet chi tiet."
    if not defined HIDE pause
    exit /b 1
  )
)

REM ============================================================
REM  [TTS] Chuan bi backend giong noi (OmniVoice)
REM  App doc backend tu nova\voice-studio:
REM    - co backend\app.py  -> backend FastAPI
REM    - co .venv-omni      -> engine OmniVoice (giong noi that)
REM ============================================================
set "VROOT=%~dp0nova\voice-studio"

if not exist "%VROOT%\backend\app.py" (
  if not exist "%~dp0nova\voice-backend\backend\app.py" (
    call :log [CANH BAO] Khong thay nguon backend nova\voice-backend - TTS chi chay che do test.
    goto :openapp
  )
  call :log
  call :log [1/2] Dang cai backend giong noi vao nova\voice-studio ...
  robocopy "%~dp0nova\voice-backend" "%VROOT%" /E /XD __pycache__ .venv-omni /NFL /NDL /NJH /NJS /NP >nul
  if errorlevel 8 (
    call :log [CANH BAO] Chep backend that bai - TTS chi chay che do test.
    goto :openapp
  )
  call :log       Da chep backend giong noi.
)

REM Cho neu uv dang cai thu vien AI o nen (tranh cai song song trung lap)
:waituv
tasklist /FI "IMAGENAME eq uv.exe" 2>nul | find /I "uv.exe" >nul
if not errorlevel 1 (
  call :log     Dang cai thu vien AI o nen - cho 15 giay roi kiem tra lai ...
  timeout /t 15 /nobreak >nul
  goto :waituv
)

REM Engine OmniVoice chi san sang khi venv CO package omnivoice
REM (chi co python.exe la chua du - co the ven moi tao, thu vien chua xong)
if not exist "%VROOT%\.venv-omni\Lib\site-packages\omnivoice\" (
  if exist "%VROOT%\.omni-dang-cai" (
    call :log
    call :log [TTS] OmniVoice dang duoc cai o cua so rieng - bo qua lan nay.
    goto :openapp
  )
  call :log
  call :log [TTS] Lan dau tien: cai OmniVoice CHAY NGAM khong chan app.
  call :log       Cua so rieng se tu cai Python 3.11 + thu vien AI khoang 1-2GB.
  call :log       Trong luc cho: app van mo va dung binh thuong; TTS tam
  call :log       chay che do test. Cai xong thi giong noi that san sang lan sau.
  call :log       Xem tien trinh o cua so "Cai dat OmniVoice" tren thanh taskbar.
  call :log
  type nul > "%VROOT%\.omni-dang-cai"
  start "Cai dat OmniVoice - tien trinh rieng" /min cmd /c ""%VROOT%\setup-omni.bat" & del "%VROOT%\.omni-dang-cai""
) else (
  call :log
  call :log [TTS] Backend giong noi OmniVoice: DA SAN SANG.
)

:openapp
call :log
call :log Dang mo ung dung ...
call :log Trong app: tab "Tao giong noi" - bam "Kiem tra lai" de bat backend.
call :log Lan dau tao giong noi that, model OmniVoice tu tai tu Hugging Face
call :log khoang vai GB - cho vai phut.
call :log
if defined HIDE (
  call npm start >> "%LOG%" 2>&1
) else (
  call npm start
)
if errorlevel 1 (
  call :log
  call :log [LOI] App dong kem ma loi. Xem chi tiet trong log.
  if defined HIDE call :alert "Loi: Ung dung dong kem ma loi. Xem file start-hidden.log de biet chi tiet."
  if not defined HIDE pause
)

call :log
call :log Ket thuc lan chay nay.
exit /b 0

REM ============================================================
REM  Ham phu tro
REM ============================================================

REM ---- :log  ghi log: ra file khi an console, ra man hinh khi --show ----
:log
if defined HIDE (>>"%LOG%" echo(%*) else echo(%*
exit /b 0

REM ---- :alert  hien hop thoai canh bao LOI khi dang an console ----
:alert
if defined HIDE powershell -NoProfile -Command "(New-Object -ComObject WScript.Shell).Popup('%~1',0,'AI Video Studio',16)" >nul 2>nul
exit /b 0