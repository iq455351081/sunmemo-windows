'use strict';
// Round-3 UX acceptance: capture every new surface on the final build.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const E = String.fromCharCode(92);
const APP = ['E:', 'Agentic_Engineering', 'ZCode', 'sunidea'].join(E);
const DOCS = APP + E + '_docs';
const SHOTS = APP + E + '_shots';
const PS = c => execSync(`powershell -NoProfile -Command "${c}"`, { stdio: 'ignore' });

const t = async () => (await (await fetch('http://127.0.0.1:9222/json/list')).json()).filter(x => x.type === 'page');
const find = async (part, ms = 8000) => { const e = Date.now() + ms; while (Date.now() < e) { const x = (await t().catch(() => [])).filter(y => y.url.includes(part)).pop(); if (x) return x; await sleep(250); } return null; };
const conn = async t2 => {
  const ws = new WebSocket(t2.webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });
  let i = 0; const pend = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const call = (m, p = {}) => new Promise(res => { const id = ++i; pend.set(id, res); ws.send(JSON.stringify({ id, method: m, params: p })); });
  const ev = async x => { const r = await call('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) return 'EXC ' + String(r.exceptionDetails.exception && r.exceptionDetails.exception.description || '').slice(0, 160); return r.result && r.result.result && r.result.result.value; };
  await call('Runtime.enable');
  return { call, ev };
};

const line = await conn(await find('line.html'));
// 钉住 + 天空底（纯净）+ 三文档上绳
let rev = await line.ev(`document.getElementById('stage').classList.contains('revealed')`);
if (!rev) { await line.ev(`window.sun.send('line:toggle-userpin')`); await sleep(800); }
for (const n of ['项目方案.md', '设计说明.pdf', '项目评审纪要.docx']) {
  await line.ev(`window.sun.send('line:drop-file', ${JSON.stringify(DOCS + E + n)})`);
  await sleep(550);
}
await sleep(1600);
await line.ev(`(() => { const st = document.createElement('style'); st.id = '__herobg'; st.textContent = '#stage { background: linear-gradient(180deg, #b5e3fb 0%, #e3f4fe 46%, #fdf3e4 78%, #fbe7cf 100%) !important; }'; document.head.appendChild(st); return true; })()`);
await sleep(350);
const cap = async () => { const r = await line.call('Page.captureScreenshot', { format: 'png' }); return Buffer.from(r.result.data, 'base64'); };
fs.writeFileSync(SHOTS + E + 'ux1-docs-rope.png', await cap());

// 悬停 docx → 居中粘性面板
await line.ev(`(() => { const f = [...document.querySelectorAll('.slot')].find(x => { const n = x.querySelector('.doc-name'); return n && n.textContent.indexOf('评审') >= 0; }); if (f) f.querySelector('.doc-face').dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); return !!f; })()`);
await sleep(2600);
const ov = await conn(await find('overlay.html'));
const peek = await ov.ev(`(() => { const p = document.querySelector('.doc-peek'); if (!p) return null; const r = p.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), sections: p.querySelectorAll('.docx-wrapper section.docx').length }; })()`);
console.log('peek:', JSON.stringify(peek));
PS(`Add-Type -AssemblyName System.Drawing; $b = New-Object System.Drawing.Bitmap(2560, 1500); $g = [System.Drawing.Graphics]::FromImage($b); $g.CopyFromScreen(0, 0, 0, 0, $b.Size); $b.Save('${SHOTS + E}ux2-peek-centered.png'); $g.Dispose(); $b.Dispose()`);

// 大图阅读
await ov.ev(`(() => { const b = document.querySelector('.doc-peek [data-pk="preview"]'); if (b) b.click(); return !!b; })()`);
await sleep(2200);
const hero = await ov.ev(`(() => { const h = document.getElementById('heroCard'); const r = h.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), pages: h.querySelectorAll('.docr-pdf-page, .docx-wrapper section.docx').length, kind: h.querySelector('.hero-doc') ? 'doc' : 'other' }; })()`);
console.log('hero-doc:', JSON.stringify(hero));
PS(`Add-Type -AssemblyName System.Drawing; $b = New-Object System.Drawing.Bitmap(2560, 1500); $g = [System.Drawing.Graphics]::FromImage($b); $g.CopyFromScreen(0, 0, 0, 0, $b.Size); $b.Save('${SHOTS + E}ux3-hero-doc.png'); $g.Dispose(); $b.Dispose()`);

// Esc 收起 → 深色模式 md 阅读面板
await ov.ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
await sleep(600);
await line.call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
await ov.call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
await line.ev(`(() => { const f = [...document.querySelectorAll('.slot')].find(x => { const n = x.querySelector('.doc-name'); return n && n.textContent.indexOf('方案') >= 0; }); if (f) f.querySelector('.doc-face').dispatchEvent(new MouseEvent('mouseover', { bubbles: true })); return !!f; })()`);
await sleep(2200);
const dark = await ov.ev(`(() => { const p = document.querySelector('.doc-peek .docr-body'); return p ? getComputedStyle(p).backgroundColor + ' | rich=' + !!p.querySelector('.docr-md') : 'no panel'; })()`);
console.log('dark reader:', dark);
PS(`Add-Type -AssemblyName System.Drawing; $b = New-Object System.Drawing.Bitmap(2560, 1500); $g = [System.Drawing.Graphics]::FromImage($b); $g.CopyFromScreen(0, 0, 0, 0, $b.Size); $b.Save('${SHOTS + E}ux4-dark-reader.png'); $g.Dispose(); $b.Dispose()`);

// 恢复浅色 + 清理背景样式
await line.call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
await ov.call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
await ov.ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
await line.ev(`(() => { document.querySelectorAll('#__herobg').forEach(n => n.remove()); return true; })()`);
console.log('round3 captures done');
process.exit(0);
