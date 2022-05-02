<template>
  <v-ace-editor
    v-model:value="content"
    lang="json"
    theme="monokai"
    style="height: 100%"
    :options="options"
  />
</template>

<script>
import { VAceEditor } from "vue3-ace-editor";
import 'ace-builds/src-noconflict/mode-json';
import 'ace-builds/src-noconflict/theme-monokai';
import ace from 'ace-builds';
import workerJsonUrl from 'ace-builds/src-noconflict/worker-json?url';

ace.config.setModuleUrl('ace/mode/json_worker', workerJsonUrl);

export default {
  name: "MonolithBody",
  data() {    
    return {
      content: "",
      options: {
        useWorker: true,
        //enableBasicAutocompletion: true,
        showPrintMargin: false,
        showLineNumbers: true,
        showGutter: true,
        wrap: true,
        scrollPastEnd: 1,
        fixedWidthGutter: true,
        fadeFoldWidgets: true,
        highlightActiveLine: false,
        useWorker: false,
        fontSize: 12,
      },
    };
  },
  props: {},
  methods: {
    setContent(text){
      this.content = text;
    },
    getContent(){
      return this.content;
    }
  },
  components: {
    VAceEditor,
  },
};
</script>

<style scoped>
</style>
