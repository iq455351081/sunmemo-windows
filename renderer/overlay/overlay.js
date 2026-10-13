'use strict';
/* Hero preview + capture flights + falls — MemoPreviewWindow.swift /
   CaptureFlight.swift port. All screen coords arrive relative to the
   overlay's own display. */

const api = window.sun;

const backdrop = document.getElementById('backdrop');
const cordSvg = document.getElementById('cord');
const pegEl = document.getElementById('peg');
const heroWrap = document.getElementById('heroWrap');
const heroCard = document.getElementById('heroCard');
const fxLayer = document.getElementById('fxLayer');

const ICONS = {
  check: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m3 8.6 3.2 3.2L13 5"/></svg>',
  x: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/></svg>',
  copy: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="5" width="9" height="9" rx="2"/><path d="M11 3H4a2 2 0 0 0-2 2v7"/></svg>',
  trash: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2.5 4h11M6.5 2h3M4 4l.7 9a1.5 1.5 0 0 0 1.5 1.4h3.6a1.5 1.5 0 0 0 1.5-1.4L12 4M6.5 7v4.5M9.5 7v4.5"/></svg>',
  edit: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11.3 2.3a1.4 1.4 0 0 1 2 2L5.6 12l-2.8.8.8-2.8Z"/></svg>',
  open: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 3H3.8A1.8 1.8 0 0 0 2 4.8v7.4A1.8 1.8 0 0 0 3.8 14h7.4a1.8 1.8 0 0 0 1.8-1.8V9.5M9.5 2H14v4.5M14 2 7.5 8.5"/></svg>',
  list: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M5.5 4h8M5.5 8h8M5.5 12h8"/><rect x="2" y="3.2" width="1.8" height="1.8" rx="0.5" fill="currentColor" stroke="none"/><rect x="2" y="7.2" width="1.8" height="1.8" rx="0.5" fill="currentColor" stroke="none"/><rect x="2" y="11.2" width="1.8" height="1.8" rx="0.5" fill="currentColor" stroke="none"/></svg>',
  pin: '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0Zm3.7 6.3-4.2 4.7a1 1 0 0 1-1.5 0L4.3 9.2a1 1 0 1 1 1.4-1.4l1 1 3.5-3.9a1 1 0 0 1 1.5 1.4Z"/></svg>',
  checklist: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="12" height="12" rx="2.5"/><path d="m5 8 2 2 4-4.5"/></svg>',
};

// ---------------------------------------------------------------------------
// Hero preview
// ---------------------------------------------------------------------------

let pv = null; // {item, peg, origin, display, expanded, ratio}

function previewSize(item) {
  if (item.kind === 'memo') {
    const r = L.RATIOS[(item.memo && item.memo.aspectRatio) || 'wide'] || L.RATIOS.wide;
    return { w: r.preview.w, h: r.preview.h, body: r.previewBody };
  }
  if (item.kind === 'doc') {
    // 文档大图阅读：宽版纸面 + 头尾操作条
    return { w: Math.min(820, Math.round(innerWidth * 0.62)), h: Math.min(720, Math.round(innerHeight * 0.72)), body: 0, doc: true };
  }
  const iw = item.thumbW || 480, ih = item.thumbH || 320;
  const maxW = Math.min(1100, Math.round(innerWidth * 0.62)), maxH = Math.min(700, Math.round(innerHeight * 0.64));
  const s = Math.min(maxW / iw, maxH / ih, 1.4);
  return { w: Math.max(320, iw * s), h: Math.max(220, ih * s) + 150, body: 0 };
}

