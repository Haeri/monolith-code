<script setup>
import { VAceEditor } from "vue3-ace-editor";
import "ace-builds/src-noconflict/mode-json";
import "ace-builds/src-noconflict/mode-plain_text";
import "ace-builds/src-noconflict/theme-monokai";
import ace from "ace-builds";
import modelist from "ace-builds/src-noconflict/ext-modelist";
import langInfo from "../assets/lang.json";

//import workerJsonUrl from "ace-builds/src-noconflict/worker-json?url";
import { ref } from "@vue/reactivity";
import { computed } from "@vue/runtime-core";
//ace.config.setModuleUrl("ace/mode/json_worker", workerJsonUrl);

const props = defineProps({
  lang: String
})

const mode = computed(() => langInfo[props.lang].mode);
const content = ref("");

const options = ref({
  useWorker: false,
  //enableBasicAutocompletion: true,
  showPrintMargin: false,
  showLineNumbers: true,
  showGutter: true,
  wrap: true,
  scrollPastEnd: 1,
  fixedWidthGutter: true,
  fadeFoldWidgets: true,
  highlightActiveLine: false,
  fontSize: 12,
});


function setContent(text) {
  content.value = text;
}

defineExpose({
  setContent
});

</script>

<template>
mode: {{mode}}
  <div id="editor-wrapper">
    <v-ace-editor
      id="main-text-area"
      v-model:value="content"
      :lang="mode"
      theme="monokai"
      style="height: 100%"
      :minLines="10"
      :options="options"      
    />
  </div>
</template>

<style scoped>
#editor-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

#main-text-area {
  margin: 0;
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  font-family: "Source Code Pro", monospace;
  font-weight: 400;
  cursor: text;
  margin-right: 4px;
  padding-right: 4px;
  background-color: transparent;
}
</style>

<style>
.ace_cursor {
    color: #ffcc00 !important;
}

.ace_gutter {
  background-color: transparent !important;
}

.ace_gutter-active-line {
  color: white;
  background-color: transparent !important;
}

.ace_dark.ace_editor.ace_autocomplete,
.ace_search {
  backdrop-filter: blur(8px);
  background: rgb(30 30 30 / 55%);
  box-shadow: 1px 1px 8px rgba(0, 0, 0, 0.2);
  font-family: inherit;
  border: 1px solid #2d2d2d;
}

.ace_search.right {
  border-radius: 0px 0px 4px 4px;
  border: 1px solid #2d2d2d;
  border-top: 0 none;
}

.ace_dark.ace_editor.ace_autocomplete {
  border-radius: 0px 4px 4px 0px;
  padding: 0;
  border-radius: 4px;
}

.ace_dark.ace_editor.ace_autocomplete .ace_marker-layer .ace_active-line {
  background-color: #101010b5;
}

.ace_search .ace_search_form > *,
.ace_search .ace_replace_form > * {
  background: var(--background);
  border-color: #2d2d2d;
  color: var(--foreground);
}

.ace_search input {
  color: white !important;
}

.ace_button,
.ace_searchbtn {
  color: var(--foreground);
  transition: 0.3s;
}

.ace_button:hover,
.ace_searchbtn:hover {
  color: white;
  background: inherit;
}

.ace_searchbtn:after {
  transition: 0.3s;
}

.ace_searchbtn:hover:after {
  border-color: white;
}
</style>