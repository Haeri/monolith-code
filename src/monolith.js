/* eslint-disable no-underscore-dangle */
/* eslint-disable import/no-extraneous-dependencies */

const { ipcRenderer, webFrame } = require('electron');
const fs = require('fs');
const path = require('path');

const errorSVG = '<svg version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 52 52" style="enable-background:new 0 0 52 52;" xml:space="preserve"><g>	<path d="M26,0C11.664,0,0,11.663,0,26s11.664,26,26,26s26-11.663,26-26S40.336,0,26,0z M26,50C12.767,50,2,39.233,2,26	S12.767,2,26,2s24,10.767,24,24S39.233,50,26,50z"/>	<path d="M35.707,16.293c-0.391-0.391-1.023-0.391-1.414,0L26,24.586l-8.293-8.293c-0.391-0.391-1.023-0.391-1.414,0 s-0.391,1.023,0,1.414L24.586,26l-8.293,8.293c-0.391,0.391-0.391,1.023,0,1.414C16.488,35.902,16.744,36,17,36 s0.512-0.098,0.707-0.293L26,27.414l8.293,8.293C34.488,35.902,34.744,36,35,36s0.512-0.098,0.707-0.293 c0.391-0.391,0.391-1.023,0-1.414L27.414,26l8.293-8.293C36.098,17.316,36.098,16.684,35.707,16.293z"/></g></svg>';

let _remote = null;
let _dialog = null;
let _childProcess = null;
let _marked = null;
let _hljs = null;
let _modelist = null;
let _themelist = null;
let _beautify = null;
let _appInfo = null;
let _tKill = null;
let _pdf = null;

let _mdTemplate = null;
let editor = null;

const file = {
  name: undefined,
  extension: undefined,
  path: undefined,
  lang: undefined,
};
let langInfo;
let runningProcess;
let isSaved = true;
let editorConfig;
let windowConfig;
let localWindowConfig;
let userPrefPath;
let langPrefPath;

let documentNameUi;
let languageDisplayUi;
let themeChoiceUi;
let consoleUi;
let consoleInUi;
let consoleOutUi;
let webviewUi;
let editorMediaDivUi;
let editorConsoleDivUi;
let processIndicatorUi;

let commandList = {};
const commandHistory = [];
let historyIndex;

let scrollBarsCss;

const INFO_LEVEL = Object.freeze({
  user: 0,
  info: 1,
  confirm: 2,
  warn: 3,
  error: 4,
});

function requireMarked() {
  if (_marked === null) {
    _marked = require('marked');
    _hljs = require('highlight.js');
    const _katex = require('katex');

    const renderer = new _marked.Renderer();
    let originParagraph = renderer.paragraph.bind(renderer)
    renderer.paragraph = (text) => {
      const blockRegex = /\$\$[^\$]*\$\$/g
      const inlineRegex = /\$[^\$]*\$/g
      let blockExprArray = text.match(blockRegex)
      let inlineExprArray = text.match(inlineRegex)
      for (let i in blockExprArray) {
        const expr = blockExprArray[i]
        const result = renderMathsExpression(expr)
        text = text.replace(expr, result)
      }
      for (let i in inlineExprArray) {
        const expr = inlineExprArray[i]
        const result = renderMathsExpression(expr)
        text = text.replace(expr, result)
      }
      return originParagraph(text)
    }
    function renderMathsExpression (expr) {
      if (expr[0] === '$' && expr[expr.length - 1] === '$') {
        let displayStyle = false
        expr = expr.substr(1, expr.length - 2)
        if (expr[0] === '$' && expr[expr.length - 1] === '$') {
          displayStyle = true
          expr = expr.substr(1, expr.length - 2)
        }
        let html = null
        try {
          html = _katex.renderToString(expr)
        } catch (e) {
          console.error(e)
        }
        /*
        if (displayStyle && html) {
          html = html.replace(/class="katex"/g, 'class="katex katex-block" style="display: block;"')
        }
        */
        return html
      } else {
        return null
      }
    }


    _marked.setOptions({
      renderer: renderer,
      highlight: (code, lang) => {
        const validLanguage = _hljs.getLanguage(lang) ? lang : 'plaintext';
        return _hljs.highlight(code, {language: validLanguage}).value;
      },
    });
  }

  return _marked;
}

