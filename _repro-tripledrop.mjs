'use strict';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const E = String.fromCharCode(92);
const DOCS = ['E:', 'Agentic_Engineering', 'ZCode', 'sunidea', '_docs'].join(E);
const t = async () => (await (await fetch('http://127.0.0.1:9222/json/list')).json()).filter(x => x.type === 'page');
const lt = (await t()).find(x => x.url.includes('line.html'));
const ws = new WebSocket(lt.webSocketDebuggerUrl);
await new Promise(r => { ws.onopen = r; });
let i = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const call = (m, p = {}) => new Promise(res => { const id = ++i; pend.set(id, res); ws.send(JSON.stringify({ id, method: m, params: p })); });
const ev = async x => { const r = await call('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) return 'EXC: ' + String(r.exceptionDetails.exception && r.exceptionDetails.exception.description || '').slice(0, 200); return r.result && r.result.result && r.result.result.value; };
await call('Runtime.enable');
for (let attempt = 1; attempt <= 3; attempt++) {
  for (const n of ['项目方案.md', '设计说明.pdf', '项目评审纪要.docx']) {
    await ev(`window.sun.send('line:drop-file', ${JSON.stringify(DOCS + E + n)})`);
    await sleep(550);
  }
  await sleep(1700);
  console.log('attempt ' + attempt + ' doc cards:', await ev(`[...document.querySelectorAll('.card.doc .doc-name')].map(n => n.textContent).join(' | ')`));
  // 撕下所有文档副本，还原到只剩种子
  await ev(`(() => { const ids = [...document.querySelectorAll('.card.doc')].map(c => c.closest('.slot').dataset.id); ids.forEach(id => window.sun.send('line:discard', id)); return ids.length; })()`);
  await sleep(1400);
}
process.exit(0);
