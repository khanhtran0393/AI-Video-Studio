'Auto căn khung theo mặt / chủ thể (OpenCV) — mỗi cảnh timeline 1 lần.\n\nPodcast layout: khung con cố định trên canvas (vd 1:1 giữa 9:16);\nauto chỉ phủ khung con + nhích theo trục cấu hình — không nhảy khối video trên canvas.\n'
from __future__ import annotations
import random
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Callable, Sequence
from core.timeline_clips import TimelineClip
from core.video_export import contain_size, resolve_target_size
LogFn = Callable[[str], None]
PAN_AXIS_IDS = frozenset({'random', 'vertical', 'free', 'horizontal'})
SUBJECT_MODE_IDS = frozenset({'face', 'object', 'center', 'face_then_object'})
DEFAULT_PAN_AXIS = 'horizontal'
DEFAULT_SUBJECT_MODE = 'face_then_object'

@dataclass(frozen=True)
class FaceBox:
    __doc__ = 'Hộp chủ thể (mặt hoặc vật) chuẩn hoá 0..1 so với khung nguồn.'
    cx: 'float'
    cy: 'float'
    w: 'float'
    h: 'float'
    kind: 'str' = 'face'

    @property
    def area(self) -> float:
        return max(0.0, self.w) * max(0.0, self.h)

@dataclass(frozen=True)
class ClipReframeResult:
    clip_id: 'str'
    found_face: 'bool'
    scale_percent: 'int'
    offset_x: 'int'
    offset_y: 'int'
    face_count: 'int' = 0
    note: 'str' = ''
    subject_kind: 'str' = ''
    subject_cx: 'float' = 0.5
    subject_cy: 'float' = 0.5
    subject_w: 'float' = 0.0
    subject_h: 'float' = 0.0
    source_width: 'int' = 0
    source_height: 'int' = 0
    has_subject: 'bool' = False
FACE_SUBJECT_CACHE_KEY = '_face_subject_cache'

def crop_fingerprint(values: dict | None) -> str:
    data = values or {}
    if not bool(data.get('crop_enabled')):
        return 'off'
    return '|'.join((str(int(data.get(key, full) or full)) for key, full in (('crop_left_percent', 0), ('crop_top_percent', 0), ('crop_right_percent', 100), ('crop_bottom_percent', 100))))

def build_face_subject_cache(results: Sequence[ClipReframeResult], *, source_path: str, aspect_ratio: str, quality: str, subject_mode: str, crop_fp: str) -> dict:
    clips = {}
    for item in results:
        clips[str(item.clip_id)] = {'has_subject': bool(item.has_subject), 'kind': str(item.subject_kind or ''), 'cx': float(item.subject_cx), 'cy': float(item.subject_cy), 'w': float(item.subject_w), 'h': float(item.subject_h), 'source_width': int(item.source_width or 0), 'source_height': int(item.source_height or 0), 'face_count': int(item.face_count or 0)}
    return {'source_path': str(source_path or '').strip(), 'aspect_ratio': str(aspect_ratio or '9:16'), 'quality': str(quality or '1080p'), 'subject_mode': normalize_subject_mode(subject_mode), 'crop_fp': str(crop_fp or 'off'), 'clips': clips}

def face_subject_cache_usable(values: dict | None, *, source_path: str, subject_mode: str | None) -> bool:
    data = values or {}
    cache = data.get(FACE_SUBJECT_CACHE_KEY)
    if isinstance(cache, dict):
        clips = cache.get('clips')
        if isinstance(clips, dict) and clips:
            path = str(source_path or '').strip()
            cached_path = str(cache.get('source_path') or '').strip()
            return False if path and cached_path and (path != cached_path) else False if subject_mode is not None and normalize_subject_mode(cache.get('subject_mode')) != normalize_subject_mode(subject_mode) else False if str(cache.get('crop_fp') or 'off') != crop_fingerprint(data) else True
    return False

