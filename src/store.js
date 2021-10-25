const { app } = require('electron');
const path = require('path');
const fs = require('fs');

function parseDataFile(filePath, defaults) {
  try {
    let stored = JSON.parse(fs.readFileSync(filePath));
    return { ...defaults, ...stored };
  } catch (error) {
    return defaults;
  }
}

class Store {
  constructor(opts) {
    const userDataPath = app.getPath('userData');
    this.path = path.join(userDataPath, `${opts.configName}.json`);

    this.data = parseDataFile(this.path, opts.defaults);
  }

  getFilePath() {
    return this.path;
  }

  get(key) {
    return this.data[key];
  }

  set(key, val) {
    this.data[key] = val;
    fs.writeFile(this.path, JSON.stringify(this.data, null, 4), () => { });
  }
}

module.exports = Store;
