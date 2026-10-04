# Vulpi, the configurator guide

Vulpi is the fox in the bottom-right corner of `/configurator`. He idles, waves now and then, wakes on the visitor's first
click/tap/key, walks them through **style → finish → hardware**, reacts to their picks, and turns **Request a quote** into a
short conversation that submits through the existing `/api/request-bid` intake. He never mentions prices. He promises a
**custom quote** instead.

Code: `components/fox/` (`clips.ts` clip lookup, `stage.ts` WebGL stage, `script.ts` lines, `voice.ts` audio hook,
`FoxGuide.tsx` guide + bubbles, `QuoteChat.tsx` quote conversation, `FoxGuide.module.css`). Mounted from
`components/configurator/CabinetConfigurator.tsx`.

## Model

- Site model: `public/GLB/vulpi_fox.glb`, DevGod's re-rig (`vulpi_fox_rerig.glb`, Oct 4 2026; 0.92 MB, Draco +
  `EXT_texture_webp`, decoded with `/draco/`). The previous file is kept as `public/GLB/vulpi_fox_v1.glb` (old 39-bone rig,
  22 unnamed `NlaTrack*` clips) and is no longer loaded.
- Y-up, **faces +Z**, feet at **y = 0**, **1.0 m tall**, hips over the origin. The rest pose is a relaxed stand (no T-pose).
  `FOX_FACE_PLUS_Z = 0`; the corner stage turns him −0.5 rad (toward the page) and AR −0.45 rad (toward the cabinet run).
- 58 bones with Mixamo names plus extras (tail, ears, eyes, jaw). three.js strips the `:`, so the loaded bones are
  `mixamorigHips`, `mixamorigLeftHand`, …, and the clip tracks use the same sanitized names.
- Poster image (shown while loading, or if WebGL is unavailable): `public/models/fox/vulpi-poster.webp`. It is a 264×336
  transparent still of the idle pose, rendered from the model by difference matting (`shots-tool/fox-poster.mjs`).

## Clips (`components/fox/clips.ts`)

The six moves are named glTF animations, looked up with `THREE.AnimationClip.findByName`. Every clip keys every bone on
every frame, so nothing leaks between clips and no trimming, bone masks or root-motion stripping is needed.

| move | duration | loop | content |
|---|---|---|---|
| `idle` | 4.0 s | repeat | breathing, head drift, weight shift, tail sway, ear twitches, blinks |
| `wave` | 2.8 s | once | right-arm wave, palm to camera |
| `talk` | 3.2 s | repeat | nods, jaw, explaining hand gestures |
| `point` | 2.6 s | once | right arm points to screen left (toward the page) |
| `celebrate` | 2.2 s | once | crouch, small jump, fists up |
| `walk` | 1.07 s | repeat | in-place walk cycle |

Crossfades are 0.3 s between clips and 0.2 s into `walk` (`fadeFor`). One-shot clips start and end at the rest pose; they
run with `clampWhenFinished = false` and the mixer `finished` event fades back to `idle`.

## Behaviour

- **Corner presence:** lazy-loaded after the page is idle (`requestIdleCallback`). The stage is a small transparent WebGL
  canvas that renders at ≤30 fps, and only while it is on screen and the tab is visible. Before waking he waves about 1.8 s
  after loading, then up to 3 more times, 16 s apart.
- **Wake:** on the first `pointerdown`/`keydown` anywhere he waves and says hello, with *Show me around* / *I'm just
  browsing*. Returning visitors (`vulpine-fox-seen`) get a shorter welcome back.
- **Narration and reactions:** a pick is debounced (650 ms) and never interrupts the hello. Each line is said once per
  visit. Picking a style gets a style line plus a nudge to the finish (point). Picking a finish gets a finish reaction plus a
  nudge to hardware. Hardware style, hardware finish, knobs/pulls and the first switch to 3D each get one line. Once all three
  steps have been touched, he celebrates and offers *Get my custom quote* / *Keep exploring*.
- **Finish reactions** use `finishBucket`: light (Flour, Oat, Cloudstone, Mist), gloss (Snow Gloss), dark (Graphite,
  Slate, Espresso Walnut), wood (oaks, walnuts, teaks), mid (Storm). Sage and Paint Ready have no fitting line, so he skips
  the finish reaction and goes straight to the hardware nudge.