function requireRemote() {
  if (_remote === null) {
    _remote = require('electron').remote;
  }
  return _remote;
}
function requireDialog() {
  if (_dialog === null) {
    _dialog = requireRemote().dialog;
  }
  return _dialog;
}
function requireChildProcess() {
  if (_childProcess === null) {
    _childProcess = require('child_process');
  }
  return _childProcess;
}
function requireModeList() {
  if (_modelist === null) {
    _modelist = ace.require('ace/ext/modelist');
  }
  return _modelist;
}
function requireThemeList() {
  if (_themelist === null) {
    _themelist = ace.require('ace/ext/themelist');
  }
  return _themelist;
}
function requireBeautify() {
  if (_beautify === null) {
    _beautify = ace.require('ace/ext/beautify');
  }
  return _beautify;
}

function requireTreeKill() {
  if (_tKill === null) {
    _tKill = require('tree-kill');
  }
  return _tKill;
}

function requirePdf() {
  if (_pdf === null) {
    _pdf = require('html-pdf');
  }
  return _pdf;
}

function getAppInfo() {
  if (_appInfo === null) {
    _appInfo = {
      version: requireRemote().app.getVersion(),
      name: 'monolith code',
    };
  }
  return _appInfo;
}

function getMdTemplate() {
  if (_mdTemplate === null) {
    _mdTemplate = path.resolve(__dirname, 'res/embed/markdown/index.html');
  }
  return _mdTemplate;
}

