const { contextBridge, ipcRenderer, webFrame } = require("electron");


let _appInfo = null;
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

webFrame.setVisualZoomLevelLimits(1, 3);

const API = {
    // Getter
    getInitialSettings: () => ipcRenderer.invoke("initial-settings"),

    // Public API
    minimize: () => ipcRenderer.send("minimize"),
    maximize: () => ipcRenderer.send("maximize"),
    unmaximize: () => ipcRenderer.send("unmaximize"),
    toggleMaxUnmax: () => ipcRenderer.send("toggle-max-unmax"),
    close: () => ipcRenderer.send("close"),
    togglePin: () => ipcRenderer.invoke("toggle-pin"),
    openFile: (filePath) =>  ipcRenderer.invoke("open-file", filePath),
    saveFile: () =>  ipcRenderer.invoke("save-file"),

    // Handler
    updateMaxUnmax: (callback) => ipcRenderer.on('update-max-unmax', callback),
    canClose: (callback) => ipcRenderer.on('can-close', callback),
    print: (callback) => ipcRenderer.on('print', callback),
  
};

contextBridge.exposeInMainWorld("api", API);