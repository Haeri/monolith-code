/* eslint-disable no-underscore-dangle */
/* eslint-disable import/no-extraneous-dependencies */

let modelist = requireLazy(() => ace.require('ace/ext/modelist'));
let themelist = requireLazy(() => ace.require('ace/ext/themelist'));
let beautify = requireLazy(() => ace.require('ace/ext/beautify'));

let appInfo = null;
let editor = null;

const file = {
  name: undefined,
  extension: undefined,
  path: undefined,
  lang: undefined,
};
let langInfo;
let runningProcess;
let isSaved = null;
let editorConfig;
let windowConfig;
let localWindowConfig;
let userPrefPath;
let langPrefPath;

let commandHistory = [];
let historyIndex;

// UI Components
let documentNameUi;
let languageDisplayUi;
let languageDisplaySelectedUi;
let themeChoiceUi;
let consoleUi;
let consoleInUi;
let consoleOutUi;
let webviewUi;
let webviewDevUi;
let editorMediaDivUi;
let previewDevDivUi;
let editorConsoleDivUi;
let processIndicatorUi;

let errorSVG = requireLazy(async () => await fetch('res/img/err.svg').then(res => res.text()));

// Constants
const INFO_LEVEL = Object.freeze({
  user: 0,
  info: 1,
  confirm: 2,
  warn: 3,
  error: 4,
});

const keyBindings = {
  ctrl: {
    "o": {
      desc: "Open a file",
      func: openFile
    },
    "b": {
      desc: "Build and run the current file",
      func: buildRunFile
    },
    "s": {
      desc: "Save the current file",
      func: saveFile
    },
    "n": {
      desc: "Open a new editor window",
      func: newWindow
    },
    "i": {
      desc: "Open settings",
      func: openSettings
    },
    "p": {
      desc: "Export the preview window as PDF",
      func: exportPDFFromPreview
    },
    "t": {
      desc: "Open a hello world tamplate for the current language",
      func: makeLanguageTemplate
    },
    "m": {
      desc: "Evaluate a mathematical equation on the selected line",
      func: evaluateMathInline
    }
  },
  ctrlshift: {
    "b": {
      desc: "Beautify the document",
      func: beautifyDocument
    },
    "s": {
      desc: "Save the current document as new file",
      func: (() => saveFile(true))
    }
  }
}

const commandList = {
  '!ver': {
    desc: 'Shows the current version of the application',
    func: () => { print(`${appInfo.name} ${appInfo.version}`); },
  },
  '!cls': {
    desc: 'Clear console',
    func: () => { consoleOutUi.innerHTML = ''; },
  },
  '!kill': {
    desc: 'Kills the currently running process',
    func: () => {
      if (runningProcess) {
        killProcess().then(() => print("Process Killed", INFO_LEVEL.info));
      } else {
        print('No nunning process to kill.', INFO_LEVEL.warn);
      }
    },
  },
  '!hello': {
    desc: 'Hello There :D',
    func: () => { print('Hi there :D'); },
  },
  '!dev': {
    desc: 'Open Chrome Devtools for the preview window',
    func: () => { toggleDevTool(); },
  },
  '!settings': {
    desc: 'Open settings file',
    func: () => { openSettings(); },
  },
  '!lang_settings': {
    desc: 'Open language settings file',
    func: () => { openLanguageSettings(); },
  },
  '!exp_pdf': {
    desc: 'Generate and export PDF of the current preview panel',
    func: () => { exportPDFFromPreview(); }
  },
  '!help': {
    desc: 'Shows all the available commands',
    func: () => {
      let ret = '';
      let longest = Object.keys(commandList).reduce((prev, curr) => curr.length > prev ? curr.length : prev, 0) + 6;
      Object.entries(commandList).forEach(([key, value]) => {
        ret += `${key}${" ".repeat(longest - key.length)}${value.desc}\n`;
      });

      ret += "------------------------------------------------------------------------\n";
      Object.entries(keyBindings.ctrl).forEach(([key, value]) => {
        ret += `ctrl + ${key}            ${value.desc}\n`;
      });
      Object.entries(keyBindings.ctrlshift).forEach(([key, value]) => {
        ret += `ctrl + shift + ${key}    ${value.desc}\n`;
      });

      print(ret);
    },
  },
};





/* ------------- PUBLIC API ------------- */


function getContent() {
  return editor.getValue();
}

