from __future__ import annotations
import hashlib
import os
import time
from dataclasses import replace
from pathlib import Path
from core.video_export import VideoExportSettings
from ui_qt.state import DEFAULT_EXPORT_VALUES, ProjectState
PER_VIDEO_TRIM_KEYS = frozenset({'trim_start_ms', 'trim_end_ms'})
PER_VIDEO_TITLE_KEYS = frozenset({'video_title_content'})
PER_VIDEO_TIMELINE_KEYS = frozenset({'selected_timeline_clip_id', 'selected_timeline_clip_ids', 'timeline_clips', 'timeline_audio_clips'})
PROJECT_FRAME_KEYS = frozenset({'background', 'background_blur_percent', 'face_reframe_subject_mode', 'face_reframe_pan_axis', 'batch_auto_scene_split', 'batch_auto_face_reframe', 'background_layers_master_enabled', 'quality', 'face_reframe_plate', 'aspect_ratio', 'background_layer_index', 'background_layers'})
_TTS_FOLDER_NAME = 'Giọng Đọc TTS'

def _preserve_per_video_timeline(merged: dict[str, object], *, previous: dict[str, object], asset, template: dict[str, object]) -> None:
    from core.timeline_clips import ensure_timeline_for_video_source, has_custom_scene_timeline
    dur = max(1, int(getattr(asset, 'duration_ms', 0) or 1))
    path = str(getattr(asset, 'path', '') or '')
    prev_bag = dict(previous or {})
    merged['timeline_audio_clips'] = prev_bag['timeline_audio_clips'] if 'timeline_audio_clips' in prev_bag else []
    if has_custom_scene_timeline(prev_bag, source_duration_ms=dur):
        for key in ('timeline_clips', 'selected_timeline_clip_id', 'selected_timeline_clip_ids'):
            if key in prev_bag:
                merged[key] = prev_bag[key]
        ensure_timeline_for_video_source(merged, source_path=path, source_duration_ms=dur, preserve_custom_scenes=True)
        return None
    merged['timeline_clips'] = []
    merged['selected_timeline_clip_id'] = ''
    merged['selected_timeline_clip_ids'] = []
    for key in ('scale_percent', 'scale_x_percent', 'scale_y_percent', 'offset_x', 'offset_y', 'clip_volume_percent'):
        if key in template:
            merged[key] = template[key]
    ensure_timeline_for_video_source(merged, source_path=path, source_duration_ms=dur, preserve_custom_scenes=False)

def template_settings_from_values(values: dict[str, object], *, source_duration_ms: int) -> dict[str, object]:
    from ui_qt.project_timing import normalize_template_full_span_ends
    template = {key: values.get(key, default) for key, default in DEFAULT_EXPORT_VALUES.items()}
    for key in ('voice_audio_path', 'subtitle_path', 'video_vocal_stem_path', 'video_instrumental_stem_path', 'vocal_sep_cache_path'):
        template[key] = ''
    for key in PER_VIDEO_TITLE_KEYS:
        template[key] = ''
    if int(source_duration_ms or 0) > 0:
        normalize_template_full_span_ends(template, int(source_duration_ms))
    return template

def template_settings_from_snapshot(saved: dict[str, object], *, source_duration_ms: int) -> dict[str, object]:
    from ui_qt.project_timing import normalize_template_full_span_ends
    template = {key: saved.get(key, default) for key, default in DEFAULT_EXPORT_VALUES.items()}
    for key in ('voice_audio_path', 'subtitle_path', 'video_vocal_stem_path', 'video_instrumental_stem_path', 'vocal_sep_cache_path'):
        template[key] = ''
    for key in PER_VIDEO_TITLE_KEYS:
        template[key] = ''
    if int(source_duration_ms or 0) > 0:
        normalize_template_full_span_ends(template, int(source_duration_ms))
    return template

def subtitle_project_key_from_path(project_path: str | None) -> str:
    raw = str(project_path or '').strip()
    if raw:
        try:
            resolved = str(Path(raw).expanduser().resolve())
        except OSError:
            resolved = raw
        digest = hashlib.sha1(os.path.normcase(os.path.abspath(resolved)).encode('utf-8')).hexdigest()[:12]
        return digest
    return 'unsaved'

