/**
 * Everything Vulpi says. Each line has a stable id: drop an audio file for it into public/audio/fox/
 * and list it in public/audio/fox/manifest.json ({ "lines": { "<id>": "<file>.mp3" } }) to give him a voice.
 * Tone: calm, a little clever, never salesy. Never mention prices: he promises a custom quote instead.
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
  hello: L('hello', "Hi, I'm Vulpi. I'll walk you through it in three easy picks: door style, then finish, then hardware.", 'wave'),
  helloBack: L('hello_back', 'Welcome back. Your last design is still here. Pick up wherever you like.', 'wave'),
  startStyle: L('start_style', 'Start with a door style. Tap one and the kitchen updates right away.', 'point'),
  quiet: L('quiet', "Got it. I'll stay out of the way. Tap me if you want a hand.", 'idle'),

  style: {
    shaker_classic: L('style_shaker_classic', 'Shaker Classic. Recessed panel, clean frame. It has outlasted every trend for a reason.'),
    shaker_slide: L('style_shaker_slide', 'Shaker Slide. A slimmer frame, so it reads lighter. Classic, just a little more modern.'),
    slab: L('style_slab', 'Slab Modern. Flat and quiet. It lets the finish and the hardware do the talking.'),
    fusion_shaker: L('style_fusion_shaker', 'Fusion Shaker. Shaker bones with a modern edge. Plays well with both worlds.'),
    fusion_slide: L('style_fusion_slide', 'Fusion Slide. Slim profile with a fresh detail. Nice choice for a contemporary space.'),
  } as Record<string, FoxLine>,
  nextFinish: L('next_finish', 'Next, the finish. Every swatch is a photo of a real door.', 'point'),

  finish: {
    light: L('finish_light', 'Bright and timeless. Light doors make a kitchen feel bigger and they forgive almost any countertop.'),
    gloss: L('finish_gloss', 'Snow Gloss. That shine bounces light around the room. Very sharp with slim hardware.'),
    mid: L('finish_mid', 'A soft gray. Calm, versatile, and it hides the everyday smudges better than white.'),
    dark: L('finish_dark', 'Deep and dramatic. Dark doors look great with light counters and warm metals.'),
    wood: L('finish_wood', 'Wood grain brings warmth you can feel. Pairs nicely with black or satin nickel hardware.'),
  },
  nextHardware: L('next_hardware', 'Last step: hardware. Pick a style and a finish below. It changes the whole personality.', 'point'),

  hardware: {
    arch: L('hw_arch', 'Arch. A gentle curve that softens all those straight lines.'),
    artisan: L('hw_artisan', 'Artisan. Handcrafted feel, a little character. Lovely with wood and warm finishes.'),
    bar: L('hw_bar', 'Bar pulls. Simple, sturdy, works with everything. The safe pick that still looks sharp.'),
    cottage: L('hw_cottage', 'Cottage. Soft curves, very welcoming. Great in a farmhouse or classic kitchen.'),
    loft: L('hw_loft', 'Loft. Industrial and lean. Very good with slab doors and darker finishes.'),
    square: L('hw_square', 'Square. Crisp geometry. A small detail that makes a modern kitchen look intentional.'),
  } as Record<string, FoxLine>,
  hwFinish: {
    matte_black: L('hwf_matte_black', 'Matte black. Strong contrast on light doors, quietly sleek on dark ones.'),
    satin_nickel: L('hwf_satin_nickel', 'Satin nickel. Soft sheen, hides fingerprints, goes with stainless appliances.'),
    chrome: L('hwf_chrome', 'Chrome. Bright and polished. It catches the light every time you open a drawer.'),
    rose_gold: L('hwf_rose_gold', 'Rose gold. Warm and a little unexpected. Beautiful against white and gray.'),
  } as Record<string, FoxLine>,
  knobs: L('knobs', 'Knobs on the doors, pulls on the drawers. A classic combination.'),
  pulls: L('pulls', 'Pulls everywhere. Easy to grab and very consistent.'),
  view3d: L('view_3d', 'Drag to look around. Try Close-up door to see the profile and the hardware up close.'),
  allSet: L('all_set', "That's a good-looking kitchen. When you're ready, I can send it to our team for a custom quote. No pressure.", 'celebrate'),

  // quote conversation
  qIntro: L('q_intro', "Happy to. I'll ask a few quick questions so our team can put together a custom quote for this exact design.", 'talk'),
  qName: L('q_name', "First, what's your name?"),
  qPhone: L('q_phone', 'Nice to meet you, {name}. What is the best phone number to reach you?'),
  qEmail: L('q_email', 'And your email? We will send your design summary there too.'),
  qNeedContact: L('q_need_contact', 'I need at least a phone number or an email so the team can reach you.'),
  qBadEmail: L('q_bad_email', "Hmm, that email doesn't look quite right. Mind checking it?"),
  qAddress: L('q_address', 'What is the property address? City and ZIP are fine if you prefer.'),
  qPhotos: L('q_photos', 'Optional: add a few photos of the current kitchen. It helps us measure and plan. You can skip this.'),
  qReview: L('q_review', 'Here is what I will send. Look right?'),
  qSending: L('q_sending', 'Sending it over…'),
  qDone: L('q_done', 'Done, {name}. Our team will review your design and reach out with a custom quote. Thanks for designing with us.', 'celebrate'),
  qError: L('q_error', 'Something went wrong on my end. Try again, or use the full request form.'),
} as const;

/** Bucket a door finish id into a reaction. */
export function finishBucket(id: string): keyof typeof LINES.finish {
  if (/gloss/.test(id)) return 'gloss';
  if (/walnut|oak|teak/.test(id)) return 'wood';
  if (/flour|mist|snow|white/.test(id)) return 'light';
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
