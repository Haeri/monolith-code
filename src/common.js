const EXE_EXTENSION = Object.freeze({
  linux: '',
  darwin: '',
  win32: '.exe',
});

const getExeExtension = () => (Object.prototype.hasOwnProperty.call(EXE_EXTENSION, process.platform) ? EXE_EXTENSION[process.platform] : '');

module.exports = getExeExtension;
