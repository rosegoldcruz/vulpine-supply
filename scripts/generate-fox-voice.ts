/**
 * Generates Vulpi's voice clips with ElevenLabs into public/audio/fox/ and writes manifest.json.
 *
 *   ELEVENLABS_API_KEY=... npx tsx scripts/generate-fox-voice.ts [--only id1,id2] [--force] [--model eleven_multilingual_v2]
 *
 * The on-screen text is LINES in components/fox/script.ts (never changed here). TAKES below is what gets spoken:
 * the same words plus Eleven v3 audio tags ([warmly], [chuckles], ...) for delivery, and name-free takes for the
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

/** Spoken takes: the subtitle's words + 1-2 v3 tags. `{name}` lines are generic (name-free). */
export const TAKES: Record<string, string> = {
  hello: "[warmly] Hi, I'm Vulpi. I'll walk you through it in three easy picks: door style, then finish, then hardware.",
  hello_back: '[warmly] Welcome back. Your last design is still here. Pick up wherever you like.',
  start_style: '[encouraging] Start with a door style. Tap one and the kitchen updates right away.',
  quiet: "[chuckles] Got it. I'll stay out of the way. [softly] Tap me if you want a hand.",
  style_shaker_classic: '[approvingly] Shaker Classic. Recessed panel, clean frame. It has outlasted every trend for a reason.',
  style_shaker_slide: '[thoughtfully] Shaker Slide. A slimmer frame, so it reads lighter. Classic, just a little more modern.',
  style_slab: '[calmly] Slab. Flat and quiet. It lets the finish and the hardware do the talking.',
  style_fusion_shaker: '[pleased] Fusion Classic. Shaker bones with a modern edge. [chuckles] Plays well with both worlds.',
  style_fusion_slide: '[interested] Fusion Slide. Slim profile with a fresh detail. Nice choice for a contemporary space.',
  next_finish: '[excited] Next, the finish. Every swatch is a photo of a real door.',
  finish_light: '[warmly] Bright and timeless. Light doors make a kitchen feel bigger and they forgive almost any countertop.',
  finish_gloss: '[impressed] Snow Gloss. That shine bounces light around the room. Very sharp with slim hardware.',
  finish_mid: '[thoughtfully] A soft gray. Calm, versatile, and it hides the everyday smudges better than white.',
  finish_dark: '[intrigued] Deep and dramatic. Dark doors look great with light counters and warm metals.',
  finish_wood: '[warmly] Wood grain brings warmth you can feel. Pairs nicely with black or satin nickel hardware.',
  next_hardware: '[excited] Last step: hardware. Pick a style and a finish below. [chuckles] It changes the whole personality.',
  hw_arch: '[softly] Arch. A gentle curve that softens all those straight lines.',
  hw_artisan: '[appreciatively] Artisan. Handcrafted feel, a little character. Lovely with wood and warm finishes.',
  hw_bar: '[confidently] Bar pulls. Simple, sturdy, works with everything. [chuckles] The safe pick that still looks sharp.',
  hw_cottage: '[warmly] Cottage. Soft curves, very welcoming. Great in a farmhouse or classic kitchen.',
  hw_loft: '[matter-of-fact] Loft. Industrial and lean. Very good with slab doors and darker finishes.',
  hw_square: '[approvingly] Square. Crisp geometry. A small detail that makes a modern kitchen look intentional.',
  hwf_matte_black: '[confidently] Matte black. Strong contrast on light doors, quietly sleek on dark ones.',
  hwf_satin_nickel: '[casually] Satin nickel. Soft sheen, hides fingerprints, goes with stainless appliances.',
  hwf_chrome: '[excited] Chrome. Bright and polished. It catches the light every time you open a drawer.',
  hwf_rose_gold: '[playfully] Rose gold. Warm and a little unexpected. Beautiful against white and gray.',
  knobs: '[approvingly] Knobs on the doors, pulls on the drawers. A classic combination.',
  pulls: '[casually] Pulls everywhere. Easy to grab and very consistent.',
  view_3d: '[excited] Drag to look around. [whispers] Try Close-up door to see the profile and the hardware up close.',
  all_set: "[laughs softly] That's a good-looking kitchen. [warmly] When you're ready, I can send it to our team for a custom quote. No pressure.",
  q_intro: "[warmly] Happy to. I'll ask a few quick questions so our team can put together a custom quote for this exact design.",
  q_name: "[friendly] First, what's your name?",
  q_phone: '[warmly] Nice to meet you. What is the best phone number to reach you?',
  q_email: '[casually] And your email? We will send your design summary there too.',
  q_need_contact: '[gently] I need at least a phone number or an email so the team can reach you.',
  q_bad_email: "[curious] Hmm, that email doesn't look quite right. Mind checking it?",
  q_address: '[casually] What is the property address? City and ZIP are fine if you prefer.',
  q_photos: '[helpfully] Optional: add a few photos of the current kitchen. It helps us measure and plan. You can skip this.',
  q_review: '[cheerfully] Here is what I will send. Look right?',
  q_sending: '[focused] Sending it over…',
  q_done: '[excited] Done. Our team will review your design and reach out with a custom quote. [warmly] Thanks for designing with us.',
  q_error: '[sighs] Something went wrong on my end. Try again, or use the full request form.',
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
  const mismatch = lines.filter((l) => TAKES[l.id] && strip(TAKES[l.id]) !== plain(l.text)).map((l) => l.id);
  if (missingTake.length || extra.length || mismatch.length) {
    console.error('TAKES out of sync with script.ts', { missingTake, extra, mismatch });
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
