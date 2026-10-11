// R97b: re-verify the R96 features still hold with the deterministic default
// (explicit hot-zone d must still win), then park the cursor on primary.
import { execSync } from 'node:child_process';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const moveTo = (x, y) => execSync(
  'powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(' + x + ', ' + y + ')"'
);
async function pagePos(match) {
  const ts = await (await fetch('http://127.0.0.1:9222/json/list')).json();
  const t = ts.filter(x => x.type === 'page').find(x => x.url.includes(match));
  if (!t) return null;
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  const out = await new Promise((res) => {
    let id = 0; const pend = new Map();
    ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
    const i = ++id; pend.set(i, res);
    ws.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression: '({ x: window.screenX, y: window.screenY })', returnByValue: true } }));
  });
  ws.close();
  return out.result && out.result.result && out.result.result.value;
}
(async () => {
  // 1) cold line window must be on PRIMARY despite cursor parked on secondary
  await moveTo(900, -900);
  await sleep(800);
  const line1 = await pagePos('line.html');
  console.log('cold line window:', JSON.stringify(line1), line1 && line1.y === 0 ? 'PASS deterministic primary' : 'FAIL');
  // 2) hot-zone reveal on secondary still lands there (explicit d path)
  for (let k = 0; k < 8; k++) { await moveTo(800, -1440); await sleep(200); }
  await sleep(1600);
  const line2 = await pagePos('line.html');
  console.log('after hot-zone reveal:', JSON.stringify(line2), line2 && line2.y < -1000 ? 'PASS per-display hot zone' : 'FAIL');
  // 3) tuck, beacon must wait on secondary
  await moveTo(1300, 900);
  await sleep(4500);
  const beacon = await pagePos('beacon.html');
  console.log('beacon:', JSON.stringify(beacon), beacon && beacon.y < -1000 ? 'PASS beacon follows' : 'INFO beacon elsewhere');
  // 4) park cursor on primary for subsequent E2E
  await moveTo(1280, 500);
  process.exit(0);
})();
