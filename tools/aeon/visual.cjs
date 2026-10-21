const { chromium } = require('/home/aeon/factory/engineering/runtime/browser/node_modules/playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const [work, out] = process.argv.slice(2);
(async () => {
  const server = spawn(process.execPath, [work + '/node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', '4317'], { cwd: work, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  const log = fs.createWriteStream(out + '/preview.log');
  server.stdout.pipe(log); server.stderr.pipe(log);
  let browser;
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try { const r = await fetch('http://127.0.0.1:4317/', { signal: AbortSignal.timeout(1500) }); await r.body?.cancel(); if (r.status === 200) { ready = true; break; } } catch {}
      await new Promise(r => setTimeout(r, 300));
    }
    if (!ready) throw new Error('isolated website preview unavailable');
    console.log('isolated preview ready');
    browser = await chromium.launch({ headless: true, timeout: 30000, args: ['--disable-dev-shm-usage', '--in-process-gpu', '--use-gl=angle', '--use-angle=swiftshader'] });
    console.log('Chromium launched');
    const results = [];
    for (const [name, width, height] of [['desktop',1440,1000],['mobile',390,844]]) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
      // No outbound requests and no production form submissions.
      await context.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:4317/') ? route.continue() : route.abort());
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      const response = await page.goto('http://127.0.0.1:4317/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1500);
      if (response.status() !== 200) throw new Error('homepage failed');
      if (await page.locator('body').innerText().then(s => s.length) < 100) throw new Error('empty homepage');
      if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2)) throw new Error('horizontal overflow');
      await page.screenshot({ path: out + '/' + name + '.png' });
      console.log(name + ' screenshot captured');
      results.push({ name, width, height, http: response.status(), pageErrors: errors });
      await context.close();
      if (errors.length) throw new Error('browser runtime errors: ' + errors.join(';'));
    }
    fs.writeFileSync(out + '/visual.json', JSON.stringify(results, null, 2));
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
    await new Promise(resolve => { const t = setTimeout(() => { server.kill('SIGKILL'); resolve(); }, 5000); server.on('exit', () => { clearTimeout(t); resolve(); }); });
    log.end();
  }
})().catch(e => { console.error(e.message); process.exitCode = 1; });
