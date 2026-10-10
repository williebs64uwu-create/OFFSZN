// EASY MIX V3 · exporta el carrusel: slide 1 = PNG fijo; slides 2..N = MP4 1080x1350 de 15 s
// (3 s de animación a 30 fps y el resto estático, para que se quede). Todas dejan además un PNG del estado final.
// Uso:  node export_easy_mix_videos.mjs [salida=easy_mix_v3/export]
// Requiere: playwright (npm i playwright) y ffmpeg en el PATH.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = process.env.CAROUSEL_DIR || dirname(fileURLToPath(import.meta.url));
const html = resolve(here, 'easy_mix_v3_carrusel.html');
const out = resolve(process.argv[2] || resolve(here, 'easy_mix_v3/export'));
const FPS = 30, W = 420, H = 525, SCALE = 1080 / 420, TOTAL = 15;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME, args: ['--no-sandbox', '--allow-file-access-from-files'] } : { args: ['--allow-file-access-from-files'] });
const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE })).newPage();
await page.goto(pathToFileURL(html).href);
await page.waitForTimeout(2500); // fuentes
await page.evaluate(() => {
  document.querySelector('.ig-frame').style.cssText = 'width:420px;height:525px;border-radius:0;box-shadow:none;overflow:hidden;margin:0;';
  document.querySelector('.carousel-viewport').style.cssText = 'width:420px;height:525px;overflow:hidden;';
  document.body.style.cssText = 'padding:0;margin:0;display:block;overflow:hidden;';
});
const slides = await page.evaluate(() => [...document.querySelectorAll('.slide')].map((s) => ({ still: !!s.dataset.still, anim: +s.dataset.anim || 3 })));
const clip = { x: 0, y: 0, width: W, height: H };

for (let i = 0; i < slides.length; i++) {
  await page.evaluate((k) => { const t = document.querySelector('.carousel-track'); t.style.transition = 'none'; t.style.transform = `translateX(${-k * 420}px)`; }, i);
  const seek = async (ms) => {
    await page.evaluate(async (t) => { document.getAnimations().forEach((a) => { a.pause(); a.currentTime = t; }); if (window.__setScan) await window.__setScan(t); }, ms);
  };
  if (!slides[i].still) {
    const file = resolve(out, `slide_${i + 1}.mp4`);
    const frames = slides[i].anim * FPS + 1;
    const hold = (TOTAL - frames / FPS).toFixed(3);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
      '-vf', `tpad=stop_mode=clone:stop_duration=${hold}`, '-t', String(TOTAL),
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((r) => ff.on('close', r));
    for (let f = 0; f < frames; f++) {
      await seek((f * 1000) / FPS);
      ff.stdin.write(await page.screenshot({ type: 'jpeg', quality: 95, clip }));
    }
    ff.stdin.end(); await done;
  }
  await seek(slides[i].anim * 1000);
  await page.screenshot({ path: resolve(out, `slide_${i + 1}.png`), clip });
  console.log(`slide_${i + 1}: ${slides[i].still ? 'PNG fijo' : TOTAL + 's mp4 + png'}`);
}
await browser.close();
