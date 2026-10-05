'use client';

/**
 * Full-screen, in-page AR studio: the rear camera behind one or more real cabinets built in the current design.
 * Never leaves the page (no Quick Look / Scene Viewer). See scene/ar-camera.ts for tracking + gestures.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Group } from 'three';
import type { ConfiguratorEngine } from './scene/engine';
import type { CameraAr, PlaceMode } from './scene/ar-camera';
import { CABINET_TYPES, skuOf, specLabel, typeOf, type CabinetGroup, type CabinetKind, type CabinetLook, type CabinetSpec } from './scene/ar-cabinets';
import { cn } from '@/lib/utils';
import s from './ArStudio.module.css';

export interface DesignChips {
  styles: { id: string; name: string }[];
  style: string;
  onStyle: (id: string) => void;
  colors: { id: string; name: string; img: string }[];
  color: string;
  onColor: (id: string) => void;
  hws: { id: string; name: string }[];
  hw: string;
  onHw: (id: string) => void;
  doorOptions: { id: string; label: string }[];
  doorOption: string;
  onDoorOption: (id: string) => void;
  finishes: { id: string; name: string; color: string }[];
  finish: string;
  onFinish: (id: string) => void;
}

interface Props {
  engine: ConfiguratorEngine | null;
  look: CabinetLook;
  chips: DesignChips;
  /** e.g. "Shaker Classic · Flour · Arch Matte Black" */
  caption: string;
  stream: Promise<MediaStream | null>;
  /** iOS DeviceOrientation permission ('granted' | 'denied' | 'unsupported') */
  motion: Promise<string>;
  onClose: () => void;
  onQuote: (photo: File, note: string) => void;
  /** Android with WebXR immersive-ar: hand the arrangement to a true-scale 6DoF session (in-page) */
  trueScale?: (group: Group, onEnd: () => void) => Promise<void>;
}

const GROUPS: { id: CabinetGroup; label: string }[] = [
  { id: 'wall', label: 'Wall' },
  { id: 'base', label: 'Base' },
  { id: 'tall', label: 'Tall' },
  { id: 'vanity', label: 'Vanity' },
];
type ChipTab = 'style' | 'color' | 'hardware' | 'finish';
const nearest = (list: number[], v: number) => list.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a), list[0]);

