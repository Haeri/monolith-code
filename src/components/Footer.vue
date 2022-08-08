<script setup>
import Dropdown from './Dropdown.vue';

import { store } from "../store";



</script>

<template>
  <footer>
    <span id="char-display"></span>
    <Dropdown :options="store.lang.options" default="plaintext" @selected="(e) => store.lang.selected = e" />
  </footer>
</template>

<style scoped>
</style>