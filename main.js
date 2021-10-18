const {
  app, BrowserWindow, ipcMain, dialog,
} = require('electron');
const path = require('path');
const fs = require('fs');
const common = require('./src/common');
const Store = require('./src/store');

let _axios = null;

const RELEASE_VERSION_URL = 'https://api.github.com/repos/Haeri/MonolithCode2/releases/latest';
const RELEASE_ZIP_URL = 'https://github.com/Haeri/MonolithCode2/releases/latest/download/';

let newVersion = null;
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
      media_div_percent: '100%',
      console_div_percent: '100%',
      font_size: 10,
      line_wrapping: true,
      line_numbers: true,
    },
    window_config: {
      rounded_window: true,
      auto_update: true,
    }
  },
});

function requireAxios() {
  if (_axios === null) {
    _axios = require('axios').default;
  }
  return _axios;
}

function downloadLatestVersion() {
  requireAxios()
    .get(RELEASE_ZIP_URL + common.PLATFORM_ZIP[process.platform], { responseType: 'stream' })
    .then((response) => {
      response.data.pipe(fs.createWriteStream('monolith.zip'))
        .on('close', () => {
          shouldUpdate = true;
          BrowserWindow.getAllWindows().forEach((w) => {
            w.webContents.send('print', { text: `new version ${newVersion} will be installed after restart.` });
          });
        });
    });
}

function checkLatestVersion() {
  if (fs.existsSync('./src')) return;

  requireAxios()
    .get(RELEASE_VERSION_URL)
    .then((response) => {
      const info = response.data;

      if (app.getVersion() !== info.tag_name) {
        const currArr = app.getVersion().split('.');
        const latestArr = info.tag_name.split('.');

        if (parseInt(currArr[0], 10) < parseInt(latestArr[0], 10)
          || parseInt(currArr[1], 10) < parseInt(latestArr[1], 10)
          || parseInt(currArr[2], 10) < parseInt(latestArr[2], 10)) {
          newVersion = info.tag_name;
          downloadLatestVersion();
        }
      }
    }).catch((error) => {
      console.log(error);
    });
}

function doUpdate() {
  const child = require('child_process').spawn(`./${app.getVersion()}/updater${common.getExeExtension()}`, [], { detached: true, stdio: 'ignore' });
  child.unref();
}

function createWindow(caller = undefined, filePath = undefined) {
  const { width, height } = store.get('window_bounds');
  const { rounded_window } = store.get('window_config');
  const win = new BrowserWindow({
    ...caller && { x: caller.getPosition()[0] + 30 },
    ...caller && { y: caller.getPosition()[1] + 30 },
    width,
    height,
    frame: false,
    hasShadow: true,
    transparent: rounded_window,
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
  const winConf = store.get('window_config');
  const path = store.getFilePath();
  event.returnValue = { conf, winConf, path };
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

// Linux transparency hack
// from https://github.com/electron/electron/issues/25153
let delay = 0;
if (process.platform === 'linux') {
  delay = 200;
  app.commandLine.appendSwitch('use-gl', 'desktop');
}

app.whenReady().then(() => {
  setTimeout(createWindow, delay);

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  if (store.get('window_config').auto_update) {
    setTimeout(() => {
      checkLatestVersion();
    }, 8000);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();

  if (shouldUpdate) {
    doUpdate();
  }
});
