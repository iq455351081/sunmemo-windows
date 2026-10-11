// R97c: instrument the hot-zone reveal — state + position at each step
import { execSync } from 'node:child_process';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const moveTo = (x, y) => execSync(
  'powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(' + x + ', ' + y + ')"'
);
async function lineInfo() {
  const ts = await (await fetch('http://127.0.0.1:9222/json/list')).json();
  const t = ts.filter(x => x.type === 'page').find(x => x.url.includes('line.html'));
  if (!t) return null;
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  const out = await new Promise((res) => {
    let id = 0; const pend = new Map();
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
    const i = ++id; pend.set(i, res);
    ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: 'window.sun.invoke(\'line:get-state\').then(s => ({ revealed: s.revealed, x: window.screenX, y: window.screenY }))', returnByValue: true, awaitPromise: true } }));
  });
  ws.close();
  return out.result && out.result.result && out.result.result.value;
}
(async () => {
  await moveTo(1300, 900);
  await sleep(4000);
  console.log('parked:', JSON.stringify(await lineInfo()));
  await moveTo(800, -1440);
  await sleep(300);
  await moveTo(800, -1439);
  console.log('at edge t+0.3s:', JSON.stringify(await lineInfo()));
  await sleep(1200);
  console.log('at edge t+1.5s:', JSON.stringify(await lineInfo()));
  await sleep(1500);
  console.log('at edge t+3.0s:', JSON.stringify(await lineInfo()));
  await moveTo(1300, 900);
  process.exit(0);
})();
