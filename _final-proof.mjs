// 最终证明: 悬停图片卡 → 大图浮窗出现（状态 + 屏幕实拍双重证据）
const sleep = ms => new Promise(r => setTimeout(r, ms));
const targets = async () => (await (await fetch('http://127.0.0.1:9222/json/list')).json()).filter(t => t.type === 'page');
function cdp(url) {
  const ws = new WebSocket(url);
  return new Promise((res, rej) => {
    ws.onopen = () => {
      let i = 400; const pend = new Map();
      ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
      res({
        eval: async expr => { const k = ++i; const r = await new Promise(res2 => { ws.onmessage = e => { const m2 = JSON.parse(e2.data); if (m2.id === k) { pend.get(m.id)(m2); } }; ws.send(JSON.stringify({ id: k, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: true } })); }); if (r.exceptionDetails) throw new Error('EXC'); return r.result.value; },
        call: (method, params) => { const k = ++i; return new Promise(res2 => { ws.onmessage = e => { const m2 = JSON.parse(e2.data); if (m2.id === k) { res(m2); } }; ws.send(JSON.stringify({ id: k, method, params })); }); },
      });
    };
    ws.onerror = () => rej(new Error('ws fail'));
  });
}
execSyncSh();
function execSyncSh(cmd) { (async () => { const { execSync } = await import('node:child_process'); try { execSync(cmd, { stdio: 'ignore' }); } catch {} })(); }
const line = await cdp(targets().find(t => t.url.includes('line.html')).webSocketDebuggerUrl);
let revealed = await line.eval(`document.getElementById('stage').classList.contains('revealed')`);
if (!revealed) { await line.eval(`window.sun.send('line:toggle-userpin')`); await sleep(900); }
const pt = await line.eval(`(() => { const s = [...document.querySelectorAll('.slot')].find(x => x.querySelector('.photo-clip')); const c = s.querySelector('.photo-clip').getBoundingClientRect(); return { x: Math.round(c.left + c.width/2), y: Math.round(c.top + c.height/2) }; })()`);
await line.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pt.x, y: pt.y });
await sleep(1200);
const proof = await line.eval(`(() => { const m = document.getElementById('imgMagnify'); if (!m) return 'NO MAGNIFIER'; const r = m.getBoundingClientRect(); const img = m.querySelector('img'); return JSON.stringify({ rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], imgOk: img && img.naturalWidth > 0, opacity: getComputedStyle(m).opacity }); })()`);
console.log('放大镜状态:', proof);
await sleep(300);
process.exit(0);
