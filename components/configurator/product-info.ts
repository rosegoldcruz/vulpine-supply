/**
 * DuraBuild product information shown in the configurator (ProductInfo drawer + "Why DuraBuild" section).
 * Compiled from the manufacturer's product menu, technical guide, hardware dimensions sheet, warranty and FAQ
 * (Oct 2026). Rules: keep the DuraBuild name, never name the manufacturer, and never show prices or fees.
 * Style ids match public/cabs_clean/dataset.json; display names come from the dataset.
 */

export interface StyleInfo {
  construction: string;
  description: string;
  facts: string[];
}

export interface ColorInfo {
  /** solid | woodgrain | gloss | paint */
  group: 'solid' | 'woodgrain' | 'gloss' | 'paint';
  line: string;
}

export interface HardwareInfo {
  pulls: { length: string; spread?: string }[];
  /** projection off the door face */
  projection?: string;
  note?: string;
}

const COMMON_DOOR_FACTS = ['3/4" thick', 'Furniture-grade MDF', 'Matching back'];

export const STYLE_INFO: Record<string, StyleInfo> = {
  shaker_classic: {
    construction: '5-piece rail-and-stile door',
    description:
      'The best-selling DuraBuild door. A traditional 5-piece Shaker with a recessed center panel; on woodgrain colors the grain circles the panel. The back of the door matches the front.',
    facts: [...COMMON_DOOR_FACTS, '1/4" center panel'],
  },
  shaker_slide: {
    construction: '5-piece rail-and-stile door',
    description: 'An updated Shaker with softer, cleaner lines. Built the same way as Shaker Classic, as a 5-piece door with a matching back.',
    facts: [...COMMON_DOOR_FACTS, '1/4" center panel'],
  },
  slab: {
    construction: 'One-piece door',
    description:
      'A one-piece door with a clean, modern look. It is wrapped in film laminate and edge-banded for a near-seamless finish, and Slab doors can be pre-drilled for your pulls.',
    facts: [...COMMON_DOOR_FACTS, 'Edge-banded'],
  },
  fusion_shaker: {
    construction: 'Slab drawer fronts + 5-piece Shaker Classic doors',
    description:
      'Fusion pairs flat slab drawer fronts with framed 5-piece doors. Fusion Classic uses Shaker Classic doors, so you get a traditional door with a cleaner, modern drawer bank.',
    facts: [...COMMON_DOOR_FACTS, 'Slab drawers'],
  },
  fusion_slide: {
    construction: 'Slab drawer fronts + 5-piece Shaker Slide doors',
    description: 'Fusion Slide pairs flat slab drawer fronts with Shaker Slide doors: a modern drawer under a softly framed door.',
    facts: [...COMMON_DOOR_FACTS, 'Slab drawers'],
  },
};

export const COLOR_INFO: Record<string, ColorInfo> = {
  flour: { group: 'solid', line: 'Classic white for a clean, fresh look.' },
  oat: { group: 'solid', line: 'A warm, subtle, versatile neutral with a cozy, minimalist feel.' },
  cloudstone: { group: 'solid', line: 'A soft, airy light gray with warm undertones.' },
  sage: { group: 'solid', line: 'A calming, nature-inspired neutral between green and gray.' },
  mist: { group: 'solid', line: 'A soft, cool light gray.' },
  storm: { group: 'solid', line: 'A versatile mid gray.' },
  graphite: { group: 'solid', line: 'A deep charcoal gray.' },
  slate: { group: 'solid', line: 'A muted blue-gray.' },
  snow_gloss: { group: 'gloss', line: 'A bright, high-gloss white.' },
  nimbus_oak: { group: 'woodgrain', line: 'A light, natural oak grain.' },
  wheat_oak: { group: 'woodgrain', line: 'A golden oak grain.' },
  sable_oak: { group: 'woodgrain', line: 'A warm gray-brown oak.' },
  cafe_walnut: { group: 'woodgrain', line: 'A warm medium-brown walnut.' },
  latte_walnut: { group: 'woodgrain', line: 'A soft, light walnut grain.' },
  espresso_walnut: { group: 'woodgrain', line: 'A rich, dark brown.' },
  platinum_teak: { group: 'woodgrain', line: 'A light, silvery teak grain.' },
  urban_teak: { group: 'woodgrain', line: 'A warm gray-brown teak grain.' },
  paint_ready: { group: 'paint', line: 'Primed and unpainted, ready to paint in any color you choose.' },
};

export const COLOR_GROUP_LABEL: Record<ColorInfo['group'], string> = {
  solid: 'Solid color',
  woodgrain: 'Woodgrain',
  gloss: 'High gloss',
  paint: 'Primed, paint any color',
};

