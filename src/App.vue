<template>
  <MonolithHeader />
  <MonolithBody ref="editor" />
  <MonolithConsole :statusBar="$refs.statusBar"/>
  <MonolithFooter />
  <MonolithStatusBar />
</template>

<script>
//import { appWindow } from "@tauri-apps/api/window";
import { dialog, fs } from "@tauri-apps/api";

import MonolithHeader from "./components/MonolithHeader.vue";
import MonolithBody from "./components/MonolithBody.vue";
import MonolithConsole from "./components/MonolithConsole.vue";
import MonolithFooter from "./components/MonolithFooter.vue";
import MonolithStatusBar from "./components/MonolithStatusBar.vue";

import { store } from './store'
import { keyBindings } from "./assets/keybindings";

export default {
  name: "App",
  data() {
    return {};
  },
  created() {
    window.addEventListener("keydown", this.handleKeyEvent, false);
  },
  destroyed() {
    window.removeEventListener("keydown", this.handleKeyEvent);
  },
  methods: {
    handleKeyEvent(event) {
      let lowerKey = event.key.toLowerCase();
      if (event.ctrlKey && !event.shiftKey) {
        if (lowerKey in keyBindings.ctrl) {
          event.preventDefault();
          this[keyBindings.ctrl[lowerKey].func]();
        }
      } else if (event.ctrlKey && event.shiftKey) {
        if (lowerKey in keyBindings.ctrlshift) {
          event.preventDefault();
          this[keyBindings.ctrlshift[lowerKey].func]();
        }
      }
    },
    async openFile(filePaths = []) {
      this.$notifyLoadStart();

      filePaths = Array.isArray(filePaths) ? filePaths : [filePaths];

      if (!filePaths.length) {
          let ret = await dialog.open({ title: 'Open a file', multiple: true });
        if (ret === null) {
          this.$notifyLoadEnd();
          return false;
        } else {
          filePaths = ret;
        }
      }

      if (!store.file.path && (store.isSaved === null || store.isSaved)) {
        let fileToOpen = filePaths.shift();
        fs.readTextFile(fileToOpen)          
          .then((data) => {
            this.$refs.editor.setContent(data);
            //_setFileInfo(fileToOpen);
            //webviewUi.src = 'about:blank'
            this.$consoleLog(`Opened file ${fileToOpen}`);
          })
          .catch((err) => {
            this.$consoleLog(
              `Could not open file ${fileToOpen}<br>${err}`,
              this.$INFO_LEVEL.error
            );
          })
          .finally(() => {
            this.$notifyLoadEnd();
          });
      }

      if (filePaths.length) {
        //newWindow(filePaths);
      }
      this.$notifyLoadEnd();
    },
    async saveFileAs() {
      return saveFile(true);
    },
    async saveFile(saveAs = false) {
      /*
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
      return false;
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
  */
    },
  },
  components: {
    MonolithHeader,
    MonolithBody,
    MonolithConsole,
    MonolithFooter,
    MonolithStatusBar,
  },
};
</script>

<style>
/* ---------- FONT ---------- */

@font-face {
  font-family: "Source Code Pro";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(../font/SourceCodePro-Regular.ttf) format("truetype");
}

@font-face {
  font-family: "Source Code Pro";
  font-style: normal;
  font-weight: 300;
  font-display: swap;
  src: url(../font/SourceCodePro-Light.ttf) format("truetype");
}

@font-face {
  font-family: "Open Sans";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(../font/OpenSans-Regular.ttf) format("truetype");
}

@font-face {
  font-family: "Open Sans";
  font-style: normal;
  font-weight: 300;
  font-display: swap;
  src: url(../font/OpenSans-Light.ttf) format("truetype");
}

/* ---------- ROOT ---------- */

:root {
  --foreground: #747474;
  --background: #212121;
  --foreground-light: #191919;
  --background-light: #fafafa;
  --font-size: 12px;
}

body {
  -webkit-font-smoothing: antialiased;

  color: var(--foreground);
  font-family: "Open Sans", sans-serif;
  font-size: var(--font-size);
  overflow: hidden;
  margin: 0;
}

body.rounded {
  margin: 6px 8px 8px 6px;
  box-shadow: 1px 1px 8px rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  transition: 0.2s margin, border-radius, background-color;
  background-color: transparent;
}

body.fullscreen {
  margin: 0px;
  box-shadow: 0px 0px 0px rgba(0, 0, 0, 0);
  border-radius: 0px;
  background-color: black;
}

body.light {
  color: var(--foreground-light);
}

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

body.rounded #app {
  border-radius: 8px;
}

body.rounded:not(.fullscreen) #app {
  max-height: calc(100vh - 16px);
  height: calc(100vh - 16px);
}

#app:before {
  content: "";
  background-image: url(./assets/texture.jpg);
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
  opacity: 0.06;
}

body.light #app {
  background-color: var(--background-light);
  border: 1px solid #bdbdbd;
}
</style>
