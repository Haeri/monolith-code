const { remote, webFrame } = require('electron');
const { dialog, BrowserWindow } = require('electron').remote;
const path = require("path");
const fs = require('fs');
const child_process = require('child_process');

var editor;

var file = {
  name: undefined,
  extension: undefined,
  path: undefined,
  mime: undefined
}
var language_compile_info;

var file_ui;
var document_name_ui;
var text_area_ui;
var language_display_ui;
var char_display_ui;
var console_ui;
var console_in_ui;
var console_out_ui;

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
  CodeMirror.modeURL = path.resolve(__dirname, 'res/lib/codemirror-5.51.0/mode/%N/%N.js');


  for(var lang in LANG_MAP){
    console.log(lang);
    var option = document.createElement("option");
    option.text = lang;
    option.value = LANG_MAP[lang];
    language_display_ui.add(option);
  }



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
    if (event.ctrlKey && event.key == "o") {
      event.preventDefault();
      notify_load_start();
      file_ui.click(() => {console.log("Hello");});
    }else if(event.ctrlKey && event.key == "b"){
      event.preventDefault();

      if (file.path === undefined) {
        _saveFile(getContent(), () => {
          build_run_file();
        }); 
      }else{
        build_run_file();
      }
    }
  }, false);

  // Load file content
  file_ui.addEventListener('change', function (event) {
    const input = event.target
    if ('files' in input && input.files.length > 0) {
      _readFileContent(input.files[0]).then(content => {
        editor.setValue(content);
        _setFileInfo(input.files[0].path);
      });
    }
    console.log("AFTER file change");
    notify_load_end();
  });

  // Save file  (ctrl + s)
  window.addEventListener('keydown', function (event) {
    if (event.ctrlKey && event.key == "s") {
      event.preventDefault();
      _saveFile(getContent());
    }
  }, false);

    // Save file  (ctrl + n)
    window.addEventListener('keydown', function (event) {
      if (event.ctrlKey && event.key == "n") {
        event.preventDefault();
        newWindow();
      }
    }, false);




  
  console_in_ui.addEventListener('keyup', function (event) {
    if (!event.ctrlKey && event.key == "Enter") {
      event.preventDefault();
      let cmd = console_in_ui.value;
      console_in_ui.value = "";
      run_command(cmd);
      return false;
    }
  }, false);

  language_display_ui.addEventListener("change", function(event) {
    let m = CodeMirror.findModeByExtension(language_display_ui.value);
    setLanguage(m.mime);
  });



  fs.readFile(path.resolve(__dirname, 'res/lang.json'), 'utf-8', (err, data) => {
    if(err){
        alert("An error ocurred reading the file :" + err.message);
        return;
    }
    language_compile_info = JSON.parse(data);
  });

});


function initialize() {
  document_name_ui = document.getElementById('document-name');
  text_area_ui = document.getElementById('main-text-area');
  language_display_ui = document.getElementById('language-display');
  char_display_ui = document.getElementById('fchar-display');
  console_ui = document.getElementById('console');
  console_in_ui = document.getElementById('console-in');
  console_out_ui = document.getElementById('console-out');
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

function _saveFile(content, callback = undefined) {
  if (file.path === undefined) {
    print("Invent a path");
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

      if(callback != undefined) callback();
    });
  }else{
    writeFile(file.path + "/"  + file.name + file.extension, getContent());
    if(callback != undefined) callback();
  }
}

function writeFile(path, content){
  fs.writeFile(path, content, function (err) {
    if (!err) {
      notify("confirm");
    } else {
      console.log(err);
      notify("error");
    }
  });
}

function setLanguage(mime) {
  let info = CodeMirror.findModeByMIME(mime);

  editor.setOption("mode", info.mime);
  CodeMirror.autoLoadMode(editor, info.mode);
  
  console.log("Index", info.name);
  language_display_ui.value = LANG_MAP[info.name];
}

function notify(type){
  document.getElementById("status-display").className = "";
  document.getElementById("status-display").offsetWidth;
  document.getElementById("status-display").classList.add(type);
}

function notify_load_start(){
  document.getElementById("status-bar").classList.add("load");
}

function notify_load_end(){
  document.getElementById("status-bar").className = "";
}


const LANG_MAP = {
  "Text": "txt",
  "C++": "cpp",
  "C": "c",
  "HTML": "html",
  "CSS": "css",
  "JavaScript": "js",
}

function print(text){
  console_out_ui.textContent +=  text + '\n';
  console_ui.scrollTo({top: console_ui.scrollHeight, behavior: 'smooth'});
}


function run_command(cmd){
  notify_load_start();
  run_script(cmd);
}