function heroHTML(item) {
  if (item.kind === 'memo') {
    const r = L.RATIOS[(item.memo && item.memo.aspectRatio) || 'wide'] || L.RATIOS.wide;
    const st = window.todoStats(item.memo.text);
    const all = st.total > 0 && st.completed === st.total;
    return `
      <div class="hero-inner" style="background:${window.cardGradient(item.memo.color, window.CARD_BG_PREVIEW)}">
        <div class="hero-head">
          ${st.total > 0 ? `<span class="stats-pill ${all ? 'all' : ''}">${all ? ICONS.check : ICONS.list}<span>${st.completed}/${st.total} 完成</span></span>` : '<span></span>'}
          <span class="hero-spacer"></span>
          <span class="ratio-pills">${ratioPills(item)}</span>
          <span class="hero-time">${window.timeString(item.memo.createdAt)}</span>
          <button class="close-x" data-act="close">${ICONS.x}</button>
        </div>
        <div class="divider"></div>
        <div class="hero-body" style="${item.kind === 'memo' ? '' : ''}">${window.renderPreviewBody(item.memo.text)}</div>
        <div class="divider"></div>
        <div class="hero-foot">
          <div class="hero-actions">
            ${window.extractTags(item.memo.text).length ? `<div class="tag-row" style="padding:0 2px 6px">${window.extractTags(item.memo.text).slice(0, 5).map(t => `<span class="tag-chip" data-tag="${t}" style="cursor:pointer" title="点击按标签筛选">#${t}</span>`).join('')}</div>` : ''}
            <button class="act-btn ghost" data-act="copymd" title="以 Markdown 引用格式复制">MD 引用</button>
            <button class="act-btn" data-act="copy">${ICONS.copy}<span>复制全文</span></button>
            <span class="hero-spacer"></span>
            <button class="act-btn ghost" data-act="inline">${ICONS.edit}<span>内联编辑</span></button>
            <button class="act-btn primary" data-act="edit">${ICONS.edit}<span>编辑便签</span></button>
            <button class="act-btn danger" data-act="discard">${ICONS.trash}<span>撕下</span></button>
          </div>
          <div class="hero-hint">按 Esc 或点击空白处收起 · 双击卡片或按 Enter 编辑</div>
        </div>
      </div>`;
  }
  const size = previewSize(item);
  if (item.kind === 'doc') {
    const m = window.DOCR.meta(item.docType);
    return `
    <div class="hero-inner hero-doc" style="width:${size.w}px;height:${size.h}px">
      <div class="hero-head">
        <span class="doc-chip" style="background:${m.c1}">${m.label}</span>
        <span class="name-pill plain" title="${window.escapeHtml(item.docName || '')}"><span>${window.escapeHtml(item.docName || '')}</span></span>
        <span class="hero-spacer"></span>
        <span class="hero-time">${window.DOCR.sizeText(item.docSize)}${item.docMtime ? ' · ' + window.DOCR.mtimeText(item.docMtime) : ''}</span>
        <button class="close-x" data-act="close">${ICONS.x}</button>
      </div>
      <div class="hero-doc-host"></div>
      <div class="hero-foot">
        <div class="hero-actions">
          <span class="hero-hint grow">滚轮翻阅 · 拖选可复制</span>
          <button class="act-btn ghost" data-act="reveal">打开文件夹</button>
          <button class="act-btn primary" data-act="open">用系统应用打开</button>
          <button class="act-btn danger" data-act="trash">${ICONS.trash}<span>移到回收站</span></button>
        </div>
      </div>
    </div>`;
  }
  const size2 = previewSize(item);
  return `
    <div class="hero-inner" style="width:${size2.w}px;height:${size2.h}px">
      <div class="hero-head">
        <span class="name-pill" data-act="open" role="button" title="打开图片">${ICONS.open}<span>${fileName(item.fileUrl)}</span></span>
        <span class="hero-spacer"></span>
        <button class="close-x" data-act="close">${ICONS.x}</button>
      </div>
      <div class="photo-area"><img src="${item.fileUrl}"></div>
      <div class="hero-foot">
        <div class="hero-actions">
          <button class="act-btn ghost" data-act="copy">${ICONS.copy}<span>复制图片</span></button>
          <button class="act-btn ghost" data-act="rotate">⟳ 旋转</button>
          <span class="hero-spacer"></span>
          <button class="act-btn ghost" data-act="markup">标记(画图)</button>
          <button class="act-btn ghost" data-act="open">打开</button>
          <button class="act-btn ghost" data-act="saveas">另存为</button>
          <button class="act-btn danger" data-act="trash">${ICONS.trash}<span>移到回收站</span></button>
        </div>
        <div class="hero-hint">按 Esc 或点击空白处收起 · 双击图片直接复制</div>
      </div>
    </div>`;
}

function fileName(url) {
  // 文件名含孤立 % 时 decodeURIComponent 抛 URIError —— 失败回退原始串
  const raw = url.split('/').pop() || '';
  try { return decodeURIComponent(raw); } catch { return raw; }
}

function ratioPills(item) {
  const cur = (item.memo && item.memo.aspectRatio) || 'wide';
  return ['wide', 'square', 'tall'].map(k => {
    const r = L.RATIOS[k];
    return `<button class="ratio-pill ${cur === k ? 'active' : ''}" data-ratio="${k}"><span class="sym">${r.symbol}</span>${r.title}</button>`;
  }).join('');
}

function spring(t) {
  // SwiftUI .spring(response:0.38, dampingFraction:0.74) approximation.
  const zeta = 0.74, wn = 2 * Math.PI / 0.38, wd = wn * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * wn * t) * (Math.cos(wd * t) + (zeta * wn / wd) * Math.sin(wd * t));
}

