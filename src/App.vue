<script setup>
import Header from "./components/Header.vue";
import Editor from "./components/Editor.vue";
import Console from "./components/Console.vue";
import Footer from "./components/Footer.vue";
import Statusbar from "./components/Statusbar.vue";
import Divider from "./components/Divider.vue";

import keybindings from "./assets/keybindings.json";
import langInfo from "./assets/lang.json";

import { store } from "./store";
import { ref } from "@vue/reactivity";
import { onBeforeMount, onMounted, watch, watchEffect } from "@vue/runtime-core";
import { mergeDeep } from "./utils";


const editorRef = ref(null);
const statusbarRef = ref(null);
const consoleRef = ref(null);

const settings = ref(null);


/* ------------- PUBLIC API ------------- */

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
    //editor.off('input', markdownUpdater);
  }

  store.lang.selectedLang = langKey;
}

function getContent() {
  return editorRef.value.getContent();
}
function setContent(text) {
  editorRef.value.setContent(text);
}

async function openFile(filePaths = []) {
  statusbarRef.value.notifyLoadStart();

  let filePathsArray = Array.isArray(filePaths) ? filePaths : [filePaths];
  if (!filePathsArray.length) {
    const { canceled, filePaths: _filePaths } = await window.api.showOpenDialog();
    if (canceled) {
      statusbarRef.value.notifyLoadEnd();
      return;
    }
    filePathsArray = _filePaths;
  }

  if (!store.file.path && (store.isSaved === null || store.isSaved)) {
    const fileToOpen = filePathsArray.shift();
    window.api.readFile(fileToOpen)
      .then((data) => {
        setContent(data);
        _setFileInfo(fileToOpen);
        consoleRef.value.print(`Opened file ${fileToOpen}`);
        // webviewUi.src = 'about:blank'
      })
      .catch((err) => {
        consoleRef.value.print(`Could not open file ${fileToOpen}<br>${err}`, INFO_LEVEL.error);
        console.log(err)
      }).finally(() => {
        statusbarRef.value.notifyLoadEnd();
      });
  }

  if (filePathsArray.length) {
    newWindow(filePathsArray);
  }
  statusbarRef.value.notifyLoadEnd();
}

async function saveFileAs() {
  return saveFile(true);
}

async function saveFile(saveAs = false) {
  statusbarRef.value.notifyLoadStart();

  let filePath = store.file.path + store.file.name + store.file.extension;

  if (store.file.path === undefined || saveAs) {
    const lang = langInfo[store.lang.selectedLang];
    const options = {
      defaultPath: `~/${lang.tempname}`,
      filters: [
        { name: lang.name, extensions: lang.ext },
        { name: 'All Files', extensions: ['*'] },
      ],
    };

    const { canceled, filePath: _filepath } = await window.api.showSaveDialog(options);

    if (canceled) {
      statusbarRef.value.notifyLoadEnd();
      return;
    }
    filePath = _filepath;
  }

  try {
    await window.api.writeFile(filePath, getContent());
  } catch (err) {
    consoleRef.value.print(`an error occred while saving the file ${filePath}; ${err}`, INFO_LEVEL.err);
  }

  if (store.file.path === undefined || saveAs) {
    consoleRef.value.print(`file saved as ${filePath}`);
  }
  _setFileInfo(filePath);

  statusbarRef.value.notifyLoadEnd();
}


function newWindow(filePaths = []) {
  const filePathsArray = Array.isArray(filePaths) ? filePaths : [filePaths];
  window.api.newWindow(filePathsArray);
}


const exposedFunctions = {
  getContent,
  setContent,
  openFile,
  saveFile,
  saveFileAs,
  newWindow
};



/* ------------- PRIVATE FUNCTIONS ------------- */

async function _initialize() {
  settings.value = await window.api.getInitialSettings();

  mergeDeep(langInfo, settings.languageConfig);
  store.lang.options = langInfo;

  if (!settings.value.windowConfig.native_frame) {
    document.body.classList.add('rounded');
  }
  if (settings.value.localWindowConfig.maximized) {
    document.body.classList.add('fullscreen');
  }

  if (settings.value.filePathsToOpen.length) {
    openFile(settings.value.filePathsToOpen);
  }
}

function _setFileInfo(filePath) {
  store.file.extension = window.api.path.extname(filePath);
  store.file.path = window.api.path.dirname(filePath) + window.api.path.sep;
  store.file.name = window.api.path.basename(filePath, store.file.extension);

  const lang = getModeFromName(store.file.name + store.file.extension);
  console.log("Lang detected", lang[0])
  if (lang == null) {
    store.file.lang = 'plaintext';
  } else {
    store.file.lang = lang[0];
  }

  setLanguage(store.file.lang);
  store.isSaved = true;
  //_updateTitle();
}

function _onStoreResize(type, val) {
  window.api.storeSetting(type, val);
}

function _onDropOpen(e) {
  Array.from(e.dataTransfer.files).forEach((f) => {
    openFile(f.path);
  });
}





onBeforeMount(() => {
  _initialize();
});

onMounted(() => {
  window.addEventListener('keydown', (event) => {
    const lowerKey = event.key.toLowerCase();
    if (event.ctrlKey && !event.shiftKey) {
      if (lowerKey in keybindings.ctrl) {
        event.preventDefault();
        exposedFunctions[keybindings.ctrl[lowerKey].func]()
      }
    } else if (event.ctrlKey && event.shiftKey) {
      if (lowerKey in keybindings.ctrlshift) {
        event.preventDefault();
        exposedFunctions[keybindings.ctrlshift[lowerKey].func]()
      }
    }
  }, false);


  window.api.canClose((event) => {
    event.sender.send('can-close-response', (store.isSaved === null || store.isSaved));
  });
})

watch(() => consoleRef.value, () => {
  window.api.print((_, value) => {
    consoleRef.value.print(value.text);
  });

  consoleRef.value.print(`${settings.value.appInfo.name} ${settings.value.appInfo.version}`);
})
</script>

<template>
  <Header />
  <Divider v-if="settings != null" :initial-percentage="settings.editorConfig.console_div_percent" direction="vertical"
    :dbclick-percentage="60" @resized="(e) => _onStoreResize('console_div_percent', e)">
    <template #primary>
      <Editor config="" @dragover.prevent @drop.prevent="_onDropOpen" ref="editorRef" :lang="store.lang.selectedLang" />
    </template>
    <template #secondary>
      <Console ref="consoleRef" :status-bar-ref="statusbarRef" />
    </template>
  </Divider>
  <Footer />
  <Statusbar ref="statusbarRef" />
</template>

<style>
#app {
  background-color: var(--background);
  max-height: calc(100vh - 2px);
  height: calc(100vh - 2px);
  overflow: hidden;
  display: grid;
  grid-template-rows: min-content auto min-content min-content;
  border: 1px solid #2d2d2d;
  position: relative;
}

#app:before {
  content: "";
  background-image: url(../img/texture.jpg);
  background-size: 91px;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  border: 0;
  z-index: 100;
  height: 100%;
  width: 100%;
  display: block;
  pointer-events: none;
  opacity: 0.05;
}

body.rounded #app {
  border-radius: 8px;
}

body.rounded:not(.fullscreen) #app {
  max-height: calc(100vh - 16px);
  height: calc(100vh - 16px);
}

body.light #app {
  background-color: var(--background-light);
  border: 1px solid #bdbdbd;
}

header,
footer {
  padding: 10px 16px;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  background-color: inherit;
}
</style>
