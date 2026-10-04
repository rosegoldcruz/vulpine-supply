/**
 * Server-side design summary PDF (mirrors components/configurator/DesignSummary.tsx: wordmark, kitchen photo,
 * door + hardware cards, spec table, design link + QR). No prices, by design.
 */
import React from 'react';
import { Document, Font, Image, Link, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import { CONFIG_DATA, FINISH_COLORS, FINISH_NAMES } from '@/components/configurator/data';
import { configQuery, designRef, doorHardwareLabel, type ConfigSelection } from '@/components/configurator/summary';

export const SITE = 'https://vulpinehomes.com';
const ORANGE = '#ee7200';
const BLACK = '#111111';
const MID = '#888480';
const LINE = '#e3e0dc';

export interface DesignDetails {
  ref: string;
  query: string;
  designUrl: string;
  summaryUrl: string;
  styleName: string;
  colorName: string;
  hardwareName: string;
  hardwareDescription: string;
  finishName: string;
  finishColor: string;
  doorsLabel: string;
  sizes: string[];
  doorImage: string;
  pullImage: string;
  kitchenImage: string | null;
}

/** Everything the summary page shows, resolved from the dataset. Image paths are relative to /public. */
export function designDetails(sel: ConfigSelection): DesignDetails {
  const style = CONFIG_DATA.doorStyles[sel.style];
  const color = style.options.find((o) => o.id === sel.color) || style.options[0];
  const hw = CONFIG_DATA.hardware[sel.hw];
  const hwImgs = hw.finishes[sel.finish] || Object.values(hw.finishes)[0];
  const query = configQuery(sel).toString();
  const label = doorHardwareLabel(sel);
  return {
    ref: designRef(sel),
    query,
    designUrl: `${SITE}/configurator?${query}`,
    summaryUrl: `${SITE}/configurator/summary?${query}`,
    styleName: style.name,
    colorName: color.color,
    hardwareName: hw.name,
    hardwareDescription: hw.description,
    finishName: FINISH_NAMES[sel.finish] || sel.finish,
    finishColor: FINISH_COLORS[sel.finish] || '#666666',
    doorsLabel: label.replace(/^./, (c) => c.toUpperCase()),
    sizes: hwImgs.sizeImages.map((s) => s.size),
    doorImage: `cabs_clean/${color.door}`,
    pullImage: `cabs_clean/${hwImgs.pull}`,
    kitchenImage: color.kitchen ? `cabs_clean/${color.kitchen}` : null,
  };
}

export interface AssetSource {
  /** origin of the current deployment, e.g. https://vulpine-supply-git-...vercel.app */
  origin?: string;
  /** forwarded so protected preview deployments let us read our own /public files */
  cookie?: string;
}

type PdfImage = { data: Buffer; format: 'png' | 'jpg' };

function imageFormat(buf: Buffer): 'png' | 'jpg' | null {
  if (buf.length > 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  return null;
}

/**
 * /public asset over HTTP: this deployment first, then production. (No disk read on purpose: a dynamic
 * path under public/ makes the file tracer pull all of public/ into the function bundle.)
 */
async function loadAsset(rel: string, src: AssetSource): Promise<PdfImage | null> {
  const tries: (() => Promise<Buffer>)[] = [];
  const urlPath = '/' + rel.split('/').map(encodeURIComponent).join('/');
  const fetchBuf = async (url: string, headers: Record<string, string>) => {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000), cache: 'no-store' });
    if (!res.ok) throw new Error(`${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  };
  if (src.origin) {
    const headers: Record<string, string> = {};
    if (src.cookie) headers.cookie = src.cookie;
    if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) headers['x-vercel-protection-bypass'] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    tries.push(() => fetchBuf(src.origin + urlPath, headers));
  }
  if (src.origin !== SITE) tries.push(() => fetchBuf(SITE + urlPath, {}));
  for (const t of tries) {
    try {
      const buf = await t();
      const format = imageFormat(buf);
      if (format) return { data: buf, format };
    } catch {
      /* next source */
    }
  }
  console.error('[summary-pdf] could not load asset', rel);
  return null;
}

// no automatic hyphenation (it split "finish" in the design link); long links break only after "&"
Font.registerHyphenationCallback((word) => (word.includes('=') ? word.split(/(?<=&)/) : [word]));

const s = StyleSheet.create({
  page: { paddingTop: 30, paddingBottom: 40, paddingHorizontal: 40, fontFamily: 'Helvetica', color: BLACK, fontSize: 10 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 2, borderBottomColor: BLACK, paddingBottom: 10 },
  logo: { fontFamily: 'Helvetica-Bold', fontSize: 20, letterSpacing: -0.6 },
  title: { fontFamily: 'Helvetica-Bold', fontSize: 22, letterSpacing: -0.7, marginTop: 4 },
  meta: { alignItems: 'flex-end' },
  metaLabel: { color: MID, fontSize: 7.5, fontFamily: 'Helvetica-Bold', letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 4 },
  metaValue: { fontFamily: 'Helvetica-Bold', fontSize: 10, marginTop: 1 },
  hero: { marginTop: 12 },
  heroImg: { width: '100%', height: 200, objectFit: 'cover', borderRadius: 8 },
  caption: { color: MID, fontSize: 8, marginTop: 4 },
  grid: { flexDirection: 'row', marginTop: 10 },
  card: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: LINE, borderRadius: 10, padding: 10 },
  cardImgBox: { width: 66, height: 84, backgroundColor: '#faf8f5', borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginRight: 12, overflow: 'hidden' },
  cardImg: { maxWidth: 62, maxHeight: 80, objectFit: 'contain' },
  label: { color: MID, fontSize: 7.5, fontFamily: 'Helvetica-Bold', letterSpacing: 1.2, textTransform: 'uppercase' },
  value: { fontFamily: 'Helvetica-Bold', fontSize: 13, marginTop: 2, marginBottom: 7 },
  dotRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 0.6, borderColor: '#c8c4be', marginRight: 6 },
  table: { marginTop: 8 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 5 },
  th: { width: '34%', color: MID, fontFamily: 'Helvetica-Bold', fontSize: 10 },
  td: { flex: 1, fontFamily: 'Helvetica-Bold', fontSize: 10 },
  note: { fontFamily: 'Helvetica', color: MID, fontSize: 8.5, marginTop: 2 },
  foot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: LINE, paddingTop: 10, marginTop: 10 },
  url: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, marginTop: 3, color: BLACK, textDecoration: 'none' },
  small: { color: MID, fontSize: 8, lineHeight: 1.5, marginTop: 6 },
  qr: { width: 78, height: 78, marginLeft: 18 },
  contact: { position: 'absolute', bottom: 20, left: 40, right: 40, color: MID, fontSize: 7.5, textAlign: 'center' },
});

function SummaryDoc(p: { d: DesignDetails; date: string; preparedFor?: string; hero: PdfImage | null; door: PdfImage | null; pull: PdfImage | null; qr: string }) {
  const { d } = p;
  const rows: [string, React.ReactNode][] = [
    ['Door style', d.styleName],
    ['Color', d.colorName],
    [
      'Hardware',
      <>
        <Text>
          {d.hardwareName} · {d.finishName}
        </Text>
        {d.hardwareDescription ? <Text style={s.note}>{d.hardwareDescription}</Text> : null}
      </>,
    ],
    ['Doors', d.doorsLabel],
    ['Drawers', 'Pulls (centered)'],
  ];
  if (d.sizes.length) rows.push(['Available sizes', d.sizes.join(' · ')]);
  return (
    <Document title={`Vulpine cabinet design summary ${d.ref}`} author="Vulpine Homes" subject="Cabinet design summary" creator="vulpinehomes.com">
      <Page size="LETTER" style={s.page}>
        <View style={s.head}>
          <View>
            <Text style={s.logo}>
              Vulpine<Text style={{ color: ORANGE }}>.</Text>
            </Text>
            <Text style={s.title}>Cabinet design summary</Text>
          </View>
          <View style={s.meta}>
            <Text style={s.metaLabel}>Reference</Text>
            <Text style={s.metaValue}>{d.ref}</Text>
            <Text style={s.metaLabel}>Date</Text>
            <Text style={s.metaValue}>{p.date}</Text>
            {p.preparedFor ? (
              <>
                <Text style={s.metaLabel}>Prepared for</Text>
                <Text style={s.metaValue}>{p.preparedFor}</Text>
              </>
            ) : null}
          </View>
        </View>

        {p.hero ? (
          <View style={s.hero}>
            <Image style={s.heroImg} src={p.hero} />
            <Text style={s.caption}>
              {d.colorName} {d.styleName} kitchen photo
            </Text>
          </View>
        ) : null}

        <View style={s.grid}>
          <View style={[s.card, { marginRight: 12 }]}>
            <View style={s.cardImgBox}>{p.door ? <Image style={s.cardImg} src={p.door} /> : null}</View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Door style</Text>
              <Text style={s.value}>{d.styleName}</Text>
              <Text style={s.label}>Color / finish</Text>
              <Text style={[s.value, { marginBottom: 0 }]}>{d.colorName}</Text>
            </View>
          </View>
          <View style={s.card}>
            <View style={s.cardImgBox}>{p.pull ? <Image style={s.cardImg} src={p.pull} /> : null}</View>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Hardware</Text>
              <Text style={s.value}>{d.hardwareName}</Text>
              <Text style={s.label}>Hardware finish</Text>
              <View style={s.dotRow}>
                <View style={[s.dot, { backgroundColor: d.finishColor }]} />
                <Text style={[s.value, { marginTop: 0, marginBottom: 0 }]}>{d.finishName}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={s.table}>
          {rows.map(([k, v]) => (
            <View key={k} style={s.row} wrap={false}>
              <Text style={s.th}>{k}</Text>
              <View style={s.td}>{typeof v === 'string' ? <Text>{v}</Text> : v}</View>
            </View>
          ))}
        </View>

        <View style={s.foot} wrap={false}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Open this design</Text>
            <Link style={s.url} src={d.designUrl}>
              {d.designUrl}
            </Link>
            <Text style={s.small}>
              Send this summary with your quote request; we confirm sizes, quantities and lead time with you. Colors on screen and in print can vary
              from the physical door; ask for a sample door before ordering.
            </Text>
          </View>
          <Image style={s.qr} src={p.qr} />
        </View>
        <Text style={s.contact} fixed>
          Vulpine Homes · 3613 W Frier Dr, Phoenix, AZ · (480) 267-9181 · info@vulpine.llc · vulpinehomes.com
        </Text>
      </Page>
    </Document>
  );
}

export async function renderDesignSummaryPdf(sel: ConfigSelection, opts: { preparedFor?: string; assets?: AssetSource; date?: Date } = {}): Promise<{ pdf: Buffer; details: DesignDetails }> {
  const d = designDetails(sel);
  const src = opts.assets || {};
  const [hero, door, pull, qr] = await Promise.all([
    d.kitchenImage ? loadAsset(d.kitchenImage, src) : Promise.resolve(null),
    loadAsset(d.doorImage, src),
    loadAsset(d.pullImage, src),
    QRCode.toDataURL(d.designUrl, { margin: 1, width: 300, color: { dark: '#111111', light: '#ffffff' } }),
  ]);
  const date = (opts.date || new Date()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Phoenix' });
  const pdf = await renderToBuffer(<SummaryDoc d={d} date={date} preparedFor={opts.preparedFor} hero={hero} door={door} pull={pull} qr={qr} />);
  return { pdf: Buffer.from(pdf), details: d };
}
