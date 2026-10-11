'use strict';
// Memo → PNG export. Electron's nativeImage has no text rendering, so we
// paint the card with an invisible offscreen BrowserWindow (inline data: HTML
// matching the card visuals), capturePage() it once, and tear the window down.
// One window per export — no reuse, nothing lingers.

const { BrowserWindow } = require('electron');

// Known card gradients (CARD_BG port + grape from sticky.css).
const GRADS = {
  yellow: ['#fff6ba', '#fae894'],
  green:  ['#e0f7e0', '#d1edd1'],
  pink:   ['#ffe6ed', '#fad4e0'],
  blue:   ['#e0f0ff', '#cce3fa'],
  grape:  ['#f4f0fd', '#ece6fb'],
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function buildHtml(text, color) {
  const [a, b] = GRADS[color] || GRADS.yellow;
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(
    '<!doctype html><html><head><meta charset="utf-8"><style>' +
    '*{margin:0;box-sizing:border-box}html,body{width:100%;height:100%}' +
    'body{background:linear-gradient(180deg,' + a + ',' + b + ');padding:24px;' +
    'font-family:"Segoe UI","Microsoft YaHei",sans-serif}' +
    '.card{width:100%;height:100%;background:#fff;border-radius:8px;' +
    'padding:20px 22px;color:#3a3325;font-size:17px;line-height:1.5;' +
    'white-space:pre-wrap;word-break:break-word;overflow:hidden;' +
    'box-shadow:0 2px 10px rgba(0,0,0,.10)}' +
    '</style></head><body><div class="card">' + escapeHtml(text) + '</div></body></html>'
  );
}

// Render a memo to a PNG buffer. ratio ('wide'|'square'|'tall') sets the
// minimum canvas height so exported shapes echo the card's aspect; the actual
// height still grows with the text.
async function renderMemoPng(text, color, { ratio = 'wide' } = {}) {
  const WIDTH = 520;
  const lines = String(text || '').split('\n');
  const minH = { wide: 280, square: 440, tall: 520 }[ratio] || 280;
  const height = Math.min(1400, Math.max(minH, lines.length * 26 + 110));
  const win = new BrowserWindow({
    width: WIDTH, height, show: false, frame: false,
    webPreferences: { offscreen: true },
  });
  try {
    await win.loadURL(buildHtml(text, color));
    try { await win.webContents.executeJavaScript('document.fonts ? document.fonts.ready.then(() => true) : true'); } catch { /* best effort */ }
    let img = await win.webContents.capturePage();
    if (img.isEmpty()) { // first frame occasionally not painted yet
      await new Promise(r => setTimeout(r, 120));
      img = await win.webContents.capturePage();
    }
    return img.toPNG();
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

module.exports = { renderMemoPng };