def _safe_subtitle_identity_part(raw: str) -> str:
    text = ''.join((ch if ch.isalnum() or ch in '-_' else '_' for ch in str(raw or '').strip()))
    return (text or 'x')[:80]

def working_subtitle_path_for(subtitle_workspace: str | Path, *, project_key: str, asset_id: str) -> Path:
    workspace = Path(subtitle_workspace).expanduser()
    proj = _safe_subtitle_identity_part(project_key or 'unsaved')
    aid = _safe_subtitle_identity_part(asset_id)
    return workspace / proj / f'{aid}_working.srt'

def source_subtitle_path_for(subtitle_workspace: str | Path, *, project_key: str, asset_id: str) -> Path:
    workspace = Path(subtitle_workspace).expanduser()
    proj = _safe_subtitle_identity_part(project_key or 'unsaved')
    aid = _safe_subtitle_identity_part(asset_id)
    return workspace / proj / f'{aid}_source.srt'

def apply_export_tts_vocal_guard(settings: VideoExportSettings) -> VideoExportSettings:
    return settings

def _merge_template_for_asset(state: ProjectState, asset, template: dict[str, object], *, subtitle_workspace: str | Path | None, previous: dict[str, object], project_key: str) -> dict[str, object]:
    merged = dict(template)
    for key in PER_VIDEO_TRIM_KEYS:
        if key in previous and str(previous.get(key, '') or '').strip():
            merged[key] = previous[key]
    for key in PER_VIDEO_TITLE_KEYS:
        prev_title = str(previous.get(key, '') or '').strip()
        if prev_title:
            merged[key] = previous[key]
            continue
        merged[key] = ''
        if key == 'video_title_content' and getattr(asset, 'path', ''):
            try:
                from core.video_title import title_from_media_path
                merged[key] = title_from_media_path(str(asset.path))
            except Exception:
                merged[key] = Path(str(asset.path)).stem
    if asset.path:
        ui_fallback = state.values if asset.id == state.selected_id else {}
        _preserve_per_video_media_paths(merged, video_path=asset.path, previous=previous, ui_fallback=ui_fallback)
        _attach_resolved_media_paths(merged, video_path=asset.path, subtitle_workspace=subtitle_workspace, previous=previous, ui_fallback=ui_fallback, project_key=project_key, asset_id=str(asset.id or ''))
    _preserve_per_video_timeline(merged, previous=previous, asset=asset, template=template)
    for key in ('trim_start_ms', 'trim_end_ms'):
        raw = previous.get(key)
        try:
            if int(raw) == 0 and key == 'trim_start_ms':
                if key not in previous or raw is None or raw == '' or (int(previous.get('trim_end_ms', 0) or 0) <= 0):
                    pass
                else:
                    merged[key] = previous[key]
                continue
        except (TypeError, ValueError):
            pass
    if any((int(previous.get(key, 0) or 0) > 0 for key in ('trim_start_ms', 'trim_end_ms'))):
        from core.timeline_clips import has_custom_scene_timeline, sync_single_clip_from_trim
        if not has_custom_scene_timeline(merged, source_duration_ms=max(1, int(getattr(asset, 'duration_ms', 0) or 1))):
            sync_single_clip_from_trim(merged, source_path=str(getattr(asset, 'path', '') or ''), source_duration_ms=max(1, int(getattr(asset, 'duration_ms', 0) or 1)))
    from core.tts_source_cues import TTS_SOURCE_VALUE_KEY
    from ui_qt.subtitle_source_document import persistable_source_subtitles_copy
    prev_source = previous.get(TTS_SOURCE_VALUE_KEY) if isinstance(previous, dict) else None
    if prev_source:
        merged[TTS_SOURCE_VALUE_KEY] = prev_source
    else:
        merged.pop(TTS_SOURCE_VALUE_KEY, None)
    prev_origin = persistable_source_subtitles_copy(previous if isinstance(previous, dict) else {})
    from ui_qt.subtitle_source_document import SOURCE_DOC_KEY
    if prev_origin is not None:
        merged[SOURCE_DOC_KEY] = prev_origin
    else:
        merged.pop(SOURCE_DOC_KEY, None)
    return merged