def reframe_clips_from_subject_cache(clips: Sequence[TimelineClip], cache: dict, *, aspect_ratio: str, quality: str, plate_aspect: str, pan_axis: str, subject_padding: float, only_track0: bool) -> tuple[list[TimelineClip], list[ClipReframeResult]]:
    try:
        tw, th = resolve_target_size(str(aspect_ratio), str(quality))
    except ValueError:
        tw, th = (1080, 1920)
    plate = str(plate_aspect or '1:1').strip() or '1:1'
    axis = normalize_pan_axis(pan_axis)
    by_id = cache.get('clips') if isinstance(cache, dict) else None
    if not isinstance(by_id, dict):
        by_id = {}
    work = list(clips)
    results = []
    id_to_index = {c.id: i for i, c in enumerate(work)}
    for clip in work:
        if only_track0 and int(clip.track_index) != 0:
            pass
        else:
            entry = by_id.get(str(clip.id))
            if isinstance(entry, dict):
                has_subject = bool(entry.get('has_subject'))
                subject = None
                if has_subject:
                    subject = FaceBox(cx=float(entry.get('cx', 0.5) or 0.5), cy=float(entry.get('cy', 0.5) or 0.5), w=float(entry.get('w', 0.0) or 0.0), h=float(entry.get('h', 0.0) or 0.0), kind=str(entry.get('kind') or 'object'))
                sw, sh = infer_reframe_source_size(int(entry.get('source_width') or 0), int(entry.get('source_height') or 0), tw, th)
                scale, ox, oy = compute_reframe_transform(source_width=sw, source_height=sh, target_width=tw, target_height=th, face=subject, subject_padding=subject_padding, plate_aspect=plate, pan_axis=axis)
                updated = replace(clip, scale_percent=scale, scale_x_percent=scale, scale_y_percent=scale, offset_x=ox, offset_y=oy)
                work[id_to_index[clip.id]] = updated
                kind = subject.kind if subject is not None else ''
                results.append(ClipReframeResult(clip_id=clip.id, found_face=subject is not None and subject.kind == 'face', scale_percent=scale, offset_x=ox, offset_y=oy, face_count=int(entry.get('face_count') or 0), note=f'cache plate={plate} axis={axis}', subject_kind=kind, subject_cx=float(entry.get('cx', 0.5) or 0.5), subject_cy=float(entry.get('cy', 0.5) or 0.5), subject_w=float(entry.get('w', 0.0) or 0.0), subject_h=float(entry.get('h', 0.0) or 0.0), source_width=sw, source_height=sh, has_subject=has_subject))
            else:
                results.append(ClipReframeResult(clip_id=clip.id, found_face=False, scale_percent=int(clip.scale_percent), offset_x=int(clip.offset_x), offset_y=int(clip.offset_y), note='thiếu cache cảnh'))
    return (work, results)

def _log(log: LogFn | None, message: str) -> None:
    if log is not None:
        try:
            log(message)
        except Exception:
            pass

def normalize_pan_axis(value: object) -> str:
    text = str(value or '').strip().lower()
    return 'horizontal' if text in frozenset({'ngang', 'h', 'horizon', 'x'}) else 'vertical' if text in frozenset({'v', 'dọc', 'y', 'doc'}) else text if text in PAN_AXIS_IDS else DEFAULT_PAN_AXIS

def normalize_subject_mode(value: object) -> str:
    text = str(value or '').strip().lower()
    return text if text in SUBJECT_MODE_IDS else DEFAULT_SUBJECT_MODE

def _cascade_path() -> Path | None:
    from core.paths import PATHS
    bundled = PATHS.assets / 'opencv' / 'haarcascade_frontalface_default.xml'
    if bundled.is_file():
        return bundled
    exe_side = PATHS.root / 'opencv' / 'haarcascade_frontalface_default.xml'
    if exe_side.is_file():
        return exe_side
    try:
        import cv2
    except ImportError:
        pass
    data = getattr(cv2, 'data', None)
    haarcascades = getattr(data, 'haarcascades', '') or ''
    candidate = Path(haarcascades) / 'haarcascade_frontalface_default.xml'
    if data is not None and candidate.is_file():
        return candidate
    base = Path(cv2.__file__).resolve().parent
    for rel in ('data/haarcascade_frontalface_default.xml', '../share/opencv4/haarcascades/haarcascade_frontalface_default.xml'):
        p = (base / rel).resolve()
        if p.is_file():
            return p

