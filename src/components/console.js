// import {requireLazy} from "../common.js";

const INFO_LEVEL = Object.freeze({
  user: 0,
  info: 1,
  confirm: 2,
  warn: 3,
  error: 4,
});

(() => {
  // let errorSVG = requireLazy(async () => await fetch('res/img/err.svg').then(res => res.text()));

  const HTML_TEMPLATE = /* html */ `
<div id="console">
    <pre id="console-out"></pre>
    <textarea id="console-in" spellcheck="false"></textarea>
    <span id="process-indicator"></span>
</div>
    `;

  class Console extends HTMLElement {
    constructor() {
      super();

      this.consoleUi = null;
      this.consoleInUi = null;
      this.consoleOutUi = null;

      this.commandHistory = [];
      this.historyIndex;
    }

    connectedCallback() {
      this.innerHTML = HTML_TEMPLATE;

      this.consoleUi = this.querySelector('#console');
      this.consoleInUi = this.querySelector('#console-in');
      this.consoleOutUi = this.querySelector('#console-out');

      this.consoleInUi.addEventListener('keydown', (event) => {
        if (!event.shiftKey && event.key === 'Enter') {
          event.preventDefault();
          const cmd = this.consoleInUi.value.replace(/\n$/, '');
          this.consoleInUi.value = '';

          if (this.historyIndex !== undefined) {
            this.commandHistory.pop();
            this.historyIndex = undefined;
          }
          this.commandHistory.push(cmd);

          const pre = cmd.split(' ')[0];

          if (pre in commandList) {
            print(pre, INFO_LEVEL.user);
            commandList[pre].func();
          } else if (cmd.startsWith('!')) {
            print(pre, INFO_LEVEL.user);
            print('Command not recognized. Try !help.', INFO_LEVEL.warn);
          } else if (runningProcess != null) {
            runningProcess.dispatch('stdin', `${cmd}\n`);
          } else {
            runCommand(cmd);
          }

          return false;
        } if (!event.ctrlKey && event.key === 'ArrowUp') {
          event.preventDefault();
          const currCmd = this.consoleInUi.value;

          if (this.historyIndex === undefined) {
            this.commandHistory.push(currCmd);
            this.historyIndex = this.commandHistory.length - 2;
          } else {
            if (this.historyIndex - 1 < 0) {
              this.historyIndex = this.commandHistory.length;
            }
            this.historyIndex -= 1;
          }

          this.consoleInUi.value = this.commandHistory[this.historyIndex];
          return false;
        }
        return true;
      }, false);
    }

    print(text, mode = INFO_LEVEL.info) {
      const block = document.createElement('div');
      block.classList.add(Object.keys(INFO_LEVEL).find((key) => INFO_LEVEL[key] === mode));

      errorSVG.get().then((svg) => {
        block.innerHTML = (mode === 4 ? svg : '') + text;
      });
      this.consoleOutUi.appendChild(block);

      if (mode >= 2) {
        const ret = Object.keys(INFO_LEVEL).find((key) => INFO_LEVEL[key] === mode);
        statusPanelComponent.notify(ret);
      }

      setTimeout(() => this.consoleUi.scrollTo({ top: this.consoleUi.scrollHeight, behavior: 'smooth' }), 0);
    }

    clear() {
      this.consoleOutUi.innerHTML = '';
    }
  }

  customElements.define('mc-console', Console);
})();
