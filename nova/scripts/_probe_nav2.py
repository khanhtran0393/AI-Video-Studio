p = r'D:\AI Video Studio\nova\web\index.html'
s = open(p, encoding='utf-8', errors='replace').read()
seg = s[60000:82000]
open(r'D:\AI Video Studio\nova\scripts\_nav_segment.html','w',encoding='utf-8').write(seg)
print(seg[:6000])
