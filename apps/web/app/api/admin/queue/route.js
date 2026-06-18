import { clearQueue } from '@stream-toolkit/common/savedData';

const overloadQueueFilePath = 'queue';

export async function DELETE() {
  clearQueue(overloadQueueFilePath);
  
  return Response.json({ message: 'Cola de sobrecarga limpiada' });
}
