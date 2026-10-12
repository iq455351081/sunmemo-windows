# E2E-26 对齐新交互: 断言 #imgMagnify 浮窗出现（悬停看大图）
p = 'scripts-e2e.mjs'
s = open(p, encoding='utf-8').read()

start = s.find("  // ---- T02b 悬停图片卡 → 图片放大 1.35x（R206 悬停放大镜） ----")
end_anchor = """  await line.evalIn(`document.body.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }))`);
  await sleep(400);
  }
  await line.evalIn(`document.body.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }))`);
  await sleep(400);"""
end = s.find(end_anchor, start)
assert start > 0 and end > start, 'block bounds not found'
end += len(end_anchor)

new_block = """  // ---- T02b 悬停图片卡 → 浮动大图速览（R207 悬停放大镜，设置可关） ----
  {
    let magOk = null;
    for (let i = 0; i < 3 && magOk === null; i++) {
      await line.evalIn(`(() => {
        const s = [...document.querySelectorAll('.slot')].find(x => x.querySelector('.photo-clip'));
        if (!s) return false;
        const f = s.querySelector('.photo-clip');
        f.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        f.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
        return true;
      })()`);
      await sleep(900); // 350ms 悬停意图 + 创建 + 淡入
      magOk = await line.evalIn(`(() => {
        const m = document.getElementById('imgMagnify');
        if (!m) return null;
        const img = m.querySelector('img');
        const r = m.getBoundingClientRect();
        return (img && img.naturalWidth > 0 && r.top >= 0 && r.bottom <= innerHeight && r.width >= 400) ? 'ok' : 'bad';
      })()`);
      if (magOk !== 'ok') await sleep(400);
    }
    ok('E2E-26 悬停图片放大镜(640px 大图)', magOk === 'ok', 'state=' + magOk);
    await line.evalIn(`document.body.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }))`);
    await sleep(900); // 移开后速览消失
  }
  await line.evalIn(`document.body.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }))`);
  await sleep(400);"""

s = s[:start] + new_block + s[end:]
open(p, 'w', encoding='utf-8').write(s)
print('E2E-26 rewritten for floating magnifier')
