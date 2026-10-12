// v1.4.1 验证: 悬停图片 → 光标锚定放大 2.2x（数值断言）+ 溢出可见
import fs from 'node:fs';
import path from 'node:path';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ts0 = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const line = ts0.filter(t => t.type === 'page' && t.url.includes('line.html')).pop();
const ws = new WebSocket(line.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const evL = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) return 'EXC'; return r.result.result.value; };
let revealed = await evL(`document.getElementById('stage').classList.contains('revealed')`);
if (!revealed) { await evL(`window.sun.send('line:toggle-userpin')`); await new Promise(r => setTimeout(r, 700)); }
const pt = await evL(`(() => { const s = [...document.querySelectorAll('.slot')].find(x => x.querySelector('.photo-clip')); const c = s.querySelector('.photo-clip').getBoundingClientRect(); return { x: Math.round(c.left + c.width/2), y: Math.round(c.top + c.height/2) }; })()`);
await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pt.x, y: pt.y });
await sleep(300);
for (const type of ['mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x: pt.x, y: pt.y, button: 'left', clickCount: 1 });
await sleep(1300);
const ts2 = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const ov = ts2.filter(t => t.type === 'page' && t.url.includes('overlay.html')).pop();
if (!ov) { console.log('v1.4.1 FAIL: preview not open'); process.exit(1); }
const ws2 = new WebSocket(ov.webSocketDebuggerUrl);
await new Promise(r => ws2.onopen = r);
let i2 = 0; const pend2 = new Map();
ws2.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend2.has(m.id)) { pend2.get(m.id)(m); pend2.delete(m.id); } };
const send2 = (method, params) => new Promise(res => { const i = ++i2; pend2.set(i, res); ws2.send(JSON.stringify({ id: i, method, params })); });
const evO = async expression => { const r = await send2('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) return 'EXC: ' + (r.exceptionDetails.exception?.description || '').slice(0, 120); return r.result.result.value; };
// 光标移到图片中心 → 悬停放大 2.2x
const c = await evO(`(() => { const i = document.querySelector('.photo-area img'); const r = i.getBoundingClientRect(); return { x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) }; })()`);
await send2('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.x, y: c.y });
await new Promise(r => setTimeout(r, 1000));
const scale = await evO(`(() => { const i = document.querySelector('.photo-area img'); const m = getComputedStyle(i).transform.match(/matrix\\(([-\\d.]+)\\)/); return m ? parseFloat(m[1]) : null; })()`);
const overflow = await evO(`getComputedStyle(document.querySelector('.photo-area')).overflow`);
console.log('v1.4.1 悬停放大: scale =', scale, scale >= 2.1 ? 'PASS 2.2x' : 'FAIL', '| photo-area overflow =', overflow, overflow === 'visible' ? 'PASS 自由溢出' : 'FAIL');
process.exit(0);
