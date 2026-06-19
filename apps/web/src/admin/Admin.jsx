'use client';
import { useState } from 'react';
import { useQueue } from '../shared/hooks/useQueue';
import { GroupButtons } from './components/GroupButtons';
import { Tabs } from './components/Tabs';
import { ScenePanel } from './components/ScenePanel';
import { MusicTab } from './music/MusicTab';
import { MusicAudio } from './music/MusicAudio';
import { MusicFloatingPlayer } from './music/MusicFloatingPlayer';
import { MusicAudioProvider } from './music/MusicAudioContext';
import { AudioPanel } from './audio/AudioPanel';
import { ChatPanel } from './chat/ChatPanel';
import { StreamPanel } from './stream/StreamPanel';
import { RegistroTab } from './stream/RegistroTab';
import { usePresence } from './stream/usePresence';
import { useBroadcastIntro } from './stream/useBroadcastIntro';

// Canal del que registrar presencia / mostrar el chat (igual que en ChatPanel).
const resolveChannel = () => {
  if (typeof window !== 'undefined') {
    const q = new URLSearchParams(window.location.search).get('channel');
    if (q) return q;
  }
  return process.env.NEXT_PUBLIC_TWITCH_CHANNEL || '';
};

// Normaliza al formato nuevo (accounts[]) soportando también el antiguo.
const getAccounts = (element) =>
  element.accounts
  ?? (element.chessUser ? [{ provider: element.provider, chessUser: element.chessUser, ratings: element.ratings }] : []);

const formatAccount = (account) => {
  const ratings = account?.ratings ?? {};
  return {
    provider: account?.provider,
    chessUser: account?.chessUser,
    rating: {
      bullet: ratings.bullet?.rating ?? 'N/A',
      blitz: ratings.blitz?.rating ?? 'N/A',
      rapid: ratings.rapid?.rating ?? 'N/A',
    },
  };
};

function QueueList({ data }) {
  return (
    <ul className="w-full">
      {data.map((item) => {
        if (item.state === 'hide') return null;
        const accounts = getAccounts(item).map(formatAccount);
        return (
          <li key={item.uuid} className="mb-2">
            <p className="font-bold">{item.username}</p>
            {accounts.map((account, i) => (
              <div className="flex gap-4 pl-4" key={account.provider ?? i}>
                <p className="text-sm opacity-70">{account.provider}</p>
                <p>{account.chessUser}</p>
                <div className="flex gap-1">
                  <p>{account.rating.bullet}</p><span>|</span>
                  <p>{account.rating.blitz}</p><span>|</span>
                  <p>{account.rating.rapid}</p>
                </div>
              </div>
            ))}
          </li>
        );
      })}
    </ul>
  );
}

function ScenesTab({ data }) {
  return (
    <div className="flex flex-col gap-4 items-center">
      <ScenePanel />
      <GroupButtons
        title="Cola"
        buttons={[
          { onClick: () => fetch('/api/admin/queue/pop', { method: 'GET' }), text: 'Siguiente' },
          { onClick: () => fetch('/api/admin/queue', { method: 'DELETE' }), text: 'Limpiar', confirm: true },
        ]}
      />
      <div className="w-full rounded-lg p-4 bg-white/5">
        <h2 className="text-lg font-semibold mb-2">Cola de jugadores</h2>
        <QueueList data={data} />
      </div>
    </div>
  );
}

export default function Admin() {
  const { data } = useQueue();
  const [activeTab, setActiveTab] = useState('scenes');
  // Registro de presencia siempre activo (independiente de la pestaña abierta) para
  // no perder entradas/salidas del chat mientras se navega por el panel.
  const [channel] = useState(resolveChannel);
  const { count: presentCount } = usePresence(channel);
  // Intro/cuenta atrás del directo: siempre montado para que el auto-paso a la
  // escena principal ocurra aunque no estés en la pestaña Directo.
  const intro = useBroadcastIntro();

  const tabs = [
    { key: 'stream', label: '📡 Directo', content: <StreamPanel presentCount={presentCount} intro={intro} /> },
    { key: 'scenes', label: '🎬 Escenas', content: <ScenesTab data={data} /> },
    { key: 'audio', label: '🎚️ Audio', content: <AudioPanel /> },
    { key: 'music', label: '🎵 Música', content: <MusicTab /> },
    { key: 'registro', label: '🗒️ Registro', content: <RegistroTab /> },
  ];

  return (
    <MusicAudioProvider>
    <main className="flex h-screen w-screen bg-neutral-900 text-white overflow-hidden">
      {/* Reproductor de audio siempre montado (no se corta al cambiar de tab) */}
      <MusicAudio />

      {/* Mini-player flotante visible en todas las tabs excepto Música */}
      {activeTab !== 'music' && (
        <MusicFloatingPlayer onOpen={() => setActiveTab('music')} />
      )}

      {/* Chat + moderación: siempre visible */}
      <aside className="w-[38%] min-w-[320px] border-r border-white/10 p-3">
        <ChatPanel />
      </aside>

      {/* Controles en pestañas */}
      <section className="flex-1 min-w-0">
        <Tabs tabs={tabs} active={activeTab} onTabChange={setActiveTab} />
      </section>
    </main>
    </MusicAudioProvider>
  );
}
