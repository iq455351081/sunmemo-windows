// 真实屏幕截图: 打开图片预览 → CopyFromScreen 合成桌面
import { execSync } from 'node:child_process';
const E = String.fromCharCode(92);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const app = ['E:', 'Agentic_Engineering', 'ZCode', 'sunidea'].join(E);
const exe = ['E:', 'Agentic_Engineering', 'ZCode', 'sunidea', 'node_modules', 'electron', 'dist', 'electron.exe'].join(E);
const sh = c => execSync(c, { stdio: 'ignore' });
// 确保干净态 + 钉住展开
sh(`powershell -NoProfile -Command "& 'E:${E}Agentic_Engineering${E}ZCode${E}sunidea${E}scripts-app.ps1' -Action restart -Args '--demo'"`);
await sleep(9000);
const ts = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const line = ts.filter(t => t.type === 'page' && t.url.includes('line.html')).pop();
const ws = new WebSocket(line.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async expr => { const m = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (m.exceptionDetails) throw new Error('EXC'); return m.result.value; };
let revealed = await ev(`document.getElementById('stage').classList.contains('revealed')`);
if (!revealed) { await ev(`window.sun.send('line:toggle-userpin')`); await sleep(900); }
// 真实光标移到图片卡（触发真实事件链）
const pt = await ev(`(() => { const s = [...document.querySelectorAll('.slot')].find(x => x.querySelector('.photo-clip')); const r = s.querySelector('.photo-clip').getBoundingClientRect(); const dpr = devicePixelRatio; return { x: Math.round((r.left + r.width/2) * dpr), y: Math.round((r.top + r.height/2) * dpr) }; })()`);
sh(`powershell -NoProfile -Command "& 'E:${E}Agentic_Engineering${E}ZCode${E}sunidea${E}scripts-input.ps1' -x ${pt.x} -y ${pt.y} -moveonly"`);
await sleep(300);
await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: Math.round(pt.x / 1.5), y: Math.round(pt.y / 1.5), button: 'left', clickCount: 1 });
await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: Math.round(pt.x / 1.5), y: Math.round(pt.y / 1.5), button: 'left', clickCount: 1 });
await sleep(1500);
// 屏幕截图（物理 2560 宽取左上 1700x800 区域）
sh(`powershell -NoProfile -Command "Add-Type -AssemblyName System.Drawing; $b = New-Object System.Drawing.Bitmap(1700, 800); $g = [System.Drawing.Graphics]::FromImage($b); $g.CopyFromScreen(0, 0, 0, 0, $b.Size); $b.Save('E:${E}Agentic_Engineering${E}ZCode${E}sunidea${E}_shots${E}preview-real.png'); $g.Dispose(); $b.Dispose()"`);
console.log('real screenshot saved');
process.exit(0);
