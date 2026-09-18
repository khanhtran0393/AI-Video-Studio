#!/usr/bin/env python
# ============================================================
# HARDSUB OCR — worker nhận diện phụ đề chèn sẵn (main process gọi)
# ------------------------------------------------------------
# Nhận khung ảnh đã crop vùng phụ đề do ffmpeg trích (nova/hardsub/
# engine.js), chạy RapidOCR (PP-OCR, engine onnxruntime — cùng họ
# model PP-OCRv6 mà D:\ezmaxsub bundle) trên từng khung, ghi JSON
# kết quả per-frame.
#
# Dùng: python hardsub_ocr.py --frames-dir <dir> --out <file.json>
#                        [--min-score 0.5]
# stdout: dòng "PROG <done>/<total>" mỗi khung (progress), "OK" cuối.
# stderr: lỗi lộ liễu kèm mã HS_* — KHÔNG fallback ngầm (Luật 10).
# Exit code: 0 OK | 2 HS_OCR_MISSING | 3 HS_OCR_NO_FRAMES |
#            4 HS_OCR_FRAME_FAIL | 1 lỗi khác (stderr có chi tiết)
# ============================================================
import argparse
import glob
import json
import os
import re
import sys


def main():
    ap = argparse.ArgumentParser(description="Hardsub OCR worker (RapidOCR)")
    ap.add_argument("--frames-dir", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--min-score", type=float, default=0.5)
    a = ap.parse_args()

    try:
        from rapidocr import RapidOCR
    except Exception as e:  # thiếu dep trong venv — khai báo lộ liễu
        sys.stderr.write("HS_OCR_MISSING: không import được rapidocr (%s). "
                         "Cài vào nova/voice-backend/.venv-omni: pip install rapidocr "
                         "opencv-python-headless pyclipper shapely\n" % e)
        sys.exit(2)

    frames = sorted(glob.glob(os.path.join(a.frames_dir, "frame_*.png")))
    if not frames:
        sys.stderr.write("HS_OCR_NO_FRAMES: không có khung frame_*.png trong %s\n"
                         % a.frames_dir)
        sys.exit(3)

    eng = RapidOCR()
    results = []
    total = len(frames)
    for i, fp in enumerate(frames, 1):
        m = re.search(r"frame_(\d+)\.png$", os.path.basename(fp))
        idx = int(m.group(1)) if m else i
        try:
            r = eng(fp)
        except Exception as e:
            sys.stderr.write("HS_OCR_FRAME_FAIL: %s :: %s\n" % (fp, e))
            sys.exit(4)
        txts = list(getattr(r, "txts", None) or [])
        scores = list(getattr(r, "scores", None) or [])
        kept = []
        for j, t in enumerate(txts):
            s = float(scores[j]) if j < len(scores) else 0.0
            if t.strip() and s >= a.min_score:
                kept.append((str(t).strip(), s))
        text = " ".join(k[0] for k in kept).strip()
        avg = sum(k[1] for k in kept) / len(kept) if kept else 0.0
        results.append({"idx": idx, "text": text, "score": round(avg, 4)})
        sys.stdout.write("PROG %d/%d\n" % (i, total))
        sys.stdout.flush()

    with open(a.out, "w", encoding="utf-8") as f:
        json.dump({
            "model": "PP-OCRv6 (rapidocr/onnxruntime)",
            "frames_dir": a.frames_dir,
            "min_score": a.min_score,
            "frames": results,
        }, f, ensure_ascii=False)
    sys.stdout.write("OK\n")
    sys.stdout.flush()


if __name__ == "__main__":
    main()