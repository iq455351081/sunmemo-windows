# R206: 追加 E2E-26 悬停图片放大测试（插在 T02 之后）
p = 'scripts-e2e.mjs'
s = open(p, encoding='utf-8').read()

anchor = "  ok('E2E-02 悬停扇面让位(目标卡抬起)', t2);"
add = anchor + """

  // ---- T02b 悬停图片卡 → 图片放大 1.35x（R206 悬停放大镜） ----
  {
    let zoomScale = null;
    for (let i = 0; i < 3 && zoomScale === null; i++) {
      await line.evalIn(`(() => {
        const s = [...document.querySelectorAll('.slot')].find(x => x.querySelector('.photo-clip'));
        if (!s) return false;
        const f = s.querySelector('.photo-clip');
        f.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        f.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
        return true;
      })()`);
      await sleep(500); // 320ms 弹簧过渡
      zoomScale = await line.evalIn(`(() => {
        const s = [...document.querySelectorAll('.slot')].find(x => x.querySelector('.photo-clip'));
        if (!s || !s.classList.contains('hover')) return null;
        const clip = s.querySelector('.photo-clip');
        const m = getComputedStyle(clip).transform.match(/matrix\\(([-\\d.]+)/);
        return m ? parseFloat(m[1]) : null;
      })()`);
      if (zoomScale === null) await sleep(400);
    }
    ok('E2E-26 悬停图片放大(1.35x)', zoomScale !== null && zoomScale >= 1.3, 'scale=' + zoomScale);
    await line.evalIn(`document.body.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }))`);
    await sleep(400);
  }"""
assert anchor in s, 'E2E-02 anchor missing'
s = s.replace(anchor, add, 1)
open(p, 'w', encoding='utf-8').write(s)
print('E2E-26 added')
