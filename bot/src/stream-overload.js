const { deleteJson, saveJson } = require("./savedData")

const queue = []

const OVERLOAD_FILE = 'overload'
const DEFAULT_DURATION = 10000

const nextOverload = (
  type,
  duration = DEFAULT_DURATION,
  payload = {},
  priority = 1,
) => {
  queue.push({ type, duration, payload, priority })
}

const processQueue = async () => new Promise((resolve) => {
  while (true) {
    const maxPriority = Math.max(...queue.map((item) => item.priority))
    const { type, duration, payload } = queue.splice(queue.findIndex((item) => item.priority === maxPriority), 1)[0]
    
    saveJson(OVERLOAD_FILE, { type, payload })
    setTimeout(() => {
      deleteJson(OVERLOAD_FILE)
    }, duration)
  }
})

module.exports = {
  nextOverload,
  processQueue,
}