function debounce(func, wait, immediate) {
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

function getContent() {
  return editor.getValue();
}

function exportPDFFromPreview() {  
  if(!file.path){
    print("Filepath not set for export", INFO_LEVEL.warn);
    return;
  }
  if(webviewUi.src === "" || webviewUi.src === "about:blank") {
    print("Document not suitable for PDF export.", INFO_LEVEL.warn);
    return;
  }

  const pdfPath = path.resolve(file.path, file.name + '.pdf');

  webviewUi.printToPDF({landscape: false, pageSize: 'A4'}).then(data => {
    fs.writeFile(pdfPath, data, (error) => {
      if (error) {
        print(`Failed to write PDF to ${pdfPath}:\n${error}`, INFO_LEVEL.error);
        return
      }
      print(`PDF successfully stored to ${pdfPath}`, INFO_LEVEL.confirm);
    })
  }).catch(error => {
    print(`Failed to write PDF to ${pdfPath}:\n${error}`, INFO_LEVEL.error);
  })
}

const markdownUpdater = debounce(() => {
  const markedHtml = mdToHTML();
  webviewUi.send('fill_content', markedHtml);
}, 200);

function newWindow(file_path = undefined) {
  ipcRenderer.send('new-window', file_path);
}

function setSaved(saved) {
  if (isSaved !== saved) {
    const title = file.extension ? file.name + file.extension : 'new document';
    if (saved) {
      documentNameUi.textContent = title;
    } else {
      documentNameUi.textContent = `${title}*`;
    }
    isSaved = saved;
  }
}

function setLanguage(langKey) {
  if (langKey === 'markdown') {
    //editor.on('input', markdownUpdater);
  } else {
    editor.off('input', markdownUpdater);
  }

  const lang = langInfo[langKey];
  const { mode } = requireModeList().modesByName[lang.mode];
  editor.session.setMode(mode);
  languageDisplayUi.value = langKey;
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

function setFileInfo(filePath) {
  file.extension = path.extname(filePath);
  file.path = path.dirname(filePath) + path.sep;
  file.name = path.basename(filePath, file.extension);

  const lang = getModeFromName(file.name + file.extension);
  if (lang == null) {
    file.lang = 'plaintext';
  } else {
    file.lang = lang[0];
  }

  setSaved(true);
  setLanguage(file.lang);
}

function toggleFullscreenStyle(isFullscreen) {
  if (isFullscreen) {
    document.body.classList.add('fullscreen');
  } else {
    document.body.classList.remove('fullscreen');
  }
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
  block.innerHTML = (mode === 4 ? errorSVG : '') + text;
  consoleOutUi.appendChild(block);

  if (mode >= 2) {
    const ret = Object.keys(INFO_LEVEL).find((key) => INFO_LEVEL[key] === mode);
    notify(ret);
  }

  consoleUi.scrollTo({ top: consoleUi.scrollHeight, behavior: 'smooth' });
}

function writeFile(filePath, content, callback = undefined) {
  fs.writeFile(filePath, content, (err) => {
    if (!err) {
      notify('confirm');
    } else {
      print(err, INFO_LEVEL.error);
    }
    if (callback !== undefined) callback(err);
  });
}

function openFile(filepath) {
  if (file.path || !isSaved) {
    newWindow(filepath);
  } else {
    fs.readFile(filepath, 'utf-8', (err, data) => {
      if (!err) {
        editor.setValue(data, -1);
        setFileInfo(filepath);
        //webviewUi.setAttribute('src', undefined);
        webviewUi.src = 'about:blank'
        print(`Opened file ${filepath}`);
      } else {
        print(`Could not open file ${filepath}`, INFO_LEVEL.error);
      }
    });
  }
}

function saveFile(content, saveAs = false, callback = undefined) {
  if (file.path === undefined || saveAs) {
    const lang = langInfo[languageDisplayUi.value];
    const options = {
      defaultPath: `~/${lang.tempname}`,
      filters: [
        { name: lang.name, extensions: lang.ext },
        { name: 'All Files', extensions: ['*'] },
      ],
    };
    const window = requireRemote().getCurrentWindow();
    requireDialog().showSaveDialog(window, options).then((ret) => {
      if (!ret.canceled) {
        writeFile(ret.filePath, content, (err) => {
          if (!err) {
            setFileInfo(ret.filePath);
            print(`file saved as ${ret.filePath}`);

            if (callback !== undefined) callback();
          }
        });
      }
    });
  } else {
    writeFile(file.path + file.name + file.extension, getContent(), (err) => {
      if (!err) {
        setSaved(true);
      }
      if (callback !== undefined) callback(err);
    });
  }
}

function setTheme(name) {
  editor.setTheme(name);
  themeChoiceUi.value = name;
  ipcRenderer.send('store-setting', 'theme', name);
}

function setFontSize(size) {
  editor.setFontSize(size);
  ipcRenderer.send('store-setting', 'font_size', size);
}

function mdToHTML() {
  const basepath = file.path.replaceAll('\\', '/');
  let pre = getContent();
  pre = pre.replaceAll(/src="\.\/(.*?)"/ig, `src="${basepath}$1"`);
  let markedHtml = requireMarked().parse(pre, { baseUrl: basepath });

  var parser = new DOMParser();
  var htmlDoc = parser.parseFromString(markedHtml, 'text/html');
  let sections = [...htmlDoc.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]')];

  let toc = sections.map(el => `<li><a href="#${el.id}">${el.nodeName} - ${el.innerText}</a></li>`).join("");
  toc = `<ul>${toc}</ul>`;

  markedHtml = markedHtml.replace(/\[TOC\]/, toc);

  return markedHtml;
}

function calculate(string) {
  // eslint-disable-next-line no-new-func
  return Function(`return (${string})`)();
}

function openSettings() {
  newWindow(userPrefPath);
}

function openLanguageSettings() {
  newWindow(langPrefPath);
}

function commandRunner(command, args, callback) {
  notifyLoadStart();
  print(`> ${command}`, INFO_LEVEL.user);

  runningProcess = requireChildProcess().spawn(command, args, {
    encoding: 'utf8',
    shell: true,
    ...file.path && { cwd: file.path },
  });

  runningProcess.on('error', (err) => {
    print(err, INFO_LEVEL.err);
  });

  runningProcess.stdout.setEncoding('utf8');
  runningProcess.stdout.on('data', (data) => {
    print(data.toString());
  });

  runningProcess.stderr.setEncoding('utf8');
  runningProcess.stderr.on('data', (data) => {
    let dataString = data.toString();
    if (file.lang !== undefined && langInfo[file.lang].linere != null) {
      const line = langInfo[file.lang].linere.replaceAll('<name>', file.name);
      const re = new RegExp(line, 'gi');
      dataString = dataString.replaceAll(re, '<a class="jump-to-line" href="#$2">$1</a>');
    }
    print(dataString, INFO_LEVEL.error);
  });
  processIndicatorUi.classList.add('active');

  runningProcess.on('close', (code) => {
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
  if (runningProcess != null) {
    requireTreeKill()(runningProcess.pid, 'SIGKILL', (err) => {
      if (err) {
        print('Could not stop the running process.', INFO_LEVEL.error);
      } else {
        commandRunner(command, args, callback);
      }
    });
  } else {
    commandRunner(command, args, callback);
  }
}

function runFile() {
  if (file.lang in langInfo) {
    let cmdRun = langInfo[file.lang].run;
    if (cmdRun) {
      cmdRun = cmdRun.replaceAll('<name>', file.name);
      cmdRun = cmdRun.replaceAll('<path>', file.path);
      cmdRun = cmdRun.replaceAll('<exe_extension>', getExeExtension());

      runCommand(cmdRun);
    } else if (file.lang === 'latex') {
      webviewUi.src = `${file.path + file.name}.pdf?v=${Date.now()}`;
    } else if (file.lang === 'markdown') {
      
      const markedHtml = mdToHTML();

      webviewUi.addEventListener('did-finish-load', () => {
        webviewUi.send('fill_content', markedHtml);
        editor.on('input', markdownUpdater);
      }, { once: true });
      webviewUi.src = getMdTemplate();

    } else if (file.lang === 'html') {
      webviewUi.src = (`${file.path + file.name}.html`);
    }
  }
}

function buildRunFile() {
  if (file.lang in langInfo) {
    let cmdComp = langInfo[file.lang].comp;
    if (cmdComp) {
      cmdComp = cmdComp.replaceAll('<name>', file.name);
      cmdComp = cmdComp.replaceAll('<path>', file.path);
      cmdComp = cmdComp.replaceAll('<exe_extension>', getExeExtension());

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

function assignVariables() {
  documentNameUi = document.getElementById('document-name');
  languageDisplayUi = document.getElementById('language-display');
  themeChoiceUi = document.getElementById('theme-choice');
  charDisplayUi = document.getElementById('fchar-display');
  consoleUi = document.getElementById('console');
  consoleInUi = document.getElementById('console-in');
  consoleOutUi = document.getElementById('console-out');
  webviewUi = document.getElementById('embed-content');
  themeLink = document.getElementById('theme-link');
  editorMediaDivUi = document.getElementById('editor-media-div');
  editorConsoleDivUi = document.getElementById('editor-console-div');
  processIndicatorUi = document.getElementById('process-indicator');
}

function initializeOptions(config) {
  requireThemeList().themes.forEach((theme) => {
    const option = document.createElement('option');
    option.text = theme.caption;
    option.value = theme.theme;
    themeChoiceUi.add(option);
  });

  themeChoiceUi.value = config.theme;
}

function initialize() {
  // Initialize all ui elements
  assignVariables();

  const settings = ipcRenderer.sendSync('initial-settings');
  editorConfig = settings.editorConfig;
  windowConfig = settings.windowConfig;
  localWindowConfig = settings.localWindowConfig;
  userPrefPath = settings.userPrefPath;
  langPrefPath = settings.languageConfigPath;

  webFrame.setVisualZoomLevelLimits(1, 3);

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

  if (windowConfig.rounded_window) {
    document.body.classList.add('rounded');
  }
  if(localWindowConfig.maximized){
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
    if (isSaved) {
      setSaved(false);
    } else if (getContent() === '') {
      setSaved(true);
    }
  });

  document.getElementById('min-button').addEventListener('click', () => {
    const window = requireRemote().getCurrentWindow();
    window.minimize();
  });

  document.getElementById('max-button').addEventListener('click', () => {
    const window = requireRemote().getCurrentWindow();
    if (!window.isMaximized()) {
      window.maximize();
      window.emit('maximize');
    } else {
      window.unmaximize();
      window.emit('unmaximize');
    }
  });

  document.getElementById('close-button').addEventListener('click', () => {
    const window = requireRemote().getCurrentWindow();

    if (runningProcess != null) {
      requireTreeKill()(runningProcess.pid, 'SIGKILL');
    }

    window.close();
  });

  document.getElementById('pin-button').addEventListener('click', (e) => {
    const window = requireRemote().getCurrentWindow();
    const pinned = window.isAlwaysOnTop();

    window.setAlwaysOnTop(!pinned);
    if (!pinned) {
      e.currentTarget.classList.add('pinned');
    } else {
      e.currentTarget.classList.remove('pinned');
    }
  });

  const browserWindow = requireRemote().getCurrentWindow();
  browserWindow.on('maximize', () => {
    toggleFullscreenStyle(true);
  });

  browserWindow.on('unmaximize', () => {
    toggleFullscreenStyle(false);
  });

  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === 'o') {
      event.preventDefault();
      notifyLoadStart();

      const options = {
        title: 'Open a file',
      };
      const window = requireRemote().getCurrentWindow();
      requireDialog().showOpenDialog(window, options).then((ret) => {
        if (!ret.canceled) {
          openFile(ret.filePaths[0]);
        }

        notifyLoadEnd();
      });
    } else if (event.ctrlKey && !event.shiftKey && event.key === 'b') {
      event.preventDefault();

      if (file.path === undefined || !isSaved) {
        saveFile(getContent(), false, () => {
          buildRunFile();
        });
      } else {
        buildRunFile();
      }
    } else if (event.ctrlKey && event.shiftKey && event.key === 'B') { // ctrl + shift + b
      event.preventDefault();
      requireBeautify().beautify(editor.session);
    } else if (event.ctrlKey && !event.shiftKey && event.key === 's') { // ctrl + s
      event.preventDefault();
      saveFile(getContent());
    } else if (event.ctrlKey && event.shiftKey && event.key === 'S') { // ctrl + shift + s
      event.preventDefault();
      saveFile(getContent(), true);
    } else if (event.ctrlKey && event.key === 'n') {
      event.preventDefault();
      newWindow();
    } else if (event.ctrlKey && event.key === 't') {
      openSettings();
    } else if (event.ctrlKey && event.key === '.') {
      event.preventDefault();
      if ((languageDisplayUi.value in langInfo) && langInfo[languageDisplayUi.value].templ) {
        editor.setValue(langInfo[languageDisplayUi.value].templ, -1);
      } else {
        print(`No default template exists for ${languageDisplayUi.value}`, INFO_LEVEL.warn);
      }
    } else if (event.ctrlKey && event.key === 'm') {
      event.preventDefault();
      const range = editor.selection.getRange();
      let func = editor.getSelectedText();
      if (range.start.row === range.end.row && range.start.column === range.end.column) {
        func = editor.session.getLine(range.start.row);
      }

      try {
        const result = calculate(func);
        editor.session.insert(editor.selection.getRange().end, ` = ${result}`);
        notify('confirm');
      } catch (error) {
        print(`Unable to calculate '${func}'`, INFO_LEVEL.error);
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
        runningProcess.stdin.write(`${cmd}\n`);
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

  languageDisplayUi.addEventListener('change', () => {
    setLanguage(languageDisplayUi.value);
  });

  themeChoiceUi.addEventListener('change', () => {
    setTheme(themeChoiceUi.value);
  });

  fs.readFile(path.resolve(__dirname, 'res/lang.json'), 'utf-8', (err, data) => {
    if (err) {
      print(`An error ocurred reading the file :${err.message}`, INFO_LEVEL.err);
      return;
    }
    langInfo = JSON.parse(data);    
    mergeDeep(langInfo, settings.languageConfig);    

    Object.entries(langInfo).forEach((el) => {
      const option = document.createElement('option');
      const [name, obj] = el;
      option.text = obj.name;
      option.value = name;
      languageDisplayUi.add(option);
    });

    languageDisplayUi.value = 'plaintext';
  });

  commandList = {
    '!ver': {
      desc: 'Shows the current version of the application.',
      func: () => { print(`${getAppInfo().name} ${getAppInfo().version}`); },
    },
    '!cls': {
      desc: 'Clear console.',
      func: () => { consoleOutUi.innerHTML = ''; },
    },
    '!kill': {
      desc: 'Kills the currently running process.',
      func: () => {
        if (runningProcess) {
          requireTreeKill()(runningProcess.pid, 'SIGKILL', (err) => {
            if (err) {
              print('Could not stop the running process.', INFO_LEVEL.error);
            }
          });
        } else {
          print('No Process to kill.', INFO_LEVEL.warn);
        }
      },
    },
    '!hello': {
      desc: 'Hello There :D',
      func: () => { print('Hi there :D'); },
    },
    '!dev': {
      desc: 'Open Chrome Devtools for the preview window',
      func: () => { webviewUi.openDevTools(); },
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
      desc: 'Shows all the available commands.',
      func: () => {
        let ret = '';
        let longest = Object.keys(commandList).reduce((prev, curr) => curr.length > prev ? curr.length : prev ,0) + 6;
        Object.entries(commandList).forEach(([key, value]) => {
          ret += `${key}${" ".repeat(longest - key.length)}${value.desc}\n`;
        });
        print(ret);
      },
    },
  };

  fs.readFile(path.resolve(__dirname, 'res/style/bars.css'), 'utf-8', (err, data) => {
    if (!err) {
      scrollBarsCss = data;
    }
  });

  webviewUi.addEventListener('load-commit', () => {
  });
  webviewUi.addEventListener('did-finish-load', () => {
    webviewUi.insertCSS(scrollBarsCss);
    webviewUi.insertCSS('body{background: transparent !important;}');
    webviewUi.send('onLoad');
  });
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


  webviewUi.addEventListener('ipc-message', (event) => {    
    console.log(event.channel);
  });


  editorMediaDivUi.addEventListener('divider-move', () => {
    const val = editorMediaDivUi.previousElementSibling.style.width;
    ipcRenderer.send('store-setting', 'media_div_percent', val);
  });
  editorConsoleDivUi.addEventListener('divider-move', () => {
    const val = editorConsoleDivUi.previousElementSibling.style.height;
    ipcRenderer.send('store-setting', 'console_div_percent', val);
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
      ipcRenderer.send('store-setting', 'media_div_percent', targetPercent);
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
      ipcRenderer.send('store-setting', 'console_div_percent', targetPercent);
    });
  });

  document.getElementById('editor-wrapper').style.width = editorConfig.media_div_percent;
  document.getElementById('main-divider').style.height = editorConfig.console_div_percent;

  ipcRenderer.on('can-close', (event) => {
    event.sender.send('can-close-response', isSaved);
  });

  ipcRenderer.on('print', (event, data) => {
    print(data.text);
  });

  print(`${getAppInfo().name} ${getAppInfo().version}`);

  const shouldOpen = window.process.argv.filter((s) => s.includes('--open-file='));
  if (shouldOpen.length > 0) {
    openFile(shouldOpen[0].replace(/--open-file="(.*)"/, '$1'));
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
          prevSibling.style.height = `${h}%`;
          break;
        }
        case 'horizontal':
        default: {
          const w = (prevSiblingWidth + dx) * 100 / resizer.parentNode.getBoundingClientRect().width;
          prevSibling.style.width = `${w}%`;
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
document.addEventListener('DOMContentLoaded', initialize);
