'use client';

/**
 * Vulpi, the configurator guide. Sits in the corner (idle + the odd wave), wakes on the visitor's first
 * gesture, narrates style -> finish -> hardware, reacts to picks, and turns "Request a quote" into a short
 * conversation that submits through /api/request-bid. Never quotes prices. See docs/fox.md.
 */
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { FoxMove } from './clips';
import type { FoxStage } from './stage';
import { LINES, finishBucket, type FoxLine } from './script';
import { useFoxVoice } from './voice';
import { QuoteChat, type ChatMsg } from './QuoteChat';
import s from './FoxGuide.module.css';

export const FOX_DISMISSED_KEY = 'vulpine-fox-dismissed';
const FOX_SEEN_KEY = 'vulpine-fox-seen';
export const FOX_EVENT = 'vulpine-fox';

export interface FoxSelection {
  style: string;
  color: string;
  hw: string;
  finish: string;
  doors: 'pull' | 'knob';
  view: 'photo' | '3d';
}

export interface FoxGuideProps {
  selection: FoxSelection;
  /** Human-readable design summary that goes into the quote request (same text as the /request-bid prefill). */
  quoteMessage: string;
  designRef: string;
  designLabel: string;
  summaryHref: string;
  fullFormHref: string;
}

export interface FoxGuideHandle {
  /** Opens the conversational quote capture. Returns false when Vulpi is dismissed/unavailable (caller falls back to /request-bid). */
  openQuote: () => boolean;
  restore: () => void;
}

type ActionId = 'tour' | 'quiet' | 'quote' | 'explore';
interface Say {
  line: FoxLine;
  actions?: { id: ActionId; label: string; primary?: boolean }[];
}

/** Seconds a line stays "spoken" when there is no audio clip. */
const estimate = (text: string) => Math.min(9, Math.max(2.6, text.split(/\s+/).length * 0.33 + 0.9));

