<template>
  <header data-tauri-drag-region>
    <span>{{ this.title() }}{{this.star() }}</span>
    <div class="window-buttons">
      <button @click="togglePin" id="pin-button"></button>
      <button @click="minimize" id="min-button"></button>
      <button @click="toggleMaximize" id="max-button"></button>
      <button @click="tryClose" id="close-button"></button>
    </div>
  </header>
</template>

<script>
import { store } from '../store'
import { appWindow } from "@tauri-apps/api/window";

export default {
  name: "MonolithHeader",
  props: {},
  data() {
    return {
      store,
      isPinned: false,
    };
  },
  methods: {
    title() {
      return this.store.file.extension ? this.store.file.name + this.store.file.extension : 'new document';      
    },
    star(){
      return (this.store.isSaved === null || this.store.isSaved) ? "" : "*";
    },
    togglePin() {
      this.isPinned = !this.isPinned;
      appWindow.setAlwaysOnTop(this.isPinned);
    },
    minimize() {
      appWindow.minimize();
    },
    toggleMaximize() {
      appWindow.toggleMaximize();
    },
    async tryClose() {
      if (this.isSaved === null || this.isSaved) {
        appWindow.close();
      } else {
        let { canceled, yes } = await window.api.showAskForSaveDialog();

        if (canceled) return;
        else if (yes) {
          try {
            let ret = null; //await saveFile();
            if (!ret) return;
          } catch (err) {
            return;
          }
        }

        appWindow.close();
      }
    },
  }
};
</script>

<style scoped>
header {
  padding: 10px 16px;
  user-select: none;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}

header .window-buttons {
  -webkit-app-region: no-drag;
  display: flex;
  align-items: center;
  height: 100%;
}

header .window-buttons button {
  -webkit-app-region: no-drag;
  display: block;
  width: 11px;
  height: 11px;
  border-radius: 100%;
  outline: none;
  background-color: transparent;
  border: 1px solid var(--foreground);
  transition: 0.3s;
  margin-left: 8px;
  padding: 0;
}

header .window-buttons button#pin-button {
  margin-right: 10px;
  opacity: 0;
  transition-delay: 1s;
}

header .window-buttons:hover button#pin-button,
header .window-buttons button#pin-button.pinned {
  opacity: 1;
  transition-delay: 0s;
}

header .window-buttons button#pin-button:hover {
  background-color: #c7c7c7;
  border: 1px solid #c7c7c7;
  box-shadow: 0px 0px 30px 1px #c7c7c7;
}

header .window-buttons button#pin-button.pinned {
  background-color: #a7a7a7;
  border: 1px solid #a7a7a7;
}

header .window-buttons button#close-button:hover {
  background-color: #f44336;
  border: 1px solid #f44336;
  box-shadow: 0px 0px 30px 1px #f44336;
}

header .window-buttons button#min-button:hover {
  background-color: #4caf50;
  border: 1px solid #4caf50;
  box-shadow: 0px 0px 30px 1px #4caf50;
}

header .window-buttons button#max-button:hover {
  background-color: #ffeb3b;
  border: 1px solid #ffeb3b;
  box-shadow: 0px 0px 30px 1px #ffeb3b;
}

header{
	padding: 10px 16px;
	display: flex;
	flex-direction: row;
	justify-content: space-between;
	background-color: inherit;
  }
</style>