- Bubbles auto-hide about 9 s after the line ends, unless they carry buttons. Tapping the fox re-opens help.
- **Quote:** both **Request a quote** links (the final CTA and the mobile sheet's *Quote*) open the chat when Vulpi is active.
  Ctrl-, cmd- and shift-clicks, and clicks while he is dismissed, still go to `/request-bid?configuration=…` as before.
- **Dismissal:** the × next to him stores `localStorage['vulpine-fox-dismissed']='1'`. He stays gone across visits. A small
  *Bring back Vulpi, the design guide* link under the final CTA restores him.
- **Reduced motion** (`prefers-reduced-motion: reduce`): no animation loop and no auto-waves. He shows single still poses
  (idle, or a frame of the gesture), and bubble and chat animations are off.
- **Mobile (≤700 px):** he is smaller (84×108). He sits above the bottom sheet, because `CabinetConfigurator` publishes the
  sheet's live height as `--config-sheet-h` and the guide is positioned from it. That way he moves up when the sheet opens
  and never covers it. The chat spans the width above him.
- Hidden when printing. Inside a WebXR session the DOM overlay does not include him.

## Quote conversation (`QuoteChat.tsx`)

The steps are: name → phone (optional, with the SMS consent checkbox and `SMS_CONSENT_TEXT`) → email (optional if a phone
was given; at least one is required) → property address (street, or city + ZIP) → optional photos (up to 5) → review
(*Edit* / *Send for my custom quote*) → done (celebrate). A *Prefer the full form?* link stays visible until the end.

It posts to `/api/request-bid`:

- `name`, `phone`, `email`, `address`, `projectLocation`, `projectType: "Cabinet configurator"`
- `projectDetails`: the same configuration summary the `/request-bid` prefill uses, plus design ref, property address,
  photo count, and "Sent through Vulpi"
- `source: "/configurator (Vulpi)"`, `pageUrl`, `utm_*`, `smsConsent`

Without photos the body is JSON. With photos it is `multipart/form-data`. Photos are downscaled in the browser to ≤1600 px
JPEG and sent as repeated `photos` fields.

**Server change:** `app/api/contact/route.js` (re-exported by `/api/request-bid`) separates image files (`photos`, ≤5,
≤8 MB each, `image/*`) from the text fields in multipart bodies. Those files are kept out of NocoDB and `raw_payload`. After
the normal lead message, they are forwarded to the same Telegram chat with `sendTelegramPhotos` (`lib/telegram.ts`: one
photo uses `sendPhoto`, several use `sendMediaGroup`). This step is best-effort: a failure is logged and never fails the
lead.

## Voice (ElevenLabs, later)

Voice is **off by default** and entirely text-only until clips exist. To add a voice:

1. Generate one clip per line id below (mp3 recommended) into `public/audio/fox/`.
2. List the clips in `public/audio/fox/manifest.json`:
   ```json
   { "lines": { "hello": "hello.mp3", "style_slab": "style_slab.mp3" } }
   ```
   Missing ids just stay text-only.
3. When the manifest has at least one clip, a speaker toggle appears next to the fox. The preference is stored in
   `localStorage['vulpine-fox-muted']`.

Playback is autoplay-safe. Nothing plays before the visitor has interacted with the page *and* turned the voice on, and a
blocked `play()` falls back to text silently. While a clip plays, the talk animation runs for the clip's real duration;
without a clip it uses a reading-time estimate. To make the voice opt-out instead of opt-in, flip `FOX_VOICE_DEFAULT_ON` in
`components/fox/voice.ts`. Lines containing `{name}` (`q_phone`, `q_done`) are personalised. Record a generic take for those
or leave them text-only.

### Line ids

| id | move | text |
|---|---|---|
| `hello` | wave | Hi, I'm Vulpi. I'll walk you through it in three easy picks: door style, then finish, then hardware. |
| `hello_back` | wave | Welcome back. Your last design is still here. Pick up wherever you like. |
| `start_style` | point | Start with a door style. Tap one and the kitchen updates right away. |
| `quiet` | idle | Got it. I'll stay out of the way. Tap me if you want a hand. |
| `style_shaker_classic` | talk | Shaker Classic. Recessed panel, clean frame. It has outlasted every trend for a reason. |
| `style_shaker_slide` | talk | Shaker Slide. A slimmer frame, so it reads lighter. Classic, just a little more modern. |
| `style_slab` | talk | Slab. Flat and quiet. It lets the finish and the hardware do the talking. |
| `style_fusion_shaker` | talk | Fusion Classic. Shaker bones with a modern edge. Plays well with both worlds. |
| `style_fusion_slide` | talk | Fusion Slide. Slim profile with a fresh detail. Nice choice for a contemporary space. |
| `next_finish` | point | Next, the finish. Every swatch is a photo of a real door. |
| `finish_light` | talk | Bright and timeless. Light doors make a kitchen feel bigger and they forgive almost any countertop. |
| `finish_gloss` | talk | Snow Gloss. That shine bounces light around the room. Very sharp with slim hardware. |
| `finish_mid` | talk | A soft gray. Calm, versatile, and it hides the everyday smudges better than white. |
| `finish_dark` | talk | Deep and dramatic. Dark doors look great with light counters and warm metals. |
| `finish_wood` | talk | Wood grain brings warmth you can feel. Pairs nicely with black or satin nickel hardware. |
| `next_hardware` | point | Last step: hardware. Pick a style and a finish below. It changes the whole personality. |
| `hw_arch` | talk | Arch. A gentle curve that softens all those straight lines. |
| `hw_artisan` | talk | Artisan. Handcrafted feel, a little character. Lovely with wood and warm finishes. |
| `hw_bar` | talk | Bar pulls. Simple, sturdy, works with everything. The safe pick that still looks sharp. |
| `hw_cottage` | talk | Cottage. Soft curves, very welcoming. Great in a farmhouse or classic kitchen. |
| `hw_loft` | talk | Loft. Industrial and lean. Very good with slab doors and darker finishes. |
| `hw_square` | talk | Square. Crisp geometry. A small detail that makes a modern kitchen look intentional. |
| `hwf_matte_black` | talk | Matte black. Strong contrast on light doors, quietly sleek on dark ones. |
| `hwf_satin_nickel` | talk | Satin nickel. Soft sheen, hides fingerprints, goes with stainless appliances. |
| `hwf_chrome` | talk | Chrome. Bright and polished. It catches the light every time you open a drawer. |
| `hwf_rose_gold` | talk | Rose gold. Warm and a little unexpected. Beautiful against white and gray. |
| `knobs` | talk | Knobs on the doors, pulls on the drawers. A classic combination. |
| `pulls` | talk | Pulls everywhere. Easy to grab and very consistent. |
| `view_3d` | talk | Drag to look around. Try Close-up door to see the profile and the hardware up close. |
| `all_set` | celebrate | That's a good-looking kitchen. When you're ready, I can send it to our team for a custom quote. No pressure. |
| `q_intro` | talk | Happy to. I'll ask a few quick questions so our team can put together a custom quote for this exact design. |
| `q_name` | talk | First, what's your name? |
| `q_phone` | talk | Nice to meet you, {name}. What is the best phone number to reach you? |
| `q_email` | talk | And your email? We will send your design summary there too. |
| `q_need_contact` | talk | I need at least a phone number or an email so the team can reach you. |
| `q_bad_email` | talk | Hmm, that email doesn't look quite right. Mind checking it? |
| `q_address` | talk | What is the property address? City and ZIP are fine if you prefer. |
| `q_photos` | talk | Optional: add a few photos of the current kitchen. It helps us measure and plan. You can skip this. |
| `q_review` | talk | Here is what I will send. Look right? |
| `q_sending` | talk | Sending it over… |
| `q_done` | celebrate | Done, {name}. Our team will review your design and reach out with a custom quote. Thanks for designing with us. |
| `q_error` | talk | Something went wrong on my end. Try again, or use the full request form. |

## In AR (Android WebXR)

`components/configurator/scene/ar.ts` loads the same model through `loadFoxRig()` (a SkeletonUtils clone + `AnimationMixer`
+ `buildFoxClips`). He stands to the right of the cabinet run, facing the viewer and turned slightly toward the run
(`FOX_FACE_PLUS_Z - 0.45`). He idles, **waves when the kitchen is first placed**, and his mixer runs in the XR frame loop.
For iOS Quick Look the USDZ export bakes the skinned mesh in the **idle pose** (not the T-pose), because Quick Look cannot
play these animations. Neither path has been tested on a real device yet.
