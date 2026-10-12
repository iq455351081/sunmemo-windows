'use strict';
// Drop 3 docs, hover the docx card, screenshot the peek reader.
import { execSync } from 'node:child_process';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const E = String.fromCharCode(92);
const APP = ['E:', 'Agentic_Engineering', 'ZCode', 'sunidea'].join(E);
const t = async () => (await (await fetch('http://127.0.0.1:9222/json/list')).json()).filter(x => x.type === 'page');
const lt = (await t()).find(x => x.url.includes('line.html'));
const ws = new WebSocket(lt.webSocketDebuggerUrl);
await new Promise(r => { ws.onopen = r; });
let i = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const call = (m, p = {}) => new Promise(res => { const id = ++i; pend.set(id, res); ws.send(JSON.stringify({ id, method: m, params: p })); });
const ev = async x => { const r = await call('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) return 'EXC ' + String(r.exceptionDetails.exception && r.exceptionDetails.exception.description || '').slice(0, 200); return r.result && r.result.result && r.result.result.value; };
await call('Runtime.enable');
let rev = await ev(`document.getElementById('stage').classList.contains('revealed')`);
if (!rev) { await ev(`window.sun.send('line:toggle-userpin')`); await sleep(800); }
for (const n of ['项目方案.md', '设计说明.pdf', '项目评审纪要.docx']) {
  await ev(`window.sun.send('line:drop-file', ${JSON.stringify(APP + E + '_docs' + E + n)})`);
  await sleep(550);
}
await sleep(1600);
console.log('doc cards:', await ev(`[...document.querySelectorAll('.card.doc .doc-name')].map(n => n.textContent).join(', ')`));
await ev(`(() => { const f = [...document.querySelectorAll('.slot')].find(x => { const n = x.querySelector('.doc-name'); return n && n.textContent.indexOf('评审') >= 0; }) || [...document.querySelectorAll('.slot')].find(x => x.querySelector('.card.doc')); if (f) { f.querySelector('.doc-face').dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); return true; } return false; })()`);
await sleep(2400);
const SHOTS = APP + E + '_shots';
execSync(`powershell -NoProfile -Command "Add-Type -AssemblyName System.Drawing; $b = New-Object System.Drawing.Bitmap(1400, 1000); $g = [System.Drawing.Graphics]::FromImage($b); $g.CopyFromScreen(560, 340, 0, 0, $b.Size); $b.Save('${SHOTS + E}docx-peek.png'); $g.Dispose(); $b.Dispose()"`, { stdio: 'ignore' });
console.log('shot saved');
process.exit(0);
