'use strict';
// README 真实图片素材：下载 3 张真实风景照 → 上绳 → 截绳条带 + 悬停前后图
import { execSync } from 'node:child_process';
import fs from 'node:fs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const E = String.fromCharCode(92);
const APP = ['E:', 'Agentic_Engineering', 'ZCode', 'sunidea'].join(E);
const DOCS = APP + E + '_docs';
const PS = c => execSync(`powershell -NoProfile -Command "${c}"`, { stdio: 'ignore' });
fs.mkdirSync(DOCS, { recursive: true });

const IMGS = [
  ['real-snowlake.jpeg', 'https://image-search-mcp-cn-beijing.oss-cn-beijing.aliyuncs.com/image-search-mcp/images-ppt/61b985307893.jpeg'],
  ['real-lake-dawn.png', 'https://image-search-mcp-cn-beijing.oss-cn-beijing.aliyuncs.com/image-search-mcp/images-ppt/42ff8cf90284.png'],
  ['real-sea-sunset.jpeg', 'https://image-search-mcp-cn-beijing.oss-cn-beijing.aliyuncs.com/image-search-mcp/images-ppt/dca8e430a299.jpeg'],
];
for (const [name, url] of IMGS) {
  const p = DOCS + E + name;
  if (!fs.existsSync(p)) {
    const r = await fetch(url);
    if (!r.ok) { console.log('DL FAIL', name, r.status); process.exit(1); }
    fs.writeFileSync(p, Buffer.from(await r.arrayBuffer()));
  }
  console.log(name, fs.statSync(p).size, 'bytes');
}

const t = async () => (await (await fetch('http://127.0.0.1:9222/json/list')).json()).filter(x => x.type === 'page');
const lt = (await t()).find(x => x.url.includes('line.html'));
if (!lt) { console.log('NO LINE'); process.exit(1); }
const ws = new WebSocket(lt.webSocketDebuggerUrl);
await new Promise(r => { ws.onopen = r; });
let mid = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const call = (m, p = {}) => new Promise(res => { const id = ++mid; pend.set(id, res); ws.send(JSON.stringify({ id, method: m, params: p })); });
const ev = async x => { const r = await call('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) return 'EXC ' + String(r.exceptionDetails.exception && r.exceptionDetails.exception.description || '').slice(0, 200); return r.result && r.result.result && r.result.result.value; };
await call('Runtime.enable');
let rev = await ev(`document.getElementById('stage').classList.contains('revealed')`);
if (!rev) { await ev(`window.sun.send('line:toggle-userpin')`); await sleep(800); }

// 真实图片上绳
for (const [name] of IMGS) {
  await ev(`window.sun.send('line:drop-file', ${JSON.stringify(DOCS + E + name)})`);
  await sleep(600);
}
await sleep(1400);
console.log('photos on rope:', await ev(`document.querySelectorAll('.slot .photo-clip').length`));

// ① 绳条带全景（2560 宽 × 顶部 430 物理）
PS(`Add-Type -AssemblyName System.Drawing; $b = New-Object System.Drawing.Bitmap(2560, 430); $g = [System.Drawing.Graphics]::FromImage($b); $g.CopyFromScreen(0, 0, 0, 0, $b.Size); $b.Save('${DOCS + E}strip-raw.png'); $g.Dispose(); $b.Dispose()`);

// ② 悬停最后一张真实照片 → 前后对比素材
const pt = await ev(`(() => { const clips = [...document.querySelectorAll('.photo-clip')]; const s = clips[clips.length - 1].closest('.slot'); const r = s.querySelector('.photo-clip').getBoundingClientRect(); return { x: Math.round((r.left + r.width / 2) * devicePixelRatio), y: Math.round((r.top + r.height / 2) * devicePixelRatio) }; })()`);
const W = 1000, H = 640;
const X0 = Math.max(0, Math.min(pt.x - 500, 2560 - W));
const Y0 = Math.max(0, Math.min(pt.y - 280, 1600 - H));
const shot = f => PS(`Add-Type -AssemblyName System.Drawing; $b = New-Object System.Drawing.Bitmap(${W}, ${H}); $g = [System.Drawing.Graphics]::FromImage($b); $g.CopyFromScreen(${X0}, ${Y0}, 0, 0, $b.Size); $b.Save('${APP + E}_shots${E}${f}'); $g.Dispose(); $b.Dispose()`);
PS(`& '${APP + E}scripts-input-abs.ps1' -x 200 -y 1500`);
await sleep(900);
shot('fig16-normal.png');
PS(`& '${APP + E}scripts-input-abs.ps1' -x ${pt.x} -y ${pt.y}`);
await sleep(850);
const z = await ev(`(() => { const clips = [...document.querySelectorAll('.photo-clip')]; const s = clips[clips.length - 1].closest('.slot'); const m = getComputedStyle(s.querySelector('.photo-clip')).transform.match(/matrix\\(([-\\d.]+)/); return { hover: s.classList.contains('hover'), v: m ? parseFloat(m[1]) : null }; })()`);
console.log('hover:', JSON.stringify(z));
shot('fig16-hover.png');
console.log('figures captured');
process.exit(0);
