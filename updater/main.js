const AdmZip = require('adm-zip');
const fs = require('fs');
const { execSync } = require('child_process');
const crypto = require('crypto');
const axios = require('axios').default;

const PLATFORM_ZIP = Object.freeze({
  linux: 'monolithcode_linux.zip',
  darwin: 'monolithcode_mac.zip',
  win32: 'monolithcode_win.zip',
});

const CHECKSUMS_URL = 'https://github.com/Haeri/MonolithCode2/releases/latest/download/sha512sums.txt';

try {
  if (fs.existsSync('./src')) {
    console.log('DEV Mode');
  } else {
    console.log('monolith code updater');

    setTimeout(() => {
      const checklist = {};

      console.log('Download checksum...');
      axios.get(CHECKSUMS_URL)
        .then((response) => {
          const info = response.data;
          const list = info.split('\n');
          list.forEach((el) => {
            const [hash, key] = el.split('  ');
            checklist[key] = hash;
          });

          console.log('Verifying zip...');
          fs.readFile('./monolith.zip', (err, data) => {
            const calculatedHash = crypto.createHash('sha512').update(data).digest('hex');

            if (calculatedHash === checklist[PLATFORM_ZIP[process.platform]]) {
              console.log('Extracting zip...');

              const zip = new AdmZip('./monolith.zip');
              zip.extractAllTo('./', true);

              console.log('Deleting zip...');
              fs.unlinkSync('./monolith.zip');

              if(process.platform !== 'win32'){
                console.log('Applying chmod...');
                execSync(`chmod +x 'monolith code'`, {});
              }
            } else {
              console.error('ERROR: Checksum verification faild!', calculatedHash, checklist[PLATFORM_ZIP[process.platform]]);
              return 1;
            }
          });
        }).catch((error) => {
          console.error('ERROR: Faild to download checksum!');
          console.log(error);
          return 1;
        });
    }, 1000);
  }
} catch (error) {
  fs.writeFile('./log.txt', error, (err) => {});
}
