'Kiểm tra cấu hình xuất/rải batch trước khi tốn STT/TTS/API dịch.'
from __future__ import annotations
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping

@dataclass(frozen=True)
class PreflightIssue:
    code: 'str'
    message: 'str'
    fix_hint: 'str'
    focus_control: 'str' = ''
    auto_fixable: 'bool' = False

def collect_template_preflight_issues(values: Mapping[str, object], *, skip_voice_audio: bool, skip_subtitle_file: bool) -> list[PreflightIssue]:
    issues = []
    path = str(values.get('background_audio_path') or '').strip()
    if bool(values.get('background_audio_enabled')) and (not path or not Path(path).is_file()):
        issues.append(PreflightIssue(code='bgm_missing', message='Đã bật «Ghép nhạc file» nhưng chưa chọn file nhạc nền' if path else f'File nhạc nền không tồn tại:\n{path}', fix_hint='Chọn file ở tab Âm thanh, hoặc tắt «Ghép nhạc file».', focus_control='background_audio_enabled', auto_fixable=True))
    path = str(values.get('logo_path') or '').strip()
    if bool(values.get('logo_enabled')) and (not path or not Path(path).is_file()):
        issues.append(PreflightIssue(code='logo_missing', message='Đã bật logo nhưng chưa chọn file' if path else f'File logo không tồn tại:\n{path}', fix_hint='Chọn logo hoặc tắt «Logo».', focus_control='logo_enabled', auto_fixable=True))
    content = str(values.get('text_overlay_content') or '').strip()
    if bool(values.get('text_overlay_enabled')) and (not content):
        issues.append(PreflightIssue(code='text_overlay_empty', message='Đã bật chữ overlay nhưng chưa nhập nội dung', fix_hint='Nhập nội dung chữ hoặc tắt overlay.', focus_control='text_overlay_enabled', auto_fixable=True))
    content = str(values.get('video_title_content') or '').strip()
    if bool(values.get('video_title_enabled')) and (not bool(values.get('video_title_from_filename'))) and (not content):
        issues.append(PreflightIssue(code='video_title_empty', message='Đã bật tiêu đề video nhưng chưa nhập nội dung', fix_hint='Nhập tiêu đề, bật «Lấy từ tên file», hoặc tắt tiêu đề.', focus_control='video_title_enabled', auto_fixable=True))
    if bool(values.get('effect_overlay_enabled')) or str(values.get('video_effect', 'none')) == 'custom':
        path = str(values.get('effect_overlay_path') or '').strip()
        media = values.get('media_overlays') or ()
        has_media = False
        if isinstance(media, (list, tuple)):
            for item in media:
                mpath = str(item.get('path', '') or '').strip()
                if isinstance(item, dict) and item.get('enabled', True) and mpath and Path(mpath).is_file():
                    has_media = True
        if not has_media and (not path or not Path(path).is_file()):
            issues.append(PreflightIssue(code='overlay_missing', message='Đã bật overlay/hiệu ứng tuỳ chỉnh nhưng thiếu file', fix_hint='Chọn file overlay hoặc tắt lớp phủ / đổi hiệu ứng.', focus_control='effect_overlay_enabled', auto_fixable=True))
    path = str(values.get('voice_audio_path') or '').strip()
    if not skip_voice_audio and bool(values.get('voice_audio_enabled')) and (not path or not Path(path).is_file()):
        video_path = str(values.get('_preflight_video_path') or '').strip()
        resolved = ''
        if video_path:
            try:
                from ui_qt.asset_export import pick_voice_audio_path, resolve_voice_audio_path
                resolved = pick_voice_audio_path(video_path, resolve_voice_audio_path(video_path), path)
            except Exception:
                resolved = ''
        if not resolved or not Path(resolved).is_file():
            issues.append(PreflightIssue(code='voice_missing', message='Đã bật «Ghép file lồng tiếng» nhưng chưa có file giọng đọc (tab Âm thanh: «Chưa chọn file giọng đọc»).', fix_hint='Chạy «Xuất» với setup phụ đề/giọng để tự TTS, hoặc «Chạy đầy đủ clip đang chọn». Chỉ tắt «Ghép file lồng tiếng» nếu thật sự không cần giọng.', focus_control='voice_audio_enabled', auto_fixable=False))
    path = str(values.get('subtitle_path') or '').strip()
    if not skip_subtitle_file and bool(values.get('subtitle_enabled')) and (not path or not Path(path).is_file()):
        issues.append(PreflightIssue(code='subtitle_missing', message='Đã bật phụ đề nhưng chưa có file SRT (vừa setup là bình thường)', fix_hint='Xuất video (1 clip hoặc hàng loạt): app tự CapCut/STT → dịch → TTS rồi render — không cần «Chạy đầy đủ clip» trước. Hoặc tắt «Phụ đề» nếu chỉ xuất video + lớp phủ.', focus_control='subtitle_enabled', auto_fixable=True))
    return issues

def format_preflight_detail(issues: list[PreflightIssue]) -> str:
    if issues:
        lines = ['Phát hiện cấu hình thiếu — sửa trước khi chạy để khỏi tốn API:', '']
        for index, issue in enumerate(issues, start=1):
            lines.append(f'{index}. {issue.message}')
            if issue.fix_hint:
                lines.append(f'   → {issue.fix_hint}')
        return '\n'.join(lines)
    return ''

def apply_auto_fixes(values: dict[str, object], issues: list[PreflightIssue]) -> list[str]:
    applied = []
    for issue in issues:
        if issue.code == 'bgm_missing':
            values['background_audio_enabled'] = False
            applied.append('Đã tắt nhạc nền (file thiếu)')
        elif issue.code == 'logo_missing':
            values['logo_enabled'] = False
            applied.append('Đã tắt logo (file thiếu)')
        elif issue.code == 'text_overlay_empty':
            values['text_overlay_enabled'] = False
            applied.append('Đã tắt chữ overlay (trống)')
        elif issue.code == 'video_title_empty':
            values['video_title_enabled'] = False
            applied.append('Đã tắt tiêu đề (trống)')
        elif issue.code == 'overlay_missing':
            values['effect_overlay_enabled'] = False
            if str(values.get('video_effect', 'none')) == 'custom':
                values['video_effect'] = 'none'
            applied.append('Đã tắt overlay/hiệu ứng tuỳ chỉnh (file thiếu)')
        elif issue.code == 'subtitle_missing':
            values['subtitle_enabled'] = False
            applied.append('Đã tắt phụ đề (chưa có SRT)')
        elif issue.auto_fixable and issue.code == 'voice_missing':
            values['voice_audio_enabled'] = False
            applied.append('Đã tắt ghép giọng đọc (chưa có file TTS)')
    return applied