export const FoxGuide = forwardRef<FoxGuideHandle, FoxGuideProps>(function FoxGuide(props, ref) {
  const { selection } = props;
  const [ready, setReady] = useState(false); // client + storage read
  const [dismissed, setDismissed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [awake, setAwake] = useState(false);
  const [bubble, setBubble] = useState<Say | null>(null);
  const [talking, setTalking] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatLog, setChatLog] = useState<ChatMsg[]>([]);
  const [reduced, setReduced] = useState(false);
  const voice = useFoxVoice();

  const hostRef = useRef<HTMLDivElement>(null);
  const stage = useRef<FoxStage | null>(null);
  const timers = useRef<number[]>([]);
  const awakeRef = useRef(false);
  const chatRef = useRef(false);
  const said = useRef(new Set<string>());
  const touched = useRef({ style: false, finish: false, hardware: false });
  const prev = useRef<FoxSelection | null>(null);
  const priorityUntil = useRef(0);
  const pending = useRef<{ t: number; changes: Set<keyof FoxSelection> } | null>(null);
  const reactRef = useRef<() => void>(() => {});
  chatRef.current = chatOpen;

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
  const move = (m: FoxMove) => stage.current?.play(m);

  // ------------------------------------------------------------------ storage + reduced motion
  useEffect(() => {
    setDismissed(localStorage.getItem(FOX_DISMISSED_KEY) === '1');
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    setReady(true);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    stage.current?.setReducedMotion(reduced);
  }, [reduced, loaded]);

  // ------------------------------------------------------------------ lazy 3D stage
  useEffect(() => {
    if (!ready || dismissed || !hostRef.current) return;
    let cancelled = false;
    const start = () =>
      import('./stage')
        .then(async ({ FoxStage }) => {
          if (cancelled || !hostRef.current) return;
          const st = new FoxStage(hostRef.current);
          stage.current = st;
          st.setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
          await st.load();
          if (!cancelled) setLoaded(true);
        })
        .catch((e) => console.warn('[fox] 3D guide unavailable, showing poster', e));
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    const id = w.requestIdleCallback ? w.requestIdleCallback(start, { timeout: 2500 }) : window.setTimeout(start, 1200);
    return () => {
      cancelled = true;
      if (w.requestIdleCallback && (window as any).cancelIdleCallback) (window as any).cancelIdleCallback(id);
      else window.clearTimeout(id);
      stage.current?.dispose();
      stage.current = null;
      setLoaded(false);
    };
  }, [ready, dismissed]);

  // corner presence: an occasional wave until someone says hi (never with reduced motion)
  useEffect(() => {
    if (!loaded || awake || reduced) return;
    let n = 0;
    const first = window.setTimeout(() => move('wave'), 1800);
    const iv = window.setInterval(() => {
      if (++n > 3) return window.clearInterval(iv);
      move('wave');
    }, 16000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(iv);
    };
  }, [loaded, awake, reduced]);

  // ------------------------------------------------------------------ speaking
  const speak = useCallback(
    (seq: Say[], opts: { priority?: boolean; keep?: boolean } = {}) => {
      clearTimers();
      voice.stop();
      const step = async (i: number) => {
        const item = seq[i];
        if (!item) return;
        said.current.add(item.line.id);
        setBubble(item);
        const gesture = item.line.move && item.line.move !== 'talk' && item.line.move !== 'idle' ? item.line.move : null;
        move(gesture ?? 'talk');
        setTalking(true);
        const secs = (await voice.say(item.line.id)) ?? estimate(item.line.text);
        if (opts.priority) priorityUntil.current = Date.now() + secs * 1000;
        if (!gesture) later(() => move('idle'), secs * 1000);
        later(() => setTalking(false), secs * 1000);
        if (i + 1 < seq.length) later(() => step(i + 1), secs * 1000 + 450);
        else if (!opts.keep && !item.actions && !chatRef.current) later(() => setBubble(null), secs * 1000 + 9000);
      };
      step(0);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [voice.say, voice.stop],
  );

  // ------------------------------------------------------------------ wake on first gesture
  const wake = useCallback(() => {
    if (awakeRef.current) return;
    awakeRef.current = true;
    setAwake(true);
    if (chatRef.current) return;
    const back = localStorage.getItem(FOX_SEEN_KEY) === '1';
    localStorage.setItem(FOX_SEEN_KEY, '1');
    speak(
      [
        {
          line: back ? LINES.helloBack : LINES.hello,
          actions: back
            ? undefined
            : [
                { id: 'tour', label: 'Show me around', primary: true },
                { id: 'quiet', label: "I'm just browsing" },
              ],
        },
      ],
      { priority: true },
    );
  }, [speak]);

  useEffect(() => {
    if (!ready || dismissed) return;
    const onGesture = () => window.setTimeout(wake, 0);
    window.addEventListener('pointerdown', onGesture, { capture: true, once: true });
    window.addEventListener('keydown', onGesture, { capture: true, once: true });
    return () => {
      window.removeEventListener('pointerdown', onGesture, { capture: true });
      window.removeEventListener('keydown', onGesture, { capture: true });
    };
  }, [ready, dismissed, wake]);

  // ------------------------------------------------------------------ react to picks (debounced, no repeats)
  const react = useCallback(() => {
    const p = pending.current;
    if (p && Date.now() < priorityUntil.current) {
      // let the hello finish first (the waking click is often itself a pick)
      p.t = window.setTimeout(() => reactRef.current(), priorityUntil.current - Date.now() + 300);
      return;
    }
    pending.current = null;
    if (!p || chatRef.current || !awakeRef.current) return;
    const sel = prev.current!;
    const c = p.changes;
    const out: Say[] = [];
    const fresh = (l: FoxLine | undefined) => l && !said.current.has(l.id) && out.push({ line: l });
    if (c.has('style')) {
      touched.current.style = true;
      fresh(LINES.style[sel.style]);
    } else if (c.has('color')) {
      touched.current.finish = true;
      fresh(LINES.finish[finishBucket(sel.color)]);
    } else if (c.has('hw')) {
      touched.current.hardware = true;
      fresh(LINES.hardware[sel.hw]);
    } else if (c.has('finish')) {
      touched.current.hardware = true;
      fresh(LINES.hwFinish[sel.finish]);
    } else if (c.has('doors')) {
      touched.current.hardware = true;
      fresh(sel.doors === 'knob' ? LINES.knobs : LINES.pulls);
    } else if (c.has('view') && sel.view === '3d') {
      fresh(LINES.view3d);
    }
    const t = touched.current;
    if (t.style && t.finish && t.hardware && !said.current.has(LINES.allSet.id)) {
      out.push({
        line: LINES.allSet,
        actions: [
          { id: 'quote', label: 'Get my custom quote', primary: true },
          { id: 'explore', label: 'Keep exploring' },
        ],
      });
    } else if (c.has('style') && !t.finish) fresh(LINES.nextFinish);
    else if ((c.has('color') || (c.has('style') && t.finish)) && !t.hardware) fresh(LINES.nextHardware);
    if (out.length) speak(out);
  }, [speak]);
  reactRef.current = react;

  useEffect(() => {
    const before = prev.current;
    prev.current = selection;
    if (!before) return;
    const changed = (Object.keys(selection) as (keyof FoxSelection)[]).filter((k) => selection[k] !== before[k]);
    if (!changed.length) return; // awake is checked when the debounce fires (the waking click may itself be a pick)
    const p = pending.current ?? { t: 0, changes: new Set() };
    changed.forEach((k) => p.changes.add(k));
    pending.current = p;
    window.clearTimeout(p.t);
    const wait = Math.max(650, priorityUntil.current - Date.now() + 300);
    p.t = window.setTimeout(react, wait);
  }, [selection, react]);

  // ------------------------------------------------------------------ actions, dismissal, quote
  const onAction = (id: ActionId) => {
    if (id === 'tour') speak([{ line: LINES.startStyle }]);
    if (id === 'quiet') speak([{ line: LINES.quiet }]);
    if (id === 'explore') {
      setBubble(null);
      move('idle');
    }
    if (id === 'quote') openQuote();
  };

  const foxSays = useCallback(
    (line: FoxLine) => {
      setChatLog((log) => [...log, { from: 'fox', text: line.text, id: line.id }]);
      const gesture = line.move && line.move !== 'talk' && line.move !== 'idle' ? line.move : null;
      move(gesture ?? 'talk');
      setTalking(true);
      clearTimers();
      voice.say(line.id).then((d) => {
        const secs = d ?? estimate(line.text);
        if (!gesture) later(() => move('idle'), secs * 1000);
        later(() => setTalking(false), secs * 1000);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [voice.say],
  );

  const openQuote = useCallback(() => {
    if (dismissed || !ready) return false;
    awakeRef.current = true;
    setAwake(true);
    setBubble(null);
    setChatOpen(true);
    if (!chatLog.length) {
      foxSays(LINES.qIntro);
      window.setTimeout(() => foxSays(LINES.qName), 900);
    }
    return true;
  }, [dismissed, ready, chatLog.length, foxSays]);

  const dismiss = () => {
    clearTimers();
    voice.stop();
    localStorage.setItem(FOX_DISMISSED_KEY, '1');
    setDismissed(true);
    setChatOpen(false);
    setBubble(null);
    window.dispatchEvent(new CustomEvent(FOX_EVENT, { detail: { dismissed: true } }));
  };

  const restore = useCallback(() => {
    localStorage.removeItem(FOX_DISMISSED_KEY);
    setDismissed(false);
    awakeRef.current = true;
    setAwake(true);
    window.dispatchEvent(new CustomEvent(FOX_EVENT, { detail: { dismissed: false } }));
    window.setTimeout(() => speak([{ line: LINES.helloBack }]), 1500);
  }, [speak]);

  useImperativeHandle(ref, () => ({ openQuote, restore }), [openQuote, restore]);

  useEffect(() => () => clearTimers(), []);

  if (!ready || dismissed) return null;

  return (
    <div className={cn(s.root, chatOpen && s.chatting, reduced && s.reduced)} data-fox-guide="">
      {bubble && !chatOpen && (
        <div className={s.bubble} role="status" aria-live="polite">
          <p className={s.bubbleText}>{bubble.line.text}</p>
          {bubble.actions && (
            <div className={s.bubbleActions}>
              {bubble.actions.map((a) => (
                <button key={a.id} type="button" className={cn(s.bubbleBtn, a.primary && s.bubbleBtnPrimary)} onClick={() => onAction(a.id)}>
                  {a.label}
                </button>
              ))}
            </div>
          )}
          <button type="button" className={s.bubbleClose} aria-label="Hide message" onClick={() => setBubble(null)}>
            ×
          </button>
        </div>
      )}

      {chatOpen && (
        <QuoteChat
          log={chatLog}
          setLog={setChatLog}
          foxSays={foxSays}
          onCelebrate={() => move('celebrate')}
          onClose={() => {
            setChatOpen(false);
            move('idle');
          }}
          quoteMessage={props.quoteMessage}
          designRef={props.designRef}
          designLabel={props.designLabel}
          summaryHref={props.summaryHref}
          fullFormHref={props.fullFormHref}
        />
      )}

      <div className={s.foxWrap}>
        <button
          type="button"
          className={cn(s.fox, loaded && s.foxLoaded, talking && s.foxTalking)}
          aria-label={chatOpen ? 'Vulpi, your design guide' : 'Vulpi, your design guide. Tap for help'}
          onClick={() => {
            if (chatOpen) return;
            if (!awakeRef.current) return wake();
            if (bubble) return setBubble(null);
            speak([{ line: touched.current.style ? LINES.allSet : LINES.startStyle, actions: touched.current.style ? [{ id: 'quote', label: 'Get my custom quote', primary: true }] : undefined }]);
          }}
        >
          <span ref={hostRef} className={s.canvasHost} />
        </button>
        <div className={s.tools}>
          {voice.available && (
            <button type="button" className={s.tool} aria-pressed={!voice.muted} aria-label={voice.muted ? 'Turn on Vulpi’s voice' : 'Mute Vulpi'} onClick={voice.toggleMute}>
              {voice.muted ? '🔇' : '🔊'}
            </button>
          )}
          <button type="button" className={s.tool} aria-label="Dismiss Vulpi the guide" title="Dismiss guide" onClick={dismiss}>
            ×
          </button>
        </div>
      </div>
    </div>
  );
});

export default FoxGuide;
