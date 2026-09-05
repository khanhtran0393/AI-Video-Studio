# Factory voices (ready-made for customers — no cloning needed)

On app start, the backend loads `presets.json` into the VoiceBank → customers pick them under "GIỌNG ĐÃ LƯU".

Two sources:
- **WAV clone**: drop a `.wav` named exactly as `file` in this folder.
- **Built-in engine voice**: no WAV needed. Set `attributes.voice` to a VieNeu preset name (e.g. `"Minh Đức"`). OmniVoice uses `attributes.instruct` as a design prompt.

When a customer picks a voice, the app auto-sets language from `attributes.lang`.

## Multilingual design voices (OmniVoice instruct, no WAV)
32 factory voices — male + female for 16 languages beyond Vi/En:
`zh, ja, ko, es, fr, de, it, pt, ru, pl, tr, nl, cs, ar, hu, hi`.
These seed via `attributes.instruct` + `attributes.lang` (OmniVoice voice design).
XTTS also accepts these language codes (zh → zh-cn internally); VieNeu does not
(Vietnamese only, En/Vi code-switch).

## English (WAV clone)
| Filename | Voice |
|---|---|
| `en-male-narrator.wav` | English — Male, Narrator |
| `en-male-deep.wav`     | English — Male, Deep     |
| `en-male-casual.wav`   | English — Male, Casual   |

Missing WAV files are simply skipped (safe — no empty voice is created).

## Vietnamese (VieNeu built-in, no WAV)
20 factory voices from VieNeu-TTS: Bắc / Trung / Nam, nam / nữ, tin tức / kể chuyện / tự nhiên / đọc truyện.

These seed even without a `.wav` because they carry `attributes.voice`.

## Recording requirements (WAV clone only)
- **WAV** format, clean, **NO background noise / music**.
- **10–20 seconds** is enough (clear, natural delivery in the tone you want to clone).
- One person per file.

## Optional quality boost
Fill `ref_text` in `presets.json` = the **exact words** spoken in the file
→ the model won't have to guess (Whisper), cloning matches better.

## Add / rename / change a voice
Edit `presets.json`: each item needs `id` (unique, keep it stable across updates),
`name` (what the customer sees), and either:
- `file` (the .wav filename in this folder), or
- `attributes.voice` (VieNeu built-in speaker name).

Optional: `attributes.lang` (e.g. "en", "vi"), `attributes.instruct` (OmniVoice design prompt).
Replace a WAV file with a new one of the same name → app updates it on next launch.

## Copyright
Use only voices **you own / have permission for / licensed**.
Do NOT clone a celebrity's or another person's voice without permission.