function showPreview(payload) {
  const swap = !!(payload.swap && pv); // ↑/↓ switch or in-place refresh
  const payload2 = payload.peg ? payload : (pv ? { ...payload, peg: pv.peg, origin: pv.origin } : payload);
  pv = { ...payload2, expanded: swap };
  const { item } = payload2;
  renderHero(item);
  heroWrap.classList.remove('hidden');
  pegEl.classList.remove('hidden');
  cordSvg.style.opacity = '';
  if (swap) {
    const size = previewSize(item);
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    heroWrap.style.left = (cx - size.w / 2) + 'px';
    heroWrap.style.top = (cy - size.h / 2) + 'px';
    heroWrap.style.transform = 'scale(1) rotate(0deg)';
    heroWrap.style.opacity = 1;
    if (payload.peg) {
      pegEl.style.left = (payload.peg.x - 6.5) + 'px';
      pegEl.style.top = payload.peg.y + 'px';
    }
    drawCord();
    return;
  }
  requestAnimationFrame(() => animatePreview(0, 1, 620));
}

let heroDocDispose = null; // 当前文档阅读器的 dispose（切页/关闭时取消在途渲染）

function renderHero(item) {
  pv.item = item;
  // R207: 图片预览用无边框悬浮样式（Quick Look 式，无白框）
  heroCard.classList.toggle('img-photo', item.kind === 'image');
  const size = previewSize(item);
  // 重置真正的缩放状态（photoZoom 是死变量）：放大后切下一张，滚轮第一下
  // 不再从旧倍率猛跳。zoomTarget/zoomCurrent 声明在下方，运行时已求值。
  zoomTarget = zoomCurrent = 1;
  photoRotation = 0;
  heroCard.style.width = size.w + 'px';
  heroCard.style.height = size.h + 'px';
  heroCard.innerHTML = heroHTML(item);
  // 图片丢失（文件被移动/删除）时不再留破图：换成可读占位，"打开文件夹"
  // 复用现有 data-act 委托 → line:reveal（shell.showItemInFolder）。
  const heroImg = heroCard.querySelector('.photo-area img');
  if (heroImg) heroImg.addEventListener('error', () => {
    if (!heroImg.isConnected) return;
    const area = heroCard.querySelector('.photo-area');
    if (area) area.innerHTML =
      '<div class="img-err"><div class="ico">🖼</div><div class="txt">图片无法加载（文件可能已被移动或删除）</div>' +
      '<button class="act-btn ghost" data-act="reveal">打开文件夹</button></div>';
  });
  const body = heroCard.querySelector('.hero-body');
  if (body && item.kind === 'memo') body.style.height = size.body + 'px';
  // v1.6 文档预览：大阅读面（与悬停弹出同一渲染器，页数放宽到 8）
  const docHost = heroCard.querySelector('.hero-doc-host');
  if (docHost && item.kind === 'doc') {
    if (heroDocDispose) { heroDocDispose(); heroDocDispose = null; }
    window.DOCR.buildReader(item, { width: size.w - 36, pdfPages: 0 }).then(({ el, dispose }) => {
      if (!docHost.isConnected) { dispose(); return; }
      docHost.appendChild(el);
      heroDocDispose = dispose;
    }).catch(() => {});
  }
}

function cardTopPoint() {
  const r = heroWrap.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top };
}

let cordPath = null; // built once with the static defs; frames only touch `d`

function drawCord() {
  if (!pv || !pv.peg) return;
  const w = window.innerWidth, h = window.innerHeight;
  cordSvg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  const start = { x: pv.peg.x, y: pv.peg.y + 11 };
  const end = cardTopPoint();
  const dx = end.x - start.x, dy = end.y - start.y;
  const c1 = { x: start.x + dx * 0.22 - 6, y: start.y + dy * 0.36 };
  const c2 = { x: start.x + dx * 0.78 - 3, y: start.y + dy * 0.78 };
  const d = `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`;
  if (!cordPath || !cordPath.isConnected) {
    cordSvg.innerHTML = `
      <defs><linearGradient id="cordg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="rgba(122,112,102,0.80)"/>
        <stop offset="1" stop-color="rgba(148,138,128,0.65)"/>
      </linearGradient></defs>
      <path d="${d}"
        fill="none" stroke="url(#cordg)" stroke-width="1.3" stroke-linecap="round"/>`;
    cordPath = cordSvg.querySelector('path');
  } else {
    cordPath.setAttribute('d', d);
  }
}

