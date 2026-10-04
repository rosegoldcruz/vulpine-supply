/**
 * Voice hook for Vulpi (ElevenLabs clips later). Autoplay-safe: nothing plays until the visitor has
 * interacted with the page and turned the voice on; muted by default; preference is remembered.
 * Clips: public/audio/fox/manifest.json -> { "lines": { "<line id>": "<file>.mp3" } }. Missing manifest = text only.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const MUTE_KEY = 'vulpine-fox-muted';
const MANIFEST_URL = '/audio/fox/manifest.json';
/** flip to true to make the voice opt-out instead of opt-in */
export const FOX_VOICE_DEFAULT_ON = false;

export function useFoxVoice() {
  const [muted, setMuted] = useState(!FOX_VOICE_DEFAULT_ON);
  const [available, setAvailable] = useState(false);
  const clips = useRef<Record<string, string>>({});
  const audio = useRef<HTMLAudioElement | null>(null);
  const unlocked = useRef(false);

  useEffect(() => {
    const saved = localStorage.getItem(MUTE_KEY);
    if (saved !== null) setMuted(saved === '1');
    fetch(MANIFEST_URL, { cache: 'no-cache' })
      .then((r) => (r.ok && (r.headers.get('content-type') || '').includes('json') ? r.json() : null))
      .then((m) => {
        const lines = (m?.lines ?? {}) as Record<string, string>;
        clips.current = Object.fromEntries(Object.entries(lines).map(([k, v]) => [k, v.startsWith('/') ? v : `/audio/fox/${v}`]));
        setAvailable(Object.keys(clips.current).length > 0);
      })
      .catch(() => {});
    const unlock = () => (unlocked.current = true);
    window.addEventListener('pointerdown', unlock, { once: true, capture: true });
    window.addEventListener('keydown', unlock, { once: true, capture: true });
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
      audio.current?.pause();
    };
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      localStorage.setItem(MUTE_KEY, next ? '1' : '0');
      if (next) audio.current?.pause();
      return next;
    });
  }, []);

  /** Plays the clip for a line if there is one; resolves with its duration in seconds, or null (text only). */
  const say = useCallback(
    async (lineId: string): Promise<number | null> => {
      const src = clips.current[lineId];
      if (!src || muted || !unlocked.current) return null;
      audio.current?.pause();
      const a = new Audio(src);
      audio.current = a;
      try {
        await a.play();
        return Number.isFinite(a.duration) ? a.duration : null;
      } catch {
        return null; // blocked or failed: stay text-only
      }
    },
    [muted],
  );

  const stop = useCallback(() => audio.current?.pause(), []);

  return { muted, available, toggleMute, say, stop };
}
