import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

export interface Palette {
  bg: string;
  panel: string;
  text: string;
  muted: string;
  border: string;
  accent: string;
  accentBg: string;
  onAccent: string;
  danger: string;
  success: string;
}

const light: Palette = {
  bg: '#f4f6f9',
  panel: '#ffffff',
  text: '#1e293b',
  muted: '#64748b',
  border: '#e2e8f0',
  accent: '#3b82f6',
  accentBg: 'rgba(59,130,246,0.1)',
  onAccent: '#ffffff',
  danger: '#ef4444',
  success: '#16a34a',
};

const dark: Palette = {
  bg: '#080c14',
  panel: '#111827',
  text: '#f3f4f6',
  muted: '#9ca3af',
  border: '#374151',
  accent: '#60a5fa',
  accentBg: 'rgba(96,165,250,0.14)',
  onAccent: '#0b1220',
  danger: '#f87171',
  success: '#4ade80',
};

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeCtx {
  colors: Palette;
  isDark: boolean;
  mode: ThemeMode;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>({
  colors: light,
  isDark: false,
  mode: 'system',
  toggle: () => {},
});

const KEY = 'rida:theme-mode';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === 'light' || v === 'dark') setMode(v);
      })
      .catch(() => {});
  }, []);

  const isDark = mode === 'system' ? system === 'dark' : mode === 'dark';

  const toggle = useCallback(() => {
    const next: ThemeMode = isDark ? 'light' : 'dark';
    setMode(next);
    AsyncStorage.setItem(KEY, next).catch(() => {});
  }, [isDark]);

  const value = useMemo(
    () => ({ colors: isDark ? dark : light, isDark, mode, toggle }),
    [isDark, mode, toggle],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);

/** Reader page themes, mirroring the desktop app. */
export interface ReaderThemeDef {
  id: string;
  name: string;
  bg: string;
  text: string;
  border: string;
}

export const READER_THEMES: ReaderThemeDef[] = [
  { id: 'light', name: 'Light', bg: '#ffffff', text: '#1e293b', border: '#e2e8f0' },
  { id: 'dark', name: 'Dark', bg: '#111827', text: '#f3f4f6', border: '#374151' },
  { id: 'sepia', name: 'Sepia', bg: '#faf5e6', text: '#433422', border: '#d4c4ac' },
  { id: 'charcoal', name: 'Charcoal', bg: '#27272a', text: '#f4f4f5', border: '#3f3f46' },
  { id: 'emerald', name: 'Emerald', bg: '#0b231e', text: '#e6f4ea', border: '#1e4632' },
];

/** Build an epub.js theme object for the reader WebView. */
export function buildEpubTheme(t: ReaderThemeDef, lineHeight: number) {
  const color = `${t.text} !important`;
  const text = { color };
  return {
    body: { background: `${t.bg} !important`, color },
    p: { color, 'line-height': `${lineHeight} !important` },
    span: text,
    li: text,
    div: text,
    h1: text,
    h2: text,
    h3: text,
    h4: text,
    h5: text,
    h6: text,
    a: { color, 'pointer-events': 'auto', cursor: 'pointer' },
    '::selection': { background: 'lightskyblue' },
  };
}
