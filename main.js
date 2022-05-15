const { app, BrowserWindow, ipcMain, webContents } = require('electron');
const { requireLazy, PLATFORM_ZIP } = require('./src/common');
const Store = require('./src/store');
const path = require('path');

const appInfo = {
  name: 'monolith code',
  version: app.getVersion(),
  os: process.platform
};

let axios = requireLazy(() => require('axios').default);
let dialog = requireLazy(() => require('electron').dialog);
let fs = requireLazy(() => require('fs'));


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
      native_frame: false,
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




function downloadLatestVersion() {
  axios.get()
    .get(RELEASE_ZIP_URL + PLATFORM_ZIP[process.platform], { responseType: 'stream' })
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
  if (!app.isPackaged) return;

  axios.get()
    .get(RELEASE_VERSION_URL)
    .then((response) => {
      const info = response.data;

      if (appInfo.version !== info.tag_name) {
        const currArr = appInfo.version.split('.');
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

function createWindow(caller = undefined, filePaths = []) {
  filePathsToOpen = filePaths;
  let { x, y, width, height, maximized } = localStore.get('window_config');
  let { native_frame } = userPrefStore.get('window_config');

  // Force custom frame to remove traficlights
  if (process.platform === 'darwin') {
    native_frame = false;
  }

  let windowConfig = {}
  if (native_frame) {
    windowConfig = {
      frame: false,
      hasShadow: true,
      backgroundColor: '#212121',
    }
  } else {
    windowConfig = {
      frame: false,
      transparent: true,
      backgroundColor: '#00000000'
    }
  }


  if (caller) {
    x = caller.getPosition()[0] + 30;
    y = caller.getPosition()[1] + 30;
  }

  const win = new BrowserWindow({
    ...x && { x },
    ...y && { y },
    width,
    height,
    ...windowConfig,
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
    appInfo,
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

ipcMain.on('set-title', (event, title) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  win.setTitle(title);
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
  return await dialog.get().showOpenDialog(win, { title: 'Open a file' });
});

ipcMain.handle('show-save-dialog', async (event, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return await dialog.get().showSaveDialog(win, options);
});

ipcMain.on('open-devtools', (_, targetContentsId, devtoolsContentsId) => {
  const target = webContents.fromId(targetContentsId)
  const devtools = webContents.fromId(devtoolsContentsId)

  target.setDevToolsWebContents(devtools)
  target.openDevTools()
  devtools.executeJavaScript("window.location.reload()");
})

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

    const ret = dialog.get().showMessageBoxSync(win, options);

    if (ret !== 1) {
      return;
    }
  }

  win.destroy();
});





app.whenReady().then(() => {
  let num = app.isPackaged ? 1 : 2;
  createWindow(null, process.argv.slice(num));

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  if (userPrefStore.get('app_config').auto_update) {
    setTimeout(() => {
      // TODO: There are a lot of issues with the updater so lets not bother
      //checkLatestVersion();
    }, 8000);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();

  if (shouldUpdate) {
    doUpdate();
  }
});