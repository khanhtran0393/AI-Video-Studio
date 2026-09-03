import re
p = r'D:\AI Video Studio\nova\web\index.html'
s = open(p, encoding='utf-8', errors='replace').read()
print('len', len(s))
# find nav/sidebar structures
for m in re.finditer(r'class="[^"]*(?:nav|sidebar|side|menu|launcher|dock)[^"]*"', s[:400000]):
    print(m.start(), m.group()[:80])
