const {
  app, BrowserWindow, ipcMain, dialog,
} = require('electron');
const { options } = require('marked');
const path = require('path');
const fs = require('fs');
const Store = require('./src/store.js');

let _request = null;

const RELEASE_VERSION_URL = 'https://api.github.com/repos/Haeri/MonolithCode2/releases/latest';
const RELEASE_ZIP_URL = 'https://github.com/Haeri/MonolithCode2/releases/latest/download/monolithcode_win.zip';
let shouldUpdate = false;

const store = new Store({
  configName: 'user-preferences',
  defaults: {
    window_bounds: {
      width: 800,
      height: 600,
    },
    editor_config: {
      theme: 'ace/theme/monokai',
      editor_media_div_percent: '100%',
      editor_console_div_percent: '100%',
      line_wrapping: true,
      line_numbers: true,
    },
  },
});

function requireRequest() {
  if (_request === null) {
    _request = require('request');
  }
  return _request;
}

function downloadLatestVersion() {
  requireRequest()(RELEASE_ZIP_URL)
    .pipe(fs.createWriteStream('monolith.zip'))
    .on('close', () => {
      // let win = app.getCurrentWindow();
      console.log('File written!');
      shouldUpdate = true;
    });
}

function checkLatestVersion() {
  if (fs.existsSync('./src')) return;

  const requestOptions = {
    url: RELEASE_VERSION_URL,
    headers: {
      'User-Agent': 'request',
    },
  };
  requireRequest()(requestOptions, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      const info = JSON.parse(body);

      if (app.getVersion() !== info.tag_name) {
        const currArr = app.getVersion().split('.');
        const latestArr = info.tag_name.split('.');

        if (parseInt(currArr[0], 10) < parseInt(latestArr[0], 10)
          || parseInt(currArr[1], 10) < parseInt(latestArr[1], 10)
          || parseInt(currArr[2], 10) < parseInt(latestArr[2], 10)) {
          console.log(`new version available. current ${app.getVersion()}, latest: ${info.tag_name}`);
          downloadLatestVersion();
        }
      }
    } else {
      console.error(error, response);
    }
  });
}

function doUpdate() {
  const child = require('child_process').spawn(`./${app.getVersion()}/updater.exe`, [], { detached: true, stdio: 'ignore' });
  child.unref();
}

function createWindow(caller = undefined, filePath = undefined) {
  const { width, height } = store.get('window_bounds');
  const win = new BrowserWindow({
    ...caller && { x: caller.getPosition()[0] + 30 },
    ...caller && { y: caller.getPosition()[1] + 30 },
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
      ...filePath && { additionalArguments: [`--open-file="${filePath}"`] },
    },
    icon: path.join(__dirname, 'res/img/icon.png'),
  });

  win.on('close', (e) => {
    e.returnValue = false;
    e.preventDefault();

    win.webContents.send('can-close');
  });

  win.on('resize', () => {
    const { w, h } = win.getBounds();
    store.set('window_bounds', { w, h });
  });

  win.once('ready-to-show', () => {
    win.show();
  });

  win.loadFile('index.html');
}

ipcMain.on('new-window', (event, filePath) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  createWindow(win, filePath);
});
ipcMain.on('initial-settings', (event) => {
  const conf = store.get('editor_config');
  event.returnValue = conf;
});
ipcMain.on('store-setting', (event, key, value) => {
  const conf = store.get('editor_config');
  conf[key] = value;
  store.set('editor_config', conf);
});
ipcMain.on('get-setting', (event, key) => {
  const conf = store.get('editor_config');
  event.returnValue = conf[key];
});

ipcMain.on('can-close-response', (event, canClose) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!canClose) {
    const options = {
      type: 'question',
      buttons: ['Cancel', 'Yes', 'No'],
      defaultId: 2,
      title: 'Unsaved Content',
      message: 'Do you want to quit the application without saving?',
      detail: 'You will loose the current document',
    };

    const ret = dialog.showMessageBoxSync(win, options);

    if (ret !== 1) {
      return;
    }
  }

  win.destroy();
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  setTimeout(() => {
    checkLatestVersion();
  }, 8000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();

  if (shouldUpdate) {
    doUpdate();
  }
});
