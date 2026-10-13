'use strict';
// Open the memory board and capture overlay exceptions + board state.
import { setTimeout as sleep } from 'node:timers/promises';
const t = async () => (await (await fetch('http://127.0.0.1:9222/json/list')).json()).filter(x => x.type === 'page');
const seen = new Set();
// overlay 异常监听
(async () => {
  for (let k = 0; k < 40; k++) {
    const ts = (await t().catch(() => [])).filter(x => x.type === 'page' && x.url.includes('overlay.html') && !seen.has(x.webSocketDebuggerUrl));
    const tt = ts[0];
    if (!tt) { await sleep(300); continue; }
    seen.add(tt.webSocketDebuggerUrl);
    const ws = new WebSocket(tt.webSocketDebuggerUrl);
    await new Promise(r => { ws.onopen = r; });
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.method === 'Runtime.exceptionThrown') {
        const d = m.params.exceptionDetails;
        console.log('[overlay EXC]', d.text, String(d.exception && d.exception.description || '').split('\n').slice(0, 3).join(' | ').slice(0, 280));
      }
    };
    ws.send(JSON.stringify({ id: 9001, method: 'Runtime.enable', params: {} }));
    return;
  }
})();
await sleep(800);
const lt = (await t()).find(x => x.url.includes('line.html'));
const ws = new WebSocket(lt.webSocketDebuggerUrl);
await new Promise(r => { ws.onopen = r; });
let i = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const call = (m, p = {}) => new Promise(res => { const id = ++i; pend.set(id, res); ws.send(JSON.stringify({ id, method: m, params: p })); });
const ev = async x => { const r = await call('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) return 'EXC'; return r.result && r.result.result && r.result.result.value; };
await call('Runtime.enable');
await ev(`window.sun.send('line:memory')`);
await sleep(2200);
const ov = (await t()).find(x => x.url.includes('overlay.html'));
const ws2 = new WebSocket(ov.webSocketDebuggerUrl);
await new Promise(r => { ws2.onopen = r; });
let j = 0; const pend2 = new Map();
ws2.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend2.has(m.id)) { pend2.get(m.id)(m); pend2.delete(m.id); } };
const ev2 = async x => { const r = await new Promise(res => { const id = ++j; pend2.set(id, res); ws2.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: x, returnByValue: true, awaitPromise: true } })); }); if (r.exceptionDetails) return 'EXC ' + String(r.exceptionDetails.exception && r.exceptionDetails.exception.description || '').slice(0, 200); return JSON.stringify(r.result && r.result.result && r.result.result.value); };
console.log('memory board:', await ev2('(() => { const m = document.querySelector(".memory-board"); return m ? { weeks: m.querySelectorAll(".mem-week").length, cards: m.querySelectorAll(".mem-card").length } : null; })()'));
process.exit(0);
