const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('controls', {
  initialize: () => ipcRenderer.invoke('initialize'),
  beginRouting: () => ipcRenderer.invoke('begin-routing'),
  saveOutput: output => ipcRenderer.invoke('save-output', output),
  stopRouting: () => ipcRenderer.send('stop-routing'),
  resourceHost: (action, host) => ipcRenderer.invoke('resource-host', action, host),
  unlockSettings: password => ipcRenderer.invoke('unlock-settings', password),
  command: command => ipcRenderer.send('command', command),
  on: (channel, callback) => { if (['blocked', 'stop-routing', 'page', 'settings-visible', 'settings-auth'].includes(channel)) ipcRenderer.on(channel, (_event, data) => callback(data)); }
});
