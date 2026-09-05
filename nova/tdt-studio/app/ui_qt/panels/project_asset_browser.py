from __future__ import annotations
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from PySide6.QtCore import QMimeData, QSize, Qt, Signal
from PySide6.QtGui import QDrag
from PySide6.QtWidgets import QAbstractItemView, QHBoxLayout, QLabel, QLineEdit, QListWidget, QListWidgetItem, QMenu, QMessageBox, QPushButton, QSizePolicy, QStackedWidget, QTreeWidget, QTreeWidgetItem, QVBoxLayout, QWidget
from ui_qt.media_thumbnails import media_thumbnail_icon_cached_only
from ui_qt.state import ProjectState
ASSET_DRAG_MIME = 'application/x-vtp-asset-id'

class _DraggableAssetList(QListWidget):
    __doc__ = 'Kéo video từ dự án xuống timeline (CapCut).'

    def mimeTypes(self) -> list[str]:
        return [ASSET_DRAG_MIME, 'text/plain']

    def mimeData(self, items):
        data = QMimeData()
        if items:
            asset_id = str(items[0].data(Qt.ItemDataRole.UserRole) or '')
            data.setData(ASSET_DRAG_MIME, asset_id.encode('utf-8'))
            data.setText(asset_id)
        return data

    def startDrag(self, supportedActions) -> None:
        items = self.selectedItems()
        if items:
            mime = self.mimeData(items)
            if mime is not None and mime.hasFormat(ASSET_DRAG_MIME):
                drag = QDrag(self)
                drag.setMimeData(mime)
                icon = items[0].icon()
                if not icon.isNull():
                    drag.setPixmap(icon.pixmap(QSize(96, 54)))
                drag.exec(Qt.DropAction.CopyAction)
            else:
                return None
        else:
            return None

    def dragEnterEvent(self, event) -> None:
        mime = event.mimeData()
        if mime is not None and mime.hasUrls():
            event.acceptProposedAction()
            return None
        super().dragEnterEvent(event)

    def dragMoveEvent(self, event) -> None:
        mime = event.mimeData()
        if mime is not None and mime.hasUrls():
            event.acceptProposedAction()
            return None
        super().dragMoveEvent(event)

    def dropEvent(self, event) -> None:
        mime = event.mimeData()
        host = self.parent()
        while True:
            host = host.parent()
        if host is not None:
            paths = [url.toLocalFile() for url in mime.urls() if url.isLocalFile()]
            if paths:
                host.importPathsRequested.emit(paths)
                event.acceptProposedAction()
                return None
        super().dropEvent(event)

@dataclass(frozen=True)
class AssetThumbProfile:
    thumb_w: 'int'
    thumb_h: 'int'
    grid_w: 'int'
    grid_h: 'int'
    tree_icon: 'int'
COMPACT_THUMB_PROFILE = AssetThumbProfile(88, 50, 96, 78, 28)
EXPANDED_THUMB_PROFILE = AssetThumbProfile(176, 100, 196, 130, 48)

def _basename(path: str) -> str:
    text = str(path or '').strip()
    return Path(text).name if text else '—'

