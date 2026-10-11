'use strict';
// Pure-Node PNG generation for the app icon / demo shot — NO offscreen
// renderer windows. The old approach (capturePage on a hidden window) crashed
// the renderer process on machines with unstable GPU init, which silently
// aborted the entire boot (no tray, no hotkeys, no IPC).

const zlib = require('zlib');

// ---- minimal PNG encoder (RGBA, no filtering) ------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePNG(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0; // filter none
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---- helpers ----------------------------------------------------------------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => a + (b - a) * t;
function roundedRectSDF(x, y, cx, cy, hw, hh, r) {
  const dx = Math.abs(x - cx) - (hw - r);
  const dy = Math.abs(y - cy) - (hh - r);
  const ox = Math.max(dx, 0), oy = Math.max(dy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(dx, dy), 0) - r;
}
function quadY(t, y0, y1, cy) {
  const u = 1 - t;
  return u * u * y0 + 2 * u * t * cy + t * t * y1;
}

// ---- app icon: sunrise squircle + clothesline + two pastel cards ------------
function makeIconPNG(size = 256) {
  const rgba = Buffer.alloc(size * size * 4);
  const m = size / 512; // design at 512, scale
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const fx = x / m, fy = y / m;
      const d = roundedRectSDF(fx, fy, 256, 256, 224, 224, 100);
      const alpha = clamp(0.5 - d, 0, 1) * 2;
      if (alpha <= 0) { rgba[i + 3] = 0; continue; }
      // sunrise gradient (angle ~ -65°)
      const t = clamp((fx + (512 - fy)) / (512 * 2), 0, 1);
      let r = mix(255, 135, t), g = mix(175, 140, t), b = mix(75, 245, t);
      if (t > 0.52) { const u = (t - 0.52) / 0.48; r = mix(255, 135, u); g = mix(120, 140, u); b = mix(110, 245, u); }
      else { const u = t / 0.52; r = mix(255, 255, u); g = mix(175, 120, u); b = mix(75, 110, u); }
      // sun glow top-right
      const sd = Math.hypot(fx - 380, fy - 140) / 150;
      const glow = clamp(1 - sd, 0, 1) * 0.5;
      r = mix(r, 255, glow); g = mix(g, 245, glow); b = mix(b, 200, glow);
      // rope (quad curve 30,360 → 482,360 ctrl 256,305), 6px wide
      const rt = clamp((fx - 30) / 452, 0, 1);
      const ry = quadY(rt, 360, 360, 300);
      if (Math.abs(fy - ry) < 4 && fx > 20 && fx < 492) { r = mix(r, 90, 0.75); g = mix(g, 80, 0.75); b = mix(b, 110, 0.75); }
      // cards: left yellow (95,352,130×105), right blue (300,362,120×96)
      function card(cx, cy, w, h, c1, c2, outline) {
        if (Math.abs(fx - cx) < w / 2 && Math.abs(fy - cy) < h / 2) {
          const tt = (fy - (cy - h / 2)) / h;
          const cr = mix(c1[0], c2[0], tt), cg = mix(c1[1], c2[1], tt), cb = mix(c1[2], c2[2], tt);
          return [cr, cg, cb];
        }
        return null;
      }
      let over = card(160, 404, 130, 105, [255, 244, 184], [245, 224, 144]);
      if (!over) over = card(360, 410, 120, 96, [200, 228, 255], [170, 212, 251]);
      if (over) { r = over[0]; g = over[1]; b = over[2]; }
      rgba[i] = clamp(r, 0, 255); rgba[i + 1] = clamp(g, 0, 255); rgba[i + 2] = clamp(b, 0, 255);
      rgba[i + 3] = Math.round(alpha * 255);
    }
  }
  return encodePNG(size, size, rgba);
}

// ---- demo screenshot: dashboard-ish placeholder ------------------------------
function makeDemoShotPNG(w = 960, h = 600) {
  const rgba = Buffer.alloc(w * h * 4);
  function rr(x, y, ww, hh, r) {
    return roundedRectSDF(x, y, x + ww / 2, y + hh / 2, ww / 2, hh / 2, r) <= 0;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let r = 223, g = 233, b = 245;
      if (rr(x, y, 80, 60, 800, 460, 14)) {
        r = 255; g = 255; b = 255;
        if (y < 104 && y > 60) { r = 232; g = 238; b = 246; }
        const cols = ['#ffd66b', '#a8e6a3', '#9cc8ff'];
        for (let c = 0; c < 3; c++) {
          const cx = 120 + c * 270, cy = 140;
          if (rr(x, y, cx, cy, 230, 340, 10)) {
            const cg = [[255, 214, 107], [168, 230, 163], [156, 200, 255]][c];
            r = cg[0]; g = cg[1]; b = cg[2];
            for (let j = 0; j < 3; j++) {
              if (rr(x, y, cx + 14, cy + 20 + j * 64, 202, 52, 8)) { r = 255; g = 255; b = 255; }
            }
          }
        }
      }
      rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
    }
  }
  return encodePNG(w, h, rgba);
}

module.exports = { makeIconPNG, makeDemoShotPNG };
