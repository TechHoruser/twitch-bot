'use client';
import { useState } from 'react';

// Pestañas simples (estado local). tabs: [{ key, label, content }].
export function Tabs({ tabs, initial }) {
  const [active, setActive] = useState(initial || tabs[0]?.key);
  const current = tabs.find((t) => t.key === active);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex gap-1 p-2 border-b border-white/10 shrink-0 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`px-3 py-1.5 rounded font-semibold text-sm transition ${
              active === t.key ? 'bg-emerald-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white/80'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-4">{current?.content}</div>
    </div>
  );
}