export const HARDWARE_INFO: Record<string, HardwareInfo> = {
  bar: {
    pulls: [{ length: '4-1/2"', spread: '64 mm' }, { length: '6"', spread: '96 mm' }],
    projection: '1-1/4"',
  },
  artisan: {
    pulls: [{ length: '4-3/4"', spread: '96 mm' }, { length: '6-1/16"', spread: '128 mm' }],
    projection: '1-1/16"',
  },
  cottage: {
    pulls: [{ length: '4-1/2"', spread: '96 mm' }, { length: '5-7/8"', spread: '128 mm' }],
    projection: '1-1/4"',
  },
  arch: {
    pulls: [{ length: '6"' }, { length: '7-1/8"' }],
  },
  loft: {
    pulls: [{ length: '4-5/8"', spread: '96 mm' }, { length: '5-7/8"', spread: '128 mm' }],
    projection: '1-1/4"',
  },
  square: {
    pulls: [{ length: '4-1/4"', spread: '96 mm' }, { length: '5-7/16"', spread: '128 mm' }],
    projection: '1-3/8"',
  },
};

export const HARDWARE_NOTES = [
  'Pull lengths are overall; spread is center to center.',
  'The kit includes a pull locator so every hole lands in the same spot.',
  'Pulls carry a lifetime warranty.',
];

export const DURABUILD = {
  intro:
    'DuraBuild is a cabinet refacing line sold since 2017. Every door is furniture-grade MDF wrapped in a heat- and water-resistant film, and the back of every door matches the front.',
  highlights: [
    {
      title: 'Furniture-grade MDF',
      body: 'Wrapped in a high-tech film laminate that resists heat (to 212°F), water, scratches, stains and chemicals. CARB Phase II and ECO-Certified.',
    },
    { title: 'Matching backs', body: 'The same materials front and back, so open doors look as finished as closed ones.' },
    {
      title: 'Built to stay tight',
      body: 'Modern fasteners made for wrapped door frames hold every joint flush while the glue cures and for years after, and you can inspect them from the back of the door.',
    },
    { title: 'Ships in 5–8 business days', body: 'Complete kits are made to your measurements and ship in 5 to 8 business days.' },
    { title: 'No minimum order', body: 'One door, one apartment, or hundreds.' },
    { title: 'Built in the USA', body: 'Every kit is manufactured in the USA.' },
  ],
  kit: [
    'Custom doors, made to your measurements',
    'Drawer fronts and false fronts',
    'Hinges: soft-close or self-close, 6-way adjustable',
    'Pulls in your chosen style and finish',
    'Color-matched paint for your existing cabinet boxes',
    'Color-matched panels and moldings, cut to size',
    'Screws and bumpers',
    'Locator jigs for hinge pilot holes and door pulls',
    'QR-coded video instructions',
  ],
  guarantee: [
    { title: '30-day refund', body: 'Not happy with your installed kit? Get a full refund within 30 days of installation.' },
    { title: '6-year replacement', body: 'If any product fails in normal use within six years of purchase, it is replaced.' },
    { title: 'Lifetime warranty', body: 'Against delamination, and on hinges and hardware.' },
  ],
  faq: [
    {
      q: 'What is DuraBuild?',
      a: 'A cabinet door line sold since 2017. Doors are 5-piece rail-and-stile, plus a one-piece Slab, made from furniture-grade MDF wrapped in a heat- and water-resistant film. The front and back of every door match.',
    },
    {
      q: 'How many door styles and colors are there?',
      a: 'Five door styles and eighteen colors, including painted solids, woodgrains and a Paint Ready option. Not every color comes in every style, and the configurator only shows the colors each style is made in.',
    },
    {
      q: 'What comes in a kit?',
      a: 'Custom doors, drawer fronts, false fronts, hinges, pulls, matching paint for your cabinet boxes, screws, bumpers, locator jigs and QR-coded video instructions. A typical kit ships in 4 to 5 cartons.',
    },
    { q: 'How fast do kits ship?', a: 'Complete kits ship in 5 to 8 business days, and there is no minimum order. One door, one apartment, or hundreds.' },
    {
      q: 'What warranty covers DuraBuild?',
      a: 'The 3-Way Guarantee: a full refund within 30 days of installation, a 6-year product warranty with replacements, and a lifetime warranty against delamination and on hinges and hardware.',
    },
    { q: 'Can DuraBuild handle high-traffic properties?', a: 'Yes. The laminate surface resists scratches, stains, chemicals, and heat up to 212°F.' },
    { q: 'How do I know where to place the pulls on my doors?', a: 'Your kit includes a door-pull locator so you can drill the pull holes consistently and straight.' },
    { q: 'Do you offer custom colors?', a: 'Yes. Order Paint Ready doors. They come primed and ready for the color of your choice.' },
    {
      q: 'How do I clean DuraBuild doors?',
      a: 'Wipe them with a cloth dampened with soapy water. Avoid all-purpose cleaners, industrial cleaners and citrus-based degreasers.',
    },
    {
      q: 'What if my measurements were wrong?',
      a: 'Reorder the parts with the correct measurements. Orders of 10 or fewer parts ship within one business day. Custom-made parts cannot be returned.',
    },
  ],
};
