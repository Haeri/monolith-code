const ipc = require('electron').ipcRenderer;

// call onload
ipc.on('onLoad', (e, baseUrl) => {
});

// Inject html content
ipc.on('fill_content', (e, data) => {
  document.getElementsByTagName('body')[0].innerHTML = data;
});