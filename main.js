const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const Store = require('./src/store');

// Just use fetch
let _axios = null;

let lazyRequires = {
  dialog: null,
  fsp: null,

  common: null
};

const RELEASE_VERSION_URL = 'https://api.github.com/repos/Haeri/MonolithCode2/releases/latest';
const RELEASE_ZIP_URL = 'https://github.com/Haeri/MonolithCode2/releases/latest/download/';

let newVersion = null;
let shouldUpdate = false;

let filePathsToOpen = [];

const localStore = new Store({
  configName: 'local-settings',
  defaults: {
    window_config: {
      x: undefined,
      y: undefined,
      width: 800,
      height: 600,
      maximized: false,
    }
  },
});
const userPrefStore = new Store({
  configName: 'user-preferences',
  defaults: {
    window_config: {
      rounded_window: true,
    },
    editor_config: {
      theme: 'ace/theme/monokai',
      media_div_percent: '100%',
      console_div_percent: '100%',
      font_size: 10,
      line_wrapping: true,
      line_numbers: true,
    },
    app_config: {
      auto_update: true,
    }
  },
});
const langStore = new Store({
  configName: 'lang-settings',
  defaults: {
    language_config: {}
  },
});

function requireAxios() {
  if (_axios === null) {
    _axios = require('axios').default;
  }
  return _axios;
}

function dialog() {
  if (lazyRequires.dialog === null) {
    lazyRequires.dialog = require('electron').dialog;
  }
  return lazyRequires.dialog;
}
function fsp() {
  if (lazyRequires.fsp === null) {
    lazyRequires.fsp = require('fs').promises;
  }
  return lazyRequires.fsp;
}
function common() {
  if (lazyRequires.common === null) {
    lazyRequires.common = require('./src/common');
  }
  return lazyRequires.common;
}



function downloadLatestVersion() {
  requireAxios()
    .get(RELEASE_ZIP_URL + common().PLATFORM_ZIP[process.platform], { responseType: 'stream' })
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
  let command = `./${app.getVersion()}/updater${common().getExeExtension()}`;
  if (process.platform !== 'win32') {
    command = `chmod +x ./${app.getVersion()}/updater${common().getExeExtension()} && ${command}`;
  }
  const child = require('child_process').spawn(command, [], { detached: true, shell: true });
  child.unref();
}

function createWindow(caller = undefined, filePaths = []) {
  filePathsToOpen = filePaths;
  let { x, y, width, height, maximized } = localStore.get('window_config');
  let { rounded_window } = userPrefStore.get('window_config');

  if (caller) {
    x = caller.getPosition()[0] + 30;
    y = caller.getPosition()[1] + 30;
  }

  const win = new BrowserWindow({
    ...x && { x },
    ...y && { y },
    width,
    height,
    frame: false,
    hasShadow: true,
    transparent: rounded_window,
    backgroundColor: rounded_window ? '#00000000' : '#212121',
    titleBarStyle: 'hidden',
    show: false,
    minWidth: 220,
    minHeight: 300,
    webPreferences: {
      preload: path.join(__dirname, 'src/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
    },
    icon: path.join(__dirname, 'res/img/icon.png'),
  });

  win.on('close', (e) => {
    e.returnValue = false;
    e.preventDefault();

    win.webContents.send('can-close');
  });

  win.on('resized', () => {
    const { x, y, width, height } = win.getBounds();
    const prev = localStore.get('window_config');
    localStore.set('window_config', { ...prev, ...{ x, y, width, height } });
  });

  win.on('maximize', () => {
    localStore.set('window_config.maximized', true);
    win.webContents.send('update-max-unmax', true);
  });

  win.on('unmaximize', () => {
    localStore.set('window_config.maximized', false);
    win.webContents.send('update-max-unmax', false);
  });

  win.once('ready-to-show', () => {
    win.show();
    if (maximized) {
      win.maximize();
    }
  });

  win.loadFile('index.html');
}





ipcMain.handle('initial-settings', () => {
  const editorConfig = userPrefStore.get('editor_config');
  const windowConfig = userPrefStore.get('window_config');
  const localWindowConfig = localStore.get('window_config')
  const languageConfig = langStore.get('language_config');
  const userPrefPath = userPrefStore.getFilePath();
  const languageConfigPath = langStore.getFilePath();
  return {
    appInfo: {
      name: 'monolith code',
      version: app.getVersion(),
      os: process.platform
    },
    filePathsToOpen,
    editorConfig, windowConfig,
    localWindowConfig, languageConfig,
    userPrefPath, languageConfigPath
  };
});



ipcMain.on('minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win.minimize();
});
ipcMain.on('maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win.maximize();
});
ipcMain.on('unmaximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win.unmaximize();
});
ipcMain.on('toggle-max-unmax', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win.isMaximized()) {
    win.maximize();
  } else {
    win.unmaximize();
  }
});
ipcMain.handle('toggle-pin', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const pinned = win.isAlwaysOnTop();
  win.setAlwaysOnTop(!pinned);
  return pinned;
});

ipcMain.on('close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win.close();
});

ipcMain.handle('show-open-dialog', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return await dialog().showOpenDialog(win, { title: 'Open a file' });
});

ipcMain.handle('show-save-dialog', async (event, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return await dialog().showSaveDialog(win, options);
});


ipcMain.on('new-window', (event, filePaths) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  createWindow(win, filePaths);
});
ipcMain.on('store-setting', (_, key, value) => {
  const conf = userPrefStore.get('editor_config');
  conf[key] = value;
  userPrefStore.set('editor_config', conf);
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

    const ret = dialog().showMessageBoxSync(win, options);

    if (ret !== 1) {
      return;
    }
  }

  win.destroy();
});



// TEMPFIX: Linux transparency hack
// from https://github.com/electron/electron/issues/25153
let delay = 0;
if (process.platform === 'linux' && userPrefStore.get('window_config').rounded_window) {
  delay = 200;
  app.commandLine.appendSwitch('use-gl', 'desktop');
}

app.whenReady().then(() => {
  setTimeout(() => {
    let num = app.isPackaged ? 1 : 2;
    createWindow(null, process.argv.slice(num));
  }, delay);

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  if (userPrefStore.get('app_config').auto_update) {
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