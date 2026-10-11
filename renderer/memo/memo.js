'use strict';
/* QuickMemo editor logic — QuickMemoView + CustomNSTextView port:
   smart checklist continuation on Enter, Ctrl+Enter commit, Esc cancel. */

const api = window.sun;
const qs = new URLSearchParams(location.search);
let init = JSON.parse(qs.get('data') || '{}');

const sheet = document.getElementById('sheet');
const editor = document.getElementById('editor');
const placeholder = document.getElementById('placeholder');
const preview = document.getElementById('preview');
const commitBtn = document.getElementById('commitBtn');
const cancelBtn = document.getElementById('cancelBtn');
const closeBtn = document.getElementById('closeBtn');
const colorDots = document.getElementById('colorDots');
const ratioPills = document.getElementById('ratioPills');
const commitText = document.getElementById('commitText');

document.getElementById('titleIcon').innerHTML =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2" y="2.5" width="12" height="11" rx="2"/><path d="M4.8 6h6.4M4.8 8.5h6.4M4.8 11h4"/></svg>';
closeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2Zm3.5 13.1c.3.3.3.8 0 1.1-.1.1-.3.2-.5.2s-.4-.1-.6-.2L12 13.8l-2.4 2.4c-.2.2-.4.2-.6.2s-.4-.1-.5-.2c-.3-.3-.3-.8 0-1.1l2.4-2.4L8.5 10.3c-.3-.3-.3-.8 0-1.1.3-.3.8-.3 1.1 0l2.4 2.4 2.4-2.4c.3-.3.8-.3 1.1 0 .3.3.3.8 0 1.1L13.1 12.7l2.4 2.4Z"/></svg>';
document.getElementById('pinIcon').innerHTML =
  '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M9.5 1.2a1 1 0 0 0-1.6.3L6.6 4.1 3 5.3a1 1 0 0 0-.4 1.7l2.7 2.6-3 4.1a.5.5 0 0 0 .7.7l4.1-3 2.6 2.7a1 1 0 0 0 1.7-.4l1.2-3.6 2.6-1.3a1 1 0 0 0 .3-1.6Z"/></svg>';

const DOT_COLORS = { yellow: '#fae894', green: '#d1edd1', pink: '#fad4e0', blue: '#cce3fa' };

let color = init.color || 'yellow';
let ratio = init.aspectRatio || 'wide';
let mode = 'edit';
let text = init.draft || init.text || '';

editor.value = text;
if (init.draft) api.send('memo:draft-clear'); // 恢复进编辑器后清掉存档，内容已在此处
// R105 修正：syncText 引用 draftTimer（底部 let，TDZ）——在脚本顶层直接调用
// 会让整个 memo.js 在这一行 ReferenceError 死掉，输入监听/提交按钮全部不接线。
// 延迟到脚本求值完成后执行。
setTimeout(() => syncText(), 0);
if (init.editingId) {
  document.getElementById('titleText').textContent = '编辑便签';
  commitText.textContent = '更新便签';
}

// ---- color dots -----------------------------------------------------------

function renderDots() {
  colorDots.innerHTML = '';
  for (const [name, dotColor] of Object.entries(DOT_COLORS)) {
    const b = document.createElement('button');
    b.className = 'color-dot' + (color === name ? ' active' : '');
    b.title = { yellow: '暖阳黄', green: '薄荷绿', pink: '樱花粉', blue: '晴空蓝' }[name];
    b.setAttribute('aria-label', '便签颜色：' + b.title);
    b.innerHTML = `<span class="dot" style="background:${dotColor}">${color === name ? CHECK_SVG : ''}</span>`;
    b.addEventListener('click', () => { color = name; renderDots(); });
    colorDots.appendChild(b);
  }
  // 关键修复：同步面板底色（之前只改了变量，背景永远不变）
  sheet.classList.remove('color-green', 'color-pink', 'color-blue');
  if (color !== 'yellow') sheet.classList.add('color-' + color);
}
renderDots();

