"""Tải checkpoint viXTTS (XTTS-v2 finetune tiếng Việt) về data/models/viXTTS.

Chạy:  python scripts/download_vixtts.py
Sau đó:  VOICE_TTS_ENGINE=xtts VOICE_XTTS_DIR=<đường-dẫn> scripts/run.sh
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / "data" / "models" / "viXTTS"
REPO = "capleaf/viXTTS"
FILES = ["config.json", "vocab.json", "model.pth", "speakers_xtts.pth"]


def main() -> None:
    try:
        from huggingface_hub import hf_hub_download
    except ImportError:
        print("Thiếu huggingface_hub. Cài: pip install huggingface_hub")
        sys.exit(1)

    DEST.mkdir(parents=True, exist_ok=True)
    for fn in FILES:
        print(f"⬇ {fn} …", flush=True)
        try:
            hf_hub_download(repo_id=REPO, filename=fn, local_dir=str(DEST))
        except Exception as e:
            # speakers_xtts.pth có thể không bắt buộc ở mọi bản
            print(f"  (bỏ qua {fn}: {e})")
    print(f"\n✅ Xong. Đặt biến môi trường:\n  export VOICE_XTTS_DIR={DEST}")


if __name__ == "__main__":
    main()
