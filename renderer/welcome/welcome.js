'use strict';
const api = window.sun;
const { invoke } = sun;
invoke('settings:data').then(d => {
  document.getElementById('appIcon').src = d.iconPath;
});
document.getElementById('startBtn').addEventListener('click', () => {
  api.send('welcome:done', { takeover: document.getElementById('chkTakeover').checked });
});
document.getElementById('laterBtn').addEventListener('click', () => {
  api.send('welcome:done', { takeover: false });
});
window.addEventListener('keydown', ev => { if (ev.key === 'Escape') api.send('welcome:done', { takeover: false }); });
