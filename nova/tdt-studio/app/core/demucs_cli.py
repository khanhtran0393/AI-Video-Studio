'CLI worker process — chạy Demucs ngoài process UI (tránh crash Python 3.13 + torch).\n\nUsage:\n  python -m core.demucs_cli dual <video> <vocals.wav> <instrumental.wav>\n  python -m core.demucs_cli single <video> <output.wav> [--vocals|--remove a,b,c]\n'
from __future__ import annotations
import os
import sys

def maybe_run_demucs(argv: list[str]) -> int | None:
    args = list(argv or [])
    if '--run-demucs' not in args:
        return None
    idx = args.index('--run-demucs')
    return main(args[idx + 1:])

def main(argv: list[str] | None=None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if args:
        os.environ['VTP_DEMUCS_CHILD'] = '1'
        os.environ.setdefault('OMP_NUM_THREADS', '1')
        os.environ.setdefault('MKL_NUM_THREADS', '1')
        os.environ.setdefault('OPENBLAS_NUM_THREADS', '1')
        os.environ.setdefault('NUMEXPR_NUM_THREADS', '1')
        try:
            from core.cpu_budget import limit_current_process_cpu
            how = limit_current_process_cpu()
            print(f'[VocalSep] CPU budget: {how}', flush=True)
        except Exception:
            pass
        mode = str(args[0] or '').strip().lower()
        if mode == 'dual':
            if len(args) < 4:
                print('[VocalSep] ERROR: dual cần video vocals.wav instrumental.wav', flush=True)
                return 2
            from core.demucs_separate import run_demucs_dual_stems
            ok, err = (run_demucs_dual_stems(args[1], args[2], args[3])[0], run_demucs_dual_stems(args[1], args[2], args[3])[1])
            if ok:
                return 0
            print(f"[VocalSep] ERROR: {err or 'fail'}", flush=True)
            return 1
        if mode == 'single':
            if len(args) < 3:
                print('[VocalSep] ERROR: single cần video output.wav', flush=True)
                return 2
            extract_vocals = '--vocals' in args
            remove_stems = None
            for item in args[3:]:
                if item.startswith('--remove='):
                    raw = item.split('=', 1)[1]
                    remove_stems = [s for s in raw.split(',') if s]
            from core.demucs_separate import run_demucs
            ok, err = (run_demucs(args[1], args[2], extract_vocals=extract_vocals, remove_stems=remove_stems)[0], run_demucs(args[1], args[2], extract_vocals=extract_vocals, remove_stems=remove_stems)[1])
            if ok:
                return 0
            print(f"[VocalSep] ERROR: {err or 'fail'}", flush=True)
            return 1
        print(f'[VocalSep] ERROR: lệnh không hỗ trợ: {mode}', flush=True)
    else:
        print('[VocalSep] ERROR: thiếu lệnh dual|single', flush=True)
    return 2
if __name__ == '__main__':
    raise SystemExit(main())