<script setup>
/*
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
  */

import { ref } from "@vue/reactivity";
import { computed } from "@vue/runtime-core";
import { store } from '../store'

const props = defineProps({
  documentName: String,
});
const title = computed(() => {
    return store.file.extension ? store.file.name + store.file.extension : 'new document';
});
const isPinned = ref(false);


function togglePin() {
  isPinned.value = !isPinned;
  window.api.setAlwaysOnTop(isPinned.value);
}

function minimize() {
  window.api.minimize();
}

function toggleMaximize() {
  window.api.toggleMaxUnmax();
}

function requestClose() {
     window.api.close();
    //killProcess().then(() => window.api.close());
}
</script>

<template>
  <header>
    <span id="document-name">{{title}}</span>
    <div id="window-buttons">
      <button
        @click="togglePin"
        :class="{ pinned: isPinned }"
        id="pin-button"
      ></button>
      <button @click="minimize" id="min-button"></button>
      <button @click="toggleMaximize" id="max-button"></button>
      <button @click="requestClose" id="close-button"></button>
    </div>
  </header>
</template>

<style scoped>
header {
  -webkit-user-select: none;
  -webkit-app-region: drag;
}

header #window-buttons {
  -webkit-app-region: no-drag;
  display: flex;
  align-items: center;
  height: 100%;
}

header #window-buttons button {
  -webkit-app-region: no-drag;
  display: block;
  width: 11px;
  height: 11px;
  border-radius: 100%;
  outline: none;
  background-color: transparent;
  border: 1px solid var(--foreground);
  transition: 0.3s;
  margin-left: 9px;
  cursor: pointer;
  padding: 0;
}

header #window-buttons button#pin-button {
  margin-right: 10px;
  opacity: 0;
  transition-delay: 1s;
}

header #window-buttons:hover button#pin-button,
header #window-buttons button#pin-button.pinned {
  opacity: 1;
  transition-delay: 0s;
}

header #window-buttons button#pin-button:hover {
  background-color: #c7c7c7;
  border: 1px solid #c7c7c7;
  box-shadow: 0px 0px 30px 1px #c7c7c7;
}

header #window-buttons button#pin-button.pinned {
  background-color: #a7a7a7;
  border: 1px solid #a7a7a7;
}

header #window-buttons button#close-button:hover {
  background-color: hsl(4, 90%, 72%);
  /*border: 1px solid #f44336;*/
  box-shadow: 0px 0px 30px 1px #f44336;
}

header #window-buttons button#close-button {
  background-color: #f44336;
  border: 1px solid #f44336;
}

header #window-buttons button#min-button:hover {
  background-color: hsl(122, 39%, 63%);
  /*border: 1px solid #4caf50;*/
  box-shadow: 0px 0px 30px 1px #4caf50;
}

header #window-buttons button#min-button {
  background-color: #4caf50;
  border: 1px solid #4caf50;
}

header #window-buttons button#max-button:hover {
  background-color: hsl(54, 100%, 76%);
  /*border: 1px solid #ffeb3b;*/
  box-shadow: 0px 0px 30px 1px #ffeb3b;
}

header #window-buttons button#max-button {
  background-color: #ffeb3b;
  border: 1px solid #ffeb3b;
}
</style>