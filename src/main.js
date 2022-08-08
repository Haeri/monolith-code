import { createApp } from 'vue'
import App from './App.vue'


window.INFO_LEVEL = Object.freeze({
    user: 0,
    info: 1,
    confirm: 2,
    warn: 3,
    error: 4,
  });

  
createApp(App).mount('#app')
