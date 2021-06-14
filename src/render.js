const { remote, webFrame, ipcRenderer } = require('electron');
const { dialog } = require('electron').remote;
const appVersion = require('electron').remote.app.getVersion();
const path = require('path');
const fs = require('fs');
const childProcess = require('child_process');
const marked = require('marked');
const hljs = require('highlight.js');

const modelist = ace.require('ace/ext/modelist');
const themelist = ace.require('ace/ext/themelist');

const appInfo = {
  version: appVersion,
  name: 'Monolith Code',
};

const MD_TEMPLATE_HTML = path.resolve(__dirname, 'res/embed/markdown/index.html');
let editor;

const file = {
  name: undefined,
  extension: undefined,
  path: undefined,
  lang: undefined,
};
let langInfo;
let runningProcess;
let isSaved = true;

let documentNameUi;
let languageDisplayUi;
let themeChoiceUi;
let charDisplayUi;
let consoleUi;
let consoleInUi;
let consoleOutUi;
let webviewUi;
let editorMediaDivUi;
let editorConsoleDivUi;
let textAreaUi;
let themeLink;

let commandList = {};
const commandHistory = [];
let historyIndex;

let scrollBarsCss;

const PRINT_MODE = Object.freeze({
  user: 0,
  info: 1,
  confirm: 2,
  warn: 3,
  error: 4,
});

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