function build_run_file(){
  let cmd_comp = language_compile_info[file.mime].comp;
  cmd_comp = cmd_comp.replaceAll("<name>", file.name);
  cmd_comp = cmd_comp.replaceAll("<path>", file.path);

  let cmd_run = language_compile_info[file.mime].run;
  cmd_run = cmd_run.replaceAll("<name>", file.name);
  cmd_run = cmd_run.replaceAll("<path>", file.path);

  run_command(cmd_comp); //`gcc -o ${file.path}/${file.name}.exe ${file.path}/${file.name}.c -I. -lopengl32 -lgdi32 -mwindows`);

  //run_command(`gcc -o ${file.path}/${file.name}.exe ${file.path}/${file.name}.c -I. -lopengl32 -lgdi32 -mwindows`);
}



// This function will output the lines from the script 
// and will return the full combined output
// as well as exit code when it's done (using the callback).
function run_script(command, args, callback) {
  print("> " + command);
  var child = child_process.spawn(command, args, {
      encoding: 'utf8',
      shell: true,
      cwd: file.path
  });
  // You can also use a variable to save the output for when the script closes later
  child.on('error', (error) => {
      /*dialog.showMessageBox({
          title: 'Title',
          type: 'warning',
          message: 'Error occured.\r\n' + error
      });*/
  });

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (data) => {
      //Here is the output
      data=data.toString();   
      //console.log(data);      
      print(data);
  });

  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (data) => {
      // Return some data to the renderer process with the mainprocess-response ID
      //mainWindow.webContents.send('mainprocess-response', data);
      //Here is the output from the command
      //console.log(data);  
      print(data);
  });

  child.on('close', (code) => {
    notify_load_end();
      //Here you can get the exit code of the script  
      switch (code) {
          case 0:
            notify("confirm");
            /*
              dialog.showMessageBox({
                  title: 'Title',
                  type: 'info',
                  message: 'End process.\r\n'
              });*/
              break;
            default:
              notify("error");
              break;
      }

  });
  if (typeof callback === 'function')
      callback();
}








document.addEventListener('DOMContentLoaded', function() {
  const resizable = function(resizer) {
      const direction = resizer.getAttribute('data-direction') || 'horizontal';
      const prevSibling = resizer.previousElementSibling;
      const nextSibling = resizer.nextElementSibling;

      // The current position of mouse
      let x = 0;
      let y = 0;
      let prevSiblingHeight = 0;
      let prevSiblingWidth = 0;

      // Handle the mousedown event
      // that's triggered when user drags the resizer
      const mouseDownHandler = function(e) {
          // Get the current mouse position
          x = e.clientX;
          y = e.clientY;
          const rect = prevSibling.getBoundingClientRect();
          prevSiblingHeight = rect.height;
          prevSiblingWidth = rect.width;

          // Attach the listeners to `document`
          document.addEventListener('mousemove', mouseMoveHandler);
          document.addEventListener('mouseup', mouseUpHandler);
      };

      const mouseMoveHandler = function(e) {
          // How far the mouse has been moved
          const dx = e.clientX - x;
          const dy = e.clientY - y;

          switch (direction) {
              case 'vertical':
                  const h = (prevSiblingHeight + dy) * 100 / resizer.parentNode.getBoundingClientRect().height;
                  prevSibling.style.height = `${h}%`;
                  break;
              case 'horizontal':
              default:
                  const w = (prevSiblingWidth + dx) * 100 / resizer.parentNode.getBoundingClientRect().width;
                  prevSibling.style.width = `${w}%`;
                  break;
          }

          const cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
          resizer.style.cursor = cursor;
          document.body.style.cursor = cursor;

          prevSibling.style.userSelect = 'none';
          prevSibling.style.pointerEvents = 'none';

          nextSibling.style.userSelect = 'none';
          nextSibling.style.pointerEvents = 'none';
      };

      const mouseUpHandler = function() {
          resizer.style.removeProperty('cursor');
          document.body.style.removeProperty('cursor');

          prevSibling.style.removeProperty('user-select');
          prevSibling.style.removeProperty('pointer-events');

          nextSibling.style.removeProperty('user-select');
          nextSibling.style.removeProperty('pointer-events');

          // Remove the handlers of `mousemove` and `mouseup`
          document.removeEventListener('mousemove', mouseMoveHandler);
          document.removeEventListener('mouseup', mouseUpHandler);
      };

      // Attach the handler
      resizer.addEventListener('mousedown', mouseDownHandler);
  };

  // Query all resizers
  document.querySelectorAll('.resizer').forEach(function(ele) {
      resizable(ele);
  });
});