function getModeFromName(filename) {
  return Object.entries(langInfo).find((item) => {
    const re = item[1].detector;
    if (filename.toLowerCase().match(re)) {
      return true;
    }

    return false;
  });
}


function setLanguage(langKey) {
  if (langKey === 'markdown') {
    //editor.on('input', markdownUpdater);
  } else {
    editor.off('input', markdownUpdater);
  }

  const lang = langInfo[langKey];
  const { mode } = modelist.get().modesByName[lang.mode];
  editor.session.setMode(mode);

  languageDisplaySelectedUi.innerText = lang.name;
  languageDisplaySelectedUi.dataset.value = langKey;
}

function setContent(content) {
  editor.setValue(content, -1);
}


function newWindow(filePaths = []) {
  filePaths = Array.isArray(filePaths) ? filePaths : [filePaths];
  window.api.newWindow(filePaths);
}

async function openFile(filePaths = []) {
  notifyLoadStart();

  filePaths = Array.isArray(filePaths) ? filePaths : [filePaths];

  if (!filePaths.length) {
    const { canceled, filePaths: _filePaths } = await window.api.showOpenDialog()
    if (canceled) {
      notifyLoadEnd();
      return;
    } else {
      filePaths = _filePaths;
    }
  }

  if (!file.path && (isSaved === null || isSaved)) {
    let fileToOpen = filePaths.shift();
    window.api.readFile(fileToOpen)
      .then(data => {
        editor.setValue(data, -1);
        _setFileInfo(fileToOpen);
        //webviewUi.src = 'about:blank'
        print(`Opened file ${fileToOpen}`);
      })
      .catch(err => {
        print(`Could not open file ${fileToOpen}<br>${err}`, INFO_LEVEL.error);
      }).finally(() => {
        notifyLoadEnd();
      });
  }

  if (filePaths.length) {
    newWindow(filePaths);
  }
  notifyLoadEnd();
}

async function saveFile(saveAs = false) {
  notifyLoadStart();

  let filePath = file.path + file.name + file.extension;

  if (file.path === undefined || saveAs) {
    const lang = langInfo[languageDisplaySelectedUi.dataset.value];
    const options = {
      defaultPath: `~/${lang.tempname}`,
      filters: [
        { name: lang.name, extensions: lang.ext },
        { name: 'All Files', extensions: ['*'] },
      ],
    };

    let { canceled, filePath: _filepath } = await window.api.showSaveDialog(options);

    if (canceled) {
      notifyLoadEnd();
      return;
    } else {
      filePath = _filepath;
    }
  }

  await window.api.writeFile(filePath, getContent());

  if (file.path === undefined || saveAs) {
    print(`file saved as ${filePath}`);
  }
  _setFileInfo(filePath);

  notifyLoadEnd();
}



/* ------------- UI ------------- */

function setTheme(name) {
  editor.setTheme(name);
  themeChoiceUi.value = name;
  window.api.storeSetting('theme', name)
}

function setFontSize(size) {
  editor.setFontSize(size);
  window.api.storeSetting('font_size', size)
}


function notify(type) {
  document.getElementById('status-display').className = '';
  // document.getElementById('status-display').offsetWidth;
  document.getElementById('status-display').classList.add(type);
}

function notifyLoadStart() {
  document.getElementById('status-bar').classList.add('load');
}

function notifyLoadEnd() {
  document.getElementById('status-bar').className = '';
}

function print(text, mode = INFO_LEVEL.info) {
  const block = document.createElement('div');
  block.classList.add(Object.keys(INFO_LEVEL).find((key) => INFO_LEVEL[key] === mode));

  errorSVG.get().then((svg) => {
    block.innerHTML = (mode === 4 ? svg : '') + text;
  });
  consoleOutUi.appendChild(block);

  if (mode >= 2) {
    const ret = Object.keys(INFO_LEVEL).find((key) => INFO_LEVEL[key] === mode);
    notify(ret);
  }

  setTimeout(() => consoleUi.scrollTo({ top: consoleUi.scrollHeight, behavior: 'smooth' }), 0);
}



/* ------------- FEATURES ------------- */

function beautifyDocument() {
  beautify.get().beautify(editor.session);
}

function makeLanguageTemplate() {
  if ((languageDisplaySelectedUi.dataset.value in langInfo) && langInfo[languageDisplaySelectedUi.dataset.value].templ) {
    editor.setValue(langInfo[languageDisplaySelectedUi.dataset.value].templ, -1);
  } else {
    print(`No default template exists for ${languageDisplaySelectedUi.dataset.value}`, INFO_LEVEL.warn);
  }
}