function animatePreview(from, to, duration) {
  const start = performance.now();
  const { peg, origin } = pv;
  const size = previewSize(pv.item);

  // Expanded position: card centered; collapsed: at the origin slot.
  const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
  const expandedX = cx - size.w / 2, expandedY = cy - size.h / 2;
  const collapsedX = origin.x + origin.w / 2 - (size.w * initialScale()) / 2;
  const collapsedY = origin.y - (size.h - origin.h) * initialScale() * 0.5;
  const s0 = initialScale();
  const tilt0 = pv.item.tilt || 0;

  pegEl.style.left = (peg.x - 6.5) + 'px';
  pegEl.style.top = peg.y + 'px';

  function frame(now) {
    if (!pv) return;
    const t = Math.min(1, (now - start) / duration);
    const x = from + (to - from) * spring(t); // 0 = collapsed, 1 = expanded
    const px = collapsedX + (expandedX - collapsedX) * x;
    const py = collapsedY + (expandedY - collapsedY) * x;
    const sc = s0 + (1 - s0) * x;
    const rot = tilt0 * (1 - x);
    heroWrap.style.left = px + 'px';
    heroWrap.style.top = py + 'px';
    heroWrap.style.transform = `scale(${sc}) rotate(${rot}deg)`;
    heroWrap.style.opacity = Math.min(1, x * 1.6);
    pegEl.style.opacity = x;
    cordSvg.style.opacity = x;
    // No dark dim patch: the fitted window floats the card over the desktop
    // with its own shadow instead (a dark rectangle looked broken).
    backdrop.style.opacity = 0;
    drawCord();
    if (t < 1) requestAnimationFrame(frame);
    else pv.expanded = to > 0.5;
  }
  requestAnimationFrame(frame);
}

function initialScale() {
  const size = previewSize(pv.item);
  if (!pv.origin || pv.origin.w <= 0) return 0.52;
  return Math.max(0.40, Math.min(0.68, pv.origin.w / size.w));
}

function dismissPreview(instant = false) {
  if (!pv) return;
  // R165: Esc 立即消失；点击空白快速收起（原 430ms 弹簧+380ms 延迟被感知为迟钝）
  // Bug fix: 收起弹簧动画需要 pv 的 peg/origin —— pv=null 延后到 hide() 里，
  // 否则 animatePreview 开头解构 null 抛 TypeError，收起动画从未播放。
  const hide = () => {
    if (!pv) return; // 幂等：210ms 内 Esc 等二次 dismiss 不会重复发 overlay:close
    pv = null;
    if (heroDocDispose) { heroDocDispose(); heroDocDispose = null; }
    heroWrap.classList.add('hidden');
    pegEl.classList.add('hidden');
    cordSvg.style.opacity = 0;
    backdrop.style.opacity = 0;
    api.send('overlay:close');
  };
  if (instant) { hide(); return; }
  animatePreview(1, 0, 240);
  setTimeout(hide, 210);
}

// hero events
heroCard.addEventListener('click', ev => {
  if (!pv) return;
  const todo = ev.target.closest('.md-todo');
  if (todo && todo.dataset.line != null) {
    api.send('overlay:toggle-todo', { id: pv.item.id, lineIndex: parseInt(todo.dataset.line, 10) });
    return;
  }
  const pill = ev.target.closest('.ratio-pill');
  if (pill) {
    api.send('overlay:toggle-ratio', { id: pv.item.id, ratio: pill.dataset.ratio });
    pv.item = { ...pv.item, memo: { ...pv.item.memo, aspectRatio: pill.dataset.ratio } };
    renderHero(pv.item);
    animatePreview(1, 1, 400);
    return;
  }
  const act = ev.target.closest('[data-act]');
  if (!act) return;
  const a = act.dataset.act;
  if (a === 'close') dismissPreview();
  else if (a === 'copy') {
    api.send('overlay:copy', pv.item.id);
    const btn = act;
    btn.classList.add('ok');
    btn.querySelector('span').textContent = '已复制';
    setTimeout(() => { btn.classList.remove('ok'); btn.querySelector('span').textContent = pv && pv.item.kind === 'memo' ? '复制全文' : '复制图片'; }, 1200);
  }
  else if (a === 'discard') { const id = pv.item.id; pv = null; api.send('overlay:discard', id); }
  else if (a === 'trash') { const id = pv.item.id; pv = null; api.send('overlay:trash', id); }
  else if (a === 'edit') { const id = pv.item.id; pv = null; api.send('overlay:edit', id); }
  else if (a === 'copymd') {
    // R77: 构建逻辑在主进程（与右键菜单共用 buildMdQuote）
    api.send('overlay:copy-md', pv.item.id);
    const btn = act || { classList: { add() {}, remove() {} }, querySelector: () => ({ textContent: '' }) };
    btn.classList.add('ok');
    const span = btn.querySelector ? btn.querySelector('span') : null;
    if (span) span.textContent = '已复制';
    setTimeout(() => { if (btn.isConnected) { btn.classList.remove('ok'); if (span) span.textContent = 'MD 引用'; } }, 1200);
  }
  else if (a === 'markup') { flashBtn(act, '打开画图中…'); api.send('line:markup', pv.item.id); }
  else if (a === 'saveas') { flashBtn(act, '选择保存位置…'); api.send('overlay:save-as', pv.item.id); }
  else if (a === 'rotate') {
    photoRotation = (photoRotation + 90) % 360;
    const img = document.querySelector('.photo-area img');
    if (img) {
      applyPhotoTransform(img);
      // 90/270° 后视觉宽高与布局盒互换：收紧布局盒让竖图旋转后仍完整落在视口内
      img.style.maxWidth = photoRotation % 180 ? Math.round(innerHeight * 0.55) + 'px' : '';
      img.style.maxHeight = photoRotation % 180 ? Math.round(innerWidth * 0.8) + 'px' : '';
    }
    flashBtn(act, photoRotation + '°');
  }
  else if (a === 'tag') { /* handled via chip listener below */ }
  else if (a === 'open') {
    flashBtn(act, '打开中…');
    api.send('line:open', pv.item.id);
    // 文档交给系统应用后预览立即收起——别让全屏预览盖住刚打开的文档
    if (pv.item.kind === 'doc') dismissPreview();
  }
  else if (a === 'reveal') { flashBtn(act, '打开文件夹…'); api.send('line:reveal', pv.item.id); }
  else if (a === 'inline' && pv.item.kind === 'memo') startInlineEdit();
});

