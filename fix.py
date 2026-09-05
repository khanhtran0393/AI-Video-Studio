with open('nova/web/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

target = """              <div style="flex:1;min-width:120px">
                <label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:4px;font-weight:600">CHƯƠNG</label>
                <input type="number" id="tsChapters" class="ts-field" style="padding:6px 10px" value="1" min="1" oninput="tsUpdateScale()">
              </div>
                  <option>中文 (Trung Quốc)</option>"""

replacement = """              <div style="flex:1;min-width:120px">
                <label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:4px;font-weight:600">CHƯƠNG</label>
                <input type="number" id="tsChapters" class="ts-field" style="padding:6px 10px" value="1" min="1" oninput="tsUpdateScale()">
              </div>
              <div style="flex:1;min-width:120px">
                <label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:4px;font-weight:600">TỪ / CHƯƠNG</label>
                <input type="number" id="tsWordsPerChapter" class="ts-field" style="padding:6px 10px" value="1200" min="100" step="100" oninput="tsUpdateScale()">
              </div>
              <div style="flex:1;min-width:120px">
                <label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:4px;font-weight:600">NGÔN NGỮ</label>
                <select id="tsLang" class="ts-field" style="padding:6px 10px">
                  <option>Tiếng Việt</option>
                  <option>English</option>
                  <option>Español (Tây Ban Nha)</option>
                  <option>Français (Pháp)</option>
                  <option>Deutsch (Đức)</option>
                  <option>Italiano (Ý)</option>
                  <option>Português (Bồ Đào Nha)</option>
                  <option>Русский (Nga)</option>
                  <option>中文 (Trung Quốc)</option>"""

if target in content:
    print("Exact match found with \\n")
    content = content.replace(target, replacement)
elif target.replace('\n', '\r\n') in content:
    print("Exact match found with \\r\\n")
    content = content.replace(target.replace('\n', '\r\n'), replacement.replace('\n', '\r\n'))
else:
    print("Match NOT found!")

with open('nova/web/index.html', 'w', encoding='utf-8', newline='') as f:
    f.write(content)
