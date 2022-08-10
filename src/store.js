import { computed, reactive } from 'vue'

export const store = reactive({
  isSaved: null,
  file: {
    name: undefined,
    extension: undefined,
    path: undefined,
    lang: undefined,
  },
  lang: {
    options: null,
    selectedLang: null
  }
})
export const selectedMode = computed(() => store.lang.options[selectedLang].mode);