'use strict';
// Ports of ClipboardWatcher.swift + ScreenshotWatcher.swift, adapted to
// Windows: Win+Shift+S / Snipping Tool land on the clipboard, PrintScreen
// lands in %USERPROFILE%\Pictures\Screenshots, and some tools drop files on
// the Desktop. We watch the clipboard plus those folders.

const fs = require('fs');
const path = require('path');
const os = require('os');
const { clipboard, nativeImage } = require('electron');

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.heic', '.tif', '.tiff', '.gif', '.webp', '.bmp']);
const SHOT_NAME = /(screenshot|screen ?shot|snip|capture|屏幕截图|截图|屏幕捕捉|捕捉)/i;

class Watchers {
  constructor({ shotsFolder, onHangImage, onPrune }) {
    this.shotsFolder = shotsFolder;
    this.onHangImage = onHangImage;
    this.onPrune = onPrune;
    this.clipTimer = null;
    this.lastImageMark = '';
    this.folderWatchers = [];
    this.known = new Map(); // dir -> Set(files)
  }

  // ---- clipboard -----------------------------------------------------------

  startClipboard() {
    if (this.clipTimer) return;
    this.clipTimer = setInterval(() => this.pollClipboard(), 400);
  }

  stopClipboard() {
    clearInterval(this.clipTimer);
    this.clipTimer = null;
  }

  pollClipboard() {
    // Only reacts when auto-hang is enabled (防误触 default off, like the original).
    if (!this.autoHang) return;
    // Cheap fingerprint first: availableFormats is a lightweight query, while
    // readImage() decodes the whole bitmap and was burning a core at 2.5Hz.
    const fmts = clipboard.availableFormats().join(',');
    if (fmts === this._lastPollFmts) return;
    this._lastPollFmts = fmts;
    const formats = clipboard.availableFormats();
    const hasImage = formats.some(f => f.startsWith('image/'));
    if (!hasImage) return;
    // Web copies carry an HTML flavour next to the image — skip them.
    if (formats.includes('text/html')) return;
    const img = clipboard.readImage();
    if (img.isEmpty()) return;
    const mark = img.toDataURL().slice(-64);
    if (mark === this.lastImageMark) return;
    this.lastImageMark = mark;
    const file = this.quickShotPath();
    fs.writeFileSync(file, img.toPNG());
    this.onHangImage(file, { flying: false });
  }

  quickShotPath() {
    fs.mkdirSync(this.shotsFolder, { recursive: true });
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    return path.join(this.shotsFolder, `QuickShot_${stamp}_${100 + Math.floor(Math.random() * 900)}.png`);
  }

  // Ctrl+Alt+V / tray / button — hang whatever is on the clipboard right now.
  hangCurrentClipboard(store) {
    const formats = clipboard.availableFormats();
    // 1. Image first.
    const hasImage = formats.some(f => f.startsWith('image/'));
    if (hasImage) {
      const img = clipboard.readImage();
      if (!img.isEmpty()) {
        const file = this.quickShotPath();
        try { fs.writeFileSync(file, img.toPNG()); } catch { return false; }
        this.onHangImage(file, { flying: true });
        return true;
      }
    }
    // 2. Text becomes a memo.
    const text = clipboard.readText();
    if (text && text.trim()) {
      const id = store.addMemo({ text, source: 'clipboard' });
      return !!id;
    }
    return false;
  }

  // ---- screenshot folders -----------------------------------------------------

  startFolders(extraDirs = []) {
    const dirs = [...new Set([
      path.join(os.homedir(), 'Desktop'),
      path.join(os.homedir(), 'Pictures', 'Screenshots'),
      this.shotsFolder,
      ...extraDirs,
    ])].filter(d => { try { fs.mkdirSync(d, { recursive: true }); return true; } catch { return false; } });

    // Anything already on disk when we launch is "known" — only new files count.
    for (const dir of dirs) {
      let files = [];
      try { files = fs.readdirSync(dir); } catch { continue; }
      this.known.set(dir, new Set(files));
      this.watchDir(dir);
    }
  }

  // fs.watch handles die when a folder is removed/recreated (or on transient
  // errors); rebuild them so new screenshots keep hanging.
  watchDir(dir, retried = 0) {
    try {
      const w = fs.watch(dir, { persistent: false }, () => this.scanDir(dir));
      w.on('error', () => {
        try { w.close(); } catch { /* already closed */ }
        if (retried < 5) {
          setTimeout(() => {
            try { fs.mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
            this.watchDir(dir, retried + 1);
          }, 5000);
        }
      });
      this.folderWatchers.push(w);
    } catch {
      if (retried < 5) setTimeout(() => this.watchDir(dir, retried + 1), 5000);
    }
  }

  stopFolders() {
    this.folderWatchers.forEach(w => { try { w.close(); } catch { /* ignore */ } });
    this.folderWatchers = [];
  }

  scanDir(dir) {
    clearTimeout(this._scanTimer);
    // Writers rename temp files into place; give them a moment (same as the original).
    this._scanTimer = setTimeout(() => {
      let files = [];
      try { files = fs.readdirSync(dir); } catch { return; }
      const prev = this.known.get(dir) || new Set();
      for (const f of files) {
        if (prev.has(f)) continue;
        const full = path.join(dir, f);
        if (!this.isCandidate(dir, full)) continue;
        // Wait until the file is fully written.
        this.waitForFile(full).then(ok => { if (ok) this.onHangImage(full, { flying: false }); });
      }
      this.known.set(dir, new Set(files));
      if (this.onPrune) this.onPrune();
    }, 250);
  }

  waitForFile(file, tries = 10) {
    return new Promise(resolve => {
      let n = 0, last = -1;
      const tick = () => {
        let size = -1;
        try { size = fs.statSync(file).size; } catch { /* gone */ }
        if (size > 0 && size === last) return resolve(true);
        last = size;
        if (++n >= tries) return resolve(false);
        setTimeout(tick, 150);
      };
      tick();
    });
  }

  isCandidate(dir, full) {
    const ext = path.extname(full).toLowerCase();
    if (!IMAGE_EXT.has(ext)) return false;
    if (dir === this.shotsFolder) return true; // dedicated folder: any image counts
    return SHOT_NAME.test(path.basename(full));
  }
}

module.exports = { Watchers };