function evaluateMathInline() {
  const range = editor.selection.getRange();
  let func = editor.getSelectedText();
  if (range.start.row === range.end.row && range.start.column === range.end.column) {
    func = editor.session.getLine(range.start.row);
  }

  try {
    const result = _calculate(func);
    editor.session.insert(editor.selection.getRange().end, ` = ${result}`);
    notify('confirm');
  } catch (error) {
    print(`Unable to calculate '${func}'`, INFO_LEVEL.error);
  }
}

async function exportPDFFromPreview() {
  if (!file.path) {
    print("Filepath not set for export", INFO_LEVEL.warn);
    return;
  }
  if (webviewUi.src === "" || webviewUi.src === "about:blank") {
    print("Document not suitable for PDF export.", INFO_LEVEL.warn);
    return;
  }

  const pdfPath = window.api.path.resolve(file.path, file.name + '.pdf');

  let data = await webviewUi.printToPDF({ landscape: false, pageSize: 'A4' });
  let error = await window.api.writeFile(pdfPath, data);

  if (error) {
    print(`Failed to write PDF to ${pdfPath}:\n${error}`, INFO_LEVEL.error);
  } else {
    print(`PDF successfully stored to ${pdfPath}`, INFO_LEVEL.confirm);
  }
}

function openSettings() {
  newWindow(userPrefPath);
}

function openLanguageSettings() {
  newWindow(langPrefPath);
}

async function killProcess() {
  //return new Promise((resolve, reject) => {
  if (runningProcess != null) {
    await runningProcess.dispatch("kill");
  }
  /*  
    , (err) => {
      if (err) {
        print('Could not stop the running process.', INFO_LEVEL.error);
        reject();
      } else {
        resolve();
      }
    });
  } else {
    resolve();
  }
});
*/
}




/* ------------- PRIVATE HELPERS ------------- */

