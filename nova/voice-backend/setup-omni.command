#!/usr/bin/env bash
# ============================================================
#  Cài backend giọng nói OmniVoice cho Nova Studio (macOS)
#  TỰ ĐỘNG: tìm/cài Python 3.11 → tạo venv → cài thư viện AI.
# ============================================================
set -e
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
echo "============================================================"
echo "  Cài giọng nói AI (OmniVoice) cho Nova Studio"
echo "============================================================"
echo ""

echo "[1/3] Kiểm tra Python 3.11 ..."
PY=""
command -v python3.11 >/dev/null 2>&1 && PY=python3.11

if [ -z "$PY" ]; then
  echo "    Chưa có Python 3.11 → thử cài tự động qua Homebrew ..."
  if command -v brew >/dev/null 2>&1; then
    brew install python@3.11 || true
    for p in python3.11 /opt/homebrew/bin/python3.11 /usr/local/bin/python3.11; do
      command -v "$p" >/dev/null 2>&1 && { PY="$p"; break; }
    done
  fi
fi

if [ -z "$PY" ]; then
  echo ""
  echo "[LỖI] Chưa cài được Python 3.11 tự động."
  echo "Cài Homebrew (https://brew.sh) rồi chạy lại, hoặc: brew install python@3.11"
  echo ""
  read -n1 -r -p "Nhấn phím bất kỳ để đóng..."
  exit 1
fi
echo "    Dùng: $($PY --version)"

echo ""
echo "[2/3] Tạo môi trường .venv-omni ..."
[ -d .venv-omni ] || "$PY" -m venv .venv-omni
source .venv-omni/bin/activate
pip install -U pip -q

echo ""
echo "[3/3] Cài thư viện AI (torch, omnivoice… nặng ~2GB, chờ vài phút) ..."
pip install "fastapi>=0.110" "uvicorn[standard]" python-multipart torch==2.8.0 torchaudio==2.8.0 omnivoice num2words

echo ""
echo "==================== XONG! ===================="
echo "Quay lại Nova Studio → tab 'Tạo giọng nói' → bấm 'Kiểm tra lại'."
echo "(Lần đầu tạo giọng, model sẽ tự tải ~vài GB từ Hugging Face.)"
echo "=============================================="
read -n1 -r -p "Nhấn phím bất kỳ để đóng..."
