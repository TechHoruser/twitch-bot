import fs from 'fs';
import { getScene } from '@stream-toolkit/common/scene';
import { getMusic, currentTrack, playlistNames } from '@stream-toolkit/common/music';
import { getSound } from '@stream-toolkit/common/sound';

const DATA_PATH = process.env.DATA_PATH || '/data';
const overloadCenterFilePath = `${DATA_PATH}/overload-center.json`;
const overloadQueueFilePath = `${DATA_PATH}/queue.json`;

export async function GET() {
  let isControllerClosed = false;
  let lastPayload = {};
  let lastQueue = [];
  let lastScene = null;
  let lastMusic = null;
  let lastSound = null;

  let intervalId = null;

  const stream = new ReadableStream({
    start(controller) {
      const checkCenterOverload = (payload) => {
        if (JSON.stringify(payload) === JSON.stringify(lastPayload)) return;
        controller.enqueue(`event: newOverload\ndata: ${JSON.stringify(payload)}\n\n`);
      };

      const checkQueueOverload = (queue) => {
        for (const item of lastQueue) {
          const found = queue.find((element) => element.uuid === item.uuid);
          if (!found) {
            controller.enqueue(`event: dropQueueElement\ndata: ${item.uuid}\n\n`);
          }
        }

        for (const item of queue) {
          const found = lastQueue.find((element) => element.uuid === item.uuid);
          if (!found) {
            controller.enqueue(`event: newQueueElement\ndata: ${JSON.stringify(item)}\n\n`);
          }
        }
      }

      const checkScene = (scene) => {
        if (JSON.stringify(scene) === JSON.stringify(lastScene)) return;
        controller.enqueue(`event: sceneChange\ndata: ${JSON.stringify(scene)}\n\n`);
      };

      const checkMusic = (music) => {
        if (JSON.stringify(music) === JSON.stringify(lastMusic)) return;
        controller.enqueue(`event: musicState\ndata: ${JSON.stringify(music)}\n\n`);
      };

      const checkSound = (sound) => {
        if (JSON.stringify(sound) === JSON.stringify(lastSound)) return;
        controller.enqueue(`event: playSound\ndata: ${JSON.stringify(sound)}\n\n`);
      };

      const sendChange = () => {
        try {
          if (isControllerClosed) return;

          const center = JSON.parse(fs.readFileSync(overloadCenterFilePath, 'utf8'));
          checkCenterOverload(center);
          lastPayload = center;

          const queue = JSON.parse(fs.readFileSync(overloadQueueFilePath, 'utf8'));
          checkQueueOverload(queue);
          lastQueue = queue;

          const scene = getScene();
          checkScene(scene);
          lastScene = scene;

          const m = getMusic();
          const music = { ...m, track: currentTrack(m), playlists: playlistNames() };
          checkMusic(music);
          lastMusic = music;

          const sound = getSound();
          checkSound(sound);
          lastSound = sound;

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
        if (intervalId) clearInterval(intervalId);
      });

      intervalId = setInterval(sendChange, 1000);
      // fs.watchFile(filePath, sendChange);
      // sendChange();
    },
    cancel() {
      isControllerClosed = true;
      if (intervalId) clearInterval(intervalId);
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
