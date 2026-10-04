'use client';

import { useState } from 'react';
import Image from 'next/image';
import { CONFIG_DATA, cabsUrl } from './data';
import styles from './CabinetConfigurator.module.css';

interface Pick {
  style: string;
  color: string;
}

const STYLE_KEYS = Object.keys(CONFIG_DATA.doorStyles);

function CompareCard({ label, pick, onChange, action }: { label: string; pick: Pick; onChange?: (p: Pick) => void; action?: React.ReactNode }) {
  const st = CONFIG_DATA.doorStyles[pick.style];
  const opt = st.options.find((o) => o.id === pick.color) || st.options[0];
  const id = `cmp-${label.replace(/\W+/g, '').toLowerCase()}`;
  return (
    <figure className={styles.compareCard}>
      <div className={styles.compareImg}>
        {opt.kitchen ? (
          <Image src={cabsUrl(opt.kitchen)} alt={`${opt.color} ${st.name} kitchen`} fill sizes="(max-width: 1000px) 50vw, 30vw" className={styles.cover} />
        ) : (
          <Image src={cabsUrl(opt.door)} alt={`${opt.color} ${st.name} door`} fill sizes="(max-width: 1000px) 50vw, 30vw" className={styles.contain} />
        )}
        <span className={styles.compareDoor}>
          <Image src={cabsUrl(opt.door)} alt="" fill sizes="56px" className={styles.contain} />
        </span>
      </div>
      <figcaption className={styles.compareCaption}>
        <span className={styles.eyebrow}>{label}</span>
        {onChange ? (
          <span className={styles.compareSelects}>
            <label className={styles.srOnly} htmlFor={`${id}-style`}>
              {label} door style
            </label>
            <select
              id={`${id}-style`}
              className={styles.select}
              value={pick.style}
              onChange={(e) => {
                const s = e.target.value;
                const opts = CONFIG_DATA.doorStyles[s].options;
                onChange({ style: s, color: opts.some((o) => o.id === pick.color) ? pick.color : opts[0].id });
              }}
            >
              {STYLE_KEYS.map((s) => (
                <option key={s} value={s}>
                  {CONFIG_DATA.doorStyles[s].name}
                </option>
              ))}
            </select>
            <label className={styles.srOnly} htmlFor={`${id}-color`}>
              {label} color
            </label>
            <select id={`${id}-color`} className={styles.select} value={opt.id} onChange={(e) => onChange({ style: pick.style, color: e.target.value })}>
              {st.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.color}
                </option>
              ))}
            </select>
          </span>
        ) : (
          <span className={styles.compareName}>
            {st.name} · {opt.color}
          </span>
        )}
        {action}
      </figcaption>
    </figure>
  );
}

/** Side-by-side compare of the current finish with any other style/color (kitchen photos, door swatch fallback). */
export function CompareFinishes({ id, current, onUse, onClose }: { id: string; current: Pick; onUse: (style: string, color: string) => void; onClose: () => void }) {
  const [b, setB] = useState<Pick>(() => {
    const opts = CONFIG_DATA.doorStyles[current.style].options;
    const i = opts.findIndex((o) => o.id === current.color);
    return { style: current.style, color: opts[(i + 1) % opts.length].id };
  });
  return (
    <div id={id} className={styles.panel} role="region" aria-label="Compare two finishes">
      <div className={styles.panelHead}>
        <p className={styles.eyebrow}>Compare finishes side by side</p>
        <button type="button" className={styles.linkBtn} onClick={onClose}>
          Close
        </button>
      </div>
      <div className={styles.compareGrid}>
        <CompareCard label="Your selection" pick={current} />
        <CompareCard
          label="Compare with"
          pick={b}
          onChange={setB}
          action={
            <button type="button" className={styles.ghostBtn} onClick={() => onUse(b.style, b.color)}>
              Use this finish
            </button>
          }
        />
      </div>
    </div>
  );
}
