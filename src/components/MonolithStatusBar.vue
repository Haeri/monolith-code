
<template>
  <div id="status-display" :class="status">
    <span id="status-bar" :class="{ loading: loading }"></span>
  </div>
</template>

<script>
import { getCurrentInstance } from '@vue/runtime-core';

export default {
  name: "MonolithStatusBar",
  props: {},
  data() {
    return {
      status: "",
      loading: false,
    };
  },
  created() {
    let app = getCurrentInstance();
    app.appContext.config.globalProperties.$notify = this.notify;
    app.appContext.config.globalProperties.$notifyLoadStart =
      this.notifyLoadStart;
    app.appContext.config.globalProperties.$notifyLoadEnd = this.notifyLoadEnd;
  },
  methods: {
    notify(status) {
      this.status = status;
    },
    notifyLoadStart() {
      this.loading = true;
    },
    notifyLoadEnd() {
      this.loading = false;
    },
  },
};
</script>

<style scoped>
#status-display {
  height: 2px;
  position: relative;
  z-index: 4;
}

#status-display #status-bar {
  background: transparent;
  position: absolute;
  display: block;
  height: 100%;
  left: 0;
  top: 0;
}

#status-display.confirm {
  animation: confirm 4s;
}

#status-display.warn {
  animation: warn 4s;
}

#status-display.error {
  animation: err 4s;
}

#status-display #status-bar.loading {
  animation: load 2s cubic-bezier(0.86, 0, 0.07, 1) infinite;
}

@keyframes confirm {
  0% {
    background-color: #4caf5000;
  }

  3% {
    background-color: #4caf50;
    box-shadow: 0px 0px 20px 1px #4caf50;
  }

  100% {
    background-color: #4caf5000;
  }
}

@keyframes warn {
  0% {
    background-color: #ffeb3b00;
  }

  3% {
    background-color: #ffeb3b;
    box-shadow: 0px 0px 20px 1px #ffeb3b;
  }

  100% {
    background-color: #ffeb3b00;
  }
}

@keyframes err {
  0% {
    background-color: #f4433600;
  }

  3% {
    background-color: #f44336;
    box-shadow: 0px 0px 20px 1px #f44336;
  }

  100% {
    background-color: #f4433600;
  }
}

@keyframes load {
  0% {
    width: 0%;
    left: 0%;
    background-color: #2443f0;
    box-shadow: 0px 0px 20px 1px #2844e04c;
  }

  50% {
    width: 100%;
    left: 0%;
    background-color: #2443f0;
    box-shadow: 0px 0px 26px 1px #2844e0;
  }

  100% {
    width: 0%;
    left: 100%;
    background-color: #2443f0;
    box-shadow: 0px 0px 20px 1px #2844e04c;
  }
}

@keyframes pulse {
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(244, 67, 54, 0.7);
  }

  70% {
    transform: scale(1);
    box-shadow: 0 0 0 10px rgba(244, 67, 54, 0);
  }

  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(244, 67, 54, 0);
  }
}
</style>
