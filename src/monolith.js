/* eslint-disable no-unused-vars */

const modelist = requireLazy(() => ace.require('ace/ext/modelist'));
const themelist = requireLazy(() => ace.require('ace/ext/themelist'));
// Only loaded the first time the document gets beautified
const beautify = requireLazy(() => new Promise((resolve) => {
  ace.config.loadModule('ace/ext/beautify', resolve);
}));

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
let keybindings;

const commandHistory = [];
let historyIndex;

// UI Components
let documentNameUi;
let languageDisplaySelectedUi;
let optionsContainer;
let themeChoiceUi;
let settingsOverlayUi;
let lineWrapUi;
let lineNumbersUi;
let consoleUi;
let consoleInUi;
let consoleOutUi;
let webviewUi;
let webviewDevUi;
let editorMediaDivUi;
let editorConsoleDivUi;
let previewDevDivUi;
let processIndicatorUi;

let consoleScrollScheduled = false;
let markdownRenderId = 0;

const errorSVG = requireLazy(async () => {
  const svgText = await fetch('res/img/err.svg').then((res) => res.text());
  const svgDoc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  return document.importNode(svgDoc.documentElement, true);
});
const DANGEROUS_MARKDOWN_SELECTORS = [
  'base',
  'button',
  'embed',
  'form',
  'iframe',
  'input',
  'link',
  'meta',
  'object',
  'option',
  'script',
  'select',
  'textarea',
].join(',');

// Constants
const MAX_CONSOLE_ENTRIES = 5000;
const DIVIDER_ANIMATION = Object.freeze({
  duration: 450,
  easing: 'cubic-bezier(0.860, 0.000, 0.070, 1.000)',
});
const INFO_LEVEL = Object.freeze({
  user: 0,
  info: 1,
  confirm: 2,
  warn: 3,
  error: 4,
});
const MATH_CONSTANTS = Object.freeze({
  e: Math.E,
  pi: Math.PI,
});
const MATH_FUNCTIONS = Object.freeze({
  abs: Math.abs,
  acos: Math.acos,
  asin: Math.asin,
  atan: Math.atan,
  atan2: Math.atan2,
  cbrt: Math.cbrt,
  ceil: Math.ceil,
  cos: Math.cos,
  exp: Math.exp,
  floor: Math.floor,
  ln: Math.log,
  log: Math.log,
  log10: Math.log10,
  max: Math.max,
  min: Math.min,
  pow: Math.pow,
  round: Math.round,
  sin: Math.sin,
  sqrt: Math.sqrt,
  tan: Math.tan,
});

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function parseFilePath(filePath) {
  const separators = appInfo.os === 'win32' ? ['/', '\\'] : ['/'];
  const sepIndex = Math.max(...separators.map((sep) => filePath.lastIndexOf(sep)));
  const base = filePath.slice(sepIndex + 1);
  const dotIndex = base.lastIndexOf('.');
  const extension = dotIndex > 0 ? base.slice(dotIndex) : '';

  return {
    dir: filePath.slice(0, sepIndex + 1),
    name: base.slice(0, base.length - extension.length),
    extension,
  };
}

function sanitizeHtmlDocument(html) {
  const parser = new DOMParser();
  const htmlDoc = parser.parseFromString(html, 'text/html');

  htmlDoc.querySelectorAll(DANGEROUS_MARKDOWN_SELECTORS).forEach((el) => el.remove());
  htmlDoc.body.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();

      if (name.startsWith('on') || name === 'srcdoc') {
        el.removeAttribute(attr.name);
        return;
      }

      if ((name === 'href' || name === 'src') && /^(javascript|vbscript|data:text\/html):/i.test(value)) {
        el.removeAttribute(attr.name);
      }
    });
  });

  return htmlDoc;
}

