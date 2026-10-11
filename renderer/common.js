'use strict';
// Shared renderer helpers: markdown-lite rendering (faithful to the card
// bodies in PeggedView / MarkdownPreviewScrollView), time strings, todo stats.

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Inline markdown: **bold**, *italic*, `code`, ~~strike~~.
function inlineMd(s) {
  let h = escapeHtml(s);
  h = h.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  h = h.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>');
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
  h = h.replace(/~~([^~]+)~~/g, '<s>$1</s>');
  return h;
}

const TODO_OPEN = /^(-|\*)\s+\[ \]\s+(.*)$|^\[ \]\s+(.*)$/;
const TODO_DONE = /^(-|\*)\s+\[x\]\s+(.*)$/i;
const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^(-|\*)\s+(?!\[)(.*)$/;
const QUOTE = /^>\s?(.*)$/;

// One line of markdown → HTML. opts.todo=true renders interactive checkboxes
// carrying `data-line` (the full-text line index, click handled by the host).
function mdLineAt(raw, index, opts = {}) {
  const t = String(raw).trim();
  let m;
  if ((m = t.match(TODO_OPEN))) {
    const content = m[2] || m[3] || '';
    return `<div class="md-todo"${opts.todo ? ` role="button" data-line="${index}"` : ''}>` +
      `<span class="md-box"></span><span class="md-todo-text">${inlineMd(content)}</span></div>`;
  }
  if ((m = t.match(TODO_DONE))) {
    return `<div class="md-todo is-done"${opts.todo ? ` role="button" data-line="${index}"` : ''}>` +
      `<span class="md-box checked">${CHECK_SVG}</span><span class="md-todo-text">${inlineMd(m[2])}</span></div>`;
  }
  if ((m = t.match(HEADING))) return `<div class="md-h">${inlineMd(m[2])}</div>`;
  if ((m = t.match(BULLET))) return `<div class="md-li"><span class="md-dot">•</span><span>${inlineMd(m[2])}</span></div>`;
  if ((m = t.match(QUOTE))) return `<div class="md-quote">${inlineMd(m[1])}</div>`;
  if (!t) return `<div class="md-blank"></div>`;
  return `<div class="md-p${opts.done ? ' is-done' : ''}">${inlineMd(t)}</div>`;
}

const CHECK_SVG = `<svg viewBox="0 0 16 16" width="11" height="11"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// Card body: first 4 lines + "… 还有 N 项" (MarkdownMemoCardBody port).
function renderCardBody(text, { done = false, todoClickable = true } = {}) {
  const lines = String(text || '').split('\n');
  const visible = lines.slice(0, 4);
  let html = visible.map((l, i) => mdLineAt(l, i, { todo: todoClickable, done })).join('');
  if (lines.length > 4) {
    html += `<div class="md-more">… 还有 ${lines.length - 4} 项</div>`;
  }
  return html;
}

// Full markdown scroll view (MarkdownPreviewScrollView port).
function renderPreviewBody(text, { todoClickable = true } = {}) {
  const lines = String(text || '').split('\n');
  const empty = !String(text || '').trim();
  if (empty) return `<div class="md-empty">暂无内容可预览</div>`;
  return lines.map((l, i) => mdLineAt(l, i, { todo: todoClickable })).join('');
}

// ---- time strings (timeAgoString / timeString ports) -----------------------

function timeAgo(iso) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return '刚刚';
  if (seconds < 3600) return `${Math.max(1, Math.floor(seconds / 60))}分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时前`;
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function timeString(iso) {
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const now = new Date();
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const yesterday = new Date(now.getTime() - 86400000);
  if (sameDay(d, now)) return `今天 ${hm}`;
  if (sameDay(d, yesterday)) return `昨天 ${hm}`;
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`;
}

// 完整日期时间（悬停提示用）
function fullDate(iso) {
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

// ---- hashtags (#标签) --------------------------------------------------------
function extractTags(text) {
  const seen = new Set();
  const out = [];
  for (const m of String(text || '').matchAll(/#([一-龥A-Za-z0-9_-]{1,16})/g)) {
    if (!seen.has(m[1])) { seen.add(m[1]); out.push(m[1]); }
    if (out.length >= 6) break;
  }
  return out;
}

// ---- todo stats (MemoSyncManager.calculateTodoStats port) -------------------

function todoStats(text) {
  let total = 0, completed = 0;
  for (const l of String(text || '').split('\n')) {
    const t = l.trim();
    if (/^(-|\*)? ?\[ \] /.test(t) || /^\[ \] /.test(t)) total += 1;
    else if (/^(-|\*)? ?\[x\] /i.test(t) || /^\[x\] /i.test(t)) { total += 1; completed += 1; }
  }
  return { total, completed };
}

// ---- memo palette (memoBackground(for:) port) --------------------------------

const CARD_BG = {
  yellow: ['#fff6ba', '#fae894'],
  green:  ['#e0f7e0', '#d1edd1'],
  pink:   ['#ffe6ed', '#fad4e0'],
  blue:   ['#e0f0ff', '#cce3fa'],
};
const CARD_BG_EDITOR = {
  yellow: ['#fff7bd', '#faeb99'],
  green:  ['#e3fae3', '#d1edd1'],
  pink:   ['#ffe8f0', '#fad6e3'],
  blue:   ['#e3f2ff', '#cce6fa'],
};
const CARD_BG_PREVIEW = {
  yellow: ['#fff7c2', '#faeb9e'],
  green:  ['#e6fae6', '#d4f0d4'],
  pink:   ['#ffebf2', '#fad9e6'],
  blue:   ['#e6f5ff', '#d1e8fa'],
};
function cardGradient(color, map = CARD_BG) {
  const [a, b] = map[color] || map.yellow;
  return `linear-gradient(to bottom, ${a}, ${b})`;
}

const DOT_COLOR = {
  yellow: '#fae894', green: '#d1edd1', pink: '#fad4e0', blue: '#cce3fa',
};
