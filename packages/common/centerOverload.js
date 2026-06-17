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

// Procesa un único elemento de la cola de overloads. Devuelve el elemento
// procesado (o null si la cola estaba vacía). Lo muestra en el centro y lo
// limpia pasada su duración.
const processNext = () => {
  const nextItem = popFromQueue(OVERLOAD_CENTER_QUEUE_FILE)

  if (!nextItem) return null

  const { type, duration, payload } = nextItem

  saveJson(OVERLOAD_CENTER_FILE, { type, payload })
  setTimeout(() => {
    clearJson(OVERLOAD_CENTER_FILE)
  }, duration)

  return nextItem
}

let interval = null
const processQueue = () => {
  interval = setInterval(processNext, 1000)
  return interval
}

const stopProcessingQueue = () => {
  if (interval) {
    clearInterval(interval)
    interval = null
  }
}

// Evita arrancar el bucle (y su setInterval) durante la ejecución de tests.
if (process.env.NODE_ENV !== 'test') {
  processQueue()
}

module.exports = {
  nextOverload,
  processNext,
  processQueue,
  stopProcessingQueue,
  OVERLOAD_CENTER_FILE,
  OVERLOAD_CENTER_QUEUE_FILE,
}