def detect_faces_bgr(frame_bgr, *, min_size: int) -> list[FaceBox]:
    import cv2
    if frame_bgr is None or getattr(frame_bgr, 'size', 0) == 0:
        return []
    cascade_file = _cascade_path()
    if cascade_file is None:
        raise RuntimeError('Không tìm thấy haarcascade_frontalface_default.xml (OpenCV)')
    cascade = cv2.CascadeClassifier(str(cascade_file))
    if cascade.empty():
        raise RuntimeError('Không nạp được face cascade OpenCV')
    h, w = frame_bgr.shape[:2]
    if w < 8 or h < 8:
        return []
    gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
    max_side = 960
    scale = 1.0
    if max(w, h) > max_side:
        scale = max_side / float(max(w, h))
        gray = cv2.resize(gray, (max(8, int(round(w * scale))), max(8, int(round(h * scale)))), interpolation=cv2.INTER_AREA)
    min_px = max(24, int(round(min_size * scale)))
    raw = cascade.detectMultiScale(gray, scaleFactor=1.07, minNeighbors=5, flags=cv2.CASCADE_SCALE_IMAGE, minSize=(min_px, min_px))
    if raw is None or len(raw) == 0:
        return []
    out = []
    gw = float(gray.shape[1])
    gh = float(gray.shape[0])
    for x, y, fw, fh in raw:
        nw = float(fw) / gw
        nh = float(fh) / gh
        cx = (float(x) + float(fw) * 0.5) / gw
        cy = (float(y) + float(fh) * 0.42) / gh
        if nw * nh < 0.006 or ((cx < 0.06 or cx > 0.94) and nw * nh < 0.02):
            pass
        else:
            out.append(FaceBox(cx=max(0.0, min(1.0, cx)), cy=max(0.0, min(1.0, cy)), w=max(0.01, min(1.0, nw)), h=max(0.01, min(1.0, nh)), kind='face'))
    out.sort(key=lambda f: f.area, reverse=True)
    return out

def detect_salient_subject_bgr(frame_bgr) -> FaceBox | None:
    import cv2
    import numpy as np
    if frame_bgr is None or getattr(frame_bgr, 'size', 0) == 0:
        pass
    else:
        h, w = frame_bgr.shape[:2]
        if w < 16 or h < 16:
            pass
        else:
            max_side = 480
            scale = 1.0
            small = frame_bgr
            if max(w, h) > max_side:
                scale = max_side / float(max(w, h))
                small = cv2.resize(frame_bgr, (max(8, int(round(w * scale))), max(8, int(round(h * scale)))), interpolation=cv2.INTER_AREA)
            sh, sw = small.shape[:2]
            sal_map = None
            try:
                saliency = cv2.saliency.StaticSaliencySpectralResidual_create()
                ok, sal_map = saliency.computeSaliency(small)
                if not ok or sal_map is None:
                    sal_map = None
            except Exception:
                sal_map = None
            if sal_map is None:
                gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
                blur = cv2.GaussianBlur(gray, (9, 9), 0)
                sal_map = cv2.Laplacian(blur, cv2.CV_32F)
                sal_map = np.abs(sal_map)
                sal_map = sal_map / (float(sal_map.max()) + 1e-06)
            else:
                sal_map = sal_map.astype('float32')
                if sal_map.max() > 1.5:
                    sal_map = sal_map / 255.0
            yy, xx = np.mgrid[0:sh, 0:sw]
            cy0, cx0 = ((sh - 1) * 0.5, (sw - 1) * 0.5)
            dist = np.sqrt(((xx - cx0) / max(1.0, sw * 0.5)) ** 2 + ((yy - cy0) / max(1.0, sh * 0.5)) ** 2)
            weight = np.clip(1.15 - 0.55 * dist, 0.35, 1.15)
            scored = sal_map * weight
            thr = float(np.percentile(scored, 88))
            mask = (scored >= thr).astype('uint8') * 255
            mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8), iterations=2)
            contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            if contours:
                best = max(contours, key=cv2.contourArea)
                area = float(cv2.contourArea(best))
                if area < sw * sh * 0.02:
                    return None
                x, y, bw, bh = cv2.boundingRect(best)
                return FaceBox(cx=max(0.0, min(1.0, (x + bw * 0.5) / float(sw))), cy=max(0.0, min(1.0, (y + bh * 0.5) / float(sh))), w=max(0.04, min(1.0, bw / float(sw))), h=max(0.04, min(1.0, bh / float(sh))), kind='object')

