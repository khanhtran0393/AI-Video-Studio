@echo off
REM ============================================================
REM  Khoi dong AI Video Studio (Windows)
REM  TU DONG: kiem tra Node -> cai depend (neu thieu) ->
REM           chuan bi backend giong noi OmniVoice -> mo app.
REM  Sau khi app mo: tab "Tao giong noi" -> bam "Kiem tra lai".
REM ============================================================
setlocal
cd /d "%~dp0"

echo ============================================================
echo   Khoi dong AI Video Studio
echo ============================================================
echo.

REM ---- Kiem tra Node.js ----
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [LOI] Chua cai Node.js.
  echo Tai va cai tu: https://nodejs.org/  ^(chon ban LTS^)
  echo Sau khi cai xong, chay lai file nay.
  echo.
  pause
  exit /b 1
)
for /f "delims=" %%v in ('node -v') do echo     Node: %%v

REM ---- Cai depend neu thieu ----
if not exist "node_modules\" (
  echo.
  echo Dang cai thu vien lan dau ^(cho vai phut^) ...
  call npm install
  if errorlevel 1 (
    echo.
    echo [LOI] Cai thu vien that bai. Kiem tra mang roi chay lai.
    pause
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
    echo [CANH BAO] Khong thay nguon backend nova\voice-backend - TTS chi chay che do test.
    goto :openapp
  )
  echo.
  echo [1/2] Dang cai backend giong noi vao nova\voice-studio ...
  robocopy "%~dp0nova\voice-backend" "%VROOT%" /E /XD __pycache__ .venv-omni /NFL /NDL /NJH /NJS /NP >nul
  if errorlevel 8 (
    echo [CANH BAO] Chep backend that bai - TTS chi chay che do test.
    goto :openapp
  )
  echo       Da chep backend giong noi.
)

REM Cho neu uv dang cai thu vien AI o nen (tranh cai song song trung lap)
:waituv
tasklist /FI "IMAGENAME eq uv.exe" 2>nul | find /I "uv.exe" >nul
if not errorlevel 1 (
  echo     Dang cai thu vien AI o nen - cho hoan tat ^(<Enter^)/15s ...
  timeout /t 15 >nul
  goto :waituv
)

REM Engine OmniVoice chi san sang khi venv CO package omnivoice
REM (chi co python.exe la chua du - co the ven moi tao, thu vien chua xong)
if not exist "%VROOT%\.venv-omni\Lib\site-packages\omnivoice\" (
  if exist "%VROOT%\.omni-dang-cai" (
    echo.
    echo [TTS] OmniVoice dang duoc cai o cua so rieng - bo qua lan nay.
    goto :openapp
  )
  echo.
  echo [TTS] Lan dau tien: cai OmniVoice CHAY NGAM khong chan app.
  echo       Cua so rieng se tu cai Python 3.11 + thu vien AI ~1-2GB.
  echo       Trong luc cho: app van mo va dung binh thuong; TTS tam
  echo       chay che do test. Cai xong thi giong noi that san sang lan sau.
  echo       Xem tien trinh o cua so "Cai dat OmniVoice" tren thanh taskbar.
  echo.
  type nul > "%VROOT%\.omni-dang-cai"
  start "Cai dat OmniVoice - tien trinh rieng" /min cmd /c ""%VROOT%\setup-omni.bat" & del "%VROOT%\.omni-dang-cai""
) else (
  echo.
  echo [TTS] Backend giong noi OmniVoice: DA SAN SANG.
)

:openapp
echo.
echo Dang mo ung dung ...
echo Trong app: tab "Tao giong noi" -^> bam "Kiem tra lai" de bat backend.
echo (Lan dau tao giong noi that, model OmniVoice tu tai tu
echo  Hugging Face ~vai GB - cho vai phut.)
echo.
call npm start
if errorlevel 1 (
  echo.
  echo [LOI] App dong kem ma loi. Xem log o cua so dong lenh phia tren.
  pause
)

exit /b 0