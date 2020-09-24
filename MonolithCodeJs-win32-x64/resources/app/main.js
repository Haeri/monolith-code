const { remote, webFrame } = require('electron');
const { dialog, BrowserWindow } = require('electron').remote;
const path = require("path");
const fs = require('fs');

var editor;

var file = {
  name: undefined,
  extension: undefined,
  path: undefined,
  mime: undefined
}

var file_ui;
var document_name_ui;
var text_area_ui;
var language_display_ui;
var char_display_ui;

/* ---- DOCUMENT READY ---- */

document.addEventListener('DOMContentLoaded', function (event) {

  // Initialize all ui elements
  initialize();

  webFrame.setVisualZoomLevelLimits(1, 3);

  editor = CodeMirror.fromTextArea(text_area_ui, {
    lineNumbers: true,
    theme: "material-darker"
  });
  editor.setSize("100%", "100%");
  CodeMirror.modeURL = "vendor/codemirror-5.51.0/mode/%N/%N.js";

  document.getElementById("min-button").addEventListener("click", function (e) {
    var window = remote.getCurrentWindow();
    window.minimize();
  });

  document.getElementById("max-button").addEventListener("click", function (e) {
    var window = remote.getCurrentWindow();
    if (!window.isMaximized()) {
      window.maximize();
    } else {
      window.unmaximize();
    }
  });

  document.getElementById("close-button").addEventListener("click", function (e) {
    var window = remote.getCurrentWindow();
    window.close();
  });

  // Open Dialog  (ctrl + o)
  window.addEventListener('keydown', function (event) {
    if (event.ctrlKey && event.keyCode == 79) {
      event.preventDefault();
      file_ui.click();
    }
  }, false);

  // Load file content
  file_ui.addEventListener('change', function (event) {
    const input = event.target
    if ('files' in input && input.files.length > 0) {
      _readFileContent(input.files[0]).then(content => {
        editor.setValue(content);
        _setFileInfo(input.files[0].path, input.files[0].type);
      });
    }
  });

  // Save file  (ctrl + s)
  window.addEventListener('keydown', function (event) {
    if (event.ctrlKey && event.keyCode == 83) {
      event.preventDefault();
      _saveFile(getContent());
    }
  }, false);

    // Save file  (ctrl + n)
    window.addEventListener('keydown', function (event) {
      if (event.ctrlKey && event.keyCode == 78) {
        event.preventDefault();
        newWindow();
      }
    }, false);

});


function initialize() {
  document_name_ui = document.getElementById('document-name');
  text_area_ui = document.getElementById('main-text-area');
  language_display_ui = document.getElementById('language-display');
  char_display_ui = document.getElementById('fchar-display');
  file_ui = document.getElementById('file-input');
}

function getContent(){
  return editor.getValue();
}

function newWindow(){
  let win = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false,
    titleBarStyle: 'none',
    backgroundColor: "transparent",
    webPreferences: {
      nodeIntegration: true
    },
    icon: path.join(__dirname, 'icon.png')
  });

  win.loadFile('index.html')
}

function _readFileContent(file) {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = event => resolve(event.target.result);
    reader.onerror = error => reject(error);
    reader.readAsText(file);
  });
}

function _setFileInfo(filePath, mime = undefined) {
  file.extension = path.extname(filePath);
  file.path = path.dirname(filePath);
  file.name = path.basename(filePath, file.extension);
  if(mime === undefined)
  {
    file.mime = CodeMirror.findModeByExtension(file.extension.substr(1)).mime;
  }else{
    file.mime = mime;
  }

  document_name_ui.innerHTML = file.name + file.extension;
  setLanguage(file.mime);
}

function _saveFile(content) {
  if (file.path === undefined) {
    var options = {
      filters: [
        { name: file.name, extensions: file.extension }
      ]
    }
    dialog.showSaveDialog(null, options).then((ret) => {
      if (!ret.canceled) {

        writeFile(ret.filePath, content);
        _setFileInfo(ret.filePath);
        
      }
    });
  }else{
    writeFile(file.path + file.name + file.extension, getContent());
  }
}

function writeFile(path, content){
  fs.writeFile(path, content, function (err) {
    if (!err) {
      //_confirm();
    } else {
      console.log(err);
    }
  });
}

function setLanguage(mime) {
  let info = CodeMirror.findModeByMIME(mime);

  editor.setOption("mode", info.mime);
  CodeMirror.autoLoadMode(editor, info.mode);
  
  language_display_ui.innerHTML = info.name;
}