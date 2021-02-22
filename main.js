const { app, BrowserWindow, ipcMain } = require('electron')
const path = require("path");
const Store = require('./src/store.js');

const store = new Store({
  configName: 'user-preferences',
  defaults: {
    windowBounds: {
      width: 800,
      height: 600
    }
  }
});

ipcMain.on('new-window', () => {
  createWindow();
})


function createWindow() {
  let { width, height } = store.get('windowBounds');

  let win = new BrowserWindow({
    width,
    height,
    frame: false,
    hasShadow: true,
    transparent: true, 
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webviewTag: true
    },
    icon: path.join(__dirname, 'res/img/icon.png')
  });

  win.on('resize', () => {
    let { width, height } = win.getBounds();
    store.set('windowBounds', { width, height });
  });

  win.loadFile('index.html')
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})