'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/brand-logo';
import { CONFIG_DATA, FINISH_COLORS, FINISH_NAMES, cabsUrl } from './data';
import styles from './CabinetConfigurator.module.css';
import type { ConfiguratorEngine } from './scene/engine';
import { ViewInYourSpace } from './ViewInYourSpace';
import type { DesignChips } from './ArStudio';
import { CompareFinishes } from './CompareFinishes';
import { ProductInfoDrawer, WhyDuraBuild, colorLine } from './ProductInfo';
import { SNAPSHOT_KEY, configQuery, designRef, type ConfigSelection } from './summary';
import { DEFAULT_LAYOUT, fetchLayouts, isLayoutId, type KitchenLayout } from './layouts';
import { FoxGuide, FOX_DISMISSED_KEY, FOX_EVENT, type FoxGuideHandle, type FoxSelection } from '@/components/fox/FoxGuide';

const KitchenScene3D = dynamic(() => import('./KitchenScene3D'), {
  ssr: false,
  loading: () => <div className={styles.sceneNote}>Loading 3D kitchen…</div>,
});

type StyleKey = keyof typeof CONFIG_DATA.doorStyles & string;
type View = 'photo' | '3d';
type SheetTab = 'style' | 'color' | 'hardware' | 'finish';

/** Arrow / Home / End keys move between [role=radio] buttons of a radiogroup and select (WAI-ARIA radio pattern). */
function radioKeys(e: KeyboardEvent<HTMLElement>) {
  const next = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<string, number>;
  if (!(e.key in next) && e.key !== 'Home' && e.key !== 'End') return;
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]:not([disabled])'));
  const i = items.indexOf(document.activeElement as HTMLButtonElement);
  if (i < 0 || !items.length) return;
  e.preventDefault();
  const n = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : (i + next[e.key] + items.length) % items.length;
  items[n].focus();
  items[n].click();
}
const radio = (checked: boolean) => ({ role: 'radio' as const, 'aria-checked': checked, tabIndex: checked ? 0 : -1 });

const STYLE_KEYS = Object.keys(CONFIG_DATA.doorStyles);
const HW_KEYS = Object.keys(CONFIG_DATA.hardware);
const DEFAULT_STYLE = STYLE_KEYS.includes('shaker_classic') ? 'shaker_classic' : STYLE_KEYS[0];
const DEFAULT_HW = HW_KEYS.includes('arch') ? 'arch' : HW_KEYS[0];

