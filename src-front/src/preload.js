//const { contextBridge, ipcRenderer, webFrame } = require("electron");
//const { requireLazy, StandaloneEvent } = require('./common');

/*
let path = requireLazy(() => require('path'));
let fsp = requireLazy(() => require('fs').promises);
let treeKill = requireLazy(() => require('tree-kill'));
let childProcess = requireLazy(() => require('child_process'));

let marked = null;

function requireMarked() {
    if (marked === null) {
        marked = require('marked');
        const hljs = require('highlight.js');
        const katex = require('katex');

        const renderer = new marked.Renderer();
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
                    html = katex.renderToString(expr)
                } catch (e) {
                    console.error(e)
                }
                return html
            } else {
                return null
            }
        }


        marked.setOptions({
            renderer: renderer,
            highlight: (code, lang) => {
                const validLanguage = hljs.getLanguage(lang) ? lang : 'plaintext';
                return hljs.highlight(code, { language: validLanguage }).value;
            },
        });
    }

    return marked;
}


function spawnProcess(command, args, cwd) {
    let event = new StandaloneEvent();

    let runningProcess = childProcess.get().spawn(command, args, {
        encoding: 'utf8',
        shell: true,
        cwd
    });

    runningProcess.on('error', (err) => {
        event.dispatch("error", err);
    });

    runningProcess.stdout.setEncoding('utf8');
    runningProcess.stdout.on('data', (data) => {
        event.dispatch("stdout", data.toString());
    });

    runningProcess.stderr.setEncoding('utf8');
    runningProcess.stderr.on('data', (data) => {
        event.dispatch("stderr", data.toString());
    });

    runningProcess.on('close', (code) => {
        event.dispatch("close", code);
    });

    event.registerHandler("stdin", (data) => {
        runningProcess.stdin.write(data);
    });

    event.registerHandler("kill", () => {
        return new Promise(resolve => treeKill.get()(runningProcess.pid, 'SIGKILL', resolve))
    });

    return event;
}


*/

//webFrame.setVisualZoomLevelLimits(1, 3);








async function getInitialSettings() {
    let version = await window.__TAURI__.app.getVersion();
    let os =  await window.__TAURI__.os.platform();
    let appInfo = {
        name: 'monolith code',
        version,
        os
    };
    
    const localStore = {
        configName: 'local-settings',
        defaults: {
            window_config: {
                x: undefined,
                y: undefined,
                width: 800,
                height: 600,
                maximized: false,
            }
        },
    };
    const userPrefStore = {
        configName: 'user-preferences',
        defaults: {
            window_config: {
                native_frame: false,
            },
            editor_config: {
                theme: 'ace/theme/monokai',
                media_div_percent: '100%',
                console_div_percent: '100%',
                font_size: 10,
                line_wrapping: true,
                line_numbers: true,
            },
            app_config: {
                auto_update: true,
            }
        },
    };
    const langStore = {
        configName: 'lang-settings',
        defaults: {
            language_config: {}
        },
    };

    const editorConfig = userPrefStore.defaults.editor_config;
    const windowConfig = userPrefStore.defaults.window_config;
    const localWindowConfig = localStore.defaults;
    const languageConfig = langStore.defaults;
    
    return {
        appInfo,
        filePathsToOpen: "",
        editorConfig, 
        windowConfig,
        localWindowConfig, 
        languageConfig,
        userPrefPath: "", 
        languageConfigPath: ""
    };
}


let alwaysOnTop = false;

function setupTryClose(callback){
    window.__TAURI__.window.appWindow.listen('tauri://close-requested', () => {
        callback();
    });
}

const API = {

    // Getter
    getInitialSettings: () => getInitialSettings(),

    // Window API
    minimize: () => window.__TAURI__.window.appWindow.minimize(),
    maximize: () => window.__TAURI__.window.appWindow.maximize(),
    unmaximize: () => window.__TAURI__.window.appWindow.unmaximize(),
    toggleMaxUnmax: () => window.__TAURI__.window.appWindow.toggleMaximize(),
    close: () => window.__TAURI__.window.appWindow.close(),
    togglePin: () => { alwaysOnTop = !alwaysOnTop; window.__TAURI__.window.appWindow.setAlwaysOnTop(alwaysOnTop); },
    newWindow: (filePaths) => null,//ipcRenderer.send("new-window", filePaths),

    // Features API
    showOpenDialog: async () => {
        let ret = await window.__TAURI__.dialog.open({ title: 'Open a file', multiple: true });
        return { canceled: ret === null, filePaths: ret }
    },
    showSaveDialog: async (options) => {
        let ret = await window.__TAURI__.dialog.save(options);
        return { canceled: ret === null, filePath: ret }
    },
    showAskForSaveDialog: async () => {
        let ret = await window.__TAURI__.dialog.ask("The file contents have not been saved. Would you like to save now?","Unsaved Content");
        return { canceled: ret === null, yes: ret };
    },

    storeSetting: (key, value) => null, //ipcRenderer.send('store-setting', key, value),

    readFile: (filePath) => window.__TAURI__.fs.readTextFile(filePath),
    writeFile: (filePath, content) => window.__TAURI__.fs.writeFile({ contents: content, path: filePath }),

    path: window.__TAURI__.path,
    spawnProcess: (command, args, cwd) => null, //spawnProcess(command, args, cwd),
    markedParse: (...args) => null, //requireMarked().parse(...args),
    openDevTool: (targetId, devtoolsId) => null, //ipcRenderer.send('open-devtools', targetId, devtoolsId),


    // Handler
    updateMaxUnmax: (callback) => null, //ipcRenderer.on('update-max-unmax', callback),
    tryClose: (callback) => setupTryClose(callback), //ipcRenderer.on('can-close', callback),
    print: (callback) => null, //ipcRenderer.on('print', callback),

};

window.api = API;
