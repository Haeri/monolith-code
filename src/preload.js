const { contextBridge, ipcRenderer, webFrame } = require("electron");

let lazyRequires = {
    dialog: null,
    fsp: null
};

function fsp() {
    if (lazyRequires.fsp === null) {
        lazyRequires.fsp = require('fs').promises;
    }
    return lazyRequires.fsp;
}

let _childProcess = null;
let _marked = null;
let _hljs = null;
let _beautify = null;
let _tKill = null;


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
        function renderMathsExpression(expr) {
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
                return html
            } else {
                return null
            }
        }


        _marked.setOptions({
            renderer: renderer,
            highlight: (code, lang) => {
                const validLanguage = _hljs.getLanguage(lang) ? lang : 'plaintext';
                return _hljs.highlight(code, { language: validLanguage }).value;
            },
        });
    }

    return _marked;
}
function requireChildProcess() {
    if (_childProcess === null) {
        _childProcess = require('child_process');
    }
    return _childProcess;
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

webFrame.setVisualZoomLevelLimits(1, 3);

const API = {
    path: require('path'),

    // Getter
    getInitialSettings: () => ipcRenderer.invoke("initial-settings"),

    // Window API
    minimize: () => ipcRenderer.send("minimize"),
    maximize: () => ipcRenderer.send("maximize"),
    unmaximize: () => ipcRenderer.send("unmaximize"),
    toggleMaxUnmax: () => ipcRenderer.send("toggle-max-unmax"),
    close: () => ipcRenderer.send("close"),
    togglePin: () => ipcRenderer.invoke("toggle-pin"),
    newWindow: (filePaths) => ipcRenderer.send("new-window", filePaths),

    showOpenDialog: () => ipcRenderer.invoke("show-open-dialog"),
    showSaveDialog: (options) => ipcRenderer.invoke("show-save-dialog", options),

    storeSetting: (key, value) => ipcRenderer.send('store-setting', key, value),

    readFile: (filePath) => fsp().readFile(filePath, { encoding: 'utf-8' }),
    writeFile: (filePath, content) => fsp().writeFile(filePath, content),

    // Handler
    updateMaxUnmax: (callback) => ipcRenderer.on('update-max-unmax', callback),
    canClose: (callback) => ipcRenderer.on('can-close', callback),
    print: (callback) => ipcRenderer.on('print', callback),

};

contextBridge.exposeInMainWorld("api", API);