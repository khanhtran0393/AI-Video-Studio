# Factory voices (ready-made for customers — no cloning needed)

Drop the reference recordings into **this folder**, named exactly as in `presets.json`.
On app start, the backend loads them into the VoiceBank → customers pick them under "GIỌNG ĐÃ LƯU".

These presets are **English, male voices**. When a customer picks one, the app auto-sets language to English.

## Files to drop in (per current presets.json)
| Filename | Voice |
|---|---|
| `en-male-narrator.wav` | English — Male, Narrator |
| `en-male-deep.wav`     | English — Male, Deep     |
| `en-male-casual.wav`   | English — Male, Casual   |

Missing files are simply skipped (safe — no empty voice is created).

## Recording requirements
- **WAV** format, clean, **NO background noise / music**.
- **10–20 seconds** is enough (clear, natural delivery in the tone you want to clone).
- **English**, male speaker, one person per file.

## Optional quality boost
Fill `ref_text` in `presets.json` = the **exact words** spoken in the file
→ the model won't have to guess (Whisper), cloning matches better.

## Add / rename / change a voice
Edit `presets.json`: each item needs `id` (unique, keep it stable across updates),
`name` (what the customer sees), `file` (the .wav filename in this folder),
and optional `attributes.lang` (e.g. "en", "vi") to auto-select the language.
Replace a file with a new one of the same name → app updates it on next launch.

## Copyright
Use only voices **you own / have permission for / licensed**.
Do NOT clone a celebrity's or another person's voice without permission.
