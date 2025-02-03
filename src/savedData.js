const fs = require('fs');

const BASE_PATH = `${__dirname}/../data`;

const getJson = (filename) => {
  const file = `${BASE_PATH}/${filename}.json`;
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
}

const saveJson = (filename, data) => {
  const file = `${BASE_PATH}/${filename}.json`;
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

module.exports = {
  getJson,
  saveJson,
}