function _debounce(func, wait, immediate) {
  let timeout;
  return () => {
    const context = this; const
      args = arguments;
    const later = () => {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    const callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
}



const markdownUpdater = _debounce(() => {
  const markedHtml = mdToHTML();
  webviewUi.send('fill_content', markedHtml);
  //webviewUi.contentWindow.document.body.innerHTML = markedHtml;

}, 200);








function toggleDevTool() {
  const targetId = webviewUi.getWebContentsId();
  const devtoolsId = webviewDevUi.getWebContentsId();
  window.api.openDevTool(targetId, devtoolsId);
  togglePreviewDivider();
}



function mdToHTML() {
  const basepath = file.path.replaceAll('\\', '/');
  let pre = getContent();
  pre = pre.replaceAll(/src="\.\/(.*?)"/ig, `src="${basepath}$1"`);
  let markedHtml = window.api.markedParse(pre, { baseUrl: basepath });

  let parser = new DOMParser();
  let htmlDoc = parser.parseFromString(markedHtml, 'text/html');
  let sections = [...htmlDoc.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]')];

  let toc = sections.map(el => `<li><a href="#${el.id}">${el.nodeName} - ${el.innerText}</a></li>`).join("");
  toc = `<ul>${toc}</ul>`;

  markedHtml = markedHtml.replace(/\[TOC\]/, toc);

  return markedHtml;
}



function commandRunner(command, args, callback) {
  notifyLoadStart();
  print(`> ${command}`, INFO_LEVEL.user);


  runningProcess = window.api.spawnProcess(command, args, file.path);

  runningProcess.registerHandler('error', (err) => {
    print(err, INFO_LEVEL.err);
  });

  runningProcess.registerHandler('stdout', (data) => {
    print(data.toString());
  });

  runningProcess.registerHandler('stderr', (data) => {
    if (file.lang !== undefined && langInfo[file.lang].linere != null) {
      const line = langInfo[file.lang].linere.replaceAll('<name>', file.name);
      const re = new RegExp(line, 'gi');
      data = data.replaceAll(re, '<a class="jump-to-line" href="#$2">$1</a>');
    }
    print(data, INFO_LEVEL.error);
  });
  processIndicatorUi.classList.add('active');

  runningProcess.registerHandler('close', (code) => {
    // Here you can get the exit code of the script
    switch (code) {
      case 0:
        notify('confirm');
        break;
      default:
        notify('error');
        break;
    }

    processIndicatorUi.classList.remove('active');
    notifyLoadEnd();
    runningProcess = null;

    if (callback !== undefined) {
      callback(code);
    }
  });
}

function runCommand(command, args, callback = undefined) {
  killProcess().then(() => { commandRunner(command, args, callback); });
}

async function runFile() {
  if (file.lang in langInfo) {
    let cmdRun = langInfo[file.lang].run;
    if (cmdRun) {
      cmdRun = cmdRun.replaceAll('<name>', file.name);
      cmdRun = cmdRun.replaceAll('<path>', file.path);
      cmdRun = cmdRun.replaceAll('<exe_extension>', getExeExtension(appInfo.os));

      runCommand(cmdRun);
    } else if (file.lang === 'latex') {
      webviewUi.className = "";

      webviewUi.src = `${file.path + file.name}.pdf?v=${Date.now()}`;
    } else if (file.lang === 'markdown') {
      webviewUi.className = "";

      const markedHtml = mdToHTML();

      webviewUi.addEventListener('did-finish-load', () => {
        webviewUi.send('fill_content', markedHtml);
        editor.on('input', markdownUpdater);
      }, { once: true });

      webviewUi.src = "./res/embed/markdown/index.html";


    } else if (file.lang === 'html') {
      webviewUi.className = "";
      webviewUi.classList.add("html-style");

      webviewUi.src = (`${file.path + file.name}.html`);
    } else {
      webviewUi.className = "";
      webviewUi.src = 'about:blank';
    }
  }
}

async function buildRunFile() {
  if (file.path === undefined || !isSaved) {
    try {
      await saveFile();
    } catch (err) {
      return;
    }
  }


  if (file.lang in langInfo) {
    let cmdComp = langInfo[file.lang].comp;
    if (cmdComp) {
      cmdComp = cmdComp.replaceAll('<name>', file.name);
      cmdComp = cmdComp.replaceAll('<path>', file.path);
      cmdComp = cmdComp.replaceAll('<exe_extension>', getExeExtension(appInfo.os));

      runCommand(cmdComp, [], (code) => {
        if (code === 0) {
          runFile();
        }
      });
    } else {
      runFile();
    }
  } else {
    // if(file.mime != "text/plain"){
    webviewUi.src = file.path + file.name + file.extension;
    console.log(file.path + file.name + file.extension);
    console.log(webviewUi.src);
    // }else{
    // notify("warn");
    // print("No action defined for " + language_display_ui.value);
    // }
  }
}


function togglePreviewDivider(open = undefined) {
  const num = parseFloat(previewDevDivUi.previousElementSibling.style.height.replace('%', ''));

  let targetPercent = "100%";
  if (open === undefined) {
    targetPercent = Math.abs(num - 60) < 1 ? '99%' : '60%';
  } else {
    targetPercent = open ? '99%' : '60%';
  }

  const anim = previewDevDivUi.previousElementSibling.animate([
    { height: previewDevDivUi.previousElementSibling.style.height },
    { height: targetPercent },
  ], {
    duration: 450,
    easing: 'cubic-bezier(0.860, 0.000, 0.070, 1.000)',
  });
  anim.finished.then(() => {
    previewDevDivUi.previousElementSibling.style.height = targetPercent;
    //window.api.storeSetting('console_div_percent', targetPercent)
  });
}

function _updateTitle() {
  let title = file.extension ? file.name + file.extension : 'new document';

  if (!(isSaved === null || isSaved)) {    
    title = `${title}*`;
  }

  if(documentNameUi.textContent === title) return;

  documentNameUi.textContent = title;
  window.api.setTitle(title);
}

function _setFileInfo(filePath) {
  file.extension = window.api.path.extname(filePath);
  file.path = window.api.path.dirname(filePath) + window.api.path.sep;
  file.name = window.api.path.basename(filePath, file.extension);

  const lang = getModeFromName(file.name + file.extension);
  if (lang == null) {
    file.lang = 'plaintext';
  } else {
    file.lang = lang[0];
  }

  setLanguage(file.lang);
  isSaved = true;
  _updateTitle();
}

function _toggleFullscreenStyle(isFullscreen) {
  if (isFullscreen) {
    document.body.classList.add('fullscreen');
  } else {
    document.body.classList.remove('fullscreen');
  }
}

function _calculate(string) {
  // eslint-disable-next-line no-new-func
  return Function(`return (${string})`)();
}

function _assignUIVariables() {
  documentNameUi = document.getElementById('document-name');
  languageDisplayUi = document.getElementById('language-display');
  languageDisplaySelectedUi = document.querySelector("#language-display .selected");
  themeChoiceUi = document.getElementById('theme-choice');
  charDisplayUi = document.getElementById('fchar-display');
  consoleUi = document.getElementById('console');
  consoleInUi = document.getElementById('console-in');
  consoleOutUi = document.getElementById('console-out');
  webviewUi = document.getElementById('embed-content');
  webviewDevUi = document.getElementById('embed-content-dev-view');
  themeLink = document.getElementById('theme-link');
  editorMediaDivUi = document.getElementById('editor-media-div');
  editorConsoleDivUi = document.getElementById('editor-console-div');
  previewDevDivUi = document.getElementById('preview-dev-div');
  processIndicatorUi = document.getElementById('process-indicator');
}

function _initializeOptions(config) {
  themelist.get().themes.forEach((theme) => {
    const option = document.createElement('option');
    option.text = theme.caption;
    option.value = theme.theme;
    themeChoiceUi.add(option);
  });

  themeChoiceUi.value = config.theme;
}

async function _initialize() {
  // Initialize all ui elements
  _assignUIVariables();

  const settings = await window.api.getInitialSettings();
  appInfo = settings.appInfo;
  editorConfig = settings.editorConfig;
  windowConfig = settings.windowConfig;
  localWindowConfig = settings.localWindowConfig;
  userPrefPath = settings.userPrefPath;
  langPrefPath = settings.languageConfigPath;


  editor = ace.edit('main-text-area', {
    enableBasicAutocompletion: true,
    showPrintMargin: false,
    showLineNumbers: editorConfig.line_numbers,
    showGutter: editorConfig.line_numbers,
    wrap: editorConfig.line_wrapping,
    scrollPastEnd: 1,
    fixedWidthGutter: true,
    fadeFoldWidgets: true,
    highlightActiveLine: false,
    useWorker: false,
    theme: editorConfig.theme,
    fontSize: editorConfig.font_size,
  });

  document.addEventListener('drop', (event) => {
    event.preventDefault();
    event.stopPropagation();

    Array.from(event.dataTransfer.files).forEach((f) => {
      openFile(f.path);
    });
  });

  if (!windowConfig.native_frame) {
    document.body.classList.add('rounded');
  }
  if (localWindowConfig.maximized) {
    document.body.classList.add('fullscreen');
  }

  const ro = new ResizeObserver(() => {
    editor.resize();
  });
  ro.observe(document.getElementById('editor-wrapper'));

  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener('mousewheel', (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      let size = editor.getFontSize() + Math.sign(e.deltaY);
      size = Math.min(Math.max(size, 3), 80);
      setFontSize(size);
    }
  }, { passive: false });

  editor.on('change', () => {
    if (isSaved === null || isSaved) {
      isSaved = false;
      _updateTitle();
    }
  });

  document.getElementById('min-button').addEventListener('click', () => {
    window.api.minimize();
  });

  document.getElementById('max-button').addEventListener('click', () => {
    window.api.toggleMaxUnmax();
  });

  document.getElementById('close-button').addEventListener('click', () => {
    killProcess().then(() => window.api.close());
  });

  document.getElementById('pin-button').addEventListener('click', (e) => {
    window.api.togglePin().then(pinned => {
      if (!pinned) {
        e.target.classList.add('pinned');
      } else {
        e.target.classList.remove('pinned');
      }
    });
  });


  window.api.updateMaxUnmax((_, value) => {
    _toggleFullscreenStyle(value);
  });

  window.api.canClose((event) => {
    event.sender.send('can-close-response', (isSaved === null || isSaved));
  });

  window.api.print((_, value) => {
    print(value.text);
  });


  const emittedOnce = (element, eventName) => new Promise(resolve => {
    element.addEventListener(eventName, event => resolve(event), { once: true })
  })
  const browserReady = emittedOnce(webviewUi, 'dom-ready');
  const devtoolsReady = emittedOnce(webviewDevUi, 'dom-ready');
  Promise.all([browserReady, devtoolsReady]).then(() => {

  })


  window.addEventListener('keydown', (event) => {
    let lowerKey = event.key.toLowerCase();
    if (event.ctrlKey && !event.shiftKey) {
      if (lowerKey in keyBindings.ctrl) {
        event.preventDefault();
        keyBindings.ctrl[lowerKey].func();
      }
    } else if (event.ctrlKey && event.shiftKey) {
      if (lowerKey in keyBindings.ctrlshift) {
        event.preventDefault();
        keyBindings.ctrlshift[lowerKey].func();
      }
    }
  }, false);

  document.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('jump-to-line')) {
      const line = parseInt(e.target.getAttribute('href').replace('#', ''), 10);
      editor.selection.clearSelection();
      editor.selection.moveCursorToPosition({ row: line - 1, column: 0 });
      editor.selection.selectLineEnd();
      editor.scrollToLine(line - 1, true, true);
    }
  });

  consoleInUi.addEventListener('keydown', (event) => {
    if (!event.shiftKey && event.key === 'Enter') {
      event.preventDefault();
      const cmd = consoleInUi.value.replace(/\n$/, '');
      consoleInUi.value = '';

      if (historyIndex !== undefined) {
        commandHistory.pop();
        historyIndex = undefined;
      }
      commandHistory.push(cmd);

      const pre = cmd.split(' ')[0];

      if (pre in commandList) {
        print(pre, INFO_LEVEL.user);
        commandList[pre].func();
      } else if (cmd.startsWith('!')) {
        print(pre, INFO_LEVEL.user);
        print('Command not recognized. Try !help.', INFO_LEVEL.warn);
      } else if (runningProcess != null) {
        runningProcess.dispatch("stdin", `${cmd}\n`);
      } else {
        runCommand(cmd);
      }

      return false;
    } if (!event.ctrlKey && event.key === 'ArrowUp') {
      event.preventDefault();
      const currCmd = consoleInUi.value;

      if (historyIndex === undefined) {
        commandHistory.push(currCmd);
        historyIndex = commandHistory.length - 2;
      } else {
        if (historyIndex - 1 < 0) {
          historyIndex = commandHistory.length;
        }
        historyIndex -= 1;
      }

      consoleInUi.value = commandHistory[historyIndex];
      return false;
    }
    return true;
  }, false);

  /*
  languageDisplayUi.addEventListener('change', () => {
    setLanguage(languageDisplayUi.value);
  });
*/
  themeChoiceUi.addEventListener('change', () => {
    setTheme(themeChoiceUi.value);
  });


  var optionsContainer = document.getElementsByClassName("options-container")[0];
  languageDisplaySelectedUi.addEventListener("click", () => {
    //console.log("click", optionsContainer.classList);
    if(optionsContainer.classList.contains("active")){
      //console.log("click to close");
      optionsContainer.classList.remove("active");
    }else{
      //console.log("click to open");
      optionsContainer.classList.add("active");
      document.addEventListener("click", (e) => {
        //console.log(e.target, languageDisplaySelectedUi.contains(e.target))
        if(languageDisplaySelectedUi.contains(e.target)) return;
        //console.log("click outside to close");
        optionsContainer.classList.remove("active");
      }, {once: true});
    }
  });

  try {
    const response = await fetch('res/lang.json');
    const data = await response.text();
    langInfo = JSON.parse(data);
    mergeDeep(langInfo, settings.languageConfig);

    Object.entries(langInfo).forEach((el) => {
      const option = document.createElement('div');
      option.classList.add("option");
      const [name, obj] = el;
      option.innerText = obj.name;
      option.dataset.value = name;
      optionsContainer.appendChild(option);
      option.addEventListener("click", () => {
        optionsContainer.classList.remove("active");
        setLanguage(option.dataset.value);
      });
    });

  } catch (err) {
    print(`An error ocurred reading the file :${err.message}`, INFO_LEVEL.err);
    return;
  }





  webviewUi.addEventListener('console-message', (e) => {
    if (e.sourceId === 'electron/js2c/renderer_init.js') return;

    let mode = 1;
    switch (e.level) {
      case 1:
        mode = INFO_LEVEL.info;
        break;
      case 2:
        mode = INFO_LEVEL.warn;
        break;
      case 3:
        mode = INFO_LEVEL.error;
        break;
      default:
        mode = INFO_LEVEL.info;
        break;
    }

    const source = e.sourceId.split('/').pop();
    let fileSource = `${source}:${e.line}`;

    if (source === (file.name + file.extension)) {
      fileSource = `<a class="jump-to-line" href="#${e.line}">${fileSource}</a>`;
    }

    print(`Message from ${fileSource}\n${e.message}`, mode);
  });



  editorMediaDivUi.addEventListener('divider-move', () => {
    const val = editorMediaDivUi.previousElementSibling.style.width;
    window.api.storeSetting('media_div_percent', val)
  });
  editorConsoleDivUi.addEventListener('divider-move', () => {
    const val = editorConsoleDivUi.previousElementSibling.style.height;
    window.api.storeSetting('console_div_percent', val)
  });

  editorMediaDivUi.addEventListener('dblclick', () => {
    const num = parseFloat(editorMediaDivUi.previousElementSibling.style.width.replace('%', ''));
    const targetPercent = Math.abs(num - 50) < 1 ? '100%' : '50%';

    const anim = editorMediaDivUi.previousElementSibling.animate([
      { width: editorMediaDivUi.previousElementSibling.style.width },
      { width: targetPercent },
    ], {
      duration: 450,
      easing: 'cubic-bezier(0.860, 0.000, 0.070, 1.000)',
    });
    anim.finished.then(() => {
      editorMediaDivUi.previousElementSibling.style.width = targetPercent;
      window.api.storeSetting('media_div_percent', targetPercent)
    });
  });
  editorConsoleDivUi.addEventListener('dblclick', () => {
    const num = parseFloat(editorConsoleDivUi.previousElementSibling.style.height.replace('%', ''));
    const targetPercent = Math.abs(num - 60) < 1 ? '100%' : '60%';

    const anim = editorConsoleDivUi.previousElementSibling.animate([
      { height: editorConsoleDivUi.previousElementSibling.style.height },
      { height: targetPercent },
    ], {
      duration: 450,
      easing: 'cubic-bezier(0.860, 0.000, 0.070, 1.000)',
    });
    anim.finished.then(() => {
      editorConsoleDivUi.previousElementSibling.style.height = targetPercent;
      window.api.storeSetting('console_div_percent', targetPercent)
    });
  });



  previewDevDivUi.addEventListener('dblclick', () => {
    togglePreviewDivider();
  });

  document.getElementById('editor-wrapper').style.width = editorConfig.media_div_percent;
  document.getElementById('main-divider').style.height = editorConfig.console_div_percent;
  document.getElementById('embed-content').style.height = "100%";

  print(`${appInfo.name} ${appInfo.version}`);

  if (settings.filePathsToOpen.length) {
    openFile(settings.filePathsToOpen);
  } else {
    setLanguage("plaintext");
  }
}



