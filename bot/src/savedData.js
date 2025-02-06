const fs = require('fs');

const BASE_PATH = `/data`;

const getJson = (filename) => {
  const file = `${BASE_PATH}/${filename}.json`;
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
}

const saveJson = (filename, data) => {
  const file = `${BASE_PATH}/${filename}.json`;
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const clearJson = (filename) => {
  const file = `${BASE_PATH}/${filename}.json`;
  fs.writeFileSync(file, '{}');
}

const deleteJson = (filename) => {
  const file = `${BASE_PATH}/${filename}.json`;
  fs.unlinkSync(file);
}

module.exports = {
  getJson,
  saveJson,
  clearJson,
  deleteJson,
}
