from __future__ import annotations
from collections import deque
from contextlib import contextmanager
import copy
import hashlib
import os
import re
import subprocess
import sys
import time
from dataclasses import replace
from datetime import datetime
from pathlib import Path
from PySide6.QtCore import QEventLoop, QSize, QThreadPool, QTimer, QUrl, Qt
from PySide6.QtGui import QAction, QDesktopServices
from PySide6.QtWidgets import QApplication, QButtonGroup, QCheckBox, QComboBox, QDockWidget, QFileDialog, QFrame, QHBoxLayout, QLabel, QLineEdit, QMainWindow, QMenu, QMessageBox, QProgressBar, QSizePolicy, QSplitter, QStackedWidget, QToolBar, QToolButton, QVBoxLayout, QWidget
from core.sort_utils import media_basename_sort_key
from core.api_keys import merge_api_key_pools, parse_api_key_pool
from core.credentials import CredentialStore
from core.paths import PATHS
from core.runtime_flavor import is_frozen_packaged
from core.sfx import load_sfx_events, save_sfx_events
from core.subtitles import SubtitleDocument, load_srt, save_srt
from core.video_export import VideoExportSettings, build_export_plan, resolve_target_size, summarize_export_plan_for_log
from services_media import MediaInfo, probe_audio_duration_ms
from services_tts_voice import TTSVoiceSettings
from core.export_preflight import apply_auto_fixes, collect_template_preflight_issues, format_preflight_detail
from services_video_export import ExportResult, export_disk_warning, format_pre_export_validation_error
from ui_qt.inspector_nav import TRANSITION_TARGET, InspectorTarget, normalize_module_id, target_for_asset_kind, target_for_preview_kind, library_nav_for_overlay_part, target_for_timeline_layer
from ui_qt.asset_export import apply_export_tts_vocal_guard, asset_dub_pipeline_steps, asset_needs_dub_pipeline, resolve_per_video_export_overrides
from ui_qt.batch_dub import dub_pipeline_steps_for_stt_engine, video_asset_ids_for_batch_dub
from ui_qt.batch_job import BatchJobRecord, clear_batch_job, load_batch_job, save_batch_job, summarize_batch_job
from ui_qt.export_presets import load_export_preset, save_export_preset
from ui_qt.history import ProjectHistory, capture_snapshot
from ui_qt.modules import APP_MODULES, is_tool_module, module_by_id
from ui_qt.panels.control_board import FullControlBoard
from ui_qt.panels.module_rail import ModuleRail
from ui_qt.panels.module_workbench import ModuleWorkbench
from ui_qt.panels.summary_dialog import SummaryDialog
from ui_qt.widgets.tool_module_dialog import ToolModuleDialog
from ui_qt.panels.preview_panel import PreviewPanel
from ui_qt.panels.project_panel import ProjectPanel
from ui_qt.panels.resource_library import ResourceLibrary
from ui_qt.panels.timeline_panel import TimelinePanel
from ui_qt.project_io import load_project, save_project
from ui_qt.project_registry import allocate_project_path, default_new_project_name, delete_project_file, list_recent_projects, project_output_dir, read_project_name, rename_project_file, save_named_project
from ui_qt.session import get_last_project_path, remember_project_path, restore_startup_state, save_session, session_has_work
from ui_qt.state import Asset, ProjectState, apply_project_media, empty_project_state, new_project_media_state
from ui_qt.user_prefs import get_last_dir, get_last_export_folder, remember_path
from ui_qt.version import APP_UI_VERSION, display_version
from core.brand import APP_DISPLAY_NAME, APP_DISPLAY_NAME_UPPER, APP_TAGLINE
from ui_qt.workers.auto_blur import AutoBlurTask
from ui_qt.workers.face_reframe import FaceReframeTask
from ui_qt.workers.batch_export import BatchVideoExportTask
from ui_qt.workers.capcut_subtitle import CapCutSubtitleTask
from ui_qt.workers.hardsub import HardsubTask
from ui_qt.workers.media_probe import MediaProbeTask
from ui_qt.workers.scene_detect import SceneDetectTask
from ui_qt.widgets.media_library_dialog import MediaLibraryDialog
from ui_qt.workers.thumbnail_load import ThumbnailLoadTask
from ui_qt.workers.subtitle_jobs import OCRSubtitleTask, ProviderProbeTask, SpeechRecognitionTask, TranslationTask
from ui_qt.workers.tts_preview import TTSPreviewTask
from ui_qt.workers.tts_voice import TTSVoiceTask
from ui_qt.workers.video_export import VideoExportTask
from ui_qt.widgets.error_log_dialog import ErrorLogDialog
from ui_qt.widgets.export_progress_panel import ExportProgressPanel

class _ShrinkableWorkspacePane(QFrame):
    __doc__ = 'Pane trên workspace có thể thu nhỏ khi kéo timeline cao.'

    def __init__(self, *, min_w: int, min_h: int, parent=None):
        super().__init__(parent)
        self._min_w = min_w
        self._min_h = min_h
        self.setMinimumHeight(min_h)
        self.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Ignored)

    def minimumSizeHint(self) -> QSize:
        return QSize(self._min_w, self._min_h)

    def sizeHint(self) -> QSize:
        return QSize(max(self._min_w, 300), 420)

class CommandCenterWindow(QMainWindow):

    def __init__(self, state: ProjectState | None, playback, thread_pool=None, export_task_factory=VideoExportTask, batch_task_factory=BatchVideoExportTask, credential_store: CredentialStore | None=None, subtitle_workspace: str | Path | None=None, translation_task_factory=TranslationTask, speech_task_factory=SpeechRecognitionTask, ocr_task_factory=OCRSubtitleTask, tts_task_factory=TTSVoiceTask, capcut_task_factory=CapCutSubtitleTask, restore_session: bool=False):
        super().__init__()
        self.setAttribute(Qt.WidgetAttribute.WA_DontShowOnScreen, True)
        self.setObjectName('commandCenterWindow')
        self.setWindowTitle(f'{APP_DISPLAY_NAME} — {APP_TAGLINE} · UI {display_version()}')
        self.resize(1600, 900)
        self.setMinimumSize(1180, 700)
        self.state = state if state is not None else empty_project_state()
        self.playback = playback
        self.thread_pool = thread_pool or QThreadPool.globalInstance()
        self.export_task_factory = export_task_factory
        self.batch_task_factory = batch_task_factory
        self.translation_task_factory = translation_task_factory
        self.speech_task_factory = speech_task_factory
        self.ocr_task_factory = ocr_task_factory
        self.tts_task_factory = tts_task_factory
        self.capcut_task_factory = capcut_task_factory
        self.credential_store = credential_store or CredentialStore()
        self.subtitle_workspace = Path(subtitle_workspace or PATHS.user_data / 'subtitles').expanduser().resolve()
        self.export_task = None
        self.batch_task = None
        self.subtitle_task = None
        self.provider_probe_task = None
        self.tts_task = None
        self.capcut_task = None
        self._subtitle_task_kind = ''
        self.auto_blur_task = None
        self.face_reframe_task = None
        self.scene_detect_task = None
        self._scene_batch_queue = deque()
        self._scene_batch_total = 0
        self._scene_batch_done = 0
        self._scene_batch_errors = 0
        self._scene_batch_active_id = ''
        self._scene_batch_anchor_id = ''
        self.video_stem_task = None
        self._stem_batch_queue = deque()
        self._stem_batch_total = 0
        self._stem_batch_done = 0
        self._timeline_playback_path = ''
        self._timeline_playback_clip_id = ''
        self.hardsub_task = None
        self.tts_preview_task = None
        self._tts_preview_token = 0
        self._tts_preview_label = ''
        self._probe_tasks = {}
        self._probe_queue = deque()
        self._probe_active = 0
        self._import_batch_remaining = 0
        self._import_batch_anchor_id = ''
        self._import_batch_first_path = ''
        self._thumb_queue = deque()
        self._thumb_active = 0
        self._media_library_dialog = None
        self._voice_preview_proc = None
        self._replacing_source_for = None
        self._dub_pipeline_steps = []
        self._dub_pipeline_active = False
        self._batch_dub_active = False
        self._batch_dub_asset_ids = []
        self._batch_dub_total = 0
        self._batch_dub_completed = 0
        self._batch_produce_export_active = False
        self._batch_produce_export_folder = ''
        self._batch_produce_export_ids = []
        self._batch_produce_export_total = 0
        self._batch_produce_export_completed = 0
        self._batch_produce_export_dub_phase = False
        self._batch_produce_export_queue_index = 0
        self._batch_produce_export_used_paths = set()
        self._batch_produce_prep_asset_id = ''
        self._batch_produce_prep_step = ''
        self._active_batch_job = None
        self._batch_pause_requested = False
        self._batch_user_paused = False
        self._produce_export_tasks = {}
        self._produce_export_plan_queue = []
        self._produce_export_progress = {}
        self._produce_voice_by_asset = {}
        self._frozen_audio_intent_by_asset = {}
        self._batch_failed_clips = []
        self._batch_produce_step = ''
        self._pipeline_asset_id = None
        self._user_edit_asset_id = ''
        self._export_job_state = None
        self._export_job_path = ''
        self._job_state_swap_depth = 0
        self._pending_export_after_dub = ''
        self._single_export_prep_active = False
        self._single_export_prep_output = ''
        self._single_export_prep_asset_id = ''
        self._single_export_prep_step = ''
        self._single_export_face_done = False
        self._single_export_scene_skipped = False
        self._single_export_prep_watchdog = QTimer(self)
        self._single_export_prep_watchdog.setSingleShot(True)
        self._single_export_prep_watchdog.timeout.connect(self._on_single_export_prep_watchdog)
        self._export_resource_depth = 0
        self._export_activity_ui_at = 0.0
        self._export_activity_log_at = 0.0
        self._export_keepalive = QTimer(self)
        self._export_keepalive.setInterval(1500)
        self._export_keepalive.timeout.connect(self._on_export_keepalive_tick)
        self._project_path = get_last_project_path()
        self._suppress_autosave = False
        self._error_log = []
        self._log_path = Path.cwd() / 'log.txt'
        self.error_log_dialog = None
        self.active_module_id = ''
        self.history = ProjectHistory()
        self._history_baseline = capture_snapshot(self.state)
        self._autosave_timer = QTimer(self)
        self._autosave_timer.setSingleShot(True)
        self._autosave_timer.setInterval(1200)
        self._autosave_timer.timeout.connect(self._flush_autosave)
        self._history_push_timer = QTimer(self)
        self._history_push_timer.setSingleShot(True)
        self._history_push_timer.setInterval(350)
        self._history_push_timer.timeout.connect(self._push_history)
        self._timeline_pos_pending = 0
        self._timeline_pos_timer = QTimer(self)
        self._timeline_pos_timer.setInterval(80)
        self._timeline_pos_timer.timeout.connect(self._flush_timeline_position)
        self._timeline_sync_at = 0.0
        self._timeline_clips_cache = None
        self._timeline_clips_token = None
        self._seek_guard_source_ms = None
        self._seek_guard_until_mono = 0.0
        self._timeline_anchor_ms = None
        self.actions = self._create_actions()
        from ui_qt.splash import report_startup_progress
        report_startup_progress(52, 'Thanh công cụ…')
        self._create_toolbar()
        report_startup_progress(62, 'Dựng workspace…')
        self._create_workspace()
        report_startup_progress(78, 'Bảng điều khiển…')
        self._create_control_dock()
        self._connect_selection()
        self._activate_module('media')
        self.project_panel.set_thumbnail_scheduler(self._schedule_asset_thumbnail)
        self._refresh_credential_mask()
        self._refresh_export_ui()
        self._history_baseline = capture_snapshot(self.state)
        self._refresh_history_actions()
        if restore_session:
            report_startup_progress(86, 'Khôi phục phiên…')
            self._restore_session_on_startup()
        from ui_qt.export_encode_prefs import ENCODE_PREF_KEYS, apply_export_encode_prefs
        apply_export_encode_prefs(self.state.values)
        self.control_board.sync_control_values(*ENCODE_PREF_KEYS)
        batch_wb = self.module_workbenches.get('batch')
        if batch_wb is not None and hasattr(batch_wb, 'sync_export_encode_controls'):
            batch_wb.sync_export_encode_controls(self.state.values)
            batch_wb.restore_batch_ui_prefs()
        self._refresh_project_browser()
        try:
            import socket
            socket_runtime = getattr(socket, '__file__', 'built-in')
        except Exception as exc:
            socket_runtime = f'{exc.__class__.__name__}: {exc}'
        self._log_event('Khởi động UI', f'UI: {APP_UI_VERSION}\nPython: {sys.executable}\nVersion: {sys.version.split()[0]}\nPrefix: {sys.prefix}\nSocket: {socket_runtime}')
        if not restore_session or not session_has_work(self.state):
            self.statusBar().showMessage('Sẵn sàng')
        QTimer.singleShot(900, self._ensure_summary_dialog)

    def _create_actions(self) -> dict[str, QAction]:
        undo = QAction('Hoàn tác', self)
        undo.setShortcut('Ctrl+Z')
        undo.setShortcutContext(Qt.ShortcutContext.ApplicationShortcut)
        undo.triggered.connect(self.undo_last_change)
        self.addAction(undo)
        redo = QAction('Làm lại', self)
        redo.setShortcut('Ctrl+Shift+Z')
        redo.triggered.connect(self.redo_last_change)
        redo.setShortcutContext(Qt.ShortcutContext.ApplicationShortcut)
        self.addAction(redo)
        redo_alt = QAction(self)
        redo_alt.setShortcut('Ctrl+Y')
        redo_alt.triggered.connect(self.redo_last_change)
        redo_alt.setShortcutContext(Qt.ShortcutContext.ApplicationShortcut)
        self.addAction(redo_alt)
        open_project = QAction('Mở dự án', self)
        open_project.triggered.connect(self.choose_project_file)
        new_project = QAction('Dự án mới', self)
        new_project.setShortcut('Ctrl+N')
        new_project.setToolTip('Tạo dự án trống — giữ cấu hình edit, thêm video mới')
        new_project.triggered.connect(self.create_new_project)
        save_project_action = QAction('Lưu dự án', self)
        save_project_action.triggered.connect(self.choose_project_save_path)
        reload_ui = QAction('Reload UI', self)
        reload_ui.setToolTip('Đóng cửa sổ hiện tại và mở lại giao diện với code mới nhất')
        reload_ui.triggered.connect(self.reload_application)
        error_log = QAction('Log lỗi', self)
        error_log.setToolTip('Mở log hoạt động + lỗi (FFmpeg heartbeat, dub, phụ đề…) để copy gửi hỗ trợ')
        error_log.triggered.connect(self.show_error_log)
        storage_cleanup = QAction('Dọn dẹp dung lượng', self)
        storage_cleanup.setToolTip('Xóa cache tách giọng, cache xuất, file TTS tạm, log cũ và phụ đề mồ côi — kèm dung lượng giải phóng được')
        storage_cleanup.triggered.connect(self.open_storage_cleanup_dialog)
        reset = QAction('Đặt lại bố cục', self)
        reset.triggered.connect(self.reset_layout)
        fullscreen = QAction('Toàn màn hình', self)
        fullscreen.setShortcut('F11')
        fullscreen.triggered.connect(self._toggle_fullscreen)
        export = QAction('Xuất video', self)
        export.setEnabled(False)
        export.setToolTip('Xuất ngay vào thư mục OUTPUT (lần xuất gần nhất). Giữ Shift khi bấm để chọn nơi lưu khác.')
        export.triggered.connect(self.choose_export_path)
        batch_export = QAction('Xuất hàng loạt', self)
        batch_export.setEnabled(False)
        batch_export.setToolTip('Thêm ít nhất một video thật để xuất hàng loạt')
        batch_export.triggered.connect(self.choose_batch_export_folder)
        open_export_folder = QAction('Kết Quả', self)
        open_export_folder.setToolTip('Mở thư mục chứa video vừa xuất')
        open_export_folder.triggered.connect(self.open_last_export_folder)
        stop = QAction('Dừng xuất', self)
        stop.setEnabled(False)
        stop.setToolTip('Dừng quá trình xuất video đang chạy')
        stop.triggered.connect(self.stop_export)
        settings = QAction('Cài đặt', self)
        settings.setToolTip('Cài đặt xuất: CPU/GPU, codec, bitrate, hàng đợi… (thay cho tab Cài đặt trên thanh trái)')
        settings.triggered.connect(lambda: self._open_tool_module_sheet('settings'))
        license_action = QAction('Bản quyền', self)
        license_action.setToolTip('Kích hoạt / kiểm tra / gỡ bản quyền máy này')
        license_action.triggered.connect(self.open_license_panel)
        return {'undo': undo, 'redo': redo, 'open_project': open_project, 'new_project': new_project, 'save_project': save_project_action, 'reload_ui': reload_ui, 'error_log': error_log, 'storage_cleanup': storage_cleanup, 'reset': reset, 'fullscreen': fullscreen, 'export': export, 'batch_export': batch_export, 'open_export_folder': open_export_folder, 'stop': stop, 'settings': settings, 'license': license_action}

    def _create_toolbar(self) -> None:
        toolbar = QToolBar('Thanh công cụ chính', self)
        toolbar.setObjectName('mainToolbar')
        toolbar.setMovable(False)
        brand = QLabel(f'  {APP_DISPLAY_NAME_UPPER}  ·  v{display_version()}  ')
        brand.setObjectName('brandLabel')
        brand.setToolTip(f'Phiên bản giao diện: {display_version()}')
        toolbar.addWidget(brand)
        mode_wrap = QWidget()
        mode_wrap.setObjectName('workspaceModeWrap')
        mode_row = QHBoxLayout(mode_wrap)
        mode_row.setContentsMargins(8, 0, 8, 0)
        mode_row.setSpacing(2)
        self._mode_edit_btn = QToolButton(self)
        self._mode_edit_btn.setObjectName('workspaceModeBtn')
        self._mode_edit_btn.setText('Edit Video')
        self._mode_edit_btn.setCheckable(True)
        self._mode_edit_btn.setChecked(True)
        self._mode_edit_btn.setToolTip('Biên tập video — thư viện Media / hiệu ứng / timeline')
        self._mode_download_btn = QToolButton(self)
        self._mode_download_btn.setObjectName('workspaceModeBtn')
        self._mode_download_btn.setText('Tải Video')
        self._mode_download_btn.setCheckable(True)
        self._mode_download_btn.setToolTip('Tải video/MP3 từ link — đồng cấp Edit, không lẫn trong rail')
        self._workspace_mode_group = QButtonGroup(self)
        self._workspace_mode_group.setExclusive(True)
        self._workspace_mode_group.addButton(self._mode_edit_btn)
        self._workspace_mode_group.addButton(self._mode_download_btn)
        self._mode_edit_btn.clicked.connect(lambda: self.set_workspace_mode('edit'))
        self._mode_download_btn.clicked.connect(lambda: self.set_workspace_mode('download'))
        mode_row.addWidget(self._mode_edit_btn)
        mode_row.addWidget(self._mode_download_btn)
        if is_frozen_packaged():
            self._mode_download_btn.hide()
        toolbar.addWidget(mode_wrap)
        toolbar.addSeparator()
        spacer = QWidget()
        spacer.setSizePolicy(QSizePolicy.Policy.Expanding, QSizePolicy.Policy.Preferred)
        toolbar.addWidget(spacer)
        self.export_progress = QProgressBar()
        self.export_progress.setObjectName('exportProgress')
        self.export_progress.setRange(0, 100)
        self.export_progress.setValue(0)
        self.export_progress.setFixedWidth(150)
        self.export_progress.setFormat('Đang xuất %p%')
        self.export_progress.hide()
        toolbar.addWidget(self.export_progress)
        toolbar.addAction(self.actions['stop'])
        toolbar.addAction(self.actions['open_export_folder'])
        toolbar.addAction(self.actions['batch_export'])
        toolbar.addAction(self.actions['export'])
        toolbar.addSeparator()
        toolbar.addAction(self.actions['license'])
        menu_btn = QToolButton(self)
        menu_btn.setObjectName('capcutMenuButton')
        menu_btn.setText('Menu')
        menu_btn.setPopupMode(QToolButton.ToolButtonPopupMode.InstantPopup)
        menu = QMenu(menu_btn)
        menu.addAction(self.actions['new_project'])
        menu.addAction(self.actions['open_project'])
        menu.addAction(self.actions['save_project'])
        menu.addSeparator()
        menu.addAction(self.actions['reload_ui'])
        menu.addAction(self.actions['error_log'])
        menu.addAction(self.actions['storage_cleanup'])
        menu.addAction(self.actions['reset'])
        menu.addSeparator()
        menu.addAction(self.actions['fullscreen'])
        menu.addAction(self.actions['open_export_folder'])
        menu.addAction(self.actions['license'])
        menu.addAction(self.actions['settings'])
        menu_btn.setMenu(menu)
        toolbar.addWidget(menu_btn)
        toolbar.addAction(self.actions['settings'])
        self.addToolBar(Qt.ToolBarArea.TopToolBarArea, toolbar)

    def _create_workspace(self) -> None:
        from ui_qt.splash import report_startup_progress
        self.project_panel = ProjectPanel(self.state, media_shell=True)
        report_startup_progress(64, 'Panel dự án…')
        self.preview_panel = PreviewPanel(self.state, playback=self.playback)
        report_startup_progress(67, 'Preview…')
        self.timeline_panel = TimelinePanel(self.state)
        report_startup_progress(70, 'Timeline…')
        self.resource_library = ResourceLibrary(self.project_panel)
        report_startup_progress(73, 'Thư viện…')
        self.resource_library.actionRequested.connect(self._on_resource_library_action)
        self.resource_library.effectsNavChanged.connect(self._on_effects_library_nav)
        self.resource_library.importLibraryRequested.connect(self._import_into_project_library)
        self.resource_library.useLibraryAssetRequested.connect(self._use_project_library_asset)
        self.resource_library.deleteLibraryAssetRequested.connect(self._delete_from_project_library)
        self.resource_library.transitionPreviewRequested.connect(self._preview_library_transition)
        self.resource_library.transitionModeChanged.connect(self._on_transition_mode_changed)
        self.resource_library.transitionPoolChanged.connect(self._on_transition_pool_changed)
        self.resource_library.presetApplyRequested.connect(self.apply_saved_preset)
        self.resource_library.presetPinToggled.connect(self._on_preset_pin_toggled)
        self.resource_library.presetRenameRequested.connect(self._on_preset_rename_requested)
        self.resource_library.presetDeleteRequested.connect(self._on_preset_delete_requested)
        self.resource_library.presetSaveRequested.connect(self._on_preset_save_requested)
        self.resource_library.set_thumbnail_scheduler(self._schedule_library_thumbnail)
        self._refresh_preset_library()
        self._build_control_stack()
        report_startup_progress(76, 'Khối điều khiển…')
        self.module_rail = ModuleRail()
        self._workspace_mode = 'edit'
        self._LEFT_LIBRARY_MIN_WIDTH = 160
        edit_column = QFrame()
        edit_column.setObjectName('mediaLibraryColumn')
        edit_column.setMinimumWidth(self._LEFT_LIBRARY_MIN_WIDTH)
        edit_column.setMaximumWidth(900)
        edit_column.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Expanding)
        edit_layout = QVBoxLayout(edit_column)
        edit_layout.setContentsMargins(0, 0, 0, 0)
        edit_layout.setSpacing(0)
        edit_layout.addWidget(self.module_rail, 0)
        edit_layout.addWidget(self.resource_library, 1)
        download_column = QFrame()
        download_column.setObjectName('downloadModeColumn')
        download_column.setMinimumWidth(self._LEFT_LIBRARY_MIN_WIDTH)
        download_column.setMaximumWidth(900)
        download_layout = QVBoxLayout(download_column)
        download_layout.setContentsMargins(10, 10, 10, 10)
        download_layout.setSpacing(8)
        download_title = QLabel('Tải Video')
        download_title.setObjectName('sectionTitle')
        download_hint = QLabel('Tab này mở bộ tải video riêng. Tải xong, thêm thư mục vào dự án. Xuất vẫn dùng nút trên thanh công cụ.')
        download_hint.setObjectName('mutedLabel')
        download_hint.setWordWrap(True)
        download_layout.addWidget(download_title, 0)
        download_layout.addWidget(download_hint, 0)
        downloader_wb = self.module_workbenches.get('downloader')
        if downloader_wb is not None:
            download_layout.addWidget(downloader_wb, 1)
            from ui_qt.feature_download import attach_download_workbench
            attach_download_workbench(downloader_wb, on_import_paths=self.import_media_paths)
        else:
            missing = QLabel('Panel tải video chưa sẵn sàng.')
            missing.setObjectName('mutedLabel')
            download_layout.addWidget(missing, 1)
        self._left_mode_stack = QStackedWidget()
        self._left_mode_stack.setObjectName('leftModeStack')
        self._left_mode_stack.setMinimumWidth(self._LEFT_LIBRARY_MIN_WIDTH)
        self._left_mode_stack.setMaximumWidth(900)
        self._left_mode_stack.addWidget(edit_column)
        self._left_mode_stack.addWidget(download_column)
        self._left_mode_stack.setCurrentIndex(0)
        top = QSplitter(Qt.Orientation.Horizontal)
        top.setObjectName('topWorkspaceSplitter')
        top.addWidget(self._left_mode_stack)
        top.addWidget(self.preview_panel)
        top.addWidget(self.control_dock)
        top.setStretchFactor(0, 0)
        top.setStretchFactor(1, 1)
        top.setStretchFactor(2, 0)
        top.setCollapsible(0, False)
        top.setCollapsible(1, False)
        top.setCollapsible(2, True)
        top.setSizes([480, 640, 280])
        self.workspace_top_splitter = top
        top.splitterMoved.connect(self._on_top_workspace_splitter_moved)
        top_row = _ShrinkableWorkspacePane(min_w=640, min_h=48)
        top_row.setObjectName('topWorkspaceRow')
        top_row_layout = QHBoxLayout(top_row)
        top_row_layout.setContentsMargins(0, 0, 0, 0)
        top_row_layout.setSpacing(0)
        top_row_layout.addWidget(top, 1)
        for panel in (self.preview_panel, self._left_mode_stack, self.control_dock):
            panel.setMinimumHeight(48)
            panel.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Ignored)
        self.resource_library.setMinimumHeight(48)
        self.resource_library.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Ignored)
        self.timeline_panel.setMinimumHeight(100)
        self.timeline_panel.setMaximumHeight(16777215)
        main_vertical = QSplitter(Qt.Orientation.Vertical)
        main_vertical.setObjectName('previewTimelineSplitter')
        main_vertical.setHandleWidth(6)
        main_vertical.setChildrenCollapsible(True)
        main_vertical.addWidget(top_row)
        main_vertical.addWidget(self.timeline_panel)
        main_vertical.setStretchFactor(0, 1)
        main_vertical.setStretchFactor(1, 1)
        main_vertical.setCollapsible(0, True)
        main_vertical.setCollapsible(1, True)
        main_vertical.setSizes([580, 240])
        main_vertical.splitterMoved.connect(self._on_preview_timeline_splitter_moved)
        self.workspace_vertical_splitter = main_vertical
        self._timeline_split_sizes = [580, 240]
        self._layout_focus_mode = 'normal'
        self._layout_saved_vertical = None
        self._layout_saved_horizontal = None
        self._inspector_full_height = False
        outer = QSplitter(Qt.Orientation.Horizontal)
        outer.setObjectName('workspaceOuterSplitter')
        outer.setHandleWidth(6)
        outer.setChildrenCollapsible(False)
        outer.addWidget(main_vertical)
        outer.setStretchFactor(0, 1)
        self.workspace_outer_splitter = outer
        self.export_panel = ExportProgressPanel()
        self.export_panel.cancelRequested.connect(self.stop_batch_job)
        self.export_panel.pauseRequested.connect(self.pause_batch_job)
        self.export_panel.resumeRequested.connect(self.resume_batch_job)
        self.export_panel.stopRequested.connect(self.stop_batch_job)
        self.export_panel.continueEditingRequested.connect(self._continue_editing_during_export)
        shell = QWidget()
        shell.setObjectName('workspaceShell')
        shell_layout = QHBoxLayout(shell)
        shell_layout.setContentsMargins(0, 0, 0, 0)
        shell_layout.setSpacing(0)
        shell_layout.addWidget(outer, 1)
        root = QWidget()
        root.setObjectName('appRoot')
        root_layout = QVBoxLayout(root)
        root_layout.setContentsMargins(0, 0, 0, 0)
        root_layout.setSpacing(0)
        root_layout.addWidget(shell, 1)
        root_layout.addWidget(self.export_panel, 0)
        self.workspace_splitter = top
        self.setCentralWidget(root)

    def _build_control_stack(self) -> None:
        self.control_board = FullControlBoard(self.state)
        self.control_stack = QStackedWidget()
        self.control_stack.addWidget(self.control_board)
        self.module_workbenches = {}
        self._tool_dialogs = {}
        self._summary_dialog = None
        for module in APP_MODULES:
            if module.id in frozenset({'subtitle', 'effects', 'summary', 'exporter', 'tts'}):
                pass
            else:
                workbench = ModuleWorkbench(module)
                workbench.primaryRequested.connect(self._handle_module_primary_action)
                if module.id == 'batch':
                    workbench.applyCurrentSettingsRequested.connect(self.apply_current_settings_to_batch)
                    workbench.batchDubPipelineRequested.connect(self.start_batch_dub_pipeline)
                    workbench.batchPauseRequested.connect(self.pause_batch_job)
                    workbench.batchResumeRequested.connect(self.resume_batch_job)
                    workbench.batchStopRequested.connect(self.stop_batch_job)
                    workbench.refreshQueueRequested.connect(self.refresh_batch_queue)
                    workbench.singleExportRequested.connect(self.choose_export_path)
                    workbench.exportFolderChanged.connect(lambda _path: self._refresh_project_work_context())
                    workbench.exportEncodeChanged.connect(self._on_batch_export_encode_changed)
                    for flag_key in ('batch_auto_scene_split', 'batch_auto_face_reframe'):
                        flag_ctl = workbench.controls.get(flag_key)
                        if isinstance(flag_ctl, QCheckBox):
                            flag_ctl.toggled.connect(lambda checked, k=flag_key: self._on_batch_prep_flag_toggled(k, checked))
                if module.id == 'settings':
                    workbench.openExportEncodeRequested.connect(lambda: self._open_tool_module_sheet('batch'))
                    workbench.openBatchSheetRequested.connect(lambda: self._open_tool_module_sheet('batch'))
                self.module_workbenches[module.id] = workbench
        inspector = _ShrinkableWorkspacePane(min_w=240, min_h=48)
        inspector.setObjectName('fullControlDock')
        inspector.setMinimumWidth(240)
        inspector.setMaximumWidth(720)
        layout = QVBoxLayout(inspector)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)
        layout.addWidget(self.control_stack, 1)
        self.control_dock = inspector

    def _create_control_dock(self) -> None:
        if not hasattr(self, 'control_dock') or self.control_dock is None:
            self._build_control_stack()
            return None

    def _connect_selection(self) -> None:
        self.module_rail.moduleChanged.connect(self.switch_module)
        self.project_panel.assetSelected.connect(self.select_asset)
        self.project_panel.addFilesRequested.connect(self.choose_media_files)
        self.project_panel.importPathsRequested.connect(self.import_media_paths)
        self.project_panel.replaceSourceRequested.connect(self.choose_replace_video_source)
        self.project_panel.newProjectRequested.connect(self.create_new_project)
        self.project_panel.openProjectRequested.connect(self.open_project_at)
        self.project_panel.browseProjectRequested.connect(self.choose_project_file)
        self.project_panel.projectRenameRequested.connect(self.rename_current_project)
        self.project_panel.deleteProjectRequested.connect(self.delete_project_at)
        self.project_panel.removeAssetRequested.connect(self.remove_video_from_project)
        self.project_panel.removeAssetsRequested.connect(self.remove_videos_from_project)
        self.project_panel.openAssetLocationRequested.connect(self._open_in_file_manager)
        self.project_panel.addFolderRequested.connect(self.choose_media_folder)
        self.project_panel.expandLibraryRequested.connect(self.open_media_library_fullscreen)
        self.project_panel.stemSeparateOneRequested.connect(self._on_stem_separate_one_requested)
        self.project_panel.stemSeparateAllRequested.connect(self._on_stem_separate_all_requested)
        self.project_panel.sceneSplitOneRequested.connect(self._on_scene_split_one_requested)
        self.project_panel.sceneSplitAllRequested.connect(lambda: self.start_auto_scene_split('all'))
        self.timeline_panel.libraryActionDropped.connect(self._on_library_action_dropped)
        self.timeline_panel.libraryAssetDropped.connect(self._on_library_asset_dropped)
        self.timeline_panel.clipSelected.connect(self.select_asset)
        self.timeline_panel.timelineClipSelected.connect(self._on_timeline_clip_selected)
        self.timeline_panel.layerSelected.connect(self._on_timeline_layer_selected)
        self.timeline_panel.trackFocusRequested.connect(self._on_timeline_track_focus)
        self.timeline_panel.summaryFlowRowActivated.connect(self._navigate_to_summary_row)
        self.timeline_panel.subtitleCueSelectRequested.connect(self.control_board.subtitle_panel.select_cue_row)
        self.timeline_panel.subtitleCueDeleteRequested.connect(self.control_board.subtitle_panel.delete_cue_at)
        self.timeline_panel.transitionSelected.connect(self._on_timeline_transition_selected)
        self.timeline_panel.trackAddRequested.connect(self._on_timeline_track_add)
        self.timeline_panel.trackSlotRemoveRequested.connect(self._on_timeline_track_slot_remove)
        self.timeline_panel.trimChanged.connect(self._on_timeline_trim_changed)
        self.timeline_panel.trimDragStarted.connect(self._push_history)
        self.timeline_panel.clipsChanged.connect(self._on_timeline_clips_changed)
        self.timeline_panel.layerTimingDragStarted.connect(self._push_history)
        self.timeline_panel.layerTimingChanged.connect(self._on_timeline_layer_timing_changed)
        self.timeline_panel.sfxEditStarted.connect(self._push_history)
        self.timeline_panel.sfxChanged.connect(self._on_sfx_changed)
        self.timeline_panel.cropToolToggled.connect(self._on_timeline_crop_tool)
        self.timeline_panel.audioMixChanged.connect(self._on_timeline_audio_mix_changed)
        self.timeline_panel.audioMixPreview.connect(self._on_timeline_audio_mix_preview)
        self.timeline_panel.mix_strip.stemsRequested.connect(self._on_video_stems_requested)
        self.timeline_panel.mix_strip.stemsCancelRequested.connect(self._on_video_stems_cancel)
        self.timeline_panel.positionScrubbed.connect(self._on_timeline_scrubbed)
        self.timeline_panel.scrubFinished.connect(self._on_timeline_scrub_finished)
        self.preview_panel.previewPositionScrubbed.connect(self._on_preview_slider_scrubbed)
        self.preview_panel.previewScrubFinished.connect(self._on_preview_slider_scrub_finished)
        self.preview_panel.presetApplyRequested.connect(self.apply_saved_preset)
        self.preview_panel.openPresetLibraryRequested.connect(self._open_preset_library_page)
        self.timeline_panel.undoRequested.connect(self.undo_last_change)
        self.timeline_panel.redoRequested.connect(self.redo_last_change)
        self.timeline_panel.bodyVisibleChanged.connect(self._on_timeline_body_visible_changed)
        self.timeline_panel.layoutModeRequested.connect(self.set_layout_focus_mode)
        self.timeline_panel.trackControlsChanged.connect(self._on_timeline_track_controls_changed)
        self.timeline_panel.autoSceneSplitRequested.connect(self.start_auto_scene_split)
        self.timeline_panel.speechRecognitionRequested.connect(self.start_speech_recognition)
        self.timeline_panel.insertVideoAtPlayheadRequested.connect(self.insert_timeline_video_at_playhead)
        self.timeline_panel.filmstripPathsNeeded.connect(self._on_timeline_filmstrip_needed)
        self.preview_panel.playback.positionChanged.connect(self._on_playback_position_for_timeline)
        self.preview_panel.playback.playingChanged.connect(self._on_playback_playing_changed_for_clips)
        self.preview_panel.playback.durationChanged.connect(self._on_player_duration_for_timeline)
        self.preview_panel.frame_canvas.subtitlePlacementChanged.connect(self._on_subtitle_placement_changed)
        self.preview_panel.frame_canvas.subtitleFontSizeChanged.connect(self._on_subtitle_font_size_changed)
        self.preview_panel.frame_canvas.subtitleScaleChanged.connect(self._on_subtitle_scale_changed)
        self.preview_panel.frame_canvas.subtitleBoxWidthChanged.connect(self._on_subtitle_box_width_changed)
        self.preview_panel.frame_canvas.blurZonesChanged.connect(self._on_blur_zones_changed)
        self.preview_panel.frame_canvas.logoPlacementChanged.connect(self._on_logo_placement_changed)
        self.preview_panel.frame_canvas.logoScaleChanged.connect(self._on_logo_scale_changed)
        self.preview_panel.frame_canvas.effectOverlayChanged.connect(self._on_effect_overlay_changed)
        self.preview_panel.frame_canvas.overlayMaskChanged.connect(self._on_overlay_mask_changed)
        self.preview_panel.frame_canvas.blendLayerChanged.connect(self._on_blend_layer_changed)
        self.preview_panel.frame_canvas.backgroundLayerChanged.connect(self._on_background_layer_changed)
        self.preview_panel.frame_canvas.videoTitlePlacementChanged.connect(self._on_video_title_placement_changed)
        self.preview_panel.frame_canvas.videoTitleLayoutChanged.connect(self._on_video_title_layout_changed)
        self.preview_panel.frame_canvas.videoTitleBoxWidthChanged.connect(self._on_video_title_box_width_changed)
        self.preview_panel.frame_canvas.textOverlayPlacementChanged.connect(self._on_text_overlay_placement_changed)
        self.preview_panel.frame_canvas.textOverlayLayoutChanged.connect(self._on_text_overlay_layout_changed)
        self.preview_panel.frame_canvas.videoTransformChanged.connect(self._on_video_transform_changed)
        self.preview_panel.frame_canvas.previewLayerRotationChanged.connect(self._on_preview_layer_rotation_changed)
        self.preview_panel.frame_canvas.videoCropChanged.connect(self._on_video_crop_changed)
        self.preview_panel.frame_canvas.previewDeleteRequested.connect(self._on_preview_delete_requested)
        self.preview_panel.frame_canvas.previewCopyRequested.connect(self._on_preview_copy_requested)
        self.preview_panel.frame_canvas.previewPasteRequested.connect(self._on_preview_paste_requested)
        self.preview_panel.frame_canvas.previewDuplicateRequested.connect(self._on_preview_duplicate_requested)
        self.preview_panel.frame_canvas.previewSelectionChanged.connect(self._on_preview_selection_changed)
        self.preview_panel.frame_canvas.editGestureStarted.connect(self._push_history)
        self.control_board.logoFileRequested.connect(self.choose_logo_file)
        self.control_board.voiceAudioFileRequested.connect(self.choose_voice_audio_file)
        self.control_board.backgroundAudioFileRequested.connect(self.choose_background_audio_file)
        self.control_board.effectOverlayFileRequested.connect(self.choose_effect_overlay_file)
        self.control_board.blendLayerFileRequested.connect(self.choose_blend_layer_file)
        self.control_board.backgroundLayerFileRequested.connect(self.choose_background_layer_file)
        self.control_board.backgroundDetailRequested.connect(lambda: self._activate_module('effects', overlay_part='background'))
        self.control_board.videoTitleFromFileRequested.connect(self.fill_video_title_from_selected_file)
        self.control_board.autoBlurRequested.connect(self.start_auto_blur)
        self.control_board.faceReframeRequested.connect(self.start_face_reframe)
        self.control_board.staleFacePlateClearRequested.connect(lambda: self._deactivate_face_plate_transform(refresh=True))
        self.control_board.facePlateRestoreRequested.connect(lambda: self._restore_face_plate_transform(refresh=True))
        self.control_board.faceSubjectCacheReframeRequested.connect(lambda: self._reframe_from_subject_cache(refresh=True))
        self.control_board.hardsubRequested.connect(self.start_hardsub_removal)
        self.control_board.presetSaveRequested.connect(self.choose_export_preset_save_path)
        self.control_board.presetLoadRequested.connect(self.choose_export_preset_file)
        self.control_board.saveOrientationDefaultRequested.connect(self._save_orientation_default)
        self.control_board.resetToOrientationDefaultRequested.connect(self._apply_orientation_default)
        self.control_board.settingsChanged.connect(self._on_settings_changed)
        self.control_board.settingsChanged.connect(self._schedule_autosave)
        self.control_board.settingsChanged.connect(self._schedule_preview_settings_refresh)
        self.control_board.settingsChanged.connect(self._schedule_timeline_layer_rows_refresh)
        self.control_board.settingsChanged.connect(self.timeline_panel.sync_audio_mix_from_state)
        self._sync_batch_prep_flag_widgets()
        self.control_board.overlayLayerSelected.connect(lambda: self.preview_panel.frame_canvas.set_preview_selection('overlay'))
        self.control_board.blendLayerSelected.connect(lambda: self.preview_panel.frame_canvas.set_preview_selection('blend'))
        if hasattr(self.control_board, 'backgroundLayerSelected'):
            self.control_board.backgroundLayerSelected.connect(lambda: self.preview_panel.frame_canvas.set_preview_selection('background'))
        self.control_board.sfxAddRequested.connect(lambda: self._on_timeline_track_add('sfx'))
        self.control_board.sfxRemoveSelectedRequested.connect(self._on_inspector_sfx_remove_selected)
        self.control_board.sfxPresetAddRequested.connect(self._on_inspector_sfx_preset_add)
        self.control_board.sfxOpenPresetsFolderRequested.connect(self._on_open_sfx_presets_folder)
        self.control_board.transitionRandomApplyRequested.connect(self._apply_random_transitions)
        self.control_board.cropModeRequested.connect(self._on_inspector_crop_mode)
        subtitle_panel = self.control_board.subtitle_panel
        subtitle_panel.importRequested.connect(self.choose_subtitle_file)
        subtitle_panel.saveRequested.connect(self.choose_subtitle_save_path)
        subtitle_panel.clearRequested.connect(self.clear_current_subtitles)
        subtitle_panel.translateRequested.connect(self.start_subtitle_translation)
        subtitle_panel.sttRequested.connect(self.start_speech_recognition)
        subtitle_panel.ocrRequested.connect(self.start_subtitle_ocr)
        self.control_board.ttsRequested.connect(self.start_tts_voice_generation)
        self.control_board.testVoiceRequested.connect(self.start_tts_voice_preview)
        self.control_board.ttsApiKeySaveRequested.connect(self.save_tts_api_key)
        self.control_board.voicePreviewRequested.connect(self.start_tts_voice_preview_for)
        eng = self.control_board.controls.get('tts_engine')
        if isinstance(eng, QComboBox):
            eng.currentIndexChanged.connect(lambda _i: self._refresh_tts_api_key_mask())
        self._refresh_tts_api_key_mask()
        subtitle_panel.dubPipelineRequested.connect(self.start_en_vi_dub_pipeline)
        subtitle_panel.batchDubPipelineRequested.connect(self.start_batch_dub_pipeline)
        subtitle_panel.exportFullPipelineRequested.connect(self.choose_export_path)
        subtitle_panel.seoFromTranscriptRequested.connect(self.generate_seo_from_current_subtitles)
        self.control_board.refAudioFileRequested.connect(self.choose_tts_ref_audio_file)
        subtitle_panel.capcutApiRequested.connect(self.start_capcut_api_subtitle)
        subtitle_panel.capcutAutoRequested.connect(self.start_capcut_auto_subtitle)
        subtitle_panel.stopRequested.connect(self.stop_subtitle_job)
        subtitle_panel.credentialSaveRequested.connect(self.save_provider_credential)
        subtitle_panel.providerProbeRequested.connect(self.start_provider_probe)
        subtitle_panel.sttProbeRequested.connect(self.start_stt_probe)
        subtitle_panel.documentChanged.connect(self._on_subtitle_document_changed)
        subtitle_panel.previewSegmentRequested.connect(self.preview_subtitle_segment)
        subtitle_panel.provider_combo.currentIndexChanged.connect(lambda _index: self._refresh_credential_mask())

    def _set_checkbox_control(self, key: str, checked: bool) -> None:
        control = self.control_board.controls.get(key)
        if isinstance(control, QCheckBox):
            control.blockSignals(True)
            control.setChecked(bool(checked))
            control.blockSignals(False)
            return None
        subtitle_control = self.control_board.subtitle_panel.controls.get(key)
        if isinstance(subtitle_control, QCheckBox):
            subtitle_control.blockSignals(True)
            subtitle_control.setChecked(bool(checked))
            subtitle_control.blockSignals(False)
            return None

    def _on_preview_delete_requested(self, kind: str) -> None:
        kind = str(kind or '')
        canvas = self.preview_panel.frame_canvas
        if kind == 'subtitle':
            self._delete_subtitle_from_preview()
            return None
        if kind == 'title':
            self.state.values['video_title_enabled'] = False
            self._set_checkbox_control('video_title_enabled', False)
            canvas.update()
            self.statusBar().showMessage('Đã xóa tiêu đề khỏi preview', 2500)
            self._schedule_autosave()
            return None
        if kind == 'text':
            self.state.values['text_overlay_enabled'] = False
            self._set_checkbox_control('text_overlay_enabled', False)
            canvas.update()
            self.statusBar().showMessage('Đã xóa chữ phụ họa khỏi preview', 2500)
            self._schedule_autosave()
            return None
        if kind == 'logo':
            self.state.values['logo_enabled'] = False
            self._set_checkbox_control('logo_enabled', False)
            self.preview_panel.refresh_settings()
            self.statusBar().showMessage('Đã xóa logo khỏi preview', 2500)
            self._schedule_autosave()
            return None
        if kind == 'overlay':
            from ui_qt.media_overlays import remove_selected_media_overlay
            removed = remove_selected_media_overlay(self.state.values)
            if not removed:
                self.state.values['effect_overlay_enabled'] = False
                self.state.values['media_overlays_master_enabled'] = False
                self._set_checkbox_control('media_overlays_master_enabled', False)
            self.control_board.sync_effect_overlay_controls()
            self.preview_panel.refresh_settings()
            self.statusBar().showMessage('Đã xóa lớp overlay khỏi preview', 2500)
            self._schedule_autosave()
            return None
        if kind == 'blend':
            from ui_qt.blend_layers import remove_selected_blend_layer
            if remove_selected_blend_layer(self.state.values):
                self.control_board.sync_blend_layer_controls()
                self.preview_panel.refresh_settings()
                self.statusBar().showMessage('Đã xóa hòa trộn khỏi preview', 2500)
                self._schedule_autosave()
            return None
        if kind == 'background':
            from ui_qt.background_layers import remove_selected_background_layer
            if remove_selected_background_layer(self.state.values):
                if hasattr(self.control_board, 'sync_background_layer_controls'):
                    self.control_board.sync_background_layer_controls()
                self._refresh_timeline_layer_rows()
                self.timeline_panel.reload_project()
                self.preview_panel.refresh_settings()
                self.statusBar().showMessage('Đã xóa nền khỏi preview', 2500)
                self._schedule_autosave()
            return None
        if kind == 'blur':
            from ui_qt.blur_zones import remove_selected_blur_zone, sync_controls_from_selected_blur
            if remove_selected_blur_zone(self.state.values):
                sync_controls_from_selected_blur(self.state.values)
                self.control_board.sync_blur_zone_controls()
                self.statusBar().showMessage('Đã xóa vùng mờ đang chọn', 2500)
            else:
                self.state.values['blur_zone_enabled'] = False
                self._set_checkbox_control('blur_zone_enabled', False)
                self.control_board.sync_blur_zone_controls()
                self.statusBar().showMessage('Đã tắt vùng mờ trên preview', 2500)
            self.preview_panel.refresh_settings()
            self._schedule_autosave()
            return None

    def _on_preview_copy_requested(self, kind: str) -> None:
        from ui_qt.preview_clipboard import clipboard_label, copy_preview_element
        kind = str(kind or '')
        if copy_preview_element(kind, self.state.values):
            label = clipboard_label()
            self.statusBar().showMessage(f'Đã sao chép {label}', 2500)
            return None
        self.statusBar().showMessage('Không thể sao chép phần tử này', 2500)

    def _on_preview_paste_requested(self) -> None:
        from ui_qt.preview_clipboard import paste_preview_element
        self._push_history()
        selection, message = (paste_preview_element(self.state.values)[0], paste_preview_element(self.state.values)[1])
        if selection:
            self._refresh_after_preview_clipboard(selection, message)
        else:
            self.statusBar().showMessage(message, 3000)
            return None

    def _on_preview_duplicate_requested(self, kind: str) -> None:
        from ui_qt.preview_clipboard import duplicate_preview_element
        kind = str(kind or '')
        self._push_history()
        selection, message = (duplicate_preview_element(kind, self.state.values)[0], duplicate_preview_element(kind, self.state.values)[1])
        if selection:
            self._refresh_after_preview_clipboard(selection, message)
        else:
            self.statusBar().showMessage(message, 3000)
            return None

    def _refresh_after_preview_clipboard(self, selection: str, message: str) -> None:
        selection = str(selection or '')
        self.control_board.reload_project(self.state)
        self.control_board.sync_effect_overlay_controls()
        self.control_board.sync_blend_layer_controls()
        if hasattr(self.control_board, 'sync_background_layer_controls'):
            self.control_board.sync_background_layer_controls()
        self.preview_panel.refresh_settings()
        canvas = self.preview_panel.frame_canvas
        canvas.set_preview_selection(selection)
        self._navigate_inspector_for_preview_kind(selection)
        self._schedule_autosave()
        self.statusBar().showMessage(message, 3000)

    def _delete_subtitle_from_preview(self) -> None:
        canvas = self.preview_panel.frame_canvas
        if canvas.selected_subtitle_text:
            canvas.clear_selected_subtitle()
            self.statusBar().showMessage('Đã bỏ xem câu phụ đề đang chọn', 2500)
            return None
        trim_start = int(self.state.values.get('trim_start_ms', 0) or 0)
        trim_end = int(self.state.values.get('trim_end_ms', 0) or 0)
        segment = self.state.subtitles.active_at_source_position(canvas.position_ms, trim_start_ms=trim_start, trim_end_ms=trim_end)
        if segment is not None:
            for index, item in enumerate(self.state.subtitles.segments):
                if item.start_ms == segment.start_ms and item.end_ms == segment.end_ms and (item.text == segment.text):
                    document = self.state.subtitles.without_segment(index)
                    if document.segments:
                        self.state.set_subtitles(document)
                        self.control_board.subtitle_panel.refresh_document()
                        self._on_subtitle_document_changed(document)
                    else:
                        self.clear_current_subtitles()
                    self.statusBar().showMessage('Đã xóa câu phụ đề tại vị trí phát', 2500)
                    return None
            self.state.values['subtitle_enabled'] = False
            self._set_checkbox_control('subtitle_enabled', False)
            canvas.clear_selected_subtitle()
            self.preview_panel.refresh_settings()
            self.statusBar().showMessage('Đã tắt hiển thị phụ đề trên preview', 2500)
            self._schedule_autosave()

    def _on_logo_placement_changed(self, x_norm: float, y_norm: float) -> None:
        self.state.values['logo_enabled'] = True
        self.state.values['logo_position'] = 'custom'
        self.state.values['logo_x_norm'] = float(x_norm)
        self.state.values['logo_y_norm'] = float(y_norm)
        self.control_board.sync_logo_position_controls()
        self.preview_panel.refresh_settings()
        x_norm(f'.0% × {y_norm}.0%', 2500)

    def _on_video_title_placement_changed(self, x_norm: float, y_norm: float) -> None:
        self.state.values['video_title_enabled'] = True
        self.state.values['video_title_position'] = 'custom'
        self.state.values['video_title_x_norm'] = float(x_norm)
        self.state.values['video_title_y_norm'] = float(y_norm)
        self.control_board.sync_combo_value('video_title_position', 'custom')
        self.preview_panel.frame_canvas.update()
        x_norm(f'.0% × {y_norm}.0% (kéo tự do)', 2500)

    def _on_video_title_layout_changed(self, x_norm: float, y_norm: float, scale_x: int, scale_y: int) -> None:
        self.state.values['video_title_enabled'] = True
        self.state.values['video_title_position'] = 'custom'
        self.state.values['video_title_x_norm'] = float(x_norm)
        self.state.values['video_title_y_norm'] = float(y_norm)
        sx = max(20, min(300, int(scale_x)))
        sy = max(20, min(300, int(scale_y)))
        self.state.values['video_title_scale_x_percent'] = sx
        self.state.values['video_title_scale_y_percent'] = sy
        self.state.values['video_title_scale_percent'] = int(round((sx + sy) / 2))
        self.control_board.sync_combo_value('video_title_position', 'custom')
        self.control_board.sync_control_values('video_title_scale_percent', 'video_title_box_width_percent')
        self.preview_panel.frame_canvas.update()
        self.statusBar().showMessage(f'Tiêu đề: ngang {sx}% · dọc {sy}%', 2500)

    def _on_video_title_box_width_changed(self, box_width_percent: int) -> None:
        percent = max(15, min(100, int(box_width_percent)))
        self.state.values['video_title_enabled'] = True
        self.state.values['video_title_position'] = 'custom'
        self.state.values['video_title_box_width_percent'] = percent
        self.state.values['video_title_layout_scale_percent'] = int(self.state.values.get('video_title_scale_percent', self.state.values.get('video_title_scale_x_percent', 100)) or 100)
        self.control_board.sync_combo_value('video_title_position', 'custom')
        self.control_board.sync_control_values('video_title_scale_percent', 'video_title_box_width_percent')
        self.preview_panel.frame_canvas.update()
        self._schedule_autosave()
        self.statusBar().showMessage(f'Tiêu đề: rộng khung {percent}% (kéo cạnh trái/phải)', 2500)

    def _on_text_overlay_placement_changed(self, x_norm: float, y_norm: float) -> None:
        from ui_qt.text_overlays import sync_selected_from_flat_text
        self.state.values['text_overlay_enabled'] = True
        self.state.values['text_overlay_style'] = 'static'
        self.state.values['text_overlay_position'] = 'custom'
        self.state.values['text_overlay_x_norm'] = float(x_norm)
        self.state.values['text_overlay_y_norm'] = float(y_norm)
        sync_selected_from_flat_text(self.state.values)
        self.control_board.sync_combo_value('text_overlay_style', 'static')
        self.control_board.sync_combo_value('text_overlay_position', 'custom')
        if hasattr(self.control_board, '_sync_text_motion_panel'):
            self.control_board._sync_text_motion_panel()
        if hasattr(self.control_board, '_refresh_text_overlay_list_labels'):
            self.control_board._refresh_text_overlay_list_labels()
        x_norm(f'.0% × {y_norm}.0%', 2500)

    def _on_text_overlay_layout_changed(self, x_norm: float, y_norm: float, scale_percent: int, box_width_norm: float) -> None:
        from ui_qt.text_overlays import sync_selected_from_flat_text
        self.state.values['text_overlay_enabled'] = True
        self.state.values['text_overlay_style'] = 'static'
        self.state.values['text_overlay_position'] = 'custom'
        self.state.values['text_overlay_x_norm'] = float(x_norm)
        self.state.values['text_overlay_y_norm'] = float(y_norm)
        self.state.values['text_overlay_scale_percent'] = max(20, min(300, int(scale_percent)))
        self.state.values['text_overlay_box_width_percent'] = max(15, min(100, int(round(float(box_width_norm) * 100))))
        sync_selected_from_flat_text(self.state.values)
        self.control_board.sync_combo_value('text_overlay_style', 'static')
        self.control_board.sync_combo_value('text_overlay_position', 'custom')
        self.control_board.sync_control_values('text_overlay_scale_percent', 'text_overlay_box_width_percent')
        if hasattr(self.control_board, '_sync_text_motion_panel'):
            self.control_board._sync_text_motion_panel()
        if hasattr(self.control_board, '_refresh_text_overlay_list_labels'):
            self.control_board._refresh_text_overlay_list_labels()
        self.statusBar().showMessage(f"Chữ phụ họa: cỡ {scale_percent}% · khung {self.state.values['text_overlay_box_width_percent']}%", 2500)

    def _on_logo_scale_changed(self, scale_percent: int) -> None:
        self.state.values['logo_scale_percent'] = max(5, min(100, int(scale_percent)))
        self.control_board.sync_logo_position_controls()
        self.preview_panel.refresh_settings()

    def _on_effect_overlay_changed(self, x_norm: float, y_norm: float, scale_percent: int) -> None:
        from ui_qt.media_overlays import sync_selected_from_flat_keys, update_selected_media_overlay
        self.state.values['effect_overlay_enabled'] = True
        self.state.values['media_overlays_master_enabled'] = True
        self.state.values['effect_overlay_x_norm'] = float(x_norm)
        self.state.values['effect_overlay_y_norm'] = float(y_norm)
        self.state.values['effect_overlay_scale_percent'] = max(5, min(200, int(scale_percent)))
        update_selected_media_overlay(self.state.values, enabled=True, x_norm=float(x_norm), y_norm=float(y_norm), scale_percent=int(scale_percent))
        sync_selected_from_flat_keys(self.state.values)
        self.control_board.sync_effect_overlay_controls()
        self.preview_panel.frame_canvas.update()
        self.statusBar().showMessage(f'{scale_percent}% @ {x_norm:.0f}%×{y_norm:.0f}', 2500)

    def _on_overlay_mask_changed(self, feather_percent: int, bias: int, axis: str='y') -> None:
        from ui_qt.media_overlays import sync_selected_from_flat_keys, update_selected_media_overlay
        feather = max(0, min(100, int(feather_percent)))
        direction = max(-100, min(100, int(bias)))
        axis_key = 'x' if str(axis).lower() == 'x' else 'y'
        self.state.values['effect_overlay_mask_enabled'] = True
        self.state.values['effect_overlay_mask_shape'] = 'film'
        self.state.values['effect_overlay_mask_feather_percent'] = feather
        self.state.values['effect_overlay_mask_feather_bias'] = direction
        self.state.values['effect_overlay_mask_feather_axis'] = axis_key
        update_selected_media_overlay(self.state.values, mask_enabled=True, mask_shape='film', mask_feather_percent=feather, mask_feather_bias=direction, mask_feather_axis=axis_key)
        sync_selected_from_flat_keys(self.state.values)
        self.control_board.sync_effect_overlay_controls()
        self.preview_panel.frame_canvas.update()
        axis_label = 'ngang' if axis_key == 'x' else 'dọc'
        self.statusBar().showMessage(f'Cuộn phim: nhòe {axis_label} {feather}% · hướng {direction}', 2500)

    def _on_blend_layer_changed(self, x_norm: float, y_norm: float, scale_percent: int) -> None:
        from ui_qt.blend_layers import sync_flat_keys_from_selected_blend, update_selected_blend_layer
        self.state.values['blend_layers_master_enabled'] = True
        self.state.values['blend_layer_x_norm'] = float(x_norm)
        self.state.values['blend_layer_y_norm'] = float(y_norm)
        self.state.values['blend_layer_scale_percent'] = max(5, min(200, int(scale_percent)))
        update_selected_blend_layer(self.state.values, enabled=True, x_norm=float(x_norm), y_norm=float(y_norm), scale_percent=int(scale_percent))
        sync_flat_keys_from_selected_blend(self.state.values)
        self.control_board.sync_blend_layer_controls()
        self.preview_panel.frame_canvas.update()
        self.statusBar().showMessage(f'{scale_percent}% @ {x_norm:.0f}%×{y_norm:.0f}', 2500)

    def _on_background_layer_changed(self, x_norm: float, y_norm: float, scale_percent: int) -> None:
        from ui_qt.background_layers import sync_flat_keys_from_selected_background, update_selected_background_layer
        self.state.values['background_layers_master_enabled'] = True
        self.state.values['background'] = 'custom'
        self.state.values['background_layer_fit_mode'] = 'free'
        self.state.values['background_layer_x_norm'] = float(x_norm)
        self.state.values['background_layer_y_norm'] = float(y_norm)
        self.state.values['background_layer_scale_percent'] = max(5, min(200, int(scale_percent)))
        update_selected_background_layer(self.state.values, enabled=True, fit_mode='free', x_norm=float(x_norm), y_norm=float(y_norm), scale_percent=int(scale_percent))
        sync_flat_keys_from_selected_background(self.state.values)
        self.control_board.sync_background_layer_controls()
        self.preview_panel.frame_canvas.update()
        self.statusBar().showMessage(f'{scale_percent}% @ {x_norm:.0f}%×{y_norm:.0f}', 2500)

    def _on_preview_layer_rotation_changed(self, kind: str, degrees: float) -> None:
        deg = float(degrees) % 360.0
        stored = int(round(deg)) if abs(deg - round(deg)) < 0.01 else round(deg, 2)
        kind = str(kind or '')
        if kind == 'video':
            self.state.values['rotation_degrees'] = stored
            control = self.control_board.controls.get('rotation_degrees')
            if control is not None:
                self.control_board._set_control_value(control, stored)
        elif kind == 'logo':
            self.state.values['logo_rotation_degrees'] = stored
            control = self.control_board.controls.get('logo_rotation_degrees')
            if control is not None:
                self.control_board._set_control_value(control, stored)
        elif kind == 'subtitle':
            self.state.values['subtitle_rotation_degrees'] = stored
            control = self.control_board.controls.get('subtitle_rotation_degrees')
            if control is not None:
                self.control_board._set_control_value(control, stored)
        elif kind == 'title':
            self.state.values['video_title_rotation_degrees'] = stored
            control = self.control_board.controls.get('video_title_rotation_degrees')
            if control is not None:
                self.control_board._set_control_value(control, stored)
        elif kind == 'text':
            self.state.values['text_overlay_rotation_degrees'] = stored
            control = self.control_board.controls.get('text_overlay_rotation_degrees')
            if control is not None:
                self.control_board._set_control_value(control, stored)
        elif kind == 'blur':
            from ui_qt.blur_zones import ensure_blur_zones, sync_controls_from_selected_blur
            self.state.values['blur_zone_rotation_degrees'] = stored
            zones = ensure_blur_zones(self.state.values)
            idx = int(self.state.values.get('blur_zone_index', 0) or 0)
            if 0 <= idx < len(zones):
                zones[idx] = {**zones[idx], **{'rotation_degrees': stored}}
                self.state.values['blur_zones'] = zones
            sync_controls_from_selected_blur(self.state.values)
            control = self.control_board.controls.get('blur_zone_rotation_degrees')
            if control is not None:
                self.control_board._set_control_value(control, stored)
        elif kind == 'overlay':
            from ui_qt.media_overlays import sync_flat_keys_from_selected, update_selected_media_overlay
            update_selected_media_overlay(self.state.values, rotation_degrees=stored)
            sync_flat_keys_from_selected(self.state.values)
            self.control_board.sync_effect_overlay_controls()
        elif kind == 'blend':
            from ui_qt.blend_layers import sync_flat_keys_from_selected_blend, update_selected_blend_layer
            update_selected_blend_layer(self.state.values, rotation_degrees=stored)
            sync_flat_keys_from_selected_blend(self.state.values)
            self.control_board.sync_blend_layer_controls()
        elif kind == 'background':
            from ui_qt.background_layers import sync_flat_keys_from_selected_background, update_selected_background_layer
            update_selected_background_layer(self.state.values, rotation_degrees=stored, fit_mode='free')
            sync_flat_keys_from_selected_background(self.state.values)
            self.control_board.sync_background_layer_controls()
        if self.state.selected_id:
            self.state.snapshot_asset_settings(self.state.selected_id)
        self.preview_panel.refresh_settings()
        self._schedule_autosave()
        self.statusBar().showMessage(f'Xoay {kind}: {stored}°', 2000)

    def _on_video_transform_changed(self, offset_x: int, offset_y: int, scale_x_percent: int, scale_y_percent: int) -> None:
        self.state.values['offset_x'] = int(offset_x)
        self.state.values['offset_y'] = int(offset_y)
        sx = max(10, min(500, int(scale_x_percent)))
        sy = max(10, min(500, int(scale_y_percent)))
        self.state.values['scale_x_percent'] = sx
        self.state.values['scale_y_percent'] = sy
        self.state.values['scale_percent'] = max(10, min(500, round((sx + sy) / 2)))
        from core.timeline_clips import clips_from_values, persist_values_transform_to_selected_clip
        raw = self.state.values.get('timeline_clips')
        if isinstance(raw, list) and raw:
            persist_values_transform_to_selected_clip(self.state.values)
            self._timeline_clips_cache = None
        if self.state.selected_id:
            self.state.snapshot_asset_settings(self.state.selected_id)
        self.control_board.sync_video_transform_controls()
        self.preview_panel.refresh_clip_transform_only()
        self._schedule_autosave()
        zoom_text = f'phóng {sx}%' if sx == sy else f'ngang {sx}% · dọc {sy}%'
        self.statusBar().showMessage(f'Video: lệch {offset_x},{offset_y} · {zoom_text}', 2000)

    def _on_video_crop_changed(self, left_percent: int, top_percent: int, right_percent: int, bottom_percent: int) -> None:
        self.state.values['crop_enabled'] = True
        self.state.values['crop_left_percent'] = max(0, min(95, int(left_percent)))
        self.state.values['crop_top_percent'] = max(0, min(95, int(top_percent)))
        self.state.values['crop_right_percent'] = max(5, min(100, int(right_percent)))
        self.state.values['crop_bottom_percent'] = max(5, min(100, int(bottom_percent)))
        self.control_board.sync_video_transform_controls()
        self.preview_panel.refresh_settings()
        self._schedule_autosave()
        self.statusBar().showMessage(f"Crop: L{self.state.values['crop_left_percent']}% T{self.state.values['crop_top_percent']}% R{self.state.values['crop_right_percent']}% B{self.state.values['crop_bottom_percent']}%", 2500)

    def start_auto_blur(self) -> None:
        if self._has_background_job():
            pass
        else:
            video = self._selected_video_asset()
            if video is not None and video.path:
                self.state.values['blur_zone_enabled'] = True
                zones = ensure_blur_zones(self.state.values)
                try:
                    target_w, target_h = (resolve_target_size(str(self.state.values.get('aspect_ratio', '9:16')), str(self.state.values.get('quality', '1080p')))[0], resolve_target_size(str(self.state.values.get('aspect_ratio', '9:16')), str(self.state.values.get('quality', '1080p')))[1])
                except ValueError:
                    target_w, target_h = ((1080, 1920)[0], (1080, 1920)[1])
                task = AutoBlurTask(video.path, zones, target_width=target_w, target_height=target_h)
                self.auto_blur_task = task
                task.signals.progressChanged.connect(lambda message: self.statusBar().showMessage(message, 4000))
                task.signals.completed.connect(self._on_auto_blur_completed)
                task.signals.failed.connect(self._on_auto_blur_failed)
                task.signals.finished.connect(self._on_auto_blur_finished)
                self.statusBar().showMessage('Đang Auto che phụ đề gốc…')
                self._refresh_export_ui()
                self.thread_pool.start(task)
            else:
                self.statusBar().showMessage('Hãy chọn video thật trước khi Auto che phụ đề gốc')

    def _on_auto_blur_completed(self, zones, hint) -> None:
        if not zones:
            self.statusBar().showMessage('Auto che không đổi được vùng', 4000)
            return None
        if hint is None:
            self.statusBar().showMessage('Không định vị được phụ đề gốc — giữ vùng che hiện tại', 5000)
            return None
        self.state.values['blur_zone_enabled'] = True
        self.state.values['blur_zones'] = list(zones)
        self.state.values['blur_zone_index'] = 0
        sync_controls_from_selected_blur(self.state.values)
        if 'subtitle_position' in hint:
            self.state.values['subtitle_position'] = hint['subtitle_position']
        if isinstance(hint, dict) and 'subtitle_margin_bottom' in hint:
            self.state.values['subtitle_margin_bottom'] = hint['subtitle_margin_bottom']
        enabled = self.control_board.controls.get('blur_zone_enabled')
        if isinstance(enabled, QCheckBox):
            enabled.blockSignals(True)
            enabled.setChecked(True)
            enabled.blockSignals(False)
        self.control_board.sync_blur_zone_controls()
        self.control_board.sync_subtitle_layout_controls()
        self.preview_panel.refresh_settings()
        self.statusBar().showMessage('Đã căn vùng che theo phụ đề gốc', 4000)

    def _on_auto_blur_failed(self, message: str) -> None:
        if 'dừng' in message.lower():
            self.statusBar().showMessage('Đã dừng Auto che')
            return None
        self._report_error('Auto che thất bại', message)

    def _on_auto_blur_finished(self) -> None:
        self.auto_blur_task = None
        self._refresh_export_ui()

    def start_face_reframe(self) -> None:
        if not self._ensure_licensed_or_warn(action='căn mặt tự động'):
            return None
        if self._has_background_job():
            self.statusBar().showMessage('Đang có tác vụ khác — chờ xong rồi auto căn mặt', 3500)
            return None
        if self._batch_auto_face_reframe_enabled():
            video = self._selected_video_asset()
            if video is not None and video.path:
                from core.timeline_clips import clips_from_values, ensure_timeline_clips, timeline_duration_ms
                source_ms = max(1, int(getattr(video, 'duration_ms', 0) or 0) or int(self.state.values.get('source_duration_ms', 0) or 0) or timeline_duration_ms(clips_from_values(self.state.values)) or 1)
                clips = ensure_timeline_clips(self.state.values, source_duration_ms=source_ms, source_path=str(video.path or ''))
                track0 = [c for c in clips if int(getattr(c, 'track_index', 0) or 0) == 0]
                if len(track0) < 1:
                    self.statusBar().showMessage('Chưa có clip video trên timeline', 3500)
                    return None
                if len(track0) == 1:
                    self.statusBar().showMessage('Gợi ý: Tách cảnh trước để mỗi người/đoạn có khung riêng', 4500)
                self._push_history()
                from core.face_reframe import crop_norm_from_export_values
                task = FaceReframeTask(clips, aspect_ratio=str(self.state.values.get('aspect_ratio', '9:16')), quality=str(self.state.values.get('quality', '1080p')), fallback_path=str(video.path or ''), subject_padding=2.4, plate_aspect=str(self.state.values.get('face_reframe_plate', '1:1') or '1:1'), pan_axis=str(self.state.values.get('face_reframe_pan_axis', 'horizontal') or 'horizontal'), subject_mode=str(self.state.values.get('face_reframe_subject_mode', 'face_then_object') or 'face_then_object'), crop_norm=crop_norm_from_export_values(self.state.values))
                self.face_reframe_task = task
                task.signals.progressChanged.connect(lambda message: self.statusBar().showMessage(message, 5000))
                task.signals.completed.connect(self._on_face_reframe_completed)
                task.signals.failed.connect(self._on_face_reframe_failed)
                task.signals.finished.connect(self._on_face_reframe_finished)
                self.statusBar().showMessage(f'Đang auto căn mặt cho {len(track0)} cảnh…', 4000)
                self._refresh_export_ui()
                self.thread_pool.start(task)
            else:
                self.statusBar().showMessage('Hãy chọn video thật trước khi auto căn theo mặt')
                return None
        else:
            self.statusBar().showMessage('Hãy tick «Bật tự căn mặt / chủ thể» ở panel Điều chỉnh trước', 4500)
            return None

    def _on_face_reframe_completed(self, clips, results) -> None:
        from core.face_reframe import FACE_SUBJECT_CACHE_KEY, build_face_subject_cache, crop_fingerprint
        from core.scene_clip_fx import stash_face_plate_transform
        from core.timeline_clips import apply_clip_transform_to_values, find_clip, selected_clip_id, write_clips
        if clips:
            write_clips(self.state.values, list(clips))
            self._timeline_clips_cache = None
            self._timeline_clips_token = None
            sel = selected_clip_id(self.state.values)
            chosen = find_clip(list(clips), sel) if sel else None
            if chosen is None and clips:
                chosen = clips[0]
            if chosen is not None:
                apply_clip_transform_to_values(self.state.values, chosen)
            video = self._selected_video_asset()
            source_path = str(getattr(video, 'path', '') or '')
            result_list = list(results or [])
            self.state.values[FACE_SUBJECT_CACHE_KEY] = build_face_subject_cache(result_list, source_path=source_path, aspect_ratio=str(self.state.values.get('aspect_ratio', '9:16') or '9:16'), quality=str(self.state.values.get('quality', '1080p') or '1080p'), subject_mode=str(self.state.values.get('face_reframe_subject_mode', 'face_then_object') or 'face_then_object'), crop_fp=crop_fingerprint(self.state.values))
            self.state.values.update(stash_face_plate_transform(self.state.values))
            self.control_board.sync_video_transform_controls()
            if hasattr(self.timeline_panel, 'canvas'):
                self.timeline_panel.canvas.invalidate_layout_cache()
                self.timeline_panel.canvas.set_playback_lite(False)
                self.timeline_panel.canvas.update()
            self.preview_panel.refresh_clip_transform_only()
            try:
                self.preview_panel.playback._scrub_decoder.release_captures_for_qt_play()
                self.preview_panel.playback._scrub_decoder.set_resource_save_mode(False)
            except Exception:
                pass
            self._schedule_autosave()
            hit = sum((1 for r in result_list if getattr(r, 'found_face', False) or str(getattr(r, 'subject_kind', '') or '') or bool(getattr(r, 'has_subject', False))))
            total = len(result_list) or len(clips)
            scales = [int(getattr(r, 'scale_percent', 0) or 0) for r in result_list]
            sc_hint = f' · phóng ~{min(scales)}–{max(scales)}%' if scales else ''
            axis = str(self.state.values.get('face_reframe_pan_axis', 'horizontal'))
            plate = str(self.state.values.get('face_reframe_plate', '1:1') or '1:1')
            self.statusBar().showMessage(f'Đã căn {hit}/{total} cảnh{sc_hint} (plate {plate} · nhích {axis}) — đổi khung con không cần chạy lại', 8000)
        else:
            self.statusBar().showMessage('Auto căn mặt: không có clip', 3500)

    def _on_face_reframe_failed(self, message: str) -> None:
        if 'dừng' in (message or '').lower():
            self.statusBar().showMessage('Đã dừng auto căn mặt')
            return None
        self._report_error('Auto căn mặt thất bại', message)

    def _on_face_reframe_finished(self) -> None:
        self.face_reframe_task = None
        self._refresh_export_ui()

    def insert_timeline_video_at_playhead(self) -> None:
        videos = [asset for asset in self.state.assets if asset.kind == 'video' and asset.path]
        if videos:
            from PySide6.QtWidgets import QInputDialog
            labels = [f'{asset.name}  ({_format_ms(int(asset.duration_ms or 0))})' for asset in videos]
            choice, ok = (QInputDialog.getItem(self, 'Chèn video vào timeline', 'Chọn video trong dự án (không đổi project đang chọn):', labels, 0, False)[0], QInputDialog.getItem(self, 'Chèn video vào timeline', 'Chọn video trong dự án (không đổi project đang chọn):', labels, 0, False)[1])
            if ok and choice:
                index = labels.index(choice)
                asset = videos[index]
                ok_insert = self.timeline_panel.insert_video_clip_at_playhead(source_path=str(asset.path), source_duration_ms=max(1, int(asset.duration_ms or 1)))
                if ok_insert:
                    self.preview_panel.refresh_settings()
                    self._schedule_autosave()
                    self.statusBar().showMessage(f'Đã chèn «{asset.name}» vào timeline tại playhead', 4000)
                    return None
                self.statusBar().showMessage('Không chèn được video', 3000)
            else:
                return None
        else:
            self.choose_media_files()
            return None

    def start_auto_scene_split(self, scope: str='one') -> None:
        mode = str(scope or 'one').strip().lower()
        if mode == 'all':
            self._start_batch_scene_split()
            return None
        if self._has_background_job():
            self.statusBar().showMessage('Đang có tác vụ khác — chờ xong rồi tách cảnh', 3500)
            return None
        video = self._selected_video_asset()
        if video is not None and video.path:
            self._begin_scene_detect_for_video(video)
        else:
            self.statusBar().showMessage('Hãy chọn video trước khi tách cảnh', 3500)
            return None

    def _start_batch_scene_split(self) -> None:
        if self._has_background_job():
            self.statusBar().showMessage('Đang có tác vụ khác — chờ xong rồi tách cảnh hàng loạt', 3500)
            return None
        videos = [a for a in self.state.assets if a.kind == 'video' and a.path]
        if videos:
            current = self._selected_video_asset()
            if current is not None:
                self.state.snapshot_asset_settings(current.id)
                self._scene_batch_anchor_id = current.id
            else:
                self._scene_batch_anchor_id = ''
            self._scene_batch_queue = deque((a.id for a in videos))
            self._scene_batch_total = len(videos)
            self._scene_batch_done = 0
            self._scene_batch_errors = 0
            self._scene_batch_active_id = ''
            self.timeline_panel.set_scene_split_busy(True)
            self.timeline_panel.set_scene_split_progress(0, self._scene_batch_total, 'Chuẩn bị tách cảnh…')
            self.statusBar().showMessage(f'Tách cảnh nền {len(videos)} video — vẫn soạn mẫu được', 5000)
            self._pump_scene_batch_queue()
        else:
            self.statusBar().showMessage('Không có video trong dự án để tách cảnh', 3000)
            return None

    def _video_asset_by_id(self, asset_id: str):
        aid = str(asset_id or '').strip()
        if aid:
            for asset in self.state.assets:
                if asset.id == aid and asset.kind == 'video' and asset.path:
                    return asset
        else:
            return None

    def _settings_bucket_for_scene_asset(self, asset) -> dict:
        from copy import deepcopy
        from ui_qt.state import DEFAULT_EXPORT_VALUES
        previous = self.state.asset_settings.get(asset.id)
        if isinstance(previous, dict) and previous:
            return deepcopy(previous)
        bucket = {key: deepcopy(self.state.values.get(key, default)) for key, default in DEFAULT_EXPORT_VALUES.items()}
        return bucket

    def _store_scene_cuts_for_asset(self, asset, cut_list: list[int]) -> int:
        from core.timeline_clips import apply_scene_cuts_to_values
        if asset is not None and getattr(asset, 'path', None):
            source_dur = self._resolve_video_source_duration_ms(asset)
            is_live = str(self.state.selected_id or '') == str(asset.id)
            if is_live:
                count = apply_scene_cuts_to_values(self.state.values, cut_list, source_path=str(asset.path or ''), source_duration_ms=source_dur)
                if count > 0:
                    self.timeline_panel.trimDragStarted.emit()
                    self.timeline_panel.trimChanged.emit(0, 0)
                    self.timeline_panel.canvas.clipsChanged.emit()
                    self.timeline_panel.canvas.update()
                    self.state.snapshot_asset_settings(asset.id)
                    self._log_scene_trim_status()
                    if hasattr(self.control_board, 'refresh_scene_trim_status'):
                        self.control_board.refresh_scene_trim_status()
            else:
                bucket = self._settings_bucket_for_scene_asset(asset)
                count = apply_scene_cuts_to_values(bucket, cut_list, source_path=str(asset.path or ''), source_duration_ms=source_dur)
                if count > 0:
                    self.state.asset_settings[asset.id] = bucket
            return count
        return 0

    def _log_scene_trim_status(self) -> None:
        from core.scene_clip_fx import effective_scene_trim_side, summarize_scene_trim
        from core.timeline_clips import clips_from_values
        if effective_scene_trim_side(self.state.values) == 'off':
            return None
        applied, skipped, max_cut = (summarize_scene_trim(clips_from_values(self.state.values))[0], summarize_scene_trim(clips_from_values(self.state.values))[1], summarize_scene_trim(clips_from_values(self.state.values))[2])
        self.statusBar().showMessage(f"Cắt/dãn: {applied} cảnh đã gắn{('' if max_cut else f'{max_cut / 1000}.1fs/phía)')}{('' if skipped <= 0 else f' · {skipped} cảnh ngắn bỏ qua')} — vạch cam hai đầu clip", 6000)
        self._log_event('Cắt/dãn cảnh', f'gắn={applied} bỏ_qua={skipped} max_ms={max_cut}')

    def _pump_scene_batch_queue(self) -> None:
        if self.scene_detect_task is not None:
            return None
        if self._scene_batch_queue:
            asset_id = self._scene_batch_queue.popleft()
            video = self._video_asset_by_id(asset_id)
            if video is None:
                self._scene_batch_errors = int(getattr(self, '_scene_batch_errors', 0)) + 1
                from PySide6.QtCore import QTimer
                QTimer.singleShot(0, self._pump_scene_batch_queue)
                return None
            self._scene_batch_active_id = str(video.id)
            done = int(getattr(self, '_scene_batch_done', 0) or 0)
            total = int(getattr(self, '_scene_batch_total', 0) or 0)
            if total > 0:
                self.timeline_panel.set_scene_split_progress(done, total, f'Đang tách «{video.name}» ({done + 1}/{total})')
            self._begin_scene_detect_for_video(video)
        else:
            return None

    def _begin_scene_detect_for_video(self, video) -> None:
        if self.scene_detect_task is not None:
            self._log_event('Tách cảnh — bỏ qua start trùng', getattr(video, 'name', ''))
        else:
            source_dur = max(0, int(getattr(video, 'duration_ms', 0) or 0))
            player = getattr(self.preview_panel, 'playback', None)
            media = getattr(player, '_player', None) if player is not None else None
            if source_dur < 2000 and media is not None:
                try:
                    player_dur = int(media.duration())
                except Exception:
                    player_dur = 0
                if player_dur >= 2000:
                    source_dur = player_dur
            task = SceneDetectTask(video.path, start_ms=0, end_ms=source_dur)
            self.scene_detect_task = task
            self.timeline_panel.set_scene_split_busy(True)
            task.signals.progressChanged.connect(lambda message: self.statusBar().showMessage(message, 5000))
            task.signals.completed.connect(self._on_scene_detect_completed)
            task.signals.failed.connect(self._on_scene_detect_failed)
            task.signals.finished.connect(self._on_scene_detect_finished)
            batch_note = ''
            if self._scene_batch_total:
                batch_note = f' [{self._scene_batch_done + 1}/{self._scene_batch_total}]'
            dur_note = _format_ms(source_dur) if source_dur > 0 else 'đo trong worker'
            self.statusBar().showMessage(f'Đang tách cảnh «{video.name}» ({dur_note}){batch_note}…')
            self._log_event('Tách cảnh — bắt đầu worker', f"{getattr(video, 'name', '')} · end_ms={source_dur}")
            self._refresh_export_ui()
            self.thread_pool.start(task)

    def _resolve_video_source_duration_ms(self, video) -> int:
        claimed = max(1, int(getattr(video, 'duration_ms', 0) or 1))
        path = str(getattr(video, 'path', '') or '').strip()
        dur = claimed
        if path:
            try:
                from services_media import resolve_export_source_duration_ms
                dur = resolve_export_source_duration_ms(path, claimed)
            except Exception:
                dur = claimed
        player = getattr(self.preview_panel, 'playback', None)
        media = getattr(player, '_player', None) if player is not None else None
        if int(getattr(self, '_scene_batch_total', 0) or 0) <= 0 and media is not None:
            try:
                player_dur = int(media.duration())
            except Exception:
                player_dur = 0
            if player_dur > dur + 500:
                dur = player_dur
        if abs(dur - claimed) > 800:
            try:
                from dataclasses import replace as dc_replace
                updated = dc_replace(video, duration_ms=dur)
                assets = list(self.state.assets)
                for index, item in enumerate(assets):
                    if item.id == video.id:
                        assets[index] = updated
                self.state.assets = tuple(assets)
            except Exception:
                pass
        return max(1, int(dur))

    def _align_timeline_to_video_duration(self, video) -> None:
        if video is not None and getattr(video, 'path', None):
            from dataclasses import replace as dc_replace
            from ui_qt.project_timing import clamp_project_timing_to_duration
            dur = max(1, int(getattr(video, 'duration_ms', 0) or 1))
            path = str(video.path or '')
            try:
                from services_media import probe_media_info
                info = probe_media_info(path)
                probed = max(0, int(getattr(info, 'duration_ms', 0) or 0))
                if probed >= 2000 and abs(probed - dur) > 800:
                    dur = probed
                    updated = dc_replace(video, duration_ms=dur)
                    assets = list(self.state.assets)
                    for index, item in enumerate(assets):
                        if item.id == video.id:
                            assets[index] = updated
                    self.state.assets = tuple(assets)
                    video = updated
            except Exception:
                pass
            from core.timeline_clips import ensure_timeline_for_video_source
            ensure_timeline_for_video_source(self.state.values, source_path=path, source_duration_ms=dur, preserve_custom_scenes=True)
            clamp_project_timing_to_duration(self.state.values, dur)
            self._timeline_clips_cache = None
            self._timeline_clips_token = None
            self.timeline_panel.canvas.invalidate_layout_cache()
            self.timeline_panel.canvas.update()

    def _on_player_duration_for_timeline(self, duration_ms: int) -> None:
        player_ms = max(0, int(duration_ms))
        if player_ms < 2000:
            return None
        video = self._selected_video_asset()
        if video is not None and getattr(video, 'path', None):
            from core.timeline_clips import clips_from_values, ensure_timeline_clips, timeline_duration_ms
            from dataclasses import replace as dc_replace
            from ui_qt.project_timing import clamp_project_timing_to_duration
            asset_dur = max(1, int(getattr(video, 'duration_ms', 0) or 1))
            if asset_dur >= 2000 and player_ms > max(asset_dur * 3, asset_dur + 60000):
                return None
            clips = clips_from_values(self.state.values)
            clip_span = timeline_duration_ms(clips)
            if asset_dur >= 2000 and clip_span > max(asset_dur * 3, asset_dur + 60000):
                self._align_timeline_to_video_duration(video)
                self.timeline_panel.reload_project(self.state)
                return None
            grow = player_ms > asset_dur + 800
            shrink = asset_dur > player_ms + 800
            short_clip = clip_span > 0 and clip_span < max(2500, int(player_ms * 0.15))
            long_clip = clip_span > player_ms + 800
            canvas = self.timeline_panel.canvas
            cached = int(getattr(canvas, '_cached_duration_ms', 0) or 0)
            cached_mismatch = abs(cached - player_ms) > 800
            if grow or shrink or short_clip or long_clip or cached_mismatch:
                source_dur = player_ms
                if asset_dur != source_dur:
                    updated = dc_replace(video, duration_ms=source_dur)
                    assets = list(self.state.assets)
                    for index, item in enumerate(assets):
                        if item.id == video.id:
                            assets[index] = updated
                    self.state.assets = tuple(assets)
                    video = updated
                ensure_timeline_clips(self.state.values, source_duration_ms=source_dur, source_path=str(video.path or ''))
                clamp_project_timing_to_duration(self.state.values, source_dur)
                self.timeline_panel.canvas.invalidate_layout_cache()
                self.timeline_panel.reload_project(self.state)
                preview = self.preview_panel
                if abs(int(getattr(preview, '_duration_ms', 0) or 0) - source_dur) > 500:
                    preview._on_duration_changed(source_dur)
                    return None
            else:
                return None
        else:
            return None

    def _on_scene_detect_completed(self, cuts) -> None:
        cut_list = [int(x) for x in cuts or []]
        if self._single_export_prep_active and self._single_export_prep_step == 'scene' and self._single_export_prep_asset_id:
            asset = self._video_asset_by_id(self._single_export_prep_asset_id)
            count = self._store_scene_cuts_for_asset(asset, cut_list)
            name = asset.name if asset is not None else 'video'
            self.statusBar().showMessage(f'«{name}»: tách {count} cảnh — tiếp tục xuất…', 4000)
            self._schedule_autosave()
            return None
        if self._batch_produce_export_active and self._batch_produce_prep_step == 'scene' and self._batch_produce_prep_asset_id:
            asset = self._video_asset_by_id(self._batch_produce_prep_asset_id)
            count = self._store_scene_cuts_for_asset(asset, cut_list)
            name = asset.name if asset is not None else 'video'
            self.statusBar().showMessage(f'«{name}»: tách {count} cảnh — tiếp tục bước sau…', 4000)
            self._schedule_autosave()
            return None
        if self._scene_batch_total > 0:
            asset = self._video_asset_by_id(self._scene_batch_active_id)
            count = self._store_scene_cuts_for_asset(asset, cut_list)
            name = asset.name if asset is not None else 'video'
            self.statusBar().showMessage(f'«{name}»: {count} cảnh ({len(cut_list)} cắt) [{self._scene_batch_done + 1}/{self._scene_batch_total}]', 4000)
            self._schedule_autosave()
            return None
        count = self.timeline_panel.apply_auto_scene_cuts(cut_list)
        video = self._selected_video_asset()
        if video is not None:
            self.state.snapshot_asset_settings(video.id)
            self._schedule_autosave()
        if count > 1 or cut_list:
            name = video.name if video is not None else 'video'
            self.statusBar().showMessage(f'«{name}»: tách {count} cảnh ({len(cut_list)} điểm cắt)', 5000)
            self.preview_panel.refresh_settings()
        else:
            self.statusBar().showMessage('Không thấy điểm đổi cảnh — thử video có hard-cut rõ hơn', 5000)
            return None

    def _on_scene_detect_failed(self, message: str) -> None:
        text = str(message or '').strip()
        if self._single_export_prep_active and self._single_export_prep_step == 'scene' and self._single_export_prep_asset_id:
            self._log_event('Tách cảnh (xuất 1) lỗi', text)
            self.statusBar().showMessage(f'Bỏ qua tách cảnh — tiếp tục xuất ({text[:80]})', 5000)
            self._arm_or_skip_single_export_after_scene_fail()
            return None
        if self._batch_produce_export_active and self._batch_produce_prep_step == 'scene' and self._batch_produce_prep_asset_id:
            self._log_event('Tách cảnh (xuất) lỗi', text)
            self.statusBar().showMessage(f'Bỏ qua tách cảnh — tiếp tục clip ({text[:80]})', 5000)
            return None
        if self._scene_batch_total > 0:
            self._scene_batch_errors = int(getattr(self, '_scene_batch_errors', 0)) + 1
            self._log_event('Tách cảnh lỗi (batch)', text)
            self.statusBar().showMessage(f'Bỏ qua video lỗi tách cảnh — tiếp tục hàng loạt ({text[:80]})', 5000)
            return None
        if 'dừng' in text.lower():
            self.statusBar().showMessage(text, 4000)
            return None
        self._report_error('Tách cảnh thất bại', text)

    def _on_scene_detect_finished(self) -> None:
        self.scene_detect_task = None
        self._refresh_export_ui()
        if self._single_export_prep_active and self._single_export_prep_step == 'scene':
            self._disarm_single_export_prep_watchdog()
            self.timeline_panel.set_scene_split_busy(False)
            self._single_export_prep_step = ''
            self._single_export_scene_skipped = True
            QTimer.singleShot(0, self._advance_single_export_prep)
            return None
        if self._batch_produce_export_active and self._batch_produce_prep_step == 'scene' and self._batch_produce_prep_asset_id:
            self.timeline_panel.set_scene_split_busy(False)
            self._finish_batch_produce_prep_and_continue()
            return None
        if self._scene_batch_total <= 0:
            self.timeline_panel.set_scene_split_busy(False)
            return None
        self._scene_batch_done += 1
        self._scene_batch_active_id = ''
        done = self._scene_batch_done
        total = self._scene_batch_total
        self.timeline_panel.set_scene_split_progress(done, total, f'Đã xong {done}/{total}')
        if self._scene_batch_queue:
            left = len(self._scene_batch_queue)
            self.statusBar().showMessage(f'Tách cảnh nền {done}/{total} — còn {left} (vẫn soạn mẫu được)', 4000)
            QTimer.singleShot(0, self._pump_scene_batch_queue)
            return None
        errors = int(getattr(self, '_scene_batch_errors', 0) or 0)
        self._scene_batch_total = 0
        self._scene_batch_done = 0
        self._scene_batch_errors = 0
        self._scene_batch_active_id = ''
        self.timeline_panel.set_scene_split_busy(False)
        note = f' ({errors} lỗi bỏ qua)' if errors else ''
        self.statusBar().showMessage(f'Đã tách cảnh nền xong {total} video{note} — mẫu đang mở không bị đổi', 6000)
        self._schedule_autosave()

    def _cancel_scene_detect_batch(self) -> bool:
        had = False
        if self._scene_batch_queue or self._scene_batch_total:
            self._scene_batch_queue.clear()
            self._scene_batch_total = 0
            self._scene_batch_done = 0
            self._scene_batch_errors = 0
            self._scene_batch_active_id = ''
            self._scene_batch_anchor_id = ''
            had = True
        task = self.scene_detect_task
        if task is not None and hasattr(task, 'cancel'):
            task.cancel()
            had = True
        if had:
            self.timeline_panel.set_scene_split_busy(False)
        return had

    def start_hardsub_removal(self) -> None:
        if self._has_background_job():
            return None
        video = self._selected_video_asset()
        if video is not None and video.path:
            roi = _hardsub_roi_from_values(self.state.values)
            source = Path(video.path)
            output = source.with_name(f'{source.stem}_clean{source.suffix}')
            task = HardsubTask(video.path, str(output), roi=roi)
            self.hardsub_task = task
            task.signals.progressChanged.connect(lambda message: self.statusBar().showMessage(message, 4000))
            task.signals.completed.connect(self._on_hardsub_completed)
            task.signals.failed.connect(self._on_hardsub_failed)
            task.signals.finished.connect(self._on_hardsub_finished)
            self.statusBar().showMessage('Đang xóa hardsub… (bấm Dừng xuất để hủy)')
            self._refresh_export_ui()
            self.thread_pool.start(task)
        else:
            self.statusBar().showMessage('Hãy chọn video thật trước khi xóa hardsub')
            return None

    def _on_hardsub_completed(self, clean_path: str) -> None:
        self.statusBar().showMessage(f'Đã xóa hardsub → {Path(clean_path).name}. Đang thêm vào project…')
        self.import_media_paths([clean_path])
        self._log_event('Đã xóa hardsub', clean_path)

    def _on_hardsub_failed(self, message: str) -> None:
        if 'dừng' in message.lower():
            self.statusBar().showMessage('Đã dừng xóa hardsub')
            return None
        self._report_error('Xóa hardsub thất bại', message)

    def _on_hardsub_finished(self) -> None:
        self.hardsub_task = None
        self._refresh_export_ui()

    def _on_blur_zones_changed(self) -> None:
        self.control_board.sync_blur_zone_controls()
        enabled = self.control_board.controls.get('blur_zone_enabled')
        if isinstance(enabled, QCheckBox):
            enabled.blockSignals(True)
            try:
                enabled.setChecked(bool(self.state.values.get('blur_zone_enabled')))
            finally:
                enabled.blockSignals(False)
        self.preview_panel.refresh_settings()

    def _attach_voice_duration(self, settings: VideoExportSettings) -> VideoExportSettings:
        if settings.voice_audio_enabled and settings.voice_audio_path:
            try:
                voice_ms = probe_audio_duration_ms(settings.voice_audio_path)
            except (OSError, RuntimeError, ValueError, TypeError):
                voice_ms = 0
            return settings if voice_ms <= 0 else replace(settings, voice_duration_ms=voice_ms)
        return settings

    def _on_subtitle_placement_changed(self, position: str, margin: int) -> None:
        self.state.values['subtitle_position'] = position
        self.state.values['subtitle_margin_bottom'] = margin
        self.state.values['subtitle_margin_refs_center'] = True
        self.control_board.sync_subtitle_layout_controls()
        self.preview_panel.frame_canvas.update()
        self.statusBar().showMessage(f'Đã cập nhật vị trí phụ đề: {position}, cách mép {margin}px', 2500)

    def _on_subtitle_font_size_changed(self, font_size: int) -> None:
        self.state.values['subtitle_font_size'] = int(font_size)
        self.control_board.sync_subtitle_layout_controls()
        self.preview_panel.frame_canvas.update()
        self._schedule_autosave()
        self.statusBar().showMessage(f'Đã cập nhật cỡ chữ phụ đề: {font_size}', 2500)

    def _on_subtitle_scale_changed(self, scale_x_percent: int, scale_y_percent: int) -> None:
        sx = max(10, min(500, int(scale_x_percent)))
        sy = max(10, min(500, int(scale_y_percent)))
        self.state.values['subtitle_scale_x_percent'] = sx
        self.state.values['subtitle_scale_y_percent'] = sy
        self.state.values['subtitle_scale_percent'] = sx if sx == sy else max(10, min(500, round((sx + sy) / 2)))
        self.control_board.sync_subtitle_layout_controls()
        self.preview_panel.frame_canvas.update()
        self._schedule_autosave()
        text = f'phóng đều {sx}%' if sx == sy else f'ngang {sx}% · dọc {sy}%'
        self.statusBar().showMessage(f'Phụ đề: {text}', 2500)

    def _on_subtitle_box_width_changed(self, box_width_percent: int) -> None:
        percent = max(15, min(100, int(box_width_percent)))
        self.state.values['subtitle_box_width_percent'] = percent
        self.state.values['subtitle_layout_font_size'] = int(self.state.values.get('subtitle_font_size', 48) or 48)
        self.control_board.sync_subtitle_layout_controls()
        self.preview_panel.frame_canvas.update()
        self._schedule_autosave()
        self.statusBar().showMessage(f'Phụ đề: rộng khung {percent}% (kéo cạnh trái/phải để 1–2 hàng)', 2500)

    def set_workspace_mode(self, mode: str) -> None:
        normalized = 'download' if str(mode or '').lower() in frozenset({'tải', 'downloader', 'tai', 'download', 'tải video', 'tai video'}) else 'edit'
        if normalized == 'download' and is_frozen_packaged():
            return None
        self._workspace_mode = normalized
        stack = getattr(self, '_left_mode_stack', None)
        if stack is not None:
            stack.setCurrentIndex(1 if normalized == 'download' else 0)
        edit_btn = getattr(self, '_mode_edit_btn', None)
        download_btn = getattr(self, '_mode_download_btn', None)
        if edit_btn is not None:
            edit_btn.setChecked(normalized == 'edit')
        if download_btn is not None:
            download_btn.setChecked(normalized == 'download')
        if normalized == 'download':
            workbench = self.module_workbenches.get('downloader')
            if workbench is not None:
                workbench.show()
            self.statusBar().showMessage('Tải Video: chọn file hoặc mở bộ tải để thêm vào dự án', 3500)
            return None
        self.statusBar().showMessage('Edit Video', 2000)

    def switch_module(self, module_id: str) -> None:
        module = module_by_id(module_id)
        if module.id == 'downloader':
            self.set_workspace_mode('download')
            self.module_rail.set_active_module(self.active_module_id)
            return None
        if getattr(self, '_workspace_mode', 'edit') != 'edit':
            self.set_workspace_mode('edit')
        if is_tool_module(module.id):
            self._open_tool_module_sheet(module.id)
            self.module_rail.set_active_module(self.active_module_id)
            return None
        if module.id in frozenset({'media', 'effects', 'subtitle', 'look', 'transitions', 'kho', 'filters', 'tts', 'preset'}):
            focus = {'media': 'video_output', 'subtitle': 'overlays', 'tts': 'audio_mix', 'effects': 'overlays', 'look': 'look_effects', 'kho': 'overlays', 'filters': 'look_effects', 'transitions': 'video_output', 'preset': 'user_defaults'}.get(module.id)
            focus_control = None
            if module.id == 'filters':
                focus_control = 'color_filter'
            elif module.id == 'look':
                focus_control = 'video_effect_strength'
            elif module.id == 'transitions':
                focus_control = 'timeline_transition_ms'
            self._activate_module(module_id, focus_node=focus, focus_control=focus_control)
        else:
            self._activate_module(module_id)
        if module.id == 'tts':
            self.statusBar().showMessage('Âm thanh: trộn âm gốc / TTS / nhạc nền — kéo SFX xuống timeline', 4000)
            return None
        if module.id == 'effects':
            self.statusBar().showMessage('Lớp: nền / hòa trộn / lớp phủ / logo — kéo xuống timeline', 4000)
            return None
        if module.id == 'look':
            self.statusBar().showMessage('Hiệu ứng: bấm ô bên trái — mức và tham số hiện bên phải', 4000)
            return None
        if module.id == 'kho':
            self.statusBar().showMessage('Kho: nạp Ảnh/Khung/Video/Mẫu Text/Sticker → kéo timeline (~8s đầu) → căn size preview', 5000)
            return None
        if module.id == 'filters':
            self.statusBar().showMessage('Bộ lọc: bấm preset màu — áp ngay lên preview/xuất', 4000)
            return None
        if module.id == 'transitions':
            self.statusBar().showMessage('Chuyển tiếp: chọn fade giữa cảnh trên timeline Video', 4000)
            return None
        if module.id == 'subtitle':
            self.statusBar().showMessage('Văn bản: kéo chữ/tiêu đề xuống timeline · AI phụ đề ở sub-nav', 4000)
            return None
        if module.id == 'preset':
            self.statusBar().showMessage('Cấu hình: build 1 video full (lớp phủ+mix+giọng+ngôn ngữ…) → lưu, video sau Áp / Ghim — chỉ đổi nguồn, A→Z ăn sẵn', 4500)
            return None
        self.statusBar().showMessage(module.description, 3000)

    def _open_tool_module_sheet(self, module_id: str) -> None:
        module = module_by_id(module_id)
        if module.id == 'summary':
            self._open_summary_dialog()
            return None
        if module.id == 'downloader':
            self.set_workspace_mode('download')
            return None
        if module.id == 'settings':
            self._open_tool_module_sheet('batch')
            return None
        workbench = self.module_workbenches.get(module.id)
        if workbench is None:
            self.statusBar().showMessage(f'Chưa có sheet {module.title}', 3000)
            return None
        dialog = self._tool_dialogs.get(module.id)
        if dialog is None:
            dialog = ToolModuleDialog(module, workbench, parent=self)
            self._tool_dialogs[module.id] = dialog
        if module.id == 'batch':
            self.refresh_batch_queue()
            self._refresh_export_ui()
            self.control_board.set_module_tabs('batch', focus_tab='export', selection_kind='module_export')
            self.control_board.focus_node('export_encode')
            if hasattr(workbench, 'sync_export_encode_controls'):
                workbench.sync_export_encode_controls(self.state.values)
                workbench.restore_batch_ui_prefs()
        dialog.show()
        dialog.raise_()
        dialog.activateWindow()
        if dialog.isMinimized():
            dialog.showNormal()
        if module.ready:
            self.statusBar().showMessage(module.description, 3500)
            return None
        self.statusBar().showMessage(f'{module.title} đang nằm trong lộ trình port từ tool gốc', 5000)

    def _focus_export_encode_settings(self, *, raise_main: bool) -> None:
        self.control_stack.setCurrentWidget(self.control_board)
        self.control_board.set_module_tabs('batch', focus_tab='export', selection_kind='module_export')
        self.control_board.focus_node('export_encode')
        if raise_main:
            self.raise_()
            self.activateWindow()
            self.statusBar().showMessage('Tab Xuất — CPU/GPU · codec · FPS · bitrate', 3500)
            return None

    def _on_batch_export_encode_changed(self, payload: dict) -> None:
        if isinstance(payload, dict):
            self.state.values.update(payload)
            from ui_qt.export_encode_prefs import ENCODE_PREF_KEYS, save_export_encode_prefs
            save_export_encode_prefs(self.state.values)
            self.control_board.sync_control_values(*ENCODE_PREF_KEYS)
            self._schedule_autosave()
        else:
            return None

    def _summary_live_overrides(self) -> dict[str, object]:
        workbench = self.module_workbenches.get('batch')
        return {} if workbench is None else {'batch_naming': workbench.batch_naming_mode(), 'batch_parallel_workers': workbench.batch_parallel_workers_requested()}

    def _ensure_summary_dialog(self) -> SummaryDialog:
        if self._summary_dialog is None:
            self._summary_dialog = SummaryDialog(self.state, parent=self, live_overrides_provider=self._summary_live_overrides, project_name=self._current_project_display_name())
            self._summary_dialog.rowActivated.connect(self._navigate_to_summary_row)
            self._summary_dialog.nodeToggleRequested.connect(self._on_summary_node_toggled)
            self._summary_dialog.detailToggleRequested.connect(self._on_summary_detail_toggled)
            self._summary_dialog.refresh()
        return self._summary_dialog

    def _open_summary_dialog(self) -> None:
        dialog = self._ensure_summary_dialog()
        dialog.set_state(self.state, project_name=self._current_project_display_name())
        dialog.show()
        dialog.raise_()
        dialog.activateWindow()
        if dialog.isMinimized():
            dialog.showNormal()
        QTimer.singleShot(0, lambda: dialog.refresh(force=False))

    def _sync_summary_dialog_project(self) -> None:
        dialog = self._summary_dialog
        if dialog is None:
            return None
        dialog.set_state(self.state, project_name=self._current_project_display_name())
        if dialog.isVisible():
            dialog.refresh()
            return None

    def _on_summary_node_toggled(self, node_id: str, enabled: bool) -> None:
        from ui_qt.summary_snapshot import SummaryRow, apply_workflow_node_enabled, build_workflow_nodes
        ok, message = apply_workflow_node_enabled(self.state.values, str(node_id), bool(enabled))
        dialog = self._summary_dialog
        if ok:
            QTimer.singleShot(0, lambda nid=str(node_id): self._after_summary_toggle_applied(node_id=nid))
            if dialog is not None:
                dialog.refresh(force=True)
                return None
        else:
            if dialog is not None:
                dialog.show_status(message or 'Không thể Bật/Tắt', error=True)
                dialog.refresh(force=True)
            node = next((item for item in build_workflow_nodes(self.state) if item.id == str(node_id)), None)
            if message and ('Chưa có' in message or 'chọn file' in message.lower()) and (node is not None):
                self._navigate_to_summary_row(SummaryRow(label=node.label, value='Tắt', module_id=node.module_id, focus_node=node.focus_node, focus_control=node.focus_control, overlay_part=node.overlay_part, subtitle_part=node.subtitle_part))
            return None

    def _on_summary_detail_toggled(self, key: str, enabled: bool) -> None:
        key = str(key or '').strip()
        if key:
            if key in ('batch_auto_scene_split', 'batch_auto_face_reframe'):
                self._on_batch_prep_flag_toggled(key, bool(enabled))
            else:
                self.state.values[key] = bool(enabled)
                self._set_checkbox_control(key, bool(enabled))
                self._schedule_autosave()
                QTimer.singleShot(0, self._deferred_summary_audio_preview_sync)
            dialog = self._summary_dialog
            if dialog is not None:
                dialog.refresh(force=True)
                return None
        else:
            return None

    def _deferred_summary_audio_preview_sync(self) -> None:
        try:
            self.timeline_panel.sync_audio_mix_from_state()
        except Exception:
            pass
        self.preview_panel.refresh_settings()

    def _after_summary_toggle_applied(self, *, node_id: str) -> None:
        values = self.state.values
        if node_id == 'scene':
            self._on_batch_prep_flag_toggled('batch_auto_scene_split', bool(values.get('batch_auto_scene_split')))
        elif node_id == 'face':
            self._on_batch_prep_flag_toggled('batch_auto_face_reframe', bool(values.get('batch_auto_face_reframe')))
        else:
            key_map = {'subtitle': ('subtitle_enabled',), 'tts': ('voice_audio_enabled',), 'overlay': ('media_overlays_master_enabled',), 'blend': ('blend_layers_master_enabled',), 'logo': ('logo_enabled',), 'filter': ('color_lut_stack_master_enabled',), 'mix': ('mute_original_audio', 'video_bgm_enabled', 'video_vocal_enabled', 'background_audio_enabled', 'voice_audio_enabled')}
            for key in key_map.get(node_id, ()):
                self._set_checkbox_control(key, bool(values.get(key)))
            combo_map = {'filter': ('color_filter',), 'effect': ('video_effect',), 'transition': ('timeline_transition_style', 'timeline_transition_ms')}
            for key in combo_map.get(node_id, ()):
                control = self.control_board.controls.get(key)
                if control is None:
                    pass
                else:
                    control.blockSignals(True)
                    try:
                        self.control_board._set_control_value(control, values.get(key))
                    finally:
                        control.blockSignals(False)
            self._schedule_autosave()
            QTimer.singleShot(40, lambda nid=node_id: self._deferred_summary_heavy_sync(nid))

    def _deferred_summary_heavy_sync(self, node_id: str) -> None:
        if node_id in ('overlay', 'blend', 'background'):
            try:
                self.control_board.refresh_media_overlay_list()
                self.control_board._sync_media_overlay_detail_enabled()
                self.control_board.refresh_blend_layer_list()
                self.control_board._sync_blend_layer_detail_enabled()
                refresh_bg = getattr(self.control_board, 'refresh_background_layer_list', None)
                if callable(refresh_bg):
                    refresh_bg()
                sync_bg = getattr(self.control_board, '_sync_background_layer_detail_enabled', None)
                if callable(sync_bg):
                    sync_bg()
            except Exception:
                pass
        if node_id in ('text', 'title'):
            try:
                refresh_text = getattr(self.control_board, 'refresh_text_overlay_list', None)
                if callable(refresh_text):
                    refresh_text()
                self.control_board.sync_control_values('video_title_enabled', 'text_overlay_enabled')
            except Exception:
                pass
        if node_id == 'blur':
            try:
                self.control_board.sync_control_values('blur_zone_enabled')
            except Exception:
                pass
        if node_id == 'cover':
            try:
                self.control_board.sync_control_values('cover_enabled', 'cover_path')
            except Exception:
                pass
        if node_id in ('mix', 'tts', 'subtitle'):
            try:
                self.timeline_panel.sync_audio_mix_from_state()
            except Exception:
                pass
        self.preview_panel.refresh_settings()

    def _navigate_to_summary_row(self, row) -> None:
        if is_tool_module(row.module_id):
            self._open_tool_module_sheet(row.module_id)
            return None
        self._activate_module(row.module_id, focus_node=row.focus_node, focus_control=row.focus_control, overlay_part=row.overlay_part, subtitle_part=row.subtitle_part)
        self.raise_()
        self.activateWindow()

    def _activate_module(self, module_id: str, *, focus_node: str | None=None, focus_control: str | None=None, overlay_part: str | None=None, subtitle_part: str | None=None) -> None:
        if overlay_part == 'effect':
            module_id = 'look'
        module = module_by_id(normalize_module_id(module_id))
        prev_id = str(getattr(self, 'active_module_id', '') or '')
        self.active_module_id = module.id
        self.module_rail.set_active_module(module.id)
        self.resource_library.set_module(module.id)
        self.control_stack.setCurrentWidget(self.control_board)
        token = int(getattr(self, '_module_activate_token', 0) or 0) + 1
        self._module_activate_token = token
        args = {'module_id': module.id, 'prev_id': prev_id, 'focus_node': focus_node, 'focus_control': focus_control, 'overlay_part': overlay_part, 'subtitle_part': subtitle_part}
        QTimer.singleShot(0, lambda t=token, a=args: self._activate_module_inspector(t, **a))

    def _activate_module_inspector(self, token: int, *, module_id: str, prev_id: str, focus_node: str | None, focus_control: str | None, overlay_part: str | None, subtitle_part: str | None) -> None:
        if int(getattr(self, '_module_activate_token', 0) or 0) != int(token):
            return None
        module = module_by_id(normalize_module_id(module_id))
        if module.id == 'transitions':
            self.resource_library.sync_transition_ui(self.state.values)
        if module.id in frozenset({'filters', 'look'}):
            self.resource_library.sync_look_ui(self.state.values)
        focus_tab = {'media': 'basic', 'subtitle': 'overlay', 'tts': 'audio', 'effects': 'overlay', 'look': 'look', 'kho': 'overlay', 'filters': 'look', 'transitions': 'basic', 'preset': 'export', 'batch': 'export', 'downloader': 'export', 'settings': 'export'}.get(module.id)
        if overlay_part in frozenset({'media', 'title', 'logo', 'overlay', 'background', 'text', 'blend', 'blur', 'effect'}):
            focus_tab = 'image' if overlay_part == 'blur' else 'look' if overlay_part == 'effect' else 'overlay'
        kind = str(self.state.selected_kind or '').strip()
        if module.id == 'subtitle':
            if subtitle_part or focus_node == 'subtitles':
                focus_tab = 'subtitles'
                selection_kind = 'subtitle'
            else:
                selection_kind = kind if kind in frozenset({'text', 'title'}) else 'module_text'
        else:
            selection_kind = 'audio' if module.id == 'tts' else (kind if kind in frozenset({'background', 'overlay', 'logo', 'blend'}) else 'module_effects') if module.id == 'effects' else 'module_look' if module.id == 'look' else 'module_filters' if module.id == 'filters' else 'module_transitions' if module.id == 'transitions' else (kind if kind in frozenset({'image', 'video', 'blur'}) else 'module_media') if module.id == 'media' else 'module_export' if module.id in frozenset({'batch', 'settings', 'downloader'}) else kind or None
        inspector_ready = bool(getattr(self.control_board, '_inspector_module_id', None) or '')
        same_module = bool(prev_id) and module.id == prev_id and inspector_ready and (not overlay_part) and (not subtitle_part) and (not focus_node) and (not focus_control)
        set_tabs = getattr(self.control_board, 'set_module_tabs', None)
        if callable(set_tabs) and (not same_module):
            set_tabs(module.id, focus_tab=focus_tab, selection_kind=selection_kind)
        if module.id == 'batch':
            self.control_board.focus_node('export_encode')
            self.refresh_batch_queue()
            self._refresh_export_ui()
        if focus_node:
            self.control_board.focus_node(focus_node)
        if overlay_part:
            self.control_board.set_context({'title': 'title', 'text': 'text', 'logo': 'logo', 'overlay': 'overlay', 'media': 'overlay', 'blend': 'overlay', 'background': 'overlay', 'effect': 'look', 'blur': 'blur'}.get(overlay_part, 'module_effects'), hide_inactive=True)
            self.control_board.focus_overlay_part(overlay_part)
        elif module.id in frozenset({'kho', 'effects'}):
            show_fx = getattr(self.control_board, 'show_effects_overlay_parts', None)
            if callable(show_fx):
                show_fx()
            else:
                show_all = getattr(self.control_board, 'show_all_overlay_parts', None)
                if callable(show_all):
                    show_all()
        else:
            show_text = getattr(self.control_board, 'show_text_overlay_parts', None)
            if callable(show_text):
                show_text()
            overlays = self.control_board._nodes_by_id.get('overlays')
            if module.id == 'subtitle' and (not subtitle_part) and (overlays is not None):
                overlays.setVisible(True)
                overlays.set_context_active(True, hide_inactive=False)
        if subtitle_part:
            self.control_board.set_context('subtitle', hide_inactive=True)
            self.control_board.focus_subtitle_part(subtitle_part)
        foc = getattr(self.control_board, 'focus_overlay_part', None)
        if module.id == 'filters' and callable(foc):
            foc('color_filter')
        if focus_control:
            self.control_board.focus_control(focus_control)
        lib_nav = library_nav_for_overlay_part(overlay_part)
        if lib_nav:
            if module.id in frozenset({'kho', 'effects', 'look'}):
                self.resource_library.focus_library_nav(module.id, lib_nav)
            return None

    def _apply_inspector_target(self, target: InspectorTarget) -> None:
        if getattr(self, '_inspector_nav_busy', False):
            pass
        else:
            self._inspector_nav_busy = True
            try:
                self._activate_module(target.module_id, focus_node=target.focus_node, focus_control=target.focus_control, overlay_part=target.overlay_part, subtitle_part=target.subtitle_part)
                nav_key = target.library_nav or library_nav_for_overlay_part(target.overlay_part)
                if nav_key and normalize_module_id(target.module_id) in frozenset({'kho', 'effects'}):
                    self.resource_library.focus_library_nav(normalize_module_id(target.module_id), nav_key)
                canvas = self.preview_panel.frame_canvas
                set_sel = getattr(canvas, 'set_preview_selection', None)
                if target.preview_kind and callable(set_sel):
                    canvas.blockSignals(True)
                    try:
                        set_sel(target.preview_kind)
                    finally:
                        canvas.blockSignals(False)
                if target.status_hint:
                    self.statusBar().showMessage(f'Inspector → {target.status_hint}', 2200)
            finally:
                self._inspector_nav_busy = False

    def _on_preview_selection_changed(self, kind: str) -> None:
        if getattr(self, '_inspector_nav_busy', False):
            return None
        if kind:
            self._navigate_inspector_for_preview_kind(kind)
            return None

    def _on_resource_library_action(self, action: str) -> None:
        key = str(action or '').strip()
        if key in frozenset({'add_text'}):
            self._add_text_overlay_from_timeline()
            return None
        if key in frozenset({'tpl_text_bold'}):
            self._apply_text_template_bold()
            return None
        if key in frozenset({'tpl_title_center'}):
            self._apply_title_template_center()
            return None
        if key in frozenset({'add_title'}):
            self.state.values['video_title_enabled'] = True
            self._set_checkbox_control('video_title_enabled', True)
            self._activate_module('subtitle', overlay_part='title', focus_control='video_title_enabled')
            self.preview_panel.refresh_settings()
            return None
        if key in frozenset({'auto_subtitle', 'open_subtitles'}):
            part = 'ai' if key == 'auto_subtitle' else 'edit'
            self._activate_module('subtitle', focus_node='subtitles', subtitle_part=part)
            return None
        if key in frozenset({'open_tts'}):
            self._activate_module('tts', focus_node='audio_mix', focus_control='tts_engine')
            return None
        if key in frozenset({'test_voice'}):
            self._activate_module('tts', focus_node='audio_mix')
            self.start_tts_voice_preview()
            return None
        if key in frozenset({'add_bgm'}):
            self.control_board.backgroundAudioFileRequested.emit()
            self._activate_module('tts', focus_node='audio_mix')
            return None
        if key in frozenset({'add_sfx'}):
            self.control_board.sfxAddRequested.emit()
            self._activate_module('tts', focus_node='audio_mix')
            return None
        if key in frozenset({'add_overlay'}):
            self.control_board.effectOverlayFileRequested.emit()
            self._activate_module('effects', overlay_part='overlay')
            return None
        if key in frozenset({'add_blend'}):
            self.control_board.blendLayerFileRequested.emit()
            self._activate_module('effects', overlay_part='blend')
            return None
        if key in frozenset({'add_background'}):
            self.control_board.backgroundLayerFileRequested.emit()
            self._activate_module('effects', overlay_part='background')
            return None
        if key in frozenset({'pick_logo'}):
            self.control_board.logoFileRequested.emit()
            self._activate_module('effects', overlay_part='logo')
            return None
        if key in frozenset({'open_blur'}):
            self._activate_module('effects', overlay_part='blur', focus_control='blur_zones')
            return None
        if key in frozenset({'open_video_effect'}):
            self._activate_module('effects', overlay_part='effect', focus_control='video_effect_strength')
            return None
        if key.startswith('video_effect:'):
            self._apply_library_video_effect(key.split(':', 1)[1])
            return None
        if key.startswith('color_filter:'):
            self._apply_library_color_filter(key.split(':', 1)[1])
            return None
        if key.startswith('color_lut:'):
            self._apply_library_color_lut(key.split(':', 1)[1])
            return None
        if key == 'transition_random_apply':
            self._apply_random_transitions()
            return None
        if key.startswith('transition:'):
            self._apply_library_transition(key.split(':', 1)[1])
            return None
        self.statusBar().showMessage(f'Thư viện: {key}', 2500)

    def _on_library_action_dropped(self, action: str, at_ms: int) -> None:
        self.timeline_panel.set_position(max(0, int(at_ms)), repaint=True)
        self._on_resource_library_action(action)
        self.statusBar().showMessage(f'Đã thả «{action}» tại {max(0, int(at_ms))} ms', 2500)

    def _on_library_asset_dropped(self, kind: str, path: str, at_ms: int) -> None:
        self.timeline_panel.set_position(max(0, int(at_ms)), repaint=True)
        self._use_project_library_asset(kind, path, at_ms=max(0, int(at_ms)))

    def _import_into_project_library(self, kind: str) -> None:
        from ui_qt.kho_library import allowed_extensions as kho_allowed_extensions, import_into_kho, is_kho_kind, kind_label as kho_kind_label
        from ui_qt.project_library import allowed_extensions, import_into_library, kind_label
        key = str(kind or '').strip()
        if is_kho_kind(key):
            exts = sorted(kho_allowed_extensions(key))
            label = kho_kind_label(key)
            importer = import_into_kho
            start_dir = get_last_dir(f'kho_{key}', get_last_dir('kho', get_last_dir('media')))
            dir_keys = (f'kho_{key}', 'kho', 'media')
        else:
            exts = sorted(allowed_extensions(key))
            label = kind_label(key)
            importer = import_into_library
            start_dir = get_last_dir(f'lib_{key}', get_last_dir('lib', get_last_dir('media')))
            dir_keys = (f'lib_{key}', 'lib', 'media')
        if exts:
            patterns = ' '.join((f'*{ext}' for ext in exts))
            paths, _filter = QFileDialog.getOpenFileNames(self, f"Thêm {label} vào {('Kho' if is_kho_kind(key) else 'thư viện')} (có thể chọn nhiều file)", start_dir, f'{label} ({patterns});;Tất cả tệp (*.*)')
            if paths:
                for dir_key in dir_keys:
                    remember_path(dir_key, paths[0])
                saved_names = []
                saved_dir = ''
                errors = []
                for path in paths:
                    try:
                        saved = importer(key, path)
                        saved_names.append(Path(saved).name)
                        if saved_dir:
                            pass
                        else:
                            saved_dir = str(Path(saved).parent)
                        continue
                    except (OSError, ValueError) as exc:
                        errors.append(f'{Path(path).name}: {exc}')
                        continue
            else:
                return None
        else:
            return None
        self.resource_library.reload_library_assets()
        if saved_names:
            where = f' → {saved_dir}' if saved_dir else ''
            self.statusBar().showMessage(f'Đã nạp {len(saved_names)} {label}{where} — kéo xuống timeline để dùng', 7000)
        if errors:
            self._report_error(f'Một số file {label} không nạp được', '\n'.join(errors[:8]))

    def _delete_from_project_library(self, kind: str, paths) -> None:
        from ui_qt.kho_library import is_kho_kind, kind_label as kho_kind_label, remove_from_kho
        from ui_qt.project_library import kind_label, remove_from_library
        items = [str(paths)] if isinstance(paths, (str, Path)) else [str(path) for path in paths or [] if str(path)]
        if items:
            key = str(kind or '').strip()
            label = kho_kind_label(key) if is_kho_kind(key) else kind_label(key)
            remover = remove_from_kho if is_kho_kind(key) else remove_from_library
            deleted = []
            errors = []
            for path in items:
                try:
                    remover(key, path)
                    deleted.append(Path(path).name)
                    continue
                except (OSError, ValueError) as exc:
                    errors.append(f'{Path(path).name}: {exc}')
                    continue
        else:
            return None
        self.resource_library.reload_library_assets()
        if deleted:
            self.statusBar().showMessage(f'Đã xóa {len(deleted)} {label}' if len(deleted) > 1 else f'Đã xóa {label}: {deleted[0]}', 5000)
        if errors:
            self._report_error(f'Một số {label} không xóa được', '\n'.join(errors[:8]))

    def _use_project_library_asset(self, kind: str, path: str, *, at_ms: int | None) -> None:
        from ui_qt.kho_library import KHO_DEFAULT_DURATION_MS, KHO_OVERLAY_KINDS, apply_text_template_to_values, is_kho_kind, kind_label as kho_kind_label, load_text_template, overlay_time_range
        key = str(kind or '').strip()
        file_path = str(path or '').strip()
        if file_path and Path(file_path).is_file():
            drop_ms = None if at_ms is None else max(0, int(at_ms))
            if drop_ms is not None:
                self.timeline_panel.set_position(drop_ms, repaint=True)
            if key == 'sfx':
                at_sec = float(drop_ms) / 1000.0 if drop_ms is not None else max(0.0, float(self.timeline_panel.canvas.position_ms) / 1000.0)
                self.timeline_panel.canvas.add_sfx_event(at_sec, file_path, Path(file_path).stem)
                self.statusBar().showMessage(f'Đã gắn SFX «{Path(file_path).stem}» tại {_format_ms(int(at_sec * 1000))}', 3000)
            elif key == 'bgm':
                self.control_board.set_background_audio_path(file_path)
                self.timeline_panel.reload_project(self.state)
                self.statusBar().showMessage(f'Đã gắn nhạc nền «{Path(file_path).name}»', 3000)
            elif key in KHO_OVERLAY_KINDS or key == 'overlay':
                duration = KHO_DEFAULT_DURATION_MS if key in KHO_OVERLAY_KINDS else None
                self.insert_media_as_overlay([file_path], at_timeline_ms=drop_ms if drop_ms is not None else 0, default_duration_ms=duration)
                if key in KHO_OVERLAY_KINDS:
                    self._activate_module('kho')
            elif key == 'text' or (is_kho_kind(key) and key == 'text'):
                try:
                    template = load_text_template(file_path)
                except ValueError as exc:
                    self._report_error('Không dùng được mẫu text', str(exc))
                    return None
                self._push_history()
                start, end = (overlay_time_range(at_ms=drop_ms if drop_ms is not None else 0)[0], overlay_time_range(at_ms=drop_ms if drop_ms is not None else 0)[1])
                apply_text_template_to_values(self.state.values, template, at_ms=drop_ms if drop_ms is not None else 0)
                from ui_qt.text_overlays import ensure_text_overlays
                n = len(ensure_text_overlays(self.state.values))
                try:
                    if hasattr(self.control_board, 'refresh_text_overlay_list'):
                        self.control_board.refresh_text_overlay_list()
                    else:
                        self.control_board.sync_control_values('text_overlay_enabled', 'text_overlay_content', 'text_overlay_style')
                    self.control_board.sync_subtitle_layout_controls()
                except Exception:
                    pass
                self._activate_module('subtitle', overlay_part='text', focus_control='text_overlay_content')
                self.timeline_panel.reload_project(self.state)
                self.preview_panel.refresh_settings()
                self._schedule_autosave()
                self.statusBar().showMessage(f'Đã nạp «{Path(file_path).stem}» ({start / 1000:.1f}s → {end / 1000:.1f}s) · {n} dòng · sửa nội dung / bật chạy chữ ở panel phải', 4500)
            elif key == 'blend':
                self.insert_media_as_blend([file_path], at_timeline_ms=drop_ms)
            elif key == 'background':
                self.insert_media_as_background([file_path], at_timeline_ms=drop_ms)
            elif key == 'logo':
                self.control_board.set_logo_path(file_path)
                self.timeline_panel.reload_project(self.state)
                self.preview_panel.refresh_settings()
                self.statusBar().showMessage(f'Đã gắn logo «{Path(file_path).name}»', 3000)
            else:
                self.statusBar().showMessage(f'Chưa hỗ trợ dùng thư viện «{key}»', 3000)
        else:
            self.statusBar().showMessage('File thư viện không còn tồn tại', 3000)

    def _pick_library_asset_for_track(self, kind: str) -> None:
        from PySide6.QtWidgets import QInputDialog
        from ui_qt.project_library import kind_label, list_library_items
        key = str(kind or '').strip()
        nav = {'sfx': ('tts', 'sfx'), 'bgm': ('tts', 'bgm'), 'audio': ('tts', 'bgm'), 'music': ('tts', 'bgm'), 'overlay': ('effects', 'overlay'), 'media_overlay': ('effects', 'overlay'), 'blend': ('effects', 'blend'), 'blend_layer': ('effects', 'blend'), 'background': ('effects', 'background'), 'background_layer': ('effects', 'background'), 'logo': ('effects', 'logo'), 'text_logo': ('effects', 'logo')}.get(key)
        if nav is None:
            return None
        module_id, nav_key = (nav[0], nav[1])
        lib_kind = {'sfx': 'sfx', 'bgm': 'bgm', 'audio': 'bgm', 'music': 'bgm', 'overlay': 'overlay', 'media_overlay': 'overlay', 'blend': 'blend', 'blend_layer': 'blend', 'background': 'blend', 'background_layer': 'blend', 'logo': 'logo', 'text_logo': 'logo'}[key]
        dispatch_kind = 'background' if key in frozenset({'background_layer', 'background'}) else lib_kind
        self.resource_library.focus_library_nav(module_id, nav_key)
        items = list_library_items(lib_kind)
        labels = [name for name, _path in items]
        labels.append('＋ Thêm file vào thư viện…')
        picker_label = kind_label('background' if dispatch_kind == 'background' else lib_kind)
        choice, ok = QInputDialog.getItem(self, f'Chọn {picker_label}', 'Chọn trong thư viện (kéo từ cột trái cũng được):', labels, 0, False)
        if not ok or not choice:
            return None
        if choice.startswith('＋'):
            self._import_into_project_library(lib_kind)
            items = list_library_items(lib_kind)
            if items:
                self.statusBar().showMessage('Đã nạp thư viện — chọn lại từ danh sách hoặc kéo tile xuống timeline', 4500)
            return None
        path = next((p for name, p in items if name == choice), '')
        if path:
            self._use_project_library_asset(dispatch_kind, path)
            return None

    def _apply_text_template_bold(self) -> None:
        values = self.state.values
        values['text_overlay_enabled'] = True
        values['text_overlay_text'] = str(values.get('text_overlay_text') or 'Chữ nổi bật')
        values['text_overlay_font_size'] = max(36, int(values.get('text_overlay_font_size', 42) or 42))
        values['text_overlay_bold'] = True
        self.control_board.sync_control_values('text_overlay_enabled', 'text_overlay_text', 'text_overlay_font_size', 'text_overlay_bold')
        self._activate_module('subtitle', overlay_part='text', focus_control='text_overlay_enabled')
        self.preview_panel.refresh_settings()
        self.statusBar().showMessage('Đã áp mẫu chữ đậm', 2500)

    def _on_effects_library_nav(self, nav_key: str) -> None:
        part = {'overlay': 'media', 'blend': 'blend', 'background': 'background', 'logo': 'logo'}.get(str(nav_key or '').strip())
        if part:
            self._activate_module('effects', overlay_part=part)
        else:
            return None

    def _apply_library_video_effect(self, effect_id: str) -> None:
        from core.video_look import VIDEO_EFFECT_CHOICES, VIDEO_EFFECT_IDS
        from core.video_effect_stack import add_effect_to_stack, clear_effect_stack, is_stackable_effect_id, sync_flat_video_effect_from_stack
        eid = str(effect_id or 'none').strip().lower()
        if eid not in VIDEO_EFFECT_IDS:
            eid = 'none'
        self.state.values['video_effect_master_enabled'] = True
        if eid in frozenset({'', 'none'}):
            clear_effect_stack(self.state.values)
        elif is_stackable_effect_id(eid):
            self.state.values['video_effect_stack'] = add_effect_to_stack(self.state.values.get('video_effect_stack'), eid)
            self.state.values['selected_video_effect_id'] = eid
            sync_flat_video_effect_from_stack(self.state.values)
            if int(self.state.values.get('video_effect_strength', 0) or 0) < 35:
                self.state.values['video_effect_strength'] = 55
                stack = list(self.state.values.get('video_effect_stack') or [])
                for item in stack:
                    if str(item.get('id')) == eid and int(item.get('strength') or 0) < 35:
                        item['strength'] = 55
                self.state.values['video_effect_stack'] = stack
                sync_flat_video_effect_from_stack(self.state.values)
        else:
            self.state.values['video_effect'] = eid
        self.control_board.sync_control_values('video_effect', 'video_effect_strength', 'video_effect_master_enabled')
        self.control_board._effect_stack_ui_ids = None
        self.control_board.set_look_inspector_kind('effect')
        self.control_board._sync_look_effect_ui()
        self.control_board._sync_adjust_feature_ui()
        self.resource_library.sync_look_ui(self.state.values)
        self._activate_module('look', focus_node='look_effects', focus_control='video_effect_strength')
        self.preview_panel.refresh_settings()
        label = next((text for text, value in VIDEO_EFFECT_CHOICES if value == eid), eid)
        stack_n = len(self.state.values.get('video_effect_stack') or [])
        msg = f'Đã chồng hiệu ứng: {label}' if stack_n > 1 else f'Đã áp hiệu ứng: {label}'
        if eid in frozenset({'', 'none'}):
            msg = 'Đã xóa stack hiệu ứng'
        self.statusBar().showMessage(msg, 3000)
        self._schedule_autosave()

    def _apply_library_color_filter(self, filter_id: str) -> None:
        from core.video_look import COLOR_FILTER_CHOICES, COLOR_FILTER_IDS
        fid = str(filter_id or 'none').strip().lower()
        if fid not in COLOR_FILTER_IDS:
            fid = 'none'
        self.state.values['color_filter'] = fid
        if int(self.state.values.get('color_filter_strength', 0) or 0) <= 0:
            self.state.values['color_filter_strength'] = 70
        self.control_board.sync_control_values('color_filter', 'color_filter_strength')
        self.control_board.set_look_inspector_kind('filter')
        self.resource_library.sync_look_ui(self.state.values)
        self._activate_module('filters', focus_node='look_effects', focus_control='color_filter_strength')
        self.preview_panel.refresh_settings()
        label = next((text for text, value in COLOR_FILTER_CHOICES if value == fid), fid)
        self.statusBar().showMessage(f'Đã áp bộ lọc: {label}', 3000)
        self._schedule_autosave()

    def _apply_library_color_lut(self, rel: str) -> None:
        from core.lut_stack import add_lut_to_stack, lut_entry_by_rel
        entry = lut_entry_by_rel(rel)
        if entry is None:
            self.statusBar().showMessage('Không tìm thấy file LUT', 3000)
            return None
        self.state.values['color_lut_stack'] = add_lut_to_stack(self.state.values.get('color_lut_stack'), entry['rel'])
        self.state.values['color_lut_stack_master_enabled'] = True
        self.state.values['selected_lut_rel'] = entry['rel']
        self.control_board.sync_control_values('color_lut_stack_master_enabled')
        self.control_board.set_look_inspector_kind('filter')
        self.control_board._lut_stack_ui_rels = None
        self.control_board._sync_look_effect_ui()
        self.resource_library.sync_look_ui(self.state.values)
        self._activate_module('filters', focus_node='look_effects', focus_control='color_filter_strength')
        self.preview_panel.refresh_settings()
        self.statusBar().showMessage(f"Đã chồng LUT: {entry['title']}", 3000)
        self._schedule_autosave()

    def _apply_library_transition(self, style_id: str) -> None:
        from core.timeline_clips import clips_from_values
        from core.timeline_transitions import normalize_transition_mode, normalize_transition_style, resolve_library_apply_ms, style_label
        style = normalize_transition_style(style_id)
        user_ms = int(self.state.values.get('timeline_transition_ms', 0) or 0)
        ms = resolve_library_apply_ms(user_ms, style)
        mode = normalize_transition_mode(self.state.values.get('timeline_transition_mode', 'one_for_all'))
        self.state.values['timeline_transition_ms'] = max(0, ms)
        self.state.values['timeline_transition_style'] = style
        if mode == 'random':
            pool = list(self.state.values.get('timeline_transition_random_pool') or [])
            if style != 'cut' and style not in pool:
                pool.append(style)
                self.state.values['timeline_transition_random_pool'] = pool
            self._apply_random_transitions(status_prefix=f'Đã thêm «{style_label(style)}» vào pool · ')
            return None
        self.control_board.sync_control_values('timeline_transition_ms', 'timeline_transition_mode')
        self._activate_module('transitions', focus_node='video_output', focus_control='timeline_transition_ms')
        self.timeline_panel.canvas.update()
        self.preview_panel.refresh_settings()
        clips = clips_from_values(self.state.values)
        video_clips = [c for c in clips if int(getattr(c, 'track_index', 0) or 0) == 0]
        label = style_label(style)
        note = 'Không dùng — không hiệu ứng chuyển cảnh' if ms <= 0 else 'cần ≥2 cảnh trên timeline (Tách cảnh) — mới thấy khi xuất' if len(video_clips) < 2 else f'1 cho tất cả · {ms} ms giữa {len(video_clips)} cảnh ({len(video_clips) - 1} chỗ cắt)'
        self.statusBar().showMessage(f'Chuyển tiếp: {label} — {note}', 5000)
        self.resource_library.sync_transition_ui(self.state.values)
        self._schedule_autosave()

    def _preview_library_transition(self, style_id: str) -> None:
        from ui_qt.widgets.transition_preview import TransitionPreviewDialog
        dialog = TransitionPreviewDialog(str(style_id or 'fade'), self)
        dialog.exec()

    def _on_transition_mode_changed(self, mode: str) -> None:
        from core.timeline_transitions import normalize_transition_mode
        self.state.values['timeline_transition_mode'] = normalize_transition_mode(mode)
        self.control_board.sync_control_values('timeline_transition_mode')
        self.resource_library.sync_transition_ui(self.state.values)
        self._schedule_autosave()

    def _on_transition_pool_changed(self, pool: object) -> None:
        from core.timeline_transitions import normalize_random_pool
        styles = normalize_random_pool(pool)
        self.state.values['timeline_transition_random_pool'] = styles
        self._schedule_autosave()

    def _apply_random_transitions(self, status_prefix: str='') -> None:
        import time
        from core.timeline_clips import clips_from_values
        from core.timeline_transitions import normalize_random_pool, resolve_join_styles, resolve_random_apply_ms, style_label
        self.state.values['timeline_transition_mode'] = 'random'
        raw_pool = self.state.values.get('timeline_transition_random_pool')
        pool = normalize_random_pool(None if raw_pool is None else raw_pool)
        self.state.values['timeline_transition_random_pool'] = pool
        seed = int(time.time() * 1000) & 2147483647
        self.state.values['timeline_transition_seed'] = seed
        clips = clips_from_values(self.state.values)
        video_clips = [c for c in clips if int(getattr(c, 'track_index', 0) or 0) == 0]
        joins = max(0, len(video_clips) - 1)
        styles = resolve_join_styles(joins, mode='random', random_pool=pool, seed=seed)
        if pool:
            self.state.values['timeline_transition_style'] = pool[0]
            ms = int(self.state.values.get('timeline_transition_ms', 0) or 0)
            self.state.values['timeline_transition_ms'] = resolve_random_apply_ms(ms)
        else:
            self.state.values['timeline_transition_style'] = 'cut'
            self.state.values['timeline_transition_ms'] = 0
        self.state.values['timeline_transition_joins'] = list(styles)
        self.control_board.sync_control_values('timeline_transition_ms', 'timeline_transition_mode')
        self.resource_library.sync_transition_ui(self.state.values)
        self._activate_module('transitions', focus_node='video_output', focus_control='timeline_transition_mode')
        self.timeline_panel.canvas.update()
        self.preview_panel.refresh_settings()
        sample = ', '.join((str(style) for style in styles[:4]))
        more = '…' if len(styles) > 4 else ''
        ms_now = int(self.state.values.get('timeline_transition_ms', 0) or 0)
        note = 'cần ≥2 cảnh (Tách cảnh) — badge ◆ trên timeline Video' if joins <= 0 else f'{joins} chỗ cắt · {ms_now}ms · ◆ vàng = đã gắn · vd: {sample}{more} — bấm Phát và xem qua chỗ cắt (preview mô phỏng; xuất = xfade thật theo style)' if pool else f'{joins} chỗ cắt · pool trống → chấm xám (không hiệu ứng)'
        self.statusBar().showMessage(f'{status_prefix}Random chuyển cảnh — {note}', 9000)
        self._schedule_autosave()

    def _apply_title_template_center(self) -> None:
        values = self.state.values
        values['video_title_enabled'] = True
        values['video_title_position'] = 'center'
        values['video_title_x_norm'] = 0.5
        values['video_title_y_norm'] = 0.5
        values['video_title_scale_percent'] = max(100, int(values.get('video_title_scale_percent', 100) or 100))
        if not str(values.get('video_title_content') or '').strip():
            values['video_title_content'] = 'TIÊU ĐỀ'
        self.control_board.sync_control_values('video_title_enabled', 'video_title_position', 'video_title_content', 'video_title_x_norm', 'video_title_y_norm', 'video_title_scale_percent')
        self._activate_module('subtitle', overlay_part='title', focus_control='video_title_enabled')
        self.preview_panel.refresh_settings()
        self.statusBar().showMessage('Đã áp mẫu tiêu đề giữa khung', 2500)

    def _navigate_inspector_for_preview_kind(self, kind: str) -> None:
        target = target_for_preview_kind(kind)
        if target is None:
            return None
        self._apply_inspector_target(target)

    def _navigate_inspector_for_asset(self, asset: Asset) -> None:
        target = target_for_asset_kind(asset.kind)
        if target is None:
            return None
        self._apply_inspector_target(target)

    def _on_timeline_transition_selected(self, boundary_ms: int=0) -> None:
        _ = boundary_ms
        self._apply_inspector_target(TRANSITION_TARGET)

    def _handle_module_primary_action(self, module_id: str) -> None:
        if module_id == 'batch':
            self.choose_batch_export_folder()
            return None
        if module_id == 'settings':
            self._open_tool_module_sheet('batch')
            return None

    def choose_media_folder(self) -> None:
        if self._locks_editor():
            self.statusBar().showMessage('Đang có tác vụ phụ đề/TTS — chờ xong rồi thêm file', 3500)
            return None
        folder = QFileDialog.getExistingDirectory(self, 'Chọn thư mục chứa video', get_last_dir('media'))
        if folder:
            remember_path('media', folder)
            patterns = ('*.mp4', '*.mkv', '*.mov', '*.avi', '*.webm', '*.m4v')
            paths = []
            root = Path(folder)
            for pattern in patterns:
                paths.extend((str(p) for p in root.glob))
            if paths:
                self.import_media_paths(paths)
            else:
                self.statusBar().showMessage('Không thấy video trong thư mục này', 3000)
                return None
        else:
            return None

    def _refresh_project_asset_lists(self) -> None:
        self.project_panel.reload_assets(self.state)
        self._sync_media_library_if_open()

    def open_media_library_fullscreen(self) -> None:
        if self._media_library_dialog is None:
            dialog = MediaLibraryDialog(self.state, self)
            dialog.set_thumbnail_scheduler(self._schedule_asset_thumbnail)
            dialog.browser.assetSelected.connect(self.select_asset)
            dialog.browser.addFilesRequested.connect(self.choose_media_files)
            dialog.browser.importPathsRequested.connect(self.import_media_paths)
            dialog.browser.removeAssetRequested.connect(self.remove_video_from_project)
            dialog.browser.removeAssetsRequested.connect(self.remove_videos_from_project)
            dialog.browser.openAssetLocationRequested.connect(self._open_in_file_manager)
            dialog.browser.addFolderRequested.connect(self.choose_media_folder)
            dialog.browser.stemSeparateOneRequested.connect(self._on_stem_separate_one_requested)
            dialog.browser.stemSeparateAllRequested.connect(self._on_stem_separate_all_requested)
            dialog.browser.sceneSplitOneRequested.connect(self._on_scene_split_one_requested)
            dialog.browser.sceneSplitAllRequested.connect(lambda: self.start_auto_scene_split('all'))
            self._media_library_dialog = dialog
        dialog = self._media_library_dialog
        dialog.reload_assets(self.state)
        if self.state.selected_id:
            dialog.set_selected_asset(self.state.selected_id)
        dialog.show_expanded()
        self.statusBar().showMessage('Thư viện toàn màn hình — Esc hoặc Đóng để quay lại', 4000)

    def _sync_media_library_if_open(self) -> None:
        dialog = self._media_library_dialog
        if dialog is not None:
            if dialog.isVisible():
                dialog.reload_assets(self.state)
                if self.state.selected_id:
                    dialog.set_selected_asset(self.state.selected_id)
            return None

    def _schedule_asset_thumbnail(self, asset_id: str, path: str, kind: str) -> None:
        w, h = ((112, 63)[0], (112, 63)[1])
        dialog = self._media_library_dialog
        if dialog is not None and dialog.isVisible():
            w, h = ((176, 100)[0], (176, 100)[1])
        self._thumb_queue.append((asset_id, path, kind, w, h))
        self._pump_thumbnail_queue()

    def _schedule_library_thumbnail(self, asset_id: str, path: str, kind: str, width: int, height: int) -> None:
        self._thumb_queue.append((asset_id, path, kind, max(32, int(width)), max(24, int(height))))
        self._pump_thumbnail_queue()

    def _pump_thumbnail_queue(self) -> None:
        while self._thumb_active < 4 and self._thumb_queue:
            asset_id, path, kind, w, h = self._thumb_queue.popleft()
            self._thumb_active += 1
            task = ThumbnailLoadTask(asset_id, path, kind, w, h)
            task.signals.loaded.connect(self._on_thumbnail_loaded)
            self.thread_pool.start(task)

    def _on_timeline_filmstrip_needed(self, paths) -> None:
        for raw in paths or ():
            path = str(raw or '').strip()
            if path and Path(path).is_file():
                asset_id = ''
                for asset in self.state.assets:
                    if asset.kind == 'video' and asset.path and (asset.path == path or asset.path.replace('\\', '/') == path.replace('\\', '/')):
                        asset_id = asset.id
                if not asset_id:
                    asset_id = f'filmstrip:{path}'
                w, h = ((112, 63)[0], (112, 63)[1])
                self._thumb_queue.appendleft((asset_id, path, 'video', w, h))
                self._pump_thumbnail_queue()

    def _on_thumbnail_loaded(self, asset_id: str, icon) -> None:
        self._thumb_active = max(0, self._thumb_active - 1)
        aid = str(asset_id)
        if aid.startswith('library:'):
            self.resource_library.apply_library_icon(aid, icon)
            self._pump_thumbnail_queue()
            return None
        if not aid.startswith('filmstrip:'):
            self.project_panel.set_asset_icon(asset_id, icon)
            dialog = self._media_library_dialog
            if dialog is not None:
                dialog.set_asset_icon(asset_id, icon)
        canvas = getattr(self.timeline_panel, 'canvas', None)
        if canvas is not None:
            path = ''
            if aid.startswith('filmstrip:'):
                path = aid[len('filmstrip:'):]
            else:
                asset = next((candidate for candidate in self.state.assets if candidate.id == aid), None)
                if asset is not None:
                    path = str(asset.path or '')
            if path:
                doomed = [key for key in list(getattr(canvas, '_filmstrip_cache', {})) if str(key).startswith(path)]
                for key in doomed:
                    canvas._filmstrip_cache.pop(key, None)
                canvas._filmstrip_requested.discard(path)
            canvas.update()
        self._pump_thumbnail_queue()

    def _pump_probe_queue(self) -> None:
        limit = 6
        while self._probe_active < limit and self._probe_queue:
            path = self._probe_queue.popleft()
            if path not in self._probe_tasks:
                self._probe_active += 1
                task = MediaProbeTask(path)
                task.signals.completed.connect(self._on_media_ready)
                task.signals.failed.connect(self._on_media_failed)
                task.signals.finished.connect(self._on_probe_finished)
                self._probe_tasks[path] = task
                self.thread_pool.start(task)

    def choose_media_files(self) -> None:
        if self._locks_editor():
            self.statusBar().showMessage('Đang có tác vụ phụ đề/TTS — chờ xong rồi thêm file', 3500)
            return None
        paths, _selected_filter = (QFileDialog.getOpenFileNames(self, 'Chọn video', get_last_dir('media'), 'Video (*.mp4 *.mkv *.mov *.avi *.webm *.m4v *.ts *.mts);;Tất cả tệp (*.*)')[0], QFileDialog.getOpenFileNames(self, 'Chọn video', get_last_dir('media'), 'Video (*.mp4 *.mkv *.mov *.avi *.webm *.m4v *.ts *.mts);;Tất cả tệp (*.*)')[1])
        if paths:
            remember_path('media', paths[0])
            self.import_media_paths(paths)
            return None

    def choose_replace_video_source(self) -> None:
        if self._locks_editor():
            self.statusBar().showMessage('Đang có tác vụ phụ đề/TTS — chờ xong rồi thay nguồn', 3500)
            return None
        asset = self.state.selected_asset
        if asset is None or asset.kind != 'video':
            self.statusBar().showMessage('Hãy chọn một video trong dự án trước khi thay nguồn', 3500)
            return None
        path, _selected_filter = (QFileDialog.getOpenFileName(self, 'Chọn video nguồn mới (giữ nguyên setting)', get_last_dir('media', str(Path(asset.path).parent) if asset.path else ''), 'Video (*.mp4 *.mkv *.mov *.avi *.webm *.m4v *.ts *.mts);;Tất cả tệp (*.*)')[0], QFileDialog.getOpenFileName(self, 'Chọn video nguồn mới (giữ nguyên setting)', get_last_dir('media', str(Path(asset.path).parent) if asset.path else ''), 'Video (*.mp4 *.mkv *.mov *.avi *.webm *.m4v *.ts *.mts);;Tất cả tệp (*.*)')[1])
        if path:
            remember_path('media', path)
            resolved = str(Path(path).expanduser().resolve())
            if resolved in self._probe_tasks:
                return None
            self._replacing_source_for = asset.id
            task = MediaProbeTask(resolved)
            task.signals.completed.connect(self._on_media_ready)
            task.signals.failed.connect(self._on_media_failed)
            task.signals.finished.connect(self._on_probe_finished)
            self._probe_tasks[resolved] = task
            self.thread_pool.start(task)
            self.statusBar().showMessage('Đang đọc video nguồn mới...')
        else:
            return None

    def import_media_paths(self, paths: list[str]) -> None:
        known = {os.path.normcase(os.path.abspath(asset.path)) for asset in self.state.assets if asset.path}
        queued = 0
        ordered_paths = sorted(paths, key=lambda raw_path: media_basename_sort_key(str(raw_path)))
        starting_batch = self._import_batch_remaining <= 0 and (not self._probe_queue)
        for raw_path in ordered_paths:
            path = str(Path(raw_path).expanduser().resolve())
            normalized = os.path.normcase(os.path.abspath(path))
            if normalized in known or path in self._probe_tasks:
                pass
            else:
                self._probe_queue.append(path)
                known.add(normalized)
                queued += 1
        if queued:
            if starting_batch:
                current = self.state.selected_asset
                self._import_batch_anchor_id = current.id if current is not None and current.kind == 'video' else ''
                self._import_batch_first_path = str(Path(ordered_paths[0]).expanduser().resolve())
            self._import_batch_remaining += queued
            self._pump_probe_queue()
            self.statusBar().showMessage(f'Đang đọc thông tin {queued} video...')
            return None

    def _on_media_ready(self, info: MediaInfo) -> None:
        replace_id = self._replacing_source_for
        if replace_id:
            self._replacing_source_for = None
            kept_sfx = list(self.state.sfx_events)
            try:
                asset = self.state.replace_video_source(replace_id, info)
            except KeyError:
                self._report_error('Không thay được nguồn video', 'Video đang chọn không còn trong dự án')
                return None
            self.state.sfx_events = kept_sfx
            if asset.path:
                try:
                    save_sfx_events(asset.path, kept_sfx)
                except (OSError, ValueError):
                    pass
            self._clear_subtitles_for_video(asset, remove_working=True)
            self._refresh_project_asset_lists()
            self.timeline_panel.reload_project(self.state)
            self.select_asset(asset.id)
            self.statusBar().showMessage(f'Đã thay nguồn: {asset.name} — giữ setting, đã gỡ phụ đề cũ')
        else:
            template = self.state.selected_asset
            template_id = template.id if template is not None and template.kind == 'video' else ''
            template_name = template.name if template is not None else ''
            asset = self.state.add_media(info, select=False)
            self.project_panel.append_video_asset(asset)
            dialog = self._media_library_dialog
            if dialog is not None and dialog.isVisible():
                dialog.append_video_asset(asset)
            self._import_batch_remaining = max(0, self._import_batch_remaining - 1)
            batch_left = self._import_batch_remaining
            total_videos = len(self._video_assets())
            if batch_left <= 0:
                self._refresh_project_asset_lists()
                focus_id = self._resolve_import_batch_focus_id(fallback_template_id=template_id, last_ready_id=asset.id)
                anchor_id = str(self._import_batch_anchor_id or '')
                self._import_batch_anchor_id = ''
                self._import_batch_first_path = ''
                from ui_qt.edit_preset_library import active_preset_id
                active_id = active_preset_id()
                if total_videos == 1:
                    self.state.snapshot_asset_settings(asset.id)
                    self.select_asset(asset.id)
                    if active_id:
                        self.apply_saved_preset(active_id, target_asset_id=asset.id, auto_run_pipeline=False)
                        self.start_batch_dub_pipeline()
                else:
                    applied_from_saved_preset = False
                    if active_id:
                        self.apply_saved_preset(active_id, target_asset_id=asset.id, auto_run_pipeline=False)
                        applied_from_saved_preset = True
                    else:
                        applied = self._apply_batch_template(template_asset_id=anchor_id or template_id or None, target_asset_ids=[asset.id])
                        if self._should_auto_apply_batch_template() and applied:
                            self.refresh_batch_queue()
                    if focus_id:
                        self.select_asset(focus_id)
                    kept_template = bool(focus_id and (focus_id == anchor_id or focus_id == template_id) and (focus_id != asset.id))
                    if kept_template:
                        focus_asset = next((a for a in self.state.assets if a.id == focus_id), None)
                        focus_name = focus_asset.name if focus_asset is not None else template_name
                        self.statusBar().showMessage(f'Đã thêm «{asset.name}» — vẫn edit mẫu «{focus_name}» (áp dụng hàng loạt khi xuất)')
                    else:
                        self.statusBar().showMessage(f'Đã thêm {total_videos} video vào dự án')
                    if applied_from_saved_preset:
                        self.start_batch_dub_pipeline()
            else:
                if template_id and self.state.selected_id != template_id:
                    self.state.select(template_id)
                    self.project_panel.set_selected_asset(template_id)
                self.statusBar().showMessage(f'Đang nạp… {total_videos} video trong dự án, còn {batch_left} ffprobe')
        self._refresh_export_ui()
        self._schedule_autosave()

    def _resolve_import_batch_focus_id(self, *, fallback_template_id: str, last_ready_id: str) -> str:
        videos = [item for item in self.state.assets if item.kind == 'video']
        if videos:
            anchor = str(self._import_batch_anchor_id or '').strip()
            if anchor and any((item.id == anchor for item in videos)):
                return anchor
            first_path = str(self._import_batch_first_path or '').strip()
            if first_path:
                want = os.path.normcase(os.path.abspath(first_path))
                for item in videos:
                    if item.path and os.path.normcase(os.path.abspath(item.path)) == want:
                        return item.id
                fallback = str(fallback_template_id or '').strip()
                return fallback if fallback and any((item.id == fallback for item in videos)) else videos[0].id
        else:
            return ''

    def _on_media_failed(self, path: str, message: str) -> None:
        self._replacing_source_for = None
        self._report_error(f'Không thể mở {Path(path).name}', message, dialog=True)
        if self._import_batch_remaining > 0:
            self._import_batch_remaining = max(0, self._import_batch_remaining - 1)
            batch_left = self._import_batch_remaining
            if batch_left <= 0:
                self._refresh_project_asset_lists()
                focus_id = self._resolve_import_batch_focus_id()
                self._import_batch_anchor_id = ''
                self._import_batch_first_path = ''
                if focus_id:
                    self.select_asset(focus_id)
                self.timeline_panel.reload_project(self.state)
                self.statusBar().showMessage(f'Nạp xong — {len(self._video_assets())} video trong dự án')
            else:
                self.statusBar().showMessage(f'Đang nạp… còn {batch_left} ffprobe')
            return None

    def _on_probe_finished(self, path: str) -> None:
        self._probe_tasks.pop(path, None)
        self._probe_active = max(0, self._probe_active - 1)
        self._pump_probe_queue()

    def select_asset(self, asset_id: str) -> None:
        if self._locks_editor():
            self.statusBar().showMessage('Đang có tác vụ phụ đề/TTS — chờ xong rồi đổi video', 3500)
            return None
        previous_id = self.state.selected_id
        from ui_qt.asset_export import PROJECT_FRAME_KEYS
        project_frame = {key: self.state.values.get(key) for key in PROJECT_FRAME_KEYS if key in self.state.values}
        if previous_id and previous_id != asset_id:
            self._persist_video_subtitles(previous_id)
            self.state.snapshot_asset_settings(previous_id)
            self._persist_current_sfx()
            self._schedule_autosave()
            self._push_history()
        self.state.select(asset_id)
        asset = self.state.selected_asset
        if asset is None:
            return None
        if asset.kind == 'video':
            restored = self.state.restore_asset_settings(asset_id)
            if not restored:
                self._reset_unedited_video_session(asset)
            for key, value in project_frame.items():
                self.state.values[key] = value
            from core.audio_mix_state import sync_video_stem_paths_for_file
            sync_video_stem_paths_for_file(self.state.values, asset.path or '')
            task_path = str(getattr(self.video_stem_task, 'video_path', '') or '')
            if self.video_stem_task is not None and task_path and (task_path != str(asset.path or '')):
                self.video_stem_task.cancel()
            self._load_video_subtitles(asset)
            self._apply_voice_locked_subtitles()
            self._align_timeline_to_video_duration(asset)
            self.control_board.reload_project(self.state)
            self.preview_panel.refresh_settings()
            self._sync_batch_prep_flag_widgets()
        self._load_sfx_for_selected_video()
        self.project_panel.set_selected_asset(asset_id)
        self.preview_panel.set_selected_asset(asset)
        self.timeline_panel.set_selected_asset(asset_id)
        self.control_board.set_context(asset.kind)
        self._sync_history_baseline()
        self._navigate_inspector_for_asset(asset)
        if asset.kind == 'video':
            self.statusBar().showMessage(f"Đang soạn «{asset.name}» — khung dự án chung ({self.state.values.get('aspect_ratio', '9:16')}); chỉnh riêng từng clip được giữ")
        else:
            self.statusBar().showMessage(f'Đã chọn: {asset.name}')
        if self._is_export_pipeline_busy() and asset.kind == 'video':
            self._user_edit_asset_id = str(asset_id)
        self._refresh_export_ui()
        self.refresh_batch_queue()
        self._refresh_project_work_context()
        self._refresh_preview_preset_bar()

    def _reset_unedited_video_session(self, asset) -> None:
        from core.timeline_clips import ensure_timeline_clips
        self.state.values['subtitle_enabled'] = False
        self.state.values['subtitle_path'] = ''
        self.state.values['voice_audio_path'] = ''
        self.state.values['voice_audio_enabled'] = False
        self.state.values['video_vocal_stem_path'] = ''
        self.state.values['video_instrumental_stem_path'] = ''
        self.state.values['vocal_sep_cache_path'] = ''
        self.state.values['trim_start_ms'] = 0
        self.state.values['trim_end_ms'] = 0
        self.state.values['offset_x'] = 0
        self.state.values['offset_y'] = 0
        self.state.values['scale_percent'] = 100
        self.state.values['scale_x_percent'] = 100
        self.state.values['scale_y_percent'] = 100
        self.state.values['timeline_clips'] = []
        self.state.values['selected_timeline_clip_id'] = ''
        self.state.values['selected_timeline_clip_ids'] = []
        ensure_timeline_clips(self.state.values, source_duration_ms=max(1, int(getattr(asset, 'duration_ms', 0) or 1)), source_path=str(getattr(asset, 'path', '') or ''))

    def _on_timeline_audio_mix_preview(self) -> None:
        canvas = getattr(self.timeline_panel, 'canvas', None)
        if canvas is not None:
            canvas.update()
            return None

    def _on_timeline_audio_mix_changed(self) -> None:
        from core.audio_mix_state import migrate_audio_mix_values, sync_legacy_audio_keys
        migrate_audio_mix_values(self.state.values)
        sync_legacy_audio_keys(self.state.values)
        self.control_board.sync_audio_mix_controls()
        self.control_board.sync_control_values('original_video_volume')
        apply_mix = getattr(self.preview_panel, '_apply_mix_audio_to_playback', None)
        if callable(apply_mix):
            apply_mix()
        else:
            set_volume = getattr(self.preview_panel.playback, 'set_volume', None)
            if callable(set_volume):
                if self.state.values.get('mute_original_audio'):
                    set_volume(0)
                else:
                    set_volume(int(self.state.values.get('audio_volume', 100)))
        self.timeline_panel.canvas.update()
        self._sync_history_baseline()
        self._schedule_autosave()
        parts = []
        if self.state.values.get('mute_original_audio'):
            parts.append('tắt gốc')
        else:
            parts.append(f"gốc {int(self.state.values.get('audio_volume', 100))}%")
        parts.append(f"TTS {int(self.state.values.get('voice_audio_volume', 100))}%")
        parts.append(f"BGM {int(self.state.values.get('background_audio_volume', 35))}%")
        if self.state.values.get('subtitle_enabled'):
            parts.append('phụ đề bật')
        self.statusBar().showMessage('Âm thanh: ' + ' · '.join(parts), 2500)

    def _primary_video_path(self) -> str:
        asset = next((item for item in self.state.assets if item.kind == 'video' and item.path), None)
        return '' if asset is None else str(asset.path)

    def _on_video_stems_cancel(self) -> None:
        if self.video_stem_task is not None:
            self.video_stem_task.cancel()
        strip = self.timeline_panel.mix_strip
        strip.set_status('Đang dừng…')
        self.statusBar().showMessage('Đang dừng tách AI…', 4000)

    def _apply_stem_audio_tracks(self, *, mode: str, vocal_path: str, instrumental_path: str) -> None:
        from core.timeline_audio_clips import upsert_stem_audio_tracks
        from core.timeline_clips import clips_from_values, clips_on_track, find_clip, selected_clip_id, timeline_duration_ms
        values = self.state.values
        asset = self._selected_video_asset()
        clips = clips_from_values(values)
        video_clips = clips_on_track(clips, 0)
        sel = find_clip(clips, selected_clip_id(values))
        dur_ms = timeline_duration_ms(video_clips) if video_clips else 0
        if dur_ms <= 0 and asset is not None:
            dur_ms = max(1, int(asset.duration_ms or 1))
        if dur_ms <= 0 and sel is not None:
            dur_ms = max(1, int(sel.duration_ms))
        dur_ms = max(1, int(dur_ms))
        upsert_stem_audio_tracks(values, mode=mode, vocal_path=vocal_path, instrumental_path=instrumental_path, timeline_start_ms=0, duration_ms=dur_ms, source_clip_id=sel.id if sel is not None else '')
        self.timeline_panel.reload_project()

    def _on_video_stems_requested(self, stem_channel: str='') -> None:
        import sys
        from core.audio_mix_state import sync_video_stem_paths_for_file
        from core.demucs_separate import check_demucs_deps, demucs_missing_box, friendly_demucs_error, video_instrumental_stem_cache_path, video_vocal_stem_cache_path
        from ui_qt.timeline_context_menu import STEM_MODE_LABELS, apply_stem_separation_intent, normalize_stem_mode, stem_cache_ready_for_mode
        from ui_qt.workers.video_stems import VideoStemTask
        mode = normalize_stem_mode(stem_channel)
        label = STEM_MODE_LABELS.get(mode, 'Tách âm thanh')
        asset = self._selected_video_asset()
        video_path = str(asset.path or '') if asset else ''
        strip = self.timeline_panel.mix_strip
        if video_path:
            values = self.state.values
            apply_stem_separation_intent(values, mode)
            strip.sync_from_state()
            self._on_timeline_audio_mix_changed()
            vocal_cache = video_vocal_stem_cache_path(video_path)
            inst_cache = video_instrumental_stem_cache_path(video_path)
            if stem_cache_ready_for_mode(video_path, mode):
                sync_video_stem_paths_for_file(values, video_path)
                if Path(vocal_cache).is_file():
                    values['video_vocal_stem_path'] = vocal_cache
                if Path(inst_cache).is_file():
                    values['video_instrumental_stem_path'] = inst_cache
                self._apply_stem_audio_tracks(mode=mode, vocal_path=str(values.get('video_vocal_stem_path', '') or ''), instrumental_path=str(values.get('video_instrumental_stem_path', '') or ''))
                strip.sync_from_state()
                strip.set_status(f'{label}: đã có cache — đã tạo track timeline', detail=str(vocal_cache if mode != 'music' else inst_cache))
                self._on_timeline_audio_mix_changed()
                self.statusBar().showMessage(f'{label} sẵn sàng — track Giọng/Nhạc tách trên timeline', 6000)
                return None
            if Path(vocal_cache).is_file() and Path(inst_cache).is_file():
                sync_video_stem_paths_for_file(values, video_path)
                self._apply_stem_audio_tracks(mode=mode, vocal_path=str(values.get('video_vocal_stem_path', '') or ''), instrumental_path=str(values.get('video_instrumental_stem_path', '') or ''))
                strip.sync_from_state()
                self._on_timeline_audio_mix_changed()
                return None
            deps_ok, deps_err = (check_demucs_deps()[0], check_demucs_deps()[1])
            if deps_ok:
                intent_hint = {'music': 'Sau khi tách: giữ «Nhạc gốc» 100%, «Giọng gốc» 0%. Kéo volume nếu muốn bật lại giọng.', 'vocal': 'Sau khi tách: giữ «Giọng gốc» 100%, «Nhạc gốc» 0%. Kéo volume nếu muốn bật lại nhạc.', 'both': 'Sau khi tách: cả Nhạc gốc + Giọng gốc 100%. Kéo volume về 0% nguồn nào không dùng.'}.get(mode, '')
                confirm = QMessageBox(self)
                confirm.setIcon(QMessageBox.Icon.Warning)
                confirm.setWindowTitle(label)
                confirm.setText(f'{label} — Demucs chạy trên máy bạn (không phải API trả phí).')
                confirm.setInformativeText(f'{intent_hint}\n\nClip dài có thể chiếm CPU/GPU vài phút — chạy nền, vẫn chỉnh timeline/preview/volume được. Bấm «Dừng» trên hàng mix khi muốn hủy.\n\nTiếp tục cho video đang chọn?')
                confirm.setStandardButtons(QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No)
                confirm.setDefaultButton(QMessageBox.StandardButton.No)
                if confirm.exec() != QMessageBox.StandardButton.Yes:
                    strip.set_status('Đã hủy tách')
                    return None
                if self.video_stem_task is not None:
                    self.video_stem_task.cancel()
                values['stem_sep_intent'] = mode
                task = VideoStemTask(video_path)
                self.video_stem_task = task
                strip.set_stems_busy(True)
                strip.set_status(f'Đang {label.lower()}… 0%')
                self.statusBar().showMessage(f'AI {label.lower()} chạy nền — vẫn chỉnh timeline/preview được · bấm Dừng để hủy', 8000)

                def _on_stem_progress(message: str, _label: str=label) -> None:
                    text = str(message or '').strip()
                    if text:
                        strip.set_status(text[:120])
                        self.statusBar().showMessage(f'AI {_label.lower()}: {text[:100]}', 0)
                    else:
                        return None
                task.signals.progressChanged.connect(_on_stem_progress)
                task.signals.completed.connect(self._on_video_stems_completed)
                task.signals.failed.connect(self._on_video_stems_failed)
                task.signals.finished.connect(self._on_video_stems_finished)
                self.thread_pool.start(task)
            else:
                frozen = bool(getattr(sys, 'frozen', False))
                detail = friendly_demucs_error(deps_err or "No module named 'torch'", frozen=frozen)
                status, title = (demucs_missing_box(frozen=frozen)[0], demucs_missing_box(frozen=frozen)[1])
                strip.set_status(status, detail=detail)
                QMessageBox.warning(self, title, detail if frozen else f'{detail}\n\nSau đó Reload UI và chọn lại «Tách âm thanh».')
                return None
        else:
            strip.set_status('Chưa chọn video')
            return None

    def _on_video_stems_completed(self, vocal_path: str, inst_path: str) -> None:
        from ui_qt.timeline_context_menu import STEM_MODE_LABELS, normalize_stem_mode
        asset = self._selected_video_asset()
        task = self.video_stem_task
        if asset is None or task is None:
            return None
        if str(asset.path or '') != str(task.video_path or ''):
            return None
        values = self.state.values
        if vocal_path:
            values['video_vocal_stem_path'] = vocal_path
        if inst_path:
            values['video_instrumental_stem_path'] = inst_path
        mode = normalize_stem_mode(values.get('stem_sep_intent', 'both'))
        self._apply_stem_audio_tracks(mode=mode, vocal_path=vocal_path, instrumental_path=inst_path)
        self.timeline_panel.mix_strip.sync_from_state()
        label = STEM_MODE_LABELS.get(mode, 'Tách âm thanh')
        self.timeline_panel.mix_strip.set_status(f'{label} xong ✓ — đã tạo track mới')
        self.statusBar().showMessage(f'{label} xong — track Giọng/Nhạc tách đã thêm dưới «Video gốc»', 8000)
        self._on_timeline_audio_mix_changed()

    def _on_video_stems_failed(self, message: str) -> None:
        text = str(message or '').strip()
        short = text if len(text) <= 72 else text[:69] + '…'
        self.timeline_panel.mix_strip.set_status(f'Lỗi: {short}', detail=text)
        self.statusBar().showMessage(text, 12000)

    def _on_video_stems_finished(self) -> None:
        self.video_stem_task = None
        self.timeline_panel.mix_strip.set_stems_busy(False)
        if self._stem_batch_total <= 0:
            return None
        self._stem_batch_done += 1
        if self._stem_batch_queue:
            left = len(self._stem_batch_queue)
            self.statusBar().showMessage(f'Tách âm hàng loạt {self._stem_batch_done}/{self._stem_batch_total} — còn {left}', 4000)
            self._pump_stem_batch_queue()
            return None
        total = self._stem_batch_total
        self._stem_batch_total = 0
        self._stem_batch_done = 0
        self.statusBar().showMessage(f'Đã tách âm xong {total} video trong dự án', 5000)

    def _on_scene_split_one_requested(self, asset_id: str) -> None:
        if self._has_background_job():
            self.statusBar().showMessage('Đang có tác vụ khác — chờ xong rồi tách cảnh', 3500)
            return None
        asset = next((a for a in self.state.assets if a.id == asset_id), None)
        if asset is not None and asset.kind == 'video' and asset.path:
            if self.state.selected_id != asset_id:
                self.select_asset(asset_id)
            self.start_auto_scene_split('one')
        else:
            self.statusBar().showMessage('Không tách cảnh được video này', 3000)
            return None

    def _on_stem_separate_one_requested(self, asset_id: str, mode: str) -> None:
        if self._has_exclusive_job() or self.video_stem_task is not None:
            self.statusBar().showMessage('Đang có tác vụ khác — chờ xong rồi tách âm', 3500)
            return None
        asset = next((a for a in self.state.assets if a.id == asset_id), None)
        if asset is not None and asset.kind == 'video' and asset.path:
            if self.state.selected_id != asset_id:
                self.select_asset(asset_id)
            self._on_video_stems_requested(mode)
        else:
            self.statusBar().showMessage('Không tách được video này', 3000)
            return None

    def _on_stem_separate_all_requested(self, mode: str) -> None:
        from ui_qt.timeline_context_menu import STEM_MODE_LABELS, normalize_stem_mode
        resolved = normalize_stem_mode(mode)
        videos = [a for a in self.state.assets if a.kind == 'video' and a.path]
        if not videos:
            self.statusBar().showMessage('Không có video trong dự án để tách âm', 3000)
            return None
        if self._has_exclusive_job() or self.video_stem_task is not None:
            self.statusBar().showMessage('Đang có tác vụ khác — chờ xong rồi tách hàng loạt', 3500)
            return None
        label = STEM_MODE_LABELS.get(resolved, 'Tách âm thanh')
        self._stem_batch_queue = deque(((a.id, resolved) for a in videos))
        self._stem_batch_total = len(videos)
        self._stem_batch_done = 0
        self.statusBar().showMessage(f'{label} hàng loạt — {len(videos)} video…', 5000)
        self._pump_stem_batch_queue()

    def _pump_stem_batch_queue(self) -> None:
        if self.video_stem_task is not None:
            return None
        if self._stem_batch_queue:
            asset_id, mode = self._stem_batch_queue.popleft()
            asset = next((a for a in self.state.assets if a.id == asset_id), None)
            if asset is not None and asset.path:
                if self.state.selected_id != asset_id:
                    self.select_asset(asset_id)
                self._on_video_stems_requested(mode)
            else:
                self._pump_stem_batch_queue()
                return None
        else:
            return None

    def _save_orientation_default(self, kind: str) -> None:
        from ui_qt.user_defaults import orientation_label, save_orientation_default
        key = str(kind or '').strip().lower()
        if key not in frozenset({'portrait', 'landscape'}):
            pass
        else:
            try:
                path = save_orientation_default(self.state, key, path=None)
            except (OSError, ValueError) as exc:
                self._report_error('Không lưu được mặc định', str(exc))
            self.control_board.refresh_user_defaults_buttons()
            self.statusBar().showMessage(f'Đã lưu mặc định {orientation_label(key)} — Đặt lại sẽ dùng bộ này', 5000)
            self._log_event(f'Lưu mặc định {key}', path)

    def _apply_orientation_default(self, kind: str) -> None:
        from ui_qt.user_defaults import apply_orientation_default_to_state, orientation_label
        key = str(kind or '').strip().lower()
        if key not in frozenset({'portrait', 'landscape'}):
            return None
        ok = apply_orientation_default_to_state(self.state, key)
        if ok:
            self.control_board.reload_project(self.state)
            self.preview_panel.refresh_settings()
            self._refresh_export_ui()
            if self.state.selected_id:
                self.state.snapshot_asset_settings(self.state.selected_id)
            self.control_board.resetRequested.emit()
            self.control_board.settingsChanged.emit()
            self.statusBar().showMessage(f'Đã áp mặc định {orientation_label(key)}', 4000)
        else:
            self.statusBar().showMessage(f'Chưa có mặc định {orientation_label(key)} — hãy Lưu trước', 4000)
            return None

    def _export_mix_values_from_settings(self, settings) -> dict[str, object]:
        return {'video_vocal_enabled': bool(getattr(settings, 'video_vocal_enabled', False)), 'video_vocal_volume': int(getattr(settings, 'video_vocal_volume', 0) or 0), 'video_bgm_enabled': bool(getattr(settings, 'video_bgm_enabled', False)), 'video_bgm_volume': int(getattr(settings, 'video_bgm_volume', 0) or 0)}

    def _resolve_video_stems_for_export(self, settings, video_path: str, *, allow_separate: bool):
        from core.video_stem_audio import attach_stems_to_export_settings, is_qt_gui_thread
        allow = bool(allow_separate) and (not is_qt_gui_thread())
        return attach_stems_to_export_settings(settings, video_path, allow_separate=allow)

    def _on_timeline_track_focus(self, focus_id: str) -> None:
        self._on_timeline_layer_selected(str(focus_id or ''))

    def _on_timeline_track_slot_remove(self, layer_id: str) -> None:
        from ui_qt.background_layers import remove_background_layer_at
        from ui_qt.blend_layers import remove_blend_layer_at
        from ui_qt.media_overlays import remove_media_overlay_at
        from ui_qt.panels.timeline_panel import LAYER_BLUR, LAYER_LOGO, LAYER_TEXT_LOGO, LAYER_TEXT_OVERLAY, LAYER_VIDEO_TITLE
        lid = str(layer_id or '')
        removed = False
        label = ''
        if lid.startswith('layer-overlay-'):
            try:
                index = int(lid.rsplit('-', 1)[-1])
            except ValueError:
                return None
            self._push_history()
            removed = remove_media_overlay_at(self.state.values, index)
            label = 'lớp phủ'
            self.control_board.sync_effect_overlay_controls()
            if removed:
                self._refresh_timeline_layer_rows()
                self.timeline_panel.reload_project()
                self.preview_panel.refresh_settings()
                self._schedule_autosave()
                self.statusBar().showMessage(f'Đã xóa {label} trên timeline', 2500)
            else:
                self.statusBar().showMessage(f"Không xóa được {label or 'layer'}", 2500)
            return None
        if lid.startswith('layer-blend-'):
            try:
                index = int(lid.rsplit('-', 1)[-1])
            except ValueError:
                return None
            self._push_history()
            removed = remove_blend_layer_at(self.state.values, index)
            label = 'hòa trộn'
            self.control_board.sync_blend_layer_controls()
        elif lid.startswith('layer-background-'):
            try:
                index = int(lid.rsplit('-', 1)[-1])
            except ValueError:
                return None
            self._push_history()
            removed = remove_background_layer_at(self.state.values, index)
            label = 'nền'
            if hasattr(self.control_board, 'sync_background_layer_controls'):
                self.control_board.sync_background_layer_controls()
        elif lid.startswith('track-remove:'):
            kind = lid.split(':', 1)[1]
            self._push_history()
            removed, label = (self._remove_timeline_kind(kind)[0], self._remove_timeline_kind(kind)[1])
        elif lid in {LAYER_VIDEO_TITLE, 'track-remove:video_title'}:
            self._push_history()
            removed, label = (self._remove_timeline_kind('video_title')[0], self._remove_timeline_kind('video_title')[1])
        elif lid in {LAYER_LOGO, LAYER_TEXT_LOGO, 'track-remove:text_logo'}:
            self._push_history()
            removed, label = (self._remove_timeline_kind('text_logo')[0], self._remove_timeline_kind('text_logo')[1])
        elif lid.startswith('layer-text-overlay'):
            self._push_history()
            if lid.startswith('layer-text-overlay-'):
                try:
                    index = int(lid.rsplit('-', 1)[-1])
                    self.state.values['text_overlay_index'] = index
                except ValueError:
                    pass
            removed, label = (self._remove_timeline_kind('text_overlay')[0], self._remove_timeline_kind('text_overlay')[1])
        elif lid in {LAYER_TEXT_OVERLAY, 'track-remove:text_overlay'}:
            self._push_history()
            removed, label = (self._remove_timeline_kind('text_overlay')[0], self._remove_timeline_kind('text_overlay')[1])
        elif lid in {LAYER_BLUR, 'track-remove:blur'}:
            self._push_history()
            removed, label = (self._remove_timeline_kind('blur')[0], self._remove_timeline_kind('blur')[1])
        else:
            self.statusBar().showMessage('Hàng trống — dùng ＋ để thêm layer', 3000)
            return None

    def _remove_timeline_kind(self, kind: str) -> tuple[bool, str]:
        from ui_qt.blur_zones import remove_selected_blur_zone
        from core.timeline_clips import clips_from_values, delete_clips_ripple, selected_clip_id, write_clips
        values = self.state.values
        if kind == 'video':
            clip_id = selected_clip_id(values)
            clips = clips_from_values(values)
            if clip_id and clips:
                updated = delete_clips_ripple(clips, [clip_id])
                write_clips(values, updated)
                return (True, 'clip video')
            return (False, 'clip video')
        if kind == 'subtitle':
            self.clear_current_subtitles(record_history=False)
            return (True, 'phụ đề')
        if kind == 'text_overlay':
            from ui_qt.text_overlays import clear_all_text_overlays, remove_selected_text_overlay
            items = self.state.values.get('text_overlays') or []
            if isinstance(items, list) and len(items) > 1:
                remove_selected_text_overlay(values)
            else:
                clear_all_text_overlays(values)
            if hasattr(self.control_board, 'refresh_text_overlay_list'):
                self.control_board.refresh_text_overlay_list()
            self._set_checkbox_control('text_overlay_enabled', bool(values.get('text_overlay_enabled')))
            return (True, 'chữ phụ họa')
        if kind == 'video_title':
            values['video_title_enabled'] = False
            self._set_checkbox_control('video_title_enabled', False)
            return (True, 'tiêu đề')
        if kind == 'text_logo':
            values['logo_enabled'] = False
            self._set_checkbox_control('logo_enabled', False)
            return (True, 'logo')
        if kind == 'blur':
            if remove_selected_blur_zone(values):
                zones = values.get('blur_zones') or []
                if not zones:
                    values['blur_zone_enabled'] = False
            else:
                values['blur_zone_enabled'] = False
            self._set_checkbox_control('blur_zone_enabled', bool(values.get('blur_zone_enabled')))
            return (True, 'vùng mờ')
        if kind == 'voice':
            values['voice_audio_enabled'] = False
            self._set_checkbox_control('voice_audio_enabled', False)
            return (True, 'giọng đọc')
        if kind in frozenset({'music', 'audio'}):
            values['background_audio_enabled'] = False
            self._set_checkbox_control('background_audio_enabled', False)
            return (True, 'nhạc file')
        if kind == 'sfx':
            if self.state.sfx_events:
                self.state.sfx_events.clear()
                self.timeline_panel.canvas.update()
                return (True, 'SFX')
            return (False, 'SFX')
        return (False, kind)

    def _on_timeline_layer_selected(self, layer_id: str) -> None:
        layer_id = str(layer_id or '')
        if layer_id.startswith('layer-blend-'):
            try:
                index = int(layer_id.rsplit('-', 1)[-1])
                self.state.values['blend_layer_index'] = index
                self.control_board.sync_blend_layer_controls()
            except ValueError:
                pass
        elif layer_id.startswith('layer-background-'):
            try:
                index = int(layer_id.rsplit('-', 1)[-1])
                self.state.values['background_layer_index'] = index
                if hasattr(self.control_board, 'sync_background_layer_controls'):
                    self.control_board.sync_background_layer_controls()
            except ValueError:
                pass
        elif layer_id.startswith('layer-overlay-'):
            try:
                index = int(layer_id.rsplit('-', 1)[-1])
                self.state.values['media_overlay_index'] = index
                self.control_board.sync_effect_overlay_controls()
            except ValueError:
                pass
        elif layer_id == 'layer-text-overlay' or layer_id.startswith('layer-text-overlay-'):
            from ui_qt.text_overlays import ensure_text_overlays, sync_flat_from_selected_text
            items = ensure_text_overlays(self.state.values)
            if items:
                if layer_id.startswith('layer-text-overlay-'):
                    try:
                        index = int(layer_id.rsplit('-', 1)[-1])
                    except ValueError:
                        index = 0
                else:
                    index = int(self.state.values.get('text_overlay_index', 0) or 0)
                self.state.values['text_overlay_index'] = max(0, min(index, len(items) - 1))
                sync_flat_from_selected_text(self.state.values)
                if hasattr(self.control_board, 'refresh_text_overlay_list'):
                    self.control_board.refresh_text_overlay_list()
        if layer_id == 'track-sfx':
            self.control_board.reload_sfx_presets()
            self.control_board.sync_sfx_controls()
        target = target_for_timeline_layer(layer_id)
        if target is None:
            pass
        else:
            self._apply_inspector_target(target)

    def _on_timeline_track_add(self, kind: str) -> None:
        if kind == 'video' or kind.startswith('video'):
            self.insert_timeline_video_on_track(track_index=0)
            return None
        if kind in frozenset({'media_overlay'}) or kind.startswith('media_overlay'):
            self._pick_library_asset_for_track('overlay')
            return None
        if kind in frozenset({'blend_layer'}) or kind.startswith('blend_layer'):
            self._pick_library_asset_for_track('blend')
            return None
        if kind in frozenset({'background_layer'}) or kind.startswith('background_layer'):
            self._pick_library_asset_for_track('background')
            return None
        if kind == 'subtitle':
            self.switch_module('subtitle')
            self.choose_subtitle_file()
            return None
        if kind == 'text_overlay':
            self._add_text_overlay_from_timeline()
            return None
        if kind == 'video_title':
            self._push_history()
            self.state.values['video_title_enabled'] = True
            if not str(self.state.values.get('video_title_content') or '').strip():
                self.state.values['video_title_content'] = 'TIÊU ĐỀ'
            self._set_checkbox_control('video_title_enabled', True)
            self._activate_module('subtitle', overlay_part='title', focus_control='video_title_enabled')
            self.timeline_panel.reload_project()
            self.preview_panel.refresh_settings()
            self._schedule_autosave()
            return None
        if kind == 'blur':
            self._add_blur_zone_from_timeline()
            return None
        if kind == 'text_logo':
            self._pick_library_asset_for_track('logo')
            return None
        if kind == 'voice':
            self.switch_module('tts')
            self.choose_voice_audio_file()
            return None
        if kind in frozenset({'music', 'audio'}):
            self._pick_library_asset_for_track('bgm')
            return None
        if kind == 'sfx':
            self._pick_library_asset_for_track('sfx')
            return None
        if kind == 'source_audio':
            self.switch_module('tts')
            self.statusBar().showMessage('Âm gốc lấy từ video — bật/tắt trong tab Audio', 3500)
            return None

    def _add_text_overlay_from_timeline(self) -> None:
        from PySide6.QtWidgets import QInputDialog
        from ui_qt.text_overlays import add_text_overlay_item
        text, ok = (QInputDialog.getMultiLineText(self, 'Chữ phụ họa', 'Nhập nội dung chữ (hiện trên video):', 'Theo dõi kênh')[0], QInputDialog.getMultiLineText(self, 'Chữ phụ họa', 'Nhập nội dung chữ (hiện trên video):', 'Theo dõi kênh')[1])
        if ok:
            content = str(text or '').strip()
            if content:
                self._push_history()
                add_text_overlay_item(self.state.values, {'content': content, 'style': 'static', 'enabled': True, 'position': 'custom'})
                if hasattr(self.control_board, 'refresh_text_overlay_list'):
                    self.control_board.refresh_text_overlay_list()
                self._activate_module('subtitle', overlay_part='text', focus_control='text_overlay_content')
                self.timeline_panel.reload_project()
                self.preview_panel.refresh_settings()
                self._schedule_autosave()
                self.statusBar().showMessage('Đã thêm chữ phụ họa (đứng yên) trên timeline', 3000)
            else:
                self.statusBar().showMessage('Chưa nhập nội dung chữ', 2500)
                return None
        else:
            return None

    def _add_blur_zone_from_timeline(self) -> None:
        from ui_qt.blur_zones import add_blur_zone
        self._push_history()
        self.state.values['blur_zone_enabled'] = True
        add_blur_zone(self.state.values)
        self._set_checkbox_control('blur_zone_enabled', True)
        self.control_board.sync_control_values('blur_zone_enabled', 'blur_zone_style', 'blur_zone_color', 'blur_zone_height_percent')
        self._activate_module('exporter', focus_node='image_adjustments', focus_control='blur_zone_enabled')
        self.preview_panel.frame_canvas.set_preview_selection('blur')
        self.timeline_panel.reload_project()
        self.preview_panel.refresh_settings()
        self._schedule_autosave()
        self.statusBar().showMessage('Đã thêm vùng mờ — chuột phải hàng để chọn nền đen / mờ / màu', 4000)

    def apply_blur_zone_style_from_timeline(self, style: str, *, color: str | None) -> None:
        style = str(style or 'blur').strip().lower()
        if style not in frozenset({'color', 'black', 'blur'}):
            return None
        self._push_history()
        self.state.values['blur_zone_enabled'] = True
        self.state.values['blur_zone_style'] = style
        if color:
            self.state.values['blur_zone_color'] = str(color)
        self._set_checkbox_control('blur_zone_enabled', True)
        self.control_board.sync_control_values('blur_zone_enabled', 'blur_zone_style', 'blur_zone_color')
        self.timeline_panel.reload_project()
        self.preview_panel.refresh_settings()
        self._schedule_autosave()
        labels = {'blur': 'nền mờ', 'black': 'nền đen', 'color': 'màu tùy chọn'}
        self.statusBar().showMessage(f'Vùng mờ → {labels.get(style, style)}', 2500)

    def insert_timeline_video_on_track(self, *, track_index: int, at_timeline_ms: int | None) -> None:
        videos = [asset for asset in self.state.assets if asset.kind == 'video' and asset.path]
        if videos:
            from PySide6.QtWidgets import QInputDialog
            labels = [f'{asset.name}  ({_format_ms(int(asset.duration_ms or 0))})' for asset in videos]
            track_label = f'Video {track_index + 1}' if track_index else 'Video'
            choice, ok = (QInputDialog.getItem(self, f'Thêm vào {track_label}', 'Chọn video trong dự án (kéo-thả từ panel cũng được):', labels, 0, False)[0], QInputDialog.getItem(self, f'Thêm vào {track_label}', 'Chọn video trong dự án (kéo-thả từ panel cũng được):', labels, 0, False)[1])
            if ok and choice:
                asset = videos[labels.index(choice)]
                self.insert_project_asset_on_track(asset.id, track_index=track_index, at_timeline_ms=at_timeline_ms)
            else:
                return None
        else:
            self.choose_media_files()
            return None

    def activate_template_video(self, asset_id: str) -> None:
        asset = next((a for a in self.state.assets if a.id == asset_id), None)
        if asset is not None and asset.kind == 'video' and asset.path:
            self.select_asset(asset_id)
            n = sum((1 for a in self.state.assets if a.kind == 'video' and a.path))
            self.statusBar().showMessage(f'Đang soạn mẫu «{asset.name}» — Xuất hàng loạt sẽ áp cho {n} video trong Media', 5000)
        else:
            self.statusBar().showMessage('Không mở được video mẫu', 3000)
            return None

    def insert_project_asset_on_track(self, asset_id: str, *, track_index: int, at_timeline_ms: int | None, append_sequence: bool) -> None:
        asset = next((a for a in self.state.assets if a.id == asset_id), None)
        if asset is None or asset.kind != 'video' or (not asset.path):
            self.statusBar().showMessage('Chỉ kéo được video từ dự án vào timeline', 3000)
            return None
        if int(track_index) != 0 or append_sequence:
            ok_insert = self.timeline_panel.insert_video_clip_at_playhead(source_path=str(asset.path), source_duration_ms=max(1, int(asset.duration_ms or 1)), track_index=int(track_index), at_timeline_ms=at_timeline_ms, keep_edit_focus=False)
            if ok_insert:
                self.preview_panel.refresh_settings()
                self._schedule_autosave()
                lane = f'Video {int(track_index) + 1}' if int(track_index) else 'Video'
                self.statusBar().showMessage(f'Đã nối «{asset.name}» vào {lane} (giữ Shift để nối chuỗi)', 4000)
                return None
            self.statusBar().showMessage('Không thêm được video vào timeline', 3000)
        else:
            self.activate_template_video(asset_id)
            return None

    def insert_media_paths_on_track(self, paths: list[str], *, track_index: int, at_timeline_ms: int | None, append_sequence: bool) -> None:
        from pathlib import Path as _Path
        video_ext = {'.m4v', '.mov', '.webm', '.mkv', '.mp4', '.avi', '.wmv'}
        video_paths = [str(p) for p in paths if _Path(p).suffix.lower() in video_ext]
        if not video_paths:
            self.statusBar().showMessage('Không có file video hợp lệ để thêm', 3000)
            return None
        if int(track_index) != 0 or append_sequence:
            for path in video_paths:
                self.import_media_paths([path])
                asset = next((a for a in self.state.assets if a.kind == 'video' and str(a.path) == str(path)), None)
                dur = max(1, int(asset.duration_ms if asset else 1) or 1)
                self.timeline_panel.insert_video_clip_at_playhead(source_path=str(path), source_duration_ms=dur, track_index=int(track_index), at_timeline_ms=at_timeline_ms, keep_edit_focus=False)
            self.preview_panel.refresh_settings()
            self._schedule_autosave()
        else:
            self.import_media_paths(video_paths)
            self.statusBar().showMessage(f'Đã nạp {len(video_paths)} video vào Media — bấm video để soạn mẫu', 4500)
            return None

    def insert_media_as_overlay(self, paths: list[str], *, at_timeline_ms: int | None, row_ref: str, end_ms: int | None, default_duration_ms: int | None) -> None:
        from pathlib import Path as _Path
        from ui_qt.media_overlays import add_media_overlay, ensure_media_overlays, is_media_overlay_path, update_selected_media_overlay
        from ui_qt.timeline_layer_tracks import MAX_OVERLAY_TRACKS, parse_layer_row_ref
        start_ms = max(0, int(at_timeline_ms or 0))
        if end_ms is not None:
            resolved_end = max(0, int(end_ms))
        elif default_duration_ms is not None and int(default_duration_ms) > 0:
            resolved_end = start_ms + max(1, int(default_duration_ms))
        else:
            resolved_end = 0
        added = 0
        for path in paths:
            if is_media_overlay_path(path):
                overlays = ensure_media_overlays(self.state.values)
                filled = [o for o in overlays if str(o.get('path', '') or '').strip()]
                if len(filled) >= MAX_OVERLAY_TRACKS:
                    self.statusBar().showMessage(f'Tối đa {MAX_OVERLAY_TRACKS} lớp phủ trên timeline', 3500)
                    break
                parsed = parse_layer_row_ref(row_ref)
                fields = dict(enabled=True, start_ms=start_ms, end_ms=resolved_end, opacity=100)
                if parsed and parsed[1] != 'new':
                    try:
                        idx = int(parsed[1])
                        self.state.values['media_overlay_index'] = idx
                        update_selected_media_overlay(self.state.values, path=str(path), **fields)
                    except ValueError:
                        add_media_overlay(self.state.values, str(path))
                        update_selected_media_overlay(self.state.values, **fields)
                else:
                    add_media_overlay(self.state.values, str(path))
                    update_selected_media_overlay(self.state.values, **fields)
                added += 1
                row_ref = 'overlay:new'
        if added:
            self.state.values['media_overlays_master_enabled'] = True
            self.control_board.sync_effect_overlay_controls()
            self.timeline_panel.reload_project()
            self.preview_panel.refresh_settings()
            self._refresh_timeline_layer_rows()
            self._schedule_autosave()
            self._activate_module('effects', overlay_part='media')
            name = _Path(paths[0]).name if paths else ''
            if resolved_end > 0:
                self.statusBar().showMessage(f'Đã thêm lớp phủ «{name}» ({start_ms / 1000:.1f}s → {resolved_end / 1000:.1f}s)', 3500)
            else:
                self.statusBar().showMessage(f'Đã thêm lớp phủ «{name}»', 3500)

    def insert_media_as_blend(self, paths: list[str], *, at_timeline_ms: int | None, row_ref: str) -> None:
        from pathlib import Path as _Path
        from ui_qt.blend_layers import add_blend_layer, ensure_blend_layers, update_selected_blend_layer
        from ui_qt.media_overlays import is_media_overlay_path
        from ui_qt.timeline_layer_tracks import MAX_BLEND_TRACKS, parse_layer_row_ref
        start_ms = max(0, int(at_timeline_ms or 0))
        added = 0
        for path in paths:
            if is_media_overlay_path(path):
                layers = ensure_blend_layers(self.state.values)
                filled = [o for o in layers if str(o.get('path', '') or '').strip()]
                if len(filled) >= MAX_BLEND_TRACKS:
                    self.statusBar().showMessage(f'Tối đa {MAX_BLEND_TRACKS} lớp hòa trộn trên timeline', 3500)
                    break
                parsed = parse_layer_row_ref(row_ref)
                if parsed and parsed[1] != 'new':
                    try:
                        idx = int(parsed[1])
                        self.state.values['blend_layer_index'] = idx
                        update_selected_blend_layer(self.state.values, path=str(path), enabled=True, start_ms=start_ms, end_ms=0)
                    except ValueError:
                        add_blend_layer(self.state.values, str(path))
                        update_selected_blend_layer(self.state.values, start_ms=start_ms, end_ms=0, enabled=True)
                else:
                    add_blend_layer(self.state.values, str(path))
                    update_selected_blend_layer(self.state.values, start_ms=start_ms, end_ms=0, enabled=True)
                added += 1
                row_ref = 'blend:new'
        if added:
            self.state.values['blend_layers_master_enabled'] = True
            self.control_board.sync_blend_layer_controls()
            self.timeline_panel.reload_project()
            self.preview_panel.refresh_settings()
            self._schedule_autosave()
            self._activate_module('effects', overlay_part='blend')
            name = _Path(paths[0]).name if paths else ''
            self.statusBar().showMessage(f'Đã thêm hòa trộn «{name}»', 3500)

    def insert_media_as_background(self, paths: list[str], *, at_timeline_ms: int | None, row_ref: str) -> None:
        from pathlib import Path as _Path
        from ui_qt.background_layers import add_background_layer, ensure_background_layers, update_selected_background_layer
        from ui_qt.media_overlays import is_media_overlay_path
        from ui_qt.timeline_layer_tracks import MAX_BACKGROUND_TRACKS, parse_layer_row_ref
        start_ms = max(0, int(at_timeline_ms or 0))
        added = 0
        for path in paths:
            if is_media_overlay_path(path):
                layers = ensure_background_layers(self.state.values)
                filled = [o for o in layers if str(o.get('path', '') or '').strip()]
                if len(filled) >= MAX_BACKGROUND_TRACKS:
                    self.statusBar().showMessage(f'Tối đa {MAX_BACKGROUND_TRACKS} lớp nền trên timeline', 3500)
                    break
                parsed = parse_layer_row_ref(row_ref)
                if parsed and parsed[1] != 'new':
                    try:
                        idx = int(parsed[1])
                        self.state.values['background_layer_index'] = idx
                        update_selected_background_layer(self.state.values, path=str(path), enabled=True, start_ms=start_ms, end_ms=0)
                    except ValueError:
                        add_background_layer(self.state.values, str(path))
                        update_selected_background_layer(self.state.values, start_ms=start_ms, end_ms=0, enabled=True)
                else:
                    add_background_layer(self.state.values, str(path))
                    update_selected_background_layer(self.state.values, start_ms=start_ms, end_ms=0, enabled=True)
                added += 1
                row_ref = 'background:new'
        if added:
            self.state.values['background_layers_master_enabled'] = True
            if hasattr(self.control_board, 'sync_background_layer_controls'):
                self.control_board.sync_background_layer_controls()
            self.timeline_panel.reload_project()
            self.preview_panel.refresh_settings()
            self._schedule_autosave()
            self._activate_module('effects', overlay_part='background')
            name = _Path(paths[0]).name if paths else ''
            self.statusBar().showMessage(f'Đã thêm nền «{name}»', 3500)

    def _on_timeline_crop_tool(self, active: bool) -> None:
        if active:
            self._enter_video_crop_mode()
            return None
        self.preview_panel.frame_canvas.exit_crop_mode()
        self._deactivate_face_plate_transform(refresh=False)
        self.preview_panel.refresh_settings()
        self.control_board.sync_video_transform_controls()
        self._schedule_autosave()
        self.statusBar().showMessage('Đã đóng Crop — khung cắt vẫn được áp khi xuất', 3000)

    def _on_inspector_crop_mode(self) -> None:
        if self.state.values.get('crop_enabled'):
            self._enter_video_crop_mode()
            return None
        self.timeline_panel.set_crop_tool_active(False)
        self.preview_panel.frame_canvas.exit_crop_mode()
        self._deactivate_face_plate_transform(refresh=False)
        self.preview_panel.refresh_settings()

    def _enter_video_crop_mode(self) -> None:
        asset = self.state.selected_asset
        if asset is None or asset.kind != 'video':
            videos = [item for item in self.state.assets if item.kind == 'video']
            if videos:
                self.select_asset(videos[0].id)
                asset = self.state.selected_asset
            else:
                self.timeline_panel.set_crop_tool_active(False)
                self.statusBar().showMessage('Hãy chọn video trên timeline rồi bấm Crop', 3500)
                return None
        else:
            if asset is None:
                self.timeline_panel.set_crop_tool_active(False)
                return None
            from ui_qt.crop_preset import apply_capcut_crop_preset
            already_on = bool(self.state.values.get('crop_enabled'))
            apply_capcut_crop_preset(self.state, reset_rect=not already_on)
            self.control_board.sync_video_transform_controls()
            self.timeline_panel.set_crop_tool_active(True)
            self.preview_panel.frame_canvas.enter_crop_mode()
            self.preview_panel.refresh_settings()
            self._push_history()
            self._schedule_autosave()
            self.statusBar().showMessage('Crop: kéo khung vàng trên preview — bấm Crop lại để xong', 4000)

    def _on_timeline_clips_changed(self) -> None:
        self._timeline_clips_cache = None
        self._timeline_clips_token = None
        pos = int(getattr(self.timeline_panel.canvas, 'position_ms', 0) or 0)
        self._sync_active_clip_transform_at_timeline(pos, apply_ui=True, reload_inspector=False, force=True)
        self.timeline_panel.canvas._sync_track_overlays()
        self.timeline_panel.canvas.invalidate_layout_cache()
        self.timeline_panel.canvas.update()
        self.control_board.refresh_media_overlay_list()
        self.preview_panel.refresh_settings()
        self._sync_history_baseline()
        self._schedule_autosave()
        n = len(self.state.values.get('timeline_clips') or [])
        self.statusBar().showMessage(f'Timeline: {n} clip video', 2500)

    def _on_timeline_clip_selected(self, clip_id: str) -> None:
        from core.timeline_clips import apply_clip_transform_to_values, clips_from_values, find_clip, persist_values_transform_to_selected_clip, set_selected_clip_id
        persist_values_transform_to_selected_clip(self.state.values)
        self._timeline_clips_cache = None
        set_selected_clip_id(self.state.values, clip_id)
        clip = find_clip(clips_from_values(self.state.values), clip_id)
        if clip is not None:
            apply_clip_transform_to_values(self.state.values, clip)
        self.preview_panel.refresh_clip_transform_only()
        self.timeline_panel.canvas.invalidate_layout_cache()
        self.timeline_panel.canvas.update()
        self._schedule_clip_inspector_sync()
        self._activate_module('media', focus_node='image_adjustments')
        self.preview_panel.frame_canvas.set_preview_selection('video')
        self.statusBar().showMessage('Inspector → Hình — clip đang chọn (phóng / vị trí)', 2500)

    def _sync_active_clip_transform_at_timeline(self, timeline_ms: int, *, apply_ui: bool, reload_inspector: bool, force: bool) -> bool:
        from core.timeline_clips import apply_clip_transform_to_values, clip_at_timeline, clips_from_values, persist_values_transform_to_selected_clip, selected_clip_id, set_selected_clip_id, transform_from_values
        clips = self._timeline_clips_cached()
        if not clips:
            clips = clips_from_values(self.state.values)
        if len(clips) <= 1:
            pass
        else:
            hit = clip_at_timeline(clips, int(timeline_ms), track_index=None)
            if hit is None:
                pass
            else:
                clip, _src = (hit[0], hit[1])
                prev_id = selected_clip_id(self.state.values)
                same = clip.id == prev_id
                if not same or force:
                    playing = bool(getattr(self.preview_panel.playback, 'is_playing', False))
                    values = self.state.values
                    from core.timeline_clips import find_clip as _find_clip
                    prev = _find_clip(clips_from_values(values), prev_id)
                    cur = transform_from_values(values)
                    prev_t = {'scale_percent': int(prev.scale_percent), 'scale_x_percent': int(prev.scale_x_percent), 'scale_y_percent': int(prev.scale_y_percent), 'offset_x': int(prev.offset_x), 'offset_y': int(prev.offset_y)}
                    if not same and prev_id and (prev is not None) and (cur != prev_t):
                        persist_values_transform_to_selected_clip(values)
                        self._timeline_clips_cache = None
                        self._timeline_clips_token = None
                    set_selected_clip_id(values, clip.id)
                    before = transform_from_values(values)
                    apply_clip_transform_to_values(values, clip)
                    after = transform_from_values(values)
                    visual_changed = before != after or force
                    if apply_ui and visual_changed and (not playing):
                        self.preview_panel.refresh_clip_transform_only()
                        if hasattr(self.timeline_panel, 'canvas'):
                            self.timeline_panel.canvas.update()
                    if apply_ui and (not playing) and (reload_inspector or visual_changed):
                        self._schedule_clip_inspector_sync()
                    return True
        return False

    def _schedule_clip_inspector_sync(self) -> None:
        timer = getattr(self, '_clip_inspector_timer', None)
        if timer is None:
            from PySide6.QtCore import QTimer
            timer = QTimer(self)
            timer.setSingleShot(True)
            timer.setInterval(280)
            timer.timeout.connect(self._flush_clip_inspector_sync)
            self._clip_inspector_timer = timer
        timer.start()

    def _flush_clip_inspector_sync(self) -> None:
        if bool(getattr(self.preview_panel.playback, 'is_playing', False)):
            pass
        else:
            sync = getattr(self.control_board, 'sync_video_transform_controls', None)
            if callable(sync):
                sync()
            else:
                for key in ('scale_percent', 'scale_x_percent', 'scale_y_percent', 'offset_x', 'offset_y', 'rotation_degrees'):
                    control = self.control_board.controls.get(key)
                    if control is None:
                        pass
                    else:
                        control.blockSignals(True)
                        try:
                            self.control_board._set_control_value(control, self.state.values.get(key))
                        finally:
                            control.blockSignals(False)

    def _on_timeline_trim_changed(self, start_ms: int, end_ms: int) -> None:
        self.state.values['trim_start_ms'] = int(start_ms)
        self.state.values['trim_end_ms'] = int(end_ms)
        asset = self.state.selected_asset
        if asset is not None and asset.kind == 'video':
            from core.timeline_clips import ensure_timeline_clips, sync_single_clip_from_trim
            clips = ensure_timeline_clips(self.state.values, source_duration_ms=max(1, int(asset.duration_ms or 1)), source_path=str(asset.path or ''))
            if len(clips) <= 1:
                sync_single_clip_from_trim(self.state.values, source_duration_ms=max(1, int(asset.duration_ms or 1)), source_path=str(asset.path or ''))
        self.control_board.reload_project(self.state)
        self.preview_panel.refresh_settings()
        self.timeline_panel.reload_project(self.state)
        self._sync_history_baseline()
        self._schedule_autosave()
        if end_ms:
            self.statusBar().showMessage(f'Đã cắt timeline: {_format_ms(start_ms)} → {_format_ms(end_ms)}', 2500)
            return None
        self.statusBar().showMessage('Đã xóa điểm cắt timeline', 2500)

    def _timeline_to_source_ms(self, timeline_ms: int) -> int:
        from core.timeline_clips import clip_at_timeline, timeline_duration_ms
        asset = self.state.selected_asset
        clips = self._timeline_clips_cached()
        hit = clip_at_timeline(clips, int(timeline_ms), track_index=None)
        if hit is not None:
            return int(hit[1])
        if asset is None or asset.kind != 'video':
            pass
        elif clips:
            tl = max(0, int(timeline_ms))
            span = timeline_duration_ms(clips)
            if tl >= span:
                coverage_out = max((c.source_out_ms for c in clips))
                return min(max(1, int(asset.duration_ms or 1)), coverage_out + (tl - span))
        return max(0, int(timeline_ms))

    def _timeline_clips_cached(self):
        from core.timeline_clips import clips_from_values
        raw = self.state.values.get('timeline_clips')
        token = id(raw) if isinstance(raw, list) else None
        if token is not None and token == self._timeline_clips_token and (self._timeline_clips_cache is not None):
            return self._timeline_clips_cache
        clips = clips_from_values(self.state.values)
        self._timeline_clips_cache = clips
        self._timeline_clips_token = token
        return clips

    def _apply_preview_clip_stretch(self, timeline_ms: int) -> None:
        del timeline_ms
        setter = getattr(self.preview_panel.playback, 'set_clip_stretch_rate', None)
        if callable(setter):
            setter(1.0)
            return None

    def _ensure_playback_source_for_timeline(self, timeline_ms: int, *, seek: bool) -> None:
        from core.timeline_clips import clip_at_timeline
        clips = self._timeline_clips_cached()
        if clips:
            hit = clip_at_timeline(clips, int(timeline_ms), track_index=None)
            if hit is None:
                pass
            else:
                clip, source_ms = (hit[0], hit[1])
                if clip.id == self._timeline_playback_clip_id:
                    pass
                else:
                    path = str(clip.source_path or '').strip()
                    if not path:
                        asset = self.state.selected_asset
                        path = str(asset.path or '') if asset is not None else ''
                    if path:
                        playback = self.preview_panel.playback
                        current = str(getattr(playback, '_source_path', '') or '') or self._timeline_playback_path
                        if current and (current == path or current.replace('\\', '/') == path.replace('\\', '/')):
                            self._timeline_playback_clip_id = clip.id
                            self._timeline_playback_path = path
                            self._apply_preview_clip_stretch(int(timeline_ms))
                        elif Path(path).is_file():
                            codec = ''
                            for asset in self.state.assets:
                                if asset.kind == 'video' and asset.path and (asset.path == path or asset.path.replace('\\', '/') == path.replace('\\', '/')):
                                    codec = str(asset.video_codec or '')
                            was_playing = bool(getattr(playback, 'is_playing', False))
                            load = getattr(playback, 'load', None)
                            if callable(load):
                                try:
                                    load(path, codec, start_ms=int(source_ms))
                                except TypeError:
                                    load(path, codec)
                                    if seek:
                                        self._arm_seek_guard(int(source_ms))
                                        self.preview_panel.seek_to(int(source_ms))
                                else:
                                    if seek:
                                        self._arm_seek_guard(int(source_ms))
                                        self.preview_panel.scrub_to(int(source_ms))
                            self._timeline_playback_path = path
                            self._timeline_playback_clip_id = clip.id
                            self._apply_preview_clip_stretch(int(timeline_ms))
                            if was_playing:
                                playback.play()

    def _arm_seek_guard(self, source_ms: int) -> None:
        import time as _time
        self._seek_guard_source_ms = max(0, int(source_ms))
        self._seek_guard_until_mono = _time.monotonic() + 2.0

    def _position_passes_seek_guard(self, position_ms: int) -> bool:
        import time as _time
        target = self._seek_guard_source_ms
        if target is None:
            return True
        now = _time.monotonic()
        if now > float(self._seek_guard_until_mono or 0.0):
            self._seek_guard_source_ms = None
            return True
        pos = max(0, int(position_ms))
        if abs(pos - target) <= 220:
            self._seek_guard_source_ms = None
            return True
        return False if pos + 80 < target else True

    def _source_to_timeline_ms(self, source_ms: int) -> tuple[int, int | None]:
        from core.timeline_clips import clips_are_single_source_contiguous, timeline_duration_ms, timeline_ms_from_source, timeline_ms_from_source_playthrough, timeline_ms_from_source_smooth
        clips = self._timeline_clips_cached()
        if clips:
            playback = self.preview_panel.playback
            current = str(getattr(playback, '_source_path', '') or '') or self._timeline_playback_path
            asset = self.state.selected_asset
            if not current and asset is not None:
                current = str(asset.path or '')
            cur_norm = current.replace('\\', '/')
            multi = False
            for clip in clips:
                p = str(clip.source_path or '').strip()
                if p and p.replace('\\', '/') != cur_norm and cur_norm:
                    multi = True
            use_clips = clips
            if multi and cur_norm:
                same = [c for c in clips if not str(c.source_path or '').strip() or str(c.source_path).replace('\\', '/') == cur_norm]
                if same:
                    use_clips = same
            has_video_trim = any((int(getattr(c, 'video_trim_head_ms', 0) or 0) or int(getattr(c, 'video_trim_tail_ms', 0) or 0) for c in use_clips))
            if clips_are_single_source_contiguous(use_clips):
                play_tl = timeline_ms_from_source_playthrough(use_clips, int(source_ms))
                return (int(play_tl), None) if play_tl is not None else (int(timeline_ms_from_source_smooth(use_clips, int(source_ms))), None)
            mapped = timeline_ms_from_source(use_clips, int(source_ms))
            if mapped is not None:
                return (int(mapped), None)
            src = max(0, int(source_ms))
            if has_video_trim:
                for clip in sorted(use_clips, key=lambda c: int(c.source_in_ms)):
                    play_in, _play_out = (clip.video_play_window_ms()[0], clip.video_play_window_ms()[1])
                    if src < play_in:
                        return (int(clip.timeline_start_ms), int(play_in))
                for clip in use_clips:
                    if clip.source_in_ms > src:
                        return (int(clip.timeline_start_ms), int(clip.source_in_ms))
                coverage_out = max((c.source_out_ms for c in use_clips))
                return (int(timeline_duration_ms(use_clips) + (src - coverage_out)), None) if src >= coverage_out else (int(timeline_ms_from_source_smooth(use_clips, src)), None)
        else:
            return (max(0, int(source_ms)), None)

    def _on_playback_position_for_timeline(self, position_ms: int) -> None:
        if getattr(self.preview_panel, '_timeline_scrub_active', False):
            pass
        elif self.preview_panel.position.isSliderDown():
            pass
        else:
            playing = bool(getattr(self.preview_panel.playback, 'is_playing', False))
            if playing:
                pending = int(getattr(self.preview_panel.playback, '_pending_position_ms', 0) or 0)
                if int(position_ms) < 500 and pending > 1500:
                    pass
                elif self._position_passes_seek_guard(int(position_ms)):
                    timeline_ms, seek_source = (self._source_to_timeline_ms(int(position_ms))[0], self._source_to_timeline_ms(int(position_ms))[1])
                    target = max(0, int(timeline_ms))
                    if seek_source is not None:
                        guard = self._seek_guard_source_ms
                        already = guard is not None and abs(int(seek_source) - int(guard)) <= 400
                        if not already:
                            self._arm_seek_guard(int(seek_source))
                            seek_to = self.preview_panel.seek_to
                            try:
                                seek_to(int(seek_source), sync_mix=False)
                            except TypeError:
                                seek_to(int(seek_source))
                        self._timeline_pos_pending = target
                        try:
                            self.preview_panel.frame_canvas.set_position(target, repaint=False)
                        except Exception:
                            pass
                        if not self._timeline_pos_timer.isActive():
                            self._timeline_pos_timer.start()
                    else:
                        self._timeline_pos_pending = target
                        try:
                            self.preview_panel.frame_canvas.set_position(target, repaint=False)
                        except Exception:
                            pass
                        self.timeline_panel.canvas.set_playback_lite(True)
                        now = time.monotonic()
                        last_sync = float(getattr(self, '_timeline_sync_at', 0.0) or 0.0)
                        if now - last_sync >= 0.28:
                            self._timeline_sync_at = now
                            self._sync_active_clip_transform_at_timeline(target, apply_ui=True, reload_inspector=False)
                            self._ensure_playback_source_for_timeline(target)
                        if self._timeline_pos_timer.isActive():
                            pass
                        else:
                            self._timeline_pos_timer.start()
                else:
                    pending_tl = int(getattr(self, '_timeline_pos_pending', 0) or 0)
                    if pending_tl > 0:
                        try:
                            self.preview_panel.frame_canvas.set_position(pending_tl, repaint=False)
                        except Exception:
                            return None

    def _flush_timeline_position(self) -> None:
        if getattr(self.preview_panel, '_timeline_scrub_active', False):
            return None
        if not bool(getattr(self.preview_panel.playback, 'is_playing', False)) and self._timeline_anchor_ms is not None:
            return None
        self.timeline_panel.set_position(self._timeline_pos_pending, repaint=True, follow_playhead=True)

    def _on_playback_playing_changed_for_clips(self, playing: bool) -> None:
        if playing:
            try:
                self.preview_panel._timeline_scrub_active = False
            except Exception:
                pass
            canvas = self.timeline_panel.canvas
            canvas._scrubbing = False
            canvas._drag_lite = False
            canvas._scrub_need_cache = False
        self.timeline_panel.canvas.set_playback_lite(bool(playing))
        if playing:
            self._timeline_anchor_ms = None
            pos = int(getattr(self.timeline_panel, 'position_ms', 0) or 0)
            if hasattr(self.timeline_panel, 'canvas'):
                pos = int(self.timeline_panel.canvas.position_ms)
            self._apply_preview_clip_stretch(pos)
        else:
            pos = int(getattr(self.timeline_panel, 'position_ms', 0) or 0)
            if hasattr(self.timeline_panel, 'canvas'):
                pos = int(self.timeline_panel.canvas.position_ms)
            self._timeline_anchor_ms = pos
            self._sync_active_clip_transform_at_timeline(pos, apply_ui=True, reload_inspector=False, force=True)
            self.timeline_panel.canvas.update()

    def _on_timeline_scrubbed(self, position_ms: int) -> None:
        pos = int(position_ms)
        self._timeline_anchor_ms = pos
        timer = getattr(self, '_timeline_pos_timer', None)
        if timer is not None and timer.isActive():
            timer.stop()
        self._timeline_pos_pending = pos
        source_ms = self._timeline_to_source_ms(pos)
        self._arm_seek_guard(source_ms)
        self.preview_panel.scrub_to(source_ms)

    def _on_timeline_scrub_finished(self, position_ms: int) -> None:
        pos = int(position_ms)
        self._timeline_anchor_ms = pos
        timer = getattr(self, '_timeline_pos_timer', None)
        if timer is not None and timer.isActive():
            timer.stop()
        self._timeline_pos_pending = pos
        self._sync_active_clip_transform_at_timeline(pos, apply_ui=True, reload_inspector=False, force=True)
        self._ensure_playback_source_for_timeline(pos, seek=False)
        source_ms = self._timeline_to_source_ms(pos)
        self._arm_seek_guard(source_ms)
        self.preview_panel.finish_scrub(source_ms)
        self.timeline_panel.set_position(pos, repaint=True)
        self._schedule_clip_inspector_sync()

    def _on_preview_slider_scrubbed(self, source_ms: int) -> None:
        timeline_ms, _ = (self._source_to_timeline_ms(int(source_ms))[0], self._source_to_timeline_ms(int(source_ms))[1])
        pos = max(0, int(timeline_ms))
        self._timeline_anchor_ms = pos
        timer = getattr(self, '_timeline_pos_timer', None)
        if timer is not None and timer.isActive():
            timer.stop()
        self._timeline_pos_pending = pos
        self._arm_seek_guard(int(source_ms))
        canvas = self.timeline_panel.canvas
        was_dragging = bool(canvas._drag_lite)
        canvas._drag_lite = True
        arm = getattr(canvas, '_arm_scrub_body_cache', None)
        if not was_dragging and callable(arm):
            arm(rebuild_now=False)
        self.timeline_panel.set_position(pos, repaint=True)

    def _on_preview_slider_scrub_finished(self, source_ms: int) -> None:
        timeline_ms, _ = (self._source_to_timeline_ms(int(source_ms))[0], self._source_to_timeline_ms(int(source_ms))[1])
        pos = max(0, int(timeline_ms))
        self._timeline_anchor_ms = pos
        self._sync_active_clip_transform_at_timeline(pos, apply_ui=True, reload_inspector=False, force=True)
        self._ensure_playback_source_for_timeline(pos)
        self._arm_seek_guard(int(source_ms))
        canvas = self.timeline_panel.canvas
        canvas._drag_lite = False
        canvas._scrub_need_cache = False
        if canvas._playback_lite:
            canvas.set_playback_lite(False)
        canvas._invalidate_playback_body_cache()
        self.timeline_panel.set_position(pos, repaint=True)
        self._schedule_clip_inspector_sync()

    def _refresh_history_actions(self) -> None:
        can_undo = len(self.history) > 0
        can_redo = self.history.redo_len() > 0
        self.actions['undo'].setEnabled(can_undo)
        self.actions['redo'].setEnabled(can_redo)
        self.timeline_panel.set_history_availability(can_undo, can_redo)

    def _on_timeline_layer_timing_changed(self) -> None:
        self.control_board.reload_project(self.state)
        self.control_board.sync_effect_overlay_controls()
        self.control_board.sync_blend_layer_controls()
        if hasattr(self.control_board, 'sync_background_layer_controls'):
            self.control_board.sync_background_layer_controls()
        self.preview_panel.refresh_settings()
        self.timeline_panel.reload_project(self.state)
        self._sync_history_baseline()
        self._schedule_autosave()

    def _refresh_timeline_layer_rows(self) -> None:
        canvas = self.timeline_panel.canvas
        canvas.invalidate_layout_cache()
        canvas._refresh_canvas_height()
        self.timeline_panel._sync_canvas_scroll_size()
        canvas.update()

    def _layer_structure_fingerprint(self) -> tuple:
        values = self.state.values
        return (len(values.get('media_overlays') or ()), len(values.get('blend_layers') or ()), len(values.get('background_layers') or ()), len(values.get('text_overlays') or ()), bool(values.get('logo_enabled')), bool(values.get('media_overlays_master_enabled', True)), bool(values.get('blend_layers_master_enabled', True)), bool(values.get('background_layers_master_enabled', True)))

    def _schedule_timeline_layer_rows_refresh(self) -> None:
        fp = self._layer_structure_fingerprint()
        if fp == getattr(self, '_timeline_layer_structure_fp', None):
            return None
        self._timeline_layer_structure_fp = fp
        self._refresh_timeline_layer_rows()

    def _on_settings_changed(self) -> None:
        if self.history.restoring:
            return None
        self._schedule_clip_transform_persist()
        self._history_push_timer.start()
        self._sync_batch_prep_flag_widgets()

    def _schedule_preview_settings_refresh(self) -> None:
        timer = getattr(self, '_preview_settings_timer', None)
        if timer is None:
            from PySide6.QtCore import QTimer
            timer = QTimer(self)
            timer.setSingleShot(True)
            timer.setInterval(80)
            timer.timeout.connect(self._flush_preview_settings_refresh)
            self._preview_settings_timer = timer
        timer.start()

    def _flush_preview_settings_refresh(self) -> None:
        if bool(getattr(self.preview_panel.playback, 'is_playing', False)):
            self.preview_panel.refresh_clip_transform_only()
            return None
        self.preview_panel.refresh_settings()

    def _schedule_clip_transform_persist(self) -> None:
        raw = self.state.values.get('timeline_clips')
        if not isinstance(raw, list) or len(raw) <= 1:
            return None
        timer = getattr(self, '_clip_transform_persist_timer', None)
        if timer is None:
            from PySide6.QtCore import QTimer
            timer = QTimer(self)
            timer.setSingleShot(True)
            timer.setInterval(200)
            timer.timeout.connect(self._flush_clip_transform_persist)
            self._clip_transform_persist_timer = timer
        timer.start()

    def _flush_clip_transform_persist(self) -> None:
        from core.timeline_clips import persist_values_transform_to_selected_clip
        raw = self.state.values.get('timeline_clips')
        if not isinstance(raw, list) or len(raw) <= 1:
            return None
        persist_values_transform_to_selected_clip(self.state.values)
        self._timeline_clips_cache = None

    def _on_sfx_changed(self) -> None:
        self._sync_history_baseline()
        self.control_board.sync_sfx_controls()
        self._persist_current_sfx()
        apply_mix = getattr(self.preview_panel, '_apply_mix_audio_to_playback', None)
        if callable(apply_mix):
            apply_mix()
        self._schedule_autosave()
        self.statusBar().showMessage(f'SFX: {len(self.state.sfx_events)} hiệu ứng âm thanh', 2500)

    def _on_inspector_sfx_remove_selected(self) -> None:
        index = self.control_board.selected_sfx_index()
        if index < 0 or index >= len(self.state.sfx_events):
            self.statusBar().showMessage('Chưa chọn SFX để xóa', 2500)
            return None
        self._push_history()
        del self.state.sfx_events[index]
        self.timeline_panel.canvas._selected_sfx_index = None
        self.timeline_panel.canvas._persist_sfx()
        self.timeline_panel.canvas.update()
        self._on_sfx_changed()

    def _on_inspector_sfx_preset_add(self, path: str, label: str) -> None:
        path = str(path or '').strip()
        if path:
            at = max(0.0, float(self.timeline_panel.canvas.position_ms) / 1000.0)
            self.timeline_panel.canvas.add_sfx_event(at, path, str(label or Path(path).stem))
            self.statusBar().showMessage(f'Đã gắn preset SFX «{label}» tại playhead', 3000)
        else:
            self.statusBar().showMessage('Chưa có preset — thả file vào assets/sfx rồi bấm Thư mục preset', 4000)
            return None

    def _on_open_sfx_presets_folder(self) -> None:
        folder = Path(__file__).resolve().parents[1] / 'assets' / 'sfx'
        folder.mkdir(parents=True, exist_ok=True)
        QDesktopServices.openUrl(QUrl.fromLocalFile(str(folder)))
        self.control_board.reload_sfx_presets()
        self.statusBar().showMessage(f'Thả .mp3/.wav vào {folder} — rồi Gắn preset', 4500)

    def _schedule_autosave(self) -> None:
        if self._suppress_autosave:
            return None
        self._autosave_timer.start()

    def _flush_autosave(self) -> None:
        if not self._suppress_autosave and session_has_work(self.state):
            try:
                self.state.snapshot_asset_settings()
                self._persist_current_sfx()
                save_session(self.state)
                if self._project_path:
                    save_project(self.state, self._project_path)
                else:
                    return None
            except Exception as exc:
                self._log_event('Autosave thất bại', str(exc))

    def _restore_session_on_startup(self) -> None:
        restored = restore_startup_state()
        if session_has_work(restored):
            self._suppress_autosave = True
            try:
                self.state = restored
                self._apply_loaded_project(status_message='Đã khôi phục dự án lần trước — cấu hình vẫn giữ nguyên')
            finally:
                self._suppress_autosave = False

    def _apply_loaded_project(self, status_message: str, *, keep_pipeline: bool) -> None:
        healed = self._sanitize_project_timelines()
        self.preview_panel.playback.stop()
        if not keep_pipeline:
            self._clear_dub_pipeline()
            self._pipeline_asset_id = None
        self._load_sfx_for_selected_video()
        self.history.clear()
        self._history_baseline = capture_snapshot(self.state)
        self._refresh_history_actions()
        self._refresh_project_asset_lists()
        self.preview_panel.reload_project(self.state)
        self.timeline_panel.reload_project(self.state)
        self.control_board.reload_project(self.state)
        selected = self.state.selected_asset
        if selected is not None:
            self.project_panel.set_selected_asset(selected.id)
            self.preview_panel.set_selected_asset(selected)
            self.timeline_panel.set_selected_asset(selected.id)
            self.control_board.set_context(selected.kind)
        self._refresh_credential_mask()
        self._refresh_export_ui()
        self._refresh_project_browser()
        if healed > 0:
            status_message = f'{status_message} · Đã gộp {healed} clip lẻ do tách cảnh quá mảnh'
        self.statusBar().showMessage(status_message)
        self._sync_summary_dialog_project()
        self._refresh_preview_preset_bar()
        if not keep_pipeline:
            QTimer.singleShot(400, self._offer_resume_batch_job)
        QTimer.singleShot(600, self._update_batch_control_ui)

    def _sanitize_project_timelines(self) -> int:
        from core.timeline_clips import sanitize_excessive_timeline_clips
        healed = 0
        video = self._selected_video_asset()
        path = str(getattr(video, 'path', '') or '') if video else ''
        dur = int(getattr(video, 'duration_ms', 0) or 0) if video else 0
        healed += sanitize_excessive_timeline_clips(self.state.values, source_duration_ms=dur, source_path=path)
        for asset_id, bag in list((self.state.asset_settings or {}).items()):
            if isinstance(bag, dict):
                asset = next((a for a in self.state.assets if a.id == asset_id), None)
                a_path = str(getattr(asset, 'path', '') or '') if asset else ''
                a_dur = int(getattr(asset, 'duration_ms', 0) or 0) if asset else 0
                healed += sanitize_excessive_timeline_clips(bag, source_duration_ms=a_dur, source_path=a_path)
        return healed

    def _batch_workbench(self):
        return self.module_workbenches.get('batch')

    def _batch_on_error_mode(self) -> str:
        workbench = self._batch_workbench()
        return workbench.batch_on_error_mode() if workbench is not None else 'skip'

    def _batch_parallel_workers(self) -> int:
        workbench = self._batch_workbench()
        requested = 0
        if workbench is not None:
            requested = workbench.batch_parallel_workers_requested()
        from ui_qt.batch_parallel import resolve_batch_parallel_workers
        return resolve_batch_parallel_workers(requested, encoder_backend='cpu')

    def _can_persist_batch_job(self) -> bool:
        return bool(self._project_path)

    def _project_path_for_batch_job(self) -> str:
        return str(Path(self._project_path).expanduser().resolve()) if self._project_path else ''

    def _persist_batch_job(self) -> None:
        if self._active_batch_job is not None and self._can_persist_batch_job():
            self._active_batch_job.project_path = self._project_path_for_batch_job()
            save_batch_job(self._active_batch_job)
        else:
            return None

    def _clear_batch_job_file(self) -> None:
        if self._project_path:
            clear_batch_job(self._project_path)
        self._active_batch_job = None

    def _sync_produce_batch_job_state(self) -> None:
        if self._active_batch_job is None:
            return None
        self._active_batch_job.pending_asset_ids = list(self._batch_produce_export_ids)
        self._active_batch_job.queue_index = self._batch_produce_export_queue_index
        self._active_batch_job.used_output_paths = sorted(self._batch_produce_export_used_paths)
        self._persist_batch_job()

    def _sync_dub_batch_job_state(self) -> None:
        if self._active_batch_job is None:
            return None
        self._active_batch_job.pending_asset_ids = list(self._batch_dub_asset_ids)
        self._persist_batch_job()

    def _offer_resume_batch_job(self) -> None:
        if not self._has_background_job() and self._project_path:
            job = load_batch_job(self._project_path)
            if job is None:
                return None
            resolved = self._project_path_for_batch_job()
            if job.project_path and job.project_path != resolved:
                return None
            choice = self._prompt_batch_resume_choice(job)
            if choice == 'continue':
                self._resume_batch_job(job)
                return None
            if choice == 'discard':
                clear_batch_job(self._project_path)
                self._update_batch_control_ui()
                return None
        else:
            return None

    def _prompt_batch_resume_choice(self, job: BatchJobRecord) -> str:
        box = QMessageBox(self)
        box.setIcon(QMessageBox.Icon.Question)
        box.setWindowTitle('Batch chưa hoàn tất')
        box.setText('Có batch xuất hàng loạt chưa chạy hết (tắt app giữa chừng hoặc mở project trên máy khác).')
        box.setInformativeText(summarize_batch_job(job))
        btn_continue = box.addButton('Tiếp tục batch', QMessageBox.ButtonRole.AcceptRole)
        btn_discard = box.addButton('Bỏ resume', QMessageBox.ButtonRole.DestructiveRole)
        btn_view = box.addButton('Chỉ xem', QMessageBox.ButtonRole.RejectRole)
        box.setDefaultButton(btn_view)
        box.exec()
        clicked = box.clickedButton()
        return 'continue' if clicked is btn_continue else 'discard' if clicked is btn_discard else 'view_only'

    def _resume_batch_job(self, job: BatchJobRecord) -> None:
        if self._has_background_job():
            return None
        self._active_batch_job = job
        if job.job_type == 'produce_export':
            self._resume_batch_produce_export(job)
            return None
        if job.job_type == 'dub_pipeline':
            self._resume_batch_dub_pipeline(job)
            return None
        self._report_error('Chưa hỗ trợ resume loại batch này', 'Hãy chạy lại xuất hàng loạt từ module Xuất.')
        self._clear_batch_job_file()

    def _resume_batch_dub_pipeline(self, job: BatchJobRecord) -> None:
        pending = job.resume_pending_ids()
        if pending:
            err = self._validate_dub_prerequisites()
            if err:
                self._report_error('Chưa thể tiếp tục batch', err)
                return None
            self._prepare_dub_defaults()
            self._batch_dub_total = job.total
            self._batch_dub_completed = job.completed_count
            self._batch_dub_asset_ids = pending
            self._batch_dub_active = True
            self._log_event('Tiếp tục mạch hàng loạt', summarize_batch_job(job))
            self.statusBar().showMessage(f'Tiếp tục mạch: {job.completed_count}/{job.total} đã xong…')
            self._start_next_batch_dub_asset()
        else:
            self._clear_batch_job_file()
            return None

    def _resume_batch_produce_export(self, job: BatchJobRecord) -> None:
        pending = job.resume_pending_ids()
        if not pending or not job.export_folder:
            self._clear_batch_job_file()
            return None
        if Path(job.export_folder).is_dir():
            err = self._validate_dub_prerequisites()
            if err:
                self._report_error('Chưa thể tiếp tục xuất hàng loạt', err)
                return None
            self._prepare_dub_defaults()
            pending, extra_skipped = (self._split_batch_assets_by_existing_exports(job.export_folder, pending)[0], self._split_batch_assets_by_existing_exports(job.export_folder, pending)[1])
            for asset_id in extra_skipped:
                job.mark_completed(asset_id)
            if extra_skipped:
                self._log_event('Bỏ qua clip đã có file xuất', f'{len(extra_skipped)} video khi resume')
            if pending:
                self._batch_produce_export_active = True
                self._batch_produce_export_folder = job.export_folder
                self._batch_produce_export_ids = pending
                self._batch_produce_export_total = job.total
                self._batch_produce_export_completed = job.completed_count
                self._batch_produce_export_queue_index = job.queue_index
                self._batch_produce_export_used_paths = set(job.used_output_paths)
                self._batch_export_force_cpu = False
                self._logged_nvenc_slot_cap = False
                self._batch_parallel_warmup_done = False
                self._logged_parallel_warmup = False
                self.export_progress.setValue(0)
                self.export_progress.setFormat('Xuất hàng loạt %p%')
                self.export_progress.show()
                title = f'Tiếp tục xuất hàng loạt — {job.total} video'
                self.export_panel.begin(title)
                self._refresh_export_ui()
                self._log_event('Tiếp tục xuất hàng loạt', summarize_batch_job(job))
                self.statusBar().showMessage(f'Tiếp tục xuất: {job.completed_count}/{job.total} đã xong…')
                self._start_next_batch_produce_export()
            else:
                self._clear_batch_job_file()
                self.statusBar().showMessage('Batch đã xong — tất cả clip còn lại đều có file xuất')
                return None
        else:
            self._report_error('Không tiếp tục được batch', f'Thư mục xuất không còn: {job.export_folder}')
            return None

    def _has_resumable_batch_job(self) -> bool:
        return load_batch_job(self._project_path) is not None if self._project_path else False

    def _is_batch_pipeline_active(self) -> bool:
        return self._batch_produce_export_active or self._batch_dub_active or self.batch_task is not None

    def _clear_produce_export_tasks(self, *, cancel: bool) -> None:
        if cancel:
            for task in self._produce_export_tasks.values():
                if hasattr(task, 'cancel'):
                    task.cancel()
        self._produce_export_tasks.clear()
        self._produce_export_plan_queue.clear()
        self._produce_export_progress.clear()

    def _cancel_running_worker_tasks(self) -> bool:
        cancelled = False
        if self._produce_export_tasks:
            self._clear_produce_export_tasks(cancel=True)
            cancelled = True
        for task in (self.export_task, self.batch_task, self.subtitle_task, self.tts_task, self.tts_preview_task, self.capcut_task, self.auto_blur_task, self.face_reframe_task, self.hardsub_task):
            if task is not None and hasattr(task, 'cancel'):
                task.cancel()
                cancelled = True
        return cancelled

    def _requeue_current_batch_asset(self) -> None:
        current = self._pipeline_asset_id
        if not current:
            return None
        if self._batch_produce_export_active:
            if current not in self._batch_produce_export_ids:
                self._batch_produce_export_ids.insert(0, current)
            self._sync_produce_batch_job_state()
            return None
        if self._batch_dub_active:
            if current not in self._batch_dub_asset_ids:
                self._batch_dub_asset_ids.insert(0, current)
            self._sync_dub_batch_job_state()
            return None

    def _finalize_batch_pause(self) -> None:
        self._batch_pause_requested = False
        self._batch_user_paused = True
        self._pipeline_asset_id = None
        self._clear_dub_pipeline()
        self._batch_produce_export_dub_phase = False
        self._clear_produce_export_tasks(cancel=True)
        self.export_task = None
        self.subtitle_task = None
        self.tts_task = None
        self.capcut_task = None
        if self._active_batch_job is not None:
            self._active_batch_job.status = 'paused'
            self._persist_batch_job()
        self.export_panel.set_paused('Batch tạm dừng')
        self.control_board.set_subtitle_busy(False)
        self._set_export_resource_mode(False)
        self.statusBar().showMessage('Batch tạm dừng — bấm Tiếp tục để chạy clip tiếp theo')
        self._update_batch_control_ui()

    def _dub_pipeline_start_blocked(self) -> bool:
        return self._has_exclusive_job() if self._batch_produce_export_active or self._batch_dub_active else self._has_background_job()

    def _batch_template_asset_id(self) -> str | None:
        asset = self.state.selected_asset
        if asset is not None and asset.kind == 'video':
            return asset.id
        selected = str(self.state.selected_id or '')
        if selected and selected in self.state.asset_settings:
            return selected
        for item in self.state.assets:
            if item.kind == 'video' and item.id in self.state.asset_settings:
                return item.id
        return selected or None

    def _should_auto_apply_batch_template(self) -> bool:
        workbench = self.module_workbenches.get('batch')
        return True if workbench is None else workbench.batch_auto_apply_template()

    def _apply_batch_template(self, *, target_asset_ids: list[str] | None, template_asset_id: str | None) -> int:
        from ui_qt.asset_export import apply_export_template_to_videos, apply_template_values_to_assets, template_settings_from_values

        def _progress(done: int, total: int) -> None:
            if total <= 1:
                return None
            if done == 1 or done == total or done % 3 == 0:
                self.statusBar().showMessage(f'Áp mẫu edit {done}/{total}…', 4000)
                QApplication.processEvents()
                return None
        template_id = template_asset_id or self._batch_template_asset_id()
        if template_id:
            if target_asset_ids is None or self.state.selected_id in target_asset_ids:
                selected_id = str(self.state.selected_id or '')
                if selected_id == str(template_id):
                    self.state.snapshot_asset_settings(template_id)
                template = template_settings_from_values(self.state.values)
                targets = list(target_asset_ids) if target_asset_ids else [asset.id for asset in self.state.assets if asset.kind == 'video' and asset.id != template_id]
                count = 0
                total = len(targets)
                for idx, aid in enumerate(targets, start=1):
                    count += apply_template_values_to_assets(self.state, copy.deepcopy(template), [aid], subtitle_workspace=self.subtitle_workspace, project_key=self._subtitle_project_key())
                    _progress(idx, total)
                return count
        else:
            targets = [asset.id for asset in self.state.assets if asset.kind == 'video']
            if target_asset_ids is not None:
                wanted = set(target_asset_ids)
                targets = [aid for aid in targets if aid in wanted]
            if len(targets) <= 1:
                return apply_export_template_to_videos(self.state, subtitle_workspace=self.subtitle_workspace, project_key=self._subtitle_project_key())
            template = template_settings_from_values(self.state.values)
            count = 0
            total = len(targets)
            for idx, aid in enumerate(targets, start=1):
                count += apply_template_values_to_assets(self.state, copy.deepcopy(template), [aid], subtitle_workspace=self.subtitle_workspace, project_key=self._subtitle_project_key())
                _progress(idx, total)
            return count

    def _max_produce_export_slots(self) -> int:
        slots = self._batch_parallel_workers()
        self._batch_nvenc_slot_cap = None
        if self._batch_one_video_at_a_time():
            if slots <= 1:
                self._batch_export_force_cpu = False
                return 1
            workbench = self._batch_workbench()
            one = workbench.controls.get('batch_one_video_at_a_time') if workbench is not None else None
            if hasattr(one, 'setChecked'):
                one.setChecked(False)
            self._log_event('Xuất hàng loạt — bỏ «Một video / lượt»', f'Đang chọn {slots} luồng ffmpeg — chạy song song thật')
        else:
            backend = str(self.state.values.get('encoder_backend', 'cpu') or 'cpu').lower()
            self._batch_export_force_cpu = False
            if backend in frozenset({'auto', 'nvenc'}):
                try:
                    from longtieng.longtieng_merge import _detect_vram_gb, _stretch_parallelism
                    vram = float(_detect_vram_gb() or 0.0)
                    gpu_cap = int(_stretch_parallelism('nvenc', slots, vram))
                    if vram >= 3.5:
                        gpu_cap = max(gpu_cap, min(2, slots))
                    self._batch_nvenc_slot_cap = int(gpu_cap)
                    if gpu_cap < slots and (not getattr(self, '_logged_nvenc_slot_cap', False)):
                        self._logged_nvenc_slot_cap = True
                        self._log_event('Xuất hàng loạt — NVENC + CPU lai', f'VRAM ~{vram:.0f}GB: {gpu_cap} job đầu dùng NVENC, job thứ {gpu_cap + 1}+ dùng CPU — giữ đủ {slots} luồng (không ép cả batch sang CPU).')
                except Exception:
                    self._batch_nvenc_slot_cap = 2
            busy_side_job = self._batch_produce_export_dub_phase or self._dub_pipeline_active or self._batch_dub_active or (self.video_stem_task is not None) or (self.tts_task is not None)
            if busy_side_job:
                try:
                    from core.demucs_config import get_batch_parallel_under_job
                    slots = min(slots, get_batch_parallel_under_job())
                except Exception:
                    slots = min(slots, 2)
            return max(1, int(slots))

    def _has_dub_lock_job(self) -> bool:
        heavy_subtitle = self.subtitle_task is not None and str(getattr(self, '_subtitle_task_kind', '') or '') != 'translate'
        return heavy_subtitle or self.tts_task is not None or self.tts_preview_task is not None or (self.capcut_task is not None) or (self.hardsub_task is not None)

    def _batch_queue_needs_dub(self) -> bool:
        for asset_id in self._batch_produce_export_ids:
            asset = next((a for a in self.state.assets if a.id == asset_id), None)
            if asset is not None and asset_needs_dub_pipeline(asset, self.state, subtitle_workspace=self.subtitle_workspace, project_key=self._subtitle_project_key()):
                return True
        return False

    def _can_start_dub_worker(self) -> bool:
        return False if self._has_exclusive_job() else True if self._batch_produce_export_active else self.export_task is None and (not self._produce_export_tasks)

    def _resolve_provider_api_keys(self, provider_id: str, entered: str='') -> str:
        stored = self.credential_store.get(provider_id)
        keys = merge_api_key_pools(entered, stored)
        return '|'.join(keys)

    def _show_api_blocked_dialog(self, title: str, detail: str) -> None:
        if self.isVisible():
            box = QMessageBox(self)
            box.setIcon(QMessageBox.Icon.Warning)
            box.setWindowTitle('API bị chặn hoặc giới hạn')
            box.setText(title)
            box.setInformativeText(detail)
            box.setStandardButtons(QMessageBox.StandardButton.Ok)
            box.exec()
        else:
            self._report_error(title, detail)
            return None

    def _maybe_warn_api_blocked(self, message: str) -> None:
        lowered = message.lower()
        if any((token in lowered for token in ('429', 'quota', 'rate limit', '403', 'unauthorized', 'blocked', 'exceeded', 'insufficient', 'hết quota', 'giới hạn'))):
            self._show_api_blocked_dialog('API dịch/STT bị chặn hoặc hết quota', message)
        else:
            return None

    def pause_batch_job(self) -> None:
        if self._is_batch_pipeline_active():
            self._batch_pause_requested = True
            self._requeue_current_batch_asset()
            if self._active_batch_job is not None:
                self._active_batch_job.status = 'paused'
                self._persist_batch_job()
            if self._cancel_running_worker_tasks():
                return None
            self._finalize_batch_pause()
        else:
            self.statusBar().showMessage('Không có batch đang chạy để tạm dừng')
            return None

    def resume_batch_job(self) -> None:
        if self._batch_user_paused and self._is_batch_pipeline_active():
            self._batch_user_paused = False
            if self._active_batch_job is not None:
                self._active_batch_job.status = 'running'
                self._persist_batch_job()
            self.export_panel.begin(self.export_panel.title_label.text() or 'Tiếp tục batch')
            if self._batch_produce_export_active:
                self._start_next_batch_produce_export()
            elif self._batch_dub_active:
                self._start_next_batch_dub_asset()
            self._update_batch_control_ui()
            return None
        if self._project_path:
            job = load_batch_job(self._project_path)
            if job is None:
                self.statusBar().showMessage('Không có batch để tiếp tục')
                self._update_batch_control_ui()
                return None
            self._batch_user_paused = False
            self._resume_batch_job(job)
        else:
            self.statusBar().showMessage('Chưa có dự án — không resume batch được')
            return None

    def stop_batch_job(self) -> None:
        self._batch_pause_requested = False
        self._batch_user_paused = False
        self._cancel_running_worker_tasks()
        self._clear_batch_job_file()
        if self._batch_produce_export_active:
            self._batch_produce_export_ids = []
            self._finish_batch_produce_export(aborted=True, reason='Đã dừng theo yêu cầu')
            return None
        if self._batch_dub_active:
            self._batch_dub_asset_ids = []
            self._finish_batch_dub_pipeline(aborted=True, reason='Đã dừng theo yêu cầu')
            return None
        if self.batch_task is not None:
            self.batch_task = None
            self.export_panel.hide()
            self._refresh_export_ui()
            self.statusBar().showMessage('Đã dừng xuất hàng loạt')
            return None
        if self.export_task is not None:
            self.stop_export()
            return None
        self.export_panel.hide()
        self._update_batch_control_ui()
        self.statusBar().showMessage('Đã dừng batch')

    def _update_batch_control_ui(self) -> None:
        mode = 'paused' if self._batch_user_paused else 'running' if self._is_batch_pipeline_active() else 'resume_only' if self._has_resumable_batch_job() else 'idle'
        batch_bench = self.module_workbenches.get('batch')
        if batch_bench is not None:
            batch_bench.set_batch_control_mode(mode)
        if self.export_panel.isVisible():
            self.export_panel.set_batch_control_mode(mode)
            return None

    def _current_project_display_name(self) -> str:
        return read_project_name(self._project_path) if self._project_path else 'Dự án chưa lưu'

    def _project_output_folder(self) -> str:
        'Thư mục đầu ra riêng của dự án đang mở (rỗng nếu chưa lưu dự án).'
        if not self._project_path:
            return ''
        try:
            return str(project_output_dir(self._project_path))
        except OSError:
            return ''

    def _refresh_project_browser(self) -> None:
        self.project_panel.refresh_project_context(project_name=self._current_project_display_name(), recent_projects=list_recent_projects(), current_path=self._project_path or '')
        self._refresh_project_work_context()

    def _refresh_project_work_context(self) -> None:
        from ui_qt.user_prefs import is_ephemeral_export_dir
        folder = self._project_output_folder() or get_last_export_folder()
        if self._batch_produce_export_folder:
            folder = self._batch_produce_export_folder
        export_hint = ''
        asset = self.state.selected_asset
        if asset is not None and asset.kind == 'video' and asset.path:
            naming = 'stem_xuat'
            batch_wb = self.module_workbenches.get('batch')
            if batch_wb is not None:
                naming = batch_wb.batch_naming_mode()
            try:
                settings = self._attach_voice_duration(self._export_settings_for_asset(asset.id))
                export_hint = str(self._suggested_export_output_path(asset, settings, naming))
            except (OSError, ValueError, TypeError):
                export_hint = ''
        self.project_panel.refresh_work_context(project_path=self._project_path or '', export_folder=folder, export_hint=export_hint)
        batch_wb = self.module_workbenches.get('batch')
        if batch_wb is not None:
            current = str(batch_wb.export_folder() or '').strip()
            if self._batch_produce_export_folder:
                batch_wb.set_export_folder(self._batch_produce_export_folder)
            elif current:
                pass
            elif folder:
                if is_ephemeral_export_dir(folder):
                    pass
                else:
                    batch_wb.set_export_folder(folder)

    def _persist_current_project_before_switch(self) -> None:
        if not session_has_work(self.state):
            pass
        elif self._project_path:
            try:
                save_named_project(self.state, self._project_path, project_name=read_project_name(self._project_path))
            except OSError as exc:
                self._log_event('Lưu dự án trước khi chuyển thất bại', str(exc))
                return None
        else:
            name = default_new_project_name()
            path = allocate_project_path(name)
            try:
                saved = save_named_project(self.state, path, project_name=name)
                self._project_path = saved
            except OSError as exc:
                self._log_event('Tự lưu dự án hiện tại thất bại', str(exc))

    def create_new_project(self) -> None:
        if not self._has_exclusive_job() or self._is_export_pipeline_busy():
            keep_pipeline = self._pin_export_job_if_busy()
            self._persist_current_project_before_switch()
            preserved = dict(self.state.values)
            self.state = new_project_media_state(preserved)
            name = default_new_project_name()
            path = allocate_project_path(name)
            try:
                saved = save_named_project(self.state, path, project_name=name)
            except OSError as exc:
                self._report_error('Không tạo được dự án mới', str(exc))
            self._project_path = saved
            self._user_edit_asset_id = ''
            self._apply_loaded_project('Dự án mới — xuất lô vẫn chạy nền, thêm video để setup' if keep_pipeline else 'Dự án mới — bấm Thêm tệp để thêm video', keep_pipeline=keep_pipeline)
            self._schedule_autosave()
        else:
            self.statusBar().showMessage('Đang có tác vụ phụ đề/TTS — chờ xong rồi tạo dự án mới', 3500)

    def open_project_at(self, path: str) -> None:
        if not self._has_exclusive_job() or self._is_export_pipeline_busy():
            resolved = str(Path(path).expanduser().resolve())
            if self._project_path == resolved:
                pass
            else:
                keep_pipeline = self._pin_export_job_if_busy()
                self._persist_current_project_before_switch()
                try:
                    self._load_project(resolved, keep_pipeline=keep_pipeline)
                except (OSError, ValueError) as exc:
                    self._report_error('Không mở được dự án', str(exc))
        else:
            self.statusBar().showMessage('Đang có tác vụ phụ đề/TTS — chờ xong rồi mở dự án', 3500)

    def rename_current_project(self, new_name: str) -> None:
        cleaned = new_name.strip()
        if not cleaned:
            pass
        elif self._project_path:
            try:
                self._project_path = rename_project_file(self._project_path, cleaned)
                self._refresh_project_browser()
                self.statusBar().showMessage(f'Đã đổi tên dự án: {cleaned}', 2500)
                self._schedule_autosave()
            except (OSError, ValueError) as exc:
                self._report_error('Không đổi tên được dự án', str(exc))
        else:
            self.statusBar().showMessage('Lưu dự án trước khi đổi tên', 3000)

    def delete_project_at(self, path: str) -> None:
        if self._has_exclusive_job():
            self.statusBar().showMessage('Đang có tác vụ phụ đề/TTS — chờ xong rồi xóa dự án', 3500)
        else:
            resolved = str(Path(path).expanduser().resolve())
            project_name = read_project_name(resolved)
            answer = QMessageBox.question(self, 'Xóa dự án', f'Xóa dự án «{project_name}»?\n\nFile .vtp.json sẽ bị xóa khỏi máy. Thao tác này không hoàn tác.', QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No, QMessageBox.StandardButton.No)
            if answer != QMessageBox.StandardButton.Yes:
                pass
            else:
                is_current = (self._project_path or '') == resolved
                try:
                    delete_project_file(resolved)
                except (OSError, ValueError) as exc:
                    self._report_error('Không xóa được dự án', str(exc))
                if is_current:
                    preserved = dict(self.state.values)
                    self.state = new_project_media_state(preserved)
                    self._project_path = ''
                    self._apply_loaded_project('Đã xóa dự án — tạo mới hoặc thêm video')
                else:
                    self._refresh_project_browser()
                    self.statusBar().showMessage(f'Đã xóa dự án: {project_name}', 2500)

    def _push_history(self) -> None:
        if self.history.restoring:
            return None
        self.history.push(self._history_baseline)
        self._history_baseline = capture_snapshot(self.state)
        self._refresh_history_actions()

    def _sync_history_baseline(self) -> None:
        if self.history.restoring:
            return None
        self._history_baseline = capture_snapshot(self.state)

    def undo_last_change(self) -> None:
        assets_before = tuple((a.id for a in self.state.assets))
        selected_before = self.state.selected_id
        snapshot = self.history.undo(self.state)
        if snapshot is None:
            self.statusBar().showMessage('Chưa có thay đổi nào để hoàn tác', 3000)
            return None
        assets_changed = assets_before != tuple((a.id for a in self.state.assets))
        selection_changed = selected_before != self.state.selected_id
        self._apply_history_snapshot(assets_changed=assets_changed or selection_changed)
        remaining = len(self.history)
        redo_left = self.history.redo_len()
        if remaining:
            self.statusBar().showMessage(f'Đã hoàn tác — còn {remaining} bước Ctrl+Z, {redo_left} Ctrl+Shift+Z', 2500)
        else:
            self.statusBar().showMessage(f'Đã hoàn tác — có thể Làm lại ({redo_left} bước Ctrl+Shift+Z)', 2500)
        self._refresh_history_actions()

    def redo_last_change(self) -> None:
        assets_before = tuple((a.id for a in self.state.assets))
        selected_before = self.state.selected_id
        snapshot = self.history.redo(self.state)
        if snapshot is None:
            self.statusBar().showMessage('Chưa có bước nào để làm lại (Ctrl+Shift+Z)', 3000)
            return None
        assets_changed = assets_before != tuple((a.id for a in self.state.assets))
        selection_changed = selected_before != self.state.selected_id
        self._apply_history_snapshot(assets_changed=assets_changed or selection_changed)
        undo_left = len(self.history)
        redo_left = self.history.redo_len()
        self.statusBar().showMessage(f'Đã làm lại — Ctrl+Z: {undo_left}, Ctrl+Shift+Z: {redo_left}', 2500)
        self._refresh_history_actions()

    def _apply_history_snapshot(self, *, assets_changed: bool) -> None:
        from PySide6.QtWidgets import QApplication
        self.control_board.reload_project(self.state)
        self.control_board.sync_effect_overlay_controls()
        self.control_board.sync_blend_layer_controls()
        if hasattr(self.control_board, 'sync_background_layer_controls'):
            self.control_board.sync_background_layer_controls()
        self.preview_panel.refresh_settings()
        QApplication.processEvents()
        self.timeline_panel.reload_project(self.state)
        if assets_changed:
            valid_ids = {a.id for a in self.state.assets}
            self._batch_produce_export_ids = [aid for aid in self._batch_produce_export_ids if aid in valid_ids]
            self._refresh_project_asset_lists()
            self.refresh_batch_queue()
        self._history_baseline = capture_snapshot(self.state)

    def _load_sfx_for_selected_video(self) -> None:
        asset = self.state.selected_asset
        if asset is not None and asset.kind == 'video' and asset.path:
            self.state.sfx_events = load_sfx_events(asset.path)
        else:
            self.state.sfx_events = []
        self.control_board.sync_sfx_controls()
        self.timeline_panel.reload_project(self.state)

    def _persist_current_sfx(self) -> None:
        asset = self.state.selected_asset
        if asset is not None and asset.kind == 'video' and asset.path:
            try:
                save_sfx_events(asset.path, self.state.sfx_events)
            except (OSError, ValueError):
                pass

    def apply_current_settings_to_batch(self) -> None:
        asset = self.state.selected_asset
        if asset is not None and asset.kind == 'video':
            self.state.snapshot_asset_settings(asset.id)
        count = self._apply_batch_template()
        self.refresh_batch_queue()
        self._schedule_autosave()
        if count:
            name = asset.name if asset is not None else 'mẫu'
            self.statusBar().showMessage(f'Đã áp mẫu từ «{name}» cho {count} video (mix, xuất, hiệu ứng — tách AI chạy theo từng clip)')
            self._log_event('Áp mẫu batch', f'{count} video từ {name}')
            return None
        self.statusBar().showMessage('Chưa có video để áp thiết lập')

    def remove_video_from_project(self, asset_id: str) -> None:
        if self._has_exclusive_job():
            self.statusBar().showMessage('Đang có tác vụ phụ đề/TTS — chờ xong rồi xóa video', 3500)
        else:
            asset = next((a for a in self.state.assets if a.id == asset_id), None)
            if asset is None or asset.kind != 'video':
                pass
            else:
                answer = QMessageBox.question(self, 'Xóa video khỏi dự án', f'Gỡ «{asset.name}» khỏi dự án?\n\nFile trên ổ cứng không bị xóa. Bấm Ctrl+Z để khôi phục.', QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No, QMessageBox.StandardButton.No)
                if answer != QMessageBox.StandardButton.Yes:
                    pass
                else:
                    if self.state.selected_id == asset_id:
                        self._persist_video_subtitles(asset_id)
                        self._persist_current_sfx()
                    self._push_history()
                    try:
                        self.state.remove_video_asset(asset_id)
                    except KeyError:
                        pass
                    if asset_id in self._batch_produce_export_ids:
                        self._batch_produce_export_ids = [aid for aid in self._batch_produce_export_ids if aid != asset_id]
                    self._schedule_autosave()
                    self._refresh_project_asset_lists()
                    self.refresh_batch_queue()
                    self._update_batch_control_ui()
                    if self.state.selected_id:
                        self.select_asset(self.state.selected_id)
                    else:
                        self.preview_panel.set_selected_asset(None)
                        self.timeline_panel.reload_project(self.state)
                        self.control_board.reload_project(self.state)
                        self.preview_panel.refresh_settings()
                    self._sync_history_baseline()
                    self.statusBar().showMessage(f'Đã gỡ «{asset.name}» — Ctrl+Z để khôi phục', 3500)
                    self._log_event('Xóa video khỏi dự án', asset.name)

    def remove_videos_from_project(self, asset_ids: list[str]) -> None:
        ids = [aid for aid in dict.fromkeys(asset_ids) if any((a.id == aid for a in self.state.assets if a.kind == 'video'))]
        if not ids:
            return None
        if self._has_exclusive_job():
            self.statusBar().showMessage('Đang có tác vụ phụ đề/TTS — chờ xong rồi xóa video', 3500)
            return None
        answer = QMessageBox.question(self, 'Xóa video khỏi dự án', f'Gỡ {len(ids)} video khỏi dự án?\n\nFile trên ổ cứng không bị xóa. Bấm Ctrl+Z để khôi phục.', QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No, QMessageBox.StandardButton.No)
        if answer != QMessageBox.StandardButton.Yes:
            return None
        if self.state.selected_id in ids:
            self._persist_video_subtitles(self.state.selected_id)
            self._persist_current_sfx()
        self._push_history()
        removed_names = []
        for asset_id in ids:
            try:
                asset = next((a for a in self.state.assets if a.id == asset_id), None)
                if asset is None:
                    raise KeyError(asset_id)
                removed_names.append(asset.name)
                self.state.remove_video_asset(asset_id)
                if asset_id in self._batch_produce_export_ids:
                    self._batch_produce_export_ids = [aid for aid in self._batch_produce_export_ids if aid != asset_id]
                continue
            except KeyError:
                continue
        self._schedule_autosave()
        self._refresh_project_asset_lists()
        self.refresh_batch_queue()
        self._update_batch_control_ui()
        if self.state.selected_id:
            self.select_asset(self.state.selected_id)
        else:
            self.preview_panel.set_selected_asset(None)
            self.timeline_panel.reload_project(self.state)
            self.control_board.reload_project(self.state)
            self.preview_panel.refresh_settings()
        self._sync_history_baseline()
        self.statusBar().showMessage(f'Đã gỡ {len(removed_names)} video — Ctrl+Z để khôi phục', 3500)
        self._log_event('Xóa video hàng loạt', f'{len(removed_names)} clip')

    def refresh_batch_queue(self) -> None:
        workbench = self.module_workbenches.get('batch')
        if workbench is None:
            return None
        items = []
        for asset in self.state.assets:
            if asset.kind != 'video':
                pass
            else:
                marker = ''
                if asset.id in self.state.asset_settings:
                    marker = ' · đã áp mẫu'
                items.append(f'{asset.name}{marker}')
        workbench.set_batch_queue(items)

    def choose_logo_file(self) -> None:
        path, _selected_filter = (QFileDialog.getOpenFileName(self, 'Chọn logo', get_last_dir('logo', get_last_dir('media')), 'Hình ảnh (*.png *.jpg *.jpeg *.webp *.bmp);;Tất cả tệp (*.*)')[0], QFileDialog.getOpenFileName(self, 'Chọn logo', get_last_dir('logo', get_last_dir('media')), 'Hình ảnh (*.png *.jpg *.jpeg *.webp *.bmp);;Tất cả tệp (*.*)')[1])
        if path:
            remember_path('logo', path)
            self.control_board.set_logo_path(path)
            self.timeline_panel.reload_project(self.state)
            self.preview_panel.refresh_settings()
            self.statusBar().showMessage(f'Đã chọn logo: {Path(path).name}')
            return None

    def choose_effect_overlay_file(self) -> None:
        path, _selected_filter = (QFileDialog.getOpenFileName(self, 'Chọn overlay ảnh/video', get_last_dir('overlay', get_last_dir('media')), 'Media (*.png *.jpg *.jpeg *.webp *.bmp *.gif *.tif *.tiff *.mp4 *.mov *.mkv *.avi *.webm *.m4v *.wmv *.flv *.ts);;Ảnh (*.png *.jpg *.jpeg *.webp *.bmp *.gif);;Video (*.mp4 *.mov *.mkv *.avi *.webm *.m4v);;Tất cả tệp (*.*)')[0], QFileDialog.getOpenFileName(self, 'Chọn overlay ảnh/video', get_last_dir('overlay', get_last_dir('media')), 'Media (*.png *.jpg *.jpeg *.webp *.bmp *.gif *.tif *.tiff *.mp4 *.mov *.mkv *.avi *.webm *.m4v *.wmv *.flv *.ts);;Ảnh (*.png *.jpg *.jpeg *.webp *.bmp *.gif);;Video (*.mp4 *.mov *.mkv *.avi *.webm *.m4v);;Tất cả tệp (*.*)')[1])
        if path:
            remember_path('overlay', path)
            self.control_board.set_effect_overlay_path(path)
            self.preview_panel.refresh_settings()
            self.statusBar().showMessage(f'Đã gắn overlay (ảnh/video, kéo trên preview): {Path(path).name}')
            return None

    def choose_blend_layer_file(self) -> None:
        path, _selected_filter = (QFileDialog.getOpenFileName(self, 'Chọn file hòa trộn (ảnh/video)', get_last_dir('blend', get_last_dir('overlay', get_last_dir('media'))), 'Media (*.png *.jpg *.jpeg *.webp *.bmp *.gif *.tif *.tiff *.mp4 *.mov *.mkv *.avi *.webm *.m4v *.wmv *.flv *.ts);;Ảnh (*.png *.jpg *.jpeg *.webp *.bmp *.gif);;Video (*.mp4 *.mov *.mkv *.avi *.webm *.m4v);;Tất cả tệp (*.*)')[0], QFileDialog.getOpenFileName(self, 'Chọn file hòa trộn (ảnh/video)', get_last_dir('blend', get_last_dir('overlay', get_last_dir('media'))), 'Media (*.png *.jpg *.jpeg *.webp *.bmp *.gif *.tif *.tiff *.mp4 *.mov *.mkv *.avi *.webm *.m4v *.wmv *.flv *.ts);;Ảnh (*.png *.jpg *.jpeg *.webp *.bmp *.gif);;Video (*.mp4 *.mov *.mkv *.avi *.webm *.m4v);;Tất cả tệp (*.*)')[1])
        if path:
            remember_path('blend', path)
            self.control_board.set_blend_layer_path(path)
            self.timeline_panel.reload_project(self.state)
            self.preview_panel.refresh_settings()
            self.statusBar().showMessage(f'Đã thêm lớp hòa trộn: {Path(path).name}')
            return None

    def choose_background_layer_file(self) -> None:
        path, _selected_filter = (QFileDialog.getOpenFileName(self, 'Chọn file nền (ảnh/video)', get_last_dir('background', get_last_dir('blend', get_last_dir('media'))), 'Media (*.png *.jpg *.jpeg *.webp *.bmp *.gif *.tif *.tiff *.mp4 *.mov *.mkv *.avi *.webm *.m4v *.wmv *.flv *.ts);;Ảnh (*.png *.jpg *.jpeg *.webp *.bmp *.gif);;Video (*.mp4 *.mov *.mkv *.avi *.webm *.m4v);;Tất cả tệp (*.*)')[0], QFileDialog.getOpenFileName(self, 'Chọn file nền (ảnh/video)', get_last_dir('background', get_last_dir('blend', get_last_dir('media'))), 'Media (*.png *.jpg *.jpeg *.webp *.bmp *.gif *.tif *.tiff *.mp4 *.mov *.mkv *.avi *.webm *.m4v *.wmv *.flv *.ts);;Ảnh (*.png *.jpg *.jpeg *.webp *.bmp *.gif);;Video (*.mp4 *.mov *.mkv *.avi *.webm *.m4v);;Tất cả tệp (*.*)')[1])
        if path:
            remember_path('background', path)
            self.control_board.set_background_layer_path(path)
            self.timeline_panel.reload_project(self.state)
            self.preview_panel.refresh_settings()
            self.statusBar().showMessage(f'Đã thêm nền: {Path(path).name}')
            return None

    def fill_video_title_from_selected_file(self) -> None:
        video = self._selected_video_asset()
        if video is not None and video.path:
            from ui_qt.video_title import title_from_media_path
            title = title_from_media_path(video.path)
            self.state.values['video_title_content'] = title
            self.state.values['video_title_enabled'] = True
            self.state.values['video_title_language_mode'] = 'source'
            self.state.values['video_title_from_filename'] = True
            enabled = self.control_board.control('video_title_enabled')
            if hasattr(enabled, 'setChecked'):
                enabled.setChecked(True)
            lang_mode = self.control_board.control('video_title_language_mode')
            index = lang_mode.findData('source')
            if isinstance(lang_mode, QComboBox) and index >= 0:
                lang_mode.setCurrentIndex(index)
            content = self.control_board.control('video_title_content')
            if isinstance(content, QLineEdit):
                content.setText(title)
            self.preview_panel.refresh_settings()
            self.statusBar().showMessage(f'Tiêu đề từ tên file (không .mp4): {title}', 3500)
        else:
            self.statusBar().showMessage('Hãy chọn video để lấy tên làm tiêu đề')
            return None

    def choose_voice_audio_file(self) -> None:
        path, _selected_filter = (QFileDialog.getOpenFileName(self, 'Chọn file lồng tiếng/TTS', get_last_dir('audio', get_last_dir('media')), 'Audio (*.mp3 *.wav *.m4a *.aac *.flac *.ogg);;Tất cả tệp (*.*)')[0], QFileDialog.getOpenFileName(self, 'Chọn file lồng tiếng/TTS', get_last_dir('audio', get_last_dir('media')), 'Audio (*.mp3 *.wav *.m4a *.aac *.flac *.ogg);;Tất cả tệp (*.*)')[1])
        if path:
            remember_path('audio', path)
            self.control_board.set_voice_audio_path(path)
            self.timeline_panel.reload_project(self.state)
            self.statusBar().showMessage(f'Đã chọn lồng tiếng: {Path(path).name}')
            return None

    def choose_background_audio_file(self) -> None:
        path, _selected_filter = (QFileDialog.getOpenFileName(self, 'Chọn file nhạc nền', get_last_dir('audio', get_last_dir('media')), 'Audio (*.mp3 *.wav *.m4a *.aac *.flac *.ogg);;Tất cả tệp (*.*)')[0], QFileDialog.getOpenFileName(self, 'Chọn file nhạc nền', get_last_dir('audio', get_last_dir('media')), 'Audio (*.mp3 *.wav *.m4a *.aac *.flac *.ogg);;Tất cả tệp (*.*)')[1])
        if path:
            remember_path('audio', path)
            self.control_board.set_background_audio_path(path)
            self.timeline_panel.reload_project(self.state)
            self.statusBar().showMessage(f'Đã chọn nhạc nền: {Path(path).name}')
            return None

    def choose_subtitle_file(self) -> None:
        if self._has_background_job():
            pass
        else:
            path, _selected_filter = (QFileDialog.getOpenFileName(self, 'Chọn tệp phụ đề SRT', get_last_dir('subtitle', get_last_dir('media')), 'Phụ đề SRT (*.srt);;Tất cả tệp (*.*)')[0], QFileDialog.getOpenFileName(self, 'Chọn tệp phụ đề SRT', get_last_dir('subtitle', get_last_dir('media')), 'Phụ đề SRT (*.srt);;Tất cả tệp (*.*)')[1])
            if path:
                remember_path('subtitle', path)
                try:
                    imported = load_srt(path)
                    working = self._persist_subtitle_document(imported, self._working_subtitle_path())
                except (OSError, ValueError) as exc:
                    self._report_error('Không thể nhập phụ đề', str(exc))
                self._apply_subtitle_document(working)
                self.statusBar().showMessage(f'Đã nhập {len(working.segments)} câu từ {Path(path).name}')

    def choose_subtitle_save_path(self) -> None:
        document = self.state.subtitles
        if document.segments:
            video = self._selected_video_asset()
            last_dir = get_last_dir('subtitle', get_last_dir('media'))
            base_dir = Path(self._project_output_folder()) if self._project_output_folder() else None
            if document.source_path:
                suggested = Path(document.source_path)
            elif video is not None and video.path:
                source = Path(video.path)
                suggested = (base_dir or Path(last_dir or source.parent)) / f'{source.stem}_phu_de.srt'
            else:
                suggested = (base_dir or Path(last_dir or Path.home())) / 'phu_de.srt'
            output, _selected_filter = (QFileDialog.getSaveFileName(self, 'Lưu phụ đề đã sửa', str(suggested), 'Phụ đề SRT (*.srt)')[0], QFileDialog.getSaveFileName(self, 'Lưu phụ đề đã sửa', str(suggested), 'Phụ đề SRT (*.srt)')[1])
            if output:
                remember_path('subtitle', output)
                destination = Path(output)
                if destination.suffix.lower() != '.srt':
                    destination = destination.with_suffix('.srt')
                try:
                    saved = self._persist_subtitle_document(document, destination)
                except (OSError, ValueError) as exc:
                    self._report_error('Không thể lưu phụ đề', str(exc))
                self._apply_subtitle_document(saved)
                self.statusBar().showMessage(f'Đã lưu phụ đề: {Path(saved.source_path).name}')
        else:
            self.statusBar().showMessage('Chưa có câu phụ đề nào để lưu')

    def save_provider_credential(self, provider_id: str, key: str) -> None:
        personal_key = key.strip()
        if not provider_id:
            self.statusBar().showMessage('Chưa chọn nhà cung cấp AI')
            return None
        if personal_key:
            self.credential_store.set(provider_id, personal_key)
            self._refresh_credential_mask()
            self.statusBar().showMessage('Đã lưu khóa cá nhân trên máy này')
        else:
            self.statusBar().showMessage('Hãy nhập khóa API cá nhân trước khi lưu')
            return None

    def save_tts_api_key(self) -> None:
        provider = self.control_board.tts_credential_provider()
        if provider:
            key = self.control_board.current_tts_api_key_entered()
            if key:
                try:
                    self.credential_store.set(provider, key)
                except OSError as exc:
                    self._report_error('Không lưu được key TTS', f'Không ghi được credentials: {exc}')
                    return None
                self.state.values['tts_api_key'] = key
                control = self.control_board.controls.get('tts_api_key')
                if isinstance(control, QLineEdit):
                    control.blockSignals(True)
                    try:
                        control.setText(key)
                    finally:
                        control.blockSignals(False)
                self._refresh_tts_api_key_mask()
                self.statusBar().showMessage(f'Đã lưu khóa {provider} trên máy (••••{key[-4:]}) — có thể Thử giọng', 5000)
            else:
                stored = self.credential_store.get(provider)
                if stored:
                    self.control_board.apply_stored_tts_api_key(stored)
                    self._refresh_tts_api_key_mask()
                    self.statusBar().showMessage(f'Key {provider} đã có trên máy (••••{stored[-4:]})', 4000)
                else:
                    self.statusBar().showMessage('Hãy dán khóa API vào ô «Khóa API TTS» rồi bấm Lưu khóa', 4500)
        else:
            self.statusBar().showMessage('Engine hiện tại không cần khóa API (vd Edge/CapCut)', 4000)

    def _refresh_tts_api_key_mask(self) -> None:
        board = getattr(self, 'control_board', None)
        if board is None:
            return None
        provider = board.tts_credential_provider()
        stored = self.credential_store.get(provider) if provider else ''
        if stored:
            board.apply_stored_tts_api_key(stored)
        masked = self.credential_store.masked(provider) if provider else ''
        board.set_tts_api_key_mask(masked)
        board._update_tts_engine_hints()

    def _resolved_tts_api_key(self, engine: str | None=None) -> str:
        board = self.control_board
        provider = board.tts_credential_provider(engine)
        entered = board.current_tts_api_key_entered()
        session = str(self.state.values.get('tts_api_key', '') or '').strip()
        stored = self.credential_store.get(provider) if provider else ''
        merged = merge_api_key_pools(entered, session, stored)
        if merged:
            self.state.values['tts_api_key'] = merged[0]
            return '|'.join(merged)
        return ''

    def start_provider_probe(self) -> None:
        if self._has_exclusive_job():
            self.statusBar().showMessage('Đang có tác vụ phụ đề/TTS — chờ xong rồi kiểm tra API', 4000)
            return None
        if self.provider_probe_task is not None:
            self.statusBar().showMessage('Đang kiểm tra API…', 2500)
            return None
        panel = self.control_board.subtitle_panel
        provider_id = panel.selected_provider_id()
        model = panel.model_combo.currentText().strip()
        key = self._resolve_provider_api_keys(provider_id, panel.entered_api_key())
        if parse_api_key_pool(key):
            panel.set_api_probe_busy(True, f"Đang gọi thử «{provider_id}» / {model or 'model mặc định'}…")
            task = ProviderProbeTask(provider_id, model, key)
            self.provider_probe_task = task
            task.signals.completed.connect(self._on_provider_probe_completed)
            task.signals.failed.connect(self._on_provider_probe_failed)
            task.signals.finished.connect(self._on_provider_probe_finished)
            self.thread_pool.start(task)
        else:
            panel.set_api_probe_result(False, 'Chưa có khóa', 'Nhập khóa API (hoặc Lưu khóa) rồi bấm Kiểm tra lại.')
            return None

    def _on_provider_probe_completed(self, result) -> None:
        from providers.ai.probe import ProviderProbeResult
        panel = self.control_board.subtitle_panel
        if isinstance(result, ProviderProbeResult):
            panel.set_api_probe_result(result.ok, result.summary, result.detail)
            self.statusBar().showMessage(result.summary, 6000)
            if not result.ok:
                self._maybe_warn_api_blocked(result.detail or result.summary)
                return None
        else:
            panel.set_api_probe_result(False, 'Lỗi kiểm tra', 'Phản hồi không hợp lệ')
            return None

    def _on_provider_probe_failed(self, message: str) -> None:
        panel = self.control_board.subtitle_panel
        panel.set_api_probe_result(False, 'Lỗi kiểm tra', message)
        self.statusBar().showMessage(f'Kiểm tra API thất bại: {message}', 6000)
        self._maybe_warn_api_blocked(message)

    def _on_provider_probe_finished(self) -> None:
        self.provider_probe_task = None

    def start_stt_probe(self) -> None:
        from providers.speech.deepgram import probe_deepgram_key
        if self._has_exclusive_job():
            self.statusBar().showMessage('Đang có tác vụ phụ đề/TTS — chờ xong rồi kiểm tra API', 4000)
            return None
        if getattr(self, 'stt_probe_task', None) is not None:
            self.statusBar().showMessage('Đang kiểm tra API…', 2500)
            return None
        panel = self.control_board.subtitle_panel
        keys = self.control_board.keys_panel
        key = self._resolve_provider_api_keys('deepgram', keys.deepgram_edit.text())
        if parse_api_key_pool(key):
            panel.set_stt_probe_busy(True, 'Đang gọi thử Deepgram STT…')
            task = ProviderProbeTask('deepgram', 'nova-3', key, runner=probe_deepgram_key)
            self.stt_probe_task = task
            task.signals.completed.connect(self._on_stt_probe_completed)
            task.signals.failed.connect(self._on_stt_probe_failed)
            task.signals.finished.connect(self._on_stt_probe_finished)
            self.thread_pool.start(task)
        else:
            panel.set_stt_probe_result(False, 'Chưa có khóa', 'Nhập khóa Deepgram (hoặc Lưu khóa) rồi bấm Kiểm tra lại.')
            return None

    def _on_stt_probe_completed(self, result) -> None:
        from providers.ai.probe import ProviderProbeResult
        panel = self.control_board.subtitle_panel
        if isinstance(result, ProviderProbeResult):
            panel.set_stt_probe_result(result.ok, result.summary, result.detail)
            self.statusBar().showMessage(result.summary, 6000)
            if not result.ok:
                self._maybe_warn_api_blocked(result.detail or result.summary)
                return None
        else:
            panel.set_stt_probe_result(False, 'Lỗi kiểm tra', 'Phản hồi không hợp lệ')
            return None

    def _on_stt_probe_failed(self, message: str) -> None:
        panel = self.control_board.subtitle_panel
        panel.set_stt_probe_result(False, 'Lỗi kiểm tra', message)
        self.statusBar().showMessage(f'Kiểm tra STT thất bại: {message}', 6000)
        self._maybe_warn_api_blocked(message)

    def _on_stt_probe_finished(self) -> None:
        self.stt_probe_task = None

    def start_subtitle_translation(self) -> None:
        if self._dub_pipeline_start_blocked():
            pass
        else:
            document = self.state.subtitles
            if document.segments:
                panel = self.control_board.subtitle_panel
                try:
                    settings = panel.translation_settings()
                except ValueError as exc:
                    self.statusBar().showMessage(str(exc))
                    self._abort_dub_pipeline(str(exc))
                key = self._resolve_provider_api_keys(settings.provider_id, panel.entered_api_key())
                if parse_api_key_pool(key):
                    self._start_subtitle_task(self.translation_task_factory(document, settings, key))
                else:
                    self.statusBar().showMessage('Chưa có khóa API cá nhân cho nhà cung cấp đã chọn')
                    self._abort_dub_pipeline('Thiếu khóa API dịch')
            elif self._dub_pipeline_active and self._recover_missing_subtitles_for_step('translate'):
                pass
            else:
                self.statusBar().showMessage('Hãy nhập hoặc tạo phụ đề trước khi dịch')
                self._abort_dub_pipeline('Chưa có phụ đề để dịch')

    def preview_subtitle_segment(self, segment) -> None:
        pos = max(0, int(segment.start_ms))
        text = str(segment.text or '')
        end_ms = max(pos + 1, int(segment.end_ms))
        self._on_timeline_scrub_finished(pos)
        if text:
            self.preview_panel.frame_canvas.set_selected_subtitle(text, pos, end_ms)
            self.preview_panel.playback_status.setText('Đang xem câu phụ đề đã chọn')
            return None

    def start_speech_recognition(self) -> None:
        if self._dub_pipeline_start_blocked():
            pass
        else:
            video = self._dub_video_asset()
            if video is not None and video.path:
                panel = self.control_board.subtitle_panel
                try:
                    settings = panel.speech_settings()
                except ValueError as exc:
                    self.statusBar().showMessage(str(exc))
                    self._abort_dub_pipeline(str(exc))
                key = ''
                if panel.selected_provider_id() == settings.engine:
                    key = panel.entered_api_key()
                key = key or self.credential_store.get(settings.engine)
                key = self._resolve_provider_api_keys(settings.engine, key)
                if settings.engine not in frozenset({'deepgram', 'groq'}) or parse_api_key_pool(key):
                    self._start_subtitle_task(self.speech_task_factory(video.path, settings, key))
                else:
                    label = 'Deepgram' if settings.engine == 'deepgram' else 'Groq'
                    self.statusBar().showMessage(f'Chưa có khóa API {label} cá nhân để nghe giọng')
                    self._abort_dub_pipeline(f'Thiếu khóa API {label}')
            else:
                self.statusBar().showMessage('Hãy thêm một video thật trước khi nhận dạng giọng nói')
                self._abort_dub_pipeline('Thiếu video để nghe giọng')

    def start_subtitle_ocr(self) -> None:
        if self._has_background_job():
            return None
        video = self._selected_video_asset()
        if video is not None and video.path:
            source = Path(video.path)
            output = source.with_name(f'{source.stem}_ocr.srt')
            settings = self.control_board.subtitle_panel.ocr_settings()
            self._start_subtitle_task(self.ocr_task_factory(video.path, str(output), **settings))
        else:
            self.statusBar().showMessage('Hãy thêm một video thật trước khi đọc chữ trên video')
            return None

    def start_tts_voice_generation(self) -> None:
        if self._dub_pipeline_start_blocked():
            return None
        video = self._dub_video_asset()
        if video is None or not video.path:
            self.statusBar().showMessage('Hãy chọn video thật trước khi tạo giọng đọc')
            self._abort_dub_pipeline('Thiếu video để tạo giọng đọc')
            return None
        if self.state.subtitles.segments:
            blocked = self._subtitle_language_blocks_tts()
            if blocked:
                self._abort_dub_pipeline(blocked)
                return None
            from core.tts_source_cues import TTS_LOCKED_NO_SOURCE_MSG, tts_document_for_task
            doc = tts_document_for_task(self.state.subtitles, self.state.values)
            if doc is None:
                self.statusBar().showMessage(TTS_LOCKED_NO_SOURCE_MSG)
                self._abort_dub_pipeline(TTS_LOCKED_NO_SOURCE_MSG)
                return None
            source = Path(video.path)
            output_dir = Path(self._project_output_folder() or source.parent) / 'Giọng Đọc TTS'
            task = self.tts_task_factory(doc, video.path, str(output_dir), self._tts_voice_settings())
            self._start_tts_task(task)
        else:
            if self._dub_pipeline_active and self._recover_missing_subtitles_for_step('tts'):
                pass
            else:
                self.statusBar().showMessage('Hãy nhập hoặc tạo phụ đề trước khi tạo giọng đọc')
                self._abort_dub_pipeline('Chưa có phụ đề để tạo giọng đọc')
            return None

    def _recover_missing_subtitles_for_step(self, step: str) -> bool:
        if not self._dub_pipeline_active:
            return False
        if getattr(self, '_dub_recovering_subtitles', False):
            return False
        self._dub_recovering_subtitles = True
        self._dub_step_rescheduled = True
        try:
            stt_step = self._primary_stt_pipeline_step()
            queue = [stt_step]
            if step == 'tts':
                queue.append('translate')
            queue.append(step)
            for pending in self._dub_pipeline_steps:
                if pending not in queue:
                    queue.append(pending)
            self._dub_pipeline_steps = queue
            self._log_event('Mạch dịch + giọng', f'Phụ đề trống → chèn {stt_step} trước «{step}»')
            QTimer.singleShot(0, self._advance_dub_pipeline)
        finally:
            QTimer.singleShot(0, self._clear_dub_recover_flag)
        return True

    def _clear_dub_recover_flag(self) -> None:
        self._dub_recovering_subtitles = False

    def _subtitle_language_blocks_tts(self) -> str | None:
        from core.subtitle_translation import count_untranslated_cjk_lines
        target = str(self.state.values.get('subtitle_target_language', 'vi') or 'vi')
        texts = [seg.text for seg in self.state.subtitles.segments]
        leftover = count_untranslated_cjk_lines(texts, texts, target)
        if leftover <= 0:
            return None
        ratio = leftover / max(1, len(texts))
        return None if ratio < 0.2 else f'Phụ đề còn {leftover}/{len(texts)} câu chữ Hán trong khi đích là «{target}». Chạy lại Dịch phụ đề (đổi model nếu cần) rồi mới tạo giọng đọc — tránh TTS đọc tiếng Trung.'

    def _grab_preview_thumbnail_png(self) -> bytes:
        from PySide6.QtCore import QBuffer, QIODevice
        widget = getattr(self.preview_panel, 'frame_canvas', None) or self.preview_panel
        pixmap = widget.grab()
        if pixmap.isNull():
            return b''
        buffer = QBuffer()
        buffer.open(QIODevice.OpenModeFlag.WriteOnly)
        pixmap.save(buffer, 'PNG')
        return bytes(buffer.data())

    def _refresh_preset_library(self) -> None:
        from ui_qt.edit_preset_library import active_preset_id, list_presets
        presets = list_presets()
        pinned = active_preset_id()
        self.resource_library.set_presets(presets, pinned)
        self.preview_panel.set_preset_choices([(meta.id, meta.name) for meta in presets], pinned_id=str(pinned or ''))
        self._refresh_preview_preset_bar()

    def _refresh_preview_preset_bar(self) -> None:
        asset = self.state.selected_asset
        preset_id = ''
        preset_name = ''
        bag = self.state.asset_settings.get(asset.id) or {} if asset is not None else {}
        preset_id = str(self.state.values.get('applied_edit_preset_id') or bag.get('applied_edit_preset_id') or '').strip()
        preset_name = str(self.state.values.get('applied_edit_preset_name') or bag.get('applied_edit_preset_name') or '').strip()
        if asset is not None and asset.kind == 'video' and preset_id and (not preset_name):
            from ui_qt.edit_preset_library import get_preset_meta
            meta = get_preset_meta(preset_id)
            if meta is not None:
                preset_name = meta.name
        self.preview_panel.set_applied_preset(preset_id, preset_name)

    def _open_preset_library_page(self) -> None:
        switch = getattr(self, 'switch_module', None)
        if callable(switch):
            switch('preset')
            return None
        rail = getattr(self, 'module_rail', None)
        if rail is not None:
            if hasattr(rail, 'set_active_module'):
                rail.set_active_module('preset')
            return None

    def _on_preset_save_requested(self, name: str) -> None:
        from ui_qt.edit_preset_library import save_preset
        asset = self.state.selected_asset
        if asset is None or asset.kind != 'video':
            self.statusBar().showMessage('Hãy chọn 1 video trước khi lưu cấu hình')
            return None
        self.state.snapshot_asset_settings(asset.id)
        meta = save_preset(name, self.state, asset.id, thumbnail_png_bytes=self._grab_preview_thumbnail_png())
        self._refresh_preset_library()
        self.statusBar().showMessage(f'Đã lưu cấu hình «{meta.name}»', 3000)
        self._log_event('Lưu cấu hình', f'{meta.name} — từ {asset.name}')

    def _on_preset_rename_requested(self, preset_id: str, new_name: str) -> None:
        from ui_qt.edit_preset_library import rename_preset
        rename_preset(preset_id, new_name)
        self._refresh_preset_library()

    def _on_preset_delete_requested(self, preset_id: str) -> None:
        from ui_qt.edit_preset_library import delete_preset
        delete_preset(preset_id)
        self._refresh_preset_library()
        self.statusBar().showMessage('Đã xóa cấu hình', 2500)

    def _on_preset_pin_toggled(self, preset_id: str, checked: bool) -> None:
        from ui_qt.edit_preset_library import active_preset_id, set_active_preset
        if checked:
            set_active_preset(preset_id)
            self.statusBar().showMessage('Đã ghim cấu hình — video thả vào dự án sau này sẽ tự áp cấu hình này + tự chạy dịch/giọng', 4000)
        elif active_preset_id() == preset_id:
            set_active_preset(None)
            self.statusBar().showMessage('Đã bỏ ghim cấu hình', 2500)
        self._refresh_preset_library()

    def apply_saved_preset(self, preset_id: str, target_asset_id: str | None=None, *, auto_run_pipeline: bool) -> None:
        if self._ensure_licensed_or_warn(action='áp cấu hình'):
            from ui_qt.asset_export import apply_template_values_to_assets
            from ui_qt.edit_preset_library import load_preset_values
            asset_id = target_asset_id or self.state.selected_id
            target = next((a for a in self.state.assets if a.id == asset_id), None)
            if target is None or target.kind != 'video':
                self.statusBar().showMessage('Hãy chọn 1 video trước khi áp cấu hình')
            else:
                try:
                    values = load_preset_values(preset_id)
                except ValueError as exc:
                    self._report_error('Không áp được cấu hình', str(exc))
                from ui_qt.edit_preset_library import get_preset_meta
                meta = get_preset_meta(preset_id)
                preset_name = meta.name if meta is not None else str(preset_id)
                applied = apply_template_values_to_assets(self.state, values, [target.id], subtitle_workspace=self.subtitle_workspace, project_key=self._subtitle_project_key())
                if applied:
                    bag = self.state.asset_settings.setdefault(target.id, {})
                    bag['applied_edit_preset_id'] = str(preset_id)
                    bag['applied_edit_preset_name'] = preset_name
                    if target.id == self.state.selected_id:
                        self.state.restore_asset_settings(target.id)
                        self.state.values['applied_edit_preset_id'] = str(preset_id)
                        self.state.values['applied_edit_preset_name'] = preset_name
                        bag['applied_edit_preset_id'] = str(preset_id)
                        bag['applied_edit_preset_name'] = preset_name
                        self._sync_subtitles_after_preset_apply(target)
                        self.control_board.reload_project(self.state)
                        self._refresh_timeline_layer_rows()
                        self.preview_panel.refresh_settings()
                    self._refresh_preview_preset_bar()
                    self._schedule_autosave()
                    self.statusBar().showMessage(f'Đã áp cấu hình cho «{target.name}»', 3500)
                    self._log_event('Áp cấu hình', target.name)
                    if auto_run_pipeline:
                        if target.id != self.state.selected_id:
                            self.select_asset(target.id)
                        if self._should_start_dub_after_preset_apply():
                            self.start_en_vi_dub_pipeline()

    def start_en_vi_dub_pipeline(self) -> None:
        if self._has_background_job():
            return None
        video = self._selected_video_asset()
        if video is None or not video.path:
            self.statusBar().showMessage('Hãy thêm video trước khi chạy mạch dịch + giọng')
            return None
        if self._confirm_export_preflight(skip_voice_audio=True, skip_subtitle_file=True, title='Kiểm tra trước khi dịch + TTS'):
            err = self._validate_dub_prerequisites()
            if err:
                self._report_pipeline_error('Chưa thể chạy mạch dịch + giọng', err)
                return None
            self._prepare_en_vi_dub_defaults()
            self._push_history()
            self._batch_dub_active = False
            self._batch_dub_asset_ids = []
            self._pipeline_asset_id = video.id
            self._dub_pipeline_steps = self._build_dub_pipeline_steps()
            self._dub_pipeline_active = True
            target_lang = str(self.state.values.get('subtitle_target_language', 'vi'))
            self._log_event('Bắt đầu mạch dịch + TTS', f'stt → translate → tts · đích {target_lang}')
            self.statusBar().showMessage('Mạch dịch + giọng: Nghe giọng → Dịch → Tạo giọng đọc…')
            self._advance_dub_pipeline()
        else:
            return None

    def generate_seo_from_current_subtitles(self) -> None:
        from core.seo_from_transcript import generate_seo_from_document
        from PySide6.QtWidgets import QApplication, QMessageBox
        asset = self._selected_video_asset()
        path = asset.path if asset else ''
        doc = self.subtitle_workspace.document_for_path(path) if path else None
        if doc is not None and doc.segments:
            target = str(self.state.values.get('subtitle_target_language', 'vi'))
            hint = Path(path).stem if path else ''
            bundle = generate_seo_from_document(doc, target_language=target, source_hint=hint)
            if bundle.title or bundle.description:
                self.state.values['video_title_enabled'] = True
                self.state.values['video_title_language_mode'] = 'manual'
                self.state.values['video_title_content'] = bundle.title
                self.state.values['seo_description'] = bundle.description
                try:
                    control = self.control_board.controls.get('video_title_content')
                    if control is not None and hasattr(control, 'setText'):
                        control.setText(bundle.title)
                    enabled = self.control_board.controls.get('video_title_enabled')
                    if enabled is not None and hasattr(enabled, 'setChecked'):
                        enabled.setChecked(True)
                except Exception:
                    pass
                clip_text = f'Tiêu đề:\n{bundle.title}\n\nMô tả:\n{bundle.description}\n\nTags: {bundle.tags}'
                try:
                    QApplication.clipboard().setText(clip_text)
                except Exception:
                    pass
                box = QMessageBox(self)
                box.setIcon(QMessageBox.Icon.Information)
                box.setWindowTitle('SEO từ phụ đề')
                box.setText(f'Tiêu đề:\n{bundle.title}')
                box.setInformativeText('Đã ghi tiêu đề video + lưu mô tả (seo_description).\nToàn bộ (title/desc/tags) đã copy clipboard.')
                box.setDetailedText(clip_text)
                box.exec()
                self.statusBar().showMessage(f'SEO: «{bundle.title[:48]}…» — đã copy clipboard', 4500)
                self._log_event('SEO từ phụ đề', bundle.title[:80])
            else:
                self.statusBar().showMessage('Không sinh được SEO từ phụ đề', 3500)
        else:
            self.statusBar().showMessage('Chưa có phụ đề — chạy STT/dịch trước rồi bấm SEO', 4000)

    def start_batch_dub_pipeline(self) -> None:
        if self._has_background_job():
            return None
        asset_ids = video_asset_ids_for_batch_dub(self.state)
        if not asset_ids:
            self.statusBar().showMessage('Chưa có video để chạy mạch hàng loạt')
            return None
        if self._confirm_export_preflight(skip_voice_audio=True, skip_subtitle_file=True, title='Kiểm tra trước khi mạch hàng loạt'):
            err = self._validate_dub_prerequisites()
            if err:
                self._report_pipeline_error('Chưa thể chạy mạch hàng loạt', err)
                return None
            stt_engine = str(self.state.values.get('subtitle_stt_engine', 'groq'))
            if stt_engine == 'capcut_auto':
                self._report_pipeline_error('Không chạy hàng loạt với AutoCapCut', 'AutoCapCut cần mở app CapCut desktop từng clip. Chọn «CapCut API» ở Cách nghe giọng, hoặc bấm AutoCapCut thủ công 1 clip.')
                return None
            self._prepare_dub_defaults()
            self.state.apply_current_settings_to_videos(subtitle_workspace=self.subtitle_workspace)
            self._batch_dub_total = len(asset_ids)
            self._batch_dub_completed = 0
            self._batch_dub_asset_ids = list(asset_ids)
            self._batch_dub_active = True
            if self._can_persist_batch_job():
                self._active_batch_job = BatchJobRecord(job_type='dub_pipeline', project_path=self._project_path_for_batch_job(), total=len(asset_ids), pending_asset_ids=list(asset_ids), on_error=self._batch_on_error_mode())
                save_batch_job(self._active_batch_job)
            target_lang = str(self.state.values.get('subtitle_target_language', 'vi'))
            self._log_event('Bắt đầu mạch hàng loạt', f'{self._batch_dub_total} video · đích {target_lang}')
            self.statusBar().showMessage(f'Mạch hàng loạt: 0/{self._batch_dub_total} video — chuẩn bị…')
            self._start_next_batch_dub_asset()
        else:
            return None

    def _build_dub_pipeline_steps(self) -> list[str]:
        asset = self._dub_video_asset()
        engine = str(self.state.values.get('subtitle_stt_engine', 'groq'))
        if asset is None:
            return dub_pipeline_steps_for_stt_engine(engine)
        steps = asset_dub_pipeline_steps(asset, self.state, subtitle_workspace=self.subtitle_workspace, stt_engine=engine)
        return steps or dub_pipeline_steps_for_stt_engine(engine)

    def _dub_video_asset(self):
        return next((a for a in self.state.assets if a.id == self._pipeline_asset_id), None) if self._pipeline_asset_id else self._selected_video_asset()

    def _ensure_voice_wanted_for_export(self, asset=None) -> None:
        pass

    def _confirm_export_preflight(self, *, skip_voice_audio: bool, skip_subtitle_file: bool, title: str, values: dict | None) -> bool:
        bag = values if values is not None else self.state.values
        issues = collect_template_preflight_issues(bag, skip_voice_audio=skip_voice_audio, skip_subtitle_file=skip_subtitle_file)
        if issues:
            detail = format_preflight_detail(issues)
            self._log_event(title, detail)
            hard = [item for item in issues if not item.auto_fixable]
            soft = [item for item in issues if item.auto_fixable]
            focus = (hard[0] if hard else soft[0]).focus_control
            if focus:
                try:
                    self.control_board.focus_control(focus)
                except Exception:
                    pass
            if hard:
                self._report_error(title, detail, dialog=True)
                return False
            if self.isVisible():
                box = QMessageBox(self)
                box.setIcon(QMessageBox.Icon.Warning)
                box.setWindowTitle(title)
                box.setText('Cấu hình còn thiếu — nếu chạy tiếp sẽ tốn API rồi mới lỗi lúc xuất.')
                box.setInformativeText(detail + '\n\nChọn «Tắt mục thiếu & tiếp tục» để bỏ qua các mục đó, hoặc «Hủy» để sửa tay (khuyến nghị).')
                continue_btn = box.addButton('Tắt mục thiếu & tiếp tục', QMessageBox.ButtonRole.AcceptRole)
                cancel_btn = box.addButton('Hủy', QMessageBox.ButtonRole.RejectRole)
                box.setDefaultButton(cancel_btn)
                box.exec()
                if box.clickedButton() is not continue_btn:
                    self.statusBar().showMessage('Đã hủy — sửa cấu hình rồi chạy lại', 6000)
                    return False
                applied = apply_auto_fixes(self.state.values, soft)
                self._sync_preflight_auto_fixes(soft)
                self._persist_preflight_auto_fixes_to_asset()
                self._schedule_autosave()
                note = '; '.join(applied) if applied else 'đã bỏ qua mục thiếu'
                self._log_event('Preflight tự sửa', note)
                self.statusBar().showMessage(note, 8000)
            else:
                applied = apply_auto_fixes(self.state.values, soft)
                self._sync_preflight_auto_fixes(soft)
                self._persist_preflight_auto_fixes_to_asset()
                self._log_event('Preflight tự sửa', '; '.join(applied))
        return True

    def _persist_preflight_auto_fixes_to_asset(self) -> None:
        asset = self.state.selected_asset
        if asset is None:
            return None
        bag = self.state.asset_settings.get(asset.id)
        if isinstance(bag, dict):
            for key in ('subtitle_enabled', 'subtitle_path', 'voice_audio_enabled', 'voice_audio_path', 'background_audio_enabled', 'logo_enabled', 'text_overlay_enabled', 'video_title_enabled', 'effect_overlay_enabled', 'video_effect'):
                if key in self.state.values:
                    bag[key] = self.state.values[key]
        else:
            return None

    def _sync_preflight_auto_fixes(self, issues) -> None:
        for issue in issues:
            if issue.code == 'bgm_missing':
                self._set_checkbox_control('background_audio_enabled', False)
            elif issue.code == 'logo_missing':
                self._set_checkbox_control('logo_enabled', False)
            elif issue.code == 'text_overlay_empty':
                self._set_checkbox_control('text_overlay_enabled', False)
            elif issue.code == 'video_title_empty':
                self._set_checkbox_control('video_title_enabled', False)
            elif issue.code == 'overlay_missing':
                self._set_checkbox_control('effect_overlay_enabled', False)
                effect = self.control_board.controls.get('video_effect')
                if issue.auto_fixable and effect is not None and hasattr(effect, 'setCurrentText') and (str(self.state.values.get('video_effect', 'none')) == 'none'):
                    effect.blockSignals(True)
                    effect.setCurrentText('none')
                    effect.blockSignals(False)
            elif issue.code == 'subtitle_missing':
                self._set_checkbox_control('subtitle_enabled', False)
            elif issue.code == 'voice_missing':
                self._set_checkbox_control('voice_audio_enabled', False)

    def _validate_dub_prerequisites(self) -> str | None:
        panel = self.control_board.subtitle_panel
        stt_engine = str(self.state.values.get('subtitle_stt_engine', 'groq'))
        translate_enabled = bool(self.state.values.get('subtitle_translate_enabled', True))
        if stt_engine not in frozenset({'capcut_auto', 'capcut_api'}):
            try:
                speech = panel.speech_settings()
            except ValueError as exc:
                return str(exc)
            key = ''
            if panel.selected_provider_id() == speech.engine:
                key = panel.entered_api_key()
            key = key or self.credential_store.get(speech.engine)
            key = self._resolve_provider_api_keys(speech.engine, key)
            if speech.engine in frozenset({'deepgram', 'groq'}) and (not parse_api_key_pool(key)):
                return 'Chưa có khóa API Deepgram cho STT. Lưu khóa Deepgram trong tab Khóa của tôi.' if speech.engine == 'deepgram' else 'Chưa có khóa API Groq cho STT. Chọn «CapCut API» ở Cách nghe giọng hoặc lưu khóa Groq trong tab Phụ đề → Công cụ AI.'
            if speech.engine == 'local':
                return 'STT local chưa cài trong runtime. Chọn CapCut API hoặc Groq.'
        elif translate_enabled:
            try:
                translation = panel.translation_settings()
            except ValueError as exc:
                return str(exc)
            translate_key = self._resolve_provider_api_keys(translation.provider_id, panel.entered_api_key())
            if not parse_api_key_pool(translate_key):
                return f'Chưa có khóa API dịch ({translation.provider_id}). Mở Phụ đề → Công cụ AI → nhập/lưu khóa, rồi bấm Kiểm tra API.'
        else:
            return None

    def _activate_asset_for_dub_pipeline(self, asset_id: str) -> bool:
        user_id = str(getattr(self, '_user_edit_asset_id', '') or self.state.selected_id or '')
        if self._is_export_pipeline_busy() and user_id and (user_id != asset_id) and any((a.id == user_id for a in self.state.assets)):
            self._persist_video_subtitles(user_id)
            self.state.snapshot_asset_settings(user_id)
            self._user_edit_asset_id = user_id
        self._pipeline_asset_id = asset_id
        self.state.select(asset_id)
        asset = self.state.selected_asset
        if asset is not None and asset.kind == 'video' and asset.path:
            restored = self.state.restore_asset_settings(asset_id)
            if not restored:
                self.state.values['subtitle_enabled'] = False
                self.state.values['subtitle_path'] = ''
            self._load_video_subtitles(asset)
            if int(getattr(self, '_job_state_swap_depth', 0) or 0) > 0:
                pass
            else:
                self.project_panel.set_selected_asset(asset_id)
                self.preview_panel.set_selected_asset(asset)
                self.timeline_panel.set_selected_asset(asset_id)
            return True
        return False

    def _start_next_batch_dub_asset(self) -> None:
        if self._should_swap_to_job_state():
            with self._using_job_state():
                return self._start_next_batch_dub_asset()
        if not self._batch_dub_active:
            pass
        elif self._batch_dub_asset_ids:
            asset_id = self._batch_dub_asset_ids.pop(0)
            self._sync_dub_batch_job_state()
            done = self._batch_dub_total - len(self._batch_dub_asset_ids) - 1
            asset = next((a for a in self.state.assets if a.id == asset_id), None)
            label = asset.name if asset is not None else asset_id
            self._log_event('Mạch hàng loạt — clip', f'{done + 1}/{self._batch_dub_total}: {label}')
            if self._activate_asset_for_dub_pipeline(asset_id):
                if self._active_batch_job is not None:
                    self._active_batch_job.mark_current(asset_id)
                    self._persist_batch_job()
                self._dub_pipeline_steps = self._build_dub_pipeline_steps()
                self._dub_pipeline_active = True
                self._push_history()
                self.statusBar().showMessage(f'Mạch hàng loạt {done + 1}/{self._batch_dub_total}: {label}…')
                self._advance_dub_pipeline()
            else:
                self._on_batch_dub_asset_failed(asset_id, 'Video không hợp lệ')
        else:
            self._finish_batch_dub_pipeline()
        return None

    def _batch_dub_on_error_mode(self) -> str:
        return self._batch_on_error_mode()

    def _on_batch_dub_asset_failed(self, asset_id: str, reason: str) -> None:
        asset = next((a for a in self.state.assets if a.id == asset_id), None)
        label = asset.name if asset is not None else asset_id
        self._log_event('Mạch hàng loạt lỗi', f'{label}: {reason}')
        self._clear_dub_pipeline()
        if self._active_batch_job is not None:
            self._active_batch_job.mark_failed(asset_id, reason)
            self._persist_batch_job()
        if self._batch_dub_on_error_mode() == 'skip':
            self.statusBar().showMessage(f'Bỏ qua {label} — tiếp clip sau… ({reason})')
            QTimer.singleShot(0, self._start_next_batch_dub_asset)
            return None
        self._finish_batch_dub_pipeline(aborted=True, reason=reason)

    def _finish_batch_dub_pipeline(self, *, aborted: bool, reason: str) -> None:
        if self._should_swap_to_job_state():
            with self._using_job_state():
                return self._finish_batch_dub_pipeline(aborted=aborted, reason=reason)
        done = self._batch_dub_completed
        self._batch_dub_active = False
        self._batch_dub_asset_ids = []
        self._batch_dub_completed = 0
        self._pipeline_asset_id = None
        self._clear_dub_pipeline()
        self.state.apply_current_settings_to_videos(subtitle_workspace=self.subtitle_workspace)
        self.refresh_batch_queue()
        self._schedule_autosave()
        self.control_board.set_subtitle_busy(False)
        self.export_progress.hide()
        self._refresh_export_ui()
        if aborted:
            self._report_pipeline_error('Mạch hàng loạt dừng', reason or 'Có lỗi khi xử lý clip')
        else:
            self.statusBar().showMessage(f'Hoàn tất mạch hàng loạt: {done}/{self._batch_dub_total} video. Có thể bấm Xuất hàng loạt (tự dub clip thiếu nếu bật tùy chọn).')
            self._log_event('Hoàn tất mạch hàng loạt', f'{done}/{self._batch_dub_total} video')
            self._clear_batch_job_file()
        self._release_export_job_state()
        return None

    def _mute_original_vocal_for_tts(self) -> None:
        pass

    def _snapshot_dub_results_for_pipeline_asset(self, voice_path: str='') -> None:
        asset_id = self._pipeline_asset_id or self.state.selected_id
        if asset_id:
            if voice_path:
                self.state.values['voice_audio_path'] = voice_path
                from core.tts_voice_key import current_tts_voice_key_from_values
                self.state.values['voice_tts_key'] = current_tts_voice_key_from_values(self.state.values)
            working = self._working_subtitle_path_for(asset_id)
            if working.is_file():
                self.state.values['subtitle_path'] = str(working.resolve())
            self.state.snapshot_asset_settings(asset_id)
        else:
            return None

    def _prepare_en_vi_dub_defaults(self) -> None:
        self._prepare_dub_defaults()

    def _prepare_dub_defaults(self) -> None:
        values = self.state.values
        target_lang = str(values.get('subtitle_target_language', 'vi') or 'vi')
        model = str(values.get('subtitle_stt_model', ''))
        if model.endswith('-en') or 'large-v3-en' in model.lower():
            values['subtitle_stt_model'] = 'whisper-large-v3-turbo'
        voice = str(values.get('tts_voice', '')).strip()
        if target_lang == 'vi' and (not voice.lower().startswith('vi-')):
            values['tts_voice'] = 'vi-VN-HoaiMyNeural'
        if not str(values.get('tts_engine', '')).strip():
            values['tts_engine'] = 'edge'
        panel = self.control_board.subtitle_panel
        target = panel.controls.get('subtitle_target_language')
        index = target.findData(target_lang)
        if isinstance(target, QComboBox) and index >= 0:
            target.setCurrentIndex(index)
        engine_control = self.control_board.controls.get('tts_engine')
        index = engine_control.findData(values.get('tts_engine', 'edge'))
        if isinstance(engine_control, QComboBox) and index >= 0:
            engine_control.setCurrentIndex(index)
        self.control_board.state.values['tts_engine'] = str(values.get('tts_engine', 'edge'))
        self.control_board.state.values['tts_voice'] = str(values.get('tts_voice', ''))
        self.control_board._reload_tts_voice_combo()
        self.control_board._update_tts_voice_summary()
        stt_model = getattr(panel, 'stt_model_combo', None)
        if isinstance(stt_model, QComboBox):
            if values.get('subtitle_stt_model'):
                stt_model.setCurrentText(str(values['subtitle_stt_model']))
            return None

    def _clear_dub_pipeline(self) -> None:
        self._dub_pipeline_steps = []
        self._dub_pipeline_active = False

    def _abort_dub_pipeline(self, reason: str) -> None:
        self._pending_export_after_dub = ''
        self._dub_recovering_subtitles = False
        if self._batch_produce_export_active and self._batch_produce_export_dub_phase:
            asset_id = self._pipeline_asset_id or self.state.selected_id or ''
            self._on_batch_produce_asset_failed(asset_id, reason)
            return None
        if self._batch_dub_active:
            asset_id = self._pipeline_asset_id or self.state.selected_id or ''
            self._on_batch_dub_asset_failed(asset_id, reason)
            return None
        if self._dub_pipeline_active or self._dub_pipeline_steps:
            self._clear_dub_pipeline()
            self._log_event('Dừng mạch dịch + giọng', reason)
            self._report_pipeline_error('Mạch dịch + giọng đã dừng', reason)
        else:
            if reason:
                self._report_pipeline_error('Không chạy được mạch dịch + giọng', reason)
            return None

    def _report_pipeline_error(self, title: str, detail: str='') -> None:
        from ui_qt.error_focus import classify_dub_error
        focus = classify_dub_error(f'{title}\n{detail}')
        try:
            self.control_board.focus_dub_error(focus)
        except Exception:
            pass
        body = str(detail or '').strip() or str(title).strip()
        if focus.hint:
            body = f'{body}\n\n→ Sửa tại: {focus.hint}'
        self._report_error(title, body, dialog=True)

    def _batch_dub_before_export_enabled(self) -> bool:
        workbench = self._batch_workbench()
        return bool(workbench is not None and workbench.batch_dub_before_export())

    def _batch_skip_stem_separation(self) -> bool:
        workbench = self._batch_workbench()
        return True if workbench is None else not workbench.batch_separate_stems_per_clip()

    def _batch_one_video_at_a_time(self) -> bool:
        workbench = self._batch_workbench()
        return False if workbench is None else workbench.batch_one_video_at_a_time()

    def _batch_auto_scene_split_enabled(self) -> bool:
        from core.scene_clip_fx import effective_auto_scene_split
        return effective_auto_scene_split(self.state.values)

    def _batch_auto_face_reframe_enabled(self) -> bool:
        from core.scene_clip_fx import effective_auto_face_reframe
        return effective_auto_face_reframe(self.state.values)

    def _sync_batch_prep_flag_widgets(self) -> None:
        for key in ('batch_auto_scene_split', 'batch_auto_face_reframe'):
            on = bool(self.state.values.get(key))
            board_ctl = self.control_board.controls.get(key)
            if isinstance(board_ctl, QCheckBox) and board_ctl.isChecked() != on:
                board_ctl.blockSignals(True)
                board_ctl.setChecked(on)
                board_ctl.blockSignals(False)
            workbench = self._batch_workbench()
            wb_ctl = workbench.controls.get(key)
            if workbench is not None and isinstance(wb_ctl, QCheckBox) and (wb_ctl.isChecked() != on):
                wb_ctl.blockSignals(True)
                wb_ctl.setChecked(on)
                wb_ctl.blockSignals(False)
        sync_btn = getattr(self.control_board, '_sync_face_reframe_preview_button', None)
        if callable(sync_btn):
            sync_btn()
            return None

    def _on_batch_prep_flag_toggled(self, key: str, checked: bool) -> None:
        self.state.values[key] = bool(checked)
        board_ctl = self.control_board.controls.get(key)
        if isinstance(board_ctl, QCheckBox) and board_ctl.isChecked() != bool(checked):
            board_ctl.blockSignals(True)
            board_ctl.setChecked(bool(checked))
            board_ctl.blockSignals(False)
        workbench = self._batch_workbench()
        wb_ctl = workbench.controls.get(key)
        if workbench is not None and isinstance(wb_ctl, QCheckBox) and (wb_ctl.isChecked() != bool(checked)):
            wb_ctl.blockSignals(True)
            wb_ctl.setChecked(bool(checked))
            wb_ctl.blockSignals(False)
        if key == 'batch_auto_face_reframe':
            sync_btn = getattr(self.control_board, '_sync_face_reframe_preview_button', None)
            if callable(sync_btn):
                sync_btn(bool(checked))
            if checked:
                self._restore_face_plate_transform(refresh=True)
            else:
                self._deactivate_face_plate_transform(refresh=True)
        self._schedule_autosave()

    def _refresh_face_plate_preview(self) -> None:
        sync = getattr(self.control_board, 'sync_video_transform_controls', None)
        if callable(sync):
            sync()
        refresh_lite = getattr(self.preview_panel, 'refresh_clip_transform_only', None)
        if callable(refresh_lite):
            refresh_lite()
        else:
            self.preview_panel.refresh_settings()
        canvas = getattr(self.preview_panel, 'frame_canvas', None)
        if canvas is not None:
            canvas.update()
            return None

    def _deactivate_face_plate_transform(self, *, refresh: bool) -> bool:
        from core.scene_clip_fx import FACE_PLATE_STASH_KEY, clear_face_plate_transform, effective_auto_face_reframe, stash_face_plate_transform
        from core.timeline_clips import clamp_track_index, clips_from_values
        if effective_auto_face_reframe(self.state.values):
            pass
        else:
            before = clips_from_values(self.state.values)
            before_sig = (len(before), int(self.state.values.get('scale_percent', 100) or 100), int(self.state.values.get('scale_x_percent', 100) or 100), int(self.state.values.get('scale_y_percent', 100) or 100), int(self.state.values.get('offset_x', 0) or 0), int(self.state.values.get('offset_y', 0) or 0))
            working = stash_face_plate_transform(self.state.values)
            cleared = clear_face_plate_transform(working)
            after = clips_from_values(cleared)
            after_sig = (len(after), int(cleared.get('scale_percent', 100) or 100), int(cleared.get('scale_x_percent', 100) or 100), int(cleared.get('scale_y_percent', 100) or 100), int(cleared.get('offset_x', 0) or 0), int(cleared.get('offset_y', 0) or 0))
            changed = before_sig != after_sig or FACE_PLATE_STASH_KEY in cleared
            if changed:
                self.state.values.update(cleared)
                self._timeline_clips_cache = None
                self._timeline_clips_token = None
                if refresh:
                    self._refresh_face_plate_preview()
                    self.statusBar().showMessage('Đã tắt căn mặt — preview về crop/phóng thường (đã lưu kết quả căn mặt)', 4500)
                return True
        return False

    def _restore_face_plate_transform(self, *, refresh: bool) -> bool:
        from core.scene_clip_fx import FACE_PLATE_STASH_KEY, restore_face_plate_transform
        from core.timeline_clips import clamp_track_index, clips_from_values
        if bool(self.state.values.get('batch_auto_face_reframe')):
            has_stash = isinstance(self.state.values.get(FACE_PLATE_STASH_KEY), dict)
            before = clips_from_values(self.state.values)
            before_sig = (len(before), int(self.state.values.get('scale_percent', 100) or 100), int(self.state.values.get('offset_x', 0) or 0), int(self.state.values.get('offset_y', 0) or 0))
            restored = restore_face_plate_transform(self.state.values)
            after = clips_from_values(restored)
            after_sig = (len(after), int(restored.get('scale_percent', 100) or 100), int(restored.get('offset_x', 0) or 0), int(restored.get('offset_y', 0) or 0))
            if before_sig == after_sig and (not has_stash):
                if refresh:
                    self.statusBar().showMessage('Căn mặt đang bật — bấm «Tự căn theo mặt» để tạo khung (chưa có dữ liệu lưu)', 5000)
                return False
            if before_sig == after_sig:
                return False
            self.state.values.update(restored)
            self._timeline_clips_cache = None
            self._timeline_clips_token = None
            if refresh:
                self._refresh_face_plate_preview()
                self.statusBar().showMessage('Đã khôi phục kết quả căn mặt trước đó — không chạy lại', 4500)
            return True
        return False

    def _clear_stale_face_plate_transform(self, *, refresh: bool) -> bool:
        return self._deactivate_face_plate_transform(refresh=refresh)

    def _reframe_from_subject_cache(self, *, refresh: bool) -> bool:
        from core.face_reframe import FACE_SUBJECT_CACHE_KEY, face_subject_cache_usable, reframe_clips_from_subject_cache
        from core.scene_clip_fx import effective_auto_face_reframe, stash_face_plate_transform
        from core.timeline_clips import apply_clip_transform_to_values, clips_from_values, find_clip, selected_clip_id, write_clips
        video = self._selected_video_asset()
        source_path = str(getattr(video, 'path', '') or '')
        mode = str(self.state.values.get('face_reframe_subject_mode', 'face_then_object') or 'face_then_object')
        if face_subject_cache_usable(self.state.values, source_path=source_path, subject_mode=mode):
            cache = self.state.values.get(FACE_SUBJECT_CACHE_KEY)
            if isinstance(cache, dict):
                clips = clips_from_values(self.state.values)
                if clips:
                    plate = str(self.state.values.get('face_reframe_plate', '1:1') or '1:1')
                    axis = str(self.state.values.get('face_reframe_pan_axis', 'horizontal') or 'horizontal')
                    updated, results = (reframe_clips_from_subject_cache(clips, cache, aspect_ratio=str(self.state.values.get('aspect_ratio', '9:16') or '9:16'), quality=str(self.state.values.get('quality', '1080p') or '1080p'), plate_aspect=plate, pan_axis=axis)[0], reframe_clips_from_subject_cache(clips, cache, aspect_ratio=str(self.state.values.get('aspect_ratio', '9:16') or '9:16'), quality=str(self.state.values.get('quality', '1080p') or '1080p'), plate_aspect=plate, pan_axis=axis)[1])
                    write_clips(self.state.values, updated)
                    self._timeline_clips_cache = None
                    self._timeline_clips_token = None
                    sel = selected_clip_id(self.state.values)
                    chosen = find_clip(updated, sel) if sel else None
                    if chosen is None and updated:
                        chosen = updated[0]
                    if chosen is not None:
                        apply_clip_transform_to_values(self.state.values, chosen)
                    self.state.values.update(stash_face_plate_transform(self.state.values))
                    face_on = effective_auto_face_reframe(self.state.values)
                    if not face_on:
                        from core.scene_clip_fx import clear_face_plate_transform
                        cleared = clear_face_plate_transform(self.state.values)
                        self.state.values.update(cleared)
                    if refresh:
                        self._refresh_face_plate_preview()
                        scales = [int(getattr(r, 'scale_percent', 0) or 0) for r in results]
                        sc = f' · phóng ~{min(scales)}–{max(scales)}%' if scales else ''
                        self.statusBar().showMessage(f'Đã áp khung con {plate} từ dữ liệu đã căn{sc} — không chạy lại detector', 5000)
                    self._schedule_autosave()
                    return True
        elif refresh:
            self.statusBar().showMessage('Chưa có dữ liệu căn mặt cho video này — bấm «Tự căn theo mặt» một lần', 5500)
        return False

    def _asset_timeline_clip_count(self, asset_id: str) -> int:
        from core.timeline_clips import clamp_track_index, clips_from_values
        if str(self.state.selected_id or '') == str(asset_id):
            clips = clips_from_values(self.state.values)
        else:
            bucket = self.state.asset_settings.get(asset_id)
            if isinstance(bucket, dict):
                clips = clips_from_values(bucket)
            else:
                return 0
        return sum((1 for clip in clips if clamp_track_index(clip.track_index) == 0))

    def _dub_step_needs_retry(self, step: str) -> bool:
        return self._has_exclusive_job() if self._batch_produce_export_active or self._batch_dub_active else True if self._dub_pipeline_start_blocked() else False

    def _schedule_dub_pipeline_retry(self, step: str, *, log: bool) -> None:
        self._dub_pipeline_steps.insert(0, step)
        self._dub_step_rescheduled = True
        if log and (not getattr(self, '_logged_dub_retry_wait', False)):
            self._logged_dub_retry_wait = True
            self._log_event('Mạch dịch + giọng', f'Chờ slot rồi chạy lại: {step}')
        QTimer.singleShot(350, self._retry_dub_pipeline_after_export_slot)

    def _advance_dub_pipeline(self) -> None:
        if self._should_swap_to_job_state():
            with self._using_job_state():
                return self._advance_dub_pipeline()
        if not self._dub_pipeline_active:
            return None
        if self._has_exclusive_job():
            return None
        if self._batch_produce_export_active:
            if self._dub_pipeline_steps:
                step = self._dub_pipeline_steps[0]
                if self._dub_step_needs_retry(step):
                    self._dub_pipeline_steps.pop(0)
                    self._schedule_dub_pipeline_retry(step, log=False)
                    return None
                self._dub_pipeline_steps.pop(0)
                labels = {'stt': 'Nghe giọng (STT)', 'capcut_api': 'CapCut API — phụ đề', 'capcut_auto': 'AutoCapCut — phụ đề', 'translate': 'Dịch phụ đề', 'tts': 'Tạo giọng đọc (TTS)'}
                self._batch_produce_step = labels.get(step, step)
                prefix = ''
                if self._batch_produce_export_active and self._batch_produce_export_total:
                    done = self._batch_produce_export_completed
                    prefix = f'Xuất hàng loạt {done + 1}/{self._batch_produce_export_total} — '
                elif self._batch_dub_active and self._batch_dub_total:
                    done = self._batch_dub_total - len(self._batch_dub_asset_ids)
                    prefix = f'Clip {done}/{self._batch_dub_total} — '
                self.statusBar().showMessage(f'{prefix}Mạch dịch — {labels.get(step, step)}…')
                if self._batch_produce_export_active:
                    self._update_batch_produce_progress(5, f'{prefix}Mạch dịch — {labels.get(step, step)}…')
                    self._refresh_export_panel_batch_detail()
                self._log_event('Mạch dịch + giọng', labels.get(step, step))
                self._dub_step_rescheduled = False
                pipeline_id = str(getattr(self, '_pipeline_asset_id', '') or '')
                if pipeline_id and str(self.state.selected_id or '') != pipeline_id and (not self._activate_asset_for_dub_pipeline(pipeline_id)):
                    self._abort_dub_pipeline('Không kích hoạt được video đang dub')
                    return None
                if step == 'stt':
                    self.start_speech_recognition()
                    if getattr(self, '_dub_step_rescheduled', False):
                        pass
                    else:
                        task_started = self.subtitle_task is not None or self.tts_task is not None or self.capcut_task is not None
                        if task_started:
                            pass
                        elif self._dub_step_needs_retry(step):
                            self._schedule_dub_pipeline_retry(step, log=False)
                        elif not self._dub_pipeline_active:
                            pass
                        elif getattr(self, '_dub_step_rescheduled', False):
                            pass
                        elif step in frozenset({'tts', 'translate'}) and (not self.state.subtitles.segments) and self._recover_missing_subtitles_for_step(step):
                            pass
                        elif step in frozenset({'capcut_api', 'translate', 'stt', 'tts', 'capcut_auto'}):
                            self._log_event('Mạch dịch + giọng', f'Chưa start được «{step}» — thử lại sau 400ms')
                            self._schedule_dub_pipeline_retry(step, log=False)
                        else:
                            self._abort_dub_pipeline('Không khởi động được bước hiện tại — kiểm tra cấu hình / log chi tiết')
                    return None
                if step == 'capcut_api':
                    self.start_capcut_api_subtitle()
                elif step == 'capcut_auto':
                    self.start_capcut_auto_subtitle()
                elif step == 'translate':
                    self.start_subtitle_translation()
                elif step == 'tts':
                    self.start_tts_voice_generation()
                else:
                    self._abort_dub_pipeline(f'Bước không hỗ trợ: {step}')
                    return None
            else:
                if not self._maybe_export_after_single_dub():
                    self._clear_dub_pipeline()
                return None
        elif self.export_task is not None or self._produce_export_tasks:
            return None

    def _primary_stt_pipeline_step(self) -> str:
        engine = str(self.state.values.get('subtitle_stt_engine', 'groq') or 'groq')
        return {'capcut_api': 'capcut_api', 'capcut_auto': 'capcut_auto'}.get(engine, 'stt')

    def _retry_dub_pipeline_after_export_slot(self) -> None:
        if not self._dub_pipeline_active:
            return None
        if self._dub_pipeline_start_blocked():
            if self._has_export_job() and (not self._has_exclusive_job()):
                QTimer.singleShot(350, self._retry_dub_pipeline_after_export_slot)
            return None
        self._advance_dub_pipeline()

    def _tts_voice_settings(self) -> TTSVoiceSettings:
        self.control_board.flush_tts_settings()
        values = self.state.values
        engine = str(values.get('tts_engine', 'edge'))
        voice = self.control_board._normalize_tts_voice_id(str(values.get('tts_voice', 'vi-VN-HoaiMyNeural')))
        return TTSVoiceSettings(engine=engine, voice=voice, speed=float(values.get('tts_speed', 1.0)), pitch=int(values.get('tts_pitch', 0)), api_key=self._resolved_tts_api_key(engine), model_repo=str(values.get('tts_model_repo', '')), ref_audio=str(values.get('tts_ref_audio', '')), ref_text=str(values.get('tts_ref_text', '')), smart_voice=bool(values.get('tts_smart_voice', True)), proxy=str(values.get('tts_proxy', '')), relay_url=str(values.get('tts_relay_url', '')), relay_secret=str(values.get('tts_relay_secret', '')), max_workers=int(values.get('tts_max_workers', 0)), tts_fit_mode=str(values.get('tts_fit_mode', 'stretch_video')), tts_fit_max_speed=float(values.get('tts_fit_max_speed', 1.2)), lock_lang=str(values.get('subtitle_target_language', '') or '').strip())

    def choose_tts_ref_audio_file(self) -> None:
        path, _selected_filter = (QFileDialog.getOpenFileName(self, 'Chọn file ref audio', get_last_dir('audio', get_last_dir('media')), 'Audio (*.mp3 *.wav *.m4a *.aac *.flac *.ogg);;Tất cả tệp (*.*)')[0], QFileDialog.getOpenFileName(self, 'Chọn file ref audio', get_last_dir('audio', get_last_dir('media')), 'Audio (*.mp3 *.wav *.m4a *.aac *.flac *.ogg);;Tất cả tệp (*.*)')[1])
        if path:
            remember_path('audio', path)
            self.state.values['tts_ref_audio'] = path
            control = self.control_board.controls.get('tts_ref_audio')
            if isinstance(control, QLineEdit):
                control.setText(path)
            self.statusBar().showMessage(f'Đã chọn ref audio: {Path(path).name}')
        else:
            return None

    def _tts_voice_settings_for(self, engine: str | None=None, voice: str | None=None, *, for_preview: bool) -> TTSVoiceSettings:
        self.control_board.flush_tts_settings()
        values = self.state.values
        eff_engine = str(engine or values.get('tts_engine', 'edge'))
        eff_voice = self.control_board._normalize_tts_voice_id(str(voice or values.get('tts_voice', 'vi-VN-HoaiMyNeural')))
        return TTSVoiceSettings(engine=eff_engine, voice=eff_voice, speed=float(values.get('tts_speed', 1.0)), pitch=int(values.get('tts_pitch', 0)), api_key=self._resolved_tts_api_key(eff_engine), model_repo=str(values.get('tts_model_repo', '')), ref_audio=str(values.get('tts_ref_audio', '')), ref_text=str(values.get('tts_ref_text', '')), smart_voice=bool(values.get('tts_smart_voice', True)), proxy=str(values.get('tts_proxy', '')), relay_url=str(values.get('tts_relay_url', '')), relay_secret=str(values.get('tts_relay_secret', '')), max_workers=int(values.get('tts_max_workers', 0)), tts_fit_mode=str(values.get('tts_fit_mode', 'stretch_video')), tts_fit_max_speed=float(values.get('tts_fit_max_speed', 1.2)), lock_lang=_tts_voice_lang(eff_voice) if for_preview else str(values.get('subtitle_target_language', '') or '').strip())

    def _tts_preview_sample_text(self, voice_id: str, label: str='') -> str:
        lang = _tts_voice_lang(voice_id, label)
        samples = {'en': 'This electric SUV feels quick, smooth, and fun to drive — perfect for a car review.', 'zh': '这款电动车驾驶起来非常平稳，动力也很充沛。', 'ja': 'この車は加速がスムーズで、運転していて楽しいです。', 'ko': '이 차는 가속이 부드럽고 운전하는 재미가 있어요.', 'th': 'รถยนต์คันนี้ขับนุ่มนวลและสนุกมากครับ', 'vi': 'Xin chào, đây là bản thử giọng đọc cho video của bạn.', 'es': 'Este SUV eléctrico se siente rápido, suave y divertido de conducir.', 'de': 'Dieses Elektro-SUV fährt sich schnell, ruhig und macht Spaß.', 'fr': 'Ce SUV électrique est vif, fluide et agréable à conduire.', 'nl': 'Deze elektrische SUV voelt snel, soepel en leuk om te rijden.', 'it': 'Questo SUV elettrico è scattante, fluido e piacevole da guidare.'}
        return samples[lang] if lang in samples else samples['vi']

    def _cancel_tts_preview(self) -> None:
        if self.tts_preview_task is not None:
            self.tts_preview_task.cancel()
            self.tts_preview_task = None
        if self._voice_preview_proc is not None:
            try:
                self._voice_preview_proc.terminate()
            except Exception:
                pass
            self._voice_preview_proc = None

    def _tts_preview_job_running(self) -> bool:
        return self.tts_task is not None

    def start_tts_voice_preview_for(self, engine: str, voice_id: str, label: str='') -> None:
        if self._tts_preview_job_running():
            dialog = self.control_board._tts_voice_picker_dialog
            if dialog is not None:
                dialog.set_preview_status('Đang STT/dịch/TTS — chờ hoặc dừng trước khi thử giọng.')
            return None
        self._cancel_tts_preview()
        self._tts_preview_token += 1
        preview_token = self._tts_preview_token
        self._tts_preview_label = label or voice_id
        settings = self._tts_voice_settings_for(engine=engine, voice=voice_id, for_preview=True)
        sample = self._tts_preview_sample_text(voice_id, label)
        voice_label = self._tts_preview_label
        task = TTSPreviewTask(sample, str(PATHS.user_data / 'tts_preview'), settings, preview_token=preview_token)
        self.tts_preview_task = task
        task.signals.completed.connect(lambda path, token=preview_token: self._on_tts_preview_completed(path, token))
        task.signals.failed.connect(lambda message, token=preview_token: self._on_tts_preview_failed(message, token))
        task.signals.finished.connect(self._on_tts_preview_finished)
        self.control_board.set_subtitle_busy(True, 'Đang thử giọng…')
        self.statusBar().showMessage(f'Đang tạo mẫu — {settings.engine} · {voice_label}…')
        dialog = self.control_board._tts_voice_picker_dialog
        if dialog is not None:
            dialog.set_preview_status(f'Đang tạo mẫu: {voice_label}…')
        self._refresh_export_ui()
        self.thread_pool.start(task)

    def start_tts_voice_preview(self) -> None:
        if self._tts_preview_job_running():
            return None
        self._cancel_tts_preview()
        self.control_board.flush_tts_settings()
        settings = self._tts_voice_settings_for(for_preview=True)
        if not self.control_board.tts_credential_provider(settings.engine) or str(settings.api_key or '').strip():
            self._tts_preview_token += 1
            preview_token = self._tts_preview_token
            sample = self._tts_preview_sample_text(str(self.state.values.get('tts_voice', '')), self.control_board.tts_voice_label())
            voice_label = self.control_board.tts_voice_label()
            self._tts_preview_label = voice_label
            task = TTSPreviewTask(sample, str(PATHS.user_data / 'tts_preview'), settings, preview_token=preview_token)
            self.tts_preview_task = task
            task.signals.completed.connect(lambda path, token=preview_token: self._on_tts_preview_completed(path, token))
            task.signals.failed.connect(lambda message, token=preview_token: self._on_tts_preview_failed(message, token))
            task.signals.finished.connect(self._on_tts_preview_finished)
            self.control_board.set_subtitle_busy(True, 'Đang thử giọng…')
            self.statusBar().showMessage(f'Đang tạo mẫu — {settings.engine} · {voice_label}… (bấm Dừng để hủy)')
            self._refresh_export_ui()
            self.thread_pool.start(task)
        else:
            self._report_error('Chưa có khóa TTS', 'ElevenLabs cần API key:\n1) Dán key vào ô «Khóa API TTS» (dưới Tăng tốc tối đa)\n2) Bấm «Lưu khóa» — status phải hiện ✅ Key trên máy: ••••xxxx\n3) Bấm «Thử giọng» lại\n\nLưu ý: nút «Lưu» project (góc trên) KHÔNG lưu API key.\nLấy key: elevenlabs.io → Profile → API Keys')
            self.control_board.focus_control('tts_api_key')
            return None

    def _on_tts_preview_completed(self, voice_path: str, preview_token: int=0) -> None:
        if preview_token != self._tts_preview_token:
            return None
        self._play_audio_preview(voice_path)
        label = self._tts_preview_label or self.control_board.tts_voice_label()
        self.statusBar().showMessage(f'Đang phát thử: {label} — {Path(voice_path).name}', 5000)
        dialog = self.control_board._tts_voice_picker_dialog
        if dialog is not None:
            dialog.set_preview_status(f'Đang phát: {label}')
            return None

    def _on_tts_preview_failed(self, message: str, preview_token: int=0) -> None:
        if preview_token != self._tts_preview_token:
            return None
        dialog = self.control_board._tts_voice_picker_dialog
        if dialog is not None:
            dialog.set_preview_status(message[:120])
        if 'dừng' in message.lower():
            self.statusBar().showMessage('Đã dừng thử giọng')
            return None
        self._report_error('Thử giọng thất bại', message)

    def _on_tts_preview_finished(self) -> None:
        self.tts_preview_task = None
        self.control_board.set_subtitle_busy(False)
        self._refresh_export_ui()

    def _play_audio_preview(self, path: str) -> None:
        if self._voice_preview_proc is not None:
            try:
                self._voice_preview_proc.kill()
            except Exception:
                pass
            self._voice_preview_proc = None
        ffplay = PATHS.ffplay
        player = str(ffplay) if ffplay.is_file() else 'ffplay'
        try:
            self._voice_preview_proc = subprocess.Popen([player, '-nodisp', '-autoexit', '-loglevel', 'quiet', path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            try:
                from core.ffplay_guard import register_ffplay_pid
                register_ffplay_pid(self._voice_preview_proc.pid)
            except Exception:
                return None
        except OSError as exc:
            self._report_error('Không phát được mẫu thử giọng', str(exc))

    def start_capcut_auto_subtitle(self) -> None:
        if self._dub_pipeline_start_blocked():
            return None
        video = self._dub_video_asset()
        if video is not None and video.path:
            output_dir = Path(self._project_output_folder() or Path(video.path).parent) / 'AutoCapCut Sub'
            task = self.capcut_task_factory(video.path, str(output_dir), mode='auto')
            self._start_capcut_task(task, label='AutoCapCut')
        else:
            self.statusBar().showMessage('Hãy chọn video thật trước khi chạy AutoCapCut')
            self._abort_dub_pipeline('Thiếu video cho AutoCapCut')
            return None

    def start_capcut_api_subtitle(self) -> None:
        if self._dub_pipeline_start_blocked():
            if self._dub_pipeline_active:
                self._schedule_dub_pipeline_retry('capcut_api', log=True)
            return None
        video = self._dub_video_asset()
        if video is not None and video.path:
            output_dir = Path(self._project_output_folder() or Path(video.path).parent) / 'CapCut API Sub'
            task = self.capcut_task_factory(video.path, str(output_dir), mode='api')
            self._start_capcut_task(task, label='CapCut API')
        else:
            self.statusBar().showMessage('Hãy chọn video thật trước khi chạy CapCut API')
            self._abort_dub_pipeline('Thiếu video cho CapCut API')
            return None

    def _start_subtitle_task(self, task) -> None:
        if self._can_start_dub_worker():
            self._subtitle_task_kind = 'translate' if isinstance(task, TranslationTask) else 'speech' if isinstance(task, SpeechRecognitionTask) else 'ocr' if isinstance(task, OCRSubtitleTask) else 'subtitle'
            self._log_event('Bắt đầu tác vụ phụ đề', task.__class__.__name__)
            self.subtitle_task = task
            task.signals.progressChanged.connect(self._on_subtitle_progress)
            task.signals.completed.connect(self._on_subtitle_completed)
            task.signals.failed.connect(self._on_subtitle_failed)
            task.signals.finished.connect(self._on_subtitle_finished)
            self.export_progress.setValue(0)
            self.export_progress.setFormat('Đang xử lý phụ đề %p%')
            self.export_progress.show()
            self.control_board.set_subtitle_busy(True, 'Đang chuẩn bị xử lý phụ đề')
            self._refresh_export_ui()
            self.thread_pool.start(task)
            self._restore_detached_editor()
        else:
            return None

    def _start_tts_task(self, task) -> None:
        if self._can_start_dub_worker():
            self._log_event('Bắt đầu tạo giọng đọc', task.__class__.__name__)
            self.tts_task = task
            task.signals.progressChanged.connect(self._on_subtitle_progress)
            task.signals.completed.connect(self._on_tts_completed)
            task.signals.failed.connect(self._on_tts_failed)
            task.signals.finished.connect(self._on_tts_finished)
            self.export_progress.setValue(0)
            self.export_progress.setFormat('Đang tạo giọng đọc %p%')
            self.export_progress.show()
            self.control_board.set_subtitle_busy(True, 'Đang tạo giọng đọc')
            self._refresh_export_ui()
            self.thread_pool.start(task)
            self._restore_detached_editor()
        else:
            return None

    def _start_capcut_task(self, task, label: str='AutoCapCut') -> None:
        if self._can_start_dub_worker():
            self._capcut_task_label = label
            self._log_event(f'Bắt đầu {label}', f"Video: {getattr(task, 'video_path', '')}")
            self.capcut_task = task
            task.signals.progressChanged.connect(self._on_subtitle_progress)
            task.signals.completed.connect(self._on_capcut_completed)
            task.signals.failed.connect(self._on_capcut_failed)
            task.signals.finished.connect(self._on_capcut_finished)
            self.export_progress.setValue(0)
            self.export_progress.setFormat(f'{label} %p%')
            self.export_progress.show()
            self.control_board.set_subtitle_busy(True, f'Đang chạy {label}')
            self._refresh_export_ui()
            self.thread_pool.start(task)
            self._restore_detached_editor()
        else:
            if self._dub_pipeline_active:
                step = 'capcut_api' if 'API' in str(label) else 'capcut_auto'
                self._schedule_dub_pipeline_retry(step, log=True)
            return None

    def stop_subtitle_job(self) -> None:
        if self.subtitle_task is None and self.tts_task is None and (self.capcut_task is None):
            return None
        if self._is_batch_pipeline_active():
            self.stop_batch_job()
            return None
        self._pending_export_after_dub = ''
        self._clear_dub_pipeline()
        if self.subtitle_task is not None:
            self.subtitle_task.cancel()
        if self.tts_task is not None:
            self.tts_task.cancel()
        if self.capcut_task is not None:
            self.capcut_task.cancel()
        self.control_board.subtitle_panel.action_buttons['stop'].setEnabled(False)
        self.statusBar().showMessage('Đang dừng tác vụ…')

    def _on_subtitle_progress(self, value: int, message: str) -> None:
        percent = max(0, min(100, int(value)))
        text = str(message or 'Đang xử lý').strip()
        safe_fmt = text.replace('%', '%%')
        if self._batch_produce_export_active:
            self._batch_produce_step = text
            self._update_batch_produce_progress(percent, f'{text}… {percent}%')
        else:
            self.export_progress.show()
            self.export_progress.setValue(percent)
            self.export_progress.setFormat(f'{safe_fmt} — %p%')
        panel = self.control_board.subtitle_panel
        panel.set_workflow_progress(percent, text)
        if not self._batch_produce_export_active:
            self.statusBar().showMessage(f'{text}… {percent}%')
        prev = getattr(self, '_last_subtitle_progress_log', None)
        signature = (percent, text)
        if prev != signature:
            self._last_subtitle_progress_log = signature
            self._log_event(f'Tiến trình {percent}%', text)
            self._log_activity(f'{text} — {percent}%', title='Phụ đề/TTS')
            return None

    def _on_subtitle_completed(self, document: SubtitleDocument) -> None:
        self._prepare_pipeline_result_apply()
        try:
            self._finish_subtitle_completed(document)
        finally:
            self._restore_detached_editor()

    def _finish_subtitle_completed(self, document: SubtitleDocument) -> None:
        if self._should_swap_to_job_state():
            with self._using_job_state():
                return self._finish_subtitle_completed(document)
        try:
            if document.source_path and Path(document.source_path).is_file():
                ready = document
            else:
                ready = self._persist_subtitle_document(document, self._working_subtitle_path())
        except (OSError, ValueError) as exc:
            self._on_subtitle_failed(f'Không thể lưu phụ đề làm việc: {exc}')
            return None
        self.subtitle_task = None
        self._apply_subtitle_document(ready)
        video = self._dub_video_asset()
        if self._subtitle_task_kind == 'translate' and video is not None:
            self._auto_translate_video_title_for_asset(video)
        self._subtitle_task_kind = ''
        self.control_board.set_subtitle_busy(False)
        self.control_board.focus_subtitle_part('edit')
        if not self._batch_produce_export_active:
            self.export_progress.hide()
            self.export_progress.setValue(0)
        self._refresh_export_ui()
        self.statusBar().showMessage(f'Đã hoàn tất {len(ready.segments)} câu phụ đề')
        self._log_event('Hoàn tất phụ đề', f'{len(ready.segments)} câu')
        if self._dub_pipeline_active and self._dub_pipeline_steps:
            QTimer.singleShot(0, self._advance_dub_pipeline)
        elif self._batch_produce_export_active and self._batch_produce_export_dub_phase and self._dub_pipeline_active and (not self._dub_pipeline_steps):
            asset_id = self._pipeline_asset_id or self.state.selected_id or ''
            self._clear_dub_pipeline()
            self._pipeline_asset_id = None
            self._batch_produce_export_dub_phase = False
            QTimer.singleShot(0, lambda aid=asset_id: self._after_produce_dub_finished(aid))
        elif self._dub_pipeline_active:
            if self._dub_pipeline_steps:
                pass
            elif self._batch_produce_export_active:
                pass
            elif self._batch_dub_active:
                pass
            elif self._maybe_export_after_single_dub():
                pass
            else:
                self._clear_dub_pipeline()
                self._pipeline_asset_id = None
        return None

    def _on_subtitle_failed(self, message: str) -> None:
        if self._batch_pause_requested:
            self._finalize_batch_pause()
            return None
        self.subtitle_task = None
        if self._batch_produce_export_active and self._batch_produce_export_dub_phase:
            asset_id = self._pipeline_asset_id or self.state.selected_id or ''
            self.control_board.set_subtitle_busy(False)
            self.export_progress.hide()
            self.export_progress.setValue(0)
            self._refresh_export_ui()
            self._on_batch_produce_asset_failed(asset_id, message)
            return None
        if self._batch_dub_active:
            asset_id = self._pipeline_asset_id or self.state.selected_id or ''
            self.control_board.set_subtitle_busy(False)
            self.export_progress.hide()
            self.export_progress.setValue(0)
            self._refresh_export_ui()
            self._on_batch_dub_asset_failed(asset_id, message)
            return None
        self._clear_dub_pipeline()
        self.control_board.set_subtitle_busy(False)
        self.export_progress.hide()
        self.export_progress.setValue(0)
        self._refresh_export_ui()
        if 'dừng' in message.lower():
            self.statusBar().showMessage('Đã dừng xử lý phụ đề')
            return None
        self._report_pipeline_error('Xử lý phụ đề không thành công', message)

    def _on_subtitle_finished(self) -> None:
        if self.subtitle_task is not None:
            self.subtitle_task = None
            self.control_board.set_subtitle_busy(False)
            self.export_progress.hide()
            self.export_progress.setValue(0)
            self._refresh_export_ui()
            return None

    def _apply_voice_locked_subtitles(self, voice_path: str='') -> bool:
        from core.av_sync import apply_voice_locked_subtitles_to_values, log_avsync_diagnostic
        from core.tts_source_cues import snapshot_tts_source_if_unlocked
        path = str(voice_path or self.state.values.get('voice_audio_path') or '').strip()
        if path:
            self.state.values['voice_audio_path'] = path
            self.state.values['voice_audio_enabled'] = True
        snapshot_tts_source_if_unlocked(self.state.subtitles, self.state.values)
        locked = apply_voice_locked_subtitles_to_values(self.state.subtitles, self.state.values)
        if locked is None:
            return False
        self.state.set_subtitles(locked)
        panel = getattr(self.control_board, 'subtitle_panel', None)
        if panel is not None and hasattr(panel, 'refresh_document'):
            panel.refresh_document()
        log_avsync_diagnostic(f'[AVSync] Đã khóa {len(locked.segments)} câu phụ đề theo giọng (preview + bảng + xuất cùng mốc)')
        return True

    def _on_tts_completed(self, voice_path: str) -> None:
        self._prepare_pipeline_result_apply()
        try:
            self._finish_tts_completed(voice_path)
        finally:
            self._restore_detached_editor()

    def _finish_tts_completed(self, voice_path: str) -> None:
        if self._should_swap_to_job_state():
            with self._using_job_state():
                return self._finish_tts_completed(voice_path)
        if not self.history.restoring:
            self._push_history()
        self.tts_task = None
        finished_single = self._dub_pipeline_active and (not self._dub_pipeline_steps)
        pipeline_id = str(self._pipeline_asset_id or self.state.selected_id or '').strip()
        voice_text = str(voice_path or '').strip()
        if pipeline_id and voice_text and Path(voice_text).is_file():
            self._produce_voice_by_asset[pipeline_id] = str(Path(voice_text).resolve())
            self._log_event('[AVSync] TTS khóa path xuất', f'{pipeline_id[:8]}… → {Path(voice_text).name}')
        self._snapshot_dub_results_for_pipeline_asset(voice_path)
        self.control_board.set_voice_audio_path(voice_path)
        try:
            voice_ms = probe_audio_duration_ms(voice_path)
        except (OSError, RuntimeError, ValueError, TypeError):
            voice_ms = 0
        if voice_ms > 0:
            self.state.values['voice_audio_duration_ms'] = int(voice_ms)
        overflow_warn = ''
        try:
            from longtieng.longtieng_audio_utils import VOICE_OVERFLOW_WARN_SEC, format_voice_overflow_warning, read_tts_overflow_sidecar
            overflow_sec = read_tts_overflow_sidecar(voice_path)
            if overflow_sec > VOICE_OVERFLOW_WARN_SEC:
                overflow_warn = format_voice_overflow_warning(overflow_sec)
                self._log_event('Giọng đọc tràn hình', overflow_warn)
        except Exception:
            overflow_warn = ''
        self._apply_voice_locked_subtitles(voice_path)
        self.control_board.set_subtitle_busy(False)
        self.control_board.focus_subtitle_part('edit')
        if not self._batch_produce_export_active:
            self.export_progress.hide()
            self.export_progress.setValue(0)
        self._refresh_export_ui()
        if not self._batch_produce_export_active:
            self.preview_panel.refresh_settings()
            self.timeline_panel.reload_project(self.state)
        if self._batch_produce_export_active and self._batch_produce_export_dub_phase:
            asset_id = self._pipeline_asset_id or self.state.selected_id or ''
            self._clear_dub_pipeline()
            self._pipeline_asset_id = None
            self._batch_produce_export_dub_phase = False
            QTimer.singleShot(0, lambda aid=asset_id: self._after_produce_dub_finished(aid))
        elif self._batch_dub_active:
            self._clear_dub_pipeline()
            finished_id = self._pipeline_asset_id or self.state.selected_id or ''
            self._pipeline_asset_id = None
            if self._active_batch_job is not None and finished_id:
                self._active_batch_job.mark_completed(finished_id)
                self._persist_batch_job()
            self._batch_dub_completed += 1
            if self._batch_user_paused:
                self._finalize_batch_pause()
            else:
                QTimer.singleShot(0, self._start_next_batch_dub_asset)
        elif finished_single and self._maybe_export_after_single_dub():
            if overflow_warn:
                self.statusBar().showMessage(overflow_warn)
            self._log_event('Hoàn tất mạch dịch + TTS → xuất', voice_path)
        else:
            self._clear_dub_pipeline()
            self._pipeline_asset_id = None
            if finished_single:
                self.statusBar().showMessage(overflow_warn or 'Mạch dịch xong — đã gắn giọng, tắt tiếng gốc. Bấm Phát để kiểm tra, rồi Xuất video.')
                self._log_event('Hoàn tất mạch dịch + TTS', voice_path)
            else:
                self.statusBar().showMessage(overflow_warn or f'Đã tạo giọng đọc và gắn preview/export: {Path(voice_path).name}. Bấm Phát để nghe kiểm tra.')
                self._log_event('Hoàn tất tạo giọng đọc', voice_path)
        return None

    def _on_tts_failed(self, message: str) -> None:
        if self._batch_pause_requested:
            self._finalize_batch_pause()
            return None
        self.tts_task = None
        if self._batch_produce_export_active and self._batch_produce_export_dub_phase:
            asset_id = self._pipeline_asset_id or self.state.selected_id or ''
            self.control_board.set_subtitle_busy(False)
            self.export_progress.hide()
            self.export_progress.setValue(0)
            self._refresh_export_ui()
            self._on_batch_produce_asset_failed(asset_id, message)
            return None
        if self._batch_dub_active:
            asset_id = self._pipeline_asset_id or self.state.selected_id or ''
            self.control_board.set_subtitle_busy(False)
            self.export_progress.hide()
            self.export_progress.setValue(0)
            self._refresh_export_ui()
            self._on_batch_dub_asset_failed(asset_id, message)
            return None
        self._clear_dub_pipeline()
        self.control_board.set_subtitle_busy(False)
        self.export_progress.hide()
        self.export_progress.setValue(0)
        self._refresh_export_ui()
        if 'dừng' in message.lower():
            self.statusBar().showMessage('Đã dừng tạo giọng đọc')
            return None
        self._report_pipeline_error('Tạo giọng đọc không thành công', message)

    def _on_tts_finished(self) -> None:
        if self.tts_task is not None:
            self.tts_task = None
            self.control_board.set_subtitle_busy(False)
            self.export_progress.hide()
            self.export_progress.setValue(0)
            self._refresh_export_ui()
            return None

    def _on_capcut_completed(self, srt_path: str) -> None:
        self._prepare_pipeline_result_apply()
        try:
            self._finish_capcut_completed(srt_path)
        finally:
            self._restore_detached_editor()

    def _finish_capcut_completed(self, srt_path: str) -> None:
        label = getattr(self, '_capcut_task_label', 'CapCut')
        try:
            document = load_srt(srt_path)
            ready = self._persist_subtitle_document(document, self._working_subtitle_path())
        except (OSError, ValueError) as exc:
            self._on_capcut_failed(f'Không thể đọc phụ đề CapCut: {exc}')
        self.capcut_task = None
        self._apply_subtitle_document(ready)
        self.control_board.set_subtitle_busy(False)
        self.export_progress.hide()
        self.export_progress.setValue(0)
        self._refresh_export_ui()
        self.statusBar().showMessage(f'{label} đã lấy {len(ready.segments)} câu phụ đề')
        self._log_event(f'Hoàn tất {label}', f'{len(ready.segments)} câu từ {srt_path}')
        if self._dub_pipeline_active and self._dub_pipeline_steps:
            QTimer.singleShot(0, self._advance_dub_pipeline)
        elif self._dub_pipeline_active:
            if self._dub_pipeline_steps:
                pass
            elif self._batch_produce_export_active:
                pass
            elif self._batch_dub_active:
                pass
            elif self._maybe_export_after_single_dub():
                pass
            else:
                self._clear_dub_pipeline()
                self._pipeline_asset_id = None

    def _on_capcut_failed(self, message: str) -> None:
        if self._batch_pause_requested:
            self._finalize_batch_pause()
            return None
        label = getattr(self, '_capcut_task_label', 'CapCut')
        self.capcut_task = None
        if self._batch_produce_export_active and self._batch_produce_export_dub_phase:
            asset_id = self._pipeline_asset_id or self.state.selected_id or ''
            self.control_board.set_subtitle_busy(False)
            self.export_progress.hide()
            self.export_progress.setValue(0)
            self._refresh_export_ui()
            self._on_batch_produce_asset_failed(asset_id, message)
            return None
        if self._batch_dub_active:
            asset_id = self._pipeline_asset_id or self.state.selected_id or ''
            self.control_board.set_subtitle_busy(False)
            self.export_progress.hide()
            self.export_progress.setValue(0)
            self._refresh_export_ui()
            self._on_batch_dub_asset_failed(asset_id, message)
            return None
        self._clear_dub_pipeline()
        self.control_board.set_subtitle_busy(False)
        self.export_progress.hide()
        self.export_progress.setValue(0)
        self._refresh_export_ui()
        if 'dừng' in message.lower():
            self.statusBar().showMessage(f'Đã dừng {label}')
            return None
        self._report_pipeline_error(f'{label} không thành công', message)

    def _on_capcut_finished(self) -> None:
        if self.capcut_task is not None:
            self.capcut_task = None
            self.control_board.set_subtitle_busy(False)
            self.export_progress.hide()
            self.export_progress.setValue(0)
            self._refresh_export_ui()
            return None

    def _on_subtitle_document_changed(self, document: SubtitleDocument) -> None:
        if document.segments:
            video = self._selected_video_asset()
            if video is not None:
                self._persist_video_subtitles(video.id)
            elif document.source_path:
                try:
                    save_srt(document, document.source_path)
                except (OSError, ValueError) as exc:
                    self.statusBar().showMessage(f'Chưa lưu được thay đổi phụ đề: {exc}')
            if video is not None:
                self.state.snapshot_asset_settings(video.id)
            self._refresh_project_asset_lists()
            self.timeline_panel.reload_project(self.state)
            self.preview_panel.refresh_settings()
            self._schedule_autosave()
        else:
            self.clear_current_subtitles()

    def _batch_title_target_naming_active(self) -> bool:
        workbench = self.module_workbenches.get('batch')
        if workbench is None:
            return False
        try:
            pass
        except Exception:
            return False

    def _auto_translate_video_title_for_asset(self, asset) -> None:
        if asset is not None and asset.path:
            from core.video_title import apply_source_name_affixes, normalize_title_language_mode, resolve_translated_title_fallback, title_needs_target_translation
            saved = self.state.asset_settings.get(asset.id) or {}
            if not isinstance(saved, dict):
                saved = {}
            force_naming = self._batch_title_target_naming_active()
            enabled = bool(saved.get('video_title_enabled', self.state.values.get('video_title_enabled', False)))
            if enabled or force_naming:
                mode = normalize_title_language_mode(saved.get('video_title_language_mode', self.state.values.get('video_title_language_mode')), from_filename=bool(saved.get('video_title_from_filename', self.state.values.get('video_title_from_filename', True))))
                if force_naming:
                    mode = 'auto_target'
                if mode != 'auto_target':
                    pass
                else:
                    from ui_qt.video_title import title_from_media_path, translate_video_title
                    raw = title_from_media_path(asset.path)
                    if raw:
                        existing = str(saved.get('video_title_content') or '').strip()
                        if not existing and asset.id == self.state.selected_id:
                            existing = str(self.state.values.get('video_title_content') or '').strip()
                        panel = self.control_board.subtitle_panel
                        try:
                            settings = panel.translation_settings()
                        except ValueError as exc:
                            self._log_event('Bỏ dịch tiêu đề', str(exc))
                            return None
                        target_lang = str(getattr(settings, 'target_language', '') or self.state.values.get('subtitle_target_language', 'vi') or 'vi')
                        if not existing or title_needs_target_translation(existing, asset.path, language_mode=mode, from_filename=True, target_language=target_lang):
                            key = self._resolve_provider_api_keys(settings.provider_id, panel.entered_api_key())
                            translated = ''
                            source = 'dịch tiêu đề'
                            try:
                                translated = str(translate_video_title(raw, settings, key=key or '') or '').strip()
                            except Exception as exc:
                                self._log_event('Dịch tiêu đề thất bại', str(exc))
                                translated = ''
                            if translated and title_needs_target_translation(translated, asset.path, language_mode=mode, from_filename=True, target_language=target_lang):
                                translated = ''
                            fallback = resolve_translated_title_fallback(source_path=asset.path, content=existing or raw, language_mode=mode, from_filename=True, target_language=target_lang, subtitle_document=self._subtitle_document_for_asset(asset))
                            if not translated and fallback:
                                translated = fallback
                                source = 'phụ đề đã dịch'
                            sibling = self._sibling_translated_title_fallback(asset)
                            if not translated and sibling:
                                translated = sibling
                                source = 'clip cùng series'
                            if translated:
                                translated = apply_source_name_affixes(translated, asset.path)
                                is_live = str(self.state.selected_id or '') == str(asset.id)
                                if is_live:
                                    self.state.values['video_title_enabled'] = True
                                    self.state.values['video_title_language_mode'] = 'auto_target'
                                    self.state.values['video_title_from_filename'] = True
                                    self.state.values['video_title_content'] = translated
                                if saved:
                                    pass
                                elif is_live:
                                    self.state.snapshot_asset_settings(asset.id)
                                    saved = self.state.asset_settings.get(asset.id, {})
                                else:
                                    from copy import deepcopy
                                    from ui_qt.state import DEFAULT_EXPORT_VALUES
                                    previous = self.state.asset_settings.get(asset.id)
                                    if isinstance(previous, dict) and previous:
                                        saved = deepcopy(previous)
                                    else:
                                        saved = {key: deepcopy(self.state.values.get(key, default)) for key, default in DEFAULT_EXPORT_VALUES.items()}
                                saved['video_title_enabled'] = True
                                saved['video_title_language_mode'] = 'auto_target'
                                saved['video_title_from_filename'] = True
                                saved['video_title_content'] = translated
                                self.state.asset_settings[asset.id] = saved
                                if is_live:
                                    enabled = self.control_board.control('video_title_enabled')
                                    if hasattr(enabled, 'setChecked'):
                                        enabled.setChecked(True)
                                    content = self.control_board.control('video_title_content')
                                    if isinstance(content, QLineEdit):
                                        content.setText(translated)
                                    self.preview_panel.refresh_settings()
                                self._schedule_autosave()
                                self._log_event('Tiêu đề đã dịch', f'{asset.name} ({source}): {translated[:80]}')
                            else:
                                self._log_event('Tiêu đề vẫn tiếng nguồn', f'{asset.name}: dịch AI/free lỗi và phụ đề chưa có bản đích')

    def _sibling_translated_title_fallback(self, asset) -> str:
        import re as _re
        from core.video_title import apply_source_name_affixes, source_part_suffix, title_from_media_path, title_needs_target_translation
        if asset is not None and asset.path:
            stem = title_from_media_path(asset.path)
            if stem and source_part_suffix(asset.path):
                base_match = _re.sub('(?:[\\s._-]*)(?:part|phần)\\s*\\d+\\s*$', '', stem, flags=_re.IGNORECASE).rstrip(' ._')
                if base_match:
                    target_lang = str(self.state.values.get('subtitle_target_language', 'vi') or 'vi')
                    for other in self.state.assets:
                        other_stem = title_from_media_path(other.path)
                        other_base = _re.sub('(?:[\\s._-]*)(?:part|phần)\\s*\\d+\\s*$', '', other_stem, flags=_re.IGNORECASE).rstrip(' ._')
                        bag = self.state.asset_settings.get(other.id) or {}
                        title = str(bag.get('video_title_content') or '').strip()
                        if other is None or other.id == asset.id or (not other.path) or (other_base.casefold() != base_match.casefold()) or (not isinstance(bag, dict)) or (not title) or title_needs_target_translation(title, other.path, language_mode='auto_target', from_filename=True, target_language=target_lang):
                            continue
                        return apply_source_name_affixes(title, asset.path)
        return ''

    def _apply_subtitle_document(self, document: SubtitleDocument) -> None:
        if not self.history.restoring:
            self._push_history()
        if document.segments:
            video = self._selected_video_asset()
            if video is not None:
                from ui_qt.asset_export import source_subtitle_path_for
                from ui_qt.subtitle_source_document import persist_source_subtitle_if_new
                src_path = source_subtitle_path_for(self.subtitle_workspace, project_key=self._subtitle_project_key(), asset_id=str(getattr(video, 'id', '') or '') or 'asset')
                try:
                    src_path.parent.mkdir(parents=True, exist_ok=True)
                    persist_source_subtitle_if_new(self.state, document, src_path, self._persist_subtitle_document)
                except (OSError, ValueError):
                    pass
                try:
                    working = self._persist_subtitle_document(document, self._working_subtitle_path_for(video))
                except (OSError, ValueError) as exc:
                    self._report_error('Không thể lưu phụ đề làm việc', str(exc))
                    return None
                if document.source_path:
                    try:
                        document = SubtitleDocument(document.segments, str(Path(document.source_path).resolve())) if Path(document.source_path).resolve() != Path(working.source_path).resolve() else working
                    except OSError:
                        document = working
                else:
                    document = working
            self.state.set_subtitles(document)
            if video is not None:
                self.state.snapshot_asset_settings(video.id)
            self._refresh_project_asset_lists()
            self.timeline_panel.reload_project(self.state)
            self.control_board.subtitle_panel.refresh_document()
            self.preview_panel.refresh_settings()
            self._schedule_autosave()
        else:
            self.clear_current_subtitles(record_history=False)

    def clear_current_subtitles(self, *, record_history: bool) -> None:
        if record_history and (not self.history.restoring):
            self._push_history()
        video = self._selected_video_asset()
        self._clear_subtitles_for_video(video, remove_working=True)
        self.control_board.subtitle_panel.reset_from_state()
        self._refresh_project_asset_lists()
        self.timeline_panel.reload_project(self.state)
        self.preview_panel.refresh_settings()
        self.statusBar().showMessage('Đã xóa hết phụ đề của video đang chọn', 2500)
        self._schedule_autosave()

    def _clear_subtitles_for_video(self, asset, *, remove_working: bool) -> None:
        working = self._working_subtitle_path_for(asset)
        try:
            if working.is_file():
                working.unlink()
        except OSError:
            pass
        saved = str(self.state.values.get('subtitle_path', '') or '')
        saved_path = Path(saved)
        try:
            if remove_working and asset is not None and getattr(asset, 'path', None) and saved and saved_path.is_file() and (saved_path.resolve() != working.resolve()) and saved_path.name.endswith('_working.srt'):
                saved_path.unlink()
        except OSError:
            pass
        self.state.clear_subtitles()
        if asset is not None:
            self.state.snapshot_asset_settings(asset.id)

    def _persist_video_subtitles(self, asset_id: str) -> None:
        asset = next((a for a in self.state.assets if a.id == asset_id), None)
        if asset is not None and asset.kind == 'video' and asset.path:
            working = self._working_subtitle_path_for(asset)
            if self.state.subtitles.segments:
                try:
                    ready = self._persist_subtitle_document(self.state.subtitles, working)
                except (OSError, ValueError):
                    return None
                self.state.subtitles = ready
                self.state.values['subtitle_path'] = ready.source_path
            else:
                self.state.values['subtitle_enabled'] = False
                self.state.values['subtitle_path'] = ''
                try:
                    if working.is_file():
                        working.unlink()
                except OSError:
                    pass
            self.state.snapshot_asset_settings(asset_id)

    def _load_video_subtitles(self, asset) -> None:
        if asset is not None and asset.kind == 'video' and asset.path:
            working = self._working_subtitle_path_for(asset)
            candidates = []
            if working.is_file():
                candidates.append(working)
            saved = str(self.state.values.get('subtitle_path', '') or '').strip()
            saved_path = Path(saved)
            try:
                if saved and saved_path.is_file() and (saved_path.resolve() != working.resolve()) and self._subtitle_path_belongs_to_video(saved_path, asset):
                    candidates.append(saved_path)
            except OSError:
                pass
            for candidate in candidates:
                try:
                    document = load_srt(candidate)
                    if document.segments:
                        self.state.set_subtitles(document)
                        self.state.values['subtitle_path'] = str(candidate.resolve())
                        saved = self.state.asset_settings.get(asset.id, {}) if asset else {}
                        if isinstance(saved, dict) and 'subtitle_enabled' in saved:
                            self.state.values['subtitle_enabled'] = bool(saved.get('subtitle_enabled'))
                        self.state.snapshot_asset_settings(asset.id)
                        return None
                    continue
                except (OSError, ValueError):
                    continue
        else:
            self.state.clear_subtitles()
            return None
        self.state.clear_subtitles()
        self.state.snapshot_asset_settings(asset.id)

    def _subtitle_path_belongs_to_video(self, path: Path, asset) -> bool:
        if asset.path:
            stem = Path(asset.path).stem.casefold()
            name = path.name.casefold()
            return name.startswith(f'{stem}_') or stem in name
        return False

    def _persist_subtitle_document(self, document: SubtitleDocument, destination: str | Path) -> SubtitleDocument:
        saved_path = save_srt(document, destination)
        return SubtitleDocument(document.segments, saved_path)

    def _subtitle_project_key(self) -> str:
        from ui_qt.asset_export import subtitle_project_key_from_path
        return subtitle_project_key_from_path(str(getattr(self, '_project_path', '') or ''))

    def _sync_subtitles_after_preset_apply(self, target) -> None:
        own = self._working_subtitle_path_for(target)
        attached = str(self.state.values.get('subtitle_path') or '').strip()
        try:
            own_ok = bool(attached) and Path(attached).resolve() == own.resolve()
        except OSError:
            own_ok = False
        self.state.values['subtitle_path'] = ''
        bag = self.state.asset_settings.get(getattr(target, 'id', ''), None)
        if not own_ok and isinstance(bag, dict):
            bag['subtitle_path'] = ''
        src = str(self.state.subtitles.source_path or '')
        try:
            src_is_own = bool(src) and Path(src).resolve() == own.resolve()
        except OSError:
            src_is_own = False
        if getattr(target, 'id', None) == self.state.selected_id and self.state.subtitles.segments:
            if src_is_own or not src:
                try:
                    saved = self._persist_subtitle_document(self.state.subtitles, own)
                    self.state.values['subtitle_path'] = str(Path(saved.source_path).resolve())
                    self.state.snapshot_asset_settings(target.id)
                except (OSError, ValueError):
                    pass
                return None
        else:
            self._load_video_subtitles(target)
            return None

    def _should_start_dub_after_preset_apply(self) -> bool:
        from core.tts_source_cues import tts_document_for_task
        return tts_document_for_task(self.state.subtitles, self.state.values) is not None if self.state.subtitles.segments else False

    def _working_subtitle_path_for(self, asset) -> Path:
        from ui_qt.asset_export import working_subtitle_path_for
        aid = str(getattr(asset, 'id', '') or '') or 'asset'
        path = working_subtitle_path_for(self.subtitle_workspace, project_key=self._subtitle_project_key(), asset_id=aid)
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    def _working_subtitle_path(self) -> Path:
        return self._working_subtitle_path_for(self._selected_video_asset())

    def _suggested_export_output_path(self, asset, settings: VideoExportSettings, naming: str) -> Path:
        source = Path(asset.path)
        export_dir = self._project_output_folder() or get_last_export_folder(str(source.parent))
        stem = self._export_asset_stem(asset, settings, naming)
        return Path(export_dir) / f'{stem}.mp4' if naming == 'title_target' else Path(export_dir) / f'{source.stem}_xuat.mp4'

    def _pick_export_output_path(self, suggested: Path) -> str:
        self.raise_()
        self.activateWindow()
        dialog = QFileDialog(self, 'Lưu video đã xử lý')
        dialog.setAcceptMode(QFileDialog.AcceptMode.AcceptSave)
        dialog.setNameFilter('Video MP4 (*.mp4)')
        dialog.selectFile(str(suggested))
        dialog.setDefaultSuffix('mp4')
        dialog.setFileMode(QFileDialog.FileMode.AnyFile)
        if dialog.exec() != QFileDialog.DialogCode.Accepted:
            return ''
        picked = dialog.selectedFiles()
        return str(picked[0]) if picked else ''

    def choose_export_path(self) -> None:
        if not self._ensure_licensed_or_warn(action='Xuất video'):
            return None
        if self._has_exclusive_job():
            self._report_error('Chưa thể xuất video', 'Đang chạy phụ đề / TTS / CapCut. Bấm «Dừng xuất» hoặc chờ xong.', dialog=True)
            return None
        if self._single_export_prep_active:
            self.statusBar().showMessage('Đang tách cảnh/căn mặt trước xuất — chờ xong hoặc «Dừng xuất»', 4000)
            return None
        if self.export_task is not None:
            self.statusBar().showMessage('Đang xuất video — chờ xong hoặc bấm «Dừng xuất»', 4000)
            return None
        asset = self._selected_export_asset()
        if asset is not None and asset.path:
            source = Path(asset.path)
            self._ensure_voice_wanted_for_export(asset)
            template_wants_dub = bool(self.state.values.get('subtitle_enabled')) or bool(self.state.values.get('voice_audio_enabled'))
            needs_dub = asset_needs_dub_pipeline(asset, self.state, subtitle_workspace=self.subtitle_workspace, project_key=self._subtitle_project_key())
            preflight_values = dict(self.state.values)
            preflight_values['_preflight_video_path'] = asset.path
            if self._confirm_export_preflight(skip_voice_audio=bool(template_wants_dub and needs_dub), skip_subtitle_file=bool(template_wants_dub and needs_dub), title='Kiểm tra trước khi xuất', values=preflight_values):
                naming = 'stem_xuat'
                batch_wb = self.module_workbenches.get('batch')
                if batch_wb is not None:
                    naming = batch_wb.batch_naming_mode()
                try:
                    settings = self._attach_voice_duration(self._export_settings_for_asset(asset.id))
                except ValueError as exc:
                    self._report_error('Chưa thể xuất video', str(exc), dialog=True)
                    return None
                voice_path = str(settings.voice_audio_path or '').strip()
                if not bool(settings.voice_audio_enabled) or needs_dub or (voice_path and Path(voice_path).is_file()):
                    suggested = self._suggested_export_output_path(asset, settings, naming)
                    try:
                        suggested.parent.mkdir(parents=True, exist_ok=True)
                    except OSError as exc:
                        self._report_error('Không tạo được thư mục xuất', str(exc), dialog=True)
                    use_dialog = bool(QApplication.keyboardModifiers() & Qt.KeyboardModifier.ShiftModifier)
                    if use_dialog:
                        self.statusBar().showMessage('Chọn nơi lưu file xuất…')
                        output = self._pick_export_output_path(suggested)
                        if not output:
                            self.statusBar().showMessage('Đã hủy xuất — không chọn file lưu', 3500)
                            return None
                    else:
                        output = str(suggested)
                        if suggested.is_file():
                            box = QMessageBox(self)
                            box.setIcon(QMessageBox.Icon.Question)
                            box.setWindowTitle('Ghi đè file xuất?')
                            box.setText(f'Đã có file:\n{suggested.name}')
                            box.setInformativeText('Ghi đè và xuất lại?')
                            box.setStandardButtons(QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No)
                            box.setDefaultButton(QMessageBox.StandardButton.Yes)
                            if box.exec() != QMessageBox.StandardButton.Yes:
                                self.statusBar().showMessage('Đã hủy xuất', 2500)
                                return None
                        else:
                            self.statusBar().showMessage(f'Đang xuất → {suggested.name}…')
                else:
                    self._report_error('Thiếu file giọng đọc', 'Đã bật ghép giọng nhưng chưa có file TTS cho clip này.\nBấm «Chạy đầy đủ clip đang chọn» (hoặc xuất lại để tự dub), hoặc tắt «Ghép file lồng tiếng» nếu không cần giọng.', dialog=True)
                    return None
            else:
                return None
        else:
            self.statusBar().showMessage('Hãy chọn một video thật trước khi xuất')
            return None
        warning = export_disk_warning(output, source_size_bytes=int(source.stat().st_size))
        if warning:
            box = QMessageBox(self)
            box.setIcon(QMessageBox.Icon.Warning)
            box.setWindowTitle('Ổ đĩa gần đầy')
            box.setText(warning)
            box.setInformativeText('Vẫn có thể tiếp tục, nhưng nên chọn file lưu trên ổ D: hoặc dọn dung lượng ổ C: trước.')
            box.setStandardButtons(QMessageBox.StandardButton.Ok | QMessageBox.StandardButton.Cancel)
            box.setDefaultButton(QMessageBox.StandardButton.Ok)
            if box.exec() != QMessageBox.StandardButton.Ok:
                self.statusBar().showMessage('Đã hủy xuất', 2500)
                return None
        else:
            remember_path('export', output)
            want_scene = self._batch_auto_scene_split_enabled() and self._asset_timeline_clip_count(asset.id) <= 1
            want_face = self._batch_auto_face_reframe_enabled()
            if want_scene or want_face:
                self._start_single_export_with_prep(asset, output)
            elif template_wants_dub and needs_dub:
                self._start_single_export_with_dub(asset, output)
            else:
                self._export_to_path(output)
            return None

    def _clear_single_export_prep(self) -> None:
        self._disarm_single_export_prep_watchdog()
        self._single_export_prep_active = False
        self._single_export_prep_output = ''
        self._single_export_prep_asset_id = ''
        self._single_export_prep_step = ''
        self._single_export_face_done = False
        self._single_export_scene_skipped = False

    def _disarm_single_export_prep_watchdog(self) -> None:
        timer = getattr(self, '_single_export_prep_watchdog', None)
        if timer is not None:
            if timer.isActive():
                timer.stop()
            return None

    def _arm_single_export_prep_watchdog(self, step: str) -> None:
        self._disarm_single_export_prep_watchdog()
        msec = 100000 if step == 'scene' else 180000
        self._single_export_prep_watchdog.start(msec)

    def _arm_or_skip_single_export_after_scene_fail(self) -> None:
        if not self._single_export_prep_active:
            return None
        if self._single_export_prep_step != 'scene':
            return None
        self._disarm_single_export_prep_watchdog()
        self.timeline_panel.set_scene_split_busy(False)
        self._single_export_prep_step = ''
        self._single_export_scene_skipped = True
        QTimer.singleShot(0, self._advance_single_export_prep)

    def _on_single_export_prep_watchdog(self) -> None:
        if self._single_export_prep_active:
            step = str(self._single_export_prep_step or '')
            if step not in frozenset({'scene', 'face'}):
                return None
            self._log_event('Xuất 1 clip — hết giờ chuẩn bị', f'bước={step} — bỏ qua, tiếp tục xuất')
            self.statusBar().showMessage(f'Hết giờ «{step}» — bỏ qua, tiếp tục xuất…', 6000)
            if step == 'scene':
                task = self.scene_detect_task
                if task is not None and hasattr(task, 'cancel'):
                    task.cancel()
                self.timeline_panel.set_scene_split_busy(False)
                self._single_export_prep_step = ''
                self._single_export_scene_skipped = True
                QTimer.singleShot(0, self._advance_single_export_prep)
                return None
            if step == 'face':
                task = self.face_reframe_task
                if task is not None and hasattr(task, 'cancel'):
                    task.cancel()
                self._single_export_face_done = True
                self._single_export_prep_step = ''
                self._batch_produce_prep_asset_id = ''
                self._batch_produce_prep_step = ''
                QTimer.singleShot(0, self._advance_single_export_prep)
                return None
        else:
            return None

    def _start_single_export_with_prep(self, asset, output: str) -> None:
        if asset is None or not getattr(asset, 'path', None):
            self.statusBar().showMessage('Không có video hợp lệ để xuất')
            return None
        if self._single_export_prep_active:
            self.statusBar().showMessage('Đang chuẩn bị tách cảnh/căn mặt cho xuất — chờ xong hoặc «Dừng xuất»', 4000)
            return None
        self.state.snapshot_asset_settings(asset.id)
        self._single_export_prep_active = True
        self._single_export_prep_output = str(output)
        self._single_export_prep_asset_id = str(asset.id)
        self._single_export_prep_step = ''
        self._single_export_face_done = False
        self._single_export_scene_skipped = False
        self._log_event('Xuất 1 clip — chuẩn bị', f'{asset.name} · tách cảnh={self._batch_auto_scene_split_enabled()} · căn mặt={self._batch_auto_face_reframe_enabled()}')
        self.export_progress.setValue(0)
        self.export_progress.setFormat('Chuẩn bị xuất %p%')
        self.export_progress.show()
        self.export_panel.begin(f'Xuất: {Path(output).name}')
        self.export_panel.set_progress(1, 'Tách cảnh / căn mặt theo mẫu…')
        self.export_panel.step_label.setText('Bước: tách cảnh → căn mặt → (dub) → ffmpeg')
        self.export_panel.step_label.setVisible(True)
        self._refresh_export_ui()
        self.statusBar().showMessage('Đang tách cảnh / căn mặt theo mẫu rồi mới xuất…')
        QTimer.singleShot(0, self._advance_single_export_prep)

    def _advance_single_export_prep(self) -> None:
        if self._single_export_prep_active:
            asset_id = str(self._single_export_prep_asset_id or '')
            output = str(self._single_export_prep_output or '').strip()
            asset = self._video_asset_by_id(asset_id)
            if asset is not None and output:
                need_scene = self._batch_auto_scene_split_enabled() and self._asset_timeline_clip_count(asset_id) <= 1 and (not bool(getattr(self, '_single_export_scene_skipped', False)))
                need_face = self._batch_auto_face_reframe_enabled() and (not self._single_export_face_done)
                if need_scene:
                    if self.scene_detect_task is not None or self.face_reframe_task is not None:
                        QTimer.singleShot(200, self._advance_single_export_prep)
                    else:
                        self._single_export_prep_step = 'scene'
                        self._arm_single_export_prep_watchdog('scene')
                        self._log_event('Xuất 1 clip — tách cảnh', asset.name)
                        try:
                            self.export_panel.set_progress(2, f'{asset.name} — tách cảnh…')
                        except Exception:
                            pass
                        self.statusBar().showMessage(f'Xuất: tách cảnh «{asset.name}»…')
                        self._begin_scene_detect_for_video(asset)
                elif need_face:
                    if self.scene_detect_task is not None or self.face_reframe_task is not None:
                        QTimer.singleShot(200, self._advance_single_export_prep)
                    else:
                        self._single_export_prep_step = 'face'
                        self._batch_produce_prep_asset_id = str(asset_id)
                        self._batch_produce_prep_step = 'face'
                        self._arm_single_export_prep_watchdog('face')
                        self._log_event('Xuất 1 clip — căn mặt', asset.name)
                        try:
                            self.export_panel.set_progress(4, f'{asset.name} — căn mặt / chủ thể…')
                        except Exception:
                            pass
                        self.statusBar().showMessage(f'Xuất: căn mặt/chủ thể «{asset.name}»…')
                        self._begin_face_reframe_for_asset(asset)
                else:
                    self._disarm_single_export_prep_watchdog()
                    self._finish_single_export_prep_and_export()
            else:
                self._clear_single_export_prep()
                self._report_error('Xuất video', 'Mất video hoặc đường lưu khi chuẩn bị tách cảnh/căn mặt.', dialog=True)

    def _finish_single_export_prep_and_export(self) -> None:
        output = str(self._single_export_prep_output or '').strip()
        asset_id = str(self._single_export_prep_asset_id or '')
        self._clear_single_export_prep()
        asset = self._video_asset_by_id(asset_id)
        if asset is not None and output:
            if str(self.state.selected_id or '') == str(asset.id):
                self.state.snapshot_asset_settings(asset.id)
            template_wants_dub = bool(self.state.values.get('subtitle_enabled')) or bool(self.state.values.get('voice_audio_enabled'))
            needs_dub = asset_needs_dub_pipeline(asset, self.state, subtitle_workspace=self.subtitle_workspace, project_key=self._subtitle_project_key())
            self._log_event('Xuất 1 clip — hết chuẩn bị', f'{asset.name} → {output}')
            if template_wants_dub and needs_dub:
                self._start_single_export_with_dub(asset, output)
            else:
                try:
                    self.export_panel.set_progress(8, 'Bắt đầu ffmpeg…')
                except Exception:
                    pass
                self._export_to_path(output)
        else:
            self._report_error('Xuất video', 'Không tiếp tục được sau bước tách cảnh/căn mặt.', dialog=True)

    def _start_single_export_with_dub(self, asset, output: str) -> None:
        err = self._validate_dub_prerequisites()
        if err:
            self._report_error('Chưa thể xuất video', err, dialog=True)
            return None
        stt_engine = str(self.state.values.get('subtitle_stt_engine', 'groq'))
        if stt_engine == 'capcut_auto':
            self._report_error('Chưa thể xuất với AutoCapCut', 'AutoCapCut cần mở app CapCut desktop. Chọn «CapCut API» hoặc STT khác ở Cách nghe giọng, rồi xuất lại.', dialog=True)
            return None
        if self._dub_pipeline_start_blocked():
            self._report_error('Chưa thể xuất video', 'Đang có tác vụ phụ đề/TTS khác. Bấm «Dừng xuất» hoặc chờ xong.', dialog=True)
            return None
        self.state.snapshot_asset_settings(asset.id)
        self._prepare_dub_defaults()
        self._batch_dub_active = False
        self._batch_dub_asset_ids = []
        self._pipeline_asset_id = asset.id
        self._pending_export_after_dub = str(output)
        self._dub_pipeline_steps = self._build_dub_pipeline_steps()
        self._dub_pipeline_active = True
        out_name = Path(output).name
        self._log_event('Xuất 1 clip — dub trước', f"{asset.name} → {output} · bước: {', '.join(self._dub_pipeline_steps) or 'sẵn sàng'}")
        if self._dub_pipeline_steps:
            self.export_progress.setValue(0)
            self.export_progress.setFormat('Tạo phụ đề/giọng trước xuất %p%')
            self.export_progress.show()
            self.export_panel.begin(f'Xuất: {out_name}')
            self.export_panel.set_progress(2, 'Đang tạo phụ đề / giọng theo setup…')
            self.export_panel.step_label.setText('Bước: STT → dịch → TTS, xong tự xuất ffmpeg')
            self.export_panel.step_label.setVisible(True)
            self._refresh_export_ui()
            self.statusBar().showMessage('Đã setup phụ đề/giọng — đang tạo SRT/TTS rồi tự xuất video…')
            self._advance_dub_pipeline()
        else:
            self._maybe_export_after_single_dub()
            return None

    def _maybe_export_after_single_dub(self) -> bool:
        pending = str(getattr(self, '_pending_export_after_dub', '') or '').strip()
        if not pending:
            return False
        if self._batch_produce_export_active or self._batch_dub_active:
            return False
        self._pending_export_after_dub = ''
        self._clear_dub_pipeline()
        self._pipeline_asset_id = None
        self._log_event('Xuất sau khi tạo phụ đề/giọng', pending)
        self.statusBar().showMessage('Đã tạo phụ đề/giọng — bắt đầu xuất video…')
        try:
            self.export_panel.set_progress(8, 'Bắt đầu ffmpeg…')
        except Exception:
            pass
        QTimer.singleShot(0, lambda path=pending: self._export_to_path(path))
        return True

    def choose_project_file(self) -> None:
        if not self._has_exclusive_job() or self._is_export_pipeline_busy():
            if self._has_export_job():
                self.statusBar().showMessage('Đang xuất nền — có thể mở dự án khác; lệnh xuất hiện tại vẫn chạy', 3500)
            path, _selected_filter = (QFileDialog.getOpenFileName(self, f'Mở dự án {APP_DISPLAY_NAME}', get_last_dir('project'), f'{APP_DISPLAY_NAME} Project (*.vtp.json);;Tất cả tệp (*.*)')[0], QFileDialog.getOpenFileName(self, f'Mở dự án {APP_DISPLAY_NAME}', get_last_dir('project'), f'{APP_DISPLAY_NAME} Project (*.vtp.json);;Tất cả tệp (*.*)')[1])
            if path:
                remember_path('project', path)
                try:
                    keep_pipeline = self._pin_export_job_if_busy()
                    self._persist_current_project_before_switch()
                    self._load_project(path, keep_pipeline=keep_pipeline)
                except (OSError, ValueError, TypeError, KeyError) as exc:
                    self._report_error('Không thể mở dự án', str(exc))
                    return None
        else:
            self.statusBar().showMessage('Đang có tác vụ phụ đề/TTS — chờ xong rồi mở dự án khác', 3500)

    def choose_project_save_path(self) -> None:
        if self._has_exclusive_job():
            self.statusBar().showMessage('Đang có tác vụ phụ đề/TTS — chờ xong rồi lưu dự án', 3500)
        else:
            suggested = Path(self._project_path or Path(get_last_dir('project', str(Path.home()))) / 'tdt_project.vtp.json')
            path, _selected_filter = (QFileDialog.getSaveFileName(self, f'Lưu dự án {APP_DISPLAY_NAME}', str(suggested), f'{APP_DISPLAY_NAME} Project (*.vtp.json)')[0], QFileDialog.getSaveFileName(self, f'Lưu dự án {APP_DISPLAY_NAME}', str(suggested), f'{APP_DISPLAY_NAME} Project (*.vtp.json)')[1])
            if path:
                remember_path('project', path)
                destination = Path(path)
                if destination.suffix.lower() != '.json':
                    destination = destination.with_suffix('.vtp.json')
                try:
                    self.state.snapshot_asset_settings()
                    self._persist_current_sfx()
                    project_name = self.project_panel.project_name.text().strip() or destination.stem
                    saved_path = save_named_project(self.state, destination, project_name=project_name)
                    save_session(self.state)
                except (OSError, TypeError, ValueError) as exc:
                    self._report_error('Không thể lưu dự án', str(exc))
                    return None
                self._project_path = saved_path
                self._refresh_project_browser()
                self.statusBar().showMessage(f'Đã lưu dự án: {project_name}')

    def choose_export_preset_save_path(self) -> None:
        if self._has_background_job():
            pass
        else:
            preset_dir = PATHS.user_data / 'export_presets'
            path, _selected_filter = (QFileDialog.getSaveFileName(self, 'Lưu preset edit/export', str(preset_dir / 'preset_edit.vtp-preset.json'), f'{APP_DISPLAY_NAME} Edit Preset (*.vtp-preset.json);;JSON (*.json)')[0], QFileDialog.getSaveFileName(self, 'Lưu preset edit/export', str(preset_dir / 'preset_edit.vtp-preset.json'), f'{APP_DISPLAY_NAME} Edit Preset (*.vtp-preset.json);;JSON (*.json)')[1])
            if path:
                destination = Path(path)
                if destination.suffix.lower() != '.json':
                    destination = destination.with_suffix('.vtp-preset.json')
                try:
                    saved_path = save_export_preset(self.state, destination)
                except (OSError, ValueError, TypeError) as exc:
                    self._report_error('Không thể lưu preset', str(exc))
                    return None
                self.statusBar().showMessage(f'Đã lưu preset: {Path(saved_path).name}')
                self._log_event('Đã lưu preset edit/export', saved_path)

    def choose_export_preset_file(self) -> None:
        if self._has_background_job():
            pass
        else:
            preset_dir = PATHS.user_data / 'export_presets'
            path, _selected_filter = (QFileDialog.getOpenFileName(self, 'Nạp preset edit/export', str(preset_dir), f'{APP_DISPLAY_NAME} Edit Preset (*.vtp-preset.json);;JSON (*.json);;Tất cả tệp (*.*)')[0], QFileDialog.getOpenFileName(self, 'Nạp preset edit/export', str(preset_dir), f'{APP_DISPLAY_NAME} Edit Preset (*.vtp-preset.json);;JSON (*.json);;Tất cả tệp (*.*)')[1])
            if path:
                try:
                    values = load_export_preset(path)
                except (OSError, ValueError, TypeError) as exc:
                    self._report_error('Không thể nạp preset', str(exc))
                    return None
                self.state.values.update(values)
                self.control_board.reload_project(self.state)
                self.preview_panel.refresh_settings()
                self._refresh_export_ui()
                self.statusBar().showMessage(f'Đã nạp preset: {Path(path).name}')
                self._log_event('Đã nạp preset edit/export', path)

    def _load_project(self, path: str, *, keep_pipeline: bool) -> None:
        self._suppress_autosave = True
        try:
            loaded = load_project(path)
            self.state = loaded
            self._project_path = str(Path(path).expanduser().resolve())
            remember_project_path(self._project_path)
            self._user_edit_asset_id = ''
            self._apply_loaded_project(status_message=f'Đã mở dự án: {read_project_name(self._project_path)}' + (' · xuất lô vẫn chạy nền' if keep_pipeline else ''), keep_pipeline=keep_pipeline)
            try:
                save_session(self.state)
            except OSError:
                pass
        finally:
            self._suppress_autosave = False

    def choose_batch_export_folder(self) -> None:
        if not self._ensure_licensed_or_warn(action='Xuất hàng loạt'):
            return None
        if self._has_background_job():
            self._report_error('Chưa thể xuất hàng loạt', 'Đang có tác vụ chạy (xuất, STT, TTS, …). Bấm «Dừng xuất» rồi thử lại.', dialog=True)
            return None
        if self._video_assets():
            from ui_qt.user_prefs import is_ephemeral_export_dir
            workbench = self.module_workbenches.get('batch')
            folder = ''
            if workbench is not None:
                folder = str(workbench.export_folder() or '').strip()
            if not folder or not Path(folder).is_dir() or is_ephemeral_export_dir(folder):
                if folder and is_ephemeral_export_dir(folder):
                    self.statusBar().showMessage('Thư mục xuất tạm (pytest) bị bỏ — chọn thư mục thật', 6000)
                    if workbench is not None:
                        workbench.set_export_folder('')
                folder = QFileDialog.getExistingDirectory(self, 'Chọn thư mục lưu batch', self._project_output_folder() or get_last_export_folder(str(Path.home() / 'Desktop')))
                if not folder:
                    return None
                if is_ephemeral_export_dir(folder):
                    self._report_error('Thư mục xuất không hợp lệ', 'Không dùng thư mục tạm pytest/temp làm nơi xuất batch.', dialog=True)
                    return None
                if workbench is not None:
                    workbench.set_export_folder(folder)
            else:
                videos = self._video_assets()
                total_source = sum((int(Path(asset.path).stat().st_size) for asset in videos if asset.path and Path(asset.path).is_file()))
                warning = export_disk_warning(folder, source_size_bytes=total_source)
                if warning:
                    box = QMessageBox(self)
                    box.setIcon(QMessageBox.Icon.Warning)
                    box.setWindowTitle('Ổ đĩa gần đầy')
                    box.setText(warning)
                    box.setInformativeText('Gợi ý: chọn thư mục trên ổ D: (vd. D:\\VideoExport) thay vì folder project trên ổ C:.')
                    box.setStandardButtons(QMessageBox.StandardButton.Ok | QMessageBox.StandardButton.Cancel)
                    box.setDefaultButton(QMessageBox.StandardButton.Ok)
                    if box.exec() != QMessageBox.StandardButton.Ok:
                        return None
                else:
                    remember_path('export', folder)
                    if workbench is not None:
                        workbench.set_export_folder(folder)
                    n = len(self._video_assets())
                    self.statusBar().showMessage(f'Chuẩn bị xuất hàng loạt {n} video…', 8000)
                    QApplication.processEvents()
                    QTimer.singleShot(0, lambda f=folder: self._batch_export_to_folder_deferred(f))
        else:
            self.statusBar().showMessage('Hãy thêm video thật trước khi xuất hàng loạt')
            return None

    def _batch_export_to_folder_deferred(self, folder: str) -> None:
        try:
            self._batch_export_to_folder(folder)
        except Exception as exc:
            self._report_error('Xuất hàng loạt lỗi khi chuẩn bị', str(exc), dialog=True)
        finally:
            self._refresh_project_work_context()

    def _batch_export_to_folder(self, folder: str) -> None:
        videos = self._video_assets()
        if videos:
            output_dir = Path(folder).expanduser().resolve()
            from core.audio_intent import AUDIO_INTENT_KEYS, capture_audio_intent
            click_intent = capture_audio_intent(self.state.values)
            source = 'live'
            self._log_event('Audio intent lúc bấm', 'nguồn=' + source + ' · ' + ' · '.join((f'{key}={click_intent.get(key)}' for key in AUDIO_INTENT_KEYS)))
            self._log_event('Xuất hàng loạt — bắt đầu', f'{len(videos)} video → {output_dir}')
            self.statusBar().showMessage(f'Chuẩn bị xuất hàng loạt {len(videos)} video…', 8000)
            QApplication.processEvents()
            workbench = self.module_workbenches.get('batch')
            auto_apply = workbench.batch_auto_apply_template() if workbench is not None else True
            dub_before = workbench.batch_dub_before_export() if workbench is not None else True
            if auto_apply:
                self.statusBar().showMessage(f'Áp mẫu edit cho {len(videos)} video trước khi xuất…', 8000)
                QApplication.processEvents()
                applied = self._apply_batch_template()
                QApplication.processEvents()
                self._log_event('Áp mẫu batch', f'{applied} video')
                self.refresh_batch_queue()
                QApplication.processEvents()
                self._schedule_autosave()
            elif self.state.selected_id:
                self.state.snapshot_asset_settings(self.state.selected_id)
                self._schedule_autosave()
            frozen = {}
            if auto_apply:
                for video in videos:
                    frozen[str(video.id)] = copy.deepcopy(click_intent)
            else:
                for video in videos:
                    if str(video.id) == str(self.state.selected_id or ''):
                        frozen[str(video.id)] = copy.deepcopy(click_intent)
                    else:
                        bag = self.state.asset_settings.get(video.id) or {}
                        frozen[str(video.id)] = capture_audio_intent(bag)
            self._frozen_audio_intent_by_asset = frozen
            self._ensure_voice_wanted_for_export(self.state.selected_asset)
            will_dub = dub_before and self._any_asset_needs_dub()
            want_scene = self._batch_auto_scene_split_enabled()
            want_face = self._batch_auto_face_reframe_enabled()
            if self._confirm_export_preflight(skip_voice_audio=bool(dub_before), skip_subtitle_file=bool(dub_before), title='Kiểm tra trước khi xuất hàng loạt'):
                use_produce_loop = bool(will_dub or want_scene or want_face or (dub_before and (bool(self.state.values.get('subtitle_enabled')) or bool(self.state.values.get('voice_audio_enabled')))))
                if use_produce_loop:
                    if want_scene or want_face:
                        self._batch_face_done_ids = set()
                        self._batch_scene_done_ids = set()
                        self._batch_produce_prep_asset_id = ''
                        self._batch_produce_prep_step = ''
                        self._log_event('Xuất hàng loạt — prep từng video', f'tách cảnh={want_scene} · căn mặt={want_face}')
                    if will_dub or (dub_before and (bool(self.state.values.get('subtitle_enabled')) or bool(self.state.values.get('voice_audio_enabled')))):
                        if not will_dub:
                            self._log_event('Xuất hàng loạt — dub theo mẫu', 'Mẫu bật phụ đề/giọng — chạy mạch tạo SRT/TTS trước ffmpeg')
                        self._log_event('Xuất hàng loạt — dub trước', f'{len(videos)} video, thư mục {output_dir}')
                        err = self._validate_dub_prerequisites()
                        if err:
                            self._report_error('Chưa thể xuất hàng loạt', err)
                            return None
                        stt_engine = str(self.state.values.get('subtitle_stt_engine', 'groq'))
                        if stt_engine == 'capcut_auto':
                            self._report_error('Không xuất hàng loạt với AutoCapCut', 'AutoCapCut cần mở app CapCut desktop từng clip. Chọn «CapCut API» ở Cách nghe giọng, hoặc bấm AutoCapCut thủ công 1 clip.')
                            return None
                    else:
                        self._start_batch_produce_export(folder)
                        return None
                else:
                    self._log_event('Xuất hàng loạt — ffmpeg trực tiếp', f'{len(videos)} video (không cần dub tự động)')
                    naming = workbench.batch_naming_mode() if workbench is not None else 'stem_edit'
                    on_error = workbench.batch_on_error_mode() if workbench is not None else 'skip'
                    workbench = self.module_workbenches.get('batch')
                    requested_parallel = self._batch_parallel_workers()
                    if workbench is not None and requested_parallel > 1 and self._batch_one_video_at_a_time():
                        one = workbench.controls.get('batch_one_video_at_a_time')
                        if hasattr(one, 'setChecked'):
                            one.setChecked(False)
                        self._log_event('Xuất hàng loạt — tự tắt «Một video / lượt»', f'Để chạy {requested_parallel} ffmpeg cùng lúc')
                    parallel = self._batch_parallel_workers()
                    if self._batch_one_video_at_a_time():
                        parallel = 1
                        self._log_event('Xuất hàng loạt — ép 1 luồng', f'Đang bật «Một video / lượt (an toàn)» — tắt ô đó để chạy {self._batch_parallel_workers()} ffmpeg cùng lúc')
                    self._begin_batch_export_ui(len(videos), 'Lập kế hoạch xuất')
                    try:
                        from ui_qt.workers.export_job_spec import ExportJobSpec
                        used_paths = set()
                    except (OSError, ValueError) as exc:
                        self._show_export_error(exc)
                        return None
            else:
                return None
        else:
            self.statusBar().showMessage('Không có video hợp lệ để xuất hàng loạt')
            return None
        plans = []
        queue_index = 0
        skipped = 0
        video_total = len(videos)
        allow_stem = not self._batch_skip_stem_separation()
        for asset in videos:
            if asset.path:
                queue_index += 1
                self._update_batch_plan_progress(queue_index, video_total, asset.name)
                QApplication.processEvents()
                self._sync_subtitles_for_export(asset)
                try:
                    self._auto_translate_video_title_for_asset(asset)
                except Exception as exc:
                    self._log_event('Bỏ dịch tiêu đề trước xuất', str(exc))
                settings, subtitle_document = self._export_payload_for_asset(asset.id, skip_stem_separation=True)
                export_stem = self._export_asset_stem(asset, settings, naming)
                primary = _primary_batch_output_path(output_dir, export_stem, naming=naming, queue_index=queue_index)
                if _is_existing_export_file(primary):
                    skipped += 1
                    used_paths.add(str(primary.resolve()))
                else:
                    out_path = str(_unique_batch_output(output_dir, export_stem, used_paths, naming=naming, queue_index=queue_index))
                    duration_ms = self._resolve_video_source_duration_ms(asset)
                    plans.append(ExportJobSpec(source=asset.path, output=out_path, settings=settings, duration_ms=duration_ms, has_audio=asset.has_audio, source_bitrate_kbps=asset.bitrate_kbps, source_width=int(getattr(asset, 'width', 0) or 0), source_height=int(getattr(asset, 'height', 0) or 0), subtitle_document=subtitle_document, allow_stem_separate=allow_stem, label=asset.name))
        plans = tuple(plans)
        if skipped:
            self._log_event('Bỏ qua clip đã có file xuất', f'{skipped} video trong {output_dir}')
        if plans:
            try:
                task = self.batch_task_factory(plans, on_error=on_error, max_workers=parallel)
            except TypeError:
                try:
                    task = self.batch_task_factory(plans, on_error=on_error)
                except TypeError:
                    task = self.batch_task_factory(plans)
            self._log_event('Thư mục xuất batch', str(output_dir))
            skip_note = f' (bỏ qua {skipped} đã xuất)' if skipped else ''
            self.statusBar().showMessage(f'Xuất hàng loạt {len(plans)} video → {output_dir}{skip_note}', 6000)
            self._start_batch_export_task(task)
        else:
            msg = f'Tất cả {len(videos)} video đã có file .mp4 trong thư mục:\n{output_dir}\n\nChọn thư mục khác hoặc xóa/đổi tên file _edit / _xuat cũ nếu muốn xuất lại.'
            self._show_batch_notice('Không cần xuất lại', msg)
            self.statusBar().showMessage('Tất cả video đã có file xuất trong thư mục — không chạy ffmpeg', 10000)
        return None
        while True:
            while True:
                pass
            used_paths.add(str(mp4.resolve()))

    def _any_asset_needs_dub(self) -> bool:
        for asset in self._video_assets():
            if asset.path and asset_needs_dub_pipeline(asset, self.state, subtitle_workspace=self.subtitle_workspace, project_key=self._subtitle_project_key()):
                return True
        return False

    def _batch_output_stem_hint_for_asset(self, asset, naming: str) -> str:
        from core.video_title import export_output_stem
        if asset is not None and getattr(asset, 'path', ''):
            saved = self.state.asset_settings.get(asset.id) or {}
            if not isinstance(saved, dict):
                saved = {}
            content = str(saved.get('video_title_content') or '').strip()
            if not content and asset.id == self.state.selected_id:
                content = str(self.state.values.get('video_title_content') or '').strip()
            enabled = bool(saved.get('video_title_enabled', self.state.values.get('video_title_enabled', False)))
            from_filename = bool(saved.get('video_title_from_filename', self.state.values.get('video_title_from_filename', True)))
            language_mode = str(saved.get('video_title_language_mode', self.state.values.get('video_title_language_mode', 'auto_target')) or 'auto_target')
            return export_output_stem(asset.path, enabled=enabled, from_filename=from_filename, content=content, language_mode=language_mode, naming=str(naming or 'stem_edit'))
        return 'video'

    def _split_batch_assets_by_existing_exports(self, folder: str, asset_ids: list[str]) -> tuple[list[str], list[str]]:
        output_dir = Path(folder).expanduser().resolve()
        if output_dir.is_dir():
            workbench = self._batch_workbench()
            naming = workbench.batch_naming_mode() if workbench else 'stem_edit'
            last_exports = self.state.values.get('asset_last_export_paths') or {}
            used_paths = set()
            try:
                out_resolved = output_dir.resolve()
            except OSError:
                out_resolved = output_dir
            for mp4 in output_dir.glob('*.mp4'):
                try:
                    resolved = str(mp4.resolve())
                except OSError:
                    resolved = str(mp4)
                if _is_existing_export_file(mp4):
                    used_paths.add(resolved)
            pending = []
            skipped = []
            queue_index = 0
            total = len(asset_ids)
            for asset_id in asset_ids:
                queue_index += 1
                if queue_index == 1 or queue_index == total or queue_index % 5 == 0:
                    self.statusBar().showMessage(f'Kiểm tra file đã xuất {queue_index}/{total}…', 3000)
                    QApplication.processEvents()
                asset = next((candidate for candidate in self.state.assets if candidate.id == asset_id), None)
                if asset is not None and asset.path:
                    try:
                        stem = self._batch_output_stem_hint_for_asset(asset, naming)
                        primary = _primary_batch_output_path(output_dir, stem, naming=naming, queue_index=queue_index)
                        last_path = str(last_exports.get(asset_id, '') or '').strip()
                        skip = _is_existing_export_file(primary)
                        last_resolved = Path(last_path).expanduser().resolve()
                        if last_resolved.parent == out_resolved:
                            skip = True
                        elif not skip and last_path and _is_existing_export_file(last_resolved) and (last_resolved == primary.resolve()):
                            skip = True
                        if skip:
                            skipped.append(asset_id)
                            try:
                                used_paths.add(str(primary.resolve()))
                            except OSError:
                                used_paths.add(str(primary))
                        else:
                            pending.append(asset_id)
                    except (OSError, ValueError):
                        pending.append(asset_id)
            live = getattr(self, '_batch_produce_export_used_paths', None)
            if not isinstance(live, set):
                live = set()
            live |= used_paths
            self._batch_produce_export_used_paths = live
            return (pending, skipped)
        return (list(asset_ids), [])

    def _start_batch_produce_export(self, folder: str) -> None:
        all_asset_ids = [asset.id for asset in self._video_assets() if asset.path]
        if all_asset_ids:
            self._batch_produce_export_used_paths = set()
            pending_ids, skipped_ids = (self._split_batch_assets_by_existing_exports(folder, all_asset_ids)[0], self._split_batch_assets_by_existing_exports(folder, all_asset_ids)[1])
            if skipped_ids:
                self._log_event('Bỏ qua clip đã có file xuất', f'{len(skipped_ids)} video trong {folder}')
            if pending_ids:
                self._prepare_dub_defaults()
                self._clear_produce_export_tasks(cancel=False)
                self._batch_failed_clips.clear()
                self._batch_produce_step = 'Chuẩn bị'
                self._batch_produce_export_active = True
                self._batch_produce_export_folder = str(Path(folder).expanduser().resolve())
                self._refresh_project_work_context()
                self._batch_produce_export_ids = list(pending_ids)
                self._batch_produce_export_total = len(all_asset_ids)
                self._batch_produce_export_completed = len(skipped_ids)
                self._batch_produce_export_dub_phase = False
                self._batch_produce_export_queue_index = 0
                if not isinstance(self._batch_produce_export_used_paths, set):
                    self._batch_produce_export_used_paths = set()
                self._batch_produce_prep_asset_id = ''
                self._batch_produce_prep_step = ''
                self._batch_face_done_ids = set()
                self._batch_scene_done_ids = set()
                self._batch_export_force_cpu = False
                self._logged_nvenc_slot_cap = False
                self._batch_parallel_warmup_done = False
                self._logged_parallel_warmup = False
                workbench = self._batch_workbench()
                naming = workbench.batch_naming_mode() if workbench else 'stem_edit'
                on_error = self._batch_on_error_mode()
                auto_apply = workbench.batch_auto_apply_template() if workbench else True
                if workbench is not None and self._batch_parallel_workers() > 1 and self._batch_one_video_at_a_time():
                    one = workbench.controls.get('batch_one_video_at_a_time')
                    if hasattr(one, 'setChecked'):
                        one.setChecked(False)
                    self._log_event('Xuất hàng loạt — tự tắt «Một video / lượt»', f'Để chạy {self._batch_parallel_workers()} ffmpeg cùng lúc')
                parallel_slots = self._max_produce_export_slots()
                requested_ui = workbench.batch_parallel_workers_requested() if workbench is not None else 0
                self._log_event('Xuất hàng loạt — cấu hình luồng', f"UI yêu cầu={requested_ui or 'Tự động'} · slot thực={parallel_slots} · một_video/lượt={self._batch_one_video_at_a_time()} · NVENC_cap={getattr(self, '_batch_nvenc_slot_cap', None)}")
                if self._can_persist_batch_job():
                    self._active_batch_job = BatchJobRecord(job_type='produce_export', project_path=self._project_path_for_batch_job(), export_folder=self._batch_produce_export_folder, naming_mode=naming, on_error=on_error, auto_apply=auto_apply, dub_before=True, parallel_workers=workbench.batch_parallel_workers_requested() if workbench is not None else 0, total=len(all_asset_ids), pending_asset_ids=list(pending_ids), completed_asset_ids=list(skipped_ids))
                    save_batch_job(self._active_batch_job)
                skip_note = f' (bỏ qua {len(skipped_ids)} đã xuất)' if skipped_ids else ''
                self._log_event('Bắt đầu xuất hàng loạt (dub + xuất)', f'{len(pending_ids)} video cần xuất{skip_note} · {parallel_slots} ffmpeg song song (sau dub)')
                self.statusBar().showMessage(f'Xuất hàng loạt: {len(skipped_ids)}/{self._batch_produce_export_total} đã có file · còn {len(pending_ids)} video…')
                self._begin_batch_export_ui(self._batch_produce_export_total, 'Dub + xuất')
                self._refresh_export_ui()
                self._start_next_batch_produce_export()
            else:
                msg = f'Tất cả {len(all_asset_ids)} video đã có file xuất trong:\n{Path(folder).expanduser().resolve()}\n\nChọn thư mục khác hoặc xóa file cũ nếu muốn xuất lại.'
                self._show_batch_notice('Xuất hàng loạt — không còn clip', msg)
                self.statusBar().showMessage(f'Tất cả {len(all_asset_ids)} video đã có file — không chạy lại', 10000)
                self._log_event('Xuất hàng loạt — không còn clip', f'{len(all_asset_ids)} video đã có file')
                return None
        else:
            self.statusBar().showMessage('Không có video hợp lệ để xuất hàng loạt')
            return None

    def _refresh_export_panel_batch_detail(self) -> None:
        if self._batch_produce_export_active:
            done = self._batch_produce_export_completed
            total = max(1, self._batch_produce_export_total)
            busy = self._batch_produce_export_dub_phase or self._has_exclusive_job() or self._produce_export_tasks or self._produce_export_plan_queue
            current_index = done + 1 if busy and done < total else min(done, total)
            if done >= total:
                current_index = total
            self.export_panel.set_batch_detail(completed=done, current_index=current_index, total=total, step=self._batch_produce_step, parallel_exports=len(self._produce_export_tasks))
            self.export_panel.set_failed_clips(self._batch_failed_clips)
        else:
            return None

    def _batch_produce_overall_percent(self, sub_percent: int | None=None) -> int:
        total = max(1, int(self._batch_produce_export_total))
        done = max(0, int(self._batch_produce_export_completed))
        running_ids = list(self._produce_export_tasks.keys())
        running_sum = sum((int(getattr(task, 'percent', 0) or 0) for task in self._produce_export_tasks.values())) if running_ids else max(0, min(100, int(sub_percent))) if sub_percent is not None else 0
        overall = int((done * 100 + running_sum) / total)
        if running_sum > 0 and overall == 0:
            overall = 1
        return max(0, min(100, overall))

    def _update_batch_produce_progress(self, sub_percent: int, message: str) -> None:
        if self._batch_produce_export_active:
            overall = self._batch_produce_overall_percent(sub_percent)
            self.export_progress.setValue(overall)
            self.export_progress.setFormat('Xuất hàng loạt %p%')
            self.export_progress.show()
            total = max(1, int(self._batch_produce_export_total))
            title = f'Xuất hàng loạt (dub + xuất) — {total} video'
            self.export_panel.set_progress(overall, message or title)
            self._refresh_export_panel_batch_detail()
            self.statusBar().showMessage(f'{message or title} — {overall}%')
        else:
            return None

    def _start_next_batch_produce_export(self) -> None:
        if self._should_swap_to_job_state():
            with self._using_job_state():
                return self._start_next_batch_produce_export()
        if self._batch_produce_export_active:
            self._flush_produce_export_queue()
            face_done = getattr(self, '_batch_face_done_ids', None)
            if not isinstance(face_done, set):
                face_done = set()
                self._batch_face_done_ids = face_done
            scene_done = getattr(self, '_batch_scene_done_ids', None)
            if not isinstance(scene_done, set):
                scene_done = set()
                self._batch_scene_done_ids = scene_done

            def _needs_scene(aid: str) -> bool:
                return False if str(aid) in scene_done else self._batch_auto_scene_split_enabled() and self._asset_timeline_clip_count(aid) <= 1

            def _needs_face(aid: str) -> bool:
                return self._batch_auto_face_reframe_enabled() and str(aid) not in face_done

            def _needs_dub(aid: str) -> bool:
                asset = next((candidate for candidate in self.state.assets if candidate.id == aid), None)
                return asset_needs_dub_pipeline(asset, self.state, subtitle_workspace=self.subtitle_workspace, project_key=self._subtitle_project_key()) if asset is not None and asset.path else False

            def _is_export_ready(aid: str) -> bool:
                asset = next((candidate for candidate in self.state.assets if candidate.id == aid), None)
                return (False if _needs_scene(aid) or _needs_face(aid) or _needs_dub(aid) else True) if asset is not None and asset.path else False

            def _pending_exports() -> int:
                return len(self._produce_export_tasks) + len(self._produce_export_plan_queue)

            def _take_skipped_or_none(asset_id: str):
                asset = next((candidate for candidate in self.state.assets if candidate.id == asset_id), None)
                if asset is not None and asset.path:
                    _pending_one, skipped_one = self._split_batch_assets_by_existing_exports(self._batch_produce_export_folder, [asset_id])
                    if skipped_one:
                        self._batch_produce_export_completed += 1
                        if self._active_batch_job is not None:
                            self._active_batch_job.mark_completed(asset_id)
                            self._persist_batch_job()
                        self._log_event('Bỏ qua clip đã xuất', f'{asset.name} — file đã có trong thư mục batch')
                        return 'skip'
                    return asset
                return 'drop'
            max_slots = self._max_produce_export_slots()
            running0 = _pending_exports()
            while True:
                ready_count = sum((1 for aid in self._batch_produce_export_ids if _is_export_ready(aid)))
                warmup_target = min(2, max_slots)
                can_warmup_more = any((not _is_export_ready(aid) for aid in self._batch_produce_export_ids))
                warmup_hold = max_slots >= 2 and running0 == 0 and (not getattr(self, '_batch_parallel_warmup_done', False)) and (ready_count < warmup_target) and can_warmup_more
                if not warmup_hold and (not getattr(self, '_batch_parallel_warmup_done', False)):
                    self._batch_parallel_warmup_done = True
                ready_idx = next((i for i, aid in enumerate(self._batch_produce_export_ids) if _is_export_ready(aid)), None)
                if warmup_hold or _pending_exports() >= max_slots or (not self._batch_produce_export_ids) or (ready_idx is None):
                    break
                asset_id = self._batch_produce_export_ids.pop(ready_idx)
                self._sync_produce_batch_job_state()
                asset = _take_skipped_or_none(asset_id)
                if asset in frozenset({'drop', 'skip'}):
                    pass
                else:
                    self._batch_produce_export_queue_index += 1
                    done = self._batch_produce_export_completed
                    self._log_event('Xuất hàng loạt — clip', f'{done + 1}/{self._batch_produce_export_total}: {asset.name}')
                    self._enqueue_produce_export_for_asset(asset_id)
                continue
            self._flush_produce_export_queue()
            running = _pending_exports()
            if running > 0:
                self._batch_produce_step = f'FFmpeg — {running}/{max_slots} song song'
            else:
                self._batch_produce_step = f'Chuẩn bị song song — cần {warmup_target} clip sẵn (đang có {ready_count})'
                if warmup_hold and (not getattr(self, '_logged_parallel_warmup', False)):
                    self._logged_parallel_warmup = True
                    self._log_event('Xuất hàng loạt — chờ đủ clip sẵn để song song', f'Đã chọn {max_slots} luồng nhưng mới {ready_count} clip có TTS. Đang dịch/TTS thêm tới {warmup_target} clip rồi mở ffmpeg cùng lúc (tránh cả batch chỉ 1 luồng).')
            if self._batch_produce_prep_asset_id:
                pass
            elif self._dub_pipeline_active or self._batch_produce_export_dub_phase:
                if running < max_slots and running > 0:
                    self.statusBar().showMessage(f'FFmpeg {running}/{max_slots} — đang dịch/TTS clip kế để fill thêm luồng…', 6000)
            elif self._has_dub_lock_job():
                self.statusBar().showMessage('Xuất hàng loạt: đang chờ STT/TTS/CapCut — ffmpeg vẫn chạy…', 6000)
                QTimer.singleShot(800, self._start_next_batch_produce_export)
            elif self._batch_produce_export_ids:
                dub_ready_idx = next((i for i, aid in enumerate(self._batch_produce_export_ids) if _needs_dub(aid) and not _needs_scene(aid) and not _needs_face(aid)), None)
                if dub_ready_idx is not None:
                    asset_id = self._batch_produce_export_ids.pop(dub_ready_idx)
                    self._sync_produce_batch_job_state()
                    asset = _take_skipped_or_none(asset_id)
                    if asset in frozenset({'drop', 'skip'}):
                        QTimer.singleShot(0, self._start_next_batch_produce_export)
                    else:
                        self._batch_produce_export_queue_index += 1
                        done = self._batch_produce_export_completed
                        label = asset.name
                        self._log_event('Xuất hàng loạt — clip', f'{done + 1}/{self._batch_produce_export_total}: {label}')
                        self._batch_produce_export_dub_phase = True
                        if self._activate_asset_for_dub_pipeline(asset_id):
                            if self._active_batch_job is not None:
                                self._active_batch_job.mark_current(asset_id)
                                self._persist_batch_job()
                            self._dub_pipeline_steps = self._ensure_dub_steps_have_stt_if_empty(self._build_dub_pipeline_steps())
                            self._dub_pipeline_active = True
                            self.statusBar().showMessage(f'Xuất hàng loạt {done + 1}/{self._batch_produce_export_total}: {label} — tạo phụ đề + giọng…')
                            self._update_batch_produce_progress(2, f'Clip {done + 1}/{self._batch_produce_export_total}: {label} — phụ đề + giọng… ({running}/{max_slots} ffmpeg)')
                            self._advance_dub_pipeline()
                        else:
                            self._on_batch_produce_asset_failed(asset_id, 'Video không hợp lệ')
                            QTimer.singleShot(0, self._start_next_batch_produce_export)
                else:
                    prep_idx = next((i for i, aid in enumerate(self._batch_produce_export_ids) if _needs_scene(aid) or _needs_face(aid)), None)
                    if prep_idx is not None:
                        asset_id = self._batch_produce_export_ids.pop(prep_idx)
                        self._sync_produce_batch_job_state()
                        asset = _take_skipped_or_none(asset_id)
                        if asset in frozenset({'drop', 'skip'}):
                            QTimer.singleShot(0, self._start_next_batch_produce_export)
                        elif _needs_scene(asset_id):
                            if self.scene_detect_task is not None or self.face_reframe_task is not None:
                                self._batch_produce_export_ids.insert(0, asset_id)
                                QTimer.singleShot(400, self._start_next_batch_produce_export)
                            else:
                                self._scene_batch_total = 0
                                self._scene_batch_queue.clear()
                                self._scene_batch_active_id = ''
                                self._batch_produce_prep_asset_id = str(asset_id)
                                self._batch_produce_prep_step = 'scene'
                                scene_done.add(str(asset_id))
                                self._log_event('Xuất hàng loạt — tách cảnh', asset.name)
                                self._update_batch_produce_progress(1, f'Clip: {asset.name} — tách cảnh… ({running}/{max_slots} ffmpeg)')
                                self._begin_scene_detect_for_video(asset)
                        elif _needs_face(asset_id):
                            if self.scene_detect_task is not None or self.face_reframe_task is not None:
                                self._batch_produce_export_ids.insert(0, asset_id)
                                QTimer.singleShot(400, self._start_next_batch_produce_export)
                            else:
                                self._batch_produce_prep_asset_id = str(asset_id)
                                self._batch_produce_prep_step = 'face'
                                self._log_event('Xuất hàng loạt — căn mặt', asset.name)
                                self._update_batch_produce_progress(2, f'Clip: {asset.name} — căn mặt / chủ thể… ({running}/{max_slots} ffmpeg)')
                                self._begin_face_reframe_for_asset(asset)
                        else:
                            self._batch_produce_export_ids.insert(0, asset_id)
                            QTimer.singleShot(0, self._start_next_batch_produce_export)
                    elif running >= max_slots:
                        if any((_is_export_ready(aid) for aid in self._batch_produce_export_ids)):
                            QTimer.singleShot(500, self._start_next_batch_produce_export)
                    else:
                        dub_idx = next((i for i, aid in enumerate(self._batch_produce_export_ids) if _needs_dub(aid)), None)
                        if dub_idx is None:
                            self._maybe_finish_batch_produce_export()
                        else:
                            asset_id = self._batch_produce_export_ids.pop(dub_idx)
                            self._sync_produce_batch_job_state()
                            asset = _take_skipped_or_none(asset_id)
                            if asset in frozenset({'drop', 'skip'}):
                                QTimer.singleShot(0, self._start_next_batch_produce_export)
                            else:
                                self._batch_produce_export_queue_index += 1
                                done = self._batch_produce_export_completed
                                label = asset.name
                                self._log_event('Xuất hàng loạt — clip', f'{done + 1}/{self._batch_produce_export_total}: {label}')
                                self._batch_produce_export_dub_phase = True
                                if self._activate_asset_for_dub_pipeline(asset_id):
                                    if self._active_batch_job is not None:
                                        self._active_batch_job.mark_current(asset_id)
                                        self._persist_batch_job()
                                    self._dub_pipeline_steps = self._ensure_dub_steps_have_stt_if_empty(self._build_dub_pipeline_steps())
                                    self._dub_pipeline_active = True
                                    self.statusBar().showMessage(f'Xuất hàng loạt {done + 1}/{self._batch_produce_export_total}: {label} — tạo phụ đề + giọng…')
                                    self._update_batch_produce_progress(2, f'Clip {done + 1}/{self._batch_produce_export_total}: {label} — phụ đề + giọng… ({running}/{max_slots} ffmpeg)')
                                    self._advance_dub_pipeline()
                                else:
                                    self._on_batch_produce_asset_failed(asset_id, 'Video không hợp lệ')
                                    QTimer.singleShot(0, self._start_next_batch_produce_export)
            else:
                self._maybe_finish_batch_produce_export()
        return None

    def _ensure_dub_steps_have_stt_if_empty(self, steps: list[str]) -> list[str]:
        queue = list(steps or [])
        if self.state.subtitles.segments:
            return queue
        stt_step = self._primary_stt_pipeline_step()
        need = [stt_step]
        if 'translate' not in need and 'translate' in queue:
            need.append('translate')
        elif ('translate' in queue or 'tts' in queue) and 'tts' in queue and ('translate' not in need):
            need.append('translate')
        for step in queue:
            if step not in need:
                need.append(step)
        if need != queue:
            self._log_event('Mạch dịch + giọng', f'Phụ đề RAM trống → ép bước {need}')
        return need

    def _begin_face_reframe_for_asset(self, asset) -> None:
        from copy import deepcopy
        from core.face_reframe import crop_norm_from_export_values
        from core.timeline_clips import ensure_timeline_clips
        from ui_qt.state import DEFAULT_EXPORT_VALUES
        from ui_qt.workers.face_reframe import FaceReframeTask
        if asset is not None and getattr(asset, 'path', None):
            is_live = str(self.state.selected_id or '') == str(asset.id)
            if is_live:
                values = self.state.values
            else:
                previous = self.state.asset_settings.get(asset.id)
                if isinstance(previous, dict) and previous:
                    values = deepcopy(previous)
                else:
                    values = {key: deepcopy(self.state.values.get(key, default)) for key, default in DEFAULT_EXPORT_VALUES.items()}
            source_ms = max(1, int(getattr(asset, 'duration_ms', 0) or 0) or int(values.get('source_duration_ms', 0) or 0) or 1)
            clips = ensure_timeline_clips(values, source_duration_ms=source_ms, source_path=str(asset.path or ''))
            plate = str(self.state.values.get('face_reframe_plate', '1:1') or '1:1')
            pan_axis = str(self.state.values.get('face_reframe_pan_axis', 'horizontal') or 'horizontal')
            subject_mode = str(self.state.values.get('face_reframe_subject_mode', 'face_then_object') or 'face_then_object')
            task = FaceReframeTask(clips, aspect_ratio=str(self.state.values.get('aspect_ratio', '9:16')), quality=str(self.state.values.get('quality', '1080p')), fallback_path=str(asset.path or ''), subject_padding=2.4, plate_aspect=plate, pan_axis=pan_axis, subject_mode=subject_mode, crop_norm=crop_norm_from_export_values(values))
            self.face_reframe_task = task
            self._batch_face_reframe_values = values
            self._batch_face_reframe_live = is_live
            self._batch_face_reframe_asset_id = str(asset.id)
            task.signals.progressChanged.connect(lambda message: self.statusBar().showMessage(message, 5000))
            task.signals.completed.connect(self._on_batch_face_reframe_completed)
            task.signals.failed.connect(self._on_batch_face_reframe_failed)
            task.signals.finished.connect(self._on_face_reframe_finished)
            self._refresh_export_ui()
            self.thread_pool.start(task)
        else:
            self._on_batch_produce_prep_failed('Video không hợp lệ')
            return None

    def _on_batch_face_reframe_completed(self, clips, results) -> None:
        from core.timeline_clips import apply_clip_transform_to_values, find_clip, selected_clip_id, write_clips
        values = getattr(self, '_batch_face_reframe_values', None)
        asset_id = str(getattr(self, '_batch_face_reframe_asset_id', '') or '')
        is_live = bool(getattr(self, '_batch_face_reframe_live', False))
        if isinstance(values, dict) and asset_id:
            write_clips(values, list(clips or []))
            sel = selected_clip_id(values)
            chosen = find_clip(list(clips or []), sel) if sel else None
            if chosen is None and clips:
                chosen = clips[0]
            if chosen is not None:
                apply_clip_transform_to_values(values, chosen)
            if is_live:
                self.state.values.update(values)
                self.control_board.sync_video_transform_controls()
                self.timeline_panel.canvas.update()
                self.preview_panel.refresh_settings()
                self.state.snapshot_asset_settings(asset_id)
            else:
                self.state.asset_settings[asset_id] = values
            self._schedule_autosave()
            hit = sum((1 for r in results or [] if getattr(r, 'found_face', False) or str(getattr(r, 'subject_kind', '') or '')))
            self.statusBar().showMessage(f'Đã căn mặt/chủ thể {hit}/{len(results or [])} cảnh — tiếp tục xuất…', 4000)
            self._finish_batch_produce_prep_and_continue()
        else:
            self._on_batch_produce_prep_failed('Thiếu state căn mặt batch')
            return None

    def _on_batch_face_reframe_failed(self, message: str) -> None:
        text = str(message or '').strip()
        self._log_event('Căn mặt batch lỗi', text)
        self.statusBar().showMessage(f'Bỏ qua căn mặt (lỗi) — tiếp tục xuất ({text[:80]})', 5000)
        self._finish_batch_produce_prep_and_continue()

    def _finish_batch_produce_prep_and_continue(self) -> None:
        asset_id = str(self._batch_produce_prep_asset_id or '')
        step = str(self._batch_produce_prep_step or '')
        self._batch_produce_prep_asset_id = ''
        self._batch_produce_prep_step = ''
        self._batch_face_reframe_values = None
        self._batch_face_reframe_asset_id = ''
        if self._single_export_prep_active:
            self._disarm_single_export_prep_watchdog()
            if step == 'face':
                self._single_export_face_done = True
            self._single_export_prep_step = ''
            QTimer.singleShot(0, self._advance_single_export_prep)
            return None
        if self._batch_produce_export_active and asset_id:
            if step == 'scene':
                done_scene = getattr(self, '_batch_scene_done_ids', None)
                if not isinstance(done_scene, set):
                    done_scene = set()
                    self._batch_scene_done_ids = done_scene
                done_scene.add(str(asset_id))
            if step == 'scene' and self._batch_auto_face_reframe_enabled():
                self._batch_produce_export_ids.insert(0, asset_id)
                QTimer.singleShot(0, self._start_next_batch_produce_export)
                return None
            if step in frozenset({'scene', 'face'}):
                self._batch_produce_export_ids.insert(0, asset_id)
                if step == 'face':
                    done = getattr(self, '_batch_face_done_ids', None)
                    if not isinstance(done, set):
                        done = set()
                        self._batch_face_done_ids = done
                    done.add(asset_id)
                QTimer.singleShot(0, self._start_next_batch_produce_export)
                return None
            QTimer.singleShot(0, self._start_next_batch_produce_export)
        else:
            return None

    def _on_batch_produce_prep_failed(self, message: str) -> None:
        self._log_event('Prep batch lỗi', message)
        asset_id = str(self._batch_produce_prep_asset_id or '')
        step = str(self._batch_produce_prep_step or '')
        self._batch_produce_prep_asset_id = ''
        self._batch_produce_prep_step = ''
        if self._single_export_prep_active:
            if step == 'face':
                self._single_export_face_done = True
            self._single_export_prep_step = ''
            self.statusBar().showMessage(f"Bỏ qua chuẩn bị ({str(message or '')[:80]}) — tiếp tục xuất…", 5000)
            QTimer.singleShot(0, self._advance_single_export_prep)
            return None
        if asset_id:
            if self._batch_produce_export_active:
                self._on_batch_produce_asset_failed(asset_id, message)
            return None

    def _maybe_finish_batch_produce_export(self) -> None:
        if not self._batch_produce_export_active:
            return None
        if self._batch_produce_export_ids or self._produce_export_tasks or self._produce_export_plan_queue or self._has_exclusive_job() or self._batch_produce_export_dub_phase:
            return None
        self._finish_batch_produce_export()

    def _build_produce_export_plan(self, asset_id: str):
        from ui_qt.workers.export_job_spec import ExportJobSpec
        asset = next((a for a in self.state.assets if a.id == asset_id), None)
        if asset is not None and asset.path:
            naming = self.module_workbenches.get('batch').batch_naming_mode() if self.module_workbenches.get('batch') is not None else 'stem_edit'
            self._sync_subtitles_for_export(asset)
            QApplication.processEvents()
            try:
                self._auto_translate_video_title_for_asset(asset)
            except Exception as exc:
                self._log_event('Bỏ dịch tiêu đề trước xuất', str(exc))
            QApplication.processEvents()
            settings, subtitle_document = self._export_payload_for_asset(asset_id, skip_stem_separation=True)
            export_stem = self._export_asset_stem(asset, settings, naming)
            output_path = _unique_batch_output(Path(self._batch_produce_export_folder), export_stem, self._batch_produce_export_used_paths, naming=naming, queue_index=self._batch_produce_export_queue_index)
            allow_stem = not self._batch_skip_stem_separation()
            duration_ms = self._resolve_video_source_duration_ms(asset)
            asset = next((a for a in self.state.assets if a.id == asset_id), asset)
            return ExportJobSpec(source=asset.path, output=str(output_path), settings=settings, duration_ms=duration_ms, has_audio=asset.has_audio, source_bitrate_kbps=asset.bitrate_kbps, source_width=int(getattr(asset, 'width', 0) or 0), source_height=int(getattr(asset, 'height', 0) or 0), subtitle_document=subtitle_document, allow_stem_separate=allow_stem, label=asset.name)
        raise ValueError('Video không hợp lệ')

    def _after_produce_dub_finished(self, asset_id: str) -> None:
        if self._should_swap_to_job_state():
            with self._using_job_state():
                return self._after_produce_dub_finished(asset_id)
        if self._batch_produce_export_active:
            aid = str(asset_id or '').strip()
            if aid:
                self._enqueue_produce_export_for_asset(aid)
            QTimer.singleShot(0, self._start_next_batch_produce_export)
        return None

    def _enqueue_produce_export_for_asset(self, asset_id: str) -> None:
        if self._batch_produce_export_active:
            self._batch_produce_export_dub_phase = False
            asset = next((a for a in self.state.assets if a.id == asset_id), None)
            if asset is not None and asset.path:
                done = self._batch_produce_export_completed
                label = asset.name
                try:
                    plan = self._build_produce_export_plan(asset_id)
                except (OSError, ValueError) as exc:
                    self._on_batch_produce_asset_failed(asset_id, str(exc))
                self._produce_export_plan_queue.append((asset_id, plan))
                self._batch_produce_step = 'Chuẩn bị FFmpeg'
                self.statusBar().showMessage(f'Xuất hàng loạt {done + 1}/{self._batch_produce_export_total}: {label} — chuẩn bị ffmpeg…')
                self._update_batch_produce_progress(0, f'Clip {done + 1}/{self._batch_produce_export_total}: {label} — chuẩn bị ffmpeg…')
                self._flush_produce_export_queue()
            else:
                self._on_batch_produce_asset_failed(asset_id, 'Video không hợp lệ')

    def _flush_produce_export_queue(self) -> None:
        if not self._batch_produce_export_active:
            return None
        if self._has_dub_lock_job():
            if self._produce_export_plan_queue:
                QTimer.singleShot(400, self._flush_produce_export_queue)
            return None
        max_slots = self._max_produce_export_slots()
        while self._produce_export_plan_queue and len(self._produce_export_tasks) < max_slots:
            asset_id, plan = self._produce_export_plan_queue.pop(0)
            self._start_produce_export_task(asset_id, plan)
        return None

    def _start_produce_export_task(self, asset_id: str, plan) -> None:
        if asset_id in self._produce_export_tasks:
            return None
        asset = next((a for a in self.state.assets if a.id == asset_id), None)
        label = asset.name if asset is not None else asset_id
        done = self._batch_produce_export_completed
        output_name = Path(getattr(plan, 'final_output', '') or '').name
        self._log_event('Bắt đầu xuất clip batch', getattr(plan, 'final_output', ''))
        task = self.export_task_factory(plan)
        self._produce_export_tasks[asset_id] = task
        task.signals.progressChanged.connect(lambda value, aid=asset_id: self._on_produce_export_progress(aid, value))
        if hasattr(task.signals, 'activityLogged'):
            task.signals.activityLogged.connect(lambda msg, aid=asset_id: self._on_produce_export_activity(aid, msg))
        task.signals.completed.connect(lambda result, aid=asset_id: self._on_produce_export_completed(aid, result))
        task.signals.failed.connect(lambda message, aid=asset_id: self._on_produce_export_failed(aid, message))
        task.signals.finished.connect(lambda aid=asset_id: self._on_produce_export_finished(aid))
        message = f'Clip {done + 1}/{self._batch_produce_export_total}: {label} — ffmpeg {output_name}…'
        self._batch_produce_step = f'FFmpeg — {label}'
        self._update_batch_produce_progress(0, message)
        self._refresh_export_ui()
        self.thread_pool.start(task)

    def _on_produce_export_progress(self, asset_id: str, value: int) -> None:
        if self._batch_produce_export_active:
            percent = max(0, min(100, int(value)))
            self._produce_export_progress[asset_id] = percent
            asset = next((a for a in self.state.assets if a.id == asset_id), None)
            label = asset.name if asset is not None else asset_id
            done = self._batch_produce_export_completed
            total = max(1, self._batch_produce_export_total)
            running = len(self._produce_export_tasks)
            tail_hint = ''
            if percent >= 90 and percent < 100:
                tail_hint = ' — encode filter nặng (blur/overlay/phụ đề), vẫn đang chạy'
            message = f'Clip {done + 1}/{total}: {label} — ffmpeg {percent}% ({running} song song){tail_hint}'
            self._batch_produce_step = f'FFmpeg {percent}% — {label}'
            self._update_batch_produce_progress(percent, message)
            if percent in frozenset({1, 100, 5, 10, 75, 50, 25, 90}) or percent % 10 == 0:
                self._log_event(f'Tiến trình xuất clip {percent}%', label)
                return None
        else:
            return None

    def _on_produce_export_completed(self, asset_id: str, result: ExportResult) -> None:
        if self._should_swap_to_job_state():
            with self._using_job_state():
                return self._on_produce_export_completed(asset_id, result)
        name = Path(result.output_path).name
        self._batch_produce_export_completed += 1
        done = self._batch_produce_export_completed
        total = self._batch_produce_export_total
        if self._active_batch_job is not None and asset_id:
            self._active_batch_job.mark_completed(asset_id)
            self._active_batch_job.used_output_paths.append(str(Path(result.output_path).resolve()))
            self._persist_batch_job()
        self.export_panel.mark_completed(f'Đã xuất {done}/{total}: {name}')
        self.export_progress.setValue(int(done * 100 / max(total, 1)))
        self.export_progress.setFormat('Xuất hàng loạt %p%')
        remember_path('export', result.output_path)
        self.statusBar().showMessage(f'Xuất hàng loạt {done}/{total}: {name}')
        self._log_event('Hoàn tất xuất clip', result.output_path)
        if self._batch_user_paused:
            self._finalize_batch_pause()
        else:
            self._flush_produce_export_queue()
            QTimer.singleShot(0, self._start_next_batch_produce_export)
            self._maybe_finish_batch_produce_export()
        return None

    def _on_produce_export_failed(self, asset_id: str, message: str) -> None:
        if self._should_swap_to_job_state():
            with self._using_job_state():
                return self._on_produce_export_failed(asset_id, message)
        if self._batch_pause_requested:
            self._finalize_batch_pause()
        else:
            asset = next((a for a in self.state.assets if a.id == asset_id), None)
            label = asset.name if asset is not None else asset_id
            self._log_event('Xuất hàng loạt lỗi ffmpeg', f'{label}: {message}')
            on_error = self._batch_on_error_mode()
            if on_error == 'skip' and 'dừng' not in message.lower():
                if self._active_batch_job is not None:
                    self._active_batch_job.mark_failed(asset_id, message)
                    self._persist_batch_job()
                self.statusBar().showMessage(f'Bỏ qua clip lỗi xuất — tiếp clip sau… ({message})')
                self._flush_produce_export_queue()
                QTimer.singleShot(0, self._start_next_batch_produce_export)
                self._maybe_finish_batch_produce_export()
            else:
                self._batch_produce_export_ids = []
                self._finish_batch_produce_export(aborted=True, reason=message)
        return None

    def _on_produce_export_finished(self, asset_id: str) -> None:
        task = self._produce_export_tasks.pop(asset_id, None)
        self._produce_export_progress.pop(asset_id, None)
        if task is None:
            return None
        self._refresh_export_ui()
        if self._batch_produce_export_active:
            if self._batch_user_paused:
                pass
            else:
                self._flush_produce_export_queue()
                QTimer.singleShot(0, self._start_next_batch_produce_export)
            return None

    def _export_produce_asset(self, asset_id: str) -> None:
        self._enqueue_produce_export_for_asset(asset_id)

    def _on_batch_produce_asset_failed(self, asset_id: str, reason: str) -> None:
        asset = next((a for a in self.state.assets if a.id == asset_id), None)
        label = asset.name if asset is not None else asset_id
        self._batch_failed_clips.append((label, reason))
        self.export_panel.set_failed_clips(self._batch_failed_clips)
        self._log_event('Xuất hàng loạt lỗi', f'{label}: {reason}')
        self._clear_dub_pipeline()
        self._batch_produce_export_dub_phase = False
        self._pipeline_asset_id = None
        if self._active_batch_job is not None:
            self._active_batch_job.mark_failed(asset_id, reason)
            self._persist_batch_job()
        on_error = self._batch_on_error_mode()
        if on_error == 'skip':
            self.statusBar().showMessage(f'Bỏ qua {label} — tiếp clip sau… ({reason})')
            QTimer.singleShot(0, self._start_next_batch_produce_export)
            return None
        self._finish_batch_produce_export(aborted=True, reason=reason)

    def _finish_batch_produce_export(self, *, aborted: bool, reason: str) -> None:
        if self._should_swap_to_job_state():
            with self._using_job_state():
                return self._finish_batch_produce_export(aborted=aborted, reason=reason)
        done = self._batch_produce_export_completed
        total = self._batch_produce_export_total
        folder = self._batch_produce_export_folder
        self._clear_produce_export_tasks(cancel=aborted)
        self._batch_produce_export_active = False
        self._batch_produce_export_folder = ''
        self._batch_produce_export_ids = []
        self._batch_produce_export_total = 0
        self._batch_produce_export_completed = 0
        self._batch_produce_export_dub_phase = False
        self._batch_produce_export_queue_index = 0
        self._batch_produce_export_used_paths = set()
        self._batch_failed_clips.clear()
        self._batch_produce_step = ''
        self._pipeline_asset_id = None
        self._produce_voice_by_asset.clear()
        self._clear_dub_pipeline()
        self._set_export_resource_mode(False)
        if folder:
            try:
                from services_video_export import cleanup_export_output_artifacts
                cleanup_export_output_artifacts(Path(folder) / '_batch_cleanup_marker.mp4', force=True)
            except Exception:
                pass
        self.refresh_batch_queue()
        self._schedule_autosave()
        self.control_board.set_subtitle_busy(False)
        self.export_progress.hide()
        self.export_progress.setValue(0)
        self._refresh_export_ui()
        self.export_panel.hide()
        if aborted:
            self._report_pipeline_error('Xuất hàng loạt dừng', reason or 'Có lỗi khi xử lý clip')
        else:
            self.statusBar().showMessage(f'Hoàn tất xuất hàng loạt: {done}/{total} video.')
            self._log_event('Hoàn tất xuất hàng loạt', f'{done}/{total} video')
            if done and folder:
                remember_path('export', folder)
                self._offer_open_export_folder(folder)
            self._clear_batch_job_file()
        self._release_export_job_state()
        return None

    def _export_to_path(self, output: str) -> None:
        from ui_qt.workers.export_job_spec import ExportJobSpec
        asset = self._selected_export_asset()
        if asset is not None and asset.path:
            output_path = Path(output)
            if output_path.suffix.lower() != '.mp4':
                output_path = output_path.with_suffix('.mp4')
            try:
                self._sync_subtitles_for_export(asset)
                self.state.snapshot_asset_settings(asset.id)
                settings, subtitle_document = self._export_payload_for_asset(asset.id, skip_stem_separation=True)
                naming = 'stem_xuat'
                batch_wb = self.module_workbenches.get('batch')
                if batch_wb is not None:
                    try:
                        naming = str(batch_wb.batch_naming_mode() or naming)
                    except Exception:
                        naming = 'stem_xuat'
                if naming == 'title_target':
                    fresh = self._suggested_export_output_path(asset, settings, naming)
                    output_path = output_path.parent / fresh.name
                duration_ms = self._resolve_video_source_duration_ms(asset)
                asset = next((a for a in self.state.assets if a.id == asset.id), asset)
                plan = ExportJobSpec(source=asset.path, output=str(output_path), settings=settings, duration_ms=duration_ms, has_audio=asset.has_audio, source_bitrate_kbps=asset.bitrate_kbps, source_width=int(getattr(asset, 'width', 0) or 0), source_height=int(getattr(asset, 'height', 0) or 0), subtitle_document=subtitle_document, allow_stem_separate=True, label=asset.name)
            except (OSError, ValueError) as exc:
                self._show_export_error(exc)
            self._start_export_task(self.export_task_factory(plan))
        else:
            self.statusBar().showMessage('Không có video hợp lệ để xuất')

    def _sync_subtitles_for_export(self, asset=None) -> None:
        target = asset
        if target is None:
            target = self._selected_video_asset()
        if target is not None and self.state.subtitles.segments:
            selected = self._selected_video_asset()
            if selected is not None and target.id == selected.id:
                document = self.state.subtitles
                ready = self._persist_subtitle_document(document, self._working_subtitle_path_for(target))
                if selected is not None:
                    if target.id == selected.id:
                        subtitle_enabled = bool(self.state.values.get('subtitle_enabled'))
                        self.state.set_subtitles(ready)
                        self.state.values['subtitle_enabled'] = subtitle_enabled
                        self.state.values['subtitle_path'] = ready.source_path
                        self.control_board.subtitle_panel.refresh_document()
                    return None
            else:
                document = self._subtitle_document_for_asset(target)
                if document is None:
                    return None
        else:
            return None

    def _export_payload_for_asset(self, asset_id: str, *, skip_stem_separation: bool):
        from ui_qt.asset_export import wait_for_voice_audio_path
        asset = next((a for a in self.state.assets if a.id == asset_id), None)
        settings = self._export_settings_for_asset(asset_id)
        if asset is not None and asset.path:
            cached_voice = str(getattr(self, '_produce_voice_by_asset', {}).get(asset_id, '') or '').strip()
            saved_bag = self.state.asset_settings.get(asset_id) or {}
            want_voice = bool(settings.voice_audio_enabled)
            from core.tts_voice_key import current_tts_voice_key_from_values
            preferred_key = current_tts_voice_key_from_values(self.state.values)
            stored_key = str(saved_bag.get('voice_tts_key') or self.state.values.get('voice_tts_key') or '').strip()
            _extra_voice_dirs = [Path(self._project_output_folder())] if self._project_output_folder() else None
            overrides = resolve_per_video_export_overrides(video_path=asset.path, subtitle_workspace=self.subtitle_workspace, voice_audio_enabled=want_voice, subtitle_enabled=bool(settings.subtitle_enabled), existing_voice_path=cached_voice or settings.voice_audio_path, existing_subtitle_path=settings.subtitle_path, preferred_voice_key=preferred_key, stored_voice_key=stored_key, tts_engine=str(self.state.values.get('tts_engine', 'edge') or 'edge'), tts_voice=str(self.state.values.get('tts_voice', '') or ''), tts_lang=str(self.state.values.get('subtitle_target_language', '') or ''), project_key=self._subtitle_project_key(), asset_id=str(asset.id or ''), extra_voice_dirs=_extra_voice_dirs)
            settings = replace(settings, **overrides)
            settings = self._resolve_video_stems_for_export(settings, asset.path, allow_separate=not skip_stem_separation)
            if want_voice:
                voice_path = str(settings.voice_audio_path or '').strip()
                if not voice_path or not Path(voice_path).is_file():
                    voice_path = wait_for_voice_audio_path(asset.path, cached_voice, str(settings.voice_audio_path or ''), str(saved_bag.get('voice_audio_path') or ''), preferred_key=preferred_key)
                if voice_path and Path(voice_path).is_file():
                    settings = replace(settings, voice_audio_enabled=True, voice_audio_path=voice_path)
                    self._produce_voice_by_asset[asset_id] = voice_path
                else:
                    label = Path(asset.path).name
                    self._log_event('[AVSync] Voice missing khi xuất — không xuất câm', label)
                    raise ValueError(f'Thiếu file TTS (*_tts_full) cho «{label}». Không xuất video câm — chạy lại TTS hoặc kiểm tra thư mục «Giọng Đọc TTS».')
        else:
            settings = self._attach_voice_duration(settings)
            if settings.voice_audio_enabled and str(settings.voice_audio_path or '').strip() and (int(settings.voice_duration_ms or 0) <= 0):
                self._log_event(f'[AVSync] Voice bật nhưng không đo được duration — {settings.voice_audio_path}')
            document = self._subtitle_document_for_asset(asset)
            if settings.subtitle_enabled and document is not None and document.segments:
                settings = replace(settings, subtitle_enabled=True, subtitle_path=document.source_path or str(self._working_subtitle_path_for(asset)))
            elif not settings.subtitle_enabled:
                document = None
                settings = replace(settings, subtitle_enabled=False, subtitle_path='')
            elif settings.subtitle_enabled:
                resolved = self._resolve_subtitle_path_for_asset(asset)
                settings = replace(settings, subtitle_path=resolved) if resolved else replace(settings, subtitle_enabled=False, subtitle_path='')
            path = str(getattr(settings, 'subtitle_path', '') or '').strip()
            if settings.subtitle_enabled and (not path or not Path(path).is_file()) and (document is None or not document.segments):
                settings = replace(settings, subtitle_enabled=False, subtitle_path='')
            settings = self._ensure_export_video_title(settings, asset)
            settings = apply_export_tts_vocal_guard(settings)
            return (settings, document)

    def _ensure_export_video_title(self, settings, asset) -> object:
        from core.video_title import _is_bogus_export_title, normalize_title_language_mode, title_from_media_path, title_needs_target_translation, translate_video_title
        if asset is not None and getattr(asset, 'path', ''):
            force_naming = self._batch_title_target_naming_active()
            burn_title = bool(settings.video_title_enabled)
            if burn_title or force_naming:
                if force_naming and (not burn_title):
                    settings = replace(settings, video_title_language_mode='auto_target')
                mode = normalize_title_language_mode(getattr(settings, 'video_title_language_mode', 'auto_target'), from_filename=bool(settings.video_title_from_filename))
                if force_naming:
                    mode = 'auto_target'
                content = str(settings.video_title_content or '').strip()
                ui_content = str(self.state.values.get('video_title_content') or '').strip()
                if asset.id == self.state.selected_id and ui_content:
                    content = ui_content
                try:
                    panel = self.control_board.subtitle_panel
                    target_lang = str(getattr(panel.translation_settings(), 'target_language', '') or self.state.values.get('subtitle_target_language', 'vi') or 'vi')
                except Exception:
                    target_lang = str(self.state.values.get('subtitle_target_language', 'vi') or 'vi')
                saved = self.state.asset_settings.get(asset.id, {})
                saved_title = str(saved.get('video_title_content') or '').strip()
                if saved_title and (not content or _is_bogus_export_title(content) or title_needs_target_translation(content, asset.path, language_mode=mode, from_filename=bool(settings.video_title_from_filename), target_language=target_lang)) and (not title_needs_target_translation(saved_title, asset.path, language_mode=mode, from_filename=bool(settings.video_title_from_filename), target_language=target_lang)):
                    content = saved_title
                needs = title_needs_target_translation(content, asset.path, language_mode=mode, from_filename=bool(settings.video_title_from_filename), target_language=target_lang)
                if not needs:
                    return replace(settings, video_title_content=content) if content and content != str(settings.video_title_content or '').strip() else settings
                if mode != 'auto_target':
                    pass
                else:
                    stem = title_from_media_path(asset.path) or content
                    if stem:
                        from core.video_title import apply_source_name_affixes, resolve_translated_title_fallback
                        text = ''
                        try:
                            panel = self.control_board.subtitle_panel
                            translation = panel.translation_settings()
                            key = self._resolve_provider_api_keys(translation.provider_id, panel.entered_api_key())
                            translated = translate_video_title(stem, translation, key=key or '')
                            text = str(translated or '').strip()
                            if text:
                                text = apply_source_name_affixes(text, asset.path)
                            if text and title_needs_target_translation(text, asset.path, language_mode=mode, from_filename=bool(settings.video_title_from_filename), target_language=target_lang):
                                text = ''
                        except Exception as exc:
                            self._log_event('Bỏ dịch tiêu đề khi xuất', str(exc))
                            text = ''
                        text = resolve_translated_title_fallback(source_path=asset.path, content=content or stem, language_mode=mode, from_filename=bool(settings.video_title_from_filename), target_language=target_lang, subtitle_document=self._subtitle_document_for_asset(asset))
                        if not text and text:
                            self._log_event('Tiêu đề lấy từ phụ đề khi xuất', f'{asset.name}: {text[:80]}')
                        sibling = self._sibling_translated_title_fallback(asset)
                        if not text and sibling:
                            text = sibling
                            self._log_event('Tiêu đề lấy từ clip cùng series', f'{asset.name}: {text[:80]}')
                        if not text or title_needs_target_translation(text, asset.path, language_mode=mode, from_filename=bool(settings.video_title_from_filename), target_language=target_lang):
                            self._log_event('Tiêu đề vẫn tiếng nguồn khi xuất', f'{asset.name}: API/phụ đề chưa cho bản đích — tạm giữ stem')
                            return replace(settings, video_title_content=content or stem)
                        is_live = str(self.state.selected_id or '') == str(asset.id)
                        if is_live:
                            self.state.values['video_title_content'] = text
                            if burn_title:
                                self.state.values['video_title_enabled'] = True
                            self.state.values['video_title_language_mode'] = 'auto_target'
                        bag = dict(self.state.asset_settings.get(asset.id) or {})
                        bag['video_title_content'] = text
                        if burn_title:
                            bag['video_title_enabled'] = True
                        bag['video_title_language_mode'] = 'auto_target'
                        self.state.asset_settings[asset.id] = bag
                        self._log_event('Tiêu đề đã dịch khi xuất', f'{asset.name}: {text[:80]}')
                        return replace(settings, video_title_enabled=burn_title, video_title_content=text, video_title_language_mode='auto_target')
        return settings

    def _subtitle_document_for_asset(self, asset) -> SubtitleDocument | None:
        if asset is not None and asset.kind == 'video' and asset.path:
            selected = self._selected_video_asset()
            if selected is not None and selected.id == asset.id and self.state.subtitles.segments:
                return self.state.subtitles
            working = self._working_subtitle_path_for(asset)
            if working.is_file():
                return load_srt(working)
            saved = self.state.asset_settings.get(asset.id, {}).get('subtitle_path', '')
            saved_text = str(saved or '').strip()
            saved_path = Path(saved_text)
            if saved_text and saved_path.is_file() and self._subtitle_path_belongs_to_video(saved_path, asset):
                return load_srt(saved_path)
        else:
            return None

    def _resolve_subtitle_path_for_asset(self, asset) -> str:
        document = self._subtitle_document_for_asset(asset)
        if document is not None and document.source_path:
            return document.source_path
        if asset is None:
            return ''
        working = self._working_subtitle_path_for(asset)
        return str(working) if working.is_file() else ''

    def _export_asset_stem(self, asset, settings, naming: str) -> str:
        from core.video_title import export_output_stem
        if asset is not None and asset.path:
            naming_key = str(naming or 'stem_edit')
            enabled = bool(settings.video_title_enabled) or naming_key == 'title_target'
            return export_output_stem(asset.path, enabled=enabled, from_filename=bool(settings.video_title_from_filename), content=str(settings.video_title_content or ''), language_mode=str(getattr(settings, 'video_title_language_mode', 'auto_target')), naming=naming_key)
        return 'video'

    def _export_settings_for_asset(self, asset_id: str):
        from ui_qt.asset_export import PROJECT_FRAME_KEYS
        from ui_qt.state import DEFAULT_EXPORT_VALUES
        live_toggle_keys = ('subtitle_enabled', 'subtitle_path', 'subtitle_translate_enabled', 'video_title_enabled', 'video_title_content', 'video_title_language_mode', 'batch_auto_scene_split', 'batch_auto_face_reframe', 'video_effect_master_enabled', 'media_overlays_master_enabled', 'blend_layers_master_enabled', 'background_layers_master_enabled', 'adjust_advanced_enabled', 'adjust_frame_enabled', 'adjust_scene_group_enabled')
        asset = next((a for a in self.state.assets if a.id == asset_id), None)
        sfx = tuple(load_sfx_events(asset.path)) if asset and asset.path else ()
        saved = self.state.asset_settings.get(asset_id)
        if saved:
            bag = dict(DEFAULT_EXPORT_VALUES)
            if isinstance(saved, dict):
                bag.update(saved)
            for key in PROJECT_FRAME_KEYS:
                if key in self.state.values:
                    bag[key] = self.state.values[key]
            if str(asset_id) == str(self.state.selected_id or ''):
                for key in live_toggle_keys:
                    if key in self.state.values:
                        bag[key] = self.state.values[key]
            frozen = (getattr(self, '_frozen_audio_intent_by_asset', None) or {}).get(str(asset_id))
            if frozen:
                from core.audio_intent import apply_audio_intent
                apply_audio_intent(bag, frozen)
            original = dict(self.state.values)
            original_sfx = list(self.state.sfx_events)
            original_selected = self.state.selected_id
            try:
                self.state.values.clear()
                self.state.values.update(bag)
                self.state.sfx_events = list(sfx)
                if asset is not None:
                    self.state.selected_id = asset_id
                settings = self.control_board.export_settings()
            finally:
                self.state.values.clear()
                self.state.values.update(original)
                self.state.sfx_events = original_sfx
                self.state.selected_id = original_selected
        else:
            settings = self.control_board.export_settings()
        frozen = (getattr(self, '_frozen_audio_intent_by_asset', None) or {}).get(str(asset_id))
        if frozen:
            from core.audio_intent import apply_audio_intent
            from core.audio_mix_state import sync_legacy_audio_keys
            derived = dict(frozen)
            apply_audio_intent(derived, frozen)
            sync_legacy_audio_keys(derived)
            settings = replace(settings, subtitle_enabled=bool(frozen['subtitle_enabled']), voice_audio_enabled=bool(frozen['voice_audio_enabled']), voice_audio_volume=int(frozen['voice_audio_volume']), video_vocal_enabled=bool(frozen['video_vocal_enabled']), video_vocal_volume=int(frozen['video_vocal_volume']), video_bgm_enabled=bool(frozen['video_bgm_enabled']), video_bgm_volume=int(frozen['video_bgm_volume']), background_audio_enabled=bool(frozen['background_audio_enabled']), background_audio_volume=int(frozen['background_audio_volume']), mute_original_audio=bool(derived.get('mute_original_audio')), remove_original_vocal=bool(derived.get('remove_original_vocal')), remove_original_bgm=bool(derived.get('remove_original_bgm')), audio_volume=int(derived.get('audio_volume') or 0))
        settings = replace(settings, sfx_events=sfx)
        nvenc_cap = getattr(self, '_batch_nvenc_slot_cap', None)
        if nvenc_cap is not None:
            queued = len(getattr(self, '_produce_export_tasks', {}) or {}) + len(getattr(self, '_produce_export_plan_queue', []) or [])
            if queued >= int(nvenc_cap):
                settings = replace(settings, encoder_backend='cpu')
            return settings
        if self._batch_produce_export_active and getattr(self, '_batch_export_force_cpu', False):
            settings = replace(settings, encoder_backend='cpu')
        return settings

    def _start_export_task(self, task) -> None:
        if self.export_task is not None:
            self.statusBar().showMessage('Đang có lệnh xuất khác — bấm «Dừng xuất»', 4000)
        elif self._has_exclusive_job():
            self._report_error('Chưa thể bắt đầu xuất', 'Đang chạy phụ đề / TTS / CapCut. Bấm «Dừng xuất» hoặc chờ xong.')
        else:
            output_name = Path(getattr(task, 'final_output', None) or getattr(getattr(task, 'plan', None), 'final_output', '') or getattr(getattr(task, 'plan', None), 'output', '') or '').name
            self._log_event('Bắt đầu xuất video', getattr(task, 'final_output', None) or getattr(getattr(task, 'plan', None), 'final_output', '') or getattr(getattr(task, 'plan', None), 'output', ''))
            try:
                plan = getattr(task, 'plan', None)
                from ui_qt.workers.export_job_spec import ExportJobSpec
                if isinstance(plan, ExportJobSpec):
                    self._log_event('Kế hoạch xuất', f'Deferred job · {plan.label or Path(plan.source).name} → {plan.output}')
                else:
                    self._log_event('Kế hoạch FFmpeg', summarize_export_plan_for_log(plan))
            except Exception as exc:
                self._log_activity(f'Không tóm tắt được plan: {exc}')
            self.export_task = task
            task.signals.progressChanged.connect(self._on_export_progress)
            if hasattr(task.signals, 'activityLogged'):
                task.signals.activityLogged.connect(self._on_export_activity)
            task.signals.completed.connect(self._on_export_completed)
            task.signals.failed.connect(self._on_export_failed)
            task.signals.finished.connect(self._on_export_finished)
            self._set_export_resource_mode(True)
            if self._batch_produce_export_active:
                done = self._batch_produce_export_completed
                total = max(1, self._batch_produce_export_total)
                message = f'Clip {done + 1}/{total}: {output_name} — đang ffmpeg…' if output_name else f'Clip {done + 1}/{total} — đang ffmpeg…'
                self._update_batch_produce_progress(0, message)
            else:
                self.export_progress.setValue(0)
                self.export_progress.setFormat('Đang xuất %p%')
                self.export_progress.show()
                title = f'Đang xuất: {output_name}' if output_name else 'Đang xuất video'
                self.export_panel.begin(title)
                self._refresh_export_ui()
                self.statusBar().showMessage('Đang xuất video... 0%')
            self.thread_pool.start(task)

    def _start_batch_export_task(self, task) -> None:
        if self._has_blocking_job():
            self._report_error('Không bắt đầu xuất hàng loạt', 'Đang có tác vụ khác — bấm «Dừng xuất» rồi thử lại.', dialog=True)
            return None
        total = len(getattr(task, 'plans', ()) or ())
        self._log_event('Bắt đầu xuất hàng loạt', task.__class__.__name__)
        self.batch_task = task
        task.signals.progressChanged.connect(self._on_batch_progress)
        task.signals.completed.connect(self._on_batch_completed)
        task.signals.failed.connect(self._on_batch_failed)
        task.signals.finished.connect(self._on_batch_finished)
        self._set_export_resource_mode(True)
        self.export_progress.setValue(0)
        self.export_progress.setFormat('Đang xuất batch %p%')
        self.export_progress.show()
        title = f'Đang xuất hàng loạt ({total} video)' if total else 'Đang xuất hàng loạt'
        self.export_panel.begin(title)
        self._refresh_export_ui()
        self.statusBar().showMessage('Đang xuất hàng loạt... 0%')
        self.thread_pool.start(task)

    def _on_export_activity(self, message: str) -> None:
        now = time.monotonic()
        text = str(message or '').strip()
        if text:
            if not self._batch_produce_export_active and self.export_task is not None and (now - float(self._export_activity_ui_at) >= 0.9):
                self._export_activity_ui_at = now
                short = text if len(text) <= 140 else text[:137] + '…'
                self.export_panel.step_label.setText(f'Live: {short}')
                self.export_panel.step_label.setVisible(True)
                self._apply_export_live_hint(text)
            if now - float(self._export_activity_log_at) >= 10.0:
                self._export_activity_log_at = now
                self._log_activity(text, title='Xuất')
                return None
        else:
            return None

    def _apply_export_live_hint(self, message: str) -> None:
        speed_m = re.search('speed=([0-9.]+)\\s*x?', message, re.I)
        out_m = re.search('out=([0-9.]+)s', message, re.I)
        bits = []
        try:
            speed = float(speed_m.group(1))
            if speed_m and speed > 0.01:
                bits.append(f'tốc độ ~{speed:.2f}x')
                if speed < 0.6:
                    bits.append('filter nặng → encode chậm, vẫn bình thường')
        except ValueError:
            pass
        if out_m:
            try:
                bits.append(f'đã render ~{float(out_m.group(1)):.0f}s timeline')
            except ValueError:
                pass
        if bits:
            self.export_panel.hint_label.setText(' · '.join(bits) + '. Windows «Not Responding» tạm là do tải CPU — đừng Force close nếu Live/% còn đổi.')

    def _set_export_resource_mode(self, active: bool) -> None:
        want = bool(active)
        currently = self._export_resource_depth > 0
        if not currently if want else currently:
            try:
                playback = getattr(self.preview_panel, 'playback', None)
                if playback is not None:
                    if hasattr(playback, 'set_export_resource_mode'):
                        playback.set_export_resource_mode(want)
                    else:
                        playback.pause()
            except Exception:
                pass
            try:
                canvas = getattr(self.preview_panel, 'frame_canvas', None)
                if canvas is not None and hasattr(canvas, 'set_export_busy'):
                    canvas.set_export_busy(want)
            except Exception:
                pass
            if want:
                self._export_keepalive.start()
            else:
                self._export_keepalive.stop()
            return None

    def _on_export_keepalive_tick(self) -> None:
        if self._has_export_job() or self._batch_produce_export_active:
            try:
                QApplication.processEvents(QEventLoop.ProcessEventsFlag.ExcludeUserInputEvents)
            except Exception:
                try:
                    QApplication.processEvents()
                except Exception:
                    pass
                return None
        else:
            self._export_keepalive.stop()

    def _on_produce_export_activity(self, asset_id: str, message: str) -> None:
        asset = next((a for a in self.state.assets if a.id == asset_id), None)
        label = asset.name if asset is not None else asset_id
        self._log_activity(f'{label}: {message}', title='Xuất batch')

    def _on_export_progress(self, value: int) -> None:
        percent = max(0, min(100, int(value)))
        if self._batch_produce_export_active:
            done = self._batch_produce_export_completed
            total = max(1, self._batch_produce_export_total)
            message = f'Clip {done + 1}/{total} — ffmpeg {percent}%'
            self._update_batch_produce_progress(percent, message)
        else:
            self.export_progress.setValue(percent)
            if percent >= 99:
                self.export_panel.set_progress(percent, 'Đang hoàn tất file xuất (FFmpeg ghi phần cuối)…')
                self.export_panel.step_label.setText('Bước: Giai đoạn cuối — blur/overlay/ken burns có thể mất thêm 1–3 phút')
                self.export_panel.step_label.setVisible(True)
            elif percent >= 90:
                self.export_panel.set_progress(percent, 'Đang xuất video')
                self.export_panel.step_label.setText('Bước: Encode filter nặng (blur, overlay, phụ đề) — vẫn đang chạy…')
                self.export_panel.step_label.setVisible(True)
            elif percent >= 85:
                self.export_panel.set_progress(percent, 'Đang xuất video')
                self.export_panel.step_label.setText('Bước: Encode filter (blur, overlay, chuyển động)…')
                self.export_panel.step_label.setVisible(True)
            else:
                self.export_panel.set_progress(percent, 'Đang xuất video')
            self.statusBar().showMessage(f'Đang xuất video... {percent}%')
        if percent in frozenset({1, 100, 5, 10, 75, 50, 25, 90}) or percent % 10 == 0:
            self._log_event(f'Tiến trình xuất {percent}%')
            return None

    def _continue_editing_during_export(self) -> None:
        self.switch_module('media')
        self.project_panel.asset_list.setEnabled(True)
        self.project_panel.add_button.setEnabled(True)
        self.project_panel.asset_list.setFocus(Qt.FocusReason.OtherFocusReason)
        self.statusBar().showMessage('Đang xuất nền — chọn video khác bên trái để soạn tiếp', 5000)

    def stop_export(self) -> None:
        if self._is_batch_pipeline_active() or self._batch_user_paused:
            self.stop_batch_job()
            return None
        self._pending_export_after_dub = ''
        if self._single_export_prep_active:
            self._clear_single_export_prep()
            self._batch_produce_prep_asset_id = ''
            self._batch_produce_prep_step = ''
            self._batch_face_reframe_values = None
            self._batch_face_reframe_asset_id = ''
        cancelled = False
        for task in (self.export_task, self.batch_task, self.subtitle_task, self.tts_task, self.tts_preview_task, self.capcut_task, self.auto_blur_task, self.face_reframe_task, self.hardsub_task, self.scene_detect_task):
            if task is not None and hasattr(task, 'cancel'):
                task.cancel()
                cancelled = True
        if self._cancel_scene_detect_batch():
            cancelled = True
        if self._produce_export_tasks:
            self._clear_produce_export_tasks(cancel=True)
            cancelled = True
        self.actions['stop'].setEnabled(False)
        if cancelled:
            self.statusBar().showMessage('Đang dừng tác vụ nền…')
            return None
        self.statusBar().showMessage('Không có tác vụ để dừng')

    def open_last_export_folder(self) -> None:
        folder = get_last_export_folder()
        if folder and Path(folder).is_dir():
            self._open_in_file_manager(folder)
        else:
            self.statusBar().showMessage('Chưa có thư mục xuất nào được nhớ', 3000)
            return None

    def _offer_open_export_folder(self, output_path: str) -> None:
        if self.isVisible():
            box = QMessageBox(self)
            box.setIcon(QMessageBox.Icon.Information)
            box.setWindowTitle('Xuất xong')
            box.setText(f'Đã xuất:\n{Path(output_path).name}\n\nMở thư mục chứa file?')
            box.setStandardButtons(QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No)
            box.setDefaultButton(QMessageBox.StandardButton.Yes)
            box.setStyleSheet('QMessageBox { background-color: #121925; color: #E7EDF7; }QLabel { color: #E7EDF7; background: transparent; }QPushButton {  background: #1A2740; border: 1px solid #3D7DE8;  border-radius: 6px; color: #F5F8FD;  min-width: 72px; min-height: 28px; padding: 4px 12px;}')
            answer = box.exec()
            if answer == QMessageBox.StandardButton.Yes:
                self._open_in_file_manager(output_path)
                return None
        else:
            return None

    def _open_in_file_manager(self, path: str | Path) -> None:
        target = Path(path).expanduser().resolve()
        if not target.exists():
            self.statusBar().showMessage('Không tìm thấy đường dẫn để mở', 3000)
        elif sys.platform.startswith('win') and target.is_file():
            try:
                subprocess.Popen(['explorer', '/select,', str(target)], creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            except OSError:
                pass
        else:
            folder = target if target.is_dir() else target.parent
            QDesktopServices.openUrl(QUrl.fromLocalFile(str(folder)))

    def _on_export_completed(self, result: ExportResult) -> None:
        name = Path(result.output_path).name
        if self._batch_produce_export_active:
            finished_id = self._pipeline_asset_id or self.state.selected_id or ''
            self._batch_produce_export_completed += 1
            done = self._batch_produce_export_completed
            total = self._batch_produce_export_total
            if self._active_batch_job is not None and finished_id:
                self._active_batch_job.mark_completed(finished_id)
                self._active_batch_job.used_output_paths.append(str(Path(result.output_path).resolve()))
                self._persist_batch_job()
            self.export_panel.mark_completed(f'Đã xuất {done}/{total}: {name}')
            self.export_progress.setValue(int(done * 100 / max(total, 1)))
            self.export_progress.setFormat('Xuất hàng loạt %p%')
            self.export_task = None
            self._refresh_export_ui()
            remember_path('export', result.output_path)
            self.statusBar().showMessage(f'Xuất hàng loạt {done}/{total}: {name}')
            self._log_event('Hoàn tất xuất clip', result.output_path)
            if self._batch_user_paused:
                self._finalize_batch_pause()
            else:
                QTimer.singleShot(0, self._start_next_batch_produce_export)
        else:
            self.export_panel.mark_completed(f'Đã xuất: {name}')
            self.export_progress.setValue(100)
            self.export_task = None
            self._set_export_resource_mode(False)
            self._refresh_export_ui()
            remember_path('export', result.output_path)
            self.statusBar().showMessage(f'Đã xuất xong: {name}')
            self._log_event('Hoàn tất xuất video', result.output_path)
            try:
                from services_video_export import cleanup_export_output_artifacts
                cleanup_export_output_artifacts(result.output_path, force=True)
            except Exception:
                pass
            asset = self._selected_export_asset()
            if asset is not None:
                paths = dict(self.state.values.get('asset_last_export_paths') or {})
                paths[asset.id] = str(Path(result.output_path).resolve())
                self.state.values['asset_last_export_paths'] = paths
                self._schedule_autosave()
            self._offer_open_export_folder(result.output_path)
            self.export_panel.hide()

    def _on_export_failed(self, message: str) -> None:
        if self._batch_pause_requested:
            self._finalize_batch_pause()
            return None
        if self._batch_produce_export_active:
            self.export_task = None
            workbench = self._batch_workbench()
            on_error = workbench.batch_on_error_mode() if workbench is not None else 'skip'
            if on_error == 'skip' and 'dừng' not in message.lower():
                self._refresh_export_ui()
                self.statusBar().showMessage(f'Bỏ qua clip lỗi xuất — tiếp clip sau… ({message})')
                QTimer.singleShot(0, self._start_next_batch_produce_export)
            elif 'dừng' in message.lower():
                self._batch_produce_export_ids = []
                self._finish_batch_produce_export(aborted=True, reason='Đã dừng theo yêu cầu')
            else:
                self._finish_batch_produce_export(aborted=True, reason=message)
            return None
        self.export_task = None
        self._set_export_resource_mode(False)
        if 'dừng' in message.lower():
            self.export_panel.hide()
            self._refresh_export_ui()
            self.statusBar().showMessage('Đã dừng xuất video')
            return None
        self.export_panel.mark_failed('Xuất không thành công')
        self._refresh_export_ui()
        self._log_event('Xuất video thất bại', message[:500])
        self._show_export_failed_message(message)
        self.export_panel.hide()

    def _on_export_finished(self) -> None:
        if self.export_task is not None:
            self.export_task = None
            self._refresh_export_ui()
        if self._has_export_job():
            pass
        else:
            if self._batch_produce_export_active:
                pass
            else:
                self._set_export_resource_mode(False)
            return None

    def _on_batch_progress(self, value: int, message: str) -> None:
        percent = max(0, min(100, int(value)))
        self.export_progress.setValue(percent)
        self.export_progress.setFormat(f'{message} %p%')
        self.export_panel.set_progress(percent, message)
        self.statusBar().showMessage(f'{message}... {percent}%')
        if percent in frozenset({1, 100, 5, 10, 75, 50, 25, 90}) or percent % 10 == 0:
            self._log_event(f'Tiến trình batch {percent}%', message)
            return None

    def _on_batch_completed(self, results) -> None:
        self._clear_batch_job_file()
        summary = f'Đã xuất xong {len(results)} video trong hàng loạt'
        self.export_panel.mark_completed(summary)
        self.export_progress.setValue(100)
        self.batch_task = None
        self._set_export_resource_mode(False)
        self._refresh_export_ui()
        self.statusBar().showMessage(summary)
        self._log_event('Hoàn tất xuất hàng loạt', f'{len(results)} video')
        if results:
            first = getattr(results[0], 'output_path', '') or str(results[0])
            remember_path('export', first)
            self._offer_open_export_folder(first)
        self.export_panel.hide()

    def _on_batch_failed(self, message: str) -> None:
        if self._batch_pause_requested:
            self._finalize_batch_pause()
            return None
        self.batch_task = None
        self._set_export_resource_mode(False)
        if 'dừng' in message.lower():
            self.export_panel.hide()
            self._refresh_export_ui()
            self.statusBar().showMessage('Đã dừng xuất hàng loạt')
            return None
        self.export_panel.mark_failed('Xuất hàng loạt không thành công')
        self._refresh_export_ui()
        self._report_error('Xuất hàng loạt không thành công', message)
        self.export_panel.hide()

    def _on_batch_finished(self) -> None:
        if self.batch_task is not None:
            self.batch_task = None
            self._refresh_export_ui()
        if self._has_export_job():
            pass
        else:
            if self._batch_produce_export_active:
                pass
            else:
                self._set_export_resource_mode(False)
            return None

    def _selected_export_asset(self):
        return self._selected_video_asset()

    def _selected_video_asset(self):
        selected = self.state.selected_asset
        candidates = ([selected] if selected is not None else []) + list(self.state.assets)
        for asset in candidates:
            if asset is not None and asset.kind == 'video' and asset.path and Path(asset.path).is_file():
                return asset

    def _video_assets(self):
        return [asset for asset in self.state.assets if asset.kind == 'video' and asset.path and Path(asset.path).is_file()]

    def _has_export_job(self) -> bool:
        return self.export_task is not None or self.batch_task is not None or bool(self._produce_export_tasks)

    def _is_export_pipeline_busy(self) -> bool:
        return self._has_export_job() or self._batch_produce_export_active or self._batch_dub_active or self._single_export_prep_active

    def _has_exclusive_job(self) -> bool:
        return self.subtitle_task is not None or self.tts_task is not None or self.tts_preview_task is not None or (self.capcut_task is not None) or (self.auto_blur_task is not None) or (self.face_reframe_task is not None) or (self.scene_detect_task is not None) or (self.hardsub_task is not None)

    def _locks_editor(self) -> bool:
        return False if self._is_export_pipeline_busy() else self._has_exclusive_job()

    def _pin_export_job_if_busy(self) -> bool:
        if self._is_export_pipeline_busy():
            if self._export_job_state is None:
                self._export_job_state = self.state
                self._export_job_path = str(self._project_path or '')
            return True
        return False

    def _should_swap_to_job_state(self) -> bool:
        job = getattr(self, '_export_job_state', None)
        return job is not None and job is not self.state and (int(getattr(self, '_job_state_swap_depth', 0) or 0) == 0)

    @contextmanager
    def _using_job_state(self):
        job = getattr(self, '_export_job_state', None)
        if job is None or job is self.state:
            yield None
        else:
            editor = self.state
            editor_path = self._project_path
            self._job_state_swap_depth = int(getattr(self, '_job_state_swap_depth', 0) or 0) + 1
            self.state = job
            if self._export_job_path:
                self._project_path = self._export_job_path
            try:
                yield None
            finally:
                self._job_state_swap_depth = max(0, self._job_state_swap_depth - 1)
                self.state = editor
                self._project_path = editor_path

    def _release_export_job_state(self) -> None:
        job = self._export_job_state
        path = str(self._export_job_path or '')
        self._export_job_state = None
        self._export_job_path = ''
        self._job_state_swap_depth = 0
        if job is not None and path:
            try:
                save_named_project(job, path, project_name=read_project_name(path))
            except (OSError, ValueError):
                pass

    def _prepare_pipeline_result_apply(self) -> bool:
        pipeline_id = str(self._pipeline_asset_id or '')
        user_id = str(self.state.selected_id or getattr(self, '_user_edit_asset_id', '') or '')
        if self._is_export_pipeline_busy() and pipeline_id and user_id and (user_id != pipeline_id):
            self._user_edit_asset_id = user_id
            self._persist_video_subtitles(user_id)
            self.state.snapshot_asset_settings(user_id)
            self.state.select(pipeline_id)
            self.state.restore_asset_settings(pipeline_id)
            pipe = next((a for a in self.state.assets if a.id == pipeline_id), None)
            if pipe is not None:
                self._load_video_subtitles(pipe)
            return True
        return False

    def _restore_detached_editor(self) -> None:
        user_id = str(getattr(self, '_user_edit_asset_id', '') or '')
        pipeline_id = str(self._pipeline_asset_id or '')
        if not user_id or user_id == pipeline_id:
            return None
        if any((a.id == user_id for a in self.state.assets)):
            if pipeline_id:
                if self.state.selected_id == pipeline_id:
                    self.state.snapshot_asset_settings(pipeline_id)
                else:
                    self._log_event('Bỏ snapshot pipeline — owner khác', f'selected={self.state.selected_id} pipeline={pipeline_id}')
            if self.state.selected_id == user_id:
                return None
            self._show_asset_quietly(user_id)
        else:
            return None

    def _show_asset_quietly(self, asset_id: str) -> None:
        if self.state.selected_id != asset_id:
            self.state.select(asset_id)
        restored = self.state.restore_asset_settings(asset_id)
        asset = next((a for a in self.state.assets if a.id == asset_id), None)
        if asset is None:
            return None
        if asset.kind == 'video':
            if not restored:
                self._reset_unedited_video_session(asset)
            self._load_video_subtitles(asset)
            self.control_board.reload_project(self.state)
            self.preview_panel.refresh_settings()
        self.project_panel.set_selected_asset(asset_id)
        self.preview_panel.set_selected_asset(asset)
        self.timeline_panel.set_selected_asset(asset_id)
        self.control_board.set_context(asset.kind)

    def _has_background_job(self) -> bool:
        return self._has_export_job() or self._has_exclusive_job()

    def _has_blocking_job(self) -> bool:
        return self._has_background_job()

    def _refresh_credential_mask(self) -> None:
        panel = self.control_board.subtitle_panel
        panel.set_masked_credential(self.credential_store.masked(panel.selected_provider_id()))

    def _refresh_export_ui(self) -> None:
        export_busy = self._is_export_pipeline_busy()
        exclusive = self._has_exclusive_job()
        busy = export_busy or exclusive
        can_export = not busy and self._selected_export_asset() is not None
        self.actions['export'].setEnabled(can_export)
        can_batch = not busy and bool(self._video_assets())
        self.actions['batch_export'].setEnabled(can_batch)
        self.actions['stop'].setEnabled(busy)
        batch_bench = self.module_workbenches.get('batch')
        if batch_bench is not None:
            batch_bench.set_export_actions_enabled(can_export, can_batch)
        if busy:
            self.actions['stop'].setToolTip('Dừng tác vụ đang chạy (xuất/TTS/hardsub/…)')
        else:
            self.actions['stop'].setToolTip('Dừng quá trình xuất video đang chạy')
        lock_project = self._locks_editor()
        self.project_panel.add_button.setEnabled(not lock_project)
        self.project_panel.asset_list.setEnabled(not lock_project)
        if export_busy:
            self.actions['export'].setToolTip('Đang xuất nền — bấm «Làm tiếp video khác» hoặc chọn clip bên trái')
        elif busy:
            self.actions['export'].setToolTip('Đang có tác vụ chạy — bấm Dừng nếu cần')
        elif can_export:
            asset = self._selected_export_asset()
            name = asset.name if asset is not None else 'video'
            self.actions['export'].setToolTip(f'Xuất ngay: {name} → thư mục OUTPUT (Shift = chọn nơi khác)')
        else:
            self.actions['export'].setToolTip('Thêm ít nhất một video thật để xuất')
        if export_busy:
            self.actions['batch_export'].setToolTip('Đang xuất nền — có thể chỉnh video khác, chờ xong rồi xuất lô mới')
        elif busy:
            self.actions['batch_export'].setToolTip('Đang có tác vụ chạy')
        elif can_batch:
            self.actions['batch_export'].setToolTip('Xuất hàng loạt — số luồng ffmpeg: module Export → Xuất song song')
        else:
            self.actions['batch_export'].setToolTip('Thêm ít nhất một video thật để xuất hàng loạt')
        self.control_board.set_subtitle_busy(exclusive)
        if not busy and (not self._batch_user_paused):
            self.export_progress.hide()
            self.export_progress.setValue(0)
        self._update_batch_control_ui()

    def show_error_log(self) -> None:
        if self.error_log_dialog is None:
            self.error_log_dialog = ErrorLogDialog(self)
        self.error_log_dialog.set_log('\n\n'.join(self._error_log))
        self.error_log_dialog.show()
        self.error_log_dialog.raise_()
        self.error_log_dialog.activateWindow()

    def open_storage_cleanup_dialog(self) -> None:
        from ui_qt.widgets.storage_cleanup_dialog import StorageCleanupDialog
        from ui_qt.asset_export import subtitle_project_key_from_path
        export_folders = []
        seen_folders = set()

        def _collect_folder(raw: str) -> None:
            'Nhận folder trực tiếp hoặc file video -> lấy thư mục chứa nó (cache xuất nằm cạnh output/video).'
            text = str(raw or '').strip()
            if not text:
                return None
            try:
                candidate = Path(text).expanduser().resolve()
            except OSError:
                return None
            folder = candidate if candidate.is_dir() else candidate.parent
            if folder.is_dir() and str(folder).casefold() not in seen_folders:
                seen_folders.add(str(folder).casefold())
                export_folders.append(folder)
            return None

        _collect_folder(get_last_export_folder())
        for asset in self.state.assets:
            if str(getattr(asset, 'kind', '') or '').lower() == 'video':
                _collect_folder(getattr(asset, 'path', ''))
        live_project_dirs = {'unsaved'}
        if getattr(self, '_project_path', ''):
            live_project_dirs.add(subtitle_project_key_from_path(self._project_path))
        try:
            for summary in list_recent_projects(limit=32):
                live_project_dirs.add(subtitle_project_key_from_path(summary.path))
                _collect_folder(summary.first_video_path)
        except Exception:
            pass
        dialog = StorageCleanupDialog(self, export_folders=export_folders, subtitle_workspace=self.subtitle_workspace, live_project_dirs=live_project_dirs)
        dialog.exec()

    def _log_event(self, title: str, detail: str='') -> None:
        entry = f"[{datetime.now().strftime('%H:%M:%S')}] {title}"
        if detail:
            entry = f'{entry}\n{detail}'
        self._append_log_entry(entry)

    def _log_activity(self, detail: str, title: str='TRACE') -> None:
        entry = f"[{datetime.now().strftime('%H:%M:%S')}] [{title}] {detail}"
        self._error_log.append(entry)
        try:
            with self._log_path.open('a', encoding='utf-8') as handle:
                handle.write(entry + '\n\n')
        except OSError:
            pass
        if self.error_log_dialog is not None:
            if self.error_log_dialog.verbose_trace:
                if self.error_log_dialog.isVisible():
                    self.error_log_dialog.append(entry)

    def _append_log_entry(self, entry: str) -> None:
        self._error_log.append(entry)
        try:
            with self._log_path.open('a', encoding='utf-8') as handle:
                handle.write(entry + '\n\n')
        except OSError:
            pass
        if self.error_log_dialog is not None:
            if self.error_log_dialog.isVisible():
                self.error_log_dialog.append(entry)
            else:
                self.error_log_dialog.set_log('\n\n'.join(self._error_log))

    def _begin_batch_export_ui(self, total: int, phase: str='Chuẩn bị') -> None:
        count = max(1, int(total))
        title = f'Xuất hàng loạt — {count} video'
        self.export_panel.begin(title)
        self.export_panel.set_batch_detail(completed=0, current_index=1, total=count, step=phase)
        self.export_panel.set_progress(1, f'{phase} — {count} video')
        self.export_panel.raise_()
        self.export_progress.setValue(0)
        self.export_progress.setFormat('Xuất hàng loạt %p%')
        self.export_progress.show()
        self._refresh_export_ui()

    def _update_batch_plan_progress(self, index: int, total: int, asset_name: str) -> None:
        total = max(1, int(total))
        index = max(1, min(int(index), total))
        percent = max(1, min(99, int((index - 1) * 100 / total)))
        message = f'Chuẩn bị clip {index}/{total}: {asset_name}'
        self.export_panel.set_progress(percent, message)
        self.export_panel.set_batch_detail(completed=0, current_index=index, total=total, step='Lập kế hoạch ffmpeg')
        self.export_panel.step_label.setText('Bước: Kiểm tra phụ đề, voice, lệnh ffmpeg (không tách Demucs trên UI)')
        self.export_panel.step_label.setVisible(True)
        self.export_progress.setValue(percent)
        self.statusBar().showMessage(f'{message} — {percent}%', 8000)
        self._log_event('Chuẩn bị xuất clip', f'{index}/{total}: {asset_name}')
        QApplication.processEvents()

    def _show_batch_notice(self, title: str, detail: str) -> None:
        self._log_event(title, detail)
        if self.isVisible():
            box = QMessageBox(self)
            box.setIcon(QMessageBox.Icon.Information)
            box.setWindowTitle(title)
            box.setText(title)
            if detail:
                box.setInformativeText(detail)
            box.setStandardButtons(QMessageBox.StandardButton.Ok)
            box.exec()
        else:
            return None

    def open_license_panel(self) -> None:
        from ui_qt.panels.license_panel import LicensePanel
        dialog = LicensePanel(self, require_license=False)
        dialog.exec()
        QTimer.singleShot(0, self._license_startup_check)

    def _license_startup_check(self) -> None:
        from core.license_client import check, is_licensed, status_text
        try:
            check()
        except Exception:
            pass
        if is_licensed():
            pass
        else:
            self.statusBar().showMessage(status_text(), 8000)

    def _ensure_licensed_or_warn(self, *, action: str) -> bool:
        from core.license_client import check, is_licensed
        from ui_qt.panels.license_panel import LicensePanel
        try:
            if not bool(check(force_online=True).get('ok')):
                dialog = LicensePanel(self, require_license=False)
                dialog.exec()
                return bool(is_licensed())
        except Exception:
            pass
        return True

    def _report_error(self, title: str, detail: str='', *, dialog: bool) -> None:
        self._log_event(title, detail)
        if self.error_log_dialog is None or not self.error_log_dialog.silence_status:
            self.statusBar().showMessage(f'{title}: {detail}' if detail else title, 8000)
        if dialog:
            if self.isVisible():
                box = QMessageBox(self)
                box.setIcon(QMessageBox.Icon.Warning)
                box.setWindowTitle(title)
                box.setText(title)
                if detail:
                    box.setInformativeText(detail)
                box.setStandardButtons(QMessageBox.StandardButton.Ok)
                box.exec()
            return None

    def _show_export_error(self, exc: BaseException) -> None:
        from services_video_export import format_export_error
        if isinstance(exc, ValueError):
            title, detail = (format_pre_export_validation_error(exc)[0], format_pre_export_validation_error(exc)[1])
        else:
            detail, title = (str(exc), 'Xuất video không thành công')
        self._report_error(title, detail, dialog=True)

    def _show_export_failed_message(self, message: str) -> None:
        from services_video_export import format_export_error
        detail = format_export_error(message)
        self._report_error('Xuất video không thành công', detail, dialog=True)

    def _set_inspector_full_height(self, enabled: bool) -> None:
        enabled = bool(enabled)
        if bool(getattr(self, '_inspector_full_height', False)) == enabled:
            return None
        top = getattr(self, 'workspace_top_splitter', None)
        outer = getattr(self, 'workspace_outer_splitter', None)
        dock = getattr(self, 'control_dock', None)
        if top is None or outer is None or dock is None:
            return None
        insp_w = 320
        if enabled:
            sizes = list(top.sizes())
            if len(sizes) >= 3 and sizes[2] > 80:
                insp_w = int(sizes[2])
            self._layout_inspector_width = insp_w
            dock.setParent(None)
            dock.setMinimumHeight(48)
            dock.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Expanding)
            outer.addWidget(dock)
            outer.setStretchFactor(0, 1)
            outer.setStretchFactor(1, 0)
            outer.setCollapsible(1, False)
            total = max(sum(outer.sizes()) if outer.count() > 1 else 0, outer.width(), 1100)
            insp_w = max(280, min(520, int(getattr(self, '_layout_inspector_width', insp_w))))
            outer.setSizes([max(640, total - insp_w), insp_w])
            left_w, preview_w = ((480, 640)[0], (480, 640)[1])
            if len(sizes) >= 2:
                left_w = max(160, int(sizes[0]))
                preview_w = max(320, int(sizes[1]))
            top.setSizes([left_w, preview_w])
        else:
            dock.setParent(None)
            dock.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Ignored)
            top.addWidget(dock)
            top.setStretchFactor(2, 0)
            top.setCollapsible(2, True)
            insp_w = int(getattr(self, '_layout_inspector_width', 280) or 280)
            sizes = list(top.sizes())
            left_w = max(160, int(sizes[0])) if sizes else 480
            preview_w = max(320, int(sizes[1])) if len(sizes) > 1 else 640
            top.setSizes([left_w, preview_w, max(240, insp_w)])
            if outer.count() > 1:
                pass
            outer.setSizes([max(1, outer.width())])
        self._inspector_full_height = enabled
        dock.show()

    def set_layout_focus_mode(self, mode: str) -> None:
        mode = str(mode or 'normal').strip().lower()
        if mode not in frozenset({'inspector', 'timeline', 'normal'}):
            mode = 'normal'
        prev = str(getattr(self, '_layout_focus_mode', 'normal') or 'normal')
        v_split = getattr(self, 'workspace_vertical_splitter', None)
        h_split = getattr(self, 'workspace_top_splitter', None)
        if v_split is None or h_split is None:
            return None
        self._layout_saved_vertical = list(v_split.sizes())
        if prev == 'normal' and mode != 'normal' and (not getattr(self, '_inspector_full_height', False)):
            self._layout_saved_horizontal = list(h_split.sizes())
        self._layout_focus_mode = mode
        sync_ui = getattr(self.timeline_panel, 'set_layout_mode_ui', None)
        if callable(sync_ui):
            sync_ui(mode)
        if not self.timeline_panel.is_body_visible():
            self.timeline_panel.set_body_visible(True)
        total_v = max(sum(v_split.sizes()), 720)
        min_left = int(getattr(self, '_LEFT_LIBRARY_MIN_WIDTH', 160))
        if mode == 'inspector':
            self._set_inspector_full_height(True)
            timeline_h = max(self.timeline_panel.minimumHeight(), int(total_v * 0.28))
            timeline_h = min(timeline_h, max(160, int(total_v * 0.36)))
            preview_h = max(200, total_v - timeline_h)
            v_split.setSizes([preview_h, timeline_h])
            self._timeline_split_sizes = [preview_h, timeline_h]
            self.statusBar().showMessage('TT: thuộc tính full dọc — timeline chỉ bên trái cột thuộc tính', 4500)
        elif mode == 'timeline':
            self._set_inspector_full_height(False)
            timeline_h = max(300, int(total_v * 0.58))
            preview_h = max(140, total_v - timeline_h)
            v_split.setSizes([preview_h, timeline_h])
            self._timeline_split_sizes = [preview_h, timeline_h]
            saved_h = self._layout_saved_horizontal
            if saved_h and len(saved_h) >= 3:
                h_split.setSizes(saved_h)
            else:
                sizes = list(h_split.sizes())
                if h_split.count() >= 3 and sizes[2] < 240:
                    sizes[2] = 280
                    h_split.setSizes(sizes)
            self.statusBar().showMessage('TL: timeline full ngang (như hiện tại) — thuộc tính giữ cột trên', 4000)
        else:
            self._set_inspector_full_height(False)
            saved_v = self._layout_saved_vertical or [580, 240]
            saved_h = self._layout_saved_horizontal or [max(480, min_left), 640, 280]
            v_split.setSizes(saved_v)
            self._timeline_split_sizes = list(saved_v)
            if h_split.count() >= 3:
                h_split.setSizes(saved_h)
            self.statusBar().showMessage('Bố cục Thường', 2500)
        self.preview_panel.sync_canvas_geometry()
        if hasattr(self, 'module_rail'):
            self.module_rail._apply_overflow_visibility()
            return None

    def _on_preview_timeline_splitter_moved(self, _pos: int, _index: int) -> None:
        self.preview_panel.sync_canvas_geometry()
        sizes = self.workspace_vertical_splitter.sizes()
        if not self.timeline_panel.is_body_visible() and sizes and (sizes[1] > self.timeline_panel._TIMELINE_HEADER_HEIGHT + 24):
            self.timeline_panel.set_body_visible(True)
            return None
        if self.timeline_panel.is_body_visible():
            if sizes:
                if sum(sizes) > 0:
                    if sizes[1] > self.timeline_panel._TIMELINE_HEADER_HEIGHT:
                        self._timeline_split_sizes = list(sizes)
            return None

    def _on_timeline_track_controls_changed(self) -> None:
        self.preview_panel.frame_canvas.update()
        self._schedule_autosave()

    def _on_timeline_body_visible_changed(self, visible: bool) -> None:
        splitter = self.workspace_vertical_splitter
        if visible:
            sizes = self._timeline_split_sizes or [420, 420]
            total = max(sum(splitter.sizes()), sum(sizes), 1)
            preview = max(56, int(sizes[0]))
            timeline = max(120, int(sizes[1]))
            scale = total / max(preview + timeline, 1)
            splitter.setSizes([int(preview * scale), int(timeline * scale)])
        else:
            sizes = splitter.sizes()
            if sizes and sum(sizes) > 0:
                self._timeline_split_sizes = list(sizes)
            total = max(sum(sizes), 900)
            header = max(self.timeline_panel._TIMELINE_HEADER_HEIGHT, int(self.timeline_panel.minimumHeight()))
            splitter.setSizes([max(120, total - header), header])
        self.preview_panel.sync_canvas_geometry()

    def _on_top_workspace_splitter_moved(self, _pos: int=0, _index: int=0) -> None:
        splitter = getattr(self, 'workspace_top_splitter', None)
        if splitter is None:
            pass
        else:
            min_w = int(getattr(self, '_LEFT_LIBRARY_MIN_WIDTH', 160))
            sizes = list(splitter.sizes())
            if len(sizes) < 2:
                pass
            elif sizes[0] >= min_w:
                if hasattr(self, 'module_rail'):
                    self.module_rail._apply_overflow_visibility()
            else:
                deficit = min_w - sizes[0]
                take_preview = min(deficit, max(0, sizes[1] - 320))
                sizes[1] -= take_preview
                deficit -= take_preview
                if len(sizes) >= 3 and deficit > 0:
                    take_dock = min(deficit, max(0, sizes[2] - 200))
                    sizes[2] -= take_dock
                    deficit -= take_dock
                sizes[0] = min_w - max(0, deficit)
                if sizes[0] < min_w:
                    sizes[0] = min_w
                splitter.blockSignals(True)
                try:
                    splitter.setSizes(sizes)
                finally:
                    splitter.blockSignals(False)
                if hasattr(self, 'module_rail'):
                    self.module_rail._apply_overflow_visibility()

    def reset_layout(self) -> None:
        self._layout_saved_vertical = None
        self._layout_saved_horizontal = None
        self._set_inspector_full_height(False)
        if hasattr(self, 'workspace_top_splitter'):
            min_w = int(getattr(self, '_LEFT_LIBRARY_MIN_WIDTH', 160))
            self.workspace_top_splitter.setSizes([max(480, min_w), 640, 280])
        if hasattr(self, 'module_rail'):
            self.module_rail._apply_overflow_visibility()
        if not self.timeline_panel.is_body_visible():
            self.timeline_panel.set_body_visible(True)
        self.workspace_vertical_splitter.setSizes([580, 240])
        self._timeline_split_sizes = [580, 240]
        self.control_dock.show()
        self.set_layout_focus_mode('normal')
        self.statusBar().showMessage('Đã đặt lại bố cục — TL = timeline full ngang · TT = thuộc tính full dọc', 5000)

    def reload_application(self) -> None:
        if self._has_background_job():
            self.statusBar().showMessage('Hãy dừng export/phụ đề trước khi reload UI', 4000)
        else:
            command = [sys.executable, '-m', 'ui_qt.prototype_main']
            creationflags = getattr(subprocess, 'CREATE_NEW_PROCESS_GROUP', 0)
            try:
                subprocess.Popen(command, cwd=str(PATHS.root), env=os.environ.copy(), creationflags=creationflags)
            except OSError as exc:
                self.statusBar().showMessage(f'Không reload được UI: {exc}', 5000)
            self.statusBar().showMessage('Đang reload UI...')
            app = QApplication.instance()
            if app is not None:
                app.quit()

    def _toggle_fullscreen(self) -> None:
        if self.isFullScreen():
            self.showNormal()
            return None
        self.showFullScreen()

    def closeEvent(self, event) -> None:
        self._autosave_timer.stop()
        self._flush_autosave()
        for task in (self.export_task, self.batch_task, self.subtitle_task, self.tts_task, self.tts_preview_task, self.capcut_task, self.auto_blur_task, self.face_reframe_task, self.hardsub_task):
            if task is not None and hasattr(task, 'cancel'):
                task.cancel()
        if self._voice_preview_proc is not None:
            try:
                from core.ffplay_guard import register_ffplay_pid
                register_ffplay_pid(getattr(self._voice_preview_proc, 'pid', None))
            except Exception:
                pass
            try:
                self._voice_preview_proc.kill()
            except Exception:
                pass
            self._voice_preview_proc = None
        try:
            self.preview_panel.playback.stop()
        except Exception:
            pass
        try:
            stop = getattr(self.preview_panel.playback, 'stop_mix_audio', None)
            if callable(stop):
                stop()
        except Exception:
            pass
        try:
            from core.ffplay_guard import stop_all_preview_ffplay
            stop_all_preview_ffplay()
        except Exception:
            pass
        super().closeEvent(event)

def _tts_voice_lang(voice_id: str, label: str='') -> str:
    voice = str(voice_id or '').strip()
    hay = f'{voice} {label}'.casefold()
    folded = voice.casefold()
    suffix = folded.rsplit('-', 1)[-1]
    return suffix if folded.startswith('aura-') and suffix in frozenset({'it', 'ja', 'es', 'en', 'fr', 'nl', 'de'}) else voice.split('-', 1)[0].lower() if '-' in voice and 'Neural' in voice else 'en' if hay.startswith('bv:en') or '(en)' in hay else 'vi' if hay.startswith('bv:vi') or '(vi)' in hay or 'vietnamese' in hay else 'zh' if hay.startswith('bv:zh') or 'chinese' in hay or '中' in label else ''

def _hardsub_roi_from_values(values: dict) -> tuple[float, float, float, float]:
    from ui_qt.blur_zones import ensure_blur_zones
    zones = ensure_blur_zones(values)
    index = int(values.get('blur_zone_index', 0)) % max(1, len(zones))
    selected = zones[index]
    x = max(0.0, min(1.0, float(selected.get('x', 0.0))))
    y = max(0.0, min(1.0, float(selected.get('y', 0.82))))
    width = max(0.0, min(1.0 - x, float(selected.get('width', 1.0))))
    height = max(0.0, min(1.0 - y, float(selected.get('height', 0.18))))
    if width * height < 0.05:
        ratio = max(0.08, min(0.45, float(values.get('blur_zone_height_percent', 18)) / 100))
        return (0.0, 0.0, 1.0, round(ratio, 4)) if str(values.get('blur_zone_position', 'bottom')) == 'top' else (0.0, round(max(0.0, 1.0 - ratio), 4), 1.0, 1.0)
    return (round(x, 4), round(y, 4), round(x + width, 4), round(y + height, 4))

def _format_ms(value: int) -> str:
    total_seconds = max(0, int(value)) // 1000
    minutes, seconds = (divmod(total_seconds, 60)[0], divmod(total_seconds, 60)[1])
    hours, minutes = (divmod(minutes, 60)[0], divmod(minutes, 60)[1])
    return f'{minutes}02d:{seconds}02d' if hours else f':{seconds}02d'

def _is_existing_export_file(path: Path) -> bool:
    try:
        pass
    except OSError:
        return False

def _primary_batch_output_path(output_dir: Path, stem: str, *, naming: str, queue_index: int) -> Path:
    from exporter.batch_naming import _MAX_STEM_TITLE, out_stem
    safe_stem = out_stem(str(stem or 'video'), max_len=_MAX_STEM_TITLE, hash_on_truncate=False) if naming == 'title_target' else out_stem(str(stem or 'video'))
    base_name = f'{int(queue_index)}03d' if naming == 'queue_index' else f'{safe_stem}_xuat' if naming == 'stem_xuat' else safe_stem if naming in frozenset({'stem_exact', 'title_target'}) else f'{safe_stem}_edit'
    return output_dir / f'{base_name}.mp4'

def _resolved_path_key(path: Path) -> str:
    try:
        pass
    except OSError:
        return str(path)

def _unique_batch_output(output_dir: Path, stem: str, used_paths: set[str], *, naming: str, queue_index: int) -> Path:
    from exporter.batch_naming import _MAX_STEM_TITLE, out_stem
    safe_stem = out_stem(str(stem or 'video'), max_len=_MAX_STEM_TITLE, hash_on_truncate=False) if naming == 'title_target' else out_stem(str(stem or 'video'))
    base_name = f'{int(queue_index)}03d' if naming == 'queue_index' else f'{safe_stem}_xuat' if naming == 'stem_xuat' else safe_stem if naming in frozenset({'stem_exact', 'title_target'}) else f'{safe_stem}_edit'
    index = 1
    while True:
        candidate = output_dir / f'{base_name}.mp4'
        key = _resolved_path_key(candidate)
        index += 1
    if not _is_existing_export_file(candidate):
        used_paths.add(key)
        return candidate