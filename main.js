const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require("path");
const Store = require('./src/store.js');

const store = new Store({
  configName: 'user-preferences',
  defaults: {
    windowBounds: {
      width: 800,
      height: 600
    },
    editor_media_div_percent: 0,
    editor_console_div_percent: 0,
  }
});

ipcMain.on('new-window', (event, file_path) => {
  let win = BrowserWindow.fromWebContents(event.sender);
  createWindow(win, file_path);
})

ipcMain.on('store-setting', (event, key, value) => {
  store.set(key, value);
});
ipcMain.on('get-setting', (event, key) => {
  event.returnValue = store.get(key);
});

ipcMain.on('can-close-response', (event, can_close) => {
  let win = BrowserWindow.fromWebContents(event.sender);
  if (!can_close) {
    const options = {
      type: 'question',
      buttons: ['Cancel', 'Yes', 'No'],
      defaultId: 2,
      title: 'Unsaved Content',
      message: 'Do you want to quit the application without saving?',
      detail: 'You will loose the current document'
    };

    let ret = dialog.showMessageBoxSync(win, options);

    if (ret != 1) {
      return;
    }
  }

  win.destroy();
});


function createWindow(caller = undefined, file_path = undefined) {
  let { width, height } = store.get('windowBounds');

  let win = new BrowserWindow({
    ...caller && {x: caller.getPosition()[0]+20}, 
    ...caller && {y: caller.getPosition()[1]+20},
    width,
    height,
    frame: false,
    hasShadow: true,
    transparent: true,
    titleBarStyle: 'hidden',
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webviewTag: true,
      ...file_path && {additionalArguments: [`--open-file="${file_path}"`]}
    },
    icon: path.join(__dirname, 'res/img/icon.png')
  });

  win.on("close", (e) => {
    e.returnValue = false;
    e.preventDefault();

    win.webContents.send('can-close');
  });

  win.on('resize', () => {
    let { width, height } = win.getBounds();
    store.set('windowBounds', { width, height });
  });

  win.once('ready-to-show', () => {
    win.show()
  })

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