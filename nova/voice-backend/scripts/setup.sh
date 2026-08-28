#!/usr/bin/env bash
# Tạo môi trường Python và cài phụ thuộc.
#   scripts/setup.sh          -> cài bản gốc (mock, chạy được ngay)
#   scripts/setup.sh --ai     -> cài thêm model AI (cần Python 3.11)
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENV="$DIR/.venv"

MODE="${1:-base}"

# Tìm Python phù hợp. Model AI cần 3.11; bản mock chạy python nào cũng được.
PY="python3"
if [ "$MODE" = "--ai" ]; then
  for cand in python3.11 python3.12 python3.13; do
    if command -v "$cand" >/dev/null 2>&1; then PY="$cand"; break; fi
  done
  echo "Dùng $PY cho môi trường AI."
fi

if [ ! -d "$VENV" ]; then
  "$PY" -m venv "$VENV"
fi
source "$VENV/bin/activate"
pip install -U pip -q

pip install -q -r "$DIR/backend/requirements-base.txt"
if [ "$MODE" = "--ai" ]; then
  echo "Cài model AI (nặng, vài GB)…"
  pip install -r "$DIR/backend/requirements-ai.txt"
fi
echo "✅ Xong. Chạy: scripts/run.sh"
