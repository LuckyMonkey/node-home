import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

const CONTROL_MODE_KEY = 'nodehome-controls-visible-v1';
const PROFILE_KEY = 'nodehome-profile-v1';

function readProfileName() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    return String(parsed?.name || '').trim();
  } catch {
    return '';
  }
}

function DashboardControls() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(() => readProfileName());
  const [manageMode, setManageMode] = useState(() => localStorage.getItem(CONTROL_MODE_KEY) === '1');

  useEffect(() => {
    document.body.classList.toggle('controls-hidden', !manageMode);
    localStorage.setItem(CONTROL_MODE_KEY, manageMode ? '1' : '0');
    window.dispatchEvent(new CustomEvent('dashboard:controls-mode', { detail: { visible: manageMode } }));
  }, [manageMode]);

  const debouncedName = useMemo(() => name.trim(), [name]);
  useEffect(() => {
    const safe = debouncedName.slice(0, 24);
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify({ name: safe, updatedAt: Date.now() }));
    } catch {}
    window.dispatchEvent(new CustomEvent('dashboard:profile-name', { detail: { name: safe } }));
  }, [debouncedName]);

  return (
    <div style={{ position: 'fixed', top: 8, right: 10, zIndex: 40 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          border: '1px solid rgba(0,0,0,.25)',
          background: 'rgba(255,255,255,.68)',
          borderRadius: 999,
          width: 30,
          height: 30,
          cursor: 'pointer'
        }}
        title="Dashboard controls"
        aria-label="Dashboard controls"
      >
        ⚙️
      </button>
      {open ? (
        <div
          style={{
            marginTop: 8,
            width: 250,
            border: '2px solid #111',
            borderRadius: 12,
            background: 'rgba(255,255,255,.96)',
            boxShadow: '6px 6px 0 rgba(0,0,0,.35)',
            padding: 10,
            display: 'grid',
            gap: 8
          }}
        >
          <label style={{ display: 'grid', gap: 4, fontSize: 12, fontWeight: 700 }}>
            Display Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
              placeholder="Your name"
              style={{ border: '2px solid #111', borderRadius: 8, minHeight: 30, padding: '4px 8px', font: 'inherit' }}
            />
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, fontWeight: 700 }}>
            <input
              type="checkbox"
              checked={manageMode}
              onChange={(e) => setManageMode(e.target.checked)}
            />
            Show Deleted + Manage
          </label>
        </div>
      ) : null}
    </div>
  );
}

const mount = document.getElementById('dashboard-react-root');
if (mount) {
  createRoot(mount).render(<DashboardControls />);
}
