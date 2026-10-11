'use strict';
/* R99: desktop sticky note — torn off the rope by dragging. Lives until the
   user closes it (which returns the card to the line). Session-only. */
const api = window.sun;
const id = (new URLSearchParams(location.search)).get('id')
  || (process.argv && process.argv.find(a => a.startsWith('--sticky-id=')) || '').replace('--sticky-id=', '');
const content = document.getElementById('content');
const title = document.getElementById('title');

const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* R138: memo color → #paper background gradient. Values live in sticky.css
   (body.memo.color-<name> #paper overrides); yellow is the default there, so
   unknown/absent colors fall back to it via this map. */
const COLOR_CLASS = { yellow: 'yellow', green: 'green', pink: 'pink', blue: 'blue', grape: 'grape' };

function renderMemo(text) {
  const html = String(text || '').split('\n').map(line => {
    const t = line.trim();
    if (/^(-|\*)? ?\[x\] /i.test(t)) return `<span class="todo done">☑ ${esc(t.replace(/^(-|\*)? ?\[x\] /i, ''))}</span>`;
    if (/^(-|\*)? ?\[ \] /.test(t)) return `<span class="todo">☐ ${esc(t.replace(/^(-|\*)? ?\[ \] /, ''))}</span>`;
    if (/^#{1,6} /.test(t)) return `<b>${esc(t.replace(/^#{1,6} /, ''))}</b>`;
    if (/^> /.test(t)) return `<span style="opacity:.7">▏${esc(t.slice(2))}</span>`;
    return esc(line);
  }).join('\n');
  content.innerHTML = html;
}

/* R99b: click-to-edit — editing swaps in the raw text (plain text keeps the
   line breaks; avoids baking the ☑/▏ decorations into the saved memo). */
let memoRaw = '';
let editing = false;

function refreshTitle(text) {
  title.textContent = String(text || '').split('\n')[0].replace(/^#{1,6} /, '').slice(0, 18) || '桌面便签';
}

function enterEdit() {
  if (editing || document.body.classList.contains('photo')) return;
  editing = true;
  content.textContent = memoRaw;
  content.contentEditable = 'true';
  content.focus();
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(content);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

function exitEdit() {
  if (!editing) return;
  editing = false;
  content.contentEditable = 'false';
  const text = content.textContent || '';
  if (!text.trim()) { renderMemo(memoRaw); return; }
  if (text !== memoRaw) { memoRaw = text; api.send('sticky:save-text', { id, text }); }
  renderMemo(text);
  refreshTitle(text);
}

content.title = '点击编辑';
content.addEventListener('click', enterEdit);
content.addEventListener('blur', exitEdit);

api.invoke('sticky:data', id).then(item => {
  if (!item) { document.getElementById('paper').style.opacity = 0.4; title.textContent = '（便签已不存在）'; return; }
  if (item.kind === 'memo') {
    document.body.classList.add('memo');
    document.body.classList.add('color-' + (COLOR_CLASS[item.memo && item.memo.color] || 'yellow'));
    memoRaw = String(item.memo && item.memo.text || '');
    refreshTitle(memoRaw);
    renderMemo(memoRaw);
  } else {
    document.body.classList.add('photo');
    title.textContent = decodeURIComponent((item.fileUrl || '').split('/').pop() || '').slice(0, 20);
    content.innerHTML = `<img src="${item.fileUrl}" alt="">`;
  }
}).catch(() => {});

function back() { api.send('sticky:return', id); }
document.getElementById('backBtn').addEventListener('click', back);
document.getElementById('closeBtn').addEventListener('click', back);
window.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.ctrlKey && editing) { e.preventDefault(); content.blur(); return; }
  if (e.key === 'Escape') { if (editing) { content.blur(); } else back(); }
  if (e.key === 'Escape') closeMenu();
});

/* R151: 文字便签右键小菜单 —— 置顶切换 / 半透明切换 / 放回晾衣绳。
   自制 div 绝对定位在光标处；点击菜单外关闭。窗口创建时即 alwaysOnTop，初态为已置顶。 */
let ontop = true;
let dim = false;
let menuEl = null;

function closeMenu() {
  if (!menuEl) return;
  menuEl.remove();
  menuEl = null;
  document.removeEventListener('mousedown', onDocDown, true);
}
function onDocDown(e) { if (menuEl && !menuEl.contains(e.target)) closeMenu(); }

function openMenu(x, y) {
  closeMenu();
  menuEl = document.createElement('div');
  menuEl.className = 'sticky-menu';
  menuEl.innerHTML =
    `<div class="mi" data-act="ontop">${ontop ? '取消置顶' : '置顶窗'}</div>` +
    `<div class="mi" data-act="dim">${dim ? '恢复不透明' : '半透明'}</div>` +
    `<div class="mi" data-act="back">放回晾衣绳</div>`;
  document.body.appendChild(menuEl);
  const r = menuEl.getBoundingClientRect();
  menuEl.style.left = Math.max(4, Math.min(x, window.innerWidth - r.width - 6)) + 'px';
  menuEl.style.top = Math.max(4, Math.min(y, window.innerHeight - r.height - 6)) + 'px';
  menuEl.addEventListener('click', ev => {
    const mi = ev.target.closest('.mi');
    if (!mi) return;
    const act = mi.dataset.act;
    closeMenu();
    if (act === 'ontop') { ontop = !ontop; api.send('sticky:ontop', { id, on: ontop }); }
    else if (act === 'dim') { dim = !dim; api.send('sticky:opacity', { id }); }
    else if (act === 'back') api.send('sticky:return', id);
  });
  document.addEventListener('mousedown', onDocDown, true);
}

content.addEventListener('contextmenu', e => {
  if (!document.body.classList.contains('memo')) return;
  e.preventDefault();
  openMenu(e.clientX, e.clientY);
});