function createMathParser(input) {
  let index = 0;

  function skipSpaces() {
    while (input[index] === ' ') index += 1;
  }

  function match(char) {
    skipSpaces();
    if (input[index] !== char) return false;
    index += 1;
    return true;
  }

  function readNumber() {
    skipSpaces();
    const matchResult = input.slice(index).match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);
    if (!matchResult) return null;
    index += matchResult[0].length;
    return Number(matchResult[0]);
  }

  function readIdentifier() {
    skipSpaces();
    const matchResult = input.slice(index).match(/^[a-z][a-z0-9_]*/i);
    if (!matchResult) return null;
    index += matchResult[0].length;
    return matchResult[0].toLowerCase();
  }

  function parseExpression() {
    let value = parseTerm();
    while (true) {
      if (match('+')) {
        value += parseTerm();
      } else if (match('-')) {
        value -= parseTerm();
      } else {
        return value;
      }
    }
  }

  function parseTerm() {
    let value = parsePower();
    while (true) {
      if (match('*')) {
        value *= parsePower();
      } else if (match('/')) {
        value /= parsePower();
      } else if (match('%')) {
        value %= parsePower();
      } else {
        return value;
      }
    }
  }

  function parsePower() {
    const value = parseUnary();
    if (match('^')) {
      return value ** parsePower();
    }
    return value;
  }

  function parseUnary() {
    if (match('+')) return parseUnary();
    if (match('-')) return -parseUnary();
    return parsePrimary();
  }

  function parseCall(name) {
    const args = [];
    if (!match(')')) {
      do {
        args.push(parseExpression());
      } while (match(','));
      if (!match(')')) throw new Error('Expected closing parenthesis.');
    }

    const fn = MATH_FUNCTIONS[name];
    if (!fn) throw new Error(`Unknown function "${name}".`);
    return fn(...args);
  }

  function parsePrimary() {
    const number = readNumber();
    if (number !== null) return number;

    if (match('(')) {
      const value = parseExpression();
      if (!match(')')) throw new Error('Expected closing parenthesis.');
      return value;
    }

    const identifier = readIdentifier();
    if (identifier) {
      if (match('(')) return parseCall(identifier);
      if (Object.hasOwn(MATH_CONSTANTS, identifier)) return MATH_CONSTANTS[identifier];
      throw new Error(`Unknown symbol "${identifier}".`);
    }

    throw new Error('Expected a number, constant, function, or parenthesis.');
  }

  return {
    parse() {
      const value = parseExpression();
      skipSpaces();
      if (index !== input.length) throw new Error(`Unexpected token "${input[index]}".`);
      if (!Number.isFinite(value)) throw new Error('Result is not a finite number.');
      return value;
    },
  };
}

