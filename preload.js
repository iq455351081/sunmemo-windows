'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const { webUtils } = require('electron');
contextBridge.exposeInMainWorld('sun', {
  getPathForFile: file => webUtils.getPathForFile(file),
  on: (channel, fn) => ipcRenderer.on(channel, (_e, data) => fn(data)),
  send: (channel, data) => ipcRenderer.send(channel, data),
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
});
