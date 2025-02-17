const { clearJson, saveJson, pushIntoQueue, popFromQueue } = require("./savedData")

const OVERLOAD_CENTER_FILE = 'overload-center'
const OVERLOAD_CENTER_QUEUE_FILE = 'overload-center-queue'
const DEFAULT_DURATION = 10000

const nextOverload = (
  type,
  payload = {},
  duration = DEFAULT_DURATION,
  priority = 1,
) => {
  pushIntoQueue(OVERLOAD_CENTER_QUEUE_FILE, { type, payload, duration }, priority)
}

const processQueue = async () => {
  interval = setInterval(() => {
    const nextItem = popFromQueue(OVERLOAD_CENTER_QUEUE_FILE)

    if (!nextItem) return

    const { type, duration, payload } = nextItem
    
    saveJson(OVERLOAD_CENTER_FILE, { type, payload })
    setTimeout(() => {
      clearJson(OVERLOAD_CENTER_FILE)
    }, duration)

  }, 1000)
}

processQueue()

module.exports = {
  nextOverload,
}
