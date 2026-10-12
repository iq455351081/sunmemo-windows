// R208: 纯 OS 层验证 — 真实光标悬停 + 屏幕截图
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const E = String.fromCharCode(92);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sh = cmd => execSync(cmd, { stdio: 'ignore' });
const appDir = 'E:/Agentic_Engineering/ZCode/sunidea';
const ps = c => execSync(`powershell -NoProfile -Command "${c}"`);
// 1) 钉住展开（pin toggle 两次确保最终=开）
sh(`powershell -NoProfile -Command "Start-Process -FilePath '${['E:', 'Agentic_Engineering', 'ZCode', 'sunidea', 'node_modules', 'electron', 'dist', 'electron.exe'].join(E)}' -ArgumentList @('${['E:', 'Agentic_Engineering', 'ZCode', 'sunidea'].join(E)}','--open=stats') -WindowStyle Hidden"`);
await sleep(4000);
// 关闭 stats（Esc via 关闭按钮太麻烦——直接重开干净态）
sh(`powershell -NoProfile -Command "& 'E:${E}Agentic_Engineering${E}ZCode${E}sunidea${E}scripts-app.ps1' -Action restart -Args '--demo'"`);
await sleep(9000);
// 2) 钉住展开
await import('node:fs');
// 用 CDP 只做 pin（这一次性连接是可靠的）
const ts = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const lineT = ts.filter(t => t.type === 'page' && t.url.includes('line.html')).pop();
const ws = new WebSocket(lineT.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params) => { const i = ++id; return new Promise(res => { ws.addEventListener('message', function h(e2) { const m2 = JSON.parse(e2.data); if (m2.id === i) { ws.removeEventListener('message', h); res(m2); } }); ws.send(JSON.stringify({ id: i, method, params })); }); };
await send('Runtime.evaluate', { expression: `window.sun.send('line:toggle-userpin')`, returnByValue: true });
await sleep(900);
console.log('pinned+revealed');
// 3) 真实光标移到图片卡中心（从 CDP 读 CSS 坐标 × dpr）
const c = await new Promise(res => { const i = ++id; ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id === i) res(m.result?.result?.value || {}); }; ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: `(() => { const s = [...document.querySelectorAll('.slot')].find(x => x.querySelector('.photo-clip')); const r = s.querySelector('.photo-clip').getBoundingClientRect(); const dpr = devicePixelRatio; return { x: Math.round((r.left + r.width/2) * dpr), y: Math.round((r.top + r.height/2) * dpr) }; })()`, returnByValue: true } })); });
console.log('cursor to:', JSON.stringify(c));
sh(`powershell -NoProfile -Command "& 'E:${E}Agentic_Engineering${E}ZCode${E}sunidea${E}scripts-input.ps1' -x ${c.x} -y ${c.y} -moveonly"`);
await sleep(1400); // 350ms 意图 + 创建 + 淡入
// 4) 屏幕截图（含放大镜）
const bmpCmd = `
Add-Type -AssemblyName System.Drawing;
$bmp = New-Object System.Drawing.Bitmap(2560, 700);
$g = [System.Drawing.Graphics]::FromImage($bmp);
$g.CopyFromScreen(0, 0, 0, 0, $bmp.Size);
$bmp.Save('E:${E}Agentic_Engineering${E}ZCode${E}sunidea${E}_shots${E}archive${E}r208-magnifier-live.png');
$g.Dispose(); $bmp.Dispose();`;
execSync(`powershell -NoProfile -Command "${bmpCmd.replace(/"/g, String.fromCharCode(39))}"`, { stdio: 'ignore' });
console.log('screenshot saved');
process.exit(0);
