# R206+: wire imgZoom through main.js (boot push + setSetting branch)
p = 'main.js'
s = open(p, encoding='utf-8').read()

a = "    try { lineWin.webContents.executeJavaScript(`document.body.dataset.font = '${store.settings.cardFont || 'md'}'`).catch(() => {}); } catch { /* ignore */ }"
b = a + "\n    try { lineWin.webContents.executeJavaScript(`document.body.classList.toggle('imgzoom', " + "${store.settings.imgZoom !== false}" + ")`).catch(() => {}); } catch { /* ignore */ }"
assert a in s, 'boot push anchor missing'
s = s.replace(a, b, 1)

a2 = "  if (key === 'compact') {"
b2 = """  if (key === 'imgZoom') {
    try { lineWin.webContents.executeJavaScript(`document.body.classList.toggle('imgzoom', ${!!value})`).catch(() => {}); } catch { /* ignore */ }
  }
  if (key === 'compact') {"""
assert a2 in s, 'setSetting anchor missing'
s = s.replace(a2, b2, 1)

open(p, 'w', encoding='utf-8').write(s)
print('main.js wired')