def apply_template_values_to_assets(state: ProjectState, template_values: dict[str, object], target_asset_ids: tuple[str, ...] | list[str], *, subtitle_workspace: str | Path | None, project_key: str) -> int:
    targets = set(target_asset_ids)
    count = 0
    for asset in state.assets:
        if asset.kind != 'video' or asset.id not in targets:
            pass
        else:
            previous = state.asset_settings.get(asset.id, {})
            merged = _merge_template_for_asset(state, asset, template_values, subtitle_workspace=subtitle_workspace, previous=previous, project_key=project_key)
            state.asset_settings[asset.id] = merged
            count += 1
    return count

def apply_export_template_from_asset(state: ProjectState, template_asset_id: str, *, subtitle_workspace: str | Path | None, target_asset_ids: tuple[str, ...] | list[str] | None, project_key: str) -> int:
    template_asset = next((asset for asset in state.assets if asset.id == template_asset_id), None)
    template_dur = max(1, int(getattr(template_asset, 'duration_ms', 0) or 0) if template_asset else 0)
    saved = state.asset_settings.get(template_asset_id)
    template = template_settings_from_snapshot(saved, source_duration_ms=template_dur) if saved else template_settings_from_values(state.values, source_duration_ms=template_dur)
    targets = list(target_asset_ids) if target_asset_ids else [asset.id for asset in state.assets if asset.kind == 'video' and asset.id != template_asset_id]
    return apply_template_values_to_assets(state, template, targets, subtitle_workspace=subtitle_workspace, project_key=project_key)

def apply_export_template_to_videos(state: ProjectState, *, subtitle_workspace: str | Path | None, project_key: str) -> int:
    selected = state.selected_asset
    template_dur = max(1, int(getattr(selected, 'duration_ms', 0) or 0) if selected is not None else 0)
    template = template_settings_from_values(state.values, source_duration_ms=template_dur)
    targets = [asset.id for asset in state.assets if asset.kind == 'video']
    return apply_template_values_to_assets(state, template, targets, subtitle_workspace=subtitle_workspace, project_key=project_key)

def _preserve_per_video_media_paths(settings: dict[str, object], *, video_path: str, previous: dict[str, object] | None, ui_fallback: dict[str, object] | None) -> None:
    previous = previous or {}
    ui_fallback = ui_fallback or {}
    prev_voice = str(previous.get('voice_audio_path') or '')
    if _voice_belongs_to_video(prev_voice, video_path):
        settings['voice_audio_path'] = str(Path(prev_voice).resolve())
    else:
        ui_voice = str(ui_fallback.get('voice_audio_path') or '')
        if settings.get('voice_audio_enabled') and _voice_belongs_to_video(ui_voice, video_path):
            settings['voice_audio_path'] = str(Path(ui_voice).resolve())
    if settings.get('subtitle_enabled'):
        prev_sub = str(previous.get('subtitle_path') or '')
        if _subtitle_belongs_to_video(prev_sub, video_path):
            settings['subtitle_path'] = str(Path(prev_sub).resolve())
        else:
            ui_sub = str(ui_fallback.get('subtitle_path') or '')
            if _subtitle_belongs_to_video(ui_sub, video_path):
                settings['subtitle_path'] = str(Path(ui_sub).resolve())
        return None