def pick_primary_face(faces: Sequence[FaceBox]) -> FaceBox | None:
    if faces:
        scored = []
        for f in faces:
            if f.area < 0.005:
                pass
            else:
                center = 1.0 - min(1.0, abs(f.cx - 0.5) * 1.6 + abs(f.cy - 0.45) * 0.9)
                score = f.area * 2.2 + center * 0.35
                if 0.22 <= f.cx <= 0.78:
                    score += 0.08
                scored.append((score, f))
        if scored:
            scored.sort(key=lambda t: t[0], reverse=True)
            return scored[0][1]
        return max(faces, key=lambda x: x.area)

def parse_ratio_token(token: str | None) -> tuple[float, float] | None:
    text = str(token or '').strip().lower().replace(' ', '')
    if not text or text in frozenset({'khung_xuat', 'cover', 'full_frame', 'full', 'canvas'}):
        return None
    if ':' in text:
        a, b = text.split(':', 1)
        try:
            rh, rw = (float(b), float(a))
        except ValueError:
            pass
        if rw > 0 and rh > 0:
            return (rw, rh)
    else:
        return None

def inner_plate_size(target_width: int, target_height: int, plate_aspect: str | None='1:1') -> tuple[int, int]:
    tw = max(2, int(target_width))
    th = max(2, int(target_height))
    ratio = parse_ratio_token(plate_aspect)
    if ratio is None:
        return (tw, th)
    rw, rh = ratio
    scale = min(tw / rw, th / rh)
    pw = max(2, int(round(rw * scale / 2.0) * 2))
    ph = max(2, int(round(rh * scale / 2.0) * 2))
    pw = min(pw, tw)
    ph = min(ph, th)
    return (pw, ph)

def should_clip_video_to_plate(*, target_width: int, target_height: int, plate_aspect: str | None, source_width: int, source_height: int) -> bool:
    tw = max(2, int(target_width))
    th = max(2, int(target_height))
    if th <= tw:
        return False
    if parse_ratio_token(plate_aspect) is None:
        return False
    sw = int(source_width or 0)
    sh = int(source_height or 0)
    if sw > 1 and sh > 1 and (sw > sh):
        return False
    plate_w, plate_h = inner_plate_size(tw, th, plate_aspect)
    return plate_h < th - 2 or plate_w < tw - 2

