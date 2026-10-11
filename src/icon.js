'use strict';
// Asset generation WITHOUT any renderer windows — pure Node PNG drawing
// (src/png-icon.js). The previous capturePage-based generator crashed the
// offscreen renderer on GPUs with unstable init, which silently killed the
// whole boot sequence (no tray, no hotkeys, no IPC).

const fs = require('fs');
const path = require('path');
const { makeIconPNG, makeDemoShotPNG } = require('./png-icon');
const { BrowserWindow } = require('electron');

// Richer canvas-drawn icon (sun glow, pegs). Only attempted in the
// background once the app is settled — never allowed to break the boot.
const CANVAS_ICON_HTML = `<!doctype html><html><body style="margin:0"><canvas id="c" width="256" height="256"></canvas>
<script>
function rr(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
const c=document.getElementById('c'),ctx=c.getContext('2d');
const g=ctx.createLinearGradient(40,256-40,256-40,40);
g.addColorStop(0,'rgb(255,175,75)');g.addColorStop(.52,'rgb(255,120,110)');g.addColorStop(1,'rgb(135,140,245)');
rr(ctx,19,19,218,218,48);ctx.fillStyle=g;ctx.fill();
const s=ctx.createRadialGradient(185,75,0,185,75,70);
s.addColorStop(0,'rgba(255,255,220,0.75)');s.addColorStop(.45,'rgba(255,230,120,0.25)');s.addColorStop(1,'rgba(255,255,255,0)');
ctx.fillStyle=s;ctx.fillRect(19,19,218,218);
ctx.strokeStyle='rgb(90,80,110)';ctx.lineWidth=3;ctx.lineCap='round';
ctx.beginPath();ctx.moveTo(15,180);ctx.quadraticCurveTo(128,152,241,180);ctx.stroke();
function card(x,y,w,h,c1,c2){const cg=ctx.createLinearGradient(0,y,0,y+h);cg.addColorStop(0,c1);cg.addColorStop(1,c2);
rr(ctx,x,y,w,h,6);ctx.fillStyle=cg;ctx.fill();ctx.strokeStyle='rgba(0,0,0,0.1)';ctx.lineWidth=0.8;ctx.stroke();}
function pin(x,y){const mg=ctx.createLinearGradient(x-2.5,y,x+2.5,y);
mg.addColorStop(0,'rgb(178,178,178)');mg.addColorStop(.35,'rgb(237,237,237)');mg.addColorStop(.65,'rgb(209,209,209)');mg.addColorStop(1,'rgb(158,158,158)');
rr(ctx,x-2.5,y,5,14.5,2);ctx.fillStyle=mg;ctx.fill();}
card(48,176,65,52,'#fff4b8','#f5e090');
ctx.strokeStyle='rgba(60,60,60,0.7)';ctx.lineWidth=2;ctx.strokeRect(57,186,5.5,5.5);ctx.strokeRect(57,200,5.5,5.5);
ctx.strokeStyle='rgba(60,60,60,0.55)';ctx.beginPath();ctx.moveTo(68,188);ctx.lineTo(98,188);ctx.moveTo(68,202);ctx.lineTo(94,202);ctx.stroke();
card(150,180,60,48,'#c8e4ff','#aad4fb');
ctx.strokeStyle='rgba(50,60,90,0.55)';ctx.beginPath();ctx.moveTo(160,194);ctx.lineTo(196,194);ctx.moveTo(160,206);ctx.lineTo(190,206);ctx.stroke();
pin(97,163);pin(180,164);
</script></body></html>`;

async function canvasIconPNG() {
  const win = new BrowserWindow({
    x: -20000, y: -20000, width: 256, height: 256, show: false, frame: false,
    webPreferences: { offscreen: true },
  });
  try {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(CANVAS_ICON_HTML));
    await new Promise(r => setTimeout(r, 200));
    const image = await win.webContents.capturePage({ x: 0, y: 0, width: 256, height: 256 });
    return image.toPNG();
  } finally { win.destroy(); }
}

async function ensureAssets(userData) {
  const iconPath = path.join(userData, 'icon.png');
  const shotPath = path.join(userData, 'demo-shot.png');

  let iconPng = null;
  try { iconPng = fs.readFileSync(iconPath); } catch { /* generate */ }
  if (!iconPng || iconPng.length < 1000) {
    iconPng = makeIconPNG(256);
    try { fs.writeFileSync(iconPath, iconPng); } catch { /* ignore */ }
  }

  let shotPng = null;
  try { shotPng = fs.readFileSync(shotPath); } catch { /* generate */ }
  if (!shotPng || shotPng.length < 1000) {
    shotPng = makeDemoShotPNG(960, 600);
    try { fs.writeFileSync(shotPath, shotPng); } catch { /* ignore */ }
  }

  const { nativeImage } = require('electron');
  const full = nativeImage.createFromBuffer(iconPng);
  const out = {
    iconPath,
    icon16: full.resize({ width: 16, height: 16 }),
    icon32: full.resize({ width: 32, height: 32 }),
    icon256: full,
    demoShotPath: shotPath,
  };
  // R+ background upgrade: try the richer canvas icon once the app is busy
  // doing real work; on ANY failure keep the pure-Node fallback.
  setTimeout(async () => {
    try {
      const rich = await canvasIconPNG();
      if (rich && rich.length > 1000) {
        fs.writeFileSync(iconPath, rich);
        const upd = nativeImage.createFromBuffer(rich);
        out.icon16 = upd.resize({ width: 16, height: 16 });
        out.icon32 = upd.resize({ width: 32, height: 32 });
      }
    } catch { /* keep fallback */ }
  }, 20000);
  return out;
}

module.exports = { ensureAssets };
