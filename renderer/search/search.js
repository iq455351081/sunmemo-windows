'use strict';
const api = window.sun;

const q = document.getElementById('q');
const list = document.getElementById('list');
document.getElementById('searchIcon').innerHTML =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="7" cy="7" r="4.6"/><path d="m10.6 10.6 3 3"/></svg>';
document.getElementById('closeBtn').innerHTML =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/></svg>';

let items = [];
let filtered = [];
let active = 0;

// ---- 搜索历史（renderer localStorage，最新在前，去重，上限 5；无额外 IO） ----
const HIST_KEY = 'sunmemoSearchHistory';
function loadHist() {
  try { const a = JSON.parse(localStorage.getItem(HIST_KEY)); return Array.isArray(a) ? a.filter(x => typeof x === 'string') : []; }
  catch { return []; }
}
function saveHist(word) {
  const v = String(word || '').trim();
  if (!v) return;
  const hist = loadHist().filter(x => x !== v);
  hist.unshift(v);
  localStorage.setItem(HIST_KEY, JSON.stringify(hist.slice(0, 5)));
}

function firstLine(t) {
  const lines = String(t || '').split('\n');
  for (const l of lines) { const s = l.replace(/^#+\s*/, '').trim(); if (s) return s; }
  return '（空便签）';
}

function snippet(t, query) {
  const body = String(t || '').replace(/^#+\s*/gm, '');
  let idx = body.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) {
    const rest = body.split('\n').filter(l => l.trim()).slice(0, 2).join(' · ');
    return esc(rest.slice(0, 90));
  }
  const start = Math.max(0, idx - 22);
  let frag = body.slice(start, idx + 48).replace(/\n/g, ' · ');
  const re = new RegExp('(' + query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
  frag = esc(frag).replace(re, '<mark>$1</mark>');
  return (start > 0 ? '…' : '') + frag + '…';
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// R152: 图片结果按文件名匹配/展示（serializeItem 无 createdAt，meta 用尺寸代替）
// 文件名含孤立 % 时 decodeURIComponent 抛 URIError —— 失败回退原始串
const imgName = it => {
  const raw = String(it.fileUrl || '').split('/').pop() || '';
  let name;
  try { name = decodeURIComponent(raw); } catch { name = raw; }
  return name || '图片';
};

function itemHtml(it, i) {
  if (it.kind === 'image') {
    return `<div class="item ${i === active ? 'active' : ''}" data-id="${it.id}">
      <span class="dot img"></span>
      <div class="txt">
        <div class="t1">${esc(imgName(it))}</div>
        <div class="t2">${it.thumbW ? esc(it.thumbW + '×' + it.thumbH) : '图片'}</div>
      </div>
    </div>`;
  }
  const m = it.memo;
  return `<div class="item ${i === active ? 'active' : ''}" data-id="${it.id}">
    <span class="dot" style="background:${(window.DOT_COLOR || {})[m.color] || '#fae894'}"></span>
    <div class="txt">
      <div class="t1">${esc(firstLine(m.text))}</div>
      <div class="t2">${snippet(m.text, q.value.trim())}</div>
    </div>
    <span class="meta">${window.timeAgo(m.createdAt)}</span>
  </div>`;
}

function render() {
  const query = q.value.trim();
  const ql = query.toLowerCase();
  filtered = items.filter(i => (i.kind === 'memo' && i.memo) || i.kind === 'image')
    .filter(i => i.kind !== 'memo' || !activeTag || window.extractTags(i.memo.text).includes(activeTag))
    .filter(i => !query || (i.kind === 'memo'
      ? i.memo.text.toLowerCase().includes(ql)
      : imgName(i).toLowerCase().includes(ql)));
  // R152: memo 在前、image 在后 —— filtered 顺序即 .item 的 DOM 顺序，
  // 分组标题渲染为独立的 .group-head 行（不算 item），键盘 active 索引不受影响。
  const memos = filtered.filter(i => i.kind === 'memo');
  const imgs = filtered.filter(i => i.kind === 'image');
  filtered = memos.concat(imgs);
  renderTags();
  active = Math.min(active, Math.max(0, filtered.length - 1));
  const hist = (!query && !activeTag) ? loadHist() : [];
  const histHtml = hist.length
    ? `<div class="hist-row">${hist.map((h, i) =>
        `<span class="hist-chip" data-hist="${i}"><span class="hist-txt">${esc(h)}</span><button class="hist-x" data-hist-del="${i}" title="删除此记录">×</button></span>`).join('')}</div>`
    : '';
  if (!filtered.length) {
    const canCreate = true; // R103: includeRecycle was never defined — the empty state threw ReferenceError
    list.innerHTML = histHtml
      + `<div class="empty">${query ? '没有匹配的便签' : activeTag ? `没有带 #${esc(activeTag)} 的便签` : '绳上还没有便签'}</div>`
      + (canCreate && !query ? '<div class="empty" style="padding-top:0"><button class="quick-create" data-action="create">＋ 新建速记便签 (Ctrl+Alt+N)</button></div>' : '');
    return;
  }
  list.innerHTML = histHtml
    + (memos.length ? `<div class="group-head">📝 便签 ${memos.length}</div>`
      + memos.map((it, i) => itemHtml(it, i)).join('') : '')
    + (imgs.length ? `<div class="group-head">🖼 图片 ${imgs.length}</div>`
      + imgs.map((it, i) => itemHtml(it, memos.length + i)).join('') : '');
}

function renderTags() {
  const tags = allTags();
  const host = document.getElementById('tagRow');
  if (!host) return;
  host.innerHTML = tags.length
    ? tags.map(t => `<button class="tagchip ${t === activeTag ? 'on' : ''}" data-tag="${t}">#${t}</button>`).join('')
    : '';
}
document.getElementById('tagRow').addEventListener('click', ev => {
  const b = ev.target.closest('.tagchip');
  if (!b) return;
  activeTag = activeTag === b.dataset.tag ? null : b.dataset.tag;
  active = 0;
  render();
});

list.addEventListener('click', ev => {
  const del = ev.target.closest('.hist-x');
  if (del) {
    ev.stopPropagation();
    const hist = loadHist();
    hist.splice(Number(del.dataset.histDel), 1);
    localStorage.setItem(HIST_KEY, JSON.stringify(hist));
    render();
    return;
  }
  const chip = ev.target.closest('.hist-chip');
  if (chip) {
    const h = loadHist()[Number(chip.dataset.hist)];
    if (h != null) { q.value = h; active = 0; saveHist(h); render(); q.focus(); }
    return;
  }
  const el = ev.target.closest('.item');
  if (el) { saveHist(q.value); api.send('search:open', el.dataset.id); }
});
list.addEventListener('dblclick', ev => {
  const el = ev.target.closest('.item');
  if (el) api.send('search:edit', el.dataset.id);
});

q.addEventListener('input', () => { active = 0; render(); });
q.addEventListener('keydown', ev => {
  if (ev.key === 'ArrowDown') { ev.preventDefault(); active = Math.min(active + 1, filtered.length - 1); render(); scrollActive(); }
  else if (ev.key === 'ArrowUp') { ev.preventDefault(); active = Math.max(active - 1, 0); render(); scrollActive(); }
  else if (ev.key === 'Enter' && filtered[active]) { saveHist(q.value); api.send('search:open', filtered[active].id); }
});
function scrollActive() {
  const el = list.querySelector('.item.active');
  if (el) el.scrollIntoView({ block: 'nearest' });
}
document.getElementById('closeBtn').addEventListener('click', () => { try { api.send('search:close'); } catch { /* ignore */ } window.close(); });
document.getElementById('list').addEventListener('click', ev => {
  const b = ev.target.closest('[data-action="create"]');
  if (b) api.send('line:open-editor', null);
});
window.addEventListener('keydown', ev => { if (ev.key === 'Escape') { try { api.send('search:close'); } catch { /* ignore */ } window.close(); } });

function loadItems(d) {
  items = (d.items || []).filter(i => i.kind === 'memo' || i.kind === 'image');
  activeTag = null;
  render();
}
api.invoke('search:data').then(d => { loadItems(d); q.focus(); }).catch(() => {});
api.on('search:set-tag', tag => {
  if (!tag) return;
  // 数据可能晚于事件到达：轮询直到标签出现在已渲染 chips 中再激活
  const wait = setInterval(() => {
    const chips = [...document.querySelectorAll('#tagRow .tagchip')];
    const hit = chips.find(b => b.dataset.tag === tag);
    if (hit) { clearInterval(wait); hit.click(); }
  }, 250);
  setTimeout(() => clearInterval(wait), 8000);
});
api.on('search:refresh', d => loadItems(d));

// ---- R4 标签筛选（补齐缺失的定义） ----
if (typeof activeTag === 'undefined') {
  var activeTag = null;
}
if (typeof allTags !== 'function') {
  var allTags = function () {
    const set = new Set();
    items.forEach(i => { if (i.memo) window.extractTags(i.memo.text).forEach(t => set.add(t)); });
    return [...set].slice(0, 10);
  };
}

// R167: 窗口入场 —— ready-to-show 后补 .in 触发 search.css 的 #panel 展开过渡
requestAnimationFrame(() => document.body.classList.add('in'));