// ---- ratio pills ------------------------------------------------------------

function renderRatio() {
  ratioPills.innerHTML = '';
  for (const key of ['wide', 'square', 'tall']) {
    const r = window.L.RATIOS[key];
    const b = document.createElement('button');
    b.className = 'ratio-pill' + (ratio === key ? ' active' : '');
    b.innerHTML = `<span class="sym">${r.symbol}</span>${r.title}`;
    b.title = r.subtitle;
    b.addEventListener('click', () => {
      ratio = key;
      renderRatio();
      api.send('memo:ratio', key);
    });
    ratioPills.appendChild(b);
  }
}
renderRatio();

// ---- mode -------------------------------------------------------------------

const segBtns = document.querySelectorAll('.seg-btn');
segBtns.forEach(b => b.addEventListener('click', () => {
  mode = b.dataset.mode;
  segBtns.forEach(x => x.classList.toggle('active', x === b));
  sheet.classList.toggle('previewing', mode === 'preview');
  if (mode === 'preview') renderPreview();
}));

function renderPreview() {
  preview.innerHTML = window.renderPreviewBody(editor.value);
}
preview.addEventListener('click', ev => {
  const todo = ev.target.closest('.md-todo');
  if (!todo || todo.dataset.line == null) return;
  const idx = parseInt(todo.dataset.line, 10);
  const lines = editor.value.split('\n');
  const t = (lines[idx] || '').trim();
  if (/^(-|\*)\s+\[ \]\s/.test(t)) lines[idx] = lines[idx].replace(/\[ \]/, '[x]');
  else if (/^(-|\*)\s+\[x\]\s/i.test(t)) lines[idx] = lines[idx].replace(/\[x\]/i, '[ ]');
  else if (/^\[ \]\s/.test(t)) lines[idx] = lines[idx].replace('[ ]', '[x]');
  else if (/^\[x\]\s/i.test(t)) lines[idx] = lines[idx].replace(/\[x\]/i, '[ ]');
  else return;
  editor.value = lines.join('\n');
  renderPreview();
});

// ---- toolbar ------------------------------------------------------------------

document.querySelectorAll('.tb').forEach(b => b.addEventListener('click', () => {
  editor.focus();
  const tool = b.dataset.tool;
  if (tool === 'todo') insertPrefix('- [ ] ');
  else if (tool === 'list') insertPrefix('- ');
  else if (tool === 'heading') insertPrefix('## ');
  else if (tool === 'bold') {
    appendInline('**重点内容**');
  }
}));

const TEMPLATES = {
  todo: '- [ ] \n- [ ] \n- [ ] ',
  meeting: '# 会议记录\n\n- 时间：\n- 参会：\n\n## 议题\n- \n\n## 待办\n- [ ] ',
  week: '# 本周计划\n\n- [ ] 周一：\n- [ ] 周三：\n- [ ] 周五：\n\n> 目标：',
  idea: '## 灵感\n一句话描述：\n\n- 为什么值得做：\n- 下一步：- [ ] ',
};
document.getElementById('tplBtn').addEventListener('click', ev => {
  ev.stopPropagation();
  const old = document.getElementById('tplMenu');
  if (old) { old.remove(); return; }
  const menu = document.createElement('div');
  menu.id = 'tplMenu';
  menu.style.cssText = 'position:absolute;z-index:99;top:78px;left:14px;background:#fff;border-radius:10px;box-shadow:0 8px 22px rgba(0,0,0,0.22);padding:6px;min-width:150px;';
  menu.innerHTML = Object.keys(TEMPLATES).map(k => `<div class="tpl-item" data-k="${k}" style="padding:7px 12px;border-radius:7px;cursor:pointer;font-size:12px">${({ todo: '☑️ 待办清单', meeting: '📝 会议记录', week: '📅 周计划', idea: '💡 灵感速记' })[k]}</div>`).join('');
  sheet.appendChild(menu);
  menu.addEventListener('click', e2 => {
    const it = e2.target.closest('.tpl-item');
    if (it) {
      editor.value = editor.value ? editor.value + '\n' + TEMPLATES[it.dataset.k] : TEMPLATES[it.dataset.k];
      syncText();
      editor.focus();
      editor.selectionStart = editor.selectionEnd = editor.value.length;
    }
    menu.remove();
  });
  setTimeout(() => document.addEventListener('click', function h() { menu.remove(); document.removeEventListener('click', h); }), 0);
});

