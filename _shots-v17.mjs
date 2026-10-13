'use strict';
// v1.7 验收截图：全完成（小鸟+种子+发现卡+褪色）与时光回忆板
import { execSync } from 'node:child_process';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const E = String.fromCharCode(92);
const APP = ['E:', 'Agentic_Engineering', 'ZCode', 'sunidea'].join(E);
const SHOTS = APP + E + '_shots';
const PS = c => execSync(`powershell -NoProfile -Command "${c}"`, { stdio: 'ignore' });
const t = async () => (await (await fetch('http://127.0.0.1:9222/json/list')).json()).filter(x => x.type === 'page');
const lt = (await t()).find(x => x.url.includes('line.html'));
const ws = new WebSocket(lt.webSocketDebuggerUrl);
await new Promise(r => { ws.onopen = r; });
let i = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const call = (m, p = {}) => new Promise(res => { const id = ++i; pend.set(id, res); ws.send(JSON.stringify({ id, method: m, params: p })); });
const ev = async x => { const r = await call('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) return 'EXC'; return r.result && r.result.result && r.result.result.value; };
await call('Runtime.enable');
let rev = await ev(`document.getElementById('stage').classList.contains('revealed')`);
if (!rev) { await ev(`window.sun.send('line:toggle-userpin')`); await sleep(800); }
// 勾完所有待办 → 小鸟+种子
await ev(`(() => { document.querySelectorAll('.slot .md-box:not(.checked)').forEach(b => b.click()); return 1; })()`);
await sleep(3400);
console.log('state:', await ev(`JSON.stringify({ bird: !!document.getElementById('ropeBird'), seed: !!document.getElementById('ropeSeed'), disc: !!document.querySelector('.discover-card') })`));
PS(`Add-Type -AssemblyName System.Drawing; $b = New-Object System.Drawing.Bitmap(2560, 440); $g = [System.Drawing.Graphics]::FromImage($b); $g.CopyFromScreen(0, 0, 0, 0, $b.Size); $b.Save('${SHOTS + E}v17-rope.png'); $g.Dispose(); $b.Dispose()`);
// 记忆板
await ev(`window.sun.send('line:memory')`);
await sleep(2200);
PS(`Add-Type -AssemblyName System.Drawing; $b = New-Object System.Drawing.Bitmap(2560, 1400); $g = [System.Drawing.Graphics]::FromImage($b); $g.CopyFromScreen(0, 100, 0, 100, $b.Size); $b.Save('${SHOTS + E}v17-memory.png'); $g.Dispose(); $b.Dispose()`);
console.log('shots saved');
process.exit(0);
