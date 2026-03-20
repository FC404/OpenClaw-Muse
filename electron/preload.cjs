const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('clawMuseLogs', {
  getSnapshot: () => ipcRenderer.invoke('logs:snapshot'),
  refresh: () => ipcRenderer.invoke('logs:refresh'),
  onUpdate: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('logs:update', handler);
    return () => ipcRenderer.removeListener('logs:update', handler);
  }
});