// R101: slow-launch targets (Photos, Paint, the save dialog) read as dead
// buttons without instant acknowledgement on the button itself.
function flashBtn(btn, text) {
  if (!btn || !btn.isConnected) return;
  const span = btn.querySelector('span');
  // span 缺失（纯文本按钮）时退化为直接改 btn.textContent，并在超时后还原原文本
  const old = span ? span.textContent : btn.textContent;
  btn.classList.add('ok');
  if (span) span.textContent = text;
  else btn.textContent = text;
  setTimeout(() => { if (btn.isConnected) { btn.classList.remove('ok'); if (span) span.textContent = old; else btn.textContent = old; } }, 1600);
}

function startInlineEdit() {
  if (!pv || pv.item.kind !== 'memo') return;
  const body = heroCard.querySelector('.hero-body');
  if (!body || body.querySelector('textarea')) return;
  const ta = document.createElement('textarea');
  ta.value = pv.item.memo.text;
  ta.spellcheck = false;
  ta.style.cssText = 'width:100%;height:100%;border:0;outline:none;resize:none;background:transparent;font-family:inherit;font-size:13.5px;line-height:1.55;color:inherit;user-select:text;';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;height:100%;';
  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';
  bar.innerHTML = `<button class="act-btn ghost" data-iact="cancel">取消</button><button class="act-btn primary" data-iact="save">保存 (Ctrl+Enter)</button>`;
  wrap.appendChild(ta); wrap.appendChild(bar);
  body.innerHTML = '';
  body.appendChild(wrap);
  ta.focus();
  ta.selectionStart = ta.selectionEnd = ta.value.length;
  bar.addEventListener('click', ev => {
    const b = ev.target.closest('[data-iact]');
    if (!b) return;
    if (b.dataset.iact === 'save') {
      const text = ta.value.trim();
      if (text) { api.send('overlay:inline-save', { id: pv.item.id, text }); pv.item = { ...pv.item, memo: { ...pv.item.memo, text } }; }
      renderHero(pv.item);
    } else {
      renderHero(pv.item);
    }
  });
  ta.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.stopPropagation(); bar.querySelector('[data-iact="save"]').click(); }
    if (ev.key === 'Escape') { ev.stopPropagation(); renderHero(pv.item); }
    ev.stopPropagation();
  });
}

let photoRotation = 0; // CSS transform rotation (deg); visual only, does not touch layout box
function applyPhotoTransform(img) {
  // compose with zoom so rotate and wheel-zoom never clobber each other's transform
  img.style.transform = `rotate(${photoRotation}deg) scale(${zoomCurrent.toFixed(3)})`;
}
let zoomTarget = 1, zoomCurrent = 1, zoomRaf = null;
function zoomApply(area) {
  const img = area.querySelector('img');
  if (img) applyPhotoTransform(img);
  const reset = area.querySelector('.zoom-reset');
  if (reset) reset.classList.toggle('show', zoomTarget > 1.05);
}
heroCard.addEventListener('wheel', ev => {
  const area = ev.target.closest && ev.target.closest('.photo-area');
  // .photo-area 只在图片预览（kind==='image'）时存在；memo 没有图片，直接放行返回
  if (!area || !pv || pv.item.kind !== 'image') return;
  ev.preventDefault();
  // 触控板捏合手势在 Windows 上以 ctrl+wheel 形式到达 —— 与滚轮同路径，天然兼容（R78）
  // R68: zoom eases toward the target (inertia feel) instead of jumping
  zoomTarget = Math.min(5, Math.max(1, zoomTarget + (ev.deltaY < 0 ? 0.25 : -0.25)));
  const img = area.querySelector('img');
  if (!img) return;
  let reset = area.querySelector('.zoom-reset');
  if (zoomTarget > 1.05 && !reset) {
    reset = document.createElement('button');
    reset.className = 'zoom-reset';
    reset.textContent = '1:1';
    reset.addEventListener('click', e2 => {
      e2.stopPropagation();
      zoomTarget = 1;
    });
    area.appendChild(reset);
  }
  if (zoomRaf) cancelAnimationFrame(zoomRaf);
  (function approach() {
    zoomCurrent += (zoomTarget - zoomCurrent) * 0.22;
    if (Math.abs(zoomTarget - zoomCurrent) < 0.005) zoomCurrent = zoomTarget;
    applyPhotoTransform(img);
    if (reset) reset.classList.toggle('show', zoomTarget > 1.05);
    if (Math.abs(zoomTarget - zoomCurrent) > 0.001) zoomRaf = requestAnimationFrame(approach);
  })();
}, { passive: false });



