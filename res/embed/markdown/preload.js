const ipc = require('electron').ipcRenderer;

ipc.on('fillContent', (e, data) => {
    document.getElementsByTagName('body')[0].innerHTML = data;
});