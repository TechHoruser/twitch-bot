import { popFromQueue } from '@stream-toolkit/common/savedData';
import { nextOverload } from '@stream-toolkit/common/centerOverload';

const overloadQueueFilePath = 'queue';

export async function GET() {
  const nextInQueue = popFromQueue(overloadQueueFilePath);

  if (!nextInQueue) {
    return Response.json({ error: 'No hay elementos en la cola' }, { status: 404 });
  }

  nextOverload('next-match', nextInQueue);
  
  return Response.json(nextInQueue);
}
