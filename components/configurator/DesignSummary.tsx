'use client';

import { useEffect, useState } from 'react';
import { CONFIG_DATA, FINISH_COLORS, FINISH_NAMES, cabsUrl } from './data';
import { SNAPSHOT_KEY, configQuery, designRef, parseConfig, pullSizes, type ConfigSelection } from './summary';
import { layoutName } from './layouts';
import styles from './DesignSummary.module.css';

const SITE = 'https://vulpinehomes.com';

/** Printable / Save-as-PDF summary of a design (no pricing). Reads the same query string as the configurator. */
export function DesignSummary() {
  const [sel, setSel] = useState<ConfigSelection | null>(null);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [date, setDate] = useState('');

  useEffect(() => {
    const s = parseConfig(new URLSearchParams(window.location.search));
    setSel(s);
    setDate(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
    try {
      const raw = sessionStorage.getItem(SNAPSHOT_KEY);
      const snap = raw ? (JSON.parse(raw) as { key: string; img: string }) : null;
      if (snap?.key === configQuery(s).toString()) setSnapshot(snap.img);
    } catch {
      /* no snapshot */
    }
    import('qrcode').then((QR) =>
      QR.toDataURL(`${SITE}/visualizer?${configQuery(s).toString()}`, { margin: 1, width: 300, color: { dark: '#111111', light: '#ffffff' } }).then(setQr),
    );
  }, []);

  if (!sel) return <div className={styles.page} aria-busy="true" />;

  const style = CONFIG_DATA.doorStyles[sel.style];
  const color = style.options.find((o) => o.id === sel.color) || style.options[0];
  const hw = CONFIG_DATA.hardware[sel.hw];
  const hwImgs = hw.finishes[sel.finish] || Object.values(hw.finishes)[0];
  const finishName = FINISH_NAMES[sel.finish] || sel.finish;
  const ref = designRef(sel);
  const q = configQuery(sel).toString();
  const designUrl = `${SITE}/visualizer?${q}`;
  const quoteText = [
    'Cabinet visualizer selection:',
    `Design reference: ${ref}`,
    `Door style: ${style.name}`,
    `Color: ${color.color}`,
    `Hardware: ${hw.name} - ${finishName}`,
    ...(sel.layout ? [`Starting kitchen: ${layoutName(sel.layout)}`] : []),
    `Design summary: ${SITE}/visualizer/summary?${q}`,
  ].join('\n');
  const quoteHref = `/request-bid?${new URLSearchParams({ configuration: quoteText, config: q }).toString()}`;
  const hero = snapshot || (color.kitchen ? cabsUrl(color.kitchen) : null);
  const sizes = pullSizes(sel.hw, hwImgs.sizeImages);

  return (
    <div className={styles.page}>
      <div className={styles.toolbar} data-noprint>
        <a href={`/visualizer?${q}`} className={styles.back}>
          ← Back to the visualizer
        </a>
        <div className={styles.toolbarActions}>
          <button type="button" className="btn-secondary" onClick={() => window.print()}>
            Print / Save as PDF
          </button>
          <a href={quoteHref} className="btn-primary">
            Request a quote
          </a>
        </div>
      </div>

      <article className={styles.sheet} aria-labelledby="summary-title">
        <div className={styles.head}>
          <div>
            <div className={styles.logo}>
              Vulpine<span>.</span>
            </div>
            <h1 id="summary-title" className={styles.title}>
              Cabinet design summary
            </h1>
          </div>
          <dl className={styles.meta}>
            <div>
              <dt>Reference</dt>
              <dd>{ref}</dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>{date}</dd>
            </div>
          </dl>
        </div>

        {hero && (
          <figure className={styles.hero}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={hero} alt={`${color.color} ${style.name} kitchen${snapshot ? ' (3D view)' : ''}`} />
            <figcaption>{snapshot ? '3D preview of your configuration' : `${color.color} ${style.name} kitchen photo`}</figcaption>
          </figure>
        )}

        <div className={styles.grid}>
          <div className={styles.card}>
            <div className={styles.cardImg}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cabsUrl(color.door)} alt={`${color.color} ${style.name} door`} />
            </div>
            <div>
              <p className={styles.label}>Door style</p>
              <p className={styles.value}>{style.name}</p>
              <p className={styles.label}>Color / finish</p>
              <p className={styles.value}>{color.color}</p>
            </div>
          </div>
          <div className={styles.card}>
            <div className={styles.cardImg}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cabsUrl(hwImgs.pull)} alt={`${hw.name} pull in ${finishName}`} />
            </div>
            <div>
              <p className={styles.label}>Hardware</p>
              <p className={styles.value}>{hw.name}</p>
              <p className={styles.label}>Hardware finish</p>
              <p className={styles.value}>
                <span className={styles.dot} style={{ backgroundColor: FINISH_COLORS[sel.finish] || '#666' }} aria-hidden="true" />
                {finishName}
              </p>
            </div>
          </div>
        </div>

        <table className={styles.table}>
          <caption className={styles.srOnly}>Design details</caption>
          <tbody>
            <tr>
              <th scope="row">Door style</th>
              <td>{style.name}</td>
            </tr>
            <tr>
              <th scope="row">Color</th>
              <td>{color.color}</td>
            </tr>
            <tr>
              <th scope="row">Hardware</th>
              <td>
                {hw.name} · {finishName}
                <span className={styles.note}>{hw.description}</span>
              </td>
            </tr>
            {sel.layout && (
              <tr>
                <th scope="row">Starting kitchen</th>
                <td>{layoutName(sel.layout)}</td>
              </tr>
            )}
            {sizes.length > 0 && (
              <tr>
                <th scope="row">Pull sizes</th>
                <td>{sizes.join(' · ')}</td>
              </tr>
            )}
          </tbody>
        </table>

        <div className={styles.foot}>
          <div>
            <p className={styles.label}>Open this design</p>
            <p className={styles.url}>{designUrl}</p>
            <p className={styles.small}>
              Send this summary with your quote request; we confirm sizes, quantities and lead time with you. Colors on screen and in print
              can vary from the physical door; ask for a sample door before ordering. DuraBuild doors are built in the USA.
            </p>
          </div>
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.qr} src={qr} alt="QR code linking to this design in the visualizer" width={120} height={120} />
          )}
        </div>
      </article>
    </div>
  );
}

export default DesignSummary;
