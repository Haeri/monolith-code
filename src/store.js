import { reactive } from 'vue'

export const store = reactive({
  isSaved: null,
  file: {
    name: undefined,
    extension: undefined,
    path: undefined,
    lang: undefined,
  }
})