def _attach_resolved_media_paths(settings: dict[str, object], *, video_path: str, subtitle_workspace: str | Path | None, previous: dict[str, object] | None, ui_fallback: dict[str, object] | None, project_key: str, asset_id: str) -> None:
    previous = previous or {}
    ui_fallback = ui_fallback or {}
    if settings.get('voice_audio_enabled'):
        from core.tts_voice_key import current_tts_voice_key_from_values, voice_audio_matches_settings
        want_key = current_tts_voice_key_from_values(settings)
        stored = str(settings.get('voice_tts_key') or '').strip()
        picked = pick_voice_audio_path(video_path, resolve_voice_audio_path(video_path, preferred_key=want_key), str(settings.get('voice_audio_path') or ''), str(previous.get('voice_audio_path') or ''), str(ui_fallback.get('voice_audio_path') or ''), preferred_key=want_key)
        if picked and want_key and (not voice_audio_matches_settings(picked, engine=str(settings.get('tts_engine', 'edge') or 'edge'), voice=str(settings.get('tts_voice', '') or ''), lang=str(settings.get('subtitle_target_language', '') or ''), stored_key=stored or str(previous.get('voice_tts_key') or '') or str(ui_fallback.get('voice_tts_key') or ''))):
            picked = ''
        settings['voice_audio_path'] = picked
    else:
        settings['voice_audio_path'] = ''
    if settings.get('subtitle_enabled') and subtitle_workspace is not None:
        settings['subtitle_path'] = pick_subtitle_path(video_path, resolve_subtitle_path(video_path, subtitle_workspace=subtitle_workspace, project_key=project_key, asset_id=asset_id), str(settings.get('subtitle_path') or ''), str(previous.get('subtitle_path') or ''), str(ui_fallback.get('subtitle_path') or ''))
        return None
    settings['subtitle_path'] = ''

def _video_stem(video_path: str) -> str:
    return Path(video_path).expanduser().resolve().stem

def _tts_stem(video_stem: str) -> str:
    try:
        from longtieng.media_naming import tts_stem_prefix
    except ImportError:
        return video_stem

def _tts_search_dirs(video_path: str, extra_dirs: 'list[Path] | tuple[Path, ...] | None'=None) -> list[Path]:
    source = Path(video_path).expanduser().resolve()
    dirs = []
    seen = set()
    for extra in list(extra_dirs or []):
        candidate = Path(extra).expanduser().resolve() / _TTS_FOLDER_NAME
        key = str(candidate).casefold()
        if candidate.is_dir() and key not in seen:
            dirs.append(candidate)
            seen.add(key)
    current = source.parent
    for _ in range(5):
        candidate = (current / _TTS_FOLDER_NAME).resolve()
        key = str(candidate).casefold()
        if candidate.is_dir() and key not in seen:
            dirs.append(candidate)
            seen.add(key)
        parent = current.parent
        if parent == current:
            return dirs
        current = parent
    return dirs

def _is_valid_audio_file(path: str) -> bool:
    candidate = Path(str(path or '').strip()).expanduser()
    return bool(path) and candidate.is_file() and (candidate.stat().st_size > 256)

def _is_valid_subtitle_file(path: str) -> bool:
    candidate = Path(str(path or '').strip()).expanduser()
    return bool(path) and candidate.is_file()

def _voice_belongs_to_video(path: str, video_path: str) -> bool:
    text = str(path or '').strip()
    if _is_valid_audio_file(text):
        stem = _video_stem(video_path).casefold()
        tts_stem = _tts_stem(_video_stem(video_path)).casefold()
        name = Path(text).name.casefold()
        return True if name.startswith(f'{tts_stem}_tts') or name.startswith(f'{stem}_tts') else True if tts_stem and len(tts_stem) >= 8 and (tts_stem in name) else name.startswith(f'{stem}_')
    return False

def _subtitle_belongs_to_video(path: str, video_path: str) -> bool:
    text = str(path or '').strip()
    if _is_valid_subtitle_file(text):
        stem = _video_stem(video_path).casefold()
        name = Path(text).name.casefold()
        return name.startswith(f'{stem}_') or name == f'{stem}.srt'
    return False

def _is_tts_full_track_name(name: str) -> bool:
    text = str(name or '').casefold()
    return (True if '_tts_full' in text else '_tts_' in text and text.endswith('_full.mp3')) if text.endswith('.mp3') else False

def _is_tts_segment_track_name(name: str) -> bool:
    import re
    return bool(re.search('_tts_\\d{4}\\.mp3$', str(name or '').casefold()))

