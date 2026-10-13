'use strict';
// Round-A diagnostics: window exceptions + DISCOVER load + slot presence.
import { setTimeout as sleep } from 'node:timers/promises';
const t = async () => (await (await fetch('http://127.0.0.1:9222/json/list')).json()).filter(x => x.type === 'page');
const seen = new Set();
const watch = async (part) => {
  for (let k = 0; k < 30; k++) {
    const ts = (await t().catch(() => [])).filter(x => x.type === 'page' && x.url.includes(part) && !seen.has(x.webSocketDebuggerUrl));
    const tt = ts[0];
    if (!tt) { await sleep(400); continue; }
    seen.add(tt.webSocketDebuggerUrl);
    const ws = new WebSocket(tt.webSocketDebuggerUrl);
    await new Promise(r => { ws.onopen = r; });
    let mid = 0; const pend = new Map();
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return; }
      if (m.method === 'Runtime.exceptionThrown') {
        const d = m.params.exceptionDetails;
        console.log('[' + part + ' EXC]', d.text, String(d.exception && d.exception.description || '').split('\n').slice(0, 3).join(' | ').slice(0, 260));
      }
    };
    const call = (m, p = {}) => new Promise(res => { const id = ++mid; pend.set(id, res); ws.send(JSON.stringify({ id, method: m, params: p })); });
    await call('Runtime.enable');
    if (part === 'line.html') {
      const r = await call('Runtime.evaluate', { expression: `typeof window.DISCOVER + ' | slot=' + !!document.querySelector('.discover-slot') + ' | discoverslotDisplay=' + (document.querySelector('.discover-slot') ? document.querySelector('.discover-slot').style.display : 'n/a')`, returnByValue: true });
      console.log('[line probe]', r.result && r.result.result && r.result.result.value);
    }
    return;
  }
  console.log(part, 'never appeared');
};
await watch('line.html');
await sleep(1000);
await watch('overlay.html');
await sleep(3000);
process.exit(0);
