// 截图套件：采集 README 所需的全部界面图（浅色为主 + 深色样张）
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const E = String.fromCharCode(92);
const exe = ['E:', 'Agentic_Engineering', 'ZCode', 'sunidea', 'node_modules', 'electron', 'dist', 'electron.exe'].join(E);
const app = ['E:', 'Agentic_Engineering', 'ZCode', 'sunidea'].join(E);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const sh = cmd => execSync(cmd, { stdio: 'ignore' });
const restart = args => sh(`powershell -NoProfile -Command "& 'E:${E}Agentic_Engineering${E}ZCode${E}sunidea${E}scripts-app.ps1' -Action restart -Args '${args}'"`);
const poke = flag => sh(`powershell -NoProfile -Command "Start-Process -FilePath '${exe}' -ArgumentList @('${app}','${flag}') -WindowStyle Hidden"`);
const targets = async () => (await (await fetch('http://127.0.0.1:9222/json/list')).json()).filter(t => t.type === 'page');
async function cdp(url) {
  const ws = new WebSocket(url);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws')); });
  let i = 700; const pend = new Map();
  ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } });
  return {
    eval: async expr => { const m = await call('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }); if (m.exceptionDetails) throw new Error(m.exceptionDetails.exception?.description?.slice(0, 100)); return m.result.value; },
    shot: async out => { const m = await call('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.resolve('docs', 'img', out), Buffer.from(m.result.data, 'base64')); return out; },
    dark: async () => { await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] }); await sleep(350); },
    close: () => ws.close(),
  };
  async function call(method, params) { const k = ++i; return new Promise(res => { ws.addEventListener('message', function h(e) { const m = JSON.parse(e.data); if (m.id === k) { ws.removeEventListener('message', h); res(m); } }); ws.send(JSON.stringify({ id: k, method, params })); }); }
}
fs.mkdirSync(path.resolve('docs', 'img'), { recursive: true });
const IMG = p => path.resolve('docs', 'img', p);

// 1) 浅色主套图：--demo --shots 生成 5 张基础图
sh(`powershell -NoProfile -Command "& 'E:${E}Agentic_Engineering${E}ZCode${E}sunidea${E}scripts-app.ps1' -Action stop"`);
sh(`powershell -NoProfile -Command "& 'E:${E}Agentic_Engineering${E}ZCode${E}sunidea${E}scripts-app.ps1' -Action start -Args '--demo --shots'"`);
await sleep(16000);
console.log('base shots done');

// 2) 统计窗（浅+深）
restart('--demo --open=stats'); await sleep(9000);
let t = (await targets()).find(x => x.url.includes('stats.html'));
if (t) { const w = await cdp(t.webSocketDebuggerUrl); await w.shot('stats.png'); await w.dark(); await w.shot('stats-dark.png'); w.close(); console.log('stats done'); }

// 3) 贴桌便签（撕一张到桌面）
restart('--demo'); await sleep(9000);
t = (await targets()).find(x => x.url.includes('line.html'));
let stickyT = null;
if (t) {
  const w = await cdp(t.webSocketDebuggerUrl);
  const id = await w.eval(`window.sun.invoke('line:get-state').then(s => s.items.find(i => i.kind === 'memo').id)`);
  await w.eval(`window.sun.send('line:tear-to-desktop', { id: '${id}', x: 900, y: 500 })`);
  await sleep(1800);
  stickyT = (await targets()).find(x => x.url.includes('sticky.html'));
  // 绳上部分也截图（此时绳仍展开）
  await w.shot('line-revealed.png');
  w.close();
}
if (stickyT) { const w2 = await cdp(stickyT.webSocketDebuggerUrl); await sleep(400); await w2.shot('sticky.png'); w2.close(); console.log('sticky done'); }

// 4) 深色：搜索 + 统计已采，补搜索深色
poke('--search'); await sleep(3000);
t = (await targets()).find(x => x.url.includes('search.html'));
if (t) { const w = await cdp(t.webSocketDebuggerUrl); await w.dark(); await w.shot('search-dark.png'); w.close(); console.log('search-dark done'); }

process.exit(0);
