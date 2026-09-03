@echo off
REM ============================================================
REM  Cai backend giong noi (OmniVoice + VieNeu + XTTS) cho Nova Studio (Windows)
REM  TU DONG: tim/cai Python 3.11 -> tao venv -> cai thu vien AI cho CA 3 ENGINE.
REM ============================================================
setlocal enabledelayedexpansion
cd /d "%~dp0"
echo ============================================================
echo   Cai giong noi AI (OmniVoice + VieNeu + XTTS) cho Nova Studio
echo ============================================================
echo.

echo [1/3] Kiem tra Python 3.11 ...
call :findpy
if defined PY goto haspy

echo     Chua co Python 3.11 -^> thu cai tu dong qua winget ...
where winget >nul 2>nul
if %errorlevel%==0 (
  winget install -e --id Python.Python.3.11 --accept-source-agreements --accept-package-agreements
  call :findpy
)
if defined PY goto haspy

echo.
echo [LOI] Khong tu cai duoc Python 3.11.
echo Tai thu cong: https://www.python.org/downloads/release/python-3119/
echo Khi cai NHO tick "Add python.exe to PATH", roi chay lai file nay.
echo.
pause
exit /b 1

:haspy
echo     Dung: %PY%
echo.
echo [2/3] Tao moi truong .venv-omni ...
REM Neu thu muc ton tai nhung thieu pyvenv.cfg/python.exe thi day la venv hong.
REM Xoa va tao lai de Nova khong bi ket vao moi truong nua-vung.
if exist ".venv-omni\" if not exist ".venv-omni\pyvenv.cfg\" rmdir /s /q ".venv-omni"
if exist ".venv-omni\" if not exist ".venv-omni\Scripts\python.exe\" rmdir /s /q ".venv-omni"
if not exist ".venv-omni\pyvenv.cfg\" %PY% -m venv .venv-omni
if not exist ".venv-omni\Scripts\python.exe\" (
  echo [LOI] Khong tao duoc .venv-omni hop le.
  pause
  exit /b 1
)
call ".venv-omni\Scripts\activate.bat"
python -m pip install -U pip

echo.
echo [3/3] Cai thu vien AI cho 3 engine (OmniVoice + VieNeu + XTTS) ...
echo       Nang ~2-3GB (torch, coqui-tts, vieneu, omnivoice...) - cho vai phut.
echo       Danh sach day du trong backend\requirements-ai.txt
REM uu tien "uv" neu co - tai nhanh hon pip rat nhieu voi mang yeu
where uv >nul 2>nul
if %errorlevel%==0 (
  echo     Dung uv de tai (nhanh hon) ...
  uv pip install --python ".venv-omni\Scripts\python.exe" "fastapi>=0.110" "uvicorn[standard]" python-multipart -r "backend\requirements-ai.txt"
) else (
  python -m pip install "fastapi>=0.110" "uvicorn[standard]" python-multipart -r "backend\requirements-ai.txt"
)
if errorlevel 1 (
  echo.
  echo [LOI] Cai thu vien that bai. Kiem tra mang roi chay lai file nay.
  pause
  exit /b 1
)

echo.
echo ==================== XONG! ====================
echo Da cai du 3 engine: OmniVoice + VieNeu + XTTS.
echo Quay lai Nova Studio -^> tab "Tao giong noi" -^> bam "Kiem tra lai".
echo (Lan dau tao giong, tung model se tu tai ~vai GB tu Hugging Face.)
echo ==============================================
pause
exit /b 0

REM ---- Ham: tim Python 3.11, tra ket qua vao bien PY ----
:findpy
set "PY="
where py >nul 2>nul && ( py -3.11 -c "print(1)" >nul 2>nul && set "PY=py -3.11" )
if not defined PY if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" set "PY=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
if not defined PY (
  for /f "delims=" %%p in ('where python 2^>nul') do (
    "%%p" -c "import sys;exit(0 if sys.version_info[:2]==(3,11) else 1)" >nul 2>nul && set "PY=%%p"
  )
)
REM Python do uv (Astral) quan ly — ban day du, khong can cai them
if not defined PY if exist "%APPDATA%\uv\python\cpython-3.11*" for /d %%d in ("%APPDATA%\uv\python\cpython-3.11*") do (
  if exist "%%d\python.exe" set "PY=%%d\python.exe"
)
exit /b
