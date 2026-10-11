import io

p = 'renderer/overlay/overlay.js'
lines = io.open(p, encoding='utf-8').read().split('\n')

start = next(i for i, l in enumerate(lines) if "a === 'copymd'" in l)
end = next(i for i, l in enumerate(lines) if "a === 'markup'" in l)

new_block = [
    "  else if (a === 'copymd') {",
    "    // R77: 构建逻辑在主进程（与右键菜单共用 buildMdQuote）",
    "    api.send('overlay:copy-md', pv.item.id);",
    "    const btn = act || { classList: { add() {}, remove() {} }, querySelector: () => ({ textContent: '' }) };",
    "    btn.classList.add('ok');",
    "    const span = btn.querySelector ? btn.querySelector('span') : null;",
    "    if (span) span.textContent = '已复制';",
    "    setTimeout(() => { if (btn.isConnected) { btn.classList.remove('ok'); if (span) span.textContent = 'MD 引用'; } }, 1200);",
    "  }",
]
lines[start:end] = new_block
io.open(p, 'w', encoding='utf-8').write('\n'.join(lines))
print('overlay copymd now id-based')
