'use strict';
// Stable E2E: ATTACH-ONLY (the app always exposes CDP on 9222), all page
// interaction via CDP Input.dispatchMouseEvent — no OS cursor, no spawning
// the main app (deep links poke it through the single-instance channel).
import { spawn, execSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs';
import path from 'node:path';

const APP = process.cwd();
const results = [];
const ok = (name, cond, extra = '') => {
  results.push([name, !!cond]);
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${cond ? '' : '  <<< ' + extra}`);
};

const targets = async () => (await (await fetch('http://127.0.0.1:9222/json/list')).json()).filter(t => t.type === 'page');
const findTarget = async (part, ms = 8000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const t = (await targets().catch(() => [])).filter(x => x.url.includes(part)).pop();
    if (t) return t;
    await sleep(250);
  }
  return null;
};
const waitForAsync = async (fn, ms = 5000, step = 250) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const v = await fn(); if (v) return v; } catch { /* keep polling */ }
    await sleep(step);
  }
  return false;
};
const gone = async (part, ms = 5000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const t = (await targets().catch(() => [])).find(x => x.url.includes(part));
    if (!t) return true;
    await sleep(250);
  }
  return false;
};

async function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = () => rej(new Error('ws fail (target may have gone)'));
  });
  let id = 0; const pend = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id; pend.set(i, m => m.error ? rej(new Error(m.error.message)) : res(m.result));
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const evalIn = async expr => {
    for (let i = 0; i < 3; i++) {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) {
        const msg = (r.exceptionDetails.exception?.description || r.exceptionDetails.text || '').slice(0, 140);
        if (i === 2) throw new Error('eval: ' + msg);
        await sleep(400);
        continue;
      }
      return r.result?.value;
    }
  };
  // real input pipeline of that page (hit-testing, bubbling, IPC)
  const click = async expr => {
    const pt = await evalIn(expr);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pt.x, y: pt.y });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
  };
  return { ws, send, evalIn, click, close: () => ws.close() };
}

const poke = args => {
  const c = spawn(path.join(APP, 'node_modules/electron/dist/electron.exe'), ['.', ...args], { cwd: APP, detached: true, stdio: 'ignore' });
  c.unref();
};

const run = async () => {
  // ---- T0/T1: line window + structure ----
  const lineT = await findTarget('line.html', 15000);
  ok('E2E-00 晾衣绳窗口加载', !!lineT);
  if (!lineT) process.exit(1);
  const line = await cdp(lineT.webSocketDebuggerUrl);
  // 真实用户行为：点击前光标先移入晾衣绳条带（否则线会按设计自动收起）
  const park = () => execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File scripts-input.ps1 -x 1290 -y 210 -moveonly`, { stdio: 'ignore' });
  park();
  await line.send('Runtime.enable');
  await line.send('Page.enable');
  // R103: pin the rope open — on cold boot the seed grace expires before the
  // first clicks, leaving cards off-window and T3/T6 clicking nothing.
  await line.evalIn(`window.sun.send('line:toggle-userpin')`).catch(() => {});
  // wait for seeds (3 memos + shots)
  await (async () => { const e = Date.now() + 10000; while (Date.now() < e) { try { if (await line.evalIn(`document.querySelectorAll('.slot[data-id]').length`) >= 4) return; } catch { /* reloading */ } await sleep(300); } })();
  const t1 = await line.evalIn(`(() => {
    const slots = document.querySelectorAll('.slot .cardfx').length;
    const pegs = document.querySelectorAll('.slot .peg').length;
    const add = !!document.querySelector('.add-face');
    const memos = document.querySelectorAll('.slot .memo-face').length;
    const photos = document.querySelectorAll('.slot .photo-clip').length;
    return { slots, pegs, add, memos, photos };
  })()`);
  ok('E2E-01 晾衣绳结构(便签+截图+添加卡+夹子)', t1.slots === t1.pegs && t1.add && t1.memos >= 3 && t1.photos >= 1, JSON.stringify(t1));

  // ---- T2 hover fan-out ----
  let t2 = false;
  for (let i = 0; i < 3 && !t2; i++) {
    await line.evalIn(`(() => {
      const f = document.querySelector('.slot[data-id] .memo-face');
      f.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      f.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
      return true;
    })()`);
    await sleep(350);
    t2 = await line.evalIn(`(() => {
      const s = [...document.querySelectorAll('.slot')].find(x => x.style.zIndex === '1000');
      return !!s;
    })()`);
    if (!t2) await sleep(400);
  }
  ok('E2E-02 悬停扇面让位(目标卡抬起)', t2);

  // ---- T26 悬停图片卡 → 原地放大 3x（R208 Dock 式；设置 imgZoom 可关） ----
  // 注意：采样值必须是有限数或 null——NaN 会让 `=== null` 与 `< 1.3` 两个
  // 循环守卫同时失真（NaN 比较恒 false），曾把真通过判成 no-sample。
  {
    const readScale = `(() => {
      const s = [...document.querySelectorAll('.slot')].find(x => x.querySelector('.photo-clip'));
      if (!s) return JSON.stringify({ st: 'no-slot' });
      const clip = s.querySelector('.photo-clip');
      const m = getComputedStyle(clip).transform.match(/matrix\\(([-\\d.]+)/);
      const v = m ? parseFloat(m[1]) : NaN;
      return JSON.stringify({ st: 'ok', hover: s.classList.contains('hover'), v: Number.isFinite(v) ? v : null });
    })()`;
    let sample = null;
    for (let i = 0; i < 3 && (!sample || sample.v === null); i++) {
      await line.evalIn(`(() => {
        const s = [...document.querySelectorAll('.slot')].find(x => x.querySelector('.photo-clip'));
        if (!s) return false;
        const f = s.querySelector('.photo-clip');
        f.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        f.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
        return true;
      })()`);
      await sleep(500); // 340ms 弹簧过渡
      sample = await line.evalIn(readScale).then(JSON.parse).catch(() => null);
      if (!sample || sample.v === null) await sleep(400);
    }
    // 320ms 过渡中读取可能取到中间态（如 2.94）：补采至稳态 3x
    for (let k = 0; k < 4 && (!sample || sample.v === null || sample.v < 2.9); k++) {
      await sleep(300);
      sample = await line.evalIn(readScale).then(JSON.parse).catch(() => null);
    }
    const passed = !!sample && sample.st === 'ok' && sample.hover && sample.v !== null && sample.v >= 2.9;
    ok('E2E-26 悬停图片放大(3x)', passed, JSON.stringify(sample));
    await line.evalIn(`document.body.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }))`);
    await sleep(400);
  }
  await line.evalIn(`document.body.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }))`);
  await sleep(400);

  // ---- T3 click memo card footer → hero preview ----
  park();
  await sleep(600);
  // prefer a memo that still has a pending todo (needed by T4)
  await line.click(`(() => {
    const slots = [...document.querySelectorAll('.slot[data-id]')];
    const withTodo = slots.find(x => x.querySelector('.md-todo:not(.is-done)'));
    const f = (withTodo || slots.find(x => x.querySelector('.memo-face'))).querySelector('.memo-face');
    const r = f.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + 20 };
  })()`);
  const overlayT = await findTarget('overlay.html', 6000);
  let overlay = overlayT && await cdp(overlayT.webSocketDebuggerUrl).catch(() => null);
  let previewVis = false;
  if (overlay) {
    await overlay.send('Runtime.enable');
    previewVis = await waitForAsync(async () => {
      try { return await overlay.evalIn(`!document.getElementById('heroWrap').classList.contains('hidden')`); } catch { return false; }
    }, 5000);
  }
  ok('E2E-03 点击卡片→Hero预览打开', !!previewVis);
  async function waitForAsync(fn, ms) { const e = Date.now() + ms; while (Date.now() < e) { try { const v = await fn(); if (v) return v; } catch { /* keep */ } await sleep(250); } return false; }

  // ---- T4 checkbox in preview syncs to line card ----
  if (overlay && previewVis) {
    // R101: the hero panel springs in over 620ms; clicking during the flight
    // races the first broadcast on cold boot — let it settle first.
    await sleep(1000);
    const beforeLine = await line.evalIn(`document.querySelectorAll('.md-box.checked').length`);
    let clicked = false, afterLine = beforeLine;
    for (let i = 0; i < 3 && !clicked; i++) {
      clicked = await overlay.evalIn(`(() => {
        const t = document.querySelector('#heroCard .md-todo:not(.is-done)');
        if (!t) return false;
        t.click();
        return true;
      })()`);
      if (clicked) {
        const grew = await waitForAsync(async () => {
          try { return (await line.evalIn(`document.querySelectorAll('.md-box.checked').length`)) > beforeLine; } catch { return false; }
        }, 4000);
        if (grew) { afterLine = beforeLine + 1; break; }
      }
      await sleep(500);
    }
    ok('E2E-04 预览打勾同步到卡片', clicked && afterLine > beforeLine, `before=${beforeLine} after=${afterLine} clicked=${clicked}`);
    await overlay.evalIn(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`).catch(() => {});
    await sleep(900);
  }

  // ---- T5 Esc closes preview ----
  const t5 = await (async () => {
    const ov = (await targets()).filter(t => t.url.includes('overlay.html')).pop();
    if (!ov) return 'no-overlay';
    const c = await cdp(ov.webSocketDebuggerUrl);
    const v = await c.evalIn(`document.getElementById('heroWrap').classList.contains('hidden')`).catch(() => 'err');
    c.close();
    return v === true;
  })();
  ok('E2E-05 预览已收起', t5 === true, String(t5));

  // ---- T6 gear → settings ----
  park();
  await sleep(600);
  await line.click(`(() => {
    const g = document.getElementById('gear');
    const r = g.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  const settingsT = await findTarget('settings.html', 6000);
  ok('E2E-06 齿轮→设置窗口', !!settingsT);
  let settings = settingsT && await cdp(settingsT.webSocketDebuggerUrl).catch(() => null);
  if (settings) {
    await settings.send('Runtime.enable');
    await (async () => { const e = Date.now() + 5000; while (Date.now() < e) { try { const t = await settings.evalIn(`document.getElementById('btn-toggle').textContent`); if (t.includes('Ctrl')) return true; } catch { /* loading */ } await sleep(250); } return false; })();
    const t6 = await settings.evalIn(`({
      shortcuts: document.getElementById('btn-toggle').textContent,
      icon: document.getElementById('appIcon').src.length > 10,
      ver: /^v\\d/.test(document.getElementById('ver').textContent),
      rows: document.querySelectorAll('.chk-row').length,
    })`);
    ok('E2E-07 设置页数据完整(快捷键/图标/版本/开关行)', t6.icon && t6.shortcuts.includes('Ctrl') && t6.ver && t6.rows >= 4, JSON.stringify(t6));
    // toggle a checkbox and verify config write, then restore
    const cfgPath = path.join(process.env.APPDATA, 'SunMemo', 'config.json');
    const pre = JSON.parse(fs.readFileSync(cfgPath, 'utf8')).settings.soundOn;
    await settings.evalIn(`(() => { const c = document.getElementById('chkSound'); c.checked = !c.checked; c.dispatchEvent(new Event('change')); return c.checked; })()`);
    await sleep(400);
    const post = JSON.parse(fs.readFileSync(cfgPath, 'utf8')).settings.soundOn;
    ok('E2E-08 设置开关写入配置', post !== pre, `pre=${pre} post=${post}`);
    await settings.evalIn(`document.getElementById('doneBtn').click()`);
    await sleep(500);
  }

  // ---- T9 add-card → editor → type → smart list → commit ----
  park();
  await sleep(600);
  await line.click(`(() => {
    const a = document.querySelector('.add-face');
    const r = a.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  const memoT = await findTarget('memo.html', 6000);
  ok('E2E-09 添加卡→速记窗口', !!memoT);
  if (memoT) {
    const memo = await cdp(memoT.webSocketDebuggerUrl);
    await memo.send('Runtime.enable');
    await (async () => { const e = Date.now() + 4000; while (Date.now() < e) { try { if (await memo.evalIn(`document.readyState`) === 'complete') return true; } catch { /* load */ } await sleep(200); } return false; })();
    const size = await memo.evalIn(`({ w: innerWidth, h: innerHeight })`);
    ok('E2E-10 速记窗口 500×350', Math.abs(size.w - 500) <= 2 && Math.abs(size.h - 350) <= 2, JSON.stringify(size));
    await memo.evalIn(`(() => { const e = document.getElementById('editor'); e.focus(); return true; })()`);
    await memo.send('Input.insertText', { text: '# E2E 自动化便签' });
    await memo.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
    await memo.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await memo.send('Input.insertText', { text: '- [ ] 自动待办' });
    const typed = await memo.evalIn(`document.getElementById('editor').value`);
    ok('E2E-11 输入与自动续行', typed.includes('# E2E 自动化便签') && typed.includes('- [ ] 自动待办'), JSON.stringify(typed));
    const baseSlots = await line.evalIn(`document.querySelectorAll('.slot[data-id]').length`);
    await memo.evalIn(`(() => { document.getElementById('commitBtn').click(); return true; })()`);
    const landed = await (async () => { const e = Date.now() + 6000; while (Date.now() < e) { try { if (await line.evalIn(`document.querySelectorAll('.slot[data-id]').length`) > baseSlots) return true; } catch { /* reload */ } await sleep(250); } return false; })();
    ok('E2E-12 挂绳(新便签上线)', landed, `base=${baseSlots}`);
  }

  // ---- T13 search deep link → renders → item click → preview ----
  poke(['--search']);
  const searchT = await findTarget('search.html', 6000);
  ok('E2E-13 搜索窗口(--search 深链)', !!searchT);
  if (searchT) {
    const sc = await cdp(searchT.webSocketDebuggerUrl);
    await sc.send('Runtime.enable');
    const n = await (async () => { const e = Date.now() + 5000; while (Date.now() < e) { try { const v = await sc.evalIn(`document.querySelectorAll('.item').length`); if (v > 0) return v; } catch { /* load */ } await sleep(250); } return 0; })();
    ok('E2E-14 搜索列表渲染', n > 0, String(n));
    await sc.evalIn(`(() => { const i = document.querySelector('.item'); if (i) i.click(); return true; })()`);
    const closed = await gone('search.html', 5000);
    ok('E2E-15 点击结果→关闭搜索', closed);
    // preview should be open now (opens 120ms after search closes — poll)
    const ovVis = await waitForAsync(async () => {
      const ov = (await targets()).filter(t => t.url.includes('overlay.html')).pop();
      if (!ov) return false;
      const c = await cdp(ov.webSocketDebuggerUrl).catch(() => null);
      if (!c) return false;
      const v = await c.evalIn(`!document.getElementById('heroWrap').classList.contains('hidden')`).catch(() => false);
      c.close();
      return v === true;
    }, 5000);
    ok('E2E-16 搜索直达预览', ovVis);
    if (ovVis) {
      const ov = (await targets()).filter(t => t.url.includes('overlay.html')).pop();
      const c = await cdp(ov.webSocketDebuggerUrl);
      await c.evalIn(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`).catch(() => {});
      await sleep(800);
      c.close();
    }
  }

  // ---- T17 × discard specific card ----
  const targetId = await line.evalIn(`(() => {
    const s = [...document.querySelectorAll('.slot[data-id]')].find(x => x.querySelector('.memo-face'));
    return s ? s.dataset.id : null;
  })()`);
  await line.click(`(() => {
    const s = [...document.querySelectorAll('.slot[data-id]')].find(x => x.dataset.id === '${targetId}');
    const x = s.querySelector('.discard-x');
    x.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    const r = x.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  let discarded = await (async () => { const e = Date.now() + 4000; while (Date.now() < e) { try { if (await line.evalIn(`!document.querySelector('.slot[data-id="${targetId}"]')`)) return true; } catch { /* reloading */ } await sleep(250); } return false; })();
  if (!discarded) {
    // one retry: re-hover then click again (tooltip/hover race)
    await line.click(`(() => {
      const s = [...document.querySelectorAll('.slot[data-id]')].find(x => x.dataset.id === '${targetId}');
      const x = s.querySelector('.discard-x');
      x.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      const r = x.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    discarded = await (async () => { const e = Date.now() + 5000; while (Date.now() < e) { try { if (await line.evalIn(`!document.querySelector('.slot[data-id="${targetId}"]')`)) return true; } catch { /* reload */ } await sleep(250); } return false; })();
  }
  ok('E2E-17 ×撕下卡片', discarded, targetId);

  // ---- T18 markdown sync ----
  await sleep(900);
  const md = fs.readFileSync(path.join(process.env.USERPROFILE, 'Documents', 'SunMemo.md'), 'utf8');
  ok('E2E-18 SunMemo.md 同步+归档', md.includes('E2E 自动化便签') && md.includes('历史已撕下便签归档'));

  // ---- T19 search history chips (saved on commit, shown when the input empties) ----
  poke(['--search']);
  const search2T = await findTarget('search.html', 6000);
  let histOk = false;
  if (search2T) {
    const sc2 = await cdp(search2T.webSocketDebuggerUrl);
    await sc2.send('Runtime.enable');
    // Real render path: type → input event → clear → input event → chips row.
    // Commit goes through the page's own saveHist (what Enter/item-click calls);
    // a synthetic term matches no memo, so the Enter path can never fire it.
    await sc2.evalIn(`(() => {
      const on = document.querySelector('.tagchip.on'); if (on) on.click(); // R140: 清除套件残留的标签筛选，否则历史区被抑制
      const q = document.getElementById('q');
      q.value = '历史词A';
      q.dispatchEvent(new Event('input', { bubbles: true }));
      if (typeof saveHist === 'function') saveHist('历史词A');
      q.value = '';
      q.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    histOk = await waitForAsync(async () => {
      try {
        return await sc2.evalIn(`[...document.querySelectorAll('.hist-chip .hist-txt')].some(x => x.textContent.includes('历史词A'))`);
      } catch { return false; }
    }, 4000);
    sc2.close();
  }
  ok('E2E-19 搜索历史 chips', histOk);

  // ---- T20 desktop sticky editable → text syncs back to the line ----
  const tearId = await line.evalIn(`(() => {
    const s = [...document.querySelectorAll('.slot[data-id]')].find(x => x.querySelector('.memo-face'));
    return s ? s.dataset.id : null;
  })()`);
  let stickyOk = false, torn = false, stickyC = null;
  if (tearId) {
    await line.evalIn(`window.sun.send('line:tear-to-desktop', { id: '${tearId}', x: 600, y: 400 })`);
    torn = true;
    const stickyT = await findTarget('sticky.html', 8000);
    if (stickyT) {
      stickyC = await cdp(stickyT.webSocketDebuggerUrl);
      await stickyC.send('Runtime.enable');
      await (async () => { const e = Date.now() + 5000; while (Date.now() < e) { try { if (await stickyC.evalIn(`document.readyState`) === 'complete' && await stickyC.evalIn(`!!document.getElementById('content')`)) return true; } catch { /* load */ } await sleep(250); } return false; })();
      // click → enterEdit (contentEditable+focus), rewrite text, Escape → blur → save
      await stickyC.evalIn(`(() => {
        const c = document.getElementById('content');
        c.click();
        c.textContent = 'R140 编辑验证';
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return true;
      })()`);
      await sleep(1000);
      stickyOk = await line.evalIn(`window.sun.invoke('line:get-state').then(st => {
        const it = (st.items || []).find(x => x.id === '${tearId}');
        return !!(it && it.memo && String(it.memo.text).includes('R140 编辑验证'));
      })`);
    }
  }
  ok('E2E-20 贴桌便签可编辑回写', stickyOk, tearId);
  if (torn) {
    await line.evalIn(`window.sun.send('sticky:return', '${tearId}')`).catch(() => {});
    await sleep(600);
  }
  if (stickyC) stickyC.close();

  // ---- T21 ambient wind toggle drives line.js module state ----
  await line.evalIn(`window.sun.send('settings:set', { key: 'wind', value: true })`);
  await sleep(1200);
  const windOn = await line.evalIn(`typeof windNodes !== 'undefined' && !!windNodes`);
  await line.evalIn(`window.sun.send('settings:set', { key: 'wind', value: false })`);
  await sleep(1600);
  const windOff = await line.evalIn(`typeof windNodes !== 'undefined' && !windNodes`);
  ok('E2E-21 环境风声开关', windOn && windOff, `on=${windOn} off=${windOff}`);

  // ---- T22 photo preview rotate ----
  let rotOk = false;
  {
    park();
    await sleep(600);
    const photoId22 = await line.evalIn(`(() => {
      const s = [...document.querySelectorAll('.slot[data-id]')].find(x => x.querySelector('.photo-clip'));
      return s ? s.dataset.id : null;
    })()`);
    if (photoId22) {
      await line.click(`(() => {
        const s = [...document.querySelectorAll('.slot[data-id]')].find(x => x.dataset.id === '${photoId22}');
        const f = s.querySelector('.photo-clip');
        const r = f.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      })()`);
      const ovT22 = await findTarget('overlay.html', 6000);
      const ov22 = ovT22 && await cdp(ovT22.webSocketDebuggerUrl).catch(() => null);
      if (ov22) {
        await ov22.send('Runtime.enable');
        const photoVis = await waitForAsync(async () => {
          try {
            return await ov22.evalIn(`!document.getElementById('heroWrap').classList.contains('hidden') && !!document.querySelector('.photo-area img')`);
          } catch { return false; }
        }, 5000);
        if (photoVis) {
          await sleep(800); // hero panel springs in ~620ms; let it settle before acting
          if (await ov22.evalIn(`!!document.querySelector('[data-act="rotate"]')`)) {
            await ov22.evalIn(`document.querySelector('[data-act="rotate"]').click()`);
            await sleep(300);
            const tf = await ov22.evalIn(`(() => { const i = document.querySelector('.photo-area img'); return i ? i.style.transform : ''; })()`);
            rotOk = String(tf).includes('rotate(90deg)');
          }
        }
        await ov22.evalIn(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`).catch(() => {});
        await sleep(800);
        ov22.close();
      }
    }
  }
  ok('E2E-22 预览旋转90°', rotOk);

  // ---- T23 editor stat bar (char count) ----
  park();
  await sleep(600);
  let statOk = false;
  {
    await line.click(`(() => {
      const a = document.querySelector('.add-face');
      const r = a.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    const memoT23 = await findTarget('memo.html', 6000);
    if (memoT23) {
      const mc23 = await cdp(memoT23.webSocketDebuggerUrl);
      await mc23.send('Runtime.enable');
      await (async () => { const e = Date.now() + 4000; while (Date.now() < e) { try { if (await mc23.evalIn(`document.readyState`) === 'complete') return true; } catch { /* load */ } await sleep(200); } return false; })();
      await mc23.evalIn(`(() => {
        const e = document.getElementById('editor');
        e.value = 'R161 字数';
        e.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })()`);
      await sleep(600); // stat updates through a 150ms throttle timer
      const stat = await mc23.evalIn(`document.getElementById('statCount').textContent`);
      statOk = String(stat).includes('字');
      await mc23.evalIn(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`).catch(() => {}); // memo:cancel, no commit
      await sleep(600);
      mc23.close();
    }
  }
  ok('E2E-23 编辑器字数状态栏', statOk);

  // ---- T24 empty-state welcome card (clears the rope — keep LAST, app restarts after) ----
  await line.evalIn(`window.sun.invoke('line:get-state').then(s => Promise.all((s.items || []).map(i => window.sun.send('line:discard', i.id))))`).catch(() => {});
  await sleep(1200);
  const welcomeOk = await waitForAsync(async () => {
    try { return await line.evalIn(`!!document.querySelector('.welcome-card')`); } catch { return false; }
  }, 5000);
  ok('E2E-24 空态欢迎卡', welcomeOk);
  await line.evalIn(`window.sun.send('line:hang-clipboard')`).catch(() => {}); // best-effort restore; app restarts after the suite anyway

  const passed = results.filter(r => r[1]).length;
  console.log(`E2E RESULT: ${passed}/${results.length}`);
  fs.writeFileSync(path.join(APP, '_e2e-result.json'), JSON.stringify(results, null, 2));
  process.exit(passed === results.length ? 0 : 1);
};

run().catch(e => { console.error('E2E crashed:', e.message || e); process.exit(1); });
