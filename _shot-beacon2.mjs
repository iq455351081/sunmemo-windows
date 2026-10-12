'use strict';
// Beacon hover via CDP Input (SetCursorPos dpr artifact bypass), then shoot.
import { execSync } from 'node:child_process';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const E = String.fromCharCode(92);
const APP = ['E:', 'Agentic_Engineering', 'ZCode', 'sunidea'].join(E);
const t = async () => (await (await fetch('http://127.0.0.1:9222/json/list')).json()).filter(x => x.type === 'page');
const bt = (await t()).find(x => x.url.includes('beacon.html'));
if (!bt) { console.log('NO BEACON'); process.exit(1); }
const ws = new WebSocket(bt.webSocketDebuggerUrl);
await new Promise(r => { ws.onopen = r; });
let i = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const call = (m, p = {}) => new Promise(res => { const id = ++i; pend.set(id, res); ws.send(JSON.stringify({ id, method: m, params: p })); });
await call('Runtime.enable');
await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 84, y: 21 });
await sleep(600);
const st = await call('Runtime.evaluate', { expression: `(() => { const b = document.getElementById('beacon'); const r = b.getBoundingClientRect(); const cs = getComputedStyle(b); return JSON.stringify({ w: r.width, hover: b.matches(':hover'), labelOpacity: getComputedStyle(b.querySelector('.label')).opacity, docW: document.documentElement.clientWidth }); })()`, returnByValue: true });
console.log('beacon state:', st.result && st.result.result && st.result.result.value);
execSync(`powershell -NoProfile -Command "Add-Type -AssemblyName System.Drawing; $b = New-Object System.Drawing.Bitmap(560, 160); $g = [System.Drawing.Graphics]::FromImage($b); $g.CopyFromScreen(1000, 0, 0, 0, $b.Size); $b.Save('${APP + E}_shots${E}beacon-hover.png'); $g.Dispose(); $b.Dispose()"`, { stdio: 'ignore' });
console.log('shot saved');
process.exit(0);