function insertPrefix(prefix) {
  if (!editor.value) editor.value = prefix;
  else if (editor.value.endsWith('\n')) editor.value += prefix;
  else editor.value += '\n' + prefix;
  editor.selectionStart = editor.selectionEnd = editor.value.length;
  syncText();
}

function appendInline(s) {
  editor.value = editor.value ? editor.value + ' ' + s : s;
  editor.selectionStart = editor.selectionEnd = editor.value.length;
  syncText();
}

// ---- smart Enter (CustomNSTextView.insertNewline port) ------------------------

editor.addEventListener('keydown', ev => {
  if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
    ev.preventDefault();
    commit();
    return;
  }
  if (ev.key === 'Enter' && !ev.shiftKey && !ev.altKey) {
    const pos = editor.selectionStart;
    const before = editor.value.slice(0, pos);
    const lineStart = before.lastIndexOf('\n') + 1;
    const line = before.slice(lineStart);
    const trimmed = line.trim();

    const cont = (prefix) => {
      ev.preventDefault();
      const insert = '\n' + prefix;
      editor.setRangeText(insert, pos, editor.selectionEnd, 'end');
      syncText();
    };
    const breakOut = () => {
      ev.preventDefault();
      // remove the empty marker line, insert plain newline
      editor.setRangeText('\n', lineStart, pos, 'end');
      syncText();
    };

    if (/^(-|\*)\s\[\s\]\s?$/i.test(trimmed)) return breakOut();
    if (/^(-|\*)\s\[\s\]\s\S/i.test(trimmed)) return cont('- [ ] ');
    if (/^(-|\*)\s\[x\]\s/i.test(trimmed)) return cont('- [ ] ');
    if (/^(-|\*)\s(?!\[).*$/.test(trimmed)) {
      if (/^(-|\*)\s?$/.test(trimmed)) return breakOut();
      return cont('- ');
    }
  }
});

const statCount = document.getElementById('statCount');
let draftTimer = null;
function syncText() {
  text = editor.value;
  placeholder.style.display = text ? 'none' : 'block';
  commitBtn.disabled = !text.trim();
  scheduleStat();
  // R57 草稿自动保存（防误关丢失）
  clearTimeout(draftTimer);
  if (!init.editingId && text.trim()) {
    draftTimer = setTimeout(() => api.send('memo:draft-save', { text }), 600);
  }
  if (mode === 'preview') renderPreview();
}
editor.addEventListener('input', syncText);

// ---- 状态栏：N 字 · 行 R 列 C -------------------------------------------------
// 字数=去空白字符数；行列由 selectionStart 前的文本推算（无光标时为行1列1）。
// input/keyup/click 共享一个 150ms 节流 timer（首击立即刷新，冷却期内合并尾随一次）。

let statTimer = null;
let statPending = false;
function updateStat() {
  const pos = typeof editor.selectionStart === 'number' ? editor.selectionStart : 0;
  const before = editor.value.slice(0, pos);
  const row = before.split('\n').length;
  const col = pos - before.lastIndexOf('\n');
  statCount.textContent = `${editor.value.replace(/\s/g, '').length} 字 · 行 ${row} 列 ${col}`;
}
function scheduleStat() {
  if (statTimer) { statPending = true; return; }
  updateStat();
  statTimer = setTimeout(() => {
    statTimer = null;
    if (statPending) { statPending = false; updateStat(); }
  }, 150);
}
editor.addEventListener('keyup', scheduleStat);
editor.addEventListener('click', scheduleStat);

