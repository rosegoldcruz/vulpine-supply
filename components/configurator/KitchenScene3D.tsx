'use client';

import { useEffect, useRef, useState } from 'react';
import type { CameraPreset, ConfiguratorEngine, EngineMode, EngineState, LoadProgress } from './scene/engine';
import { cn } from '@/lib/utils';
import styles from './CabinetConfigurator.module.css';

interface Props extends EngineState {
  /** accessible description of the current configuration */
  description: string;
  onModeChange?: (mode: EngineMode, detail?: string) => void;
  /** called with the engine once the first configuration has rendered, and with null on unmount */
  onEngine?: (engine: ConfiguratorEngine | null) => void;
}

/** short = label on phones, so all five fit in one row */
const PRESETS: { id: CameraPreset; label: string; short?: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'uppers', label: 'Uppers' },
  { id: 'island', label: 'Island' },
  { id: 'sink', label: 'Sink wall', short: 'Sink' },
  { id: 'door', label: 'Close-up door', short: 'Close-up' },
];

/** 3D kitchen: DevGod's GLBs when present in public/models/configurator, procedural otherwise. */
export default function KitchenScene3D(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ConfiguratorEngine | null>(null);
  const readyRef = useRef(false);
  const latest = useRef<EngineState>(props);
  latest.current = props;
  const [status, setStatus] = useState<{ mode: EngineMode; detail?: string }>({ mode: 'loading' });
  const [progress, setProgress] = useState<LoadProgress | null>(null);
  const [preset, setPreset] = useState<CameraPreset>('overview');
  const [available, setAvailable] = useState<CameraPreset[]>(['overview', 'uppers', 'island', 'door']);
  const { onModeChange, onEngine } = props;

  useEffect(() => {
    let cancelled = false;
    let engine: ConfiguratorEngine | null = null;
    // read before the configurator rewrites the query string
    const debug = new URLSearchParams(window.location.search).get('debug') === '1';
    (async () => {
      try {
        const { ConfiguratorEngine } = await import('./scene/engine');
        if (cancelled || !hostRef.current) return;
        engine = new ConfiguratorEngine(hostRef.current);
        engine.onMode = (mode, detail) => {
          setStatus({ mode, detail });
          onModeChange?.(mode, detail);
        };
        engine.onProgress = (p) => setProgress(p.done ? null : p);
        engineRef.current = engine;
        await engine.init();
        if (cancelled) return;
        readyRef.current = true;
        await engine.update(latest.current);
        if (!cancelled) setAvailable(engine.availablePresets());
        if (!cancelled) onEngine?.(engine);
        if (!cancelled && debug) {
          (window as any).__vulpineConfigurator = { engine, ar: () => import('./scene/ar') };
        }
      } catch (e) {
        console.error('[configurator] 3D view unavailable', e);
        if (!cancelled) {
          setStatus({ mode: 'error', detail: 'Your browser could not start the 3D view.' });
          onModeChange?.('error');
        }
      }
    })();
    return () => {
      cancelled = true;
      readyRef.current = false;
      engineRef.current = null;
      onEngine?.(null);
      engine?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { styleId, finishId, finish, hwStyle, hwFinishId, hwFinish, doorHardware, knobShape, showIsland } = props;
  useEffect(() => {
    if (readyRef.current && engineRef.current) {
      engineRef.current.update({ styleId, finishId, finish, hwStyle, hwFinishId, hwFinish, doorHardware, knobShape, showIsland });
    }
  }, [styleId, finishId, finish, hwStyle, hwFinishId, hwFinish, doorHardware, knobShape, showIsland]);

  useEffect(() => {
    if (!showIsland && preset === 'island') {
      setPreset('overview');
      engineRef.current?.setPreset('overview');
    }
  }, [showIsland, preset]);

  const go = (p: CameraPreset) => {
    if (engineRef.current?.setPreset(p)) setPreset(p);
  };
  const pct = progress?.fraction != null ? Math.round(progress.fraction * 100) : null;
  const ready = status.mode === 'glb' || status.mode === 'procedural';

  return (
    <div className={styles.scene3d}>
      <div
        ref={hostRef}
        className={styles.scene3dCanvas}
        role="img"
        tabIndex={0}
        aria-label={`3D preview: ${props.description}. Drag to orbit, scroll or pinch to zoom; arrow keys pan, Shift plus arrow keys orbit.`}
      />
      {status.mode === 'loading' && !progress && <div className={styles.sceneNote}>Loading 3D kitchen…</div>}
      {status.mode === 'error' && <div className={styles.sceneNote}>{status.detail}</div>}
      {progress && (
        <div className={styles.progress} role="status" aria-live="polite">
          <span>
            {progress.label}
            {pct != null ? ` · ${pct}%` : '…'}
          </span>
          <span
            className={styles.progressTrack}
            role="progressbar"
            aria-label={progress.label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct ?? undefined}
          >
            <span className={cn(styles.progressBar, pct == null && styles.progressIndeterminate)} style={pct != null ? { width: `${pct}%` } : undefined} />
          </span>
        </div>
      )}
      {ready && (
        <div className={styles.presets} role="group" aria-label="Camera views">
          {PRESETS.filter((p) => available.includes(p.id)).map((p) => (
            <button
              key={p.id}
              type="button"
              className={cn(styles.presetBtn, preset === p.id && styles.presetBtnActive)}
              aria-pressed={preset === p.id}
              disabled={p.id === 'island' && !showIsland}
              onClick={() => go(p.id)}
              aria-label={p.short ? p.label : undefined}
            >
              {p.short ? (
                <>
                  <span className={styles.presetLong}>{p.label}</span>
                  <span className={styles.presetShort} aria-hidden="true">
                    {p.short}
                  </span>
                </>
              ) : (
                p.label
              )}
            </button>
          ))}
        </div>
      )}
      <p className={styles.sceneHint} aria-hidden="true">
        Drag to orbit · scroll or pinch to zoom
      </p>
    </div>
  );
}
