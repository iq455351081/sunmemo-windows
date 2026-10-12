'use strict';
// theme switching: beacon.html's @media (prefers-color-scheme: dark) blocks
// restyle the pill/border/label automatically — no matchMedia listener needed.
const api = window.sun;
// time-of-day hue, set once per load: dawn 5-10 / day 10-17 / dusk 17-20 / night 20-5
const hr = new Date().getHours();
document.body.classList.add(
  hr >= 5 && hr < 10 ? 'dawn' : hr >= 10 && hr < 17 ? 'day' : hr >= 17 && hr < 20 ? 'dusk' : 'night'
);
let hoverTimer = null;

function beaconPos() {
  const r = document.getElementById('beacon').getBoundingClientRect();
  return { fromX: Math.round(r.left + r.width / 2), fromY: Math.round(r.top + r.height / 2) };
}
document.getElementById('beacon').addEventListener('click', () => {
  try { api.send('beacon:click', beaconPos()); } catch { /* ignore */ }
});
// hover opens too (feels natural) — debounced so a passing cursor doesn't trigger
document.getElementById('beacon').addEventListener('mouseenter', () => {
  clearTimeout(hoverTimer);
  hoverTimer = setTimeout(() => { try { api.send('beacon:click', beaconPos()); } catch { /* ignore */ } }, 400);
});
document.getElementById('beacon').addEventListener('mouseleave', () => clearTimeout(hoverTimer));

// ---- v1.6 文档/图片拖到信标太阳上 = 直接挂绳（绳收起时的投递口） ------------
// 必须 preventDefault，否则 Electron 默认行为是整窗导航到被拖文件（信标报废）。
const pill = document.getElementById('beacon');
document.addEventListener('dragover', ev => {
  ev.preventDefault();
  if (ev.dataTransfer) {
    ev.dataTransfer.dropEffect = 'copy';
    ev.dataTransfer.effectAllowed = 'copy';
  }
  pill.classList.add('dropping');
  if (pill.querySelector('.label')) pill.querySelector('.label').textContent = '松手挂到绳上';
});
document.addEventListener('dragleave', ev => {
  if (!ev.relatedTarget) {
    pill.classList.remove('dropping');
    const l = pill.querySelector('.label');
    if (l) l.textContent = '晾衣绳';
  }
});
document.addEventListener('drop', ev => {
  ev.preventDefault();
  pill.classList.remove('dropping');
  const l = pill.querySelector('.label');
  if (l) l.textContent = '晾衣绳';
  const files = [...(ev.dataTransfer ? ev.dataTransfer.files : [])];
  const paths = files.map(f => { try { return api.getPathForFile(f); } catch { return null; } }).filter(Boolean);
  if (paths.length) api.send('beacon:drop-files', paths);
});

// beacon visibility is managed by the main process (show/hide of this window)
