const { clearJson, saveJson } = require("./savedData")

const queue = []

const OVERLOAD_FILE = 'overload'
const DEFAULT_DURATION = 10000

const nextOverload = (
  type,
  payload = {},
  duration = DEFAULT_DURATION,
  priority = 1,
) => {
  queue.push({ type, duration, payload, priority })
}

const processQueue = async () => {
  interval = setInterval(() => {
    if (queue.length === 0) return
    const maxPriority = Math.max(...queue.map((item) => item.priority))
    const { type, duration, payload } = queue.splice(queue.findIndex((item) => item.priority === maxPriority), 1)[0]
    
    saveJson(OVERLOAD_FILE, { type, payload })
    setTimeout(() => {
      clearJson(OVERLOAD_FILE)
    }, duration)

  }, 1000)
}

processQueue()

module.exports = {
  nextOverload,
}
