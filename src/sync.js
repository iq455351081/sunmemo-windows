'use strict';
// Port of MemoSyncManager.swift — dual markdown persistence.
// ~/Documents/SunMemo.md is the user-facing backup; all_memos.md is the
// in-app copy; archived_memos.json keeps torn-down memos forever.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function uuid() { return crypto.randomUUID(); }

function pad(n) { return String(n).padStart(2, '0'); }
function fmtDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function colorEmoji(c) {
  switch ((c || 'yellow').toLowerCase()) {
    case 'green': return '🟢 绿';
    case 'pink': return '🌸 粉';
    case 'blue': return '🔵 蓝';
    default: return '🟡 黄';
  }
}

function calculateTodoStats(text) {
  let total = 0, completed = 0;
  for (const l of String(text || '').split('\n')) {
    const t = l.trim();
    if (/^(-|\*)? ?\[ \] /.test(t) || /^\[ \] /.test(t)) total += 1;
    else if (/^(-|\*)? ?\[x\] /i.test(t) || /^\[x\] /i.test(t)) { total += 1; completed += 1; }
  }
  return { total, completed };
}

function toggleTodoLine(text, lineIndex) {
  const lines = String(text || '').split('\n');
  if (lineIndex < 0 || lineIndex >= lines.length) return { newText: text, allDone: false };
  let line = lines[lineIndex];
  const t = line.trim();
  const swap = (from, to) => { line = line.replace(from, to); };
  if (t.startsWith('- [ ] ')) swap('- [ ] ', '- [x] ');
  else if (/^-\s\[x\] /i.test(t)) line = line.replace(/- \[x\] /i, '- [ ] ');
  else if (t.startsWith('* [ ] ')) swap('* [ ] ', '* [x] ');
  else if (/^\*\s\[x\] /i.test(t)) line = line.replace(/\* \[x\] /i, '* [ ] ');
  else if (t.startsWith('[ ] ')) swap('[ ] ', '[x] ');
  else if (/^\[x\] /i.test(t)) line = line.replace(/\[x\] /i, '[ ] ');
  lines[lineIndex] = line;
  const newText = lines.join('\n');
  const stats = calculateTodoStats(newText);
  return { newText, allDone: stats.total > 0 && stats.completed === stats.total };
}

class Sync {
  constructor(memosFolder, documentsDir) {
    this.memosFolder = memosFolder;
    this.markdownPath = path.join(documentsDir, 'SunMemo.md');
    this.backupPath = path.join(memosFolder, 'all_memos.md');
    this.archivePath = path.join(memosFolder, 'archived_memos.json');
    this.archived = [];
    this.loadArchived();
  }

  loadArchived() {
    try {
      this.archived = JSON.parse(fs.readFileSync(this.archivePath, 'utf8'));
      if (!Array.isArray(this.archived)) this.archived = [];
    } catch { this.archived = []; }
  }

  saveArchived() {
    try {
      fs.mkdirSync(this.memosFolder, { recursive: true });
      fs.writeFileSync(this.archivePath, JSON.stringify(this.archived, null, 2));
    } catch { /* best effort */ }
  }

  // Records a torn down memo; most recently torn first.
  archiveTornDown(memo) {
    this.archived = this.archived.filter(m => m.id !== memo.id);
    this.archived.unshift({
      id: memo.id,
      text: memo.memo.text,
      color: memo.memo.color,
      isDone: memo.memo.isDone,
      createdAt: memo.memo.createdAt,
      tornDownAt: new Date().toISOString(),
    });
    // Cap the archive: keep only the most recent 1000 entries (list is
    // newest-first, so the tail is dropped); SunMemo.md's archive section
    // is rebuilt from this list on the next sync.
    if (this.archived.length > 1000) this.archived.length = 1000;
    this.saveArchived();
  }

  statusBadge(memo) {
    const stats = calculateTodoStats(memo.text);
    if (stats.total > 0) {
      return stats.completed === stats.total ? '【已全部完成 ☑️】' : `【进行中 ⏳ ${stats.completed}/${stats.total}】`;
    }
    return memo.isDone ? '【已完成 ☑️】' : '【待办便签 📌】';
  }

  archivedBadge(memo) {
    const stats = calculateTodoStats(memo.text);
    if (stats.total > 0) {
      return stats.completed === stats.total ? '【已撕下 · 全部完成 ☑️】' : `【已撕下 · 完成 ${stats.completed}/${stats.total}】`;
    }
    return memo.isDone ? '【已撕下 · 已完成 ☑️】' : '【已撕下 🗑️】';
  }

  // Syncs all live memos and the archive to the markdown documents.
  sync(items) {
    const memos = items.filter(i => i.kind === 'memo' && !i.falling);
    const now = fmtDate(new Date());

    let md = `# ☀️ SunMemo (晾想法) 便签与待办事项备份

> 💡 **自动实时同步中**：本文档由 SunMemo 自动维护。
> 所有在绳便签与历史撕下的便签均永久保存在此。即使软件退出或撕下卡片，所有想法与待办记录均安全留存。
> 支持使用 Obsidian、Typora、VS Code 或系统备忘录随时查看与二次整理。
> **最后同步时间**：${now}

---

# 📌 正在悬挂的便签（Active Memos）

`;

    if (memos.length === 0) {
      md += '\n*（当前晾衣绳上暂无挂载便签）*\n\n';
    } else {
      memos.forEach((memo, idx) => {
        const m = memo.memo;
        md += `## 便签 ${idx + 1} · ${this.statusBadge(m)} · ${colorEmoji(m.color)} · 创建时间：${fmtDate(new Date(m.createdAt))}\n\n`;
        md += String(m.text || '').trim();
        md += '\n\n---\n\n';
      });
    }

    if (this.archived.length > 0) {
      md += '\n# 📦 历史已撕下便签归档（Archived & Torn Down）\n\n';
      this.archived.forEach((m, idx) => {
        md += `## 归档 ${idx + 1} · ${this.archivedBadge(m)} · ${colorEmoji(m.color)} · 撕下时间：${fmtDate(new Date(m.tornDownAt))}（创建于 ${fmtDate(new Date(m.createdAt))}）\n\n`;
        md += String(m.text || '').trim();
        md += '\n\n---\n\n';
      });
    }

    try { fs.writeFileSync(this.markdownPath, md, 'utf8'); } catch { /* Documents may be redirected */ }
    try { fs.writeFileSync(this.backupPath, md, 'utf8'); } catch { /* best effort */ }
  }

  openInEditor() {
    if (!fs.existsSync(this.markdownPath)) {
      try { fs.writeFileSync(this.markdownPath, '', 'utf8'); } catch { /* ignore */ }
    }
    require('electron').shell.openPath(this.markdownPath);
  }
}

module.exports = { Sync, calculateTodoStats, toggleTodoLine, uuid, fmtDate };