const markdownUpdater = debounce(() => {
  const basepath = file.path.replaceAll('\\', '/');
  let pre = getContent();
  pre = pre.replaceAll(/src="(\..*?)"/ig, `src="${basepath}$1"`);
  const markedHtml = marked(pre, { baseUrl: basepath });

  webviewUi.send('fillContent', markedHtml);
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
    editor.on('input', markdownUpdater);
  } else {
    editor.off('input', markdownUpdater);
  }

  const lang = langInfo[langKey];
  const { mode } = modelist.modesByName[lang.mode];
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
    document.getElementsByTagName('body')[0].classList.add('fullscreen');
  } else {
    document.getElementsByTagName('body')[0].classList.remove('fullscreen');
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

function print(text, mode = PRINT_MODE.info) {
  const block = document.createElement('div');
  block.classList.add(Object.keys(PRINT_MODE).find((key) => PRINT_MODE[key] === mode));
  block.innerHTML = text;
  consoleOutUi.appendChild(block);

  consoleUi.scrollTo({ top: consoleUi.scrollHeight, behavior: 'smooth' });
}

function writeFile(filePath, content, callback = undefined) {
  fs.writeFile(filePath, content, (err) => {
    if (!err) {
      notify('confirm');
    } else {
      print(err, PRINT_MODE.error);
      notify('error');
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
        webviewUi.setAttribute('src', undefined);
      } else {
        print(`Error: Could not open file ${filepath}`, PRINT_MODE.error);
        notify('error');
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
    const window = remote.getCurrentWindow();
    dialog.showSaveDialog(window, options).then((ret) => {
      if (!ret.canceled) {
        writeFile(ret.filePath, content, (err) => {
          if (!err) {
            setFileInfo(ret.filePath);

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

function calculate(string) {
  // eslint-disable-next-line no-new-func
  return Function(`return (${string})`)();
}

function runCommand(command, args, callback = undefined) {
  if (runningProcess !== undefined) {
    const ret = runningProcess.kill('SIGINT');

    if (!ret) {
      print('Error: Could not stop the running process.', PRINT_MODE.error);
      return;
    }
  }

  notifyLoadStart();
  print(`> ${command}`, PRINT_MODE.user);

  runningProcess = childProcess.spawn(command, args, {
    encoding: 'utf8',
    shell: true,
    ...file.path && { cwd: file.path },
  });

  runningProcess.on('error', () => { });

  runningProcess.stdout.setEncoding('utf8');
  runningProcess.stdout.on('data', (data) => {
    print(data.toString());
  });

  runningProcess.stderr.setEncoding('utf8');
  runningProcess.stderr.on('data', (data) => {
    let dataString = data.toString();
    if (file.lang !== undefined && langInfo[file.lang].linere !== undefined) {
      const line = langInfo[file.lang].linere.replaceAll('<name>', file.name);
      const re = new RegExp(line, 'gi');
      dataString = dataString.replaceAll(re, '<a class="jump-to-line" href="#$2">$1</a>');
    }
    print(dataString, PRINT_MODE.error);
  });

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

    notifyLoadEnd();
    runningProcess = undefined;

    if (callback !== undefined) {
      callback(code);
    }
  });
}

function runFile() {
  if (file.lang in langInfo) {
    let cmdRun = langInfo[file.lang].run;
    if (cmdRun) {
      cmdRun = cmdRun.replaceAll('<name>', file.name);
      cmdRun = cmdRun.replaceAll('<path>', file.path);

      runCommand(cmdRun);
    } else if (file.lang === 'latex') {
      webviewUi.src = `${file.path + file.name}.pdf?v=${Date.now()}`;
    } else if (file.lang === 'markdown') {
      const basepath = file.path.replaceAll('\\', '/');

      // Pre process relative html src
      let pre = getContent();
      pre = pre.replaceAll(/src="(\..*?)"/ig, `src="${basepath}$1"`);
      const markedHtml = marked(pre, { baseUrl: basepath });

      webviewUi.addEventListener('did-finish-load', () => {
        webviewUi.send('fillContent', markedHtml);
      }, { once: true });
      webviewUi.src = MD_TEMPLATE_HTML;
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
    // }else{
    // notify("warn");
    // print("No action defined for " + language_display_ui.value);
    // }
  }
}

function assignVariables() {
  documentNameUi = document.getElementById('document-name');
  textAreaUi = document.getElementById('main-text-area');
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
}

function initialize() {
  // Initialize all ui elements
  assignVariables();

  // get config
  const config = ipcRenderer.sendSync('initial-settings');

  webFrame.setVisualZoomLevelLimits(1, 3);

  editor = ace.edit('main-text-area', {
    enableBasicAutocompletion: true,
    showPrintMargin: false,
    showLineNumbers: config.line_numbers,
    wrap: config.line_wrapping,
    scrollPastEnd: 1,
    fixedWidthGutter: true,
    fadeFoldWidgets: true,
    highlightActiveLine: false,
    useWorker: false,
    theme: config.theme,
  });

  themelist.themes.forEach((theme) => {
    const option = document.createElement('option');
    option.text = theme.caption;
    option.value = theme.theme;
    themeChoiceUi.add(option);
  });

  themeChoiceUi.value = config.theme;

  document.addEventListener('drop', (event) => {
    event.preventDefault();
    event.stopPropagation();

    Array.from(event.dataTransfer.files).forEach((f) => {
      openFile(f.path);
    });
  });

  const ro = new ResizeObserver(() => {
    editor.resize();
  });
  ro.observe(document.getElementById('editor-wrapper'));

  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  editor.on('change', () => {
    if (isSaved) {
      setSaved(false);
    } else if (getContent() === '') {
      setSaved(true);
    }
  });
  editor.on('scroll', () => {
    // console.log(event);
  });

  document.getElementById('min-button').addEventListener('click', () => {
    const window = remote.getCurrentWindow();
    window.minimize();
  });

  document.getElementById('max-button').addEventListener('click', () => {
    const window = remote.getCurrentWindow();
    if (!window.isMaximized()) {
      window.maximize();
      toggleFullscreenStyle(true);
    } else {
      window.unmaximize();
      toggleFullscreenStyle(false);
    }
  });

  document.getElementById('close-button').addEventListener('click', () => {
    const window = remote.getCurrentWindow();
    window.close();
  });

  window.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === 'o') {
      event.preventDefault();
      notifyLoadStart();

      const options = {
        title: 'Open a file',
      };
      const window = remote.getCurrentWindow();
      dialog.showOpenDialog(window, options).then((ret) => {
        if (!ret.canceled) {
          openFile(ret.filePaths[0]);
        }

        notifyLoadEnd();
      });
    } else if (event.ctrlKey && event.key === 'b') {
      event.preventDefault();

      if (file.path === undefined || !isSaved) {
        saveFile(getContent(), false, () => {
          buildRunFile();
        });
      } else {
        buildRunFile();
      }
    } else if (event.ctrlKey && !event.shiftKey && event.key === 's') { // ctrl + s
      event.preventDefault();
      saveFile(getContent());
    } else if (event.ctrlKey && event.shiftKey && event.key === 'S') { // ctrl + shift + s
      event.preventDefault();
      saveFile(getContent(), true);
    } else if (event.ctrlKey && event.key === 'n') {
      event.preventDefault();
      newWindow();
    } else if (event.ctrlKey && event.key === '.') {
      event.preventDefault();
      if ((languageDisplayUi.value in langInfo) && langInfo[languageDisplayUi.value].templ) {
        editor.setValue(langInfo[languageDisplayUi.value].templ, -1);
      } else {
        notify('warn');
        print(`No default template exists for ${languageDisplayUi.value}`);
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
        notify('error');
        print(`Unable to calculate '${func}'`, PRINT_MODE.error);
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
        print(pre, PRINT_MODE.user);
        commandList[pre].func();
      } else if (cmd.startsWith('!')) {
        print(pre, PRINT_MODE.user);
        print('Command not recognized. Try !help.', PRINT_MODE.warn);
        notify('warn');
      } else if (runningProcess !== undefined) {
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
      notify(`An error ocurred reading the file :${err.message}`);
      return;
    }
    langInfo = JSON.parse(data);

    Object.entries(langInfo).forEach((key, value) => {
      const option = document.createElement('option');
      option.text = value.name;
      option.value = key;
      languageDisplayUi.add(option);
    });

    languageDisplayUi.value = 'plaintext';
  });

  commandList = {
    '!ver': {
      desc: 'Shows the current version of the application.',
      func: () => { print(`${appInfo.name} ${appInfo.version}`); },
    },
    '!cls': {
      desc: 'Clear console.',
      func: () => { consoleOutUi.innerHTML = ''; },
    },
    '!kill': {
      desc: 'Kills the currently running process.',
      func: () => { if (runningProcess) { runningProcess.kill('SIGINT'); } },
    },
    '!hello': {
      desc: 'Hello There :D',
      func: () => { print('Hi there :D'); },
    },
    '!help': {
      desc: 'Shows all the available commands.',
      func: () => {
        let ret = '';
        for (const [key, value] of Object.entries(commandList)) {
          ret += `${key}\t${value.desc}\n`;
        }
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
    webviewUi.insertCSS(scrollBarsCss);
    webviewUi.insertCSS('body{background: transparent !important;}');
  });
  webviewUi.addEventListener('did-finish-load', () => {
    webviewUi.send('onLoad');
  });

  marked.setOptions({
    highlight: (code, lang) => {
      const validLanguage = hljs.getLanguage(lang) ? lang : 'plaintext';
      return hljs.highlight(validLanguage, code).value;
    },
  });

  editorMediaDivUi.addEventListener('divider-move', () => {
    const val = editorMediaDivUi.previousElementSibling.style.width;
    ipcRenderer.send('store-setting', 'editor_media_div_percent', val);
  });
  editorConsoleDivUi.addEventListener('divider-move', () => {
    const val = editorConsoleDivUi.previousElementSibling.style.height;
    ipcRenderer.send('store-setting', 'editor_console_div_percent', val);
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
      ipcRenderer.send('store-setting', 'editor_media_div_percent', targetPercent);
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
      ipcRenderer.send('store-setting', 'editor_console_div_percent', targetPercent);
    });
  });

  document.getElementById('editor-wrapper').style.width = config.editor_media_div_percent;
  document.getElementById('main-divider').style.height = config.editor_console_div_percent;

  ipcRenderer.on('can-close', (event) => {
    event.sender.send('can-close-response', isSaved);
  });

  print(`${appInfo.name} ${appInfo.version}`);

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
