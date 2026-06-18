import { StreamProvider } from "@/src/shared/StreamProvider";
import Stage from "@/src/stage/Stage";

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <StreamProvider>
      <Stage />
    </StreamProvider>
  );
}
