import { computed, reactive } from 'vue'
import langInfo from "./assets/lang.json";

export const store = reactive({
  isSaved: null,
  file: {
    name: undefined,
    extension: undefined,
    path: undefined,
    lang: undefined,
  },
  lang: {
    options: langInfo,
    selectedLang: "plaintext"
  }
})
export const selectedMode = computed(() => store.lang.options[selectedLang].mode);