'use strict';
const api = window.sun;
document.getElementById('closeBtn').addEventListener('click', () => window.close());
// CSV 导出：快照当前近 7 日趋势 + 汇总，一次性构建并下载（BOM 保证 Excel 中文不乱码）
let curDays = [];
let curSum = { onLine: 0, todosDone: 0, todosTotal: 0, torn: 0, archived: 0 };
const csvBtn = document.getElementById('csvBtn');
function exportCsv() {
  const rows = [['日期', '撕下数']];
  curDays.forEach(d => rows.push([d.label, String(d.n)]));
  rows.push([]);
  rows.push(['指标', '值']);
  rows.push(['在绳便签', String(curSum.onLine)]);
  rows.push(['待办完成', curSum.todosDone + '/' + curSum.todosTotal]);
  rows.push(['本周撕下', String(curSum.torn)]);
  rows.push(['历史归档', String(curSum.archived)]);
  const csv = '\uFEFF' + rows.map(r => r.join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = 'sunmemo-stats.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
if (csvBtn) csvBtn.addEventListener('click', exportCsv);
// R155: 趋势窗口偏移（0=本 7 日，7=上 7 日），胶囊切换后整体前移重渲染
let curOff = 0;
let lastD = null;
function loadData(d, off = curOff) {
  document.getElementById('nOnLine').textContent = d.onLine;
  // R60: 近 7 日趋势（按归档撕下时间统计）；R155: 窗口可整体前移 7 天
  const now = Date.now();
  const days = [];
  for (let i = off + 6; i >= off; i--) {
    const day = new Date(now - i * 86400000);
    days.push({ key: day.toDateString(), label: (day.getMonth() + 1) + '/' + day.getDate(), n: 0 });
  }
  const prevKeys = new Set();
  for (let i = off + 13; i >= off + 7; i--) prevKeys.add(new Date(now - i * 86400000).toDateString());
  let prevN = 0;
  (d.recentTorn || []).forEach(iso => {
    const k = new Date(iso).toDateString();
    const day = days.find(x => x.key === k);
    if (day) day.n++;
    else if (prevKeys.has(k)) prevN++;
  });
  const max = Math.max(1, ...days.map(x => x.n));
  curDays = days; // 供 exportCsv 使用（随当前窗口）
  // 对比行随窗口联动：off=0 为 上周/本周，off=7 为 再上 7 日/上 7 日（按自然日统计）
  const cur = days.reduce((s, x) => s + x.n, 0);
  curSum = { onLine: d.onLine, todosDone: d.todos.done, todosTotal: d.todos.total, torn: d.tornThisWeek, archived: d.archivedAll };
  const cmp = document.getElementById('cmp');
  if (cmp) {
    const arrow = cur > prevN ? '<span class="up">▲</span>'
      : cur < prevN ? '<span class="down">▼</span>' : '<span class="flat">—</span>';
    const pl = off === 0 ? '上周' : '再上 7 日', cl = off === 0 ? '本周' : '上 7 日';
    cmp.innerHTML = `${pl} ${prevN} · ${cl} ${cur} ${arrow}`;
  }
  document.getElementById('trendBars').innerHTML = days.map(day =>
    `<div class="tb"><div class="col" data-n="${day.label} · ${day.n} 条" style="height:${Math.round(day.n / max * 32) + 3}px;opacity:${day.n ? 1 : 0.25}" title="${day.label} 撕下 ${day.n} 条"></div><div class="dl">${day.label}</div></div>`
  ).join('');
  document.getElementById('nTodos').textContent = d.todos.done + '/' + d.todos.total;
  document.getElementById('nTorn').textContent = d.tornThisWeek;
  document.getElementById('nArch').textContent = d.archivedAll;
  // R70: 回收站最近列表（恢复 / 永久删除）
  const rl = document.getElementById('recycleList');
  if (rl) {
    const rows = (d.recentArchived || []);
    rl.innerHTML = rows.length
      ? rows.map(r => `<div class="rec-row"><span class="rt">${r.text || '（空）'}</span><span class="rt2">${r.time}</span><button data-i="${r.index}" data-a="restore">恢复</button><button class="del" data-i="${r.index}" data-a="delete" title="永久删除">🗑</button></div>`).join('')
      : '<div class="rec-empty">回收站为空</div>';
    // 永久删除两次点击确认：首击变"确认删除"（2.5s 内有效），再击才真正删除
    rl.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.a === 'delete' && !b.classList.contains('confirm')) {
        b.classList.add('confirm');
        b.textContent = '确认删除';
        clearTimeout(b._ct);
        b._ct = setTimeout(() => { b.classList.remove('confirm'); b.textContent = '🗑'; }, 2500);
        return;
      }
      clearTimeout(b._ct);
      api.send(b.dataset.a === 'delete' ? 'stats:delete-archive' : 'stats:restore', Number(b.dataset.i));
      setTimeout(() => api.invoke('stats:data').then(loadData), 250);
    }));
  }
  const pct = d.todos.total ? Math.round(d.todos.done / d.todos.total * 100) : 0;
  requestAnimationFrame(() => { document.getElementById('todoBar').style.width = pct + '%'; });
  document.getElementById('todoPct').textContent = pct + '%';
}
// R155: 本 7 日 / 上 7 日 切换胶囊（复用最近一次载荷即时重渲染）
const winSw = document.getElementById('winSw');
if (winSw) winSw.querySelectorAll('.ws').forEach(b => b.addEventListener('click', () => {
  curOff = Number(b.dataset.off) || 0;
  winSw.querySelectorAll('.ws').forEach(x => x.classList.toggle('on', x === b));
  if (lastD) loadData(lastD, curOff);
}));
function fetchData() {
  api.invoke('stats:data').then(d => { lastD = d; loadData(d); }).catch(() => {});
}
fetchData();
api.on('stats:refresh', fetchData); // R103: 载荷此前为空，处理器必抛
window.addEventListener('keydown', e => { if (e.key === 'Escape') window.close(); });
// R167: 窗口入场 —— ready-to-show 后补 .in 触发 stats.css 的 #panel 展开过渡
requestAnimationFrame(() => document.body.classList.add('in'));
