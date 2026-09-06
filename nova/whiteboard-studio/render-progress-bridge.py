#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""render-progress-bridge.py — cầu nối tiến trình render (file CỦA NOVA,
không thuộc repo vendored srt-whiteboard-animation — nguồn repo giữ nguyên).

Vấn đề: render_stream_whiteboard.py KHÔNG phát tiến trình trong lúc render
(chỉ print vài dòng đầu/cuối), nên Node không biết % thật, tốc độ, ETA hay
engine có kẹt — thanh tiến trình phía GUI chỉ bò "ước tính" giả.

Giải pháp: chạy vendored script Y NGUYÊN qua runpy, nhưng trước đó:
  1. bọc cv2.VideoWriter bằng subclass đếm khung — mọi khung engine ghi
     đều đi qua write() → phát WBPROG frame=<n> ra stderr (flush từng dòng);
  2. bọc stream_render.transcode_h264 → phát WBPROG transcode khi engine
     sang giai đoạn chuyển mã H.264.

Giao thức stderr (py-backend.js parse, KHÔNG đưa vào Log renderer):
  WBPROG open fps=<f> w=<w> h=<h>   khi mở writer (engine chỉ mở 1 writer/lần)
  WBPROG frame=<n>                  mỗi 5 khung (và 5 khung đầu tiên)
  WBPROG transcode                  bắt đầu chuyển mã H.264
  WBPROG error <msg>                lỗi hạ tầng của bridge (lộ liễu, Luật 10)

Exit code được giữ nguyên của script gốc (sys.exit(main())).
"""
import os
import runpy
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
_VENDORED_SCRIPTS = os.path.join(_HERE, "srt-whiteboard-animation", "scripts")
_RENDER_SCRIPT = os.path.join(_VENDORED_SCRIPTS, "render_stream_whiteboard.py")

if not os.path.isfile(_RENDER_SCRIPT):
    sys.stderr.write("WBPROG error render script not found: %s\n" % _RENDER_SCRIPT)
    sys.stderr.flush()
    sys.exit(2)

# vendored script tự insert thư mục của nó; bridge cũng insert để import
# stream_render TRƯỚC khi script gốc chạy (module cache dùng chung)
sys.path.insert(0, _VENDORED_SCRIPTS)

import cv2  # noqa: E402


def _emit(msg):
    sys.stderr.write(msg + "\n")
    sys.stderr.flush()


_OrigVideoWriter = cv2.VideoWriter


class CountingVideoWriter(_OrigVideoWriter):
    """VideoWriter đếm khung — API y nguyên, chỉ thêm đếm + phát WBPROG."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._wb_n = 0
        try:
            fps = float(args[2]) if len(args) > 2 else float(kwargs.get("fps", 0) or 0)
        except (TypeError, ValueError):
            fps = 0.0
        size = args[3] if len(args) > 3 else kwargs.get("frameSize")
        w = int(size[0]) if size else 0
        h = int(size[1]) if size and len(size) > 1 else 0
        fps_txt = ("%g" % fps) if fps > 0 else "?"
        _emit("WBPROG open fps=%s w=%d h=%d" % (fps_txt, w, h))

    def write(self, image):
        super().write(image)
        self._wb_n += 1
        if self._wb_n <= 5 or self._wb_n % 5 == 0:
            _emit("WBPROG frame=%d" % self._wb_n)


cv2.VideoWriter = CountingVideoWriter

# bọc transcode_h264: marker chính xác lúc engine hết ghi khung, sang chuyển mã
try:
    import stream_render as _sr  # noqa: E402

    _orig_transcode = _sr.transcode_h264

    def _counting_transcode(src, dst):
        _emit("WBPROG transcode")
        return _orig_transcode(src, dst)

    _sr.transcode_h264 = _counting_transcode
except Exception as e:  # ImportError/lỗi import — lộ ra, không che
    _emit("WBPROG error wrap transcode failed: %s" % e)

# chạy vendored script như __main__, forward nguyên bộ argv
sys.argv = [_RENDER_SCRIPT] + sys.argv[1:]
try:
    runpy.run_path(_RENDER_SCRIPT, run_name="__main__")
except SystemExit as e:
    code = e.code
    sys.exit(code if isinstance(code, int) else (0 if code is None else 1))
