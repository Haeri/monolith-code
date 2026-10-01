const {
  contextBridge, ipcRenderer, webFrame, webUtils,
} = require('electron');

window.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add(`platform-${process.platform}`);
}, { once: true });

const processHandlers = new Map();
let processCounter = 0;

ipcRenderer.on('process-event', (_, id, type, data) => {
  const handlers = processHandlers.get(id);
  if (!handlers) return;

  handlers[type]?.(data);
  if (type === 'close') processHandlers.delete(id);
});

function spawnProcess(command, args, cwd) {
  // The id is generated here so handlers exist before the first event can arrive
  processCounter += 1;
  const id = `${Date.now()}-${processCounter}`;
  const handlers = {};
  processHandlers.set(id, handlers);

  ipcRenderer.send('spawn-process', id, command, args, cwd);

  return {
    registerHandler: (event, callback) => {
      handlers[event] = callback;
    },
    dispatch: (event, data) => {
      if (event === 'stdin') {
        ipcRenderer.send('process-stdin', id, data);
        return undefined;
      }
      if (event === 'kill') {
        return ipcRenderer.invoke('process-kill', id);
      }
      return undefined;
    },
  };
}

webFrame.setVisualZoomLevelLimits(1, 3);

const API = {

  // Getter
  getInitialSettings: () => ipcRenderer.invoke('initial-settings'),

  // Window API
  minimize: () => ipcRenderer.send('minimize'),
  maximize: () => ipcRenderer.send('maximize'),
  unmaximize: () => ipcRenderer.send('unmaximize'),
  toggleMaxUnmax: () => ipcRenderer.send('toggle-max-unmax'),
  close: () => ipcRenderer.send('close'),
  togglePin: () => ipcRenderer.invoke('toggle-pin'),
  newWindow: (filePaths) => ipcRenderer.send('new-window', filePaths),
  setTitle: (title) => ipcRenderer.send('set-title', title),

  // Features API
  showOpenDialog: () => ipcRenderer.invoke('show-open-dialog'),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),

  storeSetting: (key, value) => ipcRenderer.send('store-setting', key, value),

  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),

  spawnProcess: (command, args, cwd) => spawnProcess(command, args, cwd),
  markedParse: (markdown) => ipcRenderer.invoke('markdown-parse', markdown),
  openDevTool: (targetId, devtoolsId) => ipcRenderer.send('open-devtools', targetId, devtoolsId),
  getPathForFile: (file) => webUtils.getPathForFile(file),

  // Handler
  updateMaxUnmax: (callback) => ipcRenderer.on('update-max-unmax', callback),
  canClose: (callback) => ipcRenderer.on('can-close', callback),
  canCloseResponse: (response) => ipcRenderer.send('can-close-response', response),
  print: (callback) => ipcRenderer.on('print', callback),

};

contextBridge.exposeInMainWorld('api', API);
