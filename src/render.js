const { remote, webFrame, ipcRenderer } = require('electron');
const { dialog } = require('electron').remote;
const app_version = require('electron').remote.app.getVersion();
const path = require("path");
const fs = require('fs');
const child_process = require('child_process');
const marked = require('marked');
const hljs = require('highlight.js');


const app_info = {
  version: app_version,
  name: "Monolith Code"
}

var MD_TEMPLATE_HTML = path.resolve(__dirname, 'res/embed/markdown/index.html');
var HINT_DIR = path.resolve(__dirname, 'res/lib/codemirror-5.51.0/addon/hint');
var editor;

var file = {
  name: undefined,
  extension: undefined,
  path: undefined,
  mime: undefined
}
var language_compile_info;
var running_process = undefined;
var themes;
var hinters;
var is_saved = true;

var document_name_ui;
var text_area_ui;
var language_display_ui;
var theme_choice_ui;
var char_display_ui;
var console_ui;
var console_in_ui;
var console_out_ui;
var webview_ui;
var editor_media_div_ui;
var editor_console_div_ui;

var command_list = {};
var command_history = [];
var history_index = undefined;

var scroll_bars_css;

const PRINT_MODE = Object.freeze({
  user: 0,
  info: 1,
  confirm: 2,
  warn: 3,
  error: 4
});

/* ---- DOCUMENT READY ---- */

