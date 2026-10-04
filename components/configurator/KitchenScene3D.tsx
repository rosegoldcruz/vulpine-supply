'use client';

import { useEffect, useRef, useState } from 'react';
import type { ConfiguratorEngine, EngineMode, EngineState } from './scene/engine';
import styles from './CabinetConfigurator.module.css';

interface Props extends EngineState {
  onModeChange?: (mode: EngineMode, detail?: string) => void;
}

/** 3D kitchen: DevGod's GLBs when present in public/models/configurator, procedural otherwise. */
export default function KitchenScene3D(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ConfiguratorEngine | null>(null);
  const readyRef = useRef(false);
  const latest = useRef<EngineState>(props);
  latest.current = props;
  const [status, setStatus] = useState<{ mode: EngineMode; detail?: string }>({ mode: 'loading' });
  const onModeChange = props.onModeChange;

  useEffect(() => {
    let cancelled = false;
    let engine: ConfiguratorEngine | null = null;
    (async () => {
      try {
        const { ConfiguratorEngine } = await import('./scene/engine');
        if (cancelled || !hostRef.current) return;
        engine = new ConfiguratorEngine(hostRef.current);
        engine.onMode = (mode, detail) => {
          setStatus({ mode, detail });
          onModeChange?.(mode, detail);
        };
        engineRef.current = engine;
        await engine.init();
        if (cancelled) return;
        readyRef.current = true;
        await engine.update(latest.current);
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
      engine?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { styleId, finishId, finish, hwStyle, hwFinish, doorHardware, showIsland } = props;
  useEffect(() => {
    if (readyRef.current && engineRef.current) {
      engineRef.current.update({ styleId, finishId, finish, hwStyle, hwFinish, doorHardware, showIsland });
    }
  }, [styleId, finishId, finish, hwStyle, hwFinish, doorHardware, showIsland]);

  return (
    <div className={styles.scene3d}>
      <div ref={hostRef} className={styles.scene3dCanvas} />
      {status.mode === 'loading' && <div className={styles.sceneNote}>Loading 3D kitchen…</div>}
      {status.mode === 'error' && <div className={styles.sceneNote}>{status.detail}</div>}
      {status.mode !== 'error' && (
        <button type="button" className={styles.sceneReset} onClick={() => engineRef.current?.resetView()}>
          Reset view
        </button>
      )}
      <p className={styles.sceneHint}>Drag to orbit · scroll or pinch to zoom</p>
    </div>
  );
}
