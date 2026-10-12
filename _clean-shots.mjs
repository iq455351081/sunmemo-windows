'use strict';
// Clean README assets: inject a sky gradient into the line page, capturePage
// (no desktop bleed-through), hover a real photo via CDP Input, capture ×3.
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs';
const E = String.fromCharCode(92);
const APP = ['E:', 'Agentic_Engineering', 'ZCode', 'sunidea'].join(E);
const DOCS = APP + E + '_docs';

const t = async () => (await (await fetch('http://127.0.0.1:9222/json/list')).json()).filter(x => x.type === 'page');
const lt = (await t()).find(x => x.url.includes('line.html'));
if (!lt) { console.log('NO LINE'); process.exit(1); }
const ws = new WebSocket(lt.webSocketDebuggerUrl);
await new Promise(r => { ws.onopen = r; });
let mid = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const call = (m, p = {}) => new Promise(res => { const id = ++mid; pend.set(id, res); ws.send(JSON.stringify({ id, method: m, params: p })); });
const ev = async x => { const r = await call('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) return 'EXC ' + String(r.exceptionDetails.exception && r.exceptionDetails.exception.description || '').slice(0, 200); return r.result && r.result.result && r.result.result.value; };
const shot = async () => { const r = await call('Page.captureScreenshot', { format: 'png' }); const d = r && r.result && r.result.data; if (!d) throw new Error('capture failed: ' + JSON.stringify(r).slice(0, 160)); return Buffer.from(d, 'base64'); };
await call('Runtime.enable');
await call('Page.enable');

// 展开钉住 + 天空渐变背景（截图后移除）
let rev = await ev(`document.getElementById('stage').classList.contains('revealed')`);
if (!rev) { await ev(`window.sun.send('line:toggle-userpin')`); await sleep(800); }
await ev(`(() => { const st = document.createElement('style'); st.id = '__herobg'; st.textContent = '#stage { background: linear-gradient(180deg, #b5e3fb 0%, #e3f4fe 46%, #fdf3e4 78%, #fbe7cf 100%) !important; }'; document.head.appendChild(st); return true; })()`);
await sleep(400);

// 找真实照片（thumb 尺寸 ≥ 1200 宽的原图 → 卡片较大）；选 DOM 里最后一张真实照片
const target = await ev(`(() => {
  const slots = [...document.querySelectorAll('.slot')].filter(x => x.querySelector('.photo-clip'));
  const s = slots[slots.length - 1];
  const r = s.querySelector('.photo-clip').getBoundingClientRect();
  return { cx: Math.round(r.left + r.width / 2), cy: Math.round(r.top + r.height / 2) };
})()`);
console.log('target:', JSON.stringify(target));

const bufNormal = await shot();
await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: target.cx, y: target.cy });
await sleep(750);
const hov = await ev(`(() => { const clips = [...document.querySelectorAll('.photo-clip')]; const s = clips[clips.length - 1].closest('.slot'); const m = getComputedStyle(s.querySelector('.photo-clip')).transform.match(/matrix\\(([-\\d.]+)/); return { hover: s.classList.contains('hover'), v: m ? parseFloat(m[1]) : null }; })()`);
console.log('hover:', JSON.stringify(hov));
const bufHover = await shot();
const bufWide = bufNormal; // 条带全景 = 未悬停态整窗
await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 10, y: 10 });
await sleep(500);
await ev(`(() => { document.querySelectorAll('#__herobg').forEach(n => n.remove()); return true; })()`);

fs.writeFileSync(DOCS + E + 'rope-clean.png', bufWide);
fs.writeFileSync(APP + E + '_shots' + E + 'real-before.png', bufNormal);
fs.writeFileSync(APP + E + '_shots' + E + 'real-hover.png', bufHover);
console.log('captures saved', bufWide.length, bufNormal.length, bufHover.length);
process.exit(0);
