// R208: 用户流复现 — 悬停图片卡 → 采样 imgMagnify 状态
import { execSync } from 'node:child_process';
const E = String.fromCharCode(92);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const exe = ['E:', 'Agentic_Engineering', 'ZCode', 'sunidea', 'node_modules', 'electron', 'dist', 'electron.exe'].join(E);
const app = ['E:', 'Agentic_Engineering', 'ZCode', 'sunidea'].join(E);
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
execSync(`powershell -NoProfile -Command "& 'E:${E}Agentic_Engineering${E}ZCode${E}sunidea${E}scripts-app.ps1' -Action restart -Args '--demo'"`, { stdio: 'ignore' });
await sleep(9000);
const line = await cdp((await targets()).find(t => t.url.includes('line.html')).webSocketDebuggerUrl);
await line.eval(`window.__err = []; window.addEventListener('error', e => window.__err.push((e.message || '').slice(0, 160))); true`);
let revealed = await line.eval(`document.getElementById('stage').classList.contains('revealed')`);
if (!revealed) { await line.eval(`window.sun.send('line:toggle-userpin')`); await sleep(900); }
// 真实光标（scripts-input）移到图片卡
const c = await line.eval(`(() => { const s = [...document.querySelectorAll('.slot')].find(x => x.querySelector('.photo-clip')); const r = s.querySelector('.photo-clip').getBoundingClientRect(); const dpr = devicePixelRatio; return { x: Math.round((r.left + r.width/2) * dpr), y: Math.round((r.top + r.height/2) * dpr) }; })()`);
console.log('photo phys:', JSON.stringify(c));
execSync(`powershell -NoProfile -Command "& 'E:${E}Agentic_Engineering${E}ZCode${E}sunidea${E}scripts-input.ps1' -x ${c.x} -y ${c.y} -moveonly"`);
for (let k = 0; k < 6; k++) {
  await sleep(400);
  const st = await line.eval(`(() => { const m = document.getElementById('imgMagnify'); if (!m) return 'no-mag'; const img = m.querySelector('img'); const r = m.getBoundingClientRect(); return JSON.stringify({ w: Math.round(r.width), h: Math.round(r.height), opacity: getComputedStyle(m).opacity.slice(0, 4), imgOk: img && img.naturalWidth > 0 }); })()`);
  console.log('t+' + ((k + 1) * 0.4).toFixed(1) + 's:', st);
  if (!st.includes('no-mag') && !st.includes('"opacity":"0')) break;
}
console.log('page errors:', await line.eval(`JSON.stringify(window.__err)`));
process.exit(0);
