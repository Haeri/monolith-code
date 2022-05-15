const ipc = require('electron').ipcRenderer;

// Inject html content
ipc.on('fill_content', (e, data) => {
  document.getElementsByTagName('body')[0].innerHTML = data;
});