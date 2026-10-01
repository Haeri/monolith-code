const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const common = require('./common');

const WRITE_DELAY_MS = 250;

function parseDataFile(filePath, defaults) {
  try {
    const stored = JSON.parse(fs.readFileSync(filePath));
    const tmp = {};
    common.mergeDeep(tmp, defaults);
    common.mergeDeep(tmp, stored);
    return tmp;
  } catch {
    return defaults;
  }
}

function setDescendantProp(obj, desc, value) {
  if (typeof desc === 'string') return setDescendantProp(obj, desc.split('.'), value);
  if (desc.length === 1 && value !== undefined) return (obj[desc[0]] = value);
  if (desc.length === 0) return obj;
  return setDescendantProp(obj[desc[0]], desc.slice(1), value);
}

class Store {
  #writeTimeout = null;

  constructor(opts) {
    const userDataPath = app.getPath('userData');
    this.path = path.join(userDataPath, `${opts.configName}.json`);

    if (fs.existsSync(this.path)) {
      this.data = parseDataFile(this.path, opts.defaults);
    } else {
      // Create empty file
      fs.closeSync(fs.openSync(this.path, 'w'));
      this.data = opts.defaults;
    }
  }

  getFilePath() {
    return this.path;
  }

  get(key) {
    return this.data[key];
  }

  set(key, val) {
    setDescendantProp(this.data, key, val);

    // Coalesce bursts of updates (e.g. zooming with the mouse wheel) into a single write
    clearTimeout(this.#writeTimeout);
    this.#writeTimeout = setTimeout(() => this.flush(), WRITE_DELAY_MS);
  }

  flush() {
    if (this.#writeTimeout === null) return;

    clearTimeout(this.#writeTimeout);
    this.#writeTimeout = null;

    // Write to a temp file and rename so a crash never leaves a half-written settings file
    const tmpPath = `${this.path}.tmp`;
    try {
      fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 4));
      fs.renameSync(tmpPath, this.path);
    } catch (err) {
      console.error(`Could not write ${this.path}: ${err.message}`);
    }
  }
}

module.exports = Store;
