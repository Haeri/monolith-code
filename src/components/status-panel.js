(() => {
  const HTML_TEMPLATE = /* html */ `
<div id="status-display">
  <spam id="status-bar"></spam>
</div>
`;

  class StatusPanel extends HTMLElement {
    constructor() {
      super();

      this.statusDisplayUi = null;
      this.statusBarUi = null;
    }

    connectedCallback() {
      this.innerHTML = HTML_TEMPLATE;
      this.statusDisplayUi = this.querySelector('#status-display');
      this.statusBarUi = this.querySelector('#status-bar');
    }

    notify(type) {
      this.statusDisplayUi.className = '';
      this.statusDisplayUi.classList.add(type);
    }

    notifyLoadStart() {
      this.statusBarUi.classList.add('load');
    }

    notifyLoadEnd() {
      this.statusBarUi.className = '';
    }
  }

  customElements.define('mc-status-panel', StatusPanel);
})();
