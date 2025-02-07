const fs = require('fs');

const BASE_PATH = `/data`;

const getContent = (filename) => {
  const file = `${BASE_PATH}/${filename}.json`;
  try {
    return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  } catch (error) {
    return '';
  }
}

const getJson = (filename) => {
  const content = getContent(filename);
  return content ? JSON.parse(content) : {};
}

const getArray = (filename) => {
  const content = getContent(filename);
  return content ? JSON.parse(content) : [];
}

const saveJson = (filename, data) => {
  const file = `${BASE_PATH}/${filename}.json`;
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const getQueue = (filename) => {
  return getArray(filename);
}

const getQueueLength = (filename) => {
  return getQueue(filename).length;
}

const getElementInQueue = (filename, getKeyFromObject, key) => {
  const queue = getQueue(filename);
  const position = queue.findIndex((item) => getKeyFromObject(item) === key);
  const returnElement = position === -1 ? null : {
    position,
    element: queue[position],
  };
  return returnElement;
}

const saveIntoQueue = (filename, object) => {
  if (!object.uuid) {
    object.uuid = crypto.randomUUID();
  }
  const file = `${BASE_PATH}/${filename}.json`;
  const data = getQueue(filename);
  data.push(object);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

const popFromQueue = (filename) => {
  const file = `${BASE_PATH}/${filename}.json`;
  const data = getQueue(filename);
  const shifted = data.shift();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return shifted;
}

const removeFromQueue = (filename, getKeyFromObject, key) => {
  const file = `${BASE_PATH}/${filename}.json`;
  const data = getQueue(filename);
  const position = data.findIndex((item) => getKeyFromObject(item) === key);
  if (position !== -1) {
    data.splice(position, 1);
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  }
}

const clearQueue = (filename) => {
  const file = `${BASE_PATH}/${filename}.json`;
  fs.writeFileSync(file, '[]');
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
  saveIntoQueue,
  popFromQueue,
  getQueue,
  getQueueLength,
  getElementInQueue,
  removeFromQueue,
  clearQueue,
}