def _voice_name_near_video(name: str, video_path: str) -> bool:
    stem = _video_stem(video_path).casefold()
    tts_stem = _tts_stem(_video_stem(video_path)).casefold()
    name_cf = str(name or '').casefold()
    base = name_cf.rsplit('_tts', 1)[0]
    if base:
        n = min(48, len(stem), len(base))
        return True if stem and base and (n >= 8) and (stem[:n] == base[:n]) else True if name_cf.startswith(f'{tts_stem}_tts') else True if tts_stem and len(tts_stem) >= 8 and (tts_stem[:24] in base) else False
    return False

def resolve_voice_audio_path(video_path: str, *, preferred_key: str, extra_dirs: 'list[Path] | tuple[Path, ...] | None'=None) -> str:
    source = Path(video_path).expanduser().resolve()
    if source.is_file():
        full_stem = source.stem
        short_stem = _tts_stem(full_stem)
        full_hits = []
        want_key = str(preferred_key or '').strip()
        for out_dir in _tts_search_dirs(video_path, extra_dirs):
            for stem in (full_stem, short_stem):
                if stem:
                    keyed = out_dir / f'{stem}_tts_{want_key}_full.mp3'
                    if want_key and _is_valid_audio_file(str(keyed)):
                        return str(keyed.resolve())
                    exact_full = out_dir / f'{stem}_tts_full.mp3'
                    if _is_valid_audio_file(str(exact_full)):
                        full_hits.append(exact_full.resolve())
                    for candidate in out_dir.glob(f'{stem}_tts_*full*.mp3'):
                        if _is_tts_full_track_name(candidate.name) and _is_valid_audio_file(str(candidate)):
                            full_hits.append(candidate.resolve())
        if not full_hits:
            return ''
        if want_key:
            keyed_hits = [path for path in full_hits if f'_tts_{want_key}_full'.casefold() in path.name.casefold()]
            if keyed_hits:
                keyed_hits = sorted(set(keyed_hits), key=lambda path: path.stat().st_mtime, reverse=True)
                return str(keyed_hits[0])
            return ''
        full_hits = sorted(set(full_hits), key=lambda path: path.stat().st_mtime, reverse=True)
        return str(full_hits[0])
    return ''

def pick_voice_audio_path(video_path: str, resolved: str, *fallbacks: str, preferred_key: str) -> str:
    want_key = str(preferred_key or '').strip()
    candidates = [resolved, *fallbacks]
    ranked = []
    for candidate in candidates:
        text = str(candidate or '').strip()
        if _voice_belongs_to_video(text, video_path):
            name = Path(text).name.casefold()
            if _is_tts_segment_track_name(name) and (not _is_tts_full_track_name(name)):
                continue
            if want_key:
                from core.tts_voice_key import extract_tts_voice_key_from_path
                keyed = extract_tts_voice_key_from_path(text)
                if keyed and keyed != want_key:
                    continue
                rank = 0 if keyed == want_key else 2 if name.endswith('_tts_full.mp3') else 1
            else:
                rank = 0 if _is_tts_full_track_name(name) else 1
                ranked.append((rank, str(Path(text).resolve())))
    if ranked:
        ranked.sort(key=lambda item: item[0])
        return ranked[0][1]
    for candidate in fallbacks:
        text = str(candidate or '').strip()
        name = Path(text).name.casefold()
        if not _is_valid_audio_file(text) or not _is_tts_full_track_name(name) or (not _voice_name_near_video(name, video_path)):
            continue
        if want_key:
            from core.tts_voice_key import extract_tts_voice_key_from_path
            keyed = extract_tts_voice_key_from_path(text)
            if keyed and keyed != want_key:
                continue
            if not keyed and want_key:
                pass
        else:
            return str(Path(text).expanduser().resolve())
    return ''

