/**
 * Everything Vulpi says. Each line has a stable id: drop an audio file for it into public/audio/fox/
 * and list it in public/audio/fox/manifest.json ({ "lines": { "<id>": "<file>.mp3" } }) to give him a voice.
 * Tone: hip, sly and confident, but professional: one spoken sentence per line, never cheesy or salesy.
 * Never mention prices: he promises a custom quote instead.
 * `{name}` is replaced with the visitor's first name (lines with it fall back to text-only unless a generic clip exists).
 */
import type { FoxMove } from './clips';

export interface FoxLine {
  id: string;
  text: string;
  move?: FoxMove;
}

const L = (id: string, text: string, move?: FoxMove): FoxLine => ({ id, text, move });

export const LINES = {
  hello: L('hello', "Hey, I'm Vulpi, let's make this kitchen look sharp.", 'wave'),
  helloBack: L('hello_back', 'Welcome back, your design kept your seat warm.', 'wave'),
  startStyle: L('start_style', 'Pick a door style and watch the room change.', 'point'),
  quiet: L('quiet', "Got it, I'll lie low until you need me.", 'idle'),

  style: {
    shaker_classic: L('style_shaker_classic', 'Shaker Classic, the one that never goes out of style.'),
    shaker_slide: L('style_shaker_slide', 'Shaker Slide, classic lines on a slimmer frame.'),
    slab: L('style_slab', 'Slab, flat and quiet, letting the finish do the talking.'),
    fusion_shaker: L('style_fusion_shaker', 'Fusion Classic, old-school bones with a modern edge.'),
    fusion_slide: L('style_fusion_slide', 'Fusion Slide, sleek, slim, and a little bit bold.'),
  } as Record<string, FoxLine>,
  nextFinish: L('next_finish', 'Now the fun part, pick your finish.', 'point'),

  finish: {
    light: L('finish_light', 'Light and bright, this kitchen just grew a size.'),
    gloss: L('finish_gloss', "Snow Gloss, now that's a kitchen that shines."),
    mid: L('finish_mid', 'A cool gray that plays it smooth.'),
    dark: L('finish_dark', "Dark and dramatic, now we're talking."),
    wood: L('finish_wood', 'Wood grain brings the warmth, nicely done.'),
  },
  nextHardware: L('next_hardware', "Last step: hardware, the kitchen's jewelry.", 'point'),

  hardware: {
    arch: L('hw_arch', 'Arch, a soft curve with serious style.'),
    artisan: L('hw_artisan', 'Artisan, handcrafted character in every pull.'),
    bar: L('hw_bar', 'Bar pulls, simple, sturdy, and always sharp.'),
    cottage: L('hw_cottage', 'Cottage, soft curves with a warm welcome.'),
    loft: L('hw_loft', 'Loft, lean and industrial with a little attitude.'),
    square: L('hw_square', 'Square, crisp edges for a clean, modern look.'),
  } as Record<string, FoxLine>,
  hwFinish: {
    matte_black: L('hwf_matte_black', 'Matte black, never not cool.'),
    satin_nickel: L('hwf_satin_nickel', "Satin nickel, a soft sheen that's easy to live with."),
    chrome: L('hwf_chrome', 'Chrome, polished and catching every bit of light.'),
    rose_gold: L('hwf_rose_gold', 'Rose gold, warm, unexpected, and totally worth it.'),
  } as Record<string, FoxLine>,
  view3d: L('view_3d', 'Drag to look around, then zoom in close.'),
  allSet: L('all_set', "Good taste, let's lock it in.", 'celebrate'),

  // quote conversation
  qIntro: L('q_intro', 'Happy to, just a few quick questions.', 'talk'),
  qName: L('q_name', "First, what's your name?"),
  qPhone: L('q_phone', "Nice to meet you, {name}, what's your best phone number?"),
  qEmail: L('q_email', 'And your email, so I can send your design?'),
  qNeedContact: L('q_need_contact', "I'll need a phone or an email to reach you."),
  qBadEmail: L('q_bad_email', 'Hmm, that email looks a little off.'),
  qAddress: L('q_address', "What's the property address, or just city and ZIP?"),
  qPhotos: L('q_photos', 'Add a few photos of your current kitchen, or skip it.'),
  qReview: L('q_review', "Here's what I'll send, look right?"),
  qSending: L('q_sending', 'Sending it over now.'),
  qDone: L('q_done', 'Done, {name}, your custom quote is in the works.', 'celebrate'),
  qError: L('q_error', 'Something went wrong, try again or use the full form.'),
} as const;

/**
 * Bucket a door finish id into a reaction. null = no finish line fits (Sage is a green, Paint Ready is primed),
 * so he skips the reaction and just moves on to the hardware nudge.
 */
export function finishBucket(id: string): keyof typeof LINES.finish | null {
  if (/sage|paint_ready/.test(id)) return null;
  if (/gloss/.test(id)) return 'gloss';
  if (/walnut|oak|teak/.test(id)) return 'wood';
  if (/flour|oat|cloudstone|mist|snow|white/.test(id)) return 'light';
  if (/graphite|slate|espresso|black/.test(id)) return 'dark';
  return 'mid';
}

export function fill(line: FoxLine, vars: Record<string, string>): FoxLine {
  return { ...line, text: line.text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '') };
}

/** Every line, flattened (for docs / voice generation). */
export function allLines(): FoxLine[] {
  const out: FoxLine[] = [];
  const walk = (v: unknown) => {
    if (v && typeof v === 'object' && 'id' in (v as object) && 'text' in (v as object)) out.push(v as FoxLine);
    else if (v && typeof v === 'object') Object.values(v as object).forEach(walk);
  };
  walk(LINES);
  return out;
}
