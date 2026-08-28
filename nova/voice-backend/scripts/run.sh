#!/usr/bin/env bash
# Chạy Voice Studio backend + UI.
# Ưu tiên: OmniVoice (.venv-omni) > XTTS (.venv) > mock.
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR/backend"

if [ -d "$DIR/.venv-omni" ]; then
  # --- OmniVoice: engine chính (600+ ngôn ngữ, tiếng Việt native, thiết kế giọng) ---
  source "$DIR/.venv-omni/bin/activate"
  export VOICE_TTS_ENGINE="${VOICE_TTS_ENGINE:-omnivoice}"
  export VOICE_ASR_ENGINE="${VOICE_ASR_ENGINE:-mock}"
elif [ -d "$DIR/.venv" ]; then
  source "$DIR/.venv/bin/activate"
  if python -c "import torch" >/dev/null 2>&1; then
    export VOICE_TTS_ENGINE="${VOICE_TTS_ENGINE:-xtts}"
    export VOICE_ASR_ENGINE="${VOICE_ASR_ENGINE:-mlx-whisper}"
    export COQUI_TOS_AGREED=1
    [ -d "$DIR/data/models/viXTTS" ] && export VOICE_XTTS_DIR="${VOICE_XTTS_DIR:-$DIR/data/models/viXTTS}"
  else
    export VOICE_TTS_ENGINE="${VOICE_TTS_ENGINE:-mock}"
    export VOICE_ASR_ENGINE="${VOICE_ASR_ENGINE:-mock}"
  fi
else
  echo "Chưa có môi trường. Chạy scripts/setup.sh trước."
  exit 1
fi

PORT="${VOICE_PORT:-8770}"
echo "▶ Voice Studio: http://127.0.0.1:$PORT  (TTS=$VOICE_TTS_ENGINE, ASR=$VOICE_ASR_ENGINE)"
exec uvicorn app:app --host 127.0.0.1 --port "$PORT"
