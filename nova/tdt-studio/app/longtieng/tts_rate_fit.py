'Công thức sinh lại giọng Edge khi stretch_video tràn — một lần.\n\nrate_can = Σ(nói) / (video − neo_chuỗi − tổng_khe) − 1\npct = ceil(rate_can * 100) rồi speed = 1 + pct/100.\nCấm overflow/video. Cấm số % đóng cứng.\n'
from __future__ import annotations
import math
from typing import Any
from longtieng.longtieng_audio_utils import VOICE_OVERFLOW_WARN_SEC
MIN_GAP_SEC = 0.03
CHAIN_GLUE_SLACK_SEC = 0.02

def compute_rate_can(*, speak_sec: float, video_sec: float, neo_sec: float, gap_sec: float) -> float | None:
    slot = float(video_sec) - float(neo_sec) - float(gap_sec)
    if slot <= 0:
        return None
    speak = float(speak_sec)
    return None if speak <= 0 else speak / slot - 1.0

def edge_speed_from_rate_can(rate_can: float) -> float:
    pct = int(math.ceil(float(rate_can) * 100.0))
    if pct < 0:
        pct = 0
    return 1.0 + pct / 100.0

def _cue_start(row: dict[str, Any]) -> float:
    return float(row.get('start', 0) or 0)

def _cue_duration(row: dict[str, Any]) -> float:
    dur = float(row.get('duration', 0) or 0)
    if dur > 0:
        return dur
    start = _cue_start(row)
    end = float(row.get('end', 0) or 0)
    return max(0.0, end - start)

def _cue_end(row: dict[str, Any]) -> float:
    end_raw = row.get('end')
    try:
        end = float(end_raw)
        if end_raw is None or end <= 0:
            return _cue_start(row) + _cue_duration(row)
    except (TypeError, ValueError):
        pass

def last_voice_chain(cues: list[dict[str, Any]], *, min_gap_sec: float) -> list[dict[str, Any]]:
    rows = sorted(cues or [], key=_cue_start)
    if rows:
        glue = float(min_gap_sec) + CHAIN_GLUE_SLACK_SEC
        chain = [rows[-1]]
        for prev, cur in zip(reversed(rows[:-1]), reversed(rows[1:])):
            gap = _cue_start(cur) - _cue_end(prev)
            if gap <= glue + 1e-09:
                chain.append(prev)
        chain.reverse()
        return chain
    return []

def chain_gap_sec(chain: list[dict[str, Any]]) -> float:
    if len(chain) < 2:
        return 0.0
    total = 0.0
    for prev, cur in zip(chain, chain[1:]):
        total += max(0.0, _cue_start(cur) - _cue_end(prev))
    return total

def _retry_speed_from_rate(rate: float, max_speed: float) -> float | None:
    need = (1.0 + float(rate)) ** 2 - 1.0
    speed = edge_speed_from_rate_can(need)
    try:
        cap = float(1.2 if max_speed is None else max_speed)
    except (TypeError, ValueError):
        cap = 1.2
    cap = max(1.0, min(2.5, cap))
    return cap if speed > cap else speed

def retry_edge_speed(cues: list[dict[str, Any]], *, video_dur_sec: float, min_gap_sec: float, max_speed: float) -> float | None:
    chain = last_voice_chain(cues, min_gap_sec=min_gap_sec)
    if chain:
        rate = compute_rate_can(speak_sec=sum((_cue_duration(row) for row in chain)), video_sec=float(video_dur_sec or 0), neo_sec=_cue_start(chain[0]), gap_sec=chain_gap_sec(chain))
        if rate is None or rate <= 0:
            rows = sorted(cues or [], key=_cue_start)
            if rows:
                rate = compute_rate_can(speak_sec=sum((_cue_duration(row) for row in rows)), video_sec=float(video_dur_sec or 0), neo_sec=0.0, gap_sec=(len(rows) - 1) * float(min_gap_sec))
                if rate is None or rate <= 0:
                    return None
            else:
                return None
        else:
            return _retry_speed_from_rate(rate, max_speed)
    else:
        return None

def should_retry_edge_rate(*, overflow_sec: float, engine: str, fit_mode: str, retry_speed: float | None, max_speed: float) -> bool:
    if float(overflow_sec or 0) <= VOICE_OVERFLOW_WARN_SEC:
        return False
    if str(engine or '').strip().lower() != 'edge':
        return False
    if str(fit_mode or '').strip().lower() != 'stretch_video':
        return False
    if retry_speed is None:
        return False
    try:
        cap = float(1.2 if max_speed is None else max_speed)
    except (TypeError, ValueError):
        cap = 1.2
    cap = max(1.0, min(2.5, cap))
    speed = float(retry_speed)
    return False if speed > cap else speed > 1.0