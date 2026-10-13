'use strict';
import { setTimeout as sleep } from 'node:timers/promises';
const t = async () => (await (await fetch('http://127.0.0.1:9222/json/list')).json()).filter(x => x.type === 'page');
const ov = (await t()).find(x => x.url.includes('overlay.html'));
const lt = (await t()).find(x => x.url.includes('line.html'));
const conn = async t2 => {
  const ws = new WebSocket(t2.webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });
  let i = 0; const pend = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const call = (m, p = {}) => new Promise(res => { const id = ++i; pend.set(id, res); ws.send(JSON.stringify({ id, method: m, params: p })); });
  const ev = async x => { const r = await call('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) return 'EXC ' + String(r.exceptionDetails.exception && r.exceptionDetails.exception.description || '').slice(0, 200); return r.result && r.result.result && r.result.result.value; };
  await call('Runtime.enable');
  return { call, ev };
};

const line = await conn(lt);
console.log('memo face:', await line.ev(`(() => { const f = document.querySelector('.memo-face'); return f ? { draggable: f.draggable, attr: f.getAttribute('draggable'), cls: f.className } : 'none'; })()`));

if (ov) {
  const o = await conn(ov);
  console.log('hero pages:', await o.ev(`(() => { const h = document.getElementById('heroCard'); const wraps = [...h.querySelectorAll('.docr-pdf-page')]; return { total: wraps.length, canvas: wraps.filter(w => w.querySelector('canvas')).length, pending: wraps.filter(w => w.classList.contains('pending')).length, lastTop: Math.round(wraps[wraps.length - 1].getBoundingClientRect().top), bodyH: (() => { const b = h.querySelector('.docr-body'); return b ? { sh: b.scrollHeight, ch: b.clientHeight, st: b.scrollTop, overflow: getComputedStyle(b).overflowY } : 'no .docr-body'; })() }; })()`));
  // 手动 IO 测试：同一 root 观察最后一个 pending 页，看是否触发
  console.log('manual IO:', await o.ev(`(async () => {
    const h = document.getElementById('heroCard');
    const b = h.querySelector('.docr-body');
    const wrap = [...h.querySelectorAll('.docr-pdf-page.pending')].pop();
    if (!wrap) return 'no pending wrap';
    let fired = 0;
    const io = new IntersectionObserver(es => { es.forEach(e => { if (e.isIntersecting) fired++; }); }, { root: b, rootMargin: '700px 0px' });
    io.observe(wrap);
    b.scrollTop = b.scrollHeight;
    await new Promise(r => setTimeout(r, 800));
    io.disconnect();
    return 'fired=' + fired + ' wrapRectTop=' + Math.round(wrap.getBoundingClientRect().top) + ' bodyBottom=' + Math.round(b.getBoundingClientRect().bottom);
  })()`));
}
process.exit(0);