document.addEventListener('DOMContentLoaded', () => {
  const resizable = (resizer) => {
    const direction = resizer.getAttribute('data-direction') || 'horizontal';
    const prevSibling = resizer.previousElementSibling;
    const nextSibling = resizer.nextElementSibling;

    // The current position of mouse
    let x = 0;
    let y = 0;
    let prevSiblingHeight = 0;
    let prevSiblingWidth = 0;

    const mouseMoveHandler = (e) => {
      // How far the mouse has been moved
      const dx = e.clientX - x;
      const dy = e.clientY - y;

      switch (direction) {
        case 'vertical': {
          const h = (prevSiblingHeight + dy) * 100 / resizer.parentNode.getBoundingClientRect().height;
          prevSibling.style.height = `${h}% `;
          break;
        }
        case 'horizontal':
        default: {
          const w = (prevSiblingWidth + dx) * 100 / resizer.parentNode.getBoundingClientRect().width;
          prevSibling.style.width = `${w}% `;
          break;
        }
      }

      prevSibling.style.userSelect = 'none';
      prevSibling.style.pointerEvents = 'none';

      nextSibling.style.userSelect = 'none';
      nextSibling.style.pointerEvents = 'none';
    };

    const mouseUpHandler = () => {
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
      const event = new CustomEvent('divider-move');
      resizer.dispatchEvent(event);
    };

    // Handle the mousedown event
    // that's triggered when user drags the resizer
    const mouseDownHandler = (e) => {
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

    // Attach the handler
    resizer.addEventListener('mousedown', mouseDownHandler);
  };

  // Query all resizers
  document.querySelectorAll('.resizer').forEach((ele) => {
    resizable(ele);
  });
});

/* ---- DOCUMENT READY ---- */
document.addEventListener('DOMContentLoaded', _initialize);