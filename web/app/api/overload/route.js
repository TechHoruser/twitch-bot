import fs from 'fs';

const overloadCenterFilePath = '/data/overload-center.json';
const overloadQueueFilePath = '/data/queue.json';

export async function GET() {
  let isControllerClosed = false;
  let lastPayload = {};
  let lastQueue = [];

  const stream = new ReadableStream({
    start(controller) {
      const checkCenterOverload = (payload) => {
        if (JSON.stringify(payload) === JSON.stringify(lastPayload)) return;
        controller.enqueue(`event: newOverload\ndata: ${JSON.stringify(payload)}\n\n`);
      };

      const checkQueueOverload = (queue) => {
        if (lastQueue.length === 0) {
          for (const item of queue) {
            controller.enqueue(`event: newQueueElement\ndata: ${JSON.stringify(item)}\n\n`);
          }
          return;
        }

        if (queue.length === 0) {
          for (const item of lastQueue) {
            controller.enqueue(`event: dropQueueElement\ndata: ${item.uuid}\n\n`);
          }
          return;
        }

        let breakIndex = 0;
        for (let i = 0; i < lastQueue.length; i++) {
          const item = lastQueue[i];
          const found = item.uuid === queue[0]?.uuid;
          if (!found) {
            controller.enqueue(`event: dropQueueElement\ndata: ${item.uuid}\n\n`);
          } else {
            breakIndex = i;
            break;
          }
        }

        for (let i = 0; i < queue.length; i++) {
          const item = queue[i];
          const isSimilar = item.uuid === lastQueue[breakIndex + i]?.uuid;
          if (!isSimilar) {
            do {
              const item = queue[i];
              controller.enqueue(`event: newQueueElement\ndata: ${JSON.stringify(item)}\n\n`);
              i++;
            } while (i < queue.length);
            break;
          }
        }
      }

      const sendChange = () => {
        try {
          if (isControllerClosed) return;

          const center = JSON.parse(fs.readFileSync(overloadCenterFilePath, 'utf8'));
          checkCenterOverload(center);
          lastPayload = center;

          const queue = JSON.parse(fs.readFileSync(overloadQueueFilePath, 'utf8'));
          checkQueueOverload(queue);
          lastQueue = queue;

        } catch (error) {
          if (!isControllerClosed) {
            controller.enqueue(`event: error\ndata: ${error}\n\n`);
            isControllerClosed = true;
            controller.close(); // Cerrar el stream después de enviar el error
          }
        }
      };

      controller.signal?.addEventListener('abort', () => {
        isControllerClosed = true;
      });

      setInterval(sendChange, 1000);
      // fs.watchFile(filePath, sendChange);
      // sendChange();
    },
    cancel() {
      isControllerClosed = true;
    }
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
