const EXE_EXTENSION = Object.freeze({
  linux: '',
  darwin: '',
  win32: '.exe',
});

const PLATFORM_ZIP = Object.freeze({
  linux: 'monolithcode_linux.zip',
  darwin: 'monolithcode_mac.zip',
  win32: 'monolithcode_win.zip',
});

const getExeExtension = () => (Object.prototype.hasOwnProperty.call(EXE_EXTENSION, process.platform) ? EXE_EXTENSION[process.platform] : '');

if (typeof module !== 'undefined' && module.exports) {
  module.exports.PLATFORM_ZIP = PLATFORM_ZIP;
  module.exports.getExeExtension = getExeExtension;
}
