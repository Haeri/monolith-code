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

const statusbarRef = ref(null);


window.api.canClose((event) => {
  event.sender.send('can-close-response', (store.isSaved === null || store.isSaved));
});

</script>

<template>
  <Header />
  <Divider>
    <template #primary>
      <Editor />
    </template>
    <template #secondary>
      <Console />
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
