const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const common = require('./common');

function parseDataFile(filePath, defaults) {
  try {
    let stored = JSON.parse(fs.readFileSync(filePath));
    let tmp = {};
    common.mergeDeep(tmp, defaults);
    common.mergeDeep(tmp, stored);
    return tmp;
  } catch (error) {
    return defaults;
  }
}

function setDescendantProp(obj, desc, value) {
  if (typeof desc == 'string')
    return setDescendantProp(obj, desc.split('.'), value);
  else if (desc.length == 1 && value !== undefined)
    return obj[desc[0]] = value;
  else if (desc.length == 0)
    return obj;
  else
    return setDescendantProp(obj[desc[0]], desc.slice(1), value);
}


class Store {
  constructor(opts) {
    const userDataPath = app.getPath('userData');
    this.path = path.join(userDataPath, `${opts.configName}.json`);

    if(fs.existsSync(this.path)){
      this.data = parseDataFile(this.path, opts.defaults);
    }else{
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
    fs.writeFile(this.path, JSON.stringify(this.data, null, 4), () => { });
  }
}

module.exports = Store;