def plate_rect_on_canvas(target_width: int, target_height: int, plate_aspect: str | None) -> tuple[int, int, int, int]:
    tw = max(2, int(target_width))
    th = max(2, int(target_height))
    pw, ph = inner_plate_size(tw, th, plate_aspect)
    return ((tw - pw) // 2, (th - ph) // 2, pw, ph)

def plate_crop_xy(fg_width: int, fg_height: int, plate_width: int, plate_height: int, offset_x: int, offset_y: int) -> tuple[int, int]:
    fg_w = max(2, int(fg_width))
    fg_h = max(2, int(fg_height))
    pw = max(2, min(fg_w, int(plate_width)))
    ph = max(2, min(fg_h, int(plate_height)))
    x = int(round((fg_w - pw) / 2.0 - float(offset_x)))
    y = int(round((fg_h - ph) / 2.0 - float(offset_y)))
    return (max(0, min(fg_w - pw, x)), max(0, min(fg_h - ph, y)))

def infer_reframe_source_size(source_width: int, source_height: int, target_width: int, target_height: int) -> tuple[int, int]:
    sw = int(source_width or 0)
    sh = int(source_height or 0)
    if sw > 1 and sh > 1:
        return (sw, sh)
    tw = max(2, int(target_width))
    th = max(2, int(target_height))
    return (1080, 1920) if th > tw else (1920, 1080)

def resolve_reframe_pan_axis(pan_axis: str, *, max_ox: float, max_oy: float) -> str:
    axis = normalize_pan_axis(pan_axis)
    return 'vertical' if axis == 'horizontal' and max_ox <= 0.5 and (max_oy > 0.5) else 'horizontal' if axis == 'vertical' and max_oy <= 0.5 and (max_ox > 0.5) else axis

def compute_reframe_transform(*, source_width: int, source_height: int, target_width: int, target_height: int, face: FaceBox | None, subject_padding: float, focus_boost: float, plate_aspect: str, pan_axis: str) -> tuple[int, int, int]:
    _ = subject_padding
    sw = max(1, int(source_width))
    sh = max(1, int(source_height))
    tw = max(2, int(target_width))
    th = max(2, int(target_height))
    base_w, base_h = contain_size(sw, sh, tw, th)
    base_w = max(2, base_w)
    base_h = max(2, base_h)
    plate_w, plate_h = inner_plate_size(tw, th, plate_aspect)
    plate_cover = max(plate_w / float(base_w), plate_h / float(base_h))
    boost = max(0.0, min(0.12, float(focus_boost)))
    scale = max(1.0, plate_cover * (1.0 + boost))
    full_cover = max(tw / float(base_w), th / float(base_h))
    scale = min(scale, full_cover * 0.92) if plate_w < tw or plate_h < th else scale
    scale = min(scale, plate_cover * 1.12)
    scale = max(1.0, min(5.0, scale))
    scale_percent = int(round(scale * 100))
    scale_percent = max(100, min(500, scale_percent))
    sx = scale_percent / 100.0
    fg_w = base_w * sx
    fg_h = base_h * sx
    fx = 0.5 if face is None else float(face.cx)
    fy = 0.5 if face is None else float(face.cy)
    if face is not None and face.kind == 'face':
        fy = max(0.05, min(0.95, fy - 0.03))
    offset_x = int(round(fg_w * (0.5 - fx)))
    offset_y = int(round(fg_h * (0.5 - fy)))
    max_ox = max(0.0, (fg_w - plate_w) / 2.0)
    max_oy = max(0.0, (fg_h - plate_h) / 2.0)
    offset_x = int(round(max(-max_ox, min(max_ox, float(offset_x)))))
    offset_y = int(round(max(-max_oy, min(max_oy, float(offset_y)))))
    axis = resolve_reframe_pan_axis(pan_axis, max_ox=max_ox, max_oy=max_oy)
    if axis == 'horizontal':
        offset_y = 0
    elif axis == 'vertical':
        offset_x = 0
    elif axis == 'random':
        if random.random() < 0.55:
            offset_y = 0
        else:
            offset_x = int(round(offset_x * 0.35))
            offset_y = int(round(offset_y * 0.65))
    offset_x = max(-2000, min(2000, offset_x))
    offset_y = max(-2000, min(2000, offset_y))
    return (scale_percent, offset_x, offset_y)

def reset_source_crop_full_frame(values: dict) -> bool:
    changed = False
    if values.get('crop_enabled'):
        values['crop_enabled'] = False
        changed = True
    for key, full in (('crop_left_percent', 0), ('crop_top_percent', 0), ('crop_right_percent', 100), ('crop_bottom_percent', 100)):
        if int(values.get(key, full) or full) != int(full):
            values[key] = int(full)
            changed = True
    for key, full in (('crop_left', 0.0), ('crop_top', 0.0), ('crop_right', 1.0), ('crop_bottom', 1.0)):
        if key in values:
            try:
                cur = float(values.get(key) or full)
            except (TypeError, ValueError):
                cur = full
            if abs(cur - float(full)) > 1e-06:
                values[key] = float(full)
                changed = True
    return changed

def _open_capture(path: str):
    import cv2
    backends = []
    for name in ('CAP_FFMPEG', 'CAP_MSMF', 'CAP_DSHOW'):
        val = getattr(cv2, name, None)
        if val is None:
            pass
        else:
            backends.append(int(val))
    backends.append(0)
    last = None
    for be in backends:
        last = cv2.VideoCapture(path, be) if be else cv2.VideoCapture(path)
        if last is not None and last.isOpened():
            return last
        if last is None:
            pass
        else:
            last.release()
    raise RuntimeError(f'Không mở được video: {path}')

def crop_norm_from_export_values(values: dict | None) -> tuple[float, float, float, float] | None:
    if isinstance(values, dict):
        from core.video_export import resolve_crop_norm
        return resolve_crop_norm(bool(values.get('crop_enabled', False)), float(values.get('crop_left_percent', 0) or 0) / 100.0, float(values.get('crop_top_percent', 0) or 0) / 100.0, float(values.get('crop_right_percent', 100) or 100) / 100.0, float(values.get('crop_bottom_percent', 100) or 100) / 100.0)

def crop_bgr_to_norm(frame, crop_norm: tuple[float, float, float, float] | None):
    if frame is None or crop_norm is None:
        return frame
    left, top, right, bottom = crop_norm
    height, width = frame.shape[:2]
    x0 = max(0, min(width - 2, int(round(width * float(left)))))
    y0 = max(0, min(height - 2, int(round(height * float(top)))))
    x1 = max(x0 + 2, min(width, int(round(width * float(right)))))
    y1 = max(y0 + 2, min(height, int(round(height * float(bottom)))))
    return frame[y0:y1, x0:x1]

def _read_frame_at_ms(cap, source_ms: int):
    import cv2
    target = max(0.0, float(source_ms))
    cap.set(cv2.CAP_PROP_POS_MSEC, target)
    ok, frame = cap.read()
    if ok and frame is not None:
        return frame
    for delta in (80, 200, 500, -80, -200):
        cap.set(cv2.CAP_PROP_POS_MSEC, max(0.0, target + delta))
        ok, frame = cap.read()
        if not ok or frame is None:
            continue
        return frame

def sample_points_ms(source_in_ms: int, source_out_ms: int) -> list[int]:
    start = max(0, int(source_in_ms))
    end = max(start + 1, int(source_out_ms))
    dur = end - start
    if dur <= 120:
        return [start + dur // 2]
    fracs = (0.25, 0.5, 0.72) if dur <= 800 else (0.1, 0.22, 0.38, 0.52, 0.66, 0.8, 0.9)
    return [start + int(round(dur * f)) for f in fracs]

def _merge_subject_boxes(boxes: list[FaceBox]) -> FaceBox | None:
    if boxes:
        faces = [b for b in boxes if b.kind == 'face']
        use = faces if len(faces) >= max(1, (len(boxes) + 1) // 3) else boxes
        cxs = sorted((b.cx for b in use))
        cys = sorted((b.cy for b in use))
        ws = sorted((b.w for b in use))
        hs = sorted((b.h for b in use))
        mid = len(use) // 2
        kind = 'face' if faces and use is faces else use[mid].kind
        if abs(cxs[-1] - cxs[0]) > 0.42 or abs(cys[-1] - cys[0]) > 0.38:
            if len(use) >= 3:
                cys, cxs = (cys[1:-1] or cys, cxs[1:-1] or cxs)
                hs, ws = (hs[1:-1] or hs, ws[1:-1] or ws)
                mid = len(cxs) // 2
            else:
                return None
        else:
            return FaceBox(cx=cxs[mid], cy=cys[mid], w=ws[mid], h=hs[mid], kind=kind)
    else:
        return None

def detect_primary_subject_for_clip(path: str, *, source_in_ms: int, source_out_ms: int, cap, subject_mode: str, crop_norm: tuple[float, float, float, float] | None) -> tuple[FaceBox | None, int, int, int]:
    mode = normalize_subject_mode(subject_mode)
    own = cap is None
    if own:
        cap = _open_capture(path)
    try:
        import cv2
        src_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 0)
        src_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 0)
        face_boxes = []
        object_boxes = []
        for ms in sample_points_ms(source_in_ms, source_out_ms):
            frame = _read_frame_at_ms(cap, ms)
            if frame is None:
                continue
            frame = crop_bgr_to_norm(frame, crop_norm)
            if frame is None or frame.size == 0:
                continue
            fh, fw = frame.shape[:2]
            if fw > 1 and fh > 1:
                if crop_norm is not None or src_w <= 1 or src_h <= 1 or ((fw > fh) != (src_w > src_h)):
                    src_h, src_w = (fh, fw)
            faces = detect_faces_bgr(frame)
            primary = pick_primary_face(faces)
            if mode in frozenset({'face', 'face_then_object'}) and primary is not None:
                face_boxes.append(primary)
            if mode not in frozenset({'object', 'face_then_object'}):
                continue
            if mode == 'object':
                obj = detect_salient_subject_bgr(frame)
                if obj is None:
                    pass
                else:
                    object_boxes.append(obj)
                continue
            if face_boxes:
                pass
        if mode == 'center':
            if own:
                if cap is not None:
                    cap.release()
            return (None, 0, src_w, src_h)
        if mode == 'face':
            merged = _merge_subject_boxes(face_boxes)
            if own:
                if cap is not None:
                    cap.release()
            return (merged, len(face_boxes), src_w, src_h)
        if mode == 'object':
            merged = _merge_subject_boxes(object_boxes)
            if own:
                if cap is not None:
                    cap.release()
            return (merged, len(object_boxes), src_w, src_h)
        merged = _merge_subject_boxes(face_boxes)
        if merged is not None:
            if own:
                if cap is not None:
                    cap.release()
            return (merged, len(face_boxes), src_w, src_h)
        merged = _merge_subject_boxes(object_boxes)
    except:
        if own:
            if cap is not None:
                cap.release()
        raise
    if own:
        if cap is not None:
            cap.release()

def detect_primary_face_for_clip(path: str, *, source_in_ms: int, source_out_ms: int, cap) -> tuple[FaceBox | None, int, int, int]:
    return detect_primary_subject_for_clip(path, source_in_ms=source_in_ms, source_out_ms=source_out_ms, cap=cap, subject_mode='face')

def reframe_timeline_clips(clips: Sequence[TimelineClip], *, aspect_ratio: str, quality: str, fallback_path: str, subject_padding: float, plate_aspect: str, pan_axis: str, subject_mode: str, only_track0: bool, stop_flag: Callable[[], bool] | None, log: LogFn | None, crop_norm: tuple[float, float, float, float] | None) -> tuple[list[TimelineClip], list[ClipReframeResult]]:
    try:
        try:
            tw, th = resolve_target_size(str(aspect_ratio), str(quality))
        except ValueError:
            tw, th = (1080, 1920)
        plate = str(plate_aspect or '1:1').strip() or '1:1'
        axis = normalize_pan_axis(pan_axis)
        mode = normalize_subject_mode(subject_mode)
        work = [c for c in clips]
        results = []
        caps = {}
        id_to_index = {c.id: i for i, c in enumerate(work)}
        targets = [c for c in work if (not only_track0 or int(c.track_index) == 0) and (str(c.source_path or '').strip() or fallback_path)]
        total = len(targets)
        for idx, clip in enumerate(targets):
            if stop_flag is not None and stop_flag():
                raise RuntimeError('Đã dừng auto căn mặt')
            path = str(clip.source_path or '').strip() or str(fallback_path or '').strip()
            _log(log, f'Căn khung {idx + 1}/{total}: cảnh {clip.id[:12]}…')
            try:
                if path not in caps:
                    caps[path] = _open_capture(path)
                subject, n_hits, sw, sh = detect_primary_subject_for_clip(path, source_in_ms=clip.source_in_ms, source_out_ms=clip.source_out_ms, cap=caps[path], subject_mode=mode, crop_norm=crop_norm)
                sw, sh = infer_reframe_source_size(sw, sh, tw, th)
                scale, ox, oy = compute_reframe_transform(source_width=sw, source_height=sh, target_width=tw, target_height=th, face=subject, subject_padding=subject_padding, plate_aspect=plate, pan_axis=axis)
                updated = replace(clip, scale_percent=scale, scale_x_percent=scale, scale_y_percent=scale, offset_x=ox, offset_y=oy)
                work[id_to_index[clip.id]] = updated
                kind = subject.kind if subject is not None else ''
                note = f'không chủ thể → giữa plate {plate} · axis={axis}' if subject is None else f'ok {kind} plate={plate} axis={axis}'
                results.append(ClipReframeResult(clip_id=clip.id, found_face=subject is not None and subject.kind == 'face', scale_percent=scale, offset_x=ox, offset_y=oy, face_count=n_hits, note=note, subject_kind=kind, subject_cx=float(subject.cx) if subject is not None else 0.5, subject_cy=float(subject.cy) if subject is not None else 0.5, subject_w=float(subject.w) if subject is not None else 0.0, subject_h=float(subject.h) if subject is not None else 0.0, source_width=int(sw or 0), source_height=int(sh or 0), has_subject=subject is not None))
            except Exception as exc:
                results.append(ClipReframeResult(clip_id=clip.id, found_face=False, scale_percent=int(clip.scale_percent), offset_x=int(clip.offset_x), offset_y=int(clip.offset_y), note=str(exc) or exc.__class__.__name__))
        for cap in caps.values():
            try:
                cap.release()
            except:
                pass
    except:
        for cap in caps.values():
            try:
                cap.release()
            except Exception:
                continue
    return (work, results)