import fs from 'fs';

const filePath = '/data/overload.json';

export async function GET() {
  let isControllerClosed = false;
  let lastData = null;

  const stream = new ReadableStream({
    start(controller) {
      const sendChange = () => {
        if (isControllerClosed) return;
        
        try {
          const data = fs.readFileSync(filePath, 'utf8');
          const payload = JSON.parse(data);
          if (JSON.stringify(payload) === JSON.stringify(lastData)) return;
          controller.enqueue(`event: newOverload\ndata: ${JSON.stringify(payload)}\n\n`);
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

      fs.watchFile(filePath, sendChange);
      sendChange();
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
