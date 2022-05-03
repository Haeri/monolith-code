<template>

  <iframe
  id="embed-content"
    ref="frame"
    sandbox="allow-forms allow-modals allow-pointer-lock allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation"
    :srcdoc="srcdoc"
  />

</template>

<script>
const injection = `<script>var console = {  __on : {},  addEventListener : function (name, callback) {    this.__on[name] = (this.__on[name] || []).concat(callback);    return this;  },  dispatchEvent : function (name, value) {    this.__on[name] = (this.__on[name] || []);    for (var i = 0, n = this.__on[name].length; i < n; i++) {      this.__on[name][i].call(this, value);    }    return this;  },  log: function () {    var a = [];   for (var i = 0, n = arguments.length; i < n; i++) {      a.push(arguments[i]);    }    this.dispatchEvent('log', a);  }};<\/script>`;

export default {
  name: "PreviewFrame",
  data() {
    return {
      srcdoc: "",
    };
  },
  mounted() {},
  props: {},
  methods: {
    setContent(c) {
      this.srcdoc = injection + c;
      
      this.$refs.frame.contentWindow.console.addEventListener(
        "log",
        (value) => {
          $this.$consoleLog(value);
        }
      );
    },
  },
  components: {},
};
</script>

<style scoped>


#embed-content {
min-width: 0;
    flex: 1;
    border: none;
    background: #ffffff04;
	
}

#embed-content.html-style {
	background: #a9a9a9;
}

#embed-content-dev-view {
	flex: 1;
	min-height: 0;
}
</style>