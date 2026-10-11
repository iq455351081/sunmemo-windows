'use strict';
/* R158: memory baseline — attach-only CDP probe (app exposes 9222).
 * For line / overlay / search pages: sample performance.memory.usedJSHeapSize
 * 3x, average, and write a JSON report to _shots/archive/mem-baseline.json.
 * Pure diagnostics — not wired into any gate. Usage: node tools/mem-baseline.mjs */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(APP, '_shots', 'archive', 'mem-baseline.json');
const PAGES = ['line.html', 'overlay.html', 'search.html'];
const SAMPLES = 3;
const GAP_MS = 250;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const targets = async () => (await (await fetch('http://127.0.0.1:9222/json/list')).json()).filter(t => t.type === 'page');

async function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws fail')); });
  let id = 0; const pend = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id; pend.set(i, m => m.error ? rej(new Error(m.error.message)) : res(m.result));
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  return { send, close: () => ws.close() };
}

const samplePage = async t => {
  const c = await cdp(t.webSocketDebuggerUrl);
  try {
    await c.send('Runtime.enable');
    const vals = [];
    for (let i = 0; i < SAMPLES; i++) {
      const r = await c.send('Runtime.evaluate', { expression: 'performance.memory.usedJSHeapSize', returnByValue: true });
      if (r.exceptionDetails || typeof r.result?.value !== 'number') throw new Error('eval failed');
      vals.push(r.result.value);
      if (i < SAMPLES - 1) await sleep(GAP_MS);
    }
    const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    return { title: t.title, url: t.url, samples: vals, avgBytes: avg, avgMB: +(avg / 1048576).toFixed(2) };
  } finally { c.close(); }
};

const run = async () => {
  const report = { timestamp: new Date().toISOString(), metric: 'performance.memory.usedJSHeapSize', samples: SAMPLES, pages: {} };
  const list = await targets();
  for (const p of PAGES) {
    const t = list.filter(x => x.url.includes(p)).pop();
    try {
      if (!t) throw new Error('target not found (is the app running with CDP on 9222?)');
      report.pages[p] = await samplePage(t);
      console.log(`${p}: ${report.pages[p].avgMB} MB (avg of ${SAMPLES})`);
    } catch (e) {
      report.pages[p] = { error: String(e.message || e) };
      console.log(`${p}: ERROR ${e.message}`);
    }
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log('report ->', OUT);
};

run().catch(e => { console.error('mem-baseline failed:', e.message); process.exit(1); });
