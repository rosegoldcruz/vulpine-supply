# Vulpi, the configurator guide

Vulpi is the fox in the bottom-right corner of `/visualizer` (formerly `/configurator`, which redirects). He idles, waves now and then, wakes on the visitor's first
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
  nudge to hardware. Hardware style, hardware finish and the first switch to 3D each get one line (the visualizer shows pulls only, so the old
  knobs/pulls lines are gone). Once all three
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
  and never covers it. The speech bubble sits **under** him (tail pointing up), compact (≤270 px wide, 13 px text, small
  buttons), so it doesn't cover the photo / 3D stage; it stays above the bottom sheet. The chat spans the width above him.
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

## Voice (ElevenLabs)

**Tone:** hip, sly, confident and professional. Every line is one spoken sentence of 3–10 words (rewritten Oct 4 2026).

All 40 lines have clips in `public/audio/fox/<line id>.mp3` (about 2 MB, 121 s total), generated with ElevenLabs
**Eleven v3** (`eleven_v3`, voice "construction fox" `wjmqZXrn8gXehtR3rCeK`, `mp3_44100_128`, stability 0.5 "Natural"
(v3 only takes 0 / 0.5 / 1), similarity 0.8). `public/audio/fox/manifest.json` lists them with their durations:

```json
{ "lines": { "hello": "hello.mp3" }, "durations": { "hello": 2.9 } }
```

To regenerate: `ELEVENLABS_API_KEY=... npx tsx scripts/generate-fox-voice.ts` (existing clips are skipped, so a rerun only
retries failures; `--force` redoes everything, `--only id1,id2` picks lines, `--model eleven_multilingual_v2` drops the tags).
The script's `TAKES` are the spoken versions: the subtitle's exact words plus **at most one** v3 audio tag (`[warmly]`,
`[chuckles]`, `[excited]`, `[impressed]`...). It refuses to run if a take's words drift from `script.ts` or a take has more
than one tag, and it deletes clips of lines that no longer exist. Tags are never shown: the bubble and chat always use
`LINES` text. `q_phone` and `q_done` greet the visitor by name on screen; their clips are name-free takes.
The full set of 40 lines costs about 870 TTS characters per regeneration (Oct 4 2026 run: 872).
Subtitles were checked against the audio with ElevenLabs speech-to-text (`scribe_v1`).

Voice is **off by default**. A speaker toggle appears next to the fox when the manifest has clips; the preference is stored
in `localStorage['vulpine-fox-muted']`. Playback is autoplay-safe: nothing plays before the visitor has interacted with the
page *and* turned the voice on, and a blocked `play()` falls back to text silently. While a clip plays, the talk animation
runs for the clip's real duration (browser metadata, or the manifest's ffprobe duration until it arrives); without a clip it
uses a reading-time estimate. To make the voice opt-out instead of opt-in, flip `FOX_VOICE_DEFAULT_ON` in
`components/fox/voice.ts`.

### Line ids

| id | move | text | v3 tag |
|---|---|---|---|
| `hello` | wave | Hey, I'm Vulpi, let's make this kitchen look sharp. | `[warmly]` |
| `hello_back` | wave | Welcome back, your design kept your seat warm. |  |
| `start_style` | point | Pick a door style and watch the room change. |  |
| `quiet` | idle | Got it, I'll lie low until you need me. | `[chuckles]` |
| `style_shaker_classic` | talk | Shaker Classic, the one that never goes out of style. |  |
| `style_shaker_slide` | talk | Shaker Slide, classic lines on a slimmer frame. |  |
| `style_slab` | talk | Slab, flat and quiet, letting the finish do the talking. |  |
| `style_fusion_shaker` | talk | Fusion Classic, old-school bones with a modern edge. |  |
| `style_fusion_slide` | talk | Fusion Slide, sleek, slim, and a little bit bold. |  |
| `next_finish` | point | Now the fun part, pick your finish. | `[excited]` |
| `finish_light` | talk | Light and bright, this kitchen just grew a size. |  |
| `finish_gloss` | talk | Snow Gloss, now that's a kitchen that shines. | `[impressed]` |
| `finish_mid` | talk | A cool gray that plays it smooth. |  |
| `finish_dark` | talk | Dark and dramatic, now we're talking. | `[intrigued]` |
| `finish_wood` | talk | Wood grain brings the warmth, nicely done. |  |
| `next_hardware` | point | Last step: hardware, the kitchen's jewelry. |  |
| `hw_arch` | talk | Arch, a soft curve with serious style. |  |
| `hw_artisan` | talk | Artisan, handcrafted character in every pull. |  |
| `hw_bar` | talk | Bar pulls, simple, sturdy, and always sharp. |  |
| `hw_cottage` | talk | Cottage, soft curves with a warm welcome. |  |
| `hw_loft` | talk | Loft, lean and industrial with a little attitude. |  |
| `hw_square` | talk | Square, crisp edges for a clean, modern look. |  |
| `hwf_matte_black` | talk | Matte black, never not cool. | `[confidently]` |
| `hwf_satin_nickel` | talk | Satin nickel, a soft sheen that's easy to live with. |  |
| `hwf_chrome` | talk | Chrome, polished and catching every bit of light. |  |
| `hwf_rose_gold` | talk | Rose gold, warm, unexpected, and totally worth it. | `[playfully]` |
| `view_3d` | talk | Drag to look around, then zoom in close. |  |
| `all_set` | celebrate | Good taste, let's lock it in. | `[pleased]` |
| `q_intro` | talk | Happy to, just a few quick questions. |  |
| `q_name` | talk | First, what's your name? |  |
| `q_phone` | talk | Nice to meet you, {name}, what's your best phone number? |  |
| `q_email` | talk | And your email, so I can send your design? |  |
| `q_need_contact` | talk | I'll need a phone or an email to reach you. |  |
| `q_bad_email` | talk | Hmm, that email looks a little off. | `[curious]` |
| `q_address` | talk | What's the property address, or just city and ZIP? |  |
| `q_photos` | talk | Add a few photos of your current kitchen, or skip it. |  |
| `q_review` | talk | Here's what I'll send, look right? |  |
| `q_sending` | talk | Sending it over now. |  |
| `q_done` | celebrate | Done, {name}, your custom quote is in the works. | `[excited]` |
| `q_error` | talk | Something went wrong, try again or use the full form. | `[gently]` |

- **Quote from AR:** `openQuote({ photos, note })` (ref API) opens the quote chat with files pre-attached (merged into the
  photo step, max 5) and a note appended to the message; the chat shows "📷 Snapshot from View in your space attached".
  The AR studio's **Get a quote with this** uses it.

## In AR

The in-page camera AR studio (the default since 2026-10-04) does not show Vulpi, so he never blocks the view. The
WebXR true-scale mode started from the studio also runs without him (`withFox: false`). The older path below is kept in
code for the full-kitchen WebXR session but is no longer reachable from the button; the USDZ / Quick Look handoff was removed.

### Legacy full-kitchen WebXR

`components/configurator/scene/ar.ts` loads the same model through `loadFoxRig()` (a SkeletonUtils clone + `AnimationMixer`
+ `buildFoxClips`). He stands to the right of the cabinet run, facing the viewer and turned slightly toward the run
(`FOX_FACE_PLUS_Z - 0.45`). He idles, **waves when the kitchen is first placed**, and his mixer runs in the XR frame loop.
For iOS Quick Look the USDZ export bakes the skinned mesh in the **idle pose** (not the T-pose), because Quick Look cannot
play these animations. Neither path has been tested on a real device yet.
