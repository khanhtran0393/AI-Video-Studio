'Tham số encoder FFmpeg — tách khỏi video_export, không import video_export lúc chạy.'
from __future__ import annotations
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from core.video_export import VideoExportSettings

def _effective_video_bitrate(settings: VideoExportSettings, *, source_bitrate_kbps: int) -> int:
    requested = max(0, int(settings.video_bitrate_kbps))
    source = max(0, int(source_bitrate_kbps))
    return max(300, min(requested, source)) if requested and settings.cap_bitrate_to_source and source else requested

def _resolved_encoder_backend(settings: VideoExportSettings) -> str:
    from core.encoder_probe import resolve_encoder_backend
    return resolve_encoder_backend(settings.encoder_backend)

def _encoder_speed_profile(settings: VideoExportSettings) -> tuple[str, str]:
    speed = str(settings.encode_speed or 'fast').strip().lower()
    if speed not in frozenset({'fast', 'quality', 'balanced'}):
        speed = 'fast'
    return {'fast': ('p3', '22'), 'balanced': ('p5', '20'), 'quality': ('p6', '18')}[speed] if _resolved_encoder_backend(settings) == 'nvenc' else {'fast': ('veryfast', '22'), 'balanced': ('medium', '20'), 'quality': ('slow', '18')}[speed]

def _scale_flags(settings: VideoExportSettings | None=None) -> str:
    if settings is None:
        return 'lanczos'
    speed = str(settings.encode_speed or 'fast').strip().lower()
    return 'bicubic' if speed == 'fast' else 'lanczos'

def _video_encoder_args(settings: VideoExportSettings, *, source_bitrate_kbps: int) -> list[str]:
    bitrate_kbps = _effective_video_bitrate(settings, source_bitrate_kbps=source_bitrate_kbps)
    enc_preset, quality_token = (_encoder_speed_profile(settings)[0], _encoder_speed_profile(settings)[1])
    backend = _resolved_encoder_backend(settings)
    if backend == 'nvenc':
        encoder = 'hevc_nvenc' if settings.codec == 'h265' else 'h264_nvenc'
        args = ['-c:v', encoder, '-preset', enc_preset, '-rc', 'vbr', '-cq', quality_token]
        if bitrate_kbps > 0:
            maxrate = max(bitrate_kbps, int(bitrate_kbps * 1.5))
            args.extend(['-b:v', f'{bitrate_kbps}k', '-maxrate', f'{maxrate}k', '-bufsize', f'{maxrate * 2}k'])
    else:
        encoder = 'libx265' if settings.codec == 'h265' else 'libx264'
        args = ['-c:v', encoder, '-preset', enc_preset]
        if bitrate_kbps:
            args.extend(['-b:v', f'{bitrate_kbps}k'])
        else:
            args.extend(['-crf', quality_token])
    args.extend(['-r', str(settings.fps), '-pix_fmt', 'yuv420p'])
    return args