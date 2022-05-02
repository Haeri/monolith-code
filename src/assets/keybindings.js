export const keyBindings = {
  ctrl: {
    "o": {
      desc: "Open a file",
      func: "openFile"
    },
    "b": {
      desc: "Build and run the current file",
      func: "buildRunFile"
    },
    "s": {
      desc: "Save the current file",
      func: "saveFile"
    },
    "n": {
      desc: "Open a new editor window",
      func: "newWindow"
    },
    "i": {
      desc: "Open settings",
      func: "openSettings"
    },
    "p": {
      desc: "Export the preview window as PDF",
      func: "exportPDFFromPreview"
    },
    "t": {
      desc: "Open a hello world tamplate for the current language",
      func: "makeLanguageTemplate"
    },
    "m": {
      desc: "Evaluate a mathematical equation on the selected line",
      func: "evaluateMathInline"
    }
  },
  ctrlshift: {
    "b": {
      desc: "Beautify the document",
      func: "beautifyDocument"
    },
    "s": {
      desc: "Save the current document as new file",
      func: "saveFileAs"
    }
  }
}

export default {}