export function CabinetConfigurator() {
  const [style, setStyle] = useState<StyleKey>(DEFAULT_STYLE);
  const [colorKey, setColorKey] = useState(CONFIG_DATA.doorStyles[DEFAULT_STYLE].options[0].id);
  const [hwType, setHwType] = useState(DEFAULT_HW);
  const [hwFinish, setHwFinish] = useState('matte_black');
  const [hwPreview, setHwPreview] = useState<string | null>(null);
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const [layouts, setLayouts] = useState<KitchenLayout[]>([]);
  const [view, setView] = useState<View>('photo');
  const [showIsland, setShowIsland] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [brokenRender, setBrokenRender] = useState<string | null>(null);
  const [engine, setEngine] = useState<ConfiguratorEngine | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const closeInfo = useCallback(() => setInfoOpen(false), []);
  const [copied, setCopied] = useState(false);
  const [sheetTab, setSheetTab] = useState<SheetTab | null>(null);
  const [arrivedForAr, setArrivedForAr] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const foxRef = useRef<FoxGuideHandle>(null);
  const [foxDismissed, setFoxDismissed] = useState(false);

  // Vulpi: remember dismissal, and keep him above the mobile bottom sheet (publishes its height as a CSS var)
  useEffect(() => {
    setFoxDismissed(localStorage.getItem(FOX_DISMISSED_KEY) === '1');
    const onFox = (e: Event) => setFoxDismissed(Boolean((e as CustomEvent).detail?.dismissed));
    window.addEventListener(FOX_EVENT, onFox);
    const root = document.documentElement;
    const ro = new ResizeObserver(() => root.style.setProperty('--config-sheet-h', `${sheetRef.current?.offsetHeight ?? 0}px`));
    if (sheetRef.current) ro.observe(sheetRef.current);
    return () => {
      window.removeEventListener(FOX_EVENT, onFox);
      ro.disconnect();
      root.style.removeProperty('--config-sheet-h');
    };
  }, []);
  /** Quote links open Vulpi's short conversation when he's around; otherwise they go to /request-bid as usual. */
  const onQuoteClick = (e: ReactMouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (foxRef.current?.openQuote()) {
      e.preventDefault();
      setSheetTab(null);
    }
  };

  // Current selections
  const currentStyle = CONFIG_DATA.doorStyles[style];
  const currentColor = currentStyle.options.find((c) => c.id === colorKey) || currentStyle.options[0];
  const currentHw = CONFIG_DATA.hardware[hwType];
  const hwFinishKey = currentHw.finishes[hwFinish] ? hwFinish : Object.keys(currentHw.finishes)[0];
  const currentHwFinish = currentHw.finishes[hwFinishKey];
  // starting kitchens: only the layouts whose files are deployed (public/models/configurator/kitchens/index.json)
  useEffect(() => {
    let live = true;
    fetchLayouts().then((l) => live && setLayouts(l));
    return () => {
      live = false;
    };
  }, []);
  const currentLayout = layouts.find((l) => l.id === layout) ?? null;
  const pickLayout = (id: string) => {
    setLayout(id);
    setView('3d');
  };
  const doorFinish = CONFIG_DATA.doorFinishes[currentColor.finish];
  const hasRender = Boolean(currentColor.kitchen) && brokenRender !== currentColor.kitchen;

  // Restore a shared selection from the URL (?style=&color=&hw=&finish=)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const s = q.get('style');
    if (s && CONFIG_DATA.doorStyles[s]) {
      setStyle(s);
      const c = q.get('color');
      const opts = CONFIG_DATA.doorStyles[s].options;
      setColorKey(opts.find((o) => o.id === c)?.id || opts[0].id);
    }
    const h = q.get('hw');
    if (h && CONFIG_DATA.hardware[h]) setHwType(h);
    const f = q.get('finish');
    if (f && FINISH_NAMES[f]) setHwFinish(f);
    if (q.get('view') === '3d') setView('3d');
    const l = q.get('layout');
    if (l && isLayoutId(l)) setLayout(l);
    if (q.get('island') === '0') setShowIsland(false);
    if (q.get('ar') === '1') setArrivedForAr(true);
  }, []);

  const selection: ConfigSelection = useMemo(
    () => ({ style, color: currentColor.id, hw: hwType, finish: hwFinishKey, island: showIsland, ...(layout !== DEFAULT_LAYOUT ? { layout } : {}) }),
    [style, currentColor.id, hwType, hwFinishKey, showIsland, layout],
  );
  const configKey = configQuery(selection).toString();

  // Keep the URL in sync so a selection can be shared
  useEffect(() => {
    const q = configQuery(selection);
    if (view === '3d') q.set('view', '3d');
    if (new URLSearchParams(window.location.search).get('debug') === '1') q.set('debug', '1'); // dev hooks, see KitchenScene3D
    window.history.replaceState(null, '', `${window.location.pathname}?${q.toString()}`);
  }, [selection, view]);

  const shareUrl = () => {
    const q = configQuery(selection);
    if (view === '3d') q.set('view', '3d');
    return `${window.location.origin}${window.location.pathname}?${q.toString()}`;
  };
  const copyShare = async () => {
    const url = shareUrl();
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt('Copy this link to your design:', url);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  };
  const nativeShare = () => navigator.share?.({ title: 'My Vulpine cabinet design', url: shareUrl() }).catch(() => {});
  const [canNativeShare, setCanNativeShare] = useState(false);
  useEffect(() => setCanNativeShare(typeof navigator.share === 'function'), []);

  // printable summary: hand over a still of the 3D view when it's open
  const summaryHref = `/visualizer/summary?${configKey}`;
  const onOpenSummary = () => {
    try {
      const img = engine?.captureImage();
      if (img) sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ key: configKey, img }));
    } catch {
      /* storage full / disabled: the summary falls back to the kitchen photo */
    }
  };

  const ensure3d = useCallback(() => setView('3d'), []);
  const onEngine = useCallback((e: ConfiguratorEngine | null) => setEngine(e), []);
  useEffect(() => {
    if (view !== '3d') setEngine(null);
  }, [view]);

  const openSheet = (tab: SheetTab) => {
    const next = sheetTab === tab ? null : tab;
    setSheetTab(next);
    if (next && stageRef.current) {
      const top = stageRef.current.getBoundingClientRect().top + window.scrollY - 76;
      if (Math.abs(window.scrollY - top) > 40) window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  const flash = () => {
    setIsLoading(true);
    window.setTimeout(() => setIsLoading(false), 300);
  };

  // Handle style change - keep the color if the new style has it, else first available
  const handleStyleChange = (newStyle: string) => {
    if (newStyle === style) return;
    flash();
    setStyle(newStyle);
    const opts = CONFIG_DATA.doorStyles[newStyle].options;
    if (!opts.some((o) => o.id === colorKey)) setColorKey(opts[0].id);
  };

  // Handle hardware type change - ensure finish exists
  const handleHwTypeChange = (newHwType: string) => {
    setHwType(newHwType);
    setHwPreview(null);
    const newHw = CONFIG_DATA.hardware[newHwType];
    if (!newHw.finishes[hwFinish]) setHwFinish(Object.keys(newHw.finishes)[0]);
  };

  const hwGallery = useMemo(() => {
    // pulls only: the chosen pull goes on every door and drawer front
    const items: { label: string; image: string }[] = [{ label: 'Pull', image: currentHwFinish.pull }];
    for (const s of currentHwFinish.sizeImages) if (!/knob/i.test(s.size)) items.push({ label: s.size, image: s.image });
    return items;
  }, [currentHwFinish]);
  const hwMainImage = hwPreview && hwGallery.some((g) => g.image === hwPreview) ? hwPreview : currentHwFinish.pull;

  const quoteSummary = useMemo(() => {
    return [
      'Cabinet visualizer selection:',
      `Door style: ${currentStyle.name}`,
      `Color: ${currentColor.color}`,
      `Hardware: ${currentHw.name} - ${FINISH_NAMES[hwFinishKey] || hwFinishKey}`,
      ...(layout !== DEFAULT_LAYOUT && currentLayout ? [`Starting kitchen: ${currentLayout.name}`] : []),
      `Design summary: https://vulpinehomes.com/visualizer/summary?${configKey}`,
    ].join('\n');
  }, [currentStyle.name, currentColor.color, currentHw.name, hwFinishKey, configKey, layout, currentLayout]);
  const quoteHref = `/request-bid?${new URLSearchParams({ configuration: quoteSummary, config: configKey }).toString()}`;
  const foxSelection: FoxSelection = useMemo(
    () => ({ style, color: currentColor.id, hw: hwType, finish: hwFinishKey, view }),
    [style, currentColor.id, hwType, hwFinishKey, view],
  );

  const description = `${currentStyle.name} doors in ${currentColor.color}, ${currentHw.name} pulls in ${FINISH_NAMES[hwFinishKey] || hwFinishKey}${
    view === '3d' ? `${currentLayout ? `, ${currentLayout.name}` : ''}${showIsland ? ', with island' : ', without island'}` : ''
  }`;
  const arTitle = `${currentStyle.name} · ${currentColor.color} · ${currentHw.name} ${FINISH_NAMES[hwFinishKey] || ''}`.trim();

  // in-page AR studio: same picks as the configurator, as compact chips
  const arLook = useMemo(() => ({ styleId: style, hwStyle: hwType }), [style, hwType]);
  const arChips: DesignChips = {
    styles: STYLE_KEYS.map((id) => ({ id, name: CONFIG_DATA.doorStyles[id].name })),
    style,
    onStyle: handleStyleChange,
    colors: currentStyle.options.map((o) => ({ id: o.id, name: o.color, img: cabsUrl(o.door) })),
    color: currentColor.id,
    onColor: (id) => pickColor(id),
    hws: HW_KEYS.map((id) => ({ id, name: CONFIG_DATA.hardware[id].name })),
    hw: hwType,
    onHw: handleHwTypeChange,
    finishes: Object.keys(currentHw.finishes).map((f) => ({ id: f, name: FINISH_NAMES[f] || f, color: FINISH_COLORS[f] || '#666' })),
    finish: hwFinishKey,
    onFinish: setHwFinish,
  };
  /** "Get a quote with this" from AR: Vulpi's quote chat with the snapshot already attached (brought back if dismissed). */
  const onArQuote = (photo: File, note: string) => {
    if (foxRef.current?.openQuote({ photos: [photo], note })) return;
    foxRef.current?.restore();
    window.setTimeout(() => foxRef.current?.openQuote({ photos: [photo], note }), 400);
  };

  const pickColor = (id: string) => {
    if (id === currentColor.id) return;
    flash();
    setColorKey(id);
  };

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <span className="section-label">Cabinet Visualizer</span>
        <h1 className="section-heading">Design your kitchen.</h1>
        <p className="section-body">
          Pick a door style, a finish, and hardware. See it in a real kitchen photo or spin it around in 3D, then send it
          over for a quote.
        </p>
      </div>

      <div className={styles.grid}>
        {/* LEFT: Visualizer */}
        <div className={styles.visualCol}>
          {layouts.length > 1 && (
            <div className={styles.layoutPicker}>
              <p className={styles.eyebrow} id="layout-label">
                Start with a kitchen
              </p>
              <div className={styles.layoutCards} role="radiogroup" aria-labelledby="layout-label" onKeyDown={radioKeys}>
                {layouts.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className={cn(styles.layoutCard, layout === l.id && styles.layoutCardActive)}
                    {...radio(layout === l.id)}
                    onClick={() => pickLayout(l.id)}
                  >
                    <span className={styles.layoutThumb}>
                      {l.thumb && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.thumb} alt="" loading="lazy" width={512} height={384} />
                      )}
                    </span>
                    <span className={styles.layoutName}>{l.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className={styles.viewBar}>
            <div className={styles.segmented} role="tablist" aria-label="Preview mode">
              {(['photo', '3d'] as View[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  aria-selected={view === v}
                  className={cn(styles.segment, view === v && styles.segmentActive)}
                  onClick={() => setView(v)}
                >
                  {v === 'photo' ? 'Kitchen photo' : '3D view'}
                </button>
              ))}
            </div>
            <div className={styles.viewActions}>
              {view === '3d' && currentLayout?.hasIsland !== false && (
                <label className={styles.toggle}>
                  <input type="checkbox" checked={showIsland} onChange={(e) => setShowIsland(e.target.checked)} />
                  <span>Island</span>
                </label>
              )}
              <button type="button" className={cn(styles.ghostBtn, compareOpen && styles.ghostBtnActive)} aria-expanded={compareOpen} aria-controls="compare-panel" onClick={() => setCompareOpen((v) => !v)}>
                Compare finishes
              </button>
              <ViewInYourSpace engine={engine} ensure3d={ensure3d} title={arTitle} look={arLook} chips={arChips} onQuote={onArQuote} arrivedForAr={arrivedForAr} />
            </div>
          </div>

          <p className={styles.srOnly} aria-live="polite">
            {description}
          </p>

          <div ref={stageRef} className={cn(styles.stage, view === '3d' && styles.stage3d)}>
            {view === 'photo' ? (
              <>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${style}-${currentColor.id}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                    className={styles.fill}
                  >
                    {hasRender ? (
                      <Image
                        src={cabsUrl(currentColor.kitchen!)}
                        alt={`${currentColor.color} ${currentStyle.name} kitchen`}
                        fill
                        sizes="(max-width: 1000px) 100vw, 58vw"
                        className={styles.cover}
                        priority
                        onError={() => setBrokenRender(currentColor.kitchen)}
                      />
                    ) : (
                      <div className={styles.noRender}>
                        <div className={styles.noRenderDoor}>
                          <Image src={cabsUrl(currentColor.door)} alt={`${currentColor.color} ${currentStyle.name} door`} fill sizes="300px" className={styles.contain} />
                        </div>
                        <p>
                          Kitchen photo coming soon for {currentColor.color} {currentStyle.name}.
                          <br />
                          Here is the door itself, or try the 3D view.
                        </p>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                {/* Loading Overlay */}
                <AnimatePresence>
                  {isLoading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={styles.loading}>
                      <motion.div
                        animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <BrandLogo width={64} height={64} />
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <KitchenScene3D
                key={layout}
                layoutBase={currentLayout?.base}
                layoutName={currentLayout?.name}
                description={description}
                onEngine={onEngine}
                styleId={style}
                finishId={currentColor.finish}
                finish={doorFinish}
                hwStyle={hwType}
                hwFinishId={hwFinishKey}
                hwFinish={CONFIG_DATA.hardwareFinishes[hwFinishKey]}
                showIsland={showIsland}
              />
            )}

            {/* Style Badge */}
            <div className={styles.badge}>
              {currentStyle.name} · {currentColor.color}
            </div>

            {/* Door + hardware insets */}
            <div className={styles.insets}>
              <div className={styles.inset} title={`${currentColor.color} ${currentStyle.name} door`}>
                <Image src={cabsUrl(currentColor.door)} alt={`${currentColor.color} ${currentStyle.name} door swatch`} fill sizes="80px" className={styles.contain} />
              </div>
              <div className={cn(styles.inset, styles.insetLight)} title={`${currentHw.name} in ${FINISH_NAMES[hwFinishKey]}`}>
                <Image src={cabsUrl(currentHwFinish.pull)} alt={`${currentHw.name} pull in ${FINISH_NAMES[hwFinishKey]}`} fill sizes="80px" className={styles.contain} />
              </div>
            </div>
          </div>

          {compareOpen && (
            <CompareFinishes
              id="compare-panel"
              current={{ style, color: currentColor.id }}
              onUse={(s, c) => {
                flash();
                setStyle(s);
                setColorKey(c);
              }}
              onClose={() => setCompareOpen(false)}
            />
          )}

          {/* Color Selection Thumbnails */}
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <p className={styles.eyebrow}>Available finishes · {currentStyle.name}</p>
              <p className={styles.muted}>{currentStyle.options.length} colors</p>
            </div>
            {colorLine(currentColor.id) && (
              <p className={styles.colorLine} aria-live="polite">
                <strong>{currentColor.color}.</strong> {colorLine(currentColor.id)}
              </p>
            )}
            <div className={styles.swatchGrid} role="radiogroup" aria-label={`${currentStyle.name} colors`} onKeyDown={radioKeys}>
              {currentStyle.options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => pickColor(opt.id)}
                  className={cn(styles.swatch, currentColor.id === opt.id && styles.swatchActive)}
                  {...radio(currentColor.id === opt.id)}
                  aria-label={opt.color}
                >
                  <span className={styles.swatchImg}>
                    <Image src={cabsUrl(opt.door)} alt="" fill sizes="96px" className={styles.cover} />
                  </span>
                  <span className={styles.swatchName}>{opt.color}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: Controls */}
        <div className={styles.controlsCol}>
          <div className={styles.panel}>
            <div className={styles.step}>
              <span className={styles.stepNum}>1</span>
              <h3 className={styles.eyebrow}>Door style</h3>
            </div>
            <div className={styles.chips} role="radiogroup" aria-label="Door style" onKeyDown={radioKeys}>
              {STYLE_KEYS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleStyleChange(id)}
                  className={cn(styles.chip, style === id && styles.chipActive)}
                  {...radio(style === id)}
                >
                  {CONFIG_DATA.doorStyles[id].name}
                </button>
              ))}
            </div>

            <div className={styles.doorSample}>
              <div className={styles.doorSampleImg}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentColor.door}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className={styles.fill}
                  >
                    <Image src={cabsUrl(currentColor.door)} alt={`${currentColor.color} ${currentStyle.name} door sample`} fill sizes="180px" className={styles.contain} />
                  </motion.div>
                </AnimatePresence>
              </div>
              <div>
                <p className={styles.eyebrow}>Door sample</p>
                <p className={styles.bigValue}>{currentColor.color}</p>
                <p className={styles.muted}>{currentStyle.name}</p>
                <button type="button" className={styles.detailsBtn} onClick={() => setInfoOpen(true)} aria-haspopup="dialog" data-open-product-info>
                  Product details
                </button>
              </div>
            </div>

            {/* Summary */}
            <div className={styles.summary}>
              <p className={styles.eyebrow}>Your selection</p>
              <dl>
                <div>
                  <dt>Style</dt>
                  <dd>{currentStyle.name}</dd>
                </div>
                <div>
                  <dt>Finish</dt>
                  <dd>{currentColor.color}</dd>
                </div>
                <div>
                  <dt>Hardware</dt>
                  <dd>
                    {currentHw.name} · {FINISH_NAMES[hwFinishKey]}
                  </dd>
                </div>
              </dl>
              <a href="#hardware" className={styles.textLink}>
                Next: choose hardware ↓
              </a>
              <ShareRow copied={copied} onCopy={copyShare} onShare={canNativeShare ? nativeShare : undefined} summaryHref={summaryHref} onOpenSummary={onOpenSummary} />
            </div>
          </div>
        </div>
      </div>

      {/* HARDWARE CONFIGURATOR - Separate Section */}
      <div id="hardware" className={styles.hwSection}>
        <div className={styles.hwHead}>
          <span className="section-label">Step 2</span>
          <h2 className={styles.h2}>Select your hardware</h2>
          <p className={styles.muted}>Curated finishes to complete the look.</p>
        </div>

        <div className={styles.hwGrid}>
          {/* LEFT: Hardware Style Selection Cards */}
          <div className={styles.hwList} role="radiogroup" aria-label="Hardware style" onKeyDown={radioKeys}>
            {HW_KEYS.map((id) => {
              const data = CONFIG_DATA.hardware[id];
              const isSelected = hwType === id;
              const firstFinishData = Object.values(data.finishes)[0];
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleHwTypeChange(id)}
                  className={cn(styles.hwCard, isSelected && styles.hwCardActive)}
                  {...radio(isSelected)}
                >
                  <span className={styles.hwThumb}>
                    <Image src={cabsUrl(firstFinishData.pull)} alt="" fill sizes="72px" className={styles.contain} />
                  </span>
                  <span className={styles.hwCardBody}>
                    <span className={styles.hwName}>{data.name}</span>
                    <span className={styles.hwDesc}>{data.description}</span>
                    <span className={styles.dots}>
                      {Object.keys(data.finishes).map((finish) => (
                        <span key={finish} className={styles.dot} style={{ backgroundColor: FINISH_COLORS[finish] || '#666' }} title={FINISH_NAMES[finish]} />
                      ))}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* RIGHT: Large Preview + Finish Selection */}
          <div className={styles.hwDetail}>
            <div className={styles.hwStage}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={hwMainImage}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className={styles.fill}
                >
                  <Image
                    src={cabsUrl(hwMainImage)}
                    alt={`${currentHw.name} in ${FINISH_NAMES[hwFinishKey]}`}
                    fill
                    sizes="(max-width: 1000px) 100vw, 50vw"
                    className={cn(styles.contain, styles.padded)}
                  />
                </motion.div>
              </AnimatePresence>
              <div className={styles.badge}>
                {currentHw.name} · {FINISH_NAMES[hwFinishKey]}
              </div>
            </div>

            {/* Finish Selection Grid */}
            <div className={styles.panel}>
              <div className={styles.panelHead}>
                <p className={styles.eyebrow}>Available finishes</p>
                <p className={styles.muted}>{Object.keys(currentHw.finishes).length} options</p>
              </div>
              <div className={styles.finishGrid} role="radiogroup" aria-label="Hardware finish" onKeyDown={radioKeys}>
                {Object.keys(currentHw.finishes).map((finish) => (
                  <button
                    key={finish}
                    type="button"
                    onClick={() => {
                      setHwFinish(finish);
                      setHwPreview(null);
                    }}
                    className={cn(styles.finishBtn, hwFinishKey === finish && styles.finishBtnActive)}
                    {...radio(hwFinishKey === finish)}
                  >
                    <span className={styles.finishDot} style={{ backgroundColor: FINISH_COLORS[finish] || '#666' }} />
                    <span>{FINISH_NAMES[finish] || finish}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Gallery: pull, set, sizes */}
            <div className={styles.panel}>
              <div className={styles.panelHead}>
                <p className={styles.eyebrow}>Sizes &amp; views · {FINISH_NAMES[hwFinishKey]}</p>
                <button type="button" className={styles.linkBtn} onClick={() => setInfoOpen(true)} aria-haspopup="dialog">
                  Hardware specs
                </button>
              </div>
              <div className={styles.sizeGrid}>
                {hwGallery.map((item) => (
                  <button
                    key={item.image}
                    type="button"
                    className={cn(styles.sizeItem, hwMainImage === item.image && styles.sizeItemActive)}
                    onClick={() => setHwPreview(item.image)}
                  >
                    <span className={styles.sizeImg}>
                      <Image src={cabsUrl(item.image)} alt={`${currentHw.name} ${FINISH_NAMES[hwFinishKey]} - ${item.label}`} fill sizes="140px" className={cn(styles.contain, styles.paddedSm)} />
                    </span>
                    <span className={styles.sizeLabel}>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Final Summary & CTA */}
        <div className={styles.final}>
          <div className={styles.finalBody}>
            <p className={styles.eyebrowLight}>Your complete selection</p>
            <div className={styles.finalRow}>
              <div className={styles.finalThumb}>
                <Image src={cabsUrl(currentColor.door)} alt="" fill sizes="64px" className={styles.cover} />
              </div>
              <div>
                <p className={styles.finalLabel}>Door style</p>
                <p className={styles.finalValue}>{currentStyle.name}</p>
              </div>
              <div className={styles.finalDivider} />
              <div>
                <p className={styles.finalLabel}>Finish</p>
                <p className={styles.finalValue}>{currentColor.color}</p>
              </div>
              <div className={styles.finalDivider} />
              <div className={cn(styles.finalThumb, styles.insetLight)}>
                <Image src={cabsUrl(currentHwFinish.pull)} alt="" fill sizes="64px" className={styles.contain} />
              </div>
              <div>
                <p className={styles.finalLabel}>Hardware</p>
                <p className={styles.finalValue}>
                  {currentHw.name} · {FINISH_NAMES[hwFinishKey]}
                </p>
              </div>
            </div>
          </div>
          <div className={styles.finalActions}>
            <a href={summaryHref} onClick={onOpenSummary} className={styles.finalSecondary}>
              Design summary (print / PDF)
            </a>
            <a href={quoteHref} onClick={onQuoteClick} className="btn-primary">
              Request a quote
            </a>
          </div>
          {foxDismissed && (
            <button type="button" className={styles.foxRestore} onClick={() => foxRef.current?.restore()}>
              Bring back Vulpi, the design guide
            </button>
          )}
        </div>
      </div>

      <WhyDuraBuild />

      <ProductInfoDrawer open={infoOpen} onClose={closeInfo} styleId={style} colorId={currentColor.id} hwId={hwType} hwFinish={hwFinishKey} />

      {/* Mobile bottom sheet: quick picks while the preview stays on screen */}
      <div ref={sheetRef} className={cn(styles.sheet, sheetTab && styles.sheetOpen)} aria-label="Quick design controls">
        {sheetTab && (
          <div className={styles.sheetBody}>
            {sheetTab === 'style' && (
              <div className={styles.sheetRow} role="radiogroup" aria-label="Door style" onKeyDown={radioKeys}>
                {STYLE_KEYS.map((id) => (
                  <button key={id} type="button" className={cn(styles.chip, style === id && styles.chipActive)} {...radio(style === id)} onClick={() => handleStyleChange(id)}>
                    {CONFIG_DATA.doorStyles[id].name}
                  </button>
                ))}
              </div>
            )}
            {sheetTab === 'color' && (
              <div className={styles.sheetRow} role="radiogroup" aria-label={`${currentStyle.name} colors`} onKeyDown={radioKeys}>
                {currentStyle.options.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={cn(styles.sheetSwatch, currentColor.id === opt.id && styles.swatchActive)}
                    {...radio(currentColor.id === opt.id)}
                    aria-label={opt.color}
                    onClick={() => pickColor(opt.id)}
                  >
                    <span className={styles.swatchImg}>
                      <Image src={cabsUrl(opt.door)} alt="" fill sizes="56px" className={styles.cover} />
                    </span>
                    <span className={styles.swatchName}>{opt.color}</span>
                  </button>
                ))}
              </div>
            )}
            {sheetTab === 'hardware' && (
              <div className={styles.sheetRow} role="radiogroup" aria-label="Hardware style" onKeyDown={radioKeys}>
                {HW_KEYS.map((id) => (
                  <button key={id} type="button" className={cn(styles.chip, hwType === id && styles.chipActive)} {...radio(hwType === id)} onClick={() => handleHwTypeChange(id)}>
                    {CONFIG_DATA.hardware[id].name}
                  </button>
                ))}
              </div>
            )}
            {sheetTab === 'finish' && (
              <div className={styles.sheetRow} role="radiogroup" aria-label="Hardware finish" onKeyDown={radioKeys}>
                {Object.keys(currentHw.finishes).map((f) => (
                  <button key={f} type="button" className={cn(styles.chip, hwFinishKey === f && styles.chipActive)} {...radio(hwFinishKey === f)} onClick={() => setHwFinish(f)}>
                    <span className={styles.chipDot} style={{ backgroundColor: FINISH_COLORS[f] || '#666' }} aria-hidden="true" />
                    {FINISH_NAMES[f] || f}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <div className={styles.sheetTabs} role="tablist" aria-label="Design step">
          {(
            [
              ['style', 'Style', currentStyle.name],
              ['color', 'Color', currentColor.color],
              ['hardware', 'Hardware', currentHw.name],
              ['finish', 'Finish', FINISH_NAMES[hwFinishKey] || hwFinishKey],
            ] as [SheetTab, string, string][]
          ).map(([id, label, value]) => (
            <button key={id} type="button" role="tab" aria-selected={sheetTab === id} className={cn(styles.sheetTab, sheetTab === id && styles.sheetTabActive)} onClick={() => openSheet(id)}>
              <span className={styles.sheetTabLabel}>{label}</span>
              <span className={styles.sheetTabValue}>{value}</span>
            </button>
          ))}
          <a href={quoteHref} onClick={onQuoteClick} className={styles.sheetCta}>
            Quote
          </a>
        </div>
      </div>

      <FoxGuide
        ref={foxRef}
        selection={foxSelection}
        quoteMessage={quoteSummary}
        designRef={designRef(selection)}
        designLabel={`${currentStyle.name} · ${currentColor.color} · ${currentHw.name} ${FINISH_NAMES[hwFinishKey] || ''}`.trim()}
        summaryHref={summaryHref}
        fullFormHref={quoteHref}
      />
    </div>
  );
}

function ShareRow(props: { copied: boolean; onCopy: () => void; onShare?: () => void; summaryHref: string; onOpenSummary: () => void }) {
  return (
    <div className={styles.shareRow}>
      <button type="button" className={styles.ghostBtn} onClick={props.onCopy}>
        {props.copied ? 'Link copied ✓' : 'Copy link to my design'}
      </button>
      {props.onShare && (
        <button type="button" className={styles.ghostBtn} onClick={props.onShare}>
          Share…
        </button>
      )}
      <a href={props.summaryHref} onClick={props.onOpenSummary} className={styles.ghostBtn}>
        Design summary
      </a>
      <span className={styles.srOnly} aria-live="polite">
        {props.copied ? 'Link copied to clipboard' : ''}
      </span>
    </div>
  );
}

export default CabinetConfigurator;
