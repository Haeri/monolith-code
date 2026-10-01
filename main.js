const {
  app, BrowserWindow, ipcMain, webContents,
} = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { requireLazy } = require('./src/common');
const Store = require('./src/store');

const appInfo = {
  name: 'monolith code',
  version: app.getVersion(),
  os: process.platform,
};

const dialog = requireLazy(() => require('electron').dialog);
const electronUpdater = requireLazy(() => require('electron-updater').autoUpdater);
const markdown = requireLazy(() => require('./src/markdown'));
const childProcess = requireLazy(() => require('child_process'));

const filesToOpenMap = new Map();
const runningProcesses = new Map();
let pendingFilesToOpen = [];
let autoUpdaterEventsRegistered = false;
let isQuitting = false;
let quitRequested = false;
let updateReadyToInstall = false;
let updateInstallStarted = false;

const localStore = new Store({
  configName: 'local-settings',
  defaults: {
    window_config: {
      x: undefined,
      y: undefined,
      width: 800,
      height: 600,
      maximized: false,
    },
  },
});
const userPrefStore = new Store({
  configName: 'user-preferences',
  defaults: {
    window_config: {
      native_frame: true,
    },
    editor_config: {
      theme: 'ace/theme/monokai',
      media_div_percent: '100%',
      console_div_percent: '100%',
      key_bindings: 'ace/keyboard/ace',
      font_size: 10,
      line_wrapping: true,
      line_numbers: true,
    },
    app_config: {
      auto_update: true,
    },
  },
});
const langStore = new Store({
  configName: 'lang-settings',
  defaults: {
    language_config: {},
  },
});

function installDownloadedUpdate() {
  if (updateInstallStarted) return;

  updateInstallStarted = true;
  isQuitting = true;
  getAutoUpdater().quitAndInstall(false, true);
}

function getAutoUpdater() {
  const autoUpdater = electronUpdater.get();

  if (!autoUpdaterEventsRegistered) {
    autoUpdater.on('update-downloaded', (info) => {
      updateReadyToInstall = true;

      const windows = BrowserWindow.getAllWindows();
      windows.forEach((w) => {
        w.webContents.send('print', { text: `new version ${info.version} will be installed after restart.` });
      });

      const options = {
        type: 'info',
        buttons: ['Restart now', 'Later'],
        defaultId: 0,
        cancelId: 1,
        title: 'Update ready',
        message: `monolith code ${info.version} is ready to install.`,
        detail: 'Restart the app now to finish installing the update.',
      };

      const prompt = windows[0]
        ? dialog.get().showMessageBox(windows[0], options)
        : dialog.get().showMessageBox(options);

      prompt.then(({ response }) => {
        // Quitting goes through the unsaved-changes check before the update is installed
        if (response === 0) app.quit();
      }).catch((err) => {
        windows.forEach((w) => {
          w.webContents.send('print', { text: `Could not start update install: ${err.message}` });
        });
      });
    });
    autoUpdaterEventsRegistered = true;
  }

  return autoUpdater;
}

function getFilePathsFromArgs(args, startIndex) {
  return args
    .slice(startIndex)
    .filter((arg) => arg && !arg.startsWith('-'))
    .map((arg) => path.resolve(arg))
    .filter((arg) => {
      try {
        return fs.statSync(arg).isFile();
      } catch {
        return false;
      }
    });
}

function focusExistingWindow() {
  const [win] = BrowserWindow.getAllWindows();
  if (!win) return;

  if (win.isMinimized()) {
    win.restore();
  }
  win.focus();
}

function saveWindowBounds(win) {
  if (win.isDestroyed()) return;

  localStore.set('window_config', {
    ...localStore.get('window_config'),
    ...win.getNormalBounds(),
  });
}

/**
 * Kills a spawned process and everything it started. This is synchronous so it
 * also works while the app is exiting.
 */
function killProcessTree(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;

  try {
    if (process.platform === 'win32') {
      childProcess.get().spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
    } else {
      // Processes are spawned as group leaders, so a negative pid targets the whole group
      process.kill(-child.pid, 'SIGKILL');
    }
  } catch {
    // The process already exited
  }
}

function finishQuit() {
  isQuitting = true;
  if (updateReadyToInstall && !updateInstallStarted) {
    installDownloadedUpdate();
  } else {
    app.quit();
  }
}

function createWindow(caller = undefined, filePaths = []) {
  const winId = `win-${crypto.randomUUID()}`;
  filesToOpenMap.set(winId, filePaths);
  let {
    x, y,
  } = localStore.get('window_config');
  const {
    width, height, maximized,
  } = localStore.get('window_config');

  let { native_frame } = userPrefStore.get('window_config');

  // Force custom frame to remove traficlights
  if (process.platform === 'darwin') {
    native_frame = false;
  }

  const windowConfig = native_frame
    ? {
      frame: false,
      hasShadow: true,
      backgroundColor: '#212121',
    }
    : {
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
    };

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
      sandbox: true,
      webviewTag: true,
    },
    icon: path.join(__dirname, 'res/img/icon.png'),
  });

  win.winId = winId;

  win.on('close', (e) => {
    if (isQuitting) return;

    e.preventDefault();
    win.webContents.send('can-close');
  });

  win.on('resized', () => saveWindowBounds(win));
  win.on('moved', () => saveWindowBounds(win));

  win.on('maximize', () => {
    localStore.set('window_config.maximized', true);
    win.webContents.send('update-max-unmax', true);
  });

  win.on('unmaximize', () => {
    localStore.set('window_config.maximized', false);
    win.webContents.send('update-max-unmax', false);
  });

  win.on('enter-full-screen', () => {
    win.webContents.send('update-max-unmax', true);
  });

  win.on('leave-full-screen', () => {
    win.webContents.send('update-max-unmax', win.isMaximized());
  });

  win.once('ready-to-show', () => {
    win.show();
    if (maximized) {
      win.maximize();
    }
  });

  win.on('closed', () => {
    filesToOpenMap.delete(win.winId);
  });

  win.loadFile('index.html');
}

ipcMain.handle('initial-settings', (event) => {
  const editorConfig = userPrefStore.get('editor_config');
  const windowConfig = userPrefStore.get('window_config');
  const localWindowConfig = localStore.get('window_config');
  const languageConfig = langStore.get('language_config');
  const userPrefPath = userPrefStore.getFilePath();
  const languageConfigPath = langStore.getFilePath();
  return {
    appInfo,
    filePathsToOpen: filesToOpenMap.get(BrowserWindow.fromWebContents(event.sender).winId) || [],
    editorConfig,
    windowConfig,
    localWindowConfig,
    languageConfig,
    userPrefPath,
    languageConfigPath,
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
  if (process.platform === 'darwin') {
    win.setFullScreen(!win.isFullScreen());
    return;
  }

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
  return dialog.get().showOpenDialog(win, { title: 'Open a file' });
});

ipcMain.handle('show-save-dialog', async (event, options) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return dialog.get().showSaveDialog(win, options);
});

ipcMain.handle('read-file', (_, filePath) => fs.promises.readFile(filePath, { encoding: 'utf-8' }));
ipcMain.handle('write-file', (_, filePath, content) => fs.promises.writeFile(filePath, content));
ipcMain.handle('markdown-parse', (_, text) => markdown.get().parse(text));

ipcMain.on('spawn-process', (event, id, command, args, cwd) => {
  const sender = event.sender;
  const send = (type, data) => {
    if (!sender.isDestroyed()) sender.send('process-event', id, type, data);
  };

  const child = childProcess.get().spawn(command, args, {
    shell: true,
    cwd,
    // Own process group on unix so the whole tree can be killed at once
    detached: process.platform !== 'win32',
  });
  runningProcesses.set(id, child);

  child.on('error', (err) => send('error', err.message));

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (data) => send('stdout', data));

  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (data) => send('stderr', data));

  child.on('close', (code) => {
    runningProcesses.delete(id);
    send('close', code);
  });

  // Don't leave orphaned processes behind when the window goes away
  sender.once('destroyed', () => killProcessTree(child));
});

ipcMain.on('process-stdin', (_, id, data) => {
  runningProcesses.get(id)?.stdin.write(data);
});

ipcMain.handle('process-kill', (_, id) => {
  const child = runningProcesses.get(id);
  if (!child) return undefined;

  return new Promise((resolve) => {
    child.once('close', () => resolve());
    killProcessTree(child);
  });
});


ipcMain.on('open-devtools', (event, targetContentsId, devtoolsContentsId) => {
  const target = webContents.fromId(targetContentsId);
  const devtools = webContents.fromId(devtoolsContentsId);

  // Only allow attaching devtools between webviews hosted by the requesting window
  if (target?.hostWebContents !== event.sender || devtools?.hostWebContents !== event.sender) return;

  target.setDevToolsWebContents(devtools);
  target.openDevTools();
  devtools.executeJavaScript('window.location.reload()');
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
    const documentName = win.getTitle().replace(/\*$/, '');
    const action = quitRequested ? 'quit' : 'close this window';
    const options = {
      type: 'question',
      buttons: ['Yes', 'No'],
      // Enter and Escape both keep the document open
      defaultId: 1,
      cancelId: 1,
      title: 'Unsaved Changes',
      message: `"${documentName}" has unsaved changes. Do you really want to ${action}?`,
      detail: 'Your unsaved changes will be lost.',
    };

    const ret = dialog.get().showMessageBoxSync(win, options);

    if (ret !== 0) {
      quitRequested = false;
      return;
    }
  }

  saveWindowBounds(win);
  win.destroy();

  if (quitRequested && BrowserWindow.getAllWindows().every((w) => w.isDestroyed())) {
    finishQuit();
  }
});

const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_, commandLine) => {
    const num = app.isPackaged ? 1 : 2;
    const filePaths = getFilePathsFromArgs(commandLine, num);

    if (filePaths.length) {
      createWindow(null, filePaths);
      return;
    }

    focusExistingWindow();
  });

  app.whenReady().then(() => {
    const num = app.isPackaged ? 1 : 2;
    const argvFiles = getFilePathsFromArgs(process.argv, num);

    const initialFiles = [...argvFiles, ...pendingFilesToOpen];
    pendingFilesToOpen = [];

    createWindow(null, initialFiles);

    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

    if (app.isPackaged && userPrefStore.get('app_config').auto_update) {
      setTimeout(() => {
        getAutoUpdater().checkForUpdatesAndNotify().catch((err) => {
          BrowserWindow.getAllWindows().forEach((w) => {
            w.webContents.send('print', { text: `Could not check for updates: ${err.message}` });
          });
        });
      }, 10000);
    }
  });
}

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  const absolutePath = path.resolve(filePath);
  if (app.isReady()) {
    createWindow(null, [absolutePath]);
  } else {
    pendingFilesToOpen.push(absolutePath);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', (event) => {
  if (isQuitting) return;

  // Ask every window about unsaved changes first; the last one to close finishes the quit
  event.preventDefault();
  quitRequested = true;

  const windows = BrowserWindow.getAllWindows();
  if (!windows.length) {
    finishQuit();
    return;
  }
  windows.forEach((w) => w.close());
});

app.on('will-quit', () => {
  runningProcesses.forEach((child) => killProcessTree(child));
  [localStore, userPrefStore, langStore].forEach((store) => store.flush());
});
