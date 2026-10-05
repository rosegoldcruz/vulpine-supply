'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { CONFIG_DATA, FINISH_COLORS, FINISH_NAMES, cabsUrl } from './data';
import { COLOR_GROUP_LABEL, COLOR_INFO, DURABUILD, HARDWARE_INFO, HARDWARE_NOTES, STYLE_INFO } from './product-info';
import styles from './ProductInfo.module.css';

export const WHY_DURABUILD_ID = 'why-durabuild';

/** Door styles that offer a color, in configurator order. */
function stylesWithColor(colorId: string): string[] {
  return Object.values(CONFIG_DATA.doorStyles)
    .filter((s) => s.options.some((o) => o.id === colorId))
    .map((s) => s.name);
}

export function colorLine(colorId: string): string | undefined {
  return COLOR_INFO[colorId]?.line;
}

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  styleId: string;
  colorId: string;
  hwId: string;
  hwFinish: string;
}

/** Slide-in panel with the product details for the current pick (style, color, hardware). */
export function ProductInfoDrawer({ open, onClose, styleId, colorId, hwId, hwFinish }: DrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab' || !panelRef.current) return;
      // keep focus inside the dialog
      const f = panelRef.current.querySelectorAll<HTMLElement>('button, a[href], summary, [tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  const style = CONFIG_DATA.doorStyles[styleId];
  const opt = style.options.find((o) => o.id === colorId) ?? style.options[0];
  const sInfo = STYLE_INFO[styleId];
  const cInfo = COLOR_INFO[opt.id];
  const hw = CONFIG_DATA.hardware[hwId];
  const hInfo = HARDWARE_INFO[hwId];
  const hwImg = hw.finishes[hwFinish] ?? Object.values(hw.finishes)[0];
  const offeredIn = stylesWithColor(opt.id);

  const goWhy = () => {
    onClose();
    window.setTimeout(() => document.getElementById(WHY_DURABUILD_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        ref={panelRef}
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-info-title"
        onClick={(e) => e.stopPropagation()}
        data-product-info
      >
        <div className={styles.drawerHead}>
          <div>
            <p className={styles.kicker}>DuraBuild product details</p>
            <h2 id="product-info-title" className={styles.drawerTitle}>
              {style.name} · {opt.color}
            </h2>
          </div>
          <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label="Close product details">
            ×
          </button>
        </div>

        <div className={styles.drawerBody}>
          {/* Door style */}
          <div className={styles.block}>
            <p className={styles.kicker}>Door style</p>
            <h3 className={styles.blockTitle}>{style.name}</h3>
            {sInfo && (
              <>
                <p className={styles.construction}>{sInfo.construction}</p>
                <p className={styles.body}>{sInfo.description}</p>
                <ul className={styles.facts}>
                  {sInfo.facts.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                  <li>{style.options.length} colors</li>
                </ul>
              </>
            )}
          </div>

          {/* Color */}
          <div className={styles.block}>
            <p className={styles.kicker}>Color</p>
            <div className={styles.colorRow}>
              <span className={styles.colorDoor}>
                <Image src={cabsUrl(opt.door)} alt={`${opt.color} ${style.name} door`} fill sizes="72px" className={styles.contain} />
              </span>
              <div>
                <h3 className={styles.blockTitle}>{opt.color}</h3>
                {cInfo && <p className={styles.construction}>{COLOR_GROUP_LABEL[cInfo.group]}</p>}
                {cInfo && <p className={styles.body}>{cInfo.line}</p>}
              </div>
            </div>
            <p className={styles.small}>
              Made in {offeredIn.length === Object.keys(CONFIG_DATA.doorStyles).length ? 'all five door styles' : offeredIn.join(', ')}.
            </p>
          </div>

          {/* Hardware */}
          <div className={styles.block}>
            <p className={styles.kicker}>Hardware</p>
            <div className={styles.colorRow}>
              <span className={`${styles.colorDoor} ${styles.hwThumb}`}>
                <Image src={cabsUrl(hwImg.pull)} alt={`${hw.name} pull`} fill sizes="72px" className={styles.contain} />
              </span>
              <div>
                <h3 className={styles.blockTitle}>{hw.name}</h3>
                <p className={styles.body}>{hw.description}</p>
              </div>
            </div>
            {hInfo && (
              <dl className={styles.specs}>
                <div>
                  <dt>Pulls</dt>
                  <dd>{hInfo.pulls.map((p) => (p.spread ? `${p.length} (${p.spread} spread)` : p.length)).join(' · ')}</dd>
                </div>
                {hInfo.projection && (
                  <div>
                    <dt>Projection</dt>
                    <dd>{hInfo.projection} off the door</dd>
                  </div>
                )}
                <div>
                  <dt>Finishes</dt>
                  <dd className={styles.finishList}>
                    {Object.keys(hw.finishes).map((f) => (
                      <span key={f} className={f === hwFinish ? styles.finishOn : undefined}>
                        <i style={{ backgroundColor: FINISH_COLORS[f] || '#666' }} aria-hidden="true" />
                        {FINISH_NAMES[f] || f}
                      </span>
                    ))}
                  </dd>
                </div>
              </dl>
            )}
            <ul className={styles.notes}>
              {HARDWARE_NOTES.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>

          <button type="button" className={styles.whyLink} onClick={goWhy}>
            Why DuraBuild? Construction, kit contents and the 3-Way Guarantee →
          </button>
        </div>
      </div>
    </div>
  );
}

/** Page section: what DuraBuild is, what's in the kit, the 3-Way Guarantee and the FAQ. */
export function WhyDuraBuild() {
  return (
    <div id={WHY_DURABUILD_ID} className={styles.why} data-why-durabuild>
      <div className={styles.whyHead}>
        <span className="section-label">Why DuraBuild</span>
        <h2 className={styles.whyTitle}>Made to order. Built to last.</h2>
        <p className={styles.whyIntro}>{DURABUILD.intro}</p>
      </div>

      <div className={styles.highlights}>
        {DURABUILD.highlights.map((h) => (
          <div key={h.title} className={styles.highlight}>
            <h3>{h.title}</h3>
            <p>{h.body}</p>
          </div>
        ))}
      </div>

      <div className={styles.whyGrid}>
        <div className={styles.kit}>
          <p className={styles.kicker}>Every kit includes</p>
          <ul>
            {DURABUILD.kit.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        </div>
        <div className={styles.guarantee}>
          <p className={styles.kickerLight}>The 3-Way Guarantee</p>
          <ol>
            {DURABUILD.guarantee.map((g) => (
              <li key={g.title}>
                <strong>{g.title}</strong>
                <span>{g.body}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className={styles.faq}>
        <p className={styles.kicker}>Frequently asked questions</p>
        {DURABUILD.faq.map((f) => (
          <details key={f.q} className={styles.faqItem}>
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