document.addEventListener('DOMContentLoaded', function (event) {

  // Initialize all ui elements
  initialize();

  // get config
  let config = ipcRenderer.sendSync('initial-settings');

  webFrame.setVisualZoomLevelLimits(1, 3);

  editor = CodeMirror.fromTextArea(text_area_ui, {
    lineNumbers: config.line_numbers,
    lineWrapping: config.line_wrapping,
    dragDrop: true,
    extraKeys: {"Ctrl-Space": "autocomplete"},
    autoCloseBrackets: true,
    autoCloseTags: true,
    matchTags: {bothTags: true},
    matchBrackets: true
  });
  editor.setSize("100%", "100%");
  CodeMirror.modeURL = path.resolve(__dirname, 'res/lib/codemirror-5.51.0/mode/%N/%N.js');
  CodeMirror.commands.find =  CodeMirror.commands.findPersistent;

  fs.readdir(path.resolve(__dirname, 'res/lib/codemirror-5.51.0/theme/'), (err, files) =>{
    themes = files;
    for (var theme of themes) {
      var option = document.createElement("option");
      option.text = toCapitalizedWords(theme.replace(".css", ""));
      option.value = theme;
      theme_choice_ui.add(option);
    }
    set_theme(config.theme.replace(".css", ""));
  });
  fs.readdir(HINT_DIR, (err, files) =>{
    hinters = files;
  });


  editor.on("drop", (data, e) => {
    e.preventDefault();
    open_file(e.dataTransfer.files[0].path);
    return true;
  });

  editor.on("change", () => {
    if (is_saved) {
      set_saved(false);
    }else{
      if(getContent() == "") {
        set_saved(true);
      }
    }
  });
  editor.on("scroll", (event) => {
    //console.log(event);
  });


  for (var lang of CodeMirror.modeInfo) {
    var option = document.createElement("option");
    option.text = lang.name;
    option.value = lang.mime;
    language_display_ui.add(option);
  }
  language_display_ui.value = "text/plain";



  document.getElementById("min-button").addEventListener("click", function (e) {
    var window = remote.getCurrentWindow();
    window.minimize();
  });

  document.getElementById("max-button").addEventListener("click", function (e) {
    var window = remote.getCurrentWindow();
    if (!window.isMaximized()) {
      window.maximize();
      toggle_fullscreen_style(true);
    } else {
      window.unmaximize();
      toggle_fullscreen_style(false);
    }
  });

  document.getElementById("close-button").addEventListener("click", function (e) {
    var window = remote.getCurrentWindow();
    window.close();
  });

  window.addEventListener('keydown', function (event) {
    if (event.ctrlKey && event.key == "o") {
      event.preventDefault();
      notify_load_start();

      const options = {
        title: 'Open a file'
      };
      var window = remote.getCurrentWindow();
      dialog.showOpenDialog(window, options).then((ret) => {
        if (!ret.canceled) {
          open_file(ret.filePaths[0]);
        }

        notify_load_end();
      });

    } else if (event.ctrlKey && event.key == "b") {
      event.preventDefault();

      if (file.path === undefined || !is_saved) {
        _save_file(getContent(), false, () => {
          build_run_file();
        });
      } else {
        build_run_file();
      }
    }
    else if (event.ctrlKey && !event.shiftKey && event.key == "s") {// ctrl + s
      event.preventDefault();
      _save_file(getContent());
    }
    else if (event.ctrlKey && event.shiftKey && event.key == "S") { // ctrl + shift + s
      event.preventDefault();
      _save_file(getContent(), true);
    }
    else if (event.ctrlKey && event.key == "n") {
      event.preventDefault();
      newWindow();
    } else if (event.ctrlKey && event.key == "p") {
      event.preventDefault();
      if ((language_display_ui.value in language_compile_info) && language_compile_info[language_display_ui.value].templ) {
        editor.setValue(language_compile_info[language_display_ui.value].templ);
      } else {
        notify("warn");
        print("No default template exists for " + language_display_ui.value);
      }
    }
  }, false);





  console_in_ui.addEventListener('keyup', function (event) {
    if (!event.ctrlKey && event.key == "Enter") {
      event.preventDefault();
      let cmd = console_in_ui.value.replace(/\n$/, "");
      console_in_ui.value = "";

      if (history_index != undefined) {
        command_history.pop();
        history_index = undefined;
      }
      command_history.push(cmd);

      let pre = cmd.split(" ")[0];

      if (pre in command_list) {
        print(pre, PRINT_MODE.user);
        command_list[pre].func();
      } else if(cmd.startsWith("!")){
        print(pre, PRINT_MODE.user);
        print("Command not recognized. Try !help.", PRINT_MODE.warn);
        notify("warn");
      } else if (running_process != undefined) {
        running_process.stdin.write(cmd + "\n");
      } else {
        run_command(cmd);
      }


      return false;
    } else if (!event.ctrlKey && event.key == "ArrowUp") {
      let curr_cmd = console_in_ui.value;

      if (history_index === undefined) {
        command_history.push(curr_cmd);
        history_index = command_history.length - 2;
      } else {
        if (history_index - 1 < 0) {
          history_index = command_history.length;
        }
        history_index -= 1;
      }

      console_in_ui.value = command_history[history_index];
    }
  }, false);

  language_display_ui.addEventListener("change", function (event) {
    set_language(language_display_ui.value);
  });

  theme_choice_ui.addEventListener("change", function (event) {
    console.log("event");
    set_theme(theme_choice_ui.value.replace(".css", ""));
  });

  fs.readFile(path.resolve(__dirname, 'res/lang.json'), 'utf-8', (err, data) => {
    if (err) {
      alert("An error ocurred reading the file :" + err.message);
      return;
    }
    language_compile_info = JSON.parse(data);
  });


  command_list = {
    "!ver": {
      "desc": "Shows the current version of the application.",
      "func": () => { print(app_info.name + " " + app_info.version); }
    },
    "!cls": {
      "desc": "Clear console.",
      "func": () => { console_out_ui.innerHTML = ""; }
    },
    "!kill": {
      "desc": "Kills the currently running process.",
      "func": () => { if (running_process) { running_process.kill('SIGINT'); } }
    },
    "!hello": {
      "desc": "Hello There :D",
      "func": () => { print("Hi there :D"); }
    }
    ,
    "!help": {
      "desc": "Shows all the available commands.",
      "func": () => {
        let ret = "";
        for (const [key, value] of Object.entries(command_list)) {
          ret += key + "\t" + value.desc + "\n";
        }
        print(ret);
      }
    }
  }

  fs.readFile(path.resolve(__dirname, 'res/style/bars.css'), 'utf-8', (err, data) => {
    if (!err) {
      scroll_bars_css = data;
    }
  });

  webview_ui.addEventListener('did-finish-load', () => {
    webview_ui.insertCSS(scroll_bars_css);
  });

  marked.setOptions({
    highlight: (code, lang) => {
      const validLanguage = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(validLanguage, code).value;
    }
  });


  editor_media_div_ui.addEventListener('divider-move', () => {
    let val = editor_media_div_ui.previousElementSibling.style.width;
    ipcRenderer.send('store-setting', 'editor_media_div_percent', val);
  });
  editor_console_div_ui.addEventListener('divider-move', () => {
    let val = editor_console_div_ui.previousElementSibling.style.height;
    ipcRenderer.send('store-setting', 'editor_console_div_percent', val);
  });

  editor_media_div_ui.addEventListener('dblclick', () => {
    let num = parseFloat(editor_media_div_ui.previousElementSibling.style.width.replace("%", ""));
    let target_percent = Math.abs(num - 50) < 1 ? '100%' :  "50%";

    let anim = editor_media_div_ui.previousElementSibling.animate([
      { width: editor_media_div_ui.previousElementSibling.style.width },
      { width: target_percent }
    ], {
      duration: 450,
      easing: "cubic-bezier(0.860, 0.000, 0.070, 1.000)"
    });
    anim.finished.then((e) =>{    
      editor_media_div_ui.previousElementSibling.style.width = target_percent;
      ipcRenderer.send('store-setting', 'editor_media_div_percent', target_percent);
    });
  });
  editor_console_div_ui.addEventListener('dblclick', () => {
    let num = parseFloat(editor_console_div_ui.previousElementSibling.style.height.replace("%", ""));
    let target_percent = Math.abs(num - 60) < 1 ? '100%' :  "60%";

    let anim = editor_console_div_ui.previousElementSibling.animate([
      { height: editor_console_div_ui.previousElementSibling.style.height },
      { height: target_percent }
    ], {
      duration: 450,
      easing: "cubic-bezier(0.860, 0.000, 0.070, 1.000)"
    });
    anim.finished.then((e) =>{    
      editor_console_div_ui.previousElementSibling.style.height = target_percent;
    ipcRenderer.send('store-setting', 'editor_console_div_percent', target_percent);
    });    
  });

  document.getElementsByClassName("CodeMirror")[0].style.width = config.editor_media_div_percent;
  document.getElementById("main-divider").style.height = config.editor_console_div_percent;

  ipcRenderer.on('can-close', (event) => {
    event.sender.send('can-close-response', is_saved);
  })

  print(app_info.name + " " + app_info.version);



  
  let should_open = window.process.argv.filter(s => s.includes('--open-file='));
  if (should_open.length > 0) {
    open_file(should_open[0].replace(/--open-file="(.*)"/, "$1"));
  }
  

});


