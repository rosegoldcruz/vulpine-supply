'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/brand-logo';
import { CONFIG_DATA, FINISH_COLORS, FINISH_NAMES, cabsUrl } from './data';
import styles from './CabinetConfigurator.module.css';

const KitchenScene3D = dynamic(() => import('./KitchenScene3D'), {
  ssr: false,
  loading: () => <div className={styles.sceneNote}>Loading 3D kitchen…</div>,
});

type StyleKey = keyof typeof CONFIG_DATA.doorStyles & string;
type View = 'photo' | '3d';

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
  const [doorHardware, setDoorHardware] = useState<'pull' | 'knob'>('pull');
  const [view, setView] = useState<View>('photo');
  const [showIsland, setShowIsland] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [brokenRender, setBrokenRender] = useState<string | null>(null);

  // Current selections
  const currentStyle = CONFIG_DATA.doorStyles[style];
  const currentColor = currentStyle.options.find((c) => c.id === colorKey) || currentStyle.options[0];
  const currentHw = CONFIG_DATA.hardware[hwType];
  const hwFinishKey = currentHw.finishes[hwFinish] ? hwFinish : Object.keys(currentHw.finishes)[0];
  const currentHwFinish = currentHw.finishes[hwFinishKey];
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
  }, []);

  // Keep the URL in sync so a selection can be shared
  useEffect(() => {
    const q = new URLSearchParams({ style, color: currentColor.id, hw: hwType, finish: hwFinishKey });
    if (view === '3d') q.set('view', '3d');
    window.history.replaceState(null, '', `${window.location.pathname}?${q.toString()}`);
  }, [style, currentColor.id, hwType, hwFinishKey, view]);

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
    const items: { label: string; image: string }[] = [{ label: 'Pull', image: currentHwFinish.pull }];
    if (currentHwFinish.withDoor) items.push({ label: 'Pull + knob set', image: currentHwFinish.withDoor });
    for (const s of currentHwFinish.sizeImages) items.push({ label: s.size, image: s.image });
    return items;
  }, [currentHwFinish]);
  const hwMainImage = hwPreview && hwGallery.some((g) => g.image === hwPreview) ? hwPreview : currentHwFinish.pull;

  const quoteHref = useMemo(() => {
    const summary = [
      'Cabinet configurator selection:',
      `Door style: ${currentStyle.name}`,
      `Color: ${currentColor.color}`,
      `Hardware: ${currentHw.name} - ${FINISH_NAMES[hwFinishKey] || hwFinishKey}`,
      `Doors use: ${doorHardware === 'knob' ? 'knobs' : 'pulls'}`,
    ].join('\n');
    return `/request-bid?${new URLSearchParams({ configuration: summary }).toString()}`;
  }, [currentStyle.name, currentColor.color, currentHw.name, hwFinishKey, doorHardware]);

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <span className="section-label">Cabinet Configurator</span>
        <h1 className="section-heading">Design your kitchen.</h1>
        <p className="section-body">
          Pick a door style, a finish, and hardware. See it in a real kitchen photo or spin it around in 3D, then send it
          over for a quote.
        </p>
      </div>

      <div className={styles.grid}>
        {/* LEFT: Visualizer */}
        <div className={styles.visualCol}>
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
            {view === '3d' && (
              <label className={styles.toggle}>
                <input type="checkbox" checked={showIsland} onChange={(e) => setShowIsland(e.target.checked)} />
                <span>Island</span>
              </label>
            )}
          </div>

          <div className={cn(styles.stage, view === '3d' && styles.stage3d)}>
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
                styleId={style}
                finishId={currentColor.finish}
                finish={doorFinish}
                hwStyle={hwType}
                hwFinish={CONFIG_DATA.hardwareFinishes[hwFinishKey]}
                doorHardware={doorHardware}
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
                <Image src={cabsUrl(currentColor.door)} alt="" fill sizes="80px" className={styles.contain} />
              </div>
              <div className={cn(styles.inset, styles.insetLight)} title={`${currentHw.name} in ${FINISH_NAMES[hwFinishKey]}`}>
                <Image src={cabsUrl(currentHwFinish.pull)} alt="" fill sizes="80px" className={styles.contain} />
              </div>
            </div>
          </div>

          {/* Color Selection Thumbnails */}
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <p className={styles.eyebrow}>Available finishes · {currentStyle.name}</p>
              <p className={styles.muted}>{currentStyle.options.length} colors</p>
            </div>
            <div className={styles.swatchGrid}>
              {currentStyle.options.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    if (opt.id === currentColor.id) return;
                    flash();
                    setColorKey(opt.id);
                  }}
                  className={cn(styles.swatch, currentColor.id === opt.id && styles.swatchActive)}
                  aria-pressed={currentColor.id === opt.id}
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
            <div className={styles.chips}>
              {STYLE_KEYS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleStyleChange(id)}
                  className={cn(styles.chip, style === id && styles.chipActive)}
                  aria-pressed={style === id}
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
          <div className={styles.hwList}>
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
                  aria-pressed={isSelected}
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
              <div className={styles.finishGrid}>
                {Object.keys(currentHw.finishes).map((finish) => (
                  <button
                    key={finish}
                    type="button"
                    onClick={() => {
                      setHwFinish(finish);
                      setHwPreview(null);
                    }}
                    className={cn(styles.finishBtn, hwFinishKey === finish && styles.finishBtnActive)}
                    aria-pressed={hwFinishKey === finish}
                  >
                    <span className={styles.finishDot} style={{ backgroundColor: FINISH_COLORS[finish] || '#666' }} />
                    <span>{FINISH_NAMES[finish] || finish}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Gallery: pull, set, sizes */}
            <div className={styles.panel}>
              <p className={styles.eyebrow}>Sizes &amp; views · {FINISH_NAMES[hwFinishKey]}</p>
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

            <div className={styles.panel}>
              <p className={styles.eyebrow}>On the doors</p>
              <div className={styles.chips}>
                {(['pull', 'knob'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={cn(styles.chip, doorHardware === k && styles.chipActive)}
                    onClick={() => setDoorHardware(k)}
                    aria-pressed={doorHardware === k}
                  >
                    {k === 'pull' ? 'Pulls on doors' : 'Knobs on doors'}
                  </button>
                ))}
              </div>
              <p className={styles.muted}>Drawers always get pulls. Shown in the 3D view.</p>
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
          <a href={quoteHref} className="btn-primary">
            Request a quote
          </a>
        </div>
      </div>
    </div>
  );
}

export default CabinetConfigurator;