export function ArStudio(p: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const arRef = useRef<CameraAr | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [, setTick] = useState(0);
  const [camState, setCamState] = useState<'starting' | 'live' | 'blocked'>('starting');
  const [motion, setMotion] = useState<string>('pending');
  const [mode, setMode] = useState<PlaceMode>('wall');
  const [locked, setLocked] = useState(false);
  const [picker, setPicker] = useState<'first' | 'add' | 'change' | null>('first');
  const [spec, setSpec] = useState<CabinetSpec>({ kind: 'wall', w: 30, h: 30 });
  const [tab, setTab] = useState<ChipTab>('color');
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [inXr, setInXr] = useState(false);
  const kitReady = Boolean(p.engine);
  const rerender = () => setTick((t) => t + 1);

  // three + camera
  useEffect(() => {
    let cancelled = false;
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    import('./scene/ar-camera').then(({ CameraAr }) => {
      if (cancelled || !hostRef.current) return;
      const ar = new CameraAr(hostRef.current, { onChange: rerender });
      arRef.current = ar;
      if (new URLSearchParams(window.location.search).get('debug') === '1') (window as any).__vulpineAr = ar;
      p.stream.then((st) => {
        if (cancelled) return st?.getTracks().forEach((t) => t.stop());
        streamRef.current = st;
        ar.setStream(st);
        setCamState(st ? 'live' : 'blocked');
      });
      rerender();
    });
    p.motion.then((m) => !cancelled && setMotion(m));
    return () => {
      cancelled = true;
      document.documentElement.style.overflow = prevOverflow;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      arRef.current?.dispose();
      arRef.current = null;
      if (shot) URL.revokeObjectURL(shot.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // live materials / hardware from the 3D engine
  const lookKey = `${p.look.styleId}|${p.look.hwStyle}|${p.look.doorHardware}|${p.look.knobShape}`;
  useEffect(() => {
    const ar = arRef.current;
    if (!ar || !p.engine) return;
    if (!ar.ready) ar.setKit(p.engine.arKit(), p.look);
    else ar.setLook(p.look);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.engine, lookKey, arRef.current]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (shot ? setShot(null) : p.onClose());
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shot, p]);

  // tracking status (the sensor may be granted but silent, e.g. desktop)
  const [tracking, setTracking] = useState(false);
  useEffect(() => {
    const iv = window.setInterval(() => setTracking(Boolean(arRef.current?.tracking)), 800);
    return () => window.clearInterval(iv);
  }, []);

  const ar = arRef.current;
  const items = ar?.list() ?? [];
  // the gesture hint fades a few seconds after the first cabinet lands
  const [hintGone, setHintGone] = useState(false);
  const placedOnce = items.length > 0;
  useEffect(() => {
    if (!placedOnce) return;
    const t = window.setTimeout(() => setHintGone(true), 7000);
    return () => window.clearTimeout(t);
  }, [placedOnce]);
  const selected = ar?.selected ?? null;
  const type = typeOf(spec.kind);
  const kindsInGroup = CABINET_TYPES.filter((t) => t.group === type.group);

  const setKind = (kind: CabinetKind) => {
    const t = typeOf(kind);
    setSpec((cur) => ({ kind, w: nearest(t.widths, cur.w), h: t.heights.includes(cur.h) ? cur.h : t.heights[t.heights.length > 1 ? 1 : 0] }));
  };
  const setGroup = (g: CabinetGroup) => setKind(CABINET_TYPES.find((t) => t.group === g)!.kind);

  const place = () => {
    if (!ar) return;
    if (picker === 'change') ar.replaceSelected(spec);
    else ar.add(spec);
    setPicker(null);
  };
  const openPicker = (m: 'add' | 'change') => {
    if (m === 'change' && selected) setSpec(selected.spec);
    setPicker(m);
  };
  const switchMode = (m: PlaceMode) => {
    setMode(m);
    ar?.setMode(m);
  };
  const toggleLock = () => {
    const next = !locked;
    setLocked(next);
    if (ar) ar.locked = next;
  };

  const designNote = () =>
    `View in your space: ${items.map((i) => skuOf(i.spec)).join(', ') || 'no cabinet'} (${items.map((i) => specLabel(i.spec)).join('; ')}).`;

  const takeSnapshot = async (): Promise<{ blob: Blob; url: string } | null> => {
    if (!ar) return null;
    setBusy('Saving photo…');
    try {
      const blob = await ar.snapshot(`Vulpine · ${p.caption}`);
      if (!blob) throw new Error('no image');
      const next = { blob, url: URL.createObjectURL(blob) };
      setShot((old) => {
        if (old) URL.revokeObjectURL(old.url);
        return next;
      });
      return next;
    } catch (e) {
      console.warn('[ar] snapshot failed', e);
      setNotice('Could not take the photo on this device.');
      return null;
    } finally {
      setBusy(null);
    }
  };
  const fileOf = (b: Blob) => new File([b], `vulpine-cabinet-${Date.now()}.jpg`, { type: 'image/jpeg' });
  const saveShot = async () => {
    if (!shot) return;
    const file = fileOf(shot.blob);
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: 'My Vulpine cabinet', text: p.caption });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    const a = document.createElement('a');
    a.href = shot.url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  const quote = async () => {
    const sh = shot ?? (await takeSnapshot());
    if (!sh) return;
    p.onQuote(fileOf(sh.blob), designNote());
  };

  const startTrueScale = async () => {
    if (!ar || !p.trueScale) return;
    const g = ar.arrangement();
    if (!g) return;
    // ARCore needs the camera: release ours first (synchronously, still inside the tap)
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setInXr(true);
    const back = async () => {
      setInXr(false);
      try {
        const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        streamRef.current = st;
        arRef.current?.setStream(st);
      } catch {
        setCamState('blocked');
      }
    };
    try {
      await p.trueScale(g, back);
    } catch (e) {
      console.warn('[ar] WebXR failed', e);
      setNotice('True-scale AR could not start on this phone. The camera view still works.');
      back();
    }
  };

  const chipRow = useMemo(() => {
    const c = p.chips;
    if (tab === 'style') return c.styles.map((x) => ({ id: x.id, label: x.name, on: x.id === c.style, pick: () => c.onStyle(x.id) }));
    if (tab === 'color') return c.colors.map((x) => ({ id: x.id, label: x.name, img: x.img, on: x.id === c.color, pick: () => c.onColor(x.id) }));
    if (tab === 'hardware')
      return [
        ...c.hws.map((x) => ({ id: x.id, label: x.name, on: x.id === c.hw, pick: () => c.onHw(x.id) })),
        ...c.doorOptions.map((x) => ({ id: `door_${x.id}`, label: x.label, on: x.id === c.doorOption, subtle: true, pick: () => c.onDoorOption(x.id) })),
      ];
    return c.finishes.map((x) => ({ id: x.id, label: x.name, dot: x.color, on: x.id === c.finish, pick: () => c.onFinish(x.id) }));
  }, [p.chips, tab]);

  const cameraMsg =
    camState === 'blocked'
      ? 'Camera is blocked or unavailable. Allow camera access for this site (iPhone: Settings › Safari › Camera), then reopen. You can still try cabinets here.'
      : null;
  const motionOff = motion === 'denied';

  const ui = (
    <div className={cn(s.root, inXr && s.hidden)} role="dialog" aria-modal="true" aria-label="View a cabinet in your space">
      <div ref={hostRef} className={s.stage} />

      <div className={s.top}>
        <button type="button" className={s.iconBtn} aria-label="Close camera view" onClick={p.onClose}>
          ×
        </button>
        <div className={s.seg} role="radiogroup" aria-label="Placement">
          {(['wall', 'floor'] as PlaceMode[]).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} className={cn(s.segBtn, mode === m && s.segOn)} onClick={() => switchMode(m)}>
              {m === 'wall' ? 'On wall' : 'On floor'}
            </button>
          ))}
        </div>
        <button type="button" className={cn(s.pill, locked && s.pillOn)} aria-pressed={locked} onClick={toggleLock}>
          {locked ? '🔒 Locked' : '🔓 Lock'}
        </button>
      </div>

      <div className={s.status} aria-live="polite">
        {selected && !picker && <span className={s.tag}>{specLabel(selected.spec)}</span>}
        {!picker && items.length > 0 && !locked && !hintGone && <span className={s.hint}>Drag to move · pinch to resize · twist to turn</span>}
        {locked && <span className={s.hint}>Locked: gestures are off</span>}
        {motionOff && !tracking && <span className={s.hint}>Motion access off: the cabinet stays fixed on screen</span>}
        {cameraMsg && <span className={s.warn}>{cameraMsg}</span>}
        {notice && (
          <button type="button" className={s.warn} onClick={() => setNotice(null)}>
            {notice} ×
          </button>
        )}
        {p.trueScale && items.length > 0 && !picker && (
          <button type="button" className={s.pill} onClick={startTrueScale}>
            True-scale AR (move around it)
          </button>
        )}
      </div>

      {picker ? (
        <div className={s.sheet}>
          <div className={s.sheetHead}>
            <strong>{picker === 'change' ? 'Change cabinet' : picker === 'add' ? 'Add another cabinet' : 'Pick a cabinet'}</strong>
            {picker !== 'first' && (
              <button type="button" className={s.linkBtn} onClick={() => setPicker(null)}>
                Cancel
              </button>
            )}
          </div>
          <div className={s.row} role="radiogroup" aria-label="Cabinet group">
            {GROUPS.map((g) => (
              <button key={g.id} type="button" role="radio" aria-checked={type.group === g.id} className={cn(s.chip, type.group === g.id && s.chipOn)} onClick={() => setGroup(g.id)}>
                {g.label}
              </button>
            ))}
          </div>
          {kindsInGroup.length > 1 && (
            <div className={s.row} role="radiogroup" aria-label="Cabinet type">
              {kindsInGroup.map((t) => (
                <button key={t.kind} type="button" role="radio" aria-checked={spec.kind === t.kind} className={cn(s.chip, s.chipSubtle, spec.kind === t.kind && s.chipOn)} onClick={() => setKind(t.kind)}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
          <div className={s.row} role="radiogroup" aria-label="Width">
            <span className={s.rowLabel}>Width</span>
            {type.widths.map((w) => (
              <button key={w} type="button" role="radio" aria-checked={spec.w === w} className={cn(s.chip, s.chipSize, spec.w === w && s.chipOn)} onClick={() => setSpec({ ...spec, w })}>
                {w}″
              </button>
            ))}
          </div>
          {type.heights.length > 1 && (
            <div className={s.row} role="radiogroup" aria-label="Height">
              <span className={s.rowLabel}>Height</span>
              {type.heights.map((h) => (
                <button key={h} type="button" role="radio" aria-checked={spec.h === h} className={cn(s.chip, s.chipSize, spec.h === h && s.chipOn)} onClick={() => setSpec({ ...spec, h })}>
                  {h}″
                </button>
              ))}
            </div>
          )}
          <p className={s.specLine}>
            {specLabel(spec)} · {type.hint}
          </p>
          <button type="button" className={s.primary} disabled={!kitReady || !ar} onClick={place}>
            {!kitReady ? 'Loading cabinet parts…' : picker === 'change' ? 'Use this cabinet' : `Place it ${mode === 'wall' ? 'on the wall' : 'on the floor'}`}
          </button>
        </div>
      ) : (
        <div className={s.bottom}>
          <div className={s.chipsRow} role="radiogroup" aria-label={`${tab} options`}>
            {chipRow.map((c: any) => (
              <button key={c.id} type="button" role="radio" aria-checked={c.on} className={cn(s.chip, c.subtle && s.chipSubtle, c.on && s.chipOn, c.img && s.swatchChip)} onClick={c.pick}>
                {c.img && <img src={c.img} alt="" className={s.swatchImg} />}
                {c.dot && <span className={s.dot} style={{ background: c.dot }} aria-hidden="true" />}
                {c.label}
              </button>
            ))}
          </div>
          <div className={s.tabs} role="tablist" aria-label="Design">
            {(['style', 'color', 'hardware', 'finish'] as ChipTab[]).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={tab === t} className={cn(s.tab, tab === t && s.tabOn)} onClick={() => setTab(t)}>
                {t === 'color' ? 'Color' : t === 'style' ? 'Style' : t === 'hardware' ? 'Hardware' : 'Finish'}
              </button>
            ))}
          </div>
          <div className={s.actions}>
            <button type="button" className={s.action} onClick={() => openPicker('add')}>
              ＋ Add another
            </button>
            <button type="button" className={s.action} onClick={() => openPicker('change')} disabled={!selected}>
              Change
            </button>
            {items.length > 1 && selected && (
              <button type="button" className={s.action} onClick={() => ar?.remove(selected.id)}>
                Remove
              </button>
            )}
            <button type="button" className={s.action} onClick={takeSnapshot} disabled={Boolean(busy)}>
              {busy ?? 'Snapshot'}
            </button>
            <button type="button" className={cn(s.action, s.actionPrimary)} onClick={quote}>
              Get a quote with this
            </button>
          </div>
        </div>
      )}

      {shot && (
        <div className={s.shotBackdrop} onClick={() => setShot(null)}>
          <div className={s.shotCard} role="dialog" aria-label="Your snapshot" onClick={(e) => e.stopPropagation()}>
            <img src={shot.url} alt="Snapshot: your camera view with the cabinet" className={s.shotImg} />
            <div className={s.shotActions}>
              <button type="button" className={s.action} onClick={() => setShot(null)}>
                Back
              </button>
              <button type="button" className={s.action} onClick={saveShot}>
                Save / Share
              </button>
              <button type="button" className={cn(s.action, s.actionPrimary)} onClick={quote}>
                Get a quote with this
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
  return createPortal(ui, document.body);
}

export default ArStudio;
