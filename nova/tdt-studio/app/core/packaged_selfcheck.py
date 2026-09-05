from __future__ import annotations
__doc__ = '--selfcheck: kiểm bundle đóng gói, không GUI, không probe mạng.'
from dataclasses import dataclass
from pathlib import Path
import sys
HAAR_NAME = 'haarcascade_frontalface_default.xml'

def _print_line(ok: bool, name: str, detail: str='') -> None:
    tag = 'OK' if ok else 'FAIL'
    extra = f' {detail}' if detail else ''
    print(f'{tag} {name}{extra}')


def _warn_line(name: str, detail: str='') -> None:
    extra = f' {detail}' if detail else ''
    print(f'WARN {name}{extra}')

def _haar_path(root: Path) -> Path:
    return root / 'assets' / 'opencv' / HAAR_NAME

def _ffmpeg_path(root: Path) -> Path:
    from core.paths import PATHS
    bundled = root / 'tools' / 'ffmpeg.exe'
    return bundled if bundled.is_file() else PATHS.ffmpeg if root.resolve() == PATHS.root.resolve() and PATHS.ffmpeg.is_file() else bundled

def _lut_cubes(root: Path) -> list[Path]:
    lut = root / 'Lut_mau'
    return [p for p in lut.rglob('*') if p.is_file() and p.suffix.lower() == '.cube'] if lut.is_dir() else []

def _check_stems_when_frozen() -> bool:
    from core.video_stem_audio import attach_stems_to_export_settings

    @dataclass
    class _StemSettings:
        video_vocal_enabled: 'bool' = True
        video_vocal_volume: 'int' = 100
        video_bgm_enabled: 'bool' = False
        video_bgm_volume: 'int' = 0
        video_vocal_stem_path: 'str' = ''
        video_instrumental_stem_path: 'str' = ''
    out = attach_stems_to_export_settings(_StemSettings(), '', raise_on_failure=False)
    empty = not str(out.video_vocal_stem_path or '').strip() and (not str(out.video_instrumental_stem_path or '').strip())
    return empty

def run_selfcheck(root: Path | None = None, *, require_demucs: bool | None = None) -> int:
    from core.paths import PATHS
    if require_demucs is None:
        require_demucs = bool(getattr(sys, 'frozen', False))
    base = Path(root) if root is not None else PATHS.root
    fails = 0
    haar = _haar_path(base)
    haar_ok = haar.is_file()
    _print_line(haar_ok, 'haar', str(haar) if haar_ok else 'missing')
    if not haar_ok:
        fails += 1
    ffmpeg = _ffmpeg_path(base)
    ffmpeg_ok = ffmpeg.is_file()
    _print_line(ffmpeg_ok, 'ffmpeg', str(ffmpeg) if ffmpeg_ok else 'missing')
    if not ffmpeg_ok:
        fails += 1
    cubes = _lut_cubes(base)
    lut_ok = len(cubes) >= 1
    _print_line(lut_ok, 'Lut_mau', f'{len(cubes)} cube' if lut_ok else 'missing')
    if not lut_ok:
        fails += 1
    if getattr(sys, 'frozen', False):
        stem_ok = _check_stems_when_frozen()
        _print_line(stem_ok, 'stem_frozen', 'empty stems' if stem_ok else 'spawned')
        if not stem_ok:
            fails += 1
    if require_demucs:
        try:
            from core.demucs_separate import demucs_popen_cmd
            cmd = demucs_popen_cmd([], frozen=True)
            dispatch_ok = ('--run-demucs' in cmd) and (cmd and cmd[1] == '--run-demucs')
            dispatch_detail = '--run-demucs' if dispatch_ok else 'missing'
        except Exception as exc:
            dispatch_ok = False
            dispatch_detail = str(exc).splitlines()[0] if str(exc).strip() else 'error'
        _print_line(dispatch_ok, 'demucs_cli', dispatch_detail)
        if not dispatch_ok:
            fails += 1

        try:
            from core.demucs_local_repo import htdemucs_repo_ready
            ai_ok = htdemucs_repo_ready(base)
        except Exception:
            ai_ok = False
            ai_detail = 'error'
        else:
            ai_detail = 'repo' if ai_ok else 'missing'
        _print_line(ai_ok, 'demucs_ai', ai_detail)
        if not ai_ok:
            fails += 1
    else:
        _warn_line('demucs_cli', 'skip in source mode')
        _warn_line('demucs_ai', 'skip in source mode')
    if getattr(sys, 'frozen', False):
        try:
            import torch
            from core.demucs_bundle_contract import check_torch_cuda_flavor
            ver = str(getattr(torch, '__version__', ''))
            cuda = getattr(getattr(torch, 'version', None), 'cuda', None)
            cuda_s = 'None' if cuda is None else str(cuda)
            try:
                available = bool(torch.cuda.is_available())
            except Exception:
                available = False
            else:
                flavor = check_torch_cuda_flavor(version=ver, cuda_version=None if cuda is None else str(cuda))
                _print_line(flavor.ok, 'torch_cuda', f'{ver} cuda={cuda_s} available={available}')
                if not flavor.ok:
                    fails += 1
        except Exception:
            _print_line(False, 'torch_cuda', 'missing cuda=None available=False')
            fails += 1
    return 1 if fails else 0

def maybe_selfcheck(argv: list[str]) -> int | None:
    args = list(argv or [])
    if '--selfcheck' not in args:
        return None
    require_demucs = '--require-demucs' in args
    return run_selfcheck(require_demucs=require_demucs)