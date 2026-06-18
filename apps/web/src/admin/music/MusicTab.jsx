'use client';
import { useState } from 'react';
import { MusicPanel } from '../components/MusicPanel';
import { DownloadForm } from './DownloadForm';
import { PlaylistEditor } from './PlaylistEditor';

export function MusicTab() {
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <div className="flex flex-col gap-4">
      <MusicPanel />
      <DownloadForm onDone={() => setRefreshKey((k) => k + 1)} />
      <PlaylistEditor refreshKey={refreshKey} />
    </div>
  );
}
