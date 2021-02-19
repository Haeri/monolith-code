const { app, BrowserWindow } = require('electron')
const path = require("path");

const default_window_config = {
  width: 500,
  height: 600,
  frame: false,
  hasShadow: true,
  transparent: true, 
  titleBarStyle: 'hidden',
  webPreferences: {
    nodeIntegration: true,
    contextIsolation: false,      
    enableRemoteModule: true,
  },
  icon: path.join(__dirname, 'res/img/icon.png')
}

function createWindow () {
  let win = new BrowserWindow(default_window_config);

  win.loadFile('index.html')
}

app.whenReady().then(() => {
  createWindow()
  
  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})