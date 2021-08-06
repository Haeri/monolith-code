const AdmZip = require('adm-zip');
const fs = require('fs');

try {
  if (fs.existsSync('./src')) {
    console.log('DEV Mode');
  } else {
    console.log('PROD Mode');

    setTimeout(() => {
      console.log('Extracting zip...');
      const zip = new AdmZip('./monolith.zip');
      zip.extractAllTo('./', true);
      console.log('Deleting zip...');
      fs.unlinkSync('./monolith.zip');
    }, 1000);
  }
} catch (error) {
  fs.writeFile('./log.txt', error, (err) => {});
}