def wait_for_voice_audio_path(video_path: str, *fallbacks: str, attempts: int, delay_sec: float, preferred_key: str) -> str:
    last = ''
    for attempt in range(max(1, int(attempts))):
        last = pick_voice_audio_path(video_path, resolve_voice_audio_path(video_path, preferred_key=preferred_key), *fallbacks, preferred_key=preferred_key)
        if last and Path(last).is_file():
            return last
        if attempt + 1 < max(1, int(attempts)):
            time.sleep(max(0.05, float(delay_sec)))
    return last

def pick_subtitle_path(video_path: str, resolved: str, *fallbacks: str) -> str:
    resolved_text = str(resolved or '').strip()
    try:
        resolved_path = Path(resolved_text)
        if not resolved_text or not resolved_path.is_file():
            for candidate in fallbacks:
                text = str(candidate or '').strip()
                if _subtitle_belongs_to_video(text, video_path):
                    return str(Path(text).resolve())
            return ''
    except OSError:
        pass

def resolve_subtitle_path(video_path: str, *, subtitle_workspace: str | Path, project_key: str, asset_id: str) -> str:
    source = Path(video_path).expanduser().resolve()
    if not source.is_file():
        pass
    elif str(asset_id or '').strip():
        working = working_subtitle_path_for(subtitle_workspace, project_key=str(project_key or 'unsaved'), asset_id=str(asset_id))
        return str(working.resolve()) if working.is_file() else ''
    return ''

def _preferred_tts_key_from_bags(*bags: dict | None) -> tuple[str, str]:
    from core.tts_voice_key import current_tts_voice_key_from_values
    merged = {}
    for bag in bags:
        if isinstance(bag, dict):
            merged.update(bag)
    expected = current_tts_voice_key_from_values(merged)
    stored = str(merged.get('voice_tts_key') or '').strip()
    return (expected, stored)

def resolve_per_video_export_overrides(*, video_path: str, subtitle_workspace: str | Path, voice_audio_enabled: bool, subtitle_enabled: bool, existing_voice_path: str, existing_subtitle_path: str, preferred_voice_key: str, stored_voice_key: str, tts_engine: str, tts_voice: str, tts_lang: str, project_key: str, asset_id: str, extra_voice_dirs: 'list[Path] | tuple[Path, ...] | None'=None) -> dict[str, object]:
    from core.tts_voice_key import make_tts_voice_key, voice_audio_matches_settings
    updates = {'voice_audio_enabled': voice_audio_enabled, 'subtitle_enabled': subtitle_enabled}
    want_key = str(preferred_voice_key or '').strip()
    if not want_key and (tts_engine or tts_voice or tts_lang):
        want_key = make_tts_voice_key(tts_engine, tts_voice, tts_lang)
    if voice_audio_enabled:
        picked = pick_voice_audio_path(video_path, resolve_voice_audio_path(video_path, preferred_key=want_key, extra_dirs=extra_voice_dirs), existing_voice_path, preferred_key=want_key)
        if picked and want_key and (not voice_audio_matches_settings(picked, engine=tts_engine or 'edge', voice=tts_voice, lang=tts_lang, stored_key=stored_voice_key)):
            picked = ''
        updates['voice_audio_path'] = picked
    if subtitle_enabled:
        updates['subtitle_path'] = pick_subtitle_path(video_path, resolve_subtitle_path(video_path, subtitle_workspace=subtitle_workspace, project_key=project_key, asset_id=asset_id), existing_subtitle_path)
    return updates

def _resolved_subtitle_for_asset(asset, state: ProjectState, *, subtitle_workspace: str | Path | None, project_key: str) -> str:
    video_path = str(getattr(asset, 'path', '') or '')
    if video_path:
        previous = state.asset_settings.get(asset.id, {})
        ui_fallback = state.values if asset.id == state.selected_id else {}
        return pick_subtitle_path(video_path, str(previous.get('subtitle_path') or ''), str(ui_fallback.get('subtitle_path') or '')) if subtitle_workspace is None else pick_subtitle_path(video_path, resolve_subtitle_path(video_path, subtitle_workspace=subtitle_workspace, project_key=project_key, asset_id=str(getattr(asset, 'id', '') or '')), str(previous.get('subtitle_path') or ''), str(ui_fallback.get('subtitle_path') or ''))
    return ''

def _resolved_voice_for_asset(asset, state: ProjectState) -> str:
    from core.tts_voice_key import voice_audio_matches_settings
    video_path = str(getattr(asset, 'path', '') or '')
    if video_path:
        previous = state.asset_settings.get(asset.id, {}) or {}
        ui_fallback = state.values if asset.id == state.selected_id else {}
        expected, stored = (_preferred_tts_key_from_bags(state.values, previous, ui_fallback)[0], _preferred_tts_key_from_bags(state.values, previous, ui_fallback)[1])
        picked = pick_voice_audio_path(video_path, resolve_voice_audio_path(video_path, preferred_key=expected), str(previous.get('voice_audio_path') or ''), str(ui_fallback.get('voice_audio_path') or ''), preferred_key=expected)
        if picked:
            bag = {**state.values, **previous, **(ui_fallback or {})}
            return picked if not expected or voice_audio_matches_settings(picked, engine=str(bag.get('tts_engine', 'edge') or 'edge'), voice=str(bag.get('tts_voice', '') or ''), lang=str(bag.get('subtitle_target_language', '') or ''), stored_key=stored) else ''
    return ''

def _subtitle_file_has_cues(path: str) -> bool:
    text = str(path or '').strip()
    if text:
        try:
            from core.subtitles import load_srt
        except (OSError, ValueError, TypeError):
            return False
    else:
        return False

def asset_dub_step_flags(asset, state: ProjectState, *, subtitle_workspace: str | Path | None, project_key: str) -> dict[str, bool]:
    flags = {'stt': False, 'translate': False, 'tts': False}
    if getattr(asset, 'kind', None) == 'video' and getattr(asset, 'path', ''):
        settings = state.asset_settings.get(asset.id) or state.values
        subtitle_enabled = bool(settings.get('subtitle_enabled'))
        translate_enabled = bool(settings.get('subtitle_translate_enabled', True))
        voice_enabled = bool(settings.get('voice_audio_enabled'))
        if subtitle_enabled or voice_enabled:
            target_lang = str(settings.get('subtitle_target_language') or state.values.get('subtitle_target_language') or '').strip()
            sub_path = ''
            if subtitle_enabled:
                sub_path = _resolved_subtitle_for_asset(asset, state, subtitle_workspace=subtitle_workspace if subtitle_workspace is not None else None, project_key=project_key)
                if not sub_path or not _subtitle_file_has_cues(sub_path):
                    flags['stt'] = True
                    flags['translate'] = bool(translate_enabled)
                elif target_lang and translate_enabled:
                    from core.subtitle_translation import subtitle_file_needs_translation
                    if subtitle_file_needs_translation(sub_path, target_lang):
                        flags['translate'] = True
            if voice_enabled:
                voice_path = _resolved_voice_for_asset(asset, state)
                if not voice_path:
                    flags['tts'] = True
                    return flags
                if flags['translate'] or flags['stt']:
                    flags['tts'] = True
            else:
                return flags
        else:
            return flags
    else:
        return flags

def asset_needs_dub_pipeline(asset, state: ProjectState, *, subtitle_workspace: str | Path | None, project_key: str) -> bool:
    flags = asset_dub_step_flags(asset, state, subtitle_workspace=subtitle_workspace, project_key=project_key)
    return bool(flags['stt'] or flags['translate'] or flags['tts'])

def asset_dub_pipeline_steps(asset, state: ProjectState, *, subtitle_workspace: str | Path | None, stt_engine: str, project_key: str) -> list[str]:
    from ui_qt.batch_dub import dub_pipeline_steps_for_stt_engine
    flags = asset_dub_step_flags(asset, state, subtitle_workspace=subtitle_workspace, project_key=project_key)
    full = dub_pipeline_steps_for_stt_engine(stt_engine)
    first = full[0] if full else 'stt'
    steps = []
    if flags['stt']:
        steps.append(first)
    if flags['translate']:
        steps.append('translate')
    if flags['tts']:
        steps.append('tts')
    return steps