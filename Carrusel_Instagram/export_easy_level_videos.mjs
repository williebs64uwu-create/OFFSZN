// Exporta cada slide del carrusel como VIDEO (MP4 1080x1350, 30fps) + PNG final.
// Las animaciones CSS se avanzan frame a frame (Web Animations), así que el resultado es exacto, sin lag.
// Uso:  node export_easy_level_videos.mjs [salida=easy_level/export_video]
// Requiere: playwright (npm i playwright) y ffmpeg en el PATH.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const html = resolve(here, 'easy_level_carrusel.html');
const out = resolve(process.argv[2] || resolve(here, 'easy_level/export_video'));
const FPS = 30, W = 420, H = 525, SCALE = 1080 / 420;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME, args: ['--no-sandbox'] } : {});
const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE })).newPage();
await page.goto(pathToFileURL(html).href);
await page.waitForTimeout(2500); // fuentes
await page.evaluate(() => {
  document.querySelector('.ig-frame').style.cssText = 'width:420px;height:525px;border-radius:0;box-shadow:none;overflow:hidden;margin:0;';
  document.querySelector('.carousel-viewport').style.cssText = 'width:420px;height:525px;overflow:hidden;';
  document.body.style.cssText = 'padding:0;margin:0;display:block;overflow:hidden;';
});
const durs = await page.evaluate(() => [...document.querySelectorAll('.slide')].map((s) => +s.dataset.dur || 6));

for (let i = 0; i < durs.length; i++) {
  await page.evaluate((k) => { const t = document.querySelector('.carousel-track'); t.style.transition = 'none'; t.style.transform = `translateX(${-k * 420}px)`; }, i);
  const seek = (ms) => page.evaluate((t) => { document.getAnimations().forEach((a) => { a.pause(); a.currentTime = t; }); }, ms);
  const file = resolve(out, `slide_${i + 1}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((r) => ff.on('close', r));
  const frames = durs[i] * FPS;
  for (let f = 0; f < frames; f++) {
    await seek((f * 1000) / FPS);
    ff.stdin.write(await page.screenshot({ type: 'jpeg', quality: 95, clip: { x: 0, y: 0, width: W, height: H } }));
  }
  ff.stdin.end(); await done;
  await seek(durs[i] * 1000);
  await page.screenshot({ path: resolve(out, `slide_${i + 1}.png`), clip: { x: 0, y: 0, width: W, height: H } });
  console.log(`slide_${i + 1}: ${durs[i]}s -> ${file}`);
}
await browser.close();
