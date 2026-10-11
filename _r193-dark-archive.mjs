// R193: dark-mode screenshot archive for search/memo/stats windows
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const E = String.fromCharCode(92);
const exe = ['E:', 'Agentic_Engineering', 'ZCode', 'sunidea', 'node_modules', 'electron', 'dist', 'electron.exe'].join(E);
const app = ['E:', 'Agentic_Engineering', 'ZCode', 'sunidea'].join(E);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const poke = flag => execSync(`powershell -NoProfile -Command "Start-Process -FilePath '${exe}' -ArgumentList @('${app}','${flag}') -WindowStyle Hidden"`);
async function snap(file, setup, out) {
  const ts = await (await fetch('http://127.0.0.1:9222/json/list')).json();
  const t = ts.filter(x => x.type === 'page' && x.url.includes(file)).pop();
  if (!t) return file + ': MISSING';
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  const call = (method, params = {}) => new Promise(res => { const i = 500 + Math.floor(Math.random() * 400); ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id === i) res(m); }; ws.send(JSON.stringify({ id: i, method, params })); });
  if (setup) await call('Runtime.evaluate', { expression: setup, returnByValue: true });
  await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await sleep(350);
  const shot = await call('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.resolve('_shots/archive', out), Buffer.from(shot.result.data, 'base64'));
  ws.close();
  return out + ' saved';
}
poke('--search'); await sleep(3000);
console.log(await snap('search.html', `(() => { const q = document.getElementById('q'); q.value = '晒'; q.dispatchEvent(new Event('input')); return 1; })()`, 'r193-dark-search.png'));
poke('--open=memo'); await sleep(3000);
console.log(await snap('memo.html', `(() => { const e = document.getElementById('editor'); e.value = '# 深色样张\\n- [ ] 清单\\n- [x] 完成'; e.dispatchEvent(new Event('input')); return 1; })()`, 'r193-dark-memo.png'));
execSync(`powershell -NoProfile -Command "& 'E:${E}Agentic_Engineering${E}ZCode${E}sunidea${E}scripts-app.ps1' -Action restart -Args '--demo --open=stats'"`, { stdio: 'ignore' });
await sleep(9000);
console.log(await snap('stats.html', null, 'r193-dark-stats.png'));
process.exit(0);
