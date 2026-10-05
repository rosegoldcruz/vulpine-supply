/**
 * Generates Vulpi's voice clips with ElevenLabs into public/audio/fox/ and writes manifest.json.
 *
 *   ELEVENLABS_API_KEY=... npx tsx scripts/generate-fox-voice.ts [--only id1,id2] [--force] [--model eleven_multilingual_v2]
 *
 * The on-screen text is LINES in components/fox/script.ts (never changed here). TAKES below is what gets spoken:
 * the same words plus at most one Eleven v3 audio tag ([warmly], [chuckles], ...) for delivery, and name-free takes for the
 * lines that greet the visitor by name. Existing non-empty clips are skipped unless --force, so a rerun only retries
 * failures. The key is read from the environment and never printed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { allLines } from '../components/fox/script';

const VOICE_ID = 'wjmqZXrn8gXehtR3rCeK'; // "construction fox"
const OUT = path.join(process.cwd(), 'public', 'audio', 'fox');
const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const opt = (n: string) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const MODEL = opt('--model') || 'eleven_v3';
const ONLY = opt('--only')?.split(',');

/** Spoken takes: the subtitle's exact words plus at most one v3 tag, only where it adds life. `{name}` lines are name-free. */
export const TAKES: Record<string, string> = {
  hello: "[warmly] Hey, I'm Vulpi, let's make this kitchen look sharp.",
  hello_back: "Welcome back, your design kept your seat warm.",
  start_style: "Pick a door style and watch the room change.",
  quiet: "[chuckles] Got it, I'll lie low until you need me.",
  style_shaker_classic: "Shaker Classic, the one that never goes out of style.",
  style_shaker_slide: "Shaker Slide, classic lines on a slimmer frame.",
  style_slab: "Slab, flat and quiet, letting the finish do the talking.",
  style_fusion_shaker: "Fusion Classic, old-school bones with a modern edge.",
  style_fusion_slide: "Fusion Slide, sleek, slim, and a little bit bold.",
  next_finish: "[excited] Now the fun part, pick your finish.",
  finish_light: "Light and bright, this kitchen just grew a size.",
  finish_gloss: "[impressed] Snow Gloss, now that's a kitchen that shines.",
  finish_mid: "A cool gray that plays it smooth.",
  finish_dark: "[intrigued] Dark and dramatic, now we're talking.",
  finish_wood: "Wood grain brings the warmth, nicely done.",
  next_hardware: "Last step: hardware, the kitchen's jewelry.",
  hw_arch: "Arch, a soft curve with serious style.",
  hw_artisan: "Artisan, handcrafted character in every pull.",
  hw_bar: "Bar pulls, simple, sturdy, and always sharp.",
  hw_cottage: "Cottage, soft curves with a warm welcome.",
  hw_loft: "Loft, lean and industrial with a little attitude.",
  hw_square: "Square, crisp edges for a clean, modern look.",
  hwf_matte_black: "[confidently] Matte black, never not cool.",
  hwf_satin_nickel: "Satin nickel, a soft sheen that's easy to live with.",
  hwf_chrome: "Chrome, polished and catching every bit of light.",
  hwf_rose_gold: "[playfully] Rose gold, warm, unexpected, and totally worth it.",
  view_3d: "Drag to look around, then zoom in close.",
  all_set: "[pleased] Good taste, let's lock it in.",
  q_intro: "Happy to, just a few quick questions.",
  q_name: "First, what's your name?",
  q_phone: "Nice to meet you, what's your best phone number?",
  q_email: "And your email, so I can send your design?",
  q_need_contact: "I'll need a phone or an email to reach you.",
  q_bad_email: "[curious] Hmm, that email looks a little off.",
  q_address: "What's the property address, or just city and ZIP?",
  q_photos: "Add a few photos of your current kitchen, or skip it.",
  q_review: "Here's what I'll send, look right?",
  q_sending: "Sending it over now.",
  q_done: "[excited] Done, your custom quote is in the works.",
  q_error: "[gently] Something went wrong, try again or use the full form.",
};

const strip = (t: string) => t.replace(/\[[^\]]+\]\s*/g, '').trim();
const plain = (t: string) => t.replace(/,?\s*\{name\}/g, '').replace(/\s+/g, ' ').trim();

async function tts(text: string): Promise<Buffer> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set');
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: MODEL,
      // v3 only accepts stability 0 (creative) / 0.5 (natural) / 1 (robust)
      voice_settings: { stability: MODEL === 'eleven_v3' ? 0.5 : 0.45, similarity_boost: 0.8 },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return Buffer.from(await res.arrayBuffer());
}

const duration = (file: string) =>
  Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString().trim());

async function main() {
  const lines = allLines();
  const ids = new Set(lines.map((l) => l.id));
  const missingTake = lines.filter((l) => !TAKES[l.id]).map((l) => l.id);
  const extra = Object.keys(TAKES).filter((id) => !ids.has(id));
  const tooManyTags = Object.entries(TAKES).filter(([, t]) => (t.match(/\[[^\]]+\]/g) || []).length > 1).map(([id]) => id);
  const mismatch = lines.filter((l) => TAKES[l.id] && strip(TAKES[l.id]) !== plain(l.text)).map((l) => l.id);
  if (missingTake.length || extra.length || mismatch.length || tooManyTags.length) {
    console.error('TAKES out of sync with script.ts', { missingTake, extra, mismatch, tooManyTags });
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });
  const failed: string[] = [];
  for (const l of lines) {
    if (ONLY && !ONLY.includes(l.id)) continue;
    const file = path.join(OUT, `${l.id}.mp3`);
    if (!flag('--force') && fs.existsSync(file) && fs.statSync(file).size > 1000) continue;
    const text = MODEL === 'eleven_v3' ? TAKES[l.id] : strip(TAKES[l.id]);
    try {
      const buf = await tts(text);
      if (buf.length < 1000) throw new Error(`tiny response (${buf.length} B)`);
      fs.writeFileSync(file, buf);
      console.log(`ok   ${l.id}  ${(buf.length / 1024).toFixed(0)} KB  ${duration(file).toFixed(2)} s`);
    } catch (e) {
      failed.push(l.id);
      console.log(`FAIL ${l.id}  ${(e as Error).message}`);
    }
  }
  // clips of lines that no longer exist (e.g. the old knobs / pulls lines) are removed
  for (const f of fs.readdirSync(OUT)) {
    const id = f.replace(/\.mp3$/, '');
    if (f.endsWith('.mp3') && !ids.has(id)) {
      fs.rmSync(path.join(OUT, f));
      console.log(`rm   ${f} (no such line)`);
    }
  }
  // manifest: every line with a non-empty clip, plus its duration (the fox times the talk clip to it)
  const manifest = { voice: 'construction fox', model: MODEL, lines: {} as Record<string, string>, durations: {} as Record<string, number> };
  for (const l of lines) {
    const file = path.join(OUT, `${l.id}.mp3`);
    if (!fs.existsSync(file) || fs.statSync(file).size < 1000) continue;
    manifest.lines[l.id] = `${l.id}.mp3`;
    manifest.durations[l.id] = Math.round(duration(file) * 100) / 100;
  }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`manifest: ${Object.keys(manifest.lines).length}/${lines.length} clips; failed: ${failed.join(', ') || 'none'}`);
  if (failed.length) process.exitCode = 2;
}

main();
