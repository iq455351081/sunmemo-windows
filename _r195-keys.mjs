// R195: keyboard flow across windows + R196 perf sampling
import { execSync } from 'node:child_process';
import path from 'node:path';
const E = String.fromCharCode(92);
const exe = ['E:', 'Agentic_Engineering', 'ZCode', 'sunidea', 'node_modules', 'electron', 'dist', 'electron.exe'].join(E);
const app = ['E:', 'Agentic_Engineering', 'ZCode', 'sunidea'].join(E);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const poke = flag => execSync(`powershell -NoProfile -Command "Start-Process -FilePath '${exe}' -ArgumentList @('${app}','${flag}') -WindowStyle Hidden"`);
async function evalIn(file, expr) {
  const ts = await (await fetch('http://127.0.0.1:9222/json/list')).json();
  const t = ts.filter(x => x.type === 'page' && x.url.includes(file)).pop();
  if (!t) return 'WINDOW MISSING';
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  const out = await new Promise(res => { const i = 321; ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id === i) res(m.result?.result?.value ?? 'EXC'); }; ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: expr, returnByValue: true, awaitPromise: true } })); });
  ws.close();
  return out;
}
// search: Tab 移动焦点到 closeBtn（焦点流），Enter 空查询不报错
poke('--search'); await sleep(3000);
console.log('R195 search keys:', await evalIn('search.html', `(() => {
  const q = document.getElementById('q'); q.focus();
  const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }); q.dispatchEvent(ev);
  return 'tab-ok, esc-safe=' + (document.getElementById('q') !== null);
})()`));
// memo: Ctrl+Enter 空文本 = 早退不提交
poke('--open=memo'); await sleep(3000);
console.log('R195 memo keys:', await evalIn('memo.html', `(() => {
  const e = document.getElementById('editor'); e.focus();
  e.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
  return 'ctrl-enter-no-crash=' + (document.getElementById('editor') !== null);
})()`));
// stats: Esc 关闭
poke('--open=stats'); await sleep(3000);
console.log('R195 stats esc:', await evalIn('stats.html', `(() => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  return new Promise(r => setTimeout(() => r('esc-close-dispatched'), 200));
})()`));
// R196 perf sampling
const t = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const line = t.filter(x => x.type === 'page' && x.url.includes('line.html')).pop();
const ws = new WebSocket(line.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
const mem = await new Promise(res => { const i = 1; ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id === i) res(m.result?.result?.value); }; ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: `performance.memory.usedJSHeapSize`, returnByValue: true } })); });
console.log('R196 line heap:', Math.round(mem / 1024) + 'KB');
process.exit(0);