// R60: 点击标签 → 打开搜索并按该标签预筛选
heroCard.addEventListener('click', ev => {
  const chip = ev.target.closest('.tag-chip[data-tag]');
  if (!chip || !pv) return;
  ev.stopPropagation();
  api.send('search:open-tag', chip.dataset.tag);
}, true);

heroCard.addEventListener('dblclick', ev => {
  if (!pv) return;
  if (ev.target.closest('.md-todo') || ev.target.closest('[data-act]')) return;
  if (pv.item.kind === 'memo') { const id = pv.item.id; pv = null; api.send('overlay:edit', id); }
  else api.send('overlay:copy', pv.item.id);
});


// R69: 拖拽预览图片 → OS 拖出到任意位置保存
let photoDragStarted = false;
heroCard.addEventListener('mousedown', ev => {
  if (pv && pv.item.kind !== 'memo') {
    photoDragStarted = false;
    const startX = ev.screenX, startY = ev.screenY;
    const onMove = me => {
      if (!photoDragStarted && Math.hypot(me.screenX - startX, me.screenY - startY) > 8) {
        photoDragStarted = true;
        window.removeEventListener('mousemove', onMove);
        api.send('line:drag', { id: pv.item.id, icon: pv.item.thumb });
      }
    };
    // Ordinary clicks (no 8px drag) must not leak the mousemove listener /
    // its pv closure — always clear it on the next mouseup, once.
    const cleanup = () => window.removeEventListener('mousemove', onMove);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', cleanup, { once: true });
  }
});
backdrop.addEventListener('click', dismissPreview);

window.addEventListener('keydown', ev => {
  if (ev.key === 'Escape') { ev.preventDefault(); dismissPreview(true); }
  else if (ev.key === ' ') { ev.preventDefault(); dismissPreview(); }
  else if (ev.key === 'ArrowDown' || ev.key === 'j') { ev.preventDefault(); api.send('overlay:nav', 1); }
  else if (ev.key === 'ArrowUp' || ev.key === 'k') { ev.preventDefault(); api.send('overlay:nav', -1); }
  else if ((ev.key === 'e' || ev.key === 'E') && pv && pv.item.kind === 'memo') {
    ev.preventDefault();
    const body = heroCard.querySelector('.hero-body');
    if (body && !body.querySelector('textarea')) startInlineEdit();
  }
  else if (ev.key === 'Enter' && pv && pv.item.kind === 'memo') { const id = pv.item.id; pv = null; api.send('overlay:edit', id); }
  else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'c' && pv) api.send('overlay:copy', pv.item.id);
});

// ---------------------------------------------------------------------------
// Flights (CaptureFlight.fly) & falls (CaptureFlight.fall)
// ---------------------------------------------------------------------------