function evaluateMathExpression(input) {
  const normalizedInput = input.replace(/\s+/g, ' ').trim();
  if (!normalizedInput) throw new Error('Expression is empty.');
  return createMathParser(normalizedInput).parse();
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
        killProcess().then(() => print('Process Killed', INFO_LEVEL.info));
      } else {
        print('No running process to kill.', INFO_LEVEL.warn);
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
    func: () => { exportPDFFromPreview(); },
  },
  '!help': {
    desc: 'Shows all the available commands',
    func: () => {
      let ret = '';
      const longest = Object.keys(commandList).reduce((prev, curr) => (curr.length > prev ? curr.length : prev), 0) + 6;
      Object.entries(commandList).forEach(([key, value]) => {
        ret += `${key}${' '.repeat(longest - key.length)}${value.desc}\n`;
      });

      ret += '------------------------------------------------------------------------\n';
      const modName = appInfo.os === 'darwin' ? 'cmd' : 'ctrl';
      Object.entries(keybindings.ctrl).forEach(([key, value]) => {
        ret += `${modName} + ${key}            ${value.description}\n`;
      });
      Object.entries(keybindings.ctrlshift).forEach(([key, value]) => {
        ret += `${modName} + shift + ${key}    ${value.description}\n`;
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
  if (langKey !== 'markdown') {
    editor.off('input', markdownUpdater);
  }

  const lang = langInfo[langKey];
  const { mode } = modelist.get().modesByName[lang.mode];
  editor.session.setMode(mode);

  languageDisplaySelectedUi.innerText = lang.name;
  languageDisplaySelectedUi.dataset.value = langKey;
  [...optionsContainer.querySelectorAll('.option')].forEach((el) => {
    const isActive = el.dataset.value === langKey;
    el.classList.toggle('active', isActive);
    el.setAttribute('aria-selected', String(isActive));
  });
  languageDisplaySelectedUi.setAttribute('aria-activedescendant', `language-option-${langKey}`);
}

function setContent(content) {
  editor.setValue(content, -1);
}

function newWindow(filePaths = []) {
  const filePathsArray = Array.isArray(filePaths) ? filePaths : [filePaths];
  window.api.newWindow(filePathsArray);
}

async function openFile(filePaths = []) {
  let filePathsArray = Array.isArray(filePaths) ? filePaths : [filePaths];

  if (!filePathsArray.length) {
    const { canceled, filePaths: selectedPaths } = await window.api.showOpenDialog();
    if (canceled) return;
    filePathsArray = selectedPaths;
  }

  if (!file.path && (isSaved === null || isSaved)) {
    const fileToOpen = filePathsArray.shift();
    notifyLoadStart();
    try {
      const data = await window.api.readFile(fileToOpen);
      editor.setValue(data, -1);
      _setFileInfo(fileToOpen);
      print(`Opened file ${fileToOpen}`);
    } catch (err) {
      print(`Could not open file ${fileToOpen}\n${err.message}`, INFO_LEVEL.error);
    } finally {
      notifyLoadEnd();
    }
  }

  if (filePathsArray.length) {
    newWindow(filePathsArray);
  }
}

async function saveFileAs() {
  return saveFile(true);
}

/**
 * @returns {Promise<boolean>} true if the document was written to disk
 */
async function saveFile(saveAs = false) {
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

    const { canceled, filePath: selectedPath } = await window.api.showSaveDialog(options);
    if (canceled || !selectedPath) return false;
    filePath = selectedPath;
  }

  notifyLoadStart();
  try {
    await window.api.writeFile(filePath, getContent());
  } catch (err) {
    print(`Could not save file ${filePath}\n${err.message}`, INFO_LEVEL.error);
    return false;
  } finally {
    notifyLoadEnd();
  }

  if (file.path === undefined || saveAs) {
    print(`file saved as ${filePath}`);
  }
  _setFileInfo(filePath);
  notify('confirm');
  return true;
}

/* ------------- UI ------------- */

function setTheme(name) {
  editor.setTheme(name);
  themeChoiceUi.value = name;
  window.api.storeSetting('theme', name);
}

function setFontSize(size) {
  editor.setFontSize(size);
  window.api.storeSetting('font_size', size);
}

function setLineWrapping(enabled) {
  editor.setOption('wrap', enabled);
  lineWrapUi.checked = enabled;
  window.api.storeSetting('line_wrapping', enabled);
}

function setLineNumbers(enabled) {
  editor.setOptions({ showLineNumbers: enabled, showGutter: enabled });
  lineNumbersUi.checked = enabled;
  window.api.storeSetting('line_numbers', enabled);
}

function toggleSettingsPanel(open = !settingsOverlayUi.classList.contains('open')) {
  settingsOverlayUi.classList.toggle('open', open);
  if (open) {
    themeChoiceUi.focus();
  } else {
    editor.focus();
  }
}

function notify(type) {
  let statusDisplay = document.getElementById('status-display');
  statusDisplay.className = '';
  statusDisplay.offsetWidth; // This is needed to reset the animation
  statusDisplay.classList.add(type);
}

function notifyLoadStart() {
  document.getElementById('status-bar').classList.add('load');
}

function notifyLoadEnd() {
  document.getElementById('status-bar').className = '';
}

function setLanguageDropdownOpen(isOpen) {
  optionsContainer.classList.toggle('active', isOpen);
  languageDisplaySelectedUi.setAttribute('aria-expanded', String(isOpen));

  if (isOpen) {
    optionsContainer.querySelector('.option.active')?.scrollIntoView({ block: 'nearest' });
  }
}

function selectLanguageOption(option) {
  if (!option) return;

  setLanguage(option.dataset.value);
  option.scrollIntoView({ block: 'nearest' });
}

function handleLanguageSelectorKeydown(event) {
  const isOpen = optionsContainer.classList.contains('active');

  if (!isOpen) {
    if (event.target === languageDisplaySelectedUi && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      setLanguageDropdownOpen(true);
    }
    return;
  }

  if (event.key === 'Tab') {
    setLanguageDropdownOpen(false);
    return;
  }

  if (event.target !== languageDisplaySelectedUi) {
    setLanguageDropdownOpen(false);
    return;
  }

  const options = [...optionsContainer.querySelectorAll('.option')];
  const activeIndex = options.findIndex((option) => option.classList.contains('active'));
  let nextOption;

  if (event.key === 'Escape' || event.key === 'Enter') {
    event.preventDefault();
    event.stopPropagation();
    setLanguageDropdownOpen(false);
    languageDisplaySelectedUi.focus();
    return;
  }

  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    const nextIndex = activeIndex === -1
      ? (direction === 1 ? 0 : options.length - 1)
      : (activeIndex + direction + options.length) % options.length;
    nextOption = options[nextIndex];
  } else if (!event.ctrlKey && !event.metaKey && !event.altKey && /^[a-z0-9]$/i.test(event.key)) {
    const matchingOptions = options.filter((option) => option.innerText.trim().toLowerCase().startsWith(event.key.toLowerCase()));
    const matchingIndex = matchingOptions.findIndex((option) => option.classList.contains('active'));
    nextOption = matchingOptions[(matchingIndex + 1) % matchingOptions.length];
  }

  if (nextOption) {
    event.preventDefault();
    event.stopPropagation();
    selectLanguageOption(nextOption);
  }
}

function scheduleConsoleScroll() {
  if (consoleScrollScheduled) return;

  consoleScrollScheduled = true;
  requestAnimationFrame(() => {
    consoleScrollScheduled = false;
    consoleUi.scrollTo({ top: consoleUi.scrollHeight, behavior: 'smooth' });
  });
}

/**
 * @param {string|Node} content Text is always inserted as plain text; pass a Node for rich output
 */
function print(content, mode = INFO_LEVEL.info) {
  const levelName = Object.keys(INFO_LEVEL).find((key) => INFO_LEVEL[key] === mode) || 'info';
  const block = document.createElement('div');
  block.classList.add(levelName);
  block.appendChild(typeof content === 'string' ? document.createTextNode(content) : content);

  if (mode === INFO_LEVEL.error) {
    errorSVG.get().then((icon) => block.prepend(icon.cloneNode(true)));
  }

  consoleOutUi.appendChild(block);
  while (consoleOutUi.childElementCount > MAX_CONSOLE_ENTRIES) {
    consoleOutUi.firstElementChild.remove();
  }

  if (mode >= INFO_LEVEL.confirm) {
    notify(levelName);
  }

  scheduleConsoleScroll();
}

function linkifyErrorLines(text, lineRegex) {
  const fragment = document.createDocumentFragment();
  let lastIndex = 0;

  for (const match of text.matchAll(lineRegex)) {
    fragment.append(text.slice(lastIndex, match.index));

    const link = document.createElement('a');
    link.className = 'jump-to-line';
    link.href = `#${match[2]}`;
    link.textContent = match[1];
    fragment.append(link);

    lastIndex = match.index + match[0].length;
  }

  fragment.append(text.slice(lastIndex));
  return fragment;
}

/* ------------- FEATURES ------------- */

async function beautifyDocument() {
  const module = await beautify.get();
  module.beautify(editor.session);
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
  let expression = editor.getSelectedText();
  if (range.start.row === range.end.row && range.start.column === range.end.column) {
    expression = editor.session.getLine(range.start.row);
  }

  try {
    const result = evaluateMathExpression(expression);
    editor.session.insert(editor.selection.getRange().end, ` = ${result}`);
    notify('confirm');
  } catch (error) {
    print(`Unable to calculate "${expression}": ${error.message}`, INFO_LEVEL.error);
  }
}

async function exportPDFFromPreview() {
  if (!file.path) {
    print('Filepath not set for export', INFO_LEVEL.warn);
    return;
  }
  if (webviewUi.src === '' || webviewUi.src === 'about:blank') {
    print('Document not suitable for PDF export.', INFO_LEVEL.warn);
    return;
  }

  const pdfPath = `${file.path}${file.name}.pdf`;

  try {
    const data = await webviewUi.printToPDF({ landscape: false, pageSize: 'A4' });
    await window.api.writeFile(pdfPath, data);
    print(`PDF successfully stored to ${pdfPath}`, INFO_LEVEL.confirm);
  } catch (err) {
    print(`Failed to write PDF to ${pdfPath}:\n${err.message}`, INFO_LEVEL.error);
  }
}

function openSettings() {
  newWindow(userPrefPath);
}

function openLanguageSettings() {
  newWindow(langPrefPath);
}

async function killProcess() {
  if (runningProcess != null) {
    await runningProcess.dispatch('kill');
  }
}

/* ------------- PRIVATE HELPERS ------------- */

function _debounce(func, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

const markdownUpdater = _debounce(async () => {
  // Rendering is async, so drop results that were overtaken by a newer render
  markdownRenderId += 1;
  const renderId = markdownRenderId;
  try {
    const markedHtml = await mdToHTML();
    if (renderId === markdownRenderId) {
      webviewUi.send('fill_content', markedHtml);
    }
  } catch (err) {
    print(`Could not render markdown: ${err.message}`, INFO_LEVEL.error);
  }
}, 200);

function toggleDevTool() {
  const targetId = webviewUi.getWebContentsId();
  const devtoolsId = webviewDevUi.getWebContentsId();
  window.api.openDevTool(targetId, devtoolsId);
  togglePreviewDevToolDivider();
}

async function mdToHTML() {
  const basepath = file.path.replaceAll('\\', '/');
  let pre = getContent();
  pre = pre.replaceAll(/src="\.\/(.*?)"/ig, `src="${basepath}$1"`);
  let markedHtml = await window.api.markedParse(pre);
  const htmlDoc = sanitizeHtmlDocument(markedHtml);
  const sections = [...htmlDoc.querySelectorAll('h1[id], h2[id], h3[id], h4[id], h5[id], h6[id]')];

  let toc = sections
    .map((el) => `<li><a href="#${escapeAttribute(el.id)}">${escapeHtml(el.nodeName)} - ${escapeHtml(el.innerText)}</a></li>`)
    .join('');
  toc = `<ul>${toc}</ul>`;

  markedHtml = htmlDoc.body.innerHTML;
  markedHtml = markedHtml.replace(/\[TOC\]/, toc);

  return markedHtml;
}

function commandRunner(command, args, callback) {
  notifyLoadStart();
  print(`> ${command}`, INFO_LEVEL.user);

  const proc = window.api.spawnProcess(command, args, file.path);
  runningProcess = proc;

  proc.registerHandler('error', (message) => {
    print(message, INFO_LEVEL.error);
  });

  proc.registerHandler('stdout', (data) => {
    print(data);
  });

  proc.registerHandler('stderr', (data) => {
    const lineRe = file.lang !== undefined && langInfo[file.lang].linere;
    if (lineRe) {
      const re = new RegExp(lineRe.replaceAll('<name>', file.name), 'gi');
      print(linkifyErrorLines(data, re), INFO_LEVEL.error);
    } else {
      print(data, INFO_LEVEL.error);
    }
  });
  processIndicatorUi.classList.add('active');

  proc.registerHandler('close', (code) => {
    notify(code === 0 ? 'confirm' : 'error');

    // A killed process can report closing after its replacement already started
    if (runningProcess === proc) {
      processIndicatorUi.classList.remove('active');
      notifyLoadEnd();
      runningProcess = null;
    }

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
      webviewUi.className = '';

      webviewUi.src = `${file.path + file.name}.pdf?v=${Date.now()}`;
    } else if (file.lang === 'markdown') {
      webviewUi.className = '';

      let markedHtml;
      try {
        markedHtml = await mdToHTML();
      } catch (err) {
        print(`Could not render markdown: ${err.message}`, INFO_LEVEL.error);
        return;
      }

      webviewUi.addEventListener('did-finish-load', () => {
        webviewUi.send('fill_content', markedHtml);
        editor.on('input', markdownUpdater);
      }, { once: true });

      webviewUi.src = './res/embed/markdown/index.html';
    } else if (file.lang === 'html') {
      webviewUi.className = '';
      webviewUi.classList.add('html-style');

      webviewUi.src = (`${file.path + file.name}.html`);
    } else {
      webviewUi.className = '';
      webviewUi.src = 'about:blank';
    }
  }
}

async function buildRunFile() {
  if ((file.path === undefined || !isSaved) && !(await saveFile())) {
    return;
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
    webviewUi.src = file.path + file.name + file.extension;
  }
}

/**
 * Animates the element in front of a divider between two sizes.
 * @param {HTMLElement} divider
 * @param {'width'|'height'} dimension
 * @param {string} openSize Size when the panel behind the divider is open
 * @param {string} closedSize Size when the panel behind the divider is closed
 * @param {boolean} [open] Force a state instead of toggling
 * @returns {Promise<string>} The size the element ended up with
 */
async function toggleDivider(divider, dimension, openSize, closedSize, open = undefined) {
  const target = divider.previousElementSibling;
  const isOpen = Math.abs(parseFloat(target.style[dimension]) - parseFloat(openSize)) < 1;
  const targetSize = (open === undefined ? !isOpen : open) ? openSize : closedSize;

  await target.animate([
    { [dimension]: target.style[dimension] },
    { [dimension]: targetSize },
  ], DIVIDER_ANIMATION).finished;

  target.style[dimension] = targetSize;
  return targetSize;
}

async function togglePreviewDivider(open = undefined) {
  const size = await toggleDivider(editorMediaDivUi, 'width', '50%', '100%', open);
  window.api.storeSetting('media_div_percent', size);
}

async function toggleConsoleDivider(open = undefined) {
  const size = await toggleDivider(editorConsoleDivUi, 'height', '60%', '100%', open);
  window.api.storeSetting('console_div_percent', size);
}

function togglePreviewDevToolDivider(open = undefined) {
  return toggleDivider(previewDevDivUi, 'height', '60%', '99%', open);
}

function _updateTitle() {
  let title = file.path !== undefined ? file.name + file.extension : 'new document';

  if (!(isSaved === null || isSaved)) {
    title = `${title}*`;
  }

  if (documentNameUi.textContent === title) return;

  documentNameUi.textContent = title;
  window.api.setTitle(title);
}

function _setFileInfo(filePath) {
  const { dir, name, extension } = parseFilePath(filePath);
  file.path = dir;
  file.name = name;
  file.extension = extension;

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

function _assignUIVariables() {
  documentNameUi = document.getElementById('document-name');
  languageDisplaySelectedUi = document.querySelector('#language-display .selected');
  optionsContainer = document.getElementsByClassName('options-container')[0];
  themeChoiceUi = document.getElementById('theme-choice');
  settingsOverlayUi = document.getElementById('settings-overlay');
  lineWrapUi = document.getElementById('settings-line-wrap');
  lineNumbersUi = document.getElementById('settings-line-numbers');
  consoleUi = document.getElementById('console');
  consoleInUi = document.getElementById('console-in');
  consoleOutUi = document.getElementById('console-out');
  webviewUi = document.getElementById('embed-content');
  webviewDevUi = document.getElementById('embed-content-dev-view');
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
    keyboardHandler: editorConfig.key_bindings === 'ace/keyboard/ace' ? undefined : editorConfig.key_bindings,
    fontSize: editorConfig.font_size,
  });

  document.addEventListener('drop', (event) => {
    event.preventDefault();
    event.stopPropagation();

    const filePaths = Array.from(event.dataTransfer.files)
      .map((f) => window.api.getPathForFile(f))
      .filter(Boolean);
    if (filePaths.length) {
      openFile(filePaths);
    }
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
    const isMac = appInfo.os === 'darwin';
    const isModifier = isMac ? e.metaKey : e.ctrlKey;
    if (isModifier) {
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
    window.api.togglePin().then((pinned) => {
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

  window.api.canClose((_) => {
    window.api.canCloseResponse(isSaved === null || isSaved);
  });

  window.api.print((_, value) => {
    print(value.text);
  });

  // Load Keybindings
  try {
    const response = await fetch('res/keybindings.json');
    const data = await response.text();
    keybindings = JSON.parse(data);
  } catch (err) {
    print(`An error occurred reading the keybindings: ${err.message}`, INFO_LEVEL.error);
    return;
  }

  window.addEventListener('keydown', (event) => {
    const isMac = appInfo.os === 'darwin';
    const isModifier = isMac ? event.metaKey : event.ctrlKey;
    if (!isModifier) return;

    const bindings = event.shiftKey ? keybindings.ctrlshift : keybindings.ctrl;
    const binding = bindings[event.key.toLowerCase()];
    if (!binding) return;

    event.preventDefault();
    const action = window[binding.func];
    if (typeof action === 'function') {
      action();
    } else {
      print(`Keybinding "${event.key}" points to unknown action "${binding.func}"`, INFO_LEVEL.warn);
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
        runningProcess.dispatch('stdin', `${cmd}\n`);
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

  _initializeOptions(editorConfig);
  themeChoiceUi.addEventListener('change', () => {
    setTheme(themeChoiceUi.value);
  });
  lineWrapUi.checked = editorConfig.line_wrapping;
  lineWrapUi.addEventListener('change', () => setLineWrapping(lineWrapUi.checked));
  lineNumbersUi.checked = editorConfig.line_numbers;
  lineNumbersUi.addEventListener('change', () => setLineNumbers(lineNumbersUi.checked));
  settingsOverlayUi.addEventListener('click', (event) => {
    if (event.target === settingsOverlayUi) toggleSettingsPanel(false);
  });
  settingsOverlayUi.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') toggleSettingsPanel(false);
  });

  languageDisplaySelectedUi.addEventListener('click', (event) => {
    setLanguageDropdownOpen(!optionsContainer.classList.contains('active'));
    event.stopPropagation();
  });
  document.addEventListener('click', (event) => {
    if (languageDisplaySelectedUi.contains(event.target) || optionsContainer.contains(event.target)) return;
    setLanguageDropdownOpen(false);
  });
  document.addEventListener('keydown', handleLanguageSelectorKeydown, true);

  // Load Languages
  try {
    const response = await fetch('res/lang.json');
    const data = await response.text();
    langInfo = JSON.parse(data);
    mergeDeep(langInfo, settings.languageConfig);

    Object.entries(langInfo).forEach((el) => {
      const option = document.createElement('div');
      option.classList.add('option');
      const [name, obj] = el;
      option.innerText = obj.name;
      option.dataset.value = name;
      option.id = `language-option-${name}`;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', 'false');
      optionsContainer.appendChild(option);
      option.addEventListener('click', () => {
        setLanguageDropdownOpen(false);
        setLanguage(option.dataset.value);
      });
    });
  } catch (err) {
    print(`An error occurred reading the languages: ${err.message}`, INFO_LEVEL.error);
    return;
  }

  webviewUi.addEventListener('console-message', (e) => {
    // Ignore Electron's own messages (e.g. dev-mode security warnings)
    if (e.sourceId.includes('electron/js2c/')) return;

    let mode;
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
    print(`Message from ${source}:${e.line}\n${e.message}`, mode);
  });

  editorMediaDivUi.addEventListener('divider-move', () => {
    const val = editorMediaDivUi.previousElementSibling.style.width;
    window.api.storeSetting('media_div_percent', val);
  });
  editorConsoleDivUi.addEventListener('divider-move', () => {
    const val = editorConsoleDivUi.previousElementSibling.style.height;
    window.api.storeSetting('console_div_percent', val);
  });

  editorMediaDivUi.addEventListener('dblclick', () => {
    togglePreviewDivider();
  });
  editorConsoleDivUi.addEventListener('dblclick', () => {
    toggleConsoleDivider();
  });

  previewDevDivUi.addEventListener('dblclick', () => {
    togglePreviewDevToolDivider();
  });

  document.getElementById('editor-wrapper').style.width = editorConfig.media_div_percent;
  document.getElementById('main-divider').style.height = editorConfig.console_div_percent;
  document.getElementById('embed-content').style.height = '100%';

  print(`${appInfo.name} ${appInfo.version}`);

  if (settings.filePathsToOpen.length) {
    openFile(settings.filePathsToOpen);
  } else {
    setLanguage('plaintext');
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
