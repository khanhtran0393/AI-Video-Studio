'Catalog tem TTS/STT — chữ thật, xám nhà kẹt lõi. Không gọi generate.'
from __future__ import annotations
from dataclasses import dataclass
from PySide6.QtGui import QColor
from PySide6.QtWidgets import QComboBox
from ui_qt.state import ProjectState
TTS_DEFAULT = 'edge'
STT_DEFAULT = 'capcut_api'

@dataclass(frozen=True)
class EngineOffer:
    id: 'str'
    label: 'str'
    selectable: 'bool'
TTS_OFFERS: 'tuple[EngineOffer, ...]' = (EngineOffer('edge', 'Edge TTS · chạy được', True), EngineOffer('capcut', 'CapCut TTS · không cần API key · chạy được', True), EngineOffer('elevenlabs', 'ElevenLabs · cần API key (có thể có gói miễn phí)', True), EngineOffer('fpt', 'FPT.AI · cần API key (trả phí)', True), EngineOffer('vbee', 'Vbee · cần API key (trả phí)', True), EngineOffer('minimax', 'MiniMax · cần API key (trả phí)', True), EngineOffer('zalo', 'Zalo AI · cần API key', True), EngineOffer('siliconflow', 'SiliconFlow · cần API key', True), EngineOffer('deepgram', 'Deepgram (Aura) · cần API key (tiếng Anh)', True), EngineOffer('tiktok', 'TikTok TTS · chưa sẵn (relay dịch vụ)', False), EngineOffer('ngochuyen', 'NgocHuyen · chưa sẵn (thiếu model)', False), EngineOffer('kokoro', 'Kokoro · chưa sẵn (thiếu model)', False), EngineOffer('supertonic', 'SuperTonic · chưa sẵn (chưa bundle)', False), EngineOffer('vienew', 'Vienew · chưa sẵn', False))
STT_OFFERS: 'tuple[EngineOffer, ...]' = (EngineOffer('capcut_api', 'CapCut API · không cần API key · chạy được', True), EngineOffer('groq', 'Groq · cần API key (có thể có gói miễn phí)', True), EngineOffer('deepgram', 'Deepgram · cần API key (có thể có gói miễn phí)', True), EngineOffer('capcut_auto', 'AutoCapCut · chưa sẵn (cần app desktop)', False), EngineOffer('local', 'Model cục bộ · chưa sẵn (chưa cài runtime)', False))
TTS_ENGINES = tuple(((offer.label, offer.id) for offer in TTS_OFFERS))
STT_ENGINES = tuple(((offer.label, offer.id) for offer in STT_OFFERS))

def populate_engine_combo(combo: QComboBox, offers: tuple[EngineOffer, ...], *, current_id: object, coerce_to: str, state: ProjectState, state_key: str) -> str:
    combo.blockSignals(True)
    try:
        combo.clear()
        by_id = {offer.id: offer for offer in offers}
        for offer in offers:
            combo.addItem(offer.label, offer.id)
            item = combo.model().item(combo.count() - 1)
            if item is None:
                pass
            elif offer.selectable:
                item.setForeground(QColor('#E7EDF7'))
            else:
                item.setEnabled(False)
                item.setForeground(QColor('#5A6578'))
        chosen = str(current_id or '').strip()
        offer = by_id.get(chosen)
        if offer is None or not offer.selectable:
            chosen = coerce_to
        state.values[state_key] = chosen
        index = combo.findData(chosen)
        if index < 0:
            index = combo.findData(coerce_to)
        if index >= 0:
            combo.setCurrentIndex(index)
    finally:
        combo.blockSignals(False)
    return str(state.values.get(state_key) or coerce_to)