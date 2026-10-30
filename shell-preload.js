const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('controls', {
  syncOffset: value => ipcRenderer.invoke('sync-offset', value),
  syncInput: event => ipcRenderer.send('sync-input', event),
  syncFailed: () => ipcRenderer.send('sync-failed'),
  initialize: () => ipcRenderer.invoke('initialize'),
  beginRouting: () => ipcRenderer.invoke('begin-routing'),
  saveOutput: output => ipcRenderer.invoke('save-output', output),
  stopRouting: () => ipcRenderer.send('stop-routing'),
  resourceHost: (action, host) => ipcRenderer.invoke('resource-host', action, host),
  unlockSettings: password => ipcRenderer.invoke('unlock-settings', password),
  command: command => ipcRenderer.send('command', command),
  on: (channel, callback) => { if (['sync-offset', 'blocked', 'stop-routing', 'page', 'settings-visible', 'settings-auth', 'fullscreen-state'].includes(channel)) ipcRenderer.on(channel, (_event, data) => callback(data)); }
});