function initialize() {
  document_name_ui = document.getElementById('document-name');
  text_area_ui = document.getElementById('main-text-area');
  language_display_ui = document.getElementById('language-display');
  theme_choice_ui = document.getElementById('theme-choice');
  char_display_ui = document.getElementById('fchar-display');
  console_ui = document.getElementById('console');
  console_in_ui = document.getElementById('console-in');
  console_out_ui = document.getElementById('console-out');
  webview_ui = document.getElementById("embed-content");
  theme_link = document.getElementById('theme-link');
  editor_media_div_ui = document.getElementById('editor-media-div');
  editor_console_div_ui = document.getElementById('editor-console-div');
}

function getContent() {
  return editor.getValue();
}

function newWindow(file_path = undefined) {
  ipcRenderer.send('new-window', file_path);
}

function set_saved(saved){
  if(is_saved != saved){
    let title = file.extension ? file.name + file.extension : "new document";
    if(saved){
      document_name_ui.textContent = title;
    }else{
      document_name_ui.textContent = title + "*";
    }
    is_saved = saved;
  }
}

function _set_file_info(filePath, mime = undefined) {
  file.extension = path.extname(filePath);
  file.path = path.dirname(filePath) + path.sep;
  file.name = path.basename(filePath, file.extension);
  if (mime === undefined) {
    let mode = CodeMirror.findModeByExtension(file.extension.substr(1));
    if (mode) {
      file.mime = mode.mime;
    } else {
      file.mime = "text/plain";
    }
  } else {
    file.mime = mime;
  }

  set_saved(true);
  set_language(file.mime);
}

