<script setup>
import Dropdown from './Dropdown.vue';

import { store } from "../store";



</script>

<template>
  <footer>
    <span id="char-display"></span>
    <Dropdown :options="store.lang.options" :default="store.lang.selectedLang"
      @selected="(e) => store.lang.selectedLang = e" />
  </footer>
</template>

<style scoped>
</style>