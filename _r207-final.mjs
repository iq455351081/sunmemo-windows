// R207b: error hook + blank→card move → read errors + magnifier presence
const sleep = ms => new Promise(r => setTimeout(r, ms));
const targets = async () => (await (await fetch('http://127.0.0.1:9222/json/list')).json()).filter(t => t.type === 'page');
function cdp(url) {
  const ws = new WebSocket(url);
  return new Promise((res, rej) => {
    ws.onopen = () => {
      let i = 400; const pend = new Map();
      ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
      res({
        eval: async expr => { const k = ++i; const r = await new Promise(res2 => { ws.addEventListener('message', function h(e2) { const m2 = JSON.parse(e2.data); if (m2.id === k) { ws.removeEventListener('message', h); res2(m2); } }); ws.send(JSON.stringify({ id: k, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: true } })); }); if (r.exceptionDetails) throw new Error('EXC: ' + (r.exceptionDetails.exception?.description || '').slice(0, 100)); return r.result.value; },
        call: (method, params) => { const k = ++i; ws.send(JSON.stringify({ id: k, method, params })); },
        close: () => ws.close(),
      });
    };
    ws.onerror = () => rej(new Error('ws fail'));
  });
}
const line = await cdp((await targets()).find(t => t.url.includes('line.html')).webSocketDebuggerUrl);
await line.eval(`window.__err = []; window.addEventListener('error', e => window.__err.push((e.message || '').slice(0, 160))); true`);
let revealed = await line.eval(`document.getElementById('stage').classList.contains('revealed')`);
if (!revealed) { await line.eval(`window.sun.send('line:toggle-userpin')`); await sleep(900);
  revealed = await line.eval(`document.getElementById('stage').classList.contains('revealed')`);
  if (!revealed) { await line.eval(`window.sun.send('line:toggle-userpin')`); await sleep(900); }
}
// 移到空白 → 清悬停
await line.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 30, y: 260 });
await sleep(250);
await line.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 33, y: 260 });
await sleep(250);
// 移入图片卡
const pt = await line.eval(`(() => { const s = [...document.querySelectorAll('.slot')].find(x => x.querySelector('.photo-clip')); const c = s.querySelector('.photo-clip').getBoundingClientRect(); return { x: Math.round(c.left + c.width/2), y: Math.round(c.top + c.height/2) }; })()`);
await line.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pt.x, y: pt.y });
await sleep(900);
console.log('magnifier:', await line.eval(`(() => { const m = document.getElementById('imgMagnify'); if (!m) return 'MISSING'; const r = m.getBoundingClientRect(); const img = m.querySelector('img'); return JSON.stringify({ rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], inWindow: r.top >= 0 && r.bottom <= innerHeight && r.right <= innerWidth, imgOk: img && img.naturalWidth > 0, opacity: getComputedStyle(m).opacity }); })()`));
// 移开 → 收起
await line.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 30, y: 260 });
await sleep(900);
console.log('moved-away hide:', await line.eval(`!document.getElementById('imgMagnify') ? 'PASS' : 'FAIL'`));
// 解除钉住（恢复默认态）
await line.eval(`window.sun.send('line:toggle-userpin')`);
process.exit(0);