function toggle_fullscreen_style(is_fullscreen) {
  if (is_fullscreen) {
    document.getElementsByTagName("body")[0].classList.add("fullscreen");
  } else {
    document.getElementsByTagName("body")[0].classList.remove("fullscreen");
  }
}

function open_file(path) {
  if (file.path || !is_saved) {
    newWindow(path);
  } else {
    fs.readFile(path, 'utf-8', (err, data) => {
      if (!err) {
        editor.setValue(data);
        _set_file_info(path);
        webview_ui.setAttribute("src", undefined)
      } else {
        print("Error: Could not open file " + path, PRINT_MODE.error);
        notify("error");
      }
    });
  }
}

function _save_file(content, save_as = false, callback = undefined) {
  if (file.path === undefined || save_as) {
    let lang = CodeMirror.findModeByMIME(language_display_ui.value);
    var options = {
      filters: [
        { name: 'All Files', extensions: ['*'] },
        { name: lang.name, extensions: lang.ext }
      ]
    }
    var window = remote.getCurrentWindow();
    dialog.showSaveDialog(window, options).then((ret) => {
      if (!ret.canceled) {
        write_file(ret.filePath, content, (err) => {
          if (!err) {
            _set_file_info(ret.filePath);

            if (callback != undefined) callback();
          }
        });
      }
    });
  } else {
    write_file(file.path + file.name + file.extension, getContent(), (err) => {
      if (!err) {
        set_saved(true);
      }
      if (callback != undefined) callback(err);
    });
  }
}

function write_file(path, content, callback = undefined) {
  fs.writeFile(path, content, (err) => {
    if (!err) {
      notify("confirm");
    } else {
      print(err, PRINT_MODE.error);
      notify("error");
    }
    if (callback != undefined) callback(err);
  });
}

function set_language(mime) {
  let info = CodeMirror.findModeByMIME(mime);
  editor.setOption("mode", info.mime);
  CodeMirror.autoLoadMode(editor, info.mode);
  language_display_ui.value = info.mime;
  load_hint(info.mode);
}

function notify(type) {
  document.getElementById("status-display").className = "";
  document.getElementById("status-display").offsetWidth;
  document.getElementById("status-display").classList.add(type);
}

function notify_load_start() {
  document.getElementById("status-bar").classList.add("load");
}

function notify_load_end() {
  document.getElementById("status-bar").className = "";
}

function print(text, mode = PRINT_MODE.info) {
  let block = document.createElement('div');
  block.classList.add(Object.keys(PRINT_MODE).find(key => PRINT_MODE[key] === mode));
  block.innerText = text;
  console_out_ui.appendChild(block);

  console_ui.scrollTo({ top: console_ui.scrollHeight, behavior: 'smooth' });
}


function set_theme(name) {
  let style_file = path.resolve(__dirname, 'res/lib/codemirror-5.51.0/theme/' + name + ".css");

  if (!document.getElementById("mc-style-" + name)) {
    let styles = document.createElement('link');
    styles.onload = _reapply_theme;
    styles.rel = 'stylesheet';
    styles.type = 'text/css';
    styles.media = 'screen';
    styles.href = style_file;
    styles.id = "mc-style-" + name;
    document.getElementsByTagName('head')[0].appendChild(styles);
    editor.setOption("theme", name);
  } else {
    editor.setOption("theme", name);
    _reapply_theme();
  }
  theme_choice_ui.value = name+".css";
}

function _reapply_theme() {
  let cm = document.querySelector(".CodeMirror");
  document.documentElement.style.setProperty('--background', getComputedStyle(cm).backgroundColor);
}

function load_hint(mode){
  let ret = hinters.filter(s => s.startsWith(mode));
  
  if(ret.length > 0){
    let id = "hint-"+mode;

    if(!document.getElementById(id)){
      let hinter = document.createElement('script');
      hinter.id = id;
      hinter.src = HINT_DIR + path.sep + ret[0];
      document.getElementsByTagName('head')[0].appendChild(hinter);
    }    
  }
}


