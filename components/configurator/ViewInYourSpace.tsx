'use client';

import { useEffect, useRef, useState } from 'react';
import type { ConfiguratorEngine } from './scene/engine';
import type { ArSupport, XrPhase, XrSessionHandle } from './scene/ar';
import { cn } from '@/lib/utils';
import styles from './CabinetConfigurator.module.css';

interface Props {
  engine: ConfiguratorEngine | null;
  /** switch the preview to 3D (the AR model is built from the live 3D scene) */
  ensure3d: () => void;
  /** stable key of the current configuration (USDZ cache) */
  configKey: string;
  /** e.g. "Shaker Classic · Flour · Arch Matte Black" */
  title: string;
  /** autostart hint from ?ar=1 (opened from the desktop QR code) */
  arrivedForAr?: boolean;
}

const PHASE_TEXT: Record<XrPhase, string> = {
  starting: 'Starting AR…',
  scanning: 'Move your phone slowly to find the floor',
  aim: 'Tap to place your cabinets',
  placed: 'Drag to rotate · tap the floor to move',
  ended: '',
};

export function ViewInYourSpace({ engine, ensure3d, configKey, title, arrivedForAr }: Props) {
  const [support, setSupport] = useState<ArSupport | null>(null);
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [phase, setPhase] = useState<XrPhase | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<XrSessionHandle | null>(null);
  const usdzCache = useRef<{ key: string; blob: Blob } | null>(null);

  useEffect(() => {
    let alive = true;
    import('./scene/ar').then(({ detectArSupport }) => detectArSupport().then((s) => alive && setSupport(s)));
    return () => {
      alive = false;
      sessionRef.current?.end();
    };
  }, []);

  // arriving from the QR code: get the 3D scene ready so a single tap starts AR
  useEffect(() => {
    if (arrivedForAr && support && support !== 'none') {
      ensure3d();
      setPending(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrivedForAr, support]);

  // warm the fox + exporter once the scene is up on AR-capable devices
  useEffect(() => {
    if (engine && support && support !== 'none') import('./scene/ar').then((m) => m.loadFox());
  }, [engine, support]);

  // tapping Exit / Reset in the dom-overlay must not also place the model
  useEffect(() => {
    const el = controlsRef.current;
    if (!el) return;
    const stop = (e: Event) => e.preventDefault();
    el.addEventListener('beforexrselect', stop);
    return () => el.removeEventListener('beforexrselect', stop);
  }, []);

  const startWebXR = async () => {
    if (!engine || !overlayRef.current) return;
    overlayRef.current.classList.add(styles.xrOverlayActive);
    setPhase('starting');
    try {
      const { startWebXR } = await import('./scene/ar');
      sessionRef.current = await startWebXR({
        buildRun: () => engine.buildArModel(),
        overlay: overlayRef.current,
        onPhase: (p) => {
          setPhase(p === 'ended' ? null : p);
          if (p === 'ended') {
            overlayRef.current?.classList.remove(styles.xrOverlayActive);
            sessionRef.current = null;
          }
        },
      });
    } catch (e) {
      console.warn('[configurator] WebXR AR failed', e);
      overlayRef.current?.classList.remove(styles.xrOverlayActive);
      setPhase(null);
      setError('AR could not start on this device. Make sure camera access is allowed and Google Play Services for AR is installed.');
    }
  };

  const startQuickLook = async () => {
    if (!engine) return;
    setBusy('Preparing your AR model…');
    try {
      const ar = await import('./scene/ar');
      let blob = usdzCache.current?.key === configKey ? usdzCache.current.blob : null;
      if (!blob) {
        const run = engine.buildArModel();
        if (!run) throw new Error('nothing to export');
        blob = await ar.exportUsdz(run);
        usdzCache.current = { key: configKey, blob };
      }
      ar.openQuickLook(blob, title);
    } catch (e) {
      console.warn('[configurator] USDZ export failed', e);
      setError('Could not prepare the AR model on this device.');
    } finally {
      setBusy(null);
    }
  };

  const onClick = () => {
    setError(null);
    if (support === 'none' || support === null) {
      setQrOpen(true);
      return;
    }
    if (!engine) {
      ensure3d();
      setPending(true);
      return;
    }
    setPending(false);
    if (support === 'webxr') startWebXR();
    else startQuickLook();
  };

  const label = busy
    ? busy
    : pending && !engine
      ? 'Preparing 3D…'
      : pending && engine
        ? 'Tap to view in your space'
        : 'View in your space';

  return (
    <>
      <button
        type="button"
        className={cn(styles.arBtn, pending && engine && styles.arBtnReady)}
        onClick={onClick}
        disabled={Boolean(busy)}
        aria-describedby={error ? 'ar-error' : undefined}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M12 2.8 20 7.4v9.2l-8 4.6-8-4.6V7.4z" />
          <path d="M4 7.4 12 12l8-4.6M12 12v9.2" />
        </svg>
        <span>{label}</span>
      </button>
      {error && (
        <p id="ar-error" className={styles.arError} role="alert">
          {error}{' '}
          <button type="button" className={styles.linkBtn} onClick={() => setQrOpen(true)}>
            Show QR code
          </button>
        </p>
      )}

      {/* WebXR dom-overlay root: transparent full-screen layer over the camera feed */}
      <div ref={overlayRef} className={styles.xrOverlay} aria-live="polite">
        <div className={styles.xrHint}>{phase ? PHASE_TEXT[phase] : ''}</div>
        <div ref={controlsRef} className={styles.xrControls}>
          {phase === 'placed' && (
            <button type="button" className={styles.xrBtn} onClick={() => sessionRef.current?.resetRotation()}>
              Reset rotation
            </button>
          )}
          <button type="button" className={cn(styles.xrBtn, styles.xrBtnPrimary)} onClick={() => sessionRef.current?.end()}>
            Exit AR
          </button>
        </div>
      </div>

      {qrOpen && <ArQrDialog onClose={() => setQrOpen(false)} />}
    </>
  );
}

function arUrl() {
  const u = new URL(window.location.href);
  u.searchParams.set('view', '3d');
  u.searchParams.set('ar', '1');
  return u.toString();
}

function ArQrDialog({ onClose }: { onClose: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const url = useRef(arUrl()).current;

  useEffect(() => {
    import('qrcode').then((QR) =>
      QR.toDataURL(url, { margin: 1, width: 440, errorCorrectionLevel: 'M', color: { dark: '#111111', light: '#ffffff' } }).then(setSrc),
    );
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [url, onClose]);

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="ar-qr-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="ar-qr-title" className={styles.modalTitle}>
          View it in your space
        </h2>
        <p className={styles.muted}>
          Scan with your phone camera to open this exact design. iPhone and iPad open it in AR Quick Look; Android phones with
          Chrome place it on your floor with WebXR, at true size.
        </p>
        <div className={styles.qrBox}>
          {src ? <img src={src} alt="QR code linking to this cabinet design in AR" width={220} height={220} /> : <span className={styles.muted}>Generating…</span>}
        </div>
        <p className={styles.qrUrl}>{url}</p>
        <div className={styles.modalActions}>
          <button type="button" className="btn-secondary" onClick={() => navigator.clipboard?.writeText(url)}>
            Copy link
          </button>
          <button ref={closeRef} type="button" className="btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export default ViewInYourSpace;
