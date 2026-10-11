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

// beacon visibility is managed by the main process (show/hide of this window)