function build_run_file() {
  if (file.mime in language_compile_info) {
    let cmd_comp = language_compile_info[file.mime].comp;
    if (cmd_comp) {
      cmd_comp = cmd_comp.replaceAll("<name>", file.name);
      cmd_comp = cmd_comp.replaceAll("<path>", file.path);

      run_command(cmd_comp, [], (code) => {
        if (code == 0) {
          run_file();
        }
      });
    } else {
      run_file();
    }
  } else {
    notify("warn");
    print("No action defined for " + language_display_ui.value);
  }
}

function run_file() {
  if (file.mime in language_compile_info) {
    let cmd_run = language_compile_info[file.mime].run;
    if (cmd_run) {
      cmd_run = cmd_run.replaceAll("<name>", file.name);
      cmd_run = cmd_run.replaceAll("<path>", file.path);

      run_command(cmd_run);
    } else if (file.mime == "text/x-latex") {
      webview_ui.src = file.path + file.name + ".pdf?v=" + Date.now();
    } else if (file.mime == "text/x-markdown") {
      let basepath = file.path.replaceAll("\\", "/");

      // Pre process relative html src
      let pre = getContent();
      pre = pre.replaceAll(/src="(\..*?)"/ig, "src=\"" + basepath + "$1\"");
      let marked_html = marked(pre, { baseUrl: basepath });

      webview_ui.addEventListener('did-finish-load', () => {
        webview_ui.send('fillContent', marked_html);
      }, { once: true });
      webview_ui.src = MD_TEMPLATE_HTML;
    } else if (file.mime == "text/html") {
      webview_ui.src = (file.path + file.name + ".html")
    }
  }
}

function toCapitalizedWords(name) {
  var words = name.match(/[0-9A-Za-z][0-9a-z]*/g) || [];

  return words.map(capitalize).join(" ");
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.substring(1);
}



function run_command(command, args, callback = undefined) {
  if (running_process != undefined) {
    let ret = running_process.kill('SIGINT');

    if (!ret) {
      print("Error: Could not stop the running process.", PRINT_MODE.error);
      return;
    }
  }

  notify_load_start();
  print("> " + command, PRINT_MODE.user);


  running_process = child_process.spawn(command, args, {
    encoding: 'utf8',
    shell: true,
    ...file.path && { cwd: file.path }
  });

  running_process.on('error', (error) => { });

  running_process.stdout.setEncoding('utf8');
  running_process.stdout.on('data', (data) => {
    data = data.toString();
    print(data);
  });

  running_process.stderr.setEncoding('utf8');
  running_process.stderr.on('data', (data) => {
    print(data, PRINT_MODE.error);
  });

  running_process.on('close', (code) => {
    //Here you can get the exit code of the script  
    switch (code) {
      case 0:
        notify("confirm");
        break;
      default:
        notify("error");
        break;
    }

    notify_load_end();
    running_process = undefined;

    if (callback !== undefined) {
      callback(code);
    }
  });
}








document.addEventListener('DOMContentLoaded', function () {
  const resizable = function (resizer) {
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
    const mouseDownHandler = function (e) {
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

    const mouseMoveHandler = function (e) {
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

      prevSibling.style.userSelect = 'none';
      prevSibling.style.pointerEvents = 'none';

      nextSibling.style.userSelect = 'none';
      nextSibling.style.pointerEvents = 'none';
    };

    const mouseUpHandler = function (e) {
      resizer.style.removeProperty('cursor');
      document.body.style.removeProperty('cursor');

      prevSibling.style.removeProperty('user-select');
      prevSibling.style.removeProperty('pointer-events');

      nextSibling.style.removeProperty('user-select');
      nextSibling.style.removeProperty('pointer-events');

      // Remove the handlers of `mousemove` and `mouseup`
      document.removeEventListener('mousemove', mouseMoveHandler);
      document.removeEventListener('mouseup', mouseUpHandler);

      // Dispatch the event
      var event = new CustomEvent('divider-move');
      resizer.dispatchEvent(event);
    };

    // Attach the handler
    resizer.addEventListener('mousedown', mouseDownHandler);
  };

  // Query all resizers
  document.querySelectorAll('.resizer').forEach(function (ele) {
    resizable(ele);
  });
});