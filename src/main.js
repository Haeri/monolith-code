import { createApp } from 'vue'
import App from './App.vue'
import { dialog, fs, path } from "@tauri-apps/api";
import { appWindow } from "@tauri-apps/api/window";


window.INFO_LEVEL = Object.freeze({
    user: 0,
    info: 1,
    confirm: 2,
    warn: 3,
    error: 4,
  });


const initialSettings = {
    "appInfo": {
        "name": "monolith code",
        "version": "2.2.4",
        "os": "win32"
    },
    "filePathsToOpen": [],
    "editorConfig": {
        "theme": "ace/theme/monokai",
        "media_div_percent": "100%",
        "console_div_percent": 50,
        "font_size": 14,
        "line_wrapping": true,
        "line_numbers": true
    },
    "windowConfig": {
        "native_frame": false
    },
    "localWindowConfig": {
        "x": 646,
        "y": 209,
        "width": 636,
        "height": 497,
        "maximized": false
    },
    "languageConfig": {
        "cpp": {
            "comp": "g++ -std=c++17 <name>.cpp -o <name>"
        }
    },
    "userPrefPath": "C:\\Users\\Luka\\AppData\\Roaming\\monolith-code\\user-preferences.json",
    "languageConfigPath": "C:\\Users\\Luka\\AppData\\Roaming\\monolith-code\\lang-settings.json"
};

window.api = {

  // Getter
  getInitialSettings: () => {
    console.log("called", "getInitialSettings");
    return initialSettings;
    },

  // Window API
  minimize: () => {
    console.log("called", "minimize");
    appWindow.minimize();
},
  maximize: () => {
    console.log("called", "maximize");
    appWindow.toggleMaximize();
},
  unmaximize: () => console.log("called", "unmaximize"),
  toggleMaxUnmax: () => {
    console.log("called", "toggleMaxUnmax");
    appWindow.toggleMaximize();
},
  close: () => console.log("called", "close"),
  toggleAlwaysOnTop: () => console.log("called", "toggleAlwaysOnTop"),
  newWindow: (filePaths) => console.log("called", "newWindow"),
  setTitle: (title) => console.log("called", "setTitle"),

  // Features API
  showOpenDialog: () => {
    console.log("called", "showOpenDialog"); 
    return dialog.open({ title: "Open a file", multiple: true });
},
  showSaveDialog: (options) => console.log("called", "showSaveDialog"),

  storeSetting: (key, value) => console.log("called", "storeSetting"),

  readFile: (filePath) => console.log("called", "readFile"),
  writeFile: (filePath, content) => console.log("called", "writeFile"),

  path: path,
  spawnProcess: (command, args, cwd) => console.log("called", "spawnProcess"),
  markedParse: (...args) => console.log("called", "markedParse"),
  openDevTool: (targetId, devtoolsId) => console.log("called", "openDevTool"),

  // Handler
  updateMaxUnmax: (callback) => console.log("called", "updateMaxUnmax"),
  canClose: (callback) => console.log("called", "canClose"),
  print: (callback) => console.log("called", "print"),

};


  
createApp(App).mount('#app')
