'use client';

/**
 * "View in your space": opens the in-page camera AR studio (ArStudio) on phones, a QR code on desktops.
 * Nothing hands off to another app: no AR Quick Look, no Scene Viewer. Android phones with WebXR can switch to a
 * true-scale (6DoF) session from inside the studio; that session also runs in this page.
 */
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Group } from 'three';
import type { ConfiguratorEngine } from './scene/engine';
import type { XrPhase, XrSessionHandle } from './scene/ar';
import { arPath, hasWebXrAr, requestArPermissions, type ArPath } from './scene/ar-detect';
import type { CabinetLook } from './scene/ar-cabinets';
import type { DesignChips } from './ArStudio';
import { cn } from '@/lib/utils';
import styles from './CabinetConfigurator.module.css';

const ArStudio = dynamic(() => import('./ArStudio'), { ssr: false });
type ArModule = typeof import('./scene/ar');

interface Props {
  engine: ConfiguratorEngine | null;
  /** switch the preview to 3D (the AR cabinets borrow the 3D engine's live materials + hardware) */
  ensure3d: () => void;
  /** e.g. "Shaker Classic · Flour · Arch Matte Black" */
  title: string;
  look: CabinetLook;
  chips: DesignChips;
  onQuote: (photo: File, note: string) => void;
  /** autostart hint from ?ar=1 (opened from the desktop QR code) */
  arrivedForAr?: boolean;
}

const PHASE_TEXT: Record<XrPhase, string> = {
  starting: 'Starting true-scale AR…',
  scanning: 'Move your phone slowly to find the floor',
  aim: 'Tap to place your cabinets',
  placed: 'Drag to rotate · tap the floor to move',
  ended: '',
};

export function ViewInYourSpace({ engine, ensure3d, title, look, chips, onQuote, arrivedForAr }: Props) {
  const [path, setPath] = useState<ArPath | null>(null);
  const [webxr, setWebxr] = useState(false);
  const [session, setSession] = useState<{ stream: Promise<MediaStream | null>; motion: Promise<string> } | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [phase, setPhase] = useState<XrPhase | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const xrRef = useRef<XrSessionHandle | null>(null);
  const arMod = useRef<ArModule | null>(null);

  useEffect(() => {
    setPath(arPath());
    hasWebXrAr().then((ok) => {
      setWebxr(ok);
      // requestSession must run inside the tap: have the module ready
      if (ok) import('./scene/ar').then((m) => (arMod.current = m));
    });
    return () => xrRef.current?.end();
  }, []);

  // tapping Exit / Reset in the WebXR dom-overlay must not also place the model
  useEffect(() => {
    const el = controlsRef.current;
    if (!el) return;
    const stop = (e: Event) => e.preventDefault();
    el.addEventListener('beforexrselect', stop);
    return () => el.removeEventListener('beforexrselect', stop);
  }, []);

  const open = () => {
    setNotice(null);
    setQrOpen(false);
    // both prompts from inside the tap (iOS needs the gesture for motion access)
    setSession(requestArPermissions());
    ensure3d();
  };

  const onClick = () => {
    if (path === 'desktop') return setQrOpen(true);
    if (path === 'unsupported' || path === null) return setNotice(NO_AR_TEXT);
    open();
  };

  const trueScale = async (group: Group, onEnd: () => void) => {
    const mod = arMod.current;
    if (!mod || !overlayRef.current) throw new Error('WebXR not ready');
    overlayRef.current.classList.add(styles.xrOverlayActive);
    setPhase('starting');
    try {
      xrRef.current = await mod.startWebXR({
        buildRun: () => group,
        overlay: overlayRef.current,
        withFox: false,
        onPhase: (p) => {
          setPhase(p === 'ended' ? null : p);
          if (p === 'ended') {
            overlayRef.current?.classList.remove(styles.xrOverlayActive);
            xrRef.current = null;
            onEnd();
          }
        },
      });
    } catch (e) {
      overlayRef.current?.classList.remove(styles.xrOverlayActive);
      setPhase(null);
      throw e;
    }
  };

  const label = arrivedForAr && path === 'camera' && !session ? 'Tap to view in your space' : 'View in your space';

  return (
    <>
      <button
        type="button"
        className={cn(styles.arBtn, arrivedForAr && path === 'camera' && !session && styles.arBtnReady)}
        onClick={onClick}
        data-ar-path={path ?? ''}
        aria-describedby={notice ? 'ar-error' : undefined}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M12 2.8 20 7.4v9.2l-8 4.6-8-4.6V7.4z" />
          <path d="M4 7.4 12 12l8-4.6M12 12v9.2" />
        </svg>
        <span>{label}</span>
      </button>
      {notice && (
        <p id="ar-error" className={styles.arError} role="alert">
          {notice}{' '}
          <button type="button" className={styles.linkBtn} onClick={() => navigator.clipboard?.writeText(window.location.href)}>
            Copy link
          </button>
        </p>
      )}

      {session && (
        <ArStudio
          engine={engine}
          look={look}
          chips={chips}
          caption={title}
          stream={session.stream}
          motion={session.motion}
          onClose={() => setSession(null)}
          onQuote={(photo, note) => {
            setSession(null);
            onQuote(photo, note);
          }}
          trueScale={webxr ? trueScale : undefined}
        />
      )}

      {/* WebXR dom-overlay root (true-scale mode): transparent full-screen layer over the camera feed */}
      <div ref={overlayRef} className={styles.xrOverlay} aria-live="polite">
        <div className={styles.xrHint}>{phase ? PHASE_TEXT[phase] : ''}</div>
        <div ref={controlsRef} className={styles.xrControls}>
          {phase === 'placed' && (
            <button type="button" className={styles.xrBtn} onClick={() => xrRef.current?.resetRotation()}>
              Reset rotation
            </button>
          )}
          <button type="button" className={cn(styles.xrBtn, styles.xrBtnPrimary)} onClick={() => xrRef.current?.end()}>
            Back to camera view
          </button>
        </div>
      </div>

      {qrOpen && <ArQrDialog onClose={() => setQrOpen(false)} onWebcam={open} />}
    </>
  );
}

const NO_AR_TEXT = "This browser can't open the camera here. On iPhone or iPad use Safari; on Android use Chrome.";

function arUrl() {
  const u = new URL(window.location.href);
  u.searchParams.set('view', '3d');
  u.searchParams.set('ar', '1');
  return u.toString();
}

function ArQrDialog({ onClose, onWebcam }: { onClose: () => void; onWebcam: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const url = useRef(arUrl()).current;
  const hasCamera = typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function';

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
          Scan with your phone camera to open this exact design. Your phone&apos;s camera shows a real cabinet in this door
          style, finish and hardware on your wall or floor, right in the browser.
        </p>
        <div className={styles.qrBox}>
          {src ? <img src={src} alt="QR code linking to this cabinet design in AR" width={220} height={220} /> : <span className={styles.muted}>Generating…</span>}
        </div>
        <p className={styles.qrUrl}>{url}</p>
        <div className={styles.modalActions}>
          {hasCamera && (
            <button type="button" className="btn-secondary" onClick={onWebcam}>
              Use this computer&apos;s camera
            </button>
          )}
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