function fxMemoInner(item) {
  const first = String(item.memo.text || '').split('\n')[0].replace(/^#+\s*/, '');
  const lines = String(item.memo.text || '').split('\n').length;
  return `<div class="fx-inner" style="background:${window.cardGradient(item.memo.color, window.CARD_BG_PREVIEW)}">
    <div class="fx-head">${escapeHtml(first.slice(0, 14))}</div>
    ${Array.from({ length: Math.min(lines, 6) }, (_, i) => `<div class="fx-line ${i % 3 === 2 ? 'w60' : 'w80'}"></div>`).join('')}
  </div>`;
}

api.on('flight', ({ item, from, to }) => {
  const el = document.createElement('div');
  el.className = 'fx-card';
  el.innerHTML = `<div class="fx-peg"></div>${item.kind === 'memo' ? fxMemoInner(item) : `<img src="${item.thumb}">`}`;
  el.style.left = (from ? from.x : to.x) + 'px';
  el.style.top = (from ? from.y : to.y - 30) + 'px';
  el.style.width = (from ? from.w : to.w) + 'px';
  el.style.height = (from ? from.h : to.h) + 'px';
  fxLayer.appendChild(el);

  if (!from) { // drop-in arrival from just above the slot
    el.animate([
      { transform: `translateY(-60px) rotate(${item.tilt + 8}deg)`, opacity: 0 },
      { transform: `translateY(0) rotate(${item.tilt}deg)`, opacity: 1 },
    ], { duration: 420, easing: 'cubic-bezier(0.22, 1.24, 0.42, 1)' })
      .finished.then(() => el.remove());
    return;
  }

  const dx = to.x - from.x, dy = to.y - from.y;
  const sx = to.w / from.w, sy = to.h / from.h;
  // Arc: the card lifts a little against gravity mid-flight, like the original.
  const lift = Math.min(70, Math.max(30, Math.abs(dx) * 0.12));
  const anim = el.animate([
    { transform: 'translate(0,0) scale(1,1) rotate(0deg)', opacity: 1 },
    { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - lift}px) scale(${(1 + sx) / 2},${(1 + sy) / 2}) rotate(${(item.tilt || 0) * 0.4}deg)`, opacity: 1, offset: 0.52 },
    { transform: `translate(${dx}px, ${dy}px) scale(${sx},${sy}) rotate(${item.tilt || 0}deg)`, opacity: 0.9 },
  ], { duration: 520, easing: 'cubic-bezier(0.30, 0.9, 0.36, 1)' });
  anim.finished.then(() => el.remove());
});

api.on('fall', ({ item, from }) => {
  const el = document.createElement('div');
  el.className = 'fx-card';
  el.innerHTML = item.kind === 'memo' ? fxMemoInner(item) : `<img src="${item.thumb}">`;
  el.style.left = from.x + 'px';
  el.style.top = from.y + 'px';
  el.style.width = from.w + 'px';
  el.style.height = from.h + 'px';
  el.style.transform = `rotate(${item.tilt || 0}deg)`;
  fxLayer.appendChild(el);
  const dir = Math.random() < 0.5 ? -1 : 1;
  const fall = window.innerHeight - from.y + 80;
  const tilt = item.tilt || 0;
  // R24: torn-card feel — drift sideways, spin up, shrink slightly, fade late.
  // R160: crumple-first — the torn card squeezes into a paper ball (scale 0.5
  // + two full twists, ~350ms) before the drop (~630ms); 980ms total = 780ms
  // + 200ms cap, matched by the overlay hide timer in main.js.
  el.animate([
    { transform: `rotate(${tilt}deg) translateY(0) scale(1)`, opacity: 1, easing: 'cubic-bezier(0.55, 0, 0.45, 1)' },
    { transform: `rotate(${tilt + dir * 400}deg) translateY(0) scale(0.62, 0.82)`, opacity: 1, offset: 0.18, easing: 'cubic-bezier(0.55, 0, 0.45, 1)' },
    { transform: `rotate(${tilt + dir * 720}deg) translateY(0) scale(0.5)`, opacity: 1, offset: 0.36 },
    { transform: `rotate(${tilt + dir * 740}deg) translateY(${fall * 0.35}px) translateX(${dir * 40}px) scale(0.48)`, opacity: 1, offset: 0.68 },
    { transform: `rotate(${tilt + dir * 754}deg) translateY(${fall}px) translateX(${dir * 90}px) scale(0.44)`, opacity: 0 },
  ], { duration: 980, easing: 'cubic-bezier(0.4, 0, 0.7, 0.35)' })
    .finished.then(() => el.remove());
});

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

api.on('show-preview', showPreview);

// ---- v1.6 文档悬停弹出阅读（line 悬停文档卡 320ms 后由主进程锚位弹出） ------
let peekEl = null, peekDispose = null, peekItem = null, peekToken = 0;

api.on('show-doc-peek', async ({ item, panel }) => {
  const token = ++peekToken;
  peekItem = item;
  hideDocPeek(true);
  // 保险：清掉一切游离的旧面板（异步竞态下 peekEl 引用可能已漂移）
  document.querySelectorAll('.doc-peek').forEach(n => n.remove());
  peekEl = document.createElement('div');
  peekEl.className = 'doc-peek';
  peekEl.style.left = panel.x + 'px';
  peekEl.style.top = panel.y + 'px';
  peekEl.style.width = panel.w + 'px';
  peekEl.style.height = panel.h + 'px';
  peekEl.innerHTML =
    '<div class="doc-peek-host"></div>' +
    '<div class="doc-peek-bar">' +
    '<span class="doc-peek-hint">粘性阅读 · 点面板外或按 Esc 关闭</span>' +
    '<span class="peek-spacer"></span>' +
    '<button class="peek-btn" data-pk="preview" role="button">大图阅读</button>' +
    '<button class="peek-btn primary" data-pk="open" role="button">打开文档</button>' +
    '<button class="peek-x" data-pk="close" role="button" aria-label="关闭阅读">' +
    '<svg viewBox="0 0 24 24" width="13" height="13"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>' +
    '</button>' +
    '</div>';
  document.body.appendChild(peekEl);
  requestAnimationFrame(() => peekEl && peekEl.classList.add('in'));
  // 粘性：鼠标移出不关闭。关闭 = Esc / 点面板外 / ✕ / 大图 / 打开
  peekEl.addEventListener('click', ev => {
    const b = ev.target.closest('[data-pk]');
    if (!b) return;
    if (b.dataset.pk === 'open') {
      api.send('line:open', item.id);
      hideDocPeek();
      api.send('line:doc-peek-close', { reason: 'open' });
    } else if (b.dataset.pk === 'close') {
      hideDocPeek();
      api.send('line:doc-peek-close', { reason: 'x' });
    } else {
      // 大图阅读：关掉弹出，走完整预览（同一条 line:open-preview 链路）
      const id = item.id;
      hideDocPeek();
      api.send('line:doc-peek-close', { reason: 'preview' });
      api.send('line:open-preview', id);
    }
  });
  const host = peekEl.querySelector('.doc-peek-host');
  try {
    const { el, dispose } = await window.DOCR.buildReader(item, { width: panel.w - 26, pdfPages: 5 });
    if (token !== peekToken || !peekEl || !host.isConnected) { dispose(); return; }
    host.appendChild(el);
    peekDispose = dispose;
  } catch { /* buildReader 内部已渲染错误态 */ }
});

// ---- v1.7 时光晾衣绳：归档便签按周回忆板（点卡片恢复上绳） ----
let memEl = null;
api.on('show-memory', ({ weeks, count }) => {
  if (memEl) memEl.remove();
  memEl = document.createElement('div');
  memEl.className = 'memory-board in';
  const rows = weeks.length ? weeks.map(w =>
    '<div class="mem-week"><div class="mem-week-label">🕰 ' + window.escapeHtml(w.label) + '</div>' +
    '<div class="mem-row">' + (w.items.length ? w.items.map(it =>
      '<div class="mem-card' + (it.isDone ? ' done' : '') + '" data-i="' + it.i + '" style="background:' + window.cardGradient(it.color) + '" title="点击放回晾衣绳">' +
      '<div class="mem-text">' + window.escapeHtml(it.text.replace(/\s+/g, ' ').slice(0, 64)) + '</div>' +
      '<div class="mem-date">' + window.escapeHtml(it.date) + (it.isDone ? ' · ✓ 已完成' : '') + '</div></div>').join('')
      : '<div class="mem-empty">这一周没有留下便签</div>') + '</div></div>').join('')
    : '<div class="mem-empty big">归档还空空的——撕下的便签会来到这里</div>';
  memEl.innerHTML =
    '<div class="mem-head"><span class="mem-title">🕰 时光晾衣绳</span>' +
    '<span class="mem-count">归档 ' + count + ' 条 · 点击卡片放回绳上</span>' +
    '<button class="mem-close" role="button" aria-label="关闭回忆板">✕</button></div>' +
    '<div class="mem-scroll">' + rows + '</div>';
  document.body.appendChild(memEl);
  const close = () => { if (memEl) { memEl.remove(); memEl = null; } api.send('memory:close'); };
  memEl.querySelector('.mem-close').addEventListener('click', close);
  memEl.addEventListener('click', ev => {
    const card = ev.target.closest('.mem-card');
    if (!card) return;
    api.send('memory:restore', Number(card.dataset.i));
    card.classList.add('restored');
    card.title = '已放回晾衣绳 ✓';
  });
  memEl.querySelector('.mem-close').addEventListener('click', close);
  document.addEventListener('keydown', function memEsc(ev) {
    if (ev.key === 'Escape' && memEl) { memEl.remove(); memEl = null; api.send('memory:close'); document.removeEventListener('keydown', memEsc, true); }
  }, true);
});

// 点面板外 = 关闭（粘性阅读的唯一点击出口；滚绳/Esc/✕ 亦然）
document.addEventListener('mousedown', ev => {
  if (!peekEl) return;
  if (peekEl.contains(ev.target)) return;
  hideDocPeek();
  api.send('line:doc-peek-close', { reason: 'outside' });
}, true);

api.on('doc-peek-close', () => hideDocPeek());

function hideDocPeek(quick) {
  if (peekDispose) { peekDispose(); peekDispose = null; }
  if (!peekEl) return;
  const el = peekEl;
  peekEl = null;
  peekItem = null;
  if (quick) { el.remove(); return; }
  el.classList.remove('in');
  setTimeout(() => el.remove(), 180);
}

document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape' && peekEl) {
    ev.stopImmediatePropagation();
    ev.preventDefault();
    hideDocPeek();
    api.send('line:doc-peek-close', { reason: 'esc' });
  }
}, true);
