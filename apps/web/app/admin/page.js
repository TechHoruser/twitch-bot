import { StreamProvider } from "@/src/shared/StreamProvider";
import Admin from "@/src/admin/Admin";

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <StreamProvider>
      <Admin />
    </StreamProvider>
  );
}
