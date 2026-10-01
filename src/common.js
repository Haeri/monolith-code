const EXE_EXTENSION = Object.freeze({
  linux: '',
  darwin: '',
  win32: '.exe',
});

class LazyRequire {
  #requireValue = null;
  #requireFunk = null;
  constructor(requireFunk) {
    this.#requireFunk = requireFunk;
  }
  get() {
    if (this.#requireValue === null) {
      this.#requireValue = this.#requireFunk();
    }
    return this.#requireValue;
  }
}

function requireLazy(func) {
  return new LazyRequire(func);
}

const getExeExtension = (platform) => (Object.prototype.hasOwnProperty.call(EXE_EXTENSION, platform) ? EXE_EXTENSION[platform] : '');

// https://stackoverflow.com/a/34749873
const isObject = (item) => (item && typeof item === 'object' && !Array.isArray(item));

/**
 * Deep merge two objects.
 * @param target
 * @param ...sources
 */
const mergeDeep = (target, ...sources) => {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        mergeDeep(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return mergeDeep(target, ...sources);
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports.getExeExtension = getExeExtension;
  module.exports.isObject = isObject;
  module.exports.mergeDeep = mergeDeep;
  module.exports.requireLazy = requireLazy;
}