class ProjectAssetBrowser(QWidget):
    assetSelected = Signal(str)
    addFilesRequested = Signal()
    importPathsRequested = Signal(list)
    replaceSourceRequested = Signal()
    removeAssetRequested = Signal(str)
    removeAssetsRequested = Signal(list)
    openAssetLocationRequested = Signal(str)
    addFolderRequested = Signal()
    stemSeparateOneRequested = Signal(str, str)
    stemSeparateAllRequested = Signal(str)
    sceneSplitOneRequested = Signal(str)
    sceneSplitAllRequested = Signal()

    def __init__(self, state: ProjectState, profile: AssetThumbProfile=COMPACT_THUMB_PROFILE, *, show_replace: bool=True, parent: QWidget | None=None):
        super().__init__(parent)
        self.state = state
        self._profile = profile
        self._thumbnail_scheduler = None
        self.setObjectName('projectAssetBrowser')
        self.setAcceptDrops(True)
        root = QVBoxLayout(self)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(4)
        actions = QHBoxLayout()
        actions.setSpacing(4)
        self.add_button = QPushButton('＋ Media')
        self.add_button.setObjectName('primaryButton')
        self.add_button.setToolTip('Thêm video từ máy vào dự án (hoặc kéo file từ Explorer vào khung Media)')
        self.add_button.clicked.connect(lambda _checked=False: self.addFilesRequested.emit())
        actions.addWidget(self.add_button, 1)
        self.add_folder_button = QPushButton('Folder')
        self.add_folder_button.setObjectName('compactButton')
        self.add_folder_button.setToolTip('Nạp mọi video trong thư mục (không đi sâu subfolder)')
        self.add_folder_button.clicked.connect(lambda _checked=False: self.addFolderRequested.emit())
        actions.addWidget(self.add_folder_button, 1)
        self.replace_button = QPushButton('Thay')
        self.replace_button.setObjectName('compactButton')
        self.replace_button.setToolTip('Đổi file video, giữ nguyên setting')
        self.replace_button.clicked.connect(lambda _checked=False: self.replaceSourceRequested.emit())
        if show_replace:
            actions.addWidget(self.replace_button)
        self.view_toggle_button = QPushButton('Cây')
        self.view_toggle_button.setObjectName('compactButton')
        self.view_toggle_button.setCheckable(True)
        self.view_toggle_button.setToolTip('Chuyển lưới thumbnail ↔ cây thư mục (Ctrl/Shift chọn nhiều)')
        self.view_toggle_button.toggled.connect(self._on_view_toggle)
        actions.addWidget(self.view_toggle_button)
        self.delete_selected_button = QPushButton('Xóa')
        self.delete_selected_button.setObjectName('dangerButton')
        self.delete_selected_button.setToolTip('Xóa các video đang chọn khỏi dự án')
        self.delete_selected_button.clicked.connect(self._emit_remove_selected)
        actions.addWidget(self.delete_selected_button)
        root.addLayout(actions)
        self.search = QLineEdit()
        self.search.setPlaceholderText('Tìm video...')
        self.search.textChanged.connect(self._filter_items)
        root.addWidget(self.search)
        p = self._profile
        self.asset_stack = QStackedWidget()
        self.asset_list = _DraggableAssetList()
        self.asset_list.setObjectName('projectAssetList')
        self.asset_list.setViewMode(QListWidget.ViewMode.IconMode)
        self.asset_list.setMovement(QListWidget.Movement.Static)
        self.asset_list.setDragEnabled(True)
        self.asset_list.setDragDropMode(QAbstractItemView.DragDropMode.DragOnly)
        self.asset_list.setDefaultDropAction(Qt.DropAction.CopyAction)
        self.asset_list.setFlow(QListWidget.Flow.LeftToRight)
        self.asset_list.setWrapping(True)
        self.asset_list.setResizeMode(QListWidget.ResizeMode.Adjust)
        self.asset_list.setUniformItemSizes(True)
        self.asset_list.setSpacing(3)
        self.asset_list.setIconSize(QSize(p.thumb_w, p.thumb_h))
        self.asset_list.setGridSize(QSize(p.grid_w, p.grid_h))
        self.asset_list.setWordWrap(True)
        self.asset_list.setHorizontalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAsNeeded)
        self.asset_list.setVerticalScrollBarPolicy(Qt.ScrollBarPolicy.ScrollBarAsNeeded)
        self.asset_list.setSelectionMode(QAbstractItemView.SelectionMode.ExtendedSelection)
        self.asset_list.setToolTip('Kéo video → Video = đổi mẫu · Shift+kéo = nối chuỗi · kéo file từ Explorer vào đây = nạp Media')
        self.asset_list.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.asset_list.customContextMenuRequested.connect(self._on_asset_context_menu)
        self.asset_list.currentItemChanged.connect(self._emit_current_asset)
        self.asset_tree = QTreeWidget()
        self.asset_tree.setObjectName('projectAssetTree')
        self.asset_tree.setHeaderHidden(True)
        self.asset_tree.setRootIsDecorated(True)
        self.asset_tree.setSelectionMode(QAbstractItemView.SelectionMode.ExtendedSelection)
        self.asset_tree.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.asset_tree.customContextMenuRequested.connect(self._on_tree_context_menu)
        self.asset_tree.currentItemChanged.connect(self._emit_tree_asset)
        self.asset_stack.addWidget(self.asset_list)
        self.asset_stack.addWidget(self.asset_tree)
        root.addWidget(self.asset_stack, 1)
        self.empty_label = QLabel('Chưa có video\nBấm ＋ Media hoặc kéo file từ Explorer vào đây')
        self.empty_label.setObjectName('mutedLabel')
        self.empty_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.empty_label.setWordWrap(True)
        self.empty_label.setSizePolicy(QSizePolicy.Policy.Preferred, QSizePolicy.Policy.Expanding)
        root.addWidget(self.empty_label)

    def set_thumbnail_scheduler(self, scheduler: Callable[[str, str, str], None] | None) -> None:
        self._thumbnail_scheduler = scheduler

    def set_asset_icon(self, asset_id: str, icon) -> None:
        for index in range(self.asset_list.count()):
            item = self.asset_list.item(index)
            if item.data(Qt.ItemDataRole.UserRole) == asset_id:
                item.setIcon(icon)
        for i in range(self.asset_tree.topLevelItemCount()):
            folder = self.asset_tree.topLevelItem(i)
            for j in range(folder.childCount()):
                child = folder.child(j)
                if str(child.data(0, Qt.ItemDataRole.UserRole)) == asset_id:
                    child.setIcon(0, icon)
                    return None

    def reload_assets(self, state: ProjectState | None=None) -> None:
        if state is not None:
            self.state = state
        p = self._profile
        video_count = sum((1 for asset in self.state.assets if asset.kind == 'video' and asset.path))
        need_thumbs = []
        self.asset_list.blockSignals(True)
        self.asset_tree.blockSignals(True)
        try:
            self.asset_list.clear()
            self.asset_tree.clear()
            folders = {}
            for asset in self.state.assets:
                item = QListWidgetItem(asset.name)
                item.setData(Qt.ItemDataRole.UserRole, asset.id)
                item.setData(Qt.ItemDataRole.UserRole + 1, asset.name.lower())
                item.setToolTip(f"{asset.name}\n{asset.path or '—'}\n{asset.detail}")
                item.setTextAlignment(Qt.AlignmentFlag.AlignHCenter)
                icon = media_thumbnail_icon_cached_only(asset.path or '', asset.kind, width=p.thumb_w, height=p.thumb_h)
                item.setIcon(icon)
                self.asset_list.addItem(item)
                if asset.path and asset.kind == 'video':
                    need_thumbs.append((asset.id, asset.path, asset.kind))
                if asset.kind == 'video':
                    folder = str(Path(asset.path).parent) if asset.path else 'Chưa có file'
                    folders.setdefault(folder, []).append(asset)
            for folder_path in sorted(folders.keys()):
                folder_item = QTreeWidgetItem([f'📁 {_basename(folder_path)}'])
                folder_item.setData(0, Qt.ItemDataRole.UserRole, '')
                folder_item.setToolTip(0, folder_path)
                folder_item.setExpanded(True)
                for asset in folders[folder_path]:
                    child = QTreeWidgetItem([asset.name])
                    child.setData(0, Qt.ItemDataRole.UserRole, asset.id)
                    child.setToolTip(0, f"{asset.path or '—'}\n{asset.detail}")
                    icon = media_thumbnail_icon_cached_only(asset.path or '', asset.kind, width=p.tree_icon, height=p.tree_icon)
                    child.setIcon(0, icon)
                    folder_item.addChild(child)
                self.asset_tree.addTopLevelItem(folder_item)
        finally:
            self.asset_list.blockSignals(False)
            self.asset_tree.blockSignals(False)
        has_assets = video_count > 0
        self.asset_stack.setVisible(has_assets)
        self.empty_label.setVisible(not has_assets)
        self.search.setEnabled(has_assets)
        self.replace_button.setEnabled(has_assets)
        self.delete_selected_button.setEnabled(has_assets)
        self._set_current_without_emitting(self.state.selected_id)
        if self._thumbnail_scheduler:
            for asset_id, path, kind in need_thumbs:
                self._thumbnail_scheduler(asset_id, path, kind)

    def append_video_asset(self, asset) -> None:
        if asset.kind == 'video' and asset.path:
            p = self._profile
            for index in range(self.asset_list.count()):
                item = self.asset_list.item(index)
                if item.data(Qt.ItemDataRole.UserRole) == asset.id:
                    return None
            item = QListWidgetItem(asset.name)
            item.setData(Qt.ItemDataRole.UserRole, asset.id)
            item.setData(Qt.ItemDataRole.UserRole + 1, asset.name.lower())
            item.setToolTip(f"{asset.name}\n{asset.path or '—'}\n{asset.detail}")
            item.setTextAlignment(Qt.AlignmentFlag.AlignHCenter)
            icon = media_thumbnail_icon_cached_only(asset.path, asset.kind, width=p.thumb_w, height=p.thumb_h)
            item.setIcon(icon)
            self.asset_list.addItem(item)
            folder = str(Path(asset.path).parent)
            folder_item = None
            for i in range(self.asset_tree.topLevelItemCount()):
                top = self.asset_tree.topLevelItem(i)
                if top.toolTip(0) == folder:
                    folder_item = top
            if folder_item is None:
                folder_item = QTreeWidgetItem([f'📁 {_basename(folder)}'])
                folder_item.setData(0, Qt.ItemDataRole.UserRole, '')
                folder_item.setToolTip(0, folder)
                folder_item.setExpanded(True)
                self.asset_tree.addTopLevelItem(folder_item)
            child = QTreeWidgetItem([asset.name])
            child.setData(0, Qt.ItemDataRole.UserRole, asset.id)
            child.setToolTip(0, f'{asset.path}\n{asset.detail}')
            child.setIcon(0, media_thumbnail_icon_cached_only(asset.path, asset.kind, width=p.tree_icon, height=p.tree_icon))
            folder_item.addChild(child)
            self.asset_stack.setVisible(True)
            self.empty_label.setVisible(False)
            self.search.setEnabled(True)
            self.replace_button.setEnabled(True)
            self.delete_selected_button.setEnabled(True)
            if self._thumbnail_scheduler:
                self._thumbnail_scheduler(asset.id, asset.path, asset.kind)
                return None
        else:
            return None

    def _set_current_without_emitting(self, asset_id: str | None) -> None:
        self.asset_list.blockSignals(True)
        self.asset_tree.blockSignals(True)
        try:
            if asset_id is None:
                self.asset_list.clearSelection()
                self.asset_list.setCurrentRow(-1)
                self.asset_tree.clearSelection()
                return None
            for index in range(self.asset_list.count()):
                item = self.asset_list.item(index)
                if item.data(Qt.ItemDataRole.UserRole) == asset_id:
                    self.asset_list.setCurrentItem(item)
            for i in range(self.asset_tree.topLevelItemCount()):
                folder = self.asset_tree.topLevelItem(i)
                for j in range(folder.childCount()):
                    child = folder.child(j)
                    if str(child.data(0, Qt.ItemDataRole.UserRole)) == asset_id:
                        self.asset_tree.setCurrentItem(child)
                        folder.setExpanded(True)
                        return None
        finally:
            self.asset_list.blockSignals(False)
            self.asset_tree.blockSignals(False)

    def select_asset(self, asset_id: str) -> None:
        for index in range(self.asset_list.count()):
            item = self.asset_list.item(index)
            if item.data(Qt.ItemDataRole.UserRole) == asset_id:
                if self.asset_list.currentItem() is item:
                    self.assetSelected.emit(asset_id)
                else:
                    self.asset_list.setCurrentItem(item)
                self._set_current_without_emitting(asset_id)
                return None
        raise KeyError(asset_id)

    def set_selected_asset(self, asset_id: str | None) -> None:
        self._set_current_without_emitting(asset_id)

    def _emit_current_asset(self, current: QListWidgetItem | None, _previous: QListWidgetItem | None) -> None:
        if current is not None:
            if not current.isSelected():
                self.asset_list.clearSelection()
                current.setSelected(True)
            self.assetSelected.emit(str(current.data(Qt.ItemDataRole.UserRole)))
            return None

    def _on_view_toggle(self, explorer: bool) -> None:
        self.asset_stack.setCurrentIndex(1 if explorer else 0)
        self.view_toggle_button.setText('Lưới' if explorer else 'Explorer')
        self._set_current_without_emitting(self.state.selected_id)

    def _emit_tree_asset(self, current: QTreeWidgetItem | None, _previous: QTreeWidgetItem | None) -> None:
        if current is None:
            return None
        asset_id = str(current.data(0, Qt.ItemDataRole.UserRole) or '')
        if asset_id:
            self.assetSelected.emit(asset_id)
            return None

    def _collect_selected_video_ids(self) -> list[str]:
        ids = []
        if self.asset_stack.currentIndex() == 0:
            for item in self.asset_list.selectedItems():
                ids.append(str(item.data(Qt.ItemDataRole.UserRole)))
            current = self.asset_list.currentItem()
            aid = str(current.data(Qt.ItemDataRole.UserRole) or '')
            if not ids and current is not None and aid:
                ids = [aid]
        else:
            for item in self.asset_tree.selectedItems():
                asset_id = str(item.data(0, Qt.ItemDataRole.UserRole) or '')
                if asset_id:
                    ids.append(asset_id)
            current = self.asset_tree.currentItem()
            aid = str(current.data(0, Qt.ItemDataRole.UserRole) or '')
            if not ids and current is not None and aid:
                ids = [aid]
        return ids

    def _emit_remove_selected(self) -> None:
        ids = self._collect_selected_video_ids()
        if not ids:
            QMessageBox.information(self, 'Xóa video', 'Chọn video (click thumbnail) rồi bấm «Xóa chọn».')
            return None
        if len(ids) == 1:
            self.removeAssetRequested.emit(ids[0])
            return None
        self.removeAssetsRequested.emit(ids)

    def _on_tree_context_menu(self, pos) -> None:
        item = self.asset_tree.itemAt(pos)
        if item is None:
            return None
        asset_id = str(item.data(0, Qt.ItemDataRole.UserRole) or '')
        if asset_id:
            asset = next((candidate for candidate in self.state.assets if candidate.id == asset_id), None)
            if asset is None or asset.kind != 'video':
                return None
            remove_ids = self._context_menu_remove_ids_tree(item, asset_id)
            self._show_asset_menu(asset, asset_id, self.asset_tree.mapToGlobal(pos), remove_ids=remove_ids)
        else:
            return None

    def _on_asset_context_menu(self, pos) -> None:
        item = self.asset_list.itemAt(pos)
        if item is None:
            return None
        asset_id = str(item.data(Qt.ItemDataRole.UserRole))
        asset = next((candidate for candidate in self.state.assets if candidate.id == asset_id), None)
        if asset is None or asset.kind != 'video':
            return None
        remove_ids = self._context_menu_remove_ids_list(item, asset_id)
        self._show_asset_menu(asset, asset_id, self.asset_list.mapToGlobal(pos), remove_ids=remove_ids)

    def _context_menu_remove_ids_list(self, item: QListWidgetItem, asset_id: str) -> list[str]:
        selected_items = self.asset_list.selectedItems()
        if item in selected_items and len(selected_items) > 1:
            self.asset_list.blockSignals(True)
            try:
                self.asset_list.setCurrentItem(item)
            finally:
                self.asset_list.blockSignals(False)
            ids = []
            for selected in selected_items:
                aid = str(selected.data(Qt.ItemDataRole.UserRole) or '')
                if aid:
                    ids.append(aid)
            return ids
        self.asset_list.blockSignals(True)
        try:
            self.asset_list.clearSelection()
            item.setSelected(True)
            self.asset_list.setCurrentItem(item)
        finally:
            self.asset_list.blockSignals(False)
        return [asset_id]

    def _context_menu_remove_ids_tree(self, item: QTreeWidgetItem, asset_id: str) -> list[str]:
        selected_items = self.asset_tree.selectedItems()
        if item in selected_items and len(selected_items) > 1:
            self.asset_tree.blockSignals(True)
            try:
                self.asset_tree.setCurrentItem(item)
            finally:
                self.asset_tree.blockSignals(False)
            ids = []
            for selected in selected_items:
                aid = str(selected.data(0, Qt.ItemDataRole.UserRole) or '')
                if aid:
                    ids.append(aid)
            return ids
        self.asset_tree.blockSignals(True)
        try:
            self.asset_tree.clearSelection()
            item.setSelected(True)
            self.asset_tree.setCurrentItem(item)
        finally:
            self.asset_tree.blockSignals(False)
        return [asset_id]

    def _show_asset_menu(self, asset, asset_id: str, global_pos, *, remove_ids: list[str] | None) -> None:
        menu = QMenu(self)
        selected = list(remove_ids or [])
        if not selected:
            selected = self._collect_selected_video_ids()
        if asset_id not in selected:
            selected = [asset_id]
        if asset.path and Path(asset.path).is_file():
            open_loc = menu.addAction('Mở vị trí file')
            open_loc.setToolTip('Mở thư mục và chọn file video trong Explorer')
            path = str(asset.path)
            open_loc.triggered.connect(lambda _checked, p: self.openAssetLocationRequested.emit(p))
        stem_one = menu.addMenu('Tách âm — video này')
        stem_all = menu.addMenu('Tách âm — tất cả video trong dự án')
        for label, mode in (('Tách giọng nói', 'vocal'), ('Tách nhạc', 'music'), ('Tách cả 2', 'both')):
            act_one = stem_one.addAction(label)
            act_one.triggered.connect(lambda _checked, aid=asset_id, m=mode: self.stemSeparateOneRequested.emit(aid, m))
            act_all = stem_all.addAction(label)
            act_all.triggered.connect(lambda _checked, m: self.stemSeparateAllRequested.emit(m))
        scene_one = menu.addAction('Tách cảnh — video này')
        scene_one.triggered.connect(lambda _checked, aid: self.sceneSplitOneRequested.emit(aid))
        scene_all = menu.addAction('Tách cảnh — tất cả video trong dự án')
        scene_all.triggered.connect(lambda _checked=False: self.sceneSplitAllRequested.emit())
        remove_action = menu.addAction(f'Xóa {len(selected)} video khỏi dự án' if len(selected) > 1 else 'Xóa video khỏi dự án')
        remove_action.setToolTip('Gỡ clip khỏi dự án — Ctrl+Z để khôi phục')
        ids_to_remove = list(dict.fromkeys(selected))
        if len(ids_to_remove) > 1:
            remove_action.triggered.connect(lambda _checked, ids: self.removeAssetsRequested.emit(ids))
        else:
            remove_action.triggered.connect(lambda _checked, aid: self.removeAssetRequested.emit(aid))
        menu.exec(global_pos)

    def _filter_items(self, text: str) -> None:
        query = text.strip().lower()
        for index in range(self.asset_list.count()):
            item = self.asset_list.item(index)
            name = str(item.data(Qt.ItemDataRole.UserRole + 1))
            item.setHidden(bool(query) and query not in name)
        for i in range(self.asset_tree.topLevelItemCount()):
            folder = self.asset_tree.topLevelItem(i)
            folder_hidden = True
            for j in range(folder.childCount()):
                child = folder.child(j)
                name = child.text(0).lower()
                hide = bool(query) and query not in name
                child.setHidden(hide)
                if hide:
                    pass
                else:
                    folder_hidden = False
            folder.setHidden(folder_hidden and bool(query))

    def dragEnterEvent(self, event) -> None:
        mime = event.mimeData()
        if mime is not None and mime.hasUrls():
            event.acceptProposedAction()
            return None
        super().dragEnterEvent(event)

    def dragMoveEvent(self, event) -> None:
        mime = event.mimeData()
        if mime is not None and mime.hasUrls():
            event.acceptProposedAction()
            return None
        super().dragMoveEvent(event)

    def dropEvent(self, event) -> None:
        mime = event.mimeData()
        if mime is not None and mime.hasUrls():
            paths = [url.toLocalFile() for url in mime.urls() if url.isLocalFile()]
            if paths:
                self.importPathsRequested.emit(paths)
                event.acceptProposedAction()
                return None
            super().dropEvent(event)
        else:
            super().dropEvent(event)
            return None