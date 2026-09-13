'use client';

import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';
const KEY = 'vedryxtech-theme';
const EVENT = 'vedryxtech-theme-change';
let sessionPreference: 'light' | 'dark' | null = null;
function preference() {
  if (sessionPreference) return sessionPreference;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* Theme selection also works when browser storage is unavailable. */ }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function subscribe(callback: () => void) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const sync = () => { document.documentElement.dataset.theme = preference(); callback(); };
  const storage = (event: StorageEvent) => { if (event.key === KEY || event.key === null) { sessionPreference = null; sync(); } };
  window.addEventListener(EVENT, sync);
  window.addEventListener('storage', storage);
  media.addEventListener('change', sync);
  sync();
  return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', storage); media.removeEventListener('change', sync); };
}
const serverTheme = () => 'light' as const;
export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, preference, serverTheme);
  function toggle() {
    sessionPreference = theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem(KEY, sessionPreference); } catch { /* Keep the in-memory preference. */ }
    document.documentElement.dataset.theme = sessionPreference;
    window.dispatchEvent(new Event(EVENT));
  }
  return <button className="theme-toggle" type="button" onClick={toggle} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
    {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}<span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
  </button>;
}