// ---- commit / cancel -------------------------------------------------------------

function commit() {
  const trimmed = editor.value.trim();
  if (!trimmed) return;
  api.send('memo:save', { text: trimmed, color, aspectRatio: ratio });
}
commitBtn.addEventListener('click', commit);
cancelBtn.addEventListener('click', () => api.send('memo:cancel'));
closeBtn.addEventListener('click', () => api.send('memo:cancel'));
document.getElementById('openMd').addEventListener('click', () => api.send('memo:open-md'));

window.addEventListener('keydown', ev => {
  if (ev.key === 'Escape') { ev.preventDefault(); api.send('memo:cancel'); }
  if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey) && document.activeElement !== editor) {
    ev.preventDefault(); commit();
  }
});

// Window reuse: the main process resets the warm editor instead of recreating it.
api.on('memo:reset', data => {
  init = { editingId: data.editingId || null, text: data.text || '', color: data.color || 'yellow', aspectRatio: data.aspectRatio || 'wide', draft: data.draft || '' };
  resetEditor();
});

function resetEditor() {
  color = init.color || 'yellow';
  ratio = init.aspectRatio || 'wide';
  // 草稿优先：先赋值再清存档——此前末尾无条件 editor.value = init.text 把刚恢复的草稿覆盖掉（新建时 text 为空 → 草稿丢失）
  editor.value = init.draft || init.text || '';
  if (init.draft) {
    api.send('memo:draft-clear');
    setTimeout(() => {
      const t = document.createElement('div');
      t.textContent = '已恢复上次未提交的草稿';
      // R167: 与 line.js torn-toast 同款入场/淡出。memo.css 无 toast-in keyframes，
      // 改用元素内联 opacity 过渡 + 两段 setTimeout：入场 300ms，停留 2s，300ms 淡出后移除。
      t.style.cssText = 'position:absolute;top:52px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.55);color:#fff;font-size:11px;padding:4px 12px;border-radius:8px;z-index:9;opacity:0;transition:opacity 300ms ease;';
      sheet.appendChild(t);
      setTimeout(() => { t.style.opacity = '1'; }, 20);
      setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 320); }, 2300);
    }, 60);
  }
  sheet.classList.remove('color-green', 'color-pink', 'color-blue');
  if (color !== 'yellow') sheet.classList.add('color-' + color);
  if (init.editingId) {
    document.getElementById('titleText').textContent = '编辑便签';
    commitText.textContent = '更新便签';
  } else {
    document.getElementById('titleText').textContent = '写下想法 / 待办备忘';
    commitText.textContent = '挂上晾衣绳';
  }
  renderDots();
  renderRatio();
  if (mode === 'preview') {
    mode = 'edit';
    segBtns.forEach(x => x.classList.toggle('active', x.dataset.mode === 'edit'));
    sheet.classList.remove('previewing');
  }
  syncText();
  editor.focus();
}

// demo fill for visual shots
api.on('memo:demo-fill', () => {
  editor.value = '# 🚀 项目待办冲刺\n- [ ] 优化 SunMemo 待办清单交互\n- [ ] 备份数据库与 **配置文件**\n- [x] 修复窗口排版对齐\n> 💡 支持 Markdown 语法与清单，随时打勾';
  syncText();
  editor.focus();
  editor.selectionStart = editor.selectionEnd = editor.value.length;
});

syncText();
editor.focus();
// R167: 窗口入场 —— ready-to-show 后补 .in 触发 memo.css 的 #sheet 展开过渡
// （窗口隐藏期间 rAF 不触发，类在首次 show 后的首帧才加上，正好是入场时机）
requestAnimationFrame(() => document.body.classList.add('in'));
