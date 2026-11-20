// Renders the PNG icons and the social preview image (assets/og.png) with headless Chrome.
// Usage: node scripts/build-assets.mjs   (set CHROME_PATH if Chrome is not at /usr/bin/google-chrome)
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { GAMES, SITE } from '../shared/registry.js';

const out = (name) => fileURLToPath(new URL('../assets/' + name, import.meta.url));
const icon = await readFile(out('icon.svg'), 'utf8');

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome' });
const page = await browser.newPage();

for (const size of [512, 192, 180]) {
  await page.setViewportSize({ width: size, height: size });
  // Square corners: iOS and Android apply their own mask.
  await page.setContent(`<style>body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${icon.replace('rx="112"', 'rx="0"')}`);
  await page.screenshot({ path: out(`icon-${size}.png`) });
}

// Maskable: Android may crop the icon to a circle, so the mark sits inside the central 80% safe zone.
await page.setViewportSize({ width: 512, height: 512 });
await page.setContent(`<style>body{margin:0;background:#bfe3f0}svg{display:block;width:512px;height:512px;transform:scale(.8)}</style>${icon.replace('rx="112"', 'rx="0"')}`);
await page.screenshot({ path: out('icon-maskable-512.png') });

// The share image matches the hub's map: sea background, ink outlines, white cards with hard shadows.
// Fonts are inlined from assets/fonts so the build needs no network.
const font = async (file) => `url(data:font/woff2;base64,${(await readFile(out('fonts/' + file))).toString('base64')}) format('woff2')`;
const fontCss = `
  @font-face{font-family:"Secular One";src:${await font('secular-one-hebrew-4.woff2')};unicode-range:U+0590-05FF}
  @font-face{font-family:"Secular One";src:${await font('secular-one-latin-5.woff2')};unicode-range:U+0000-00FF}
  @font-face{font-family:Heebo;font-weight:100 900;src:${await font('heebo-hebrew-2.woff2')};unicode-range:U+0590-05FF}
  @font-face{font-family:Heebo;font-weight:100 900;src:${await font('heebo-latin-3.woff2')};unicode-range:U+0000-00FF}`;
const rows = GAMES.map((g) => `<li><span class="tile" style="background:${g.accent}"><svg viewBox="0 0 28 28">${g.mark}</svg></span>${g.name}</li>`).join('');
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(`<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<style>${fontCss}
  body{margin:0;width:1200px;height:630px;box-sizing:border-box;padding:0 64px;background:#bfe3f0;color:#18324a;font-family:Heebo,Arial,sans-serif;display:flex;align-items:center;gap:56px;overflow:hidden;position:relative}
  .text{flex:1}
  .clock{width:104px;height:104px;display:block;margin-bottom:14px}
  h1{font-family:"Secular One",Heebo,sans-serif;font-size:124px;font-weight:400;margin:0;line-height:1;white-space:nowrap}
  p{font-size:36px;font-weight:500;margin:22px 0 0;line-height:1.35;color:#2b4a63}
  .cta{display:inline-block;margin-top:30px;background:#ffd23f;border:5px solid #18324a;border-radius:22px;box-shadow:0 9px 0 #18324a;padding:12px 30px;font-family:"Secular One",Heebo,sans-serif;font-size:38px}
  ul{margin:0;padding:0;list-style:none;width:430px;display:grid;gap:12px}
  li{display:flex;align-items:center;gap:16px;height:62px;padding:0 14px;background:#fff;border:4px solid #18324a;border-radius:18px;box-shadow:0 6px 0 #18324a;font-family:"Secular One",Heebo,sans-serif;font-size:32px}
  .tile{width:44px;height:44px;border-radius:12px;border:3px solid #18324a;display:grid;place-items:center;flex:none}
  .tile svg{width:30px;height:30px;fill:none;stroke:#fff;stroke-width:2.6;stroke-linejoin:round;stroke-linecap:round}
  .tile .solid{fill:#fff;stroke:none}
  .wave{position:absolute;fill:none;stroke:#6fb0cc;stroke-width:6;stroke-linecap:round;width:90px;height:24px}
</style></head><body>
<svg class="wave" style="left:520px;top:40px" viewBox="0 0 90 24"><path d="M5 16q10-10 20 0t20 0t20 0t20 0"/></svg>
<svg class="wave" style="left:560px;bottom:40px" viewBox="0 0 90 24"><path d="M5 16q10-10 20 0t20 0t20 0t20 0"/></svg>
<div class="text">${icon.replace('<svg ', '<svg class="clock" ')}<h1>${SITE.name}</h1><p>משחקים קצרים בעברית.<br>חידה חדשה בכל משחק, כל יום בחצות.</p><span class="cta">חינם, בלי הרשמה</span></div>
<ul>${rows}</ul>
</body></html>`);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out('og.png') });
await browser.close();
console.log('wrote assets/icon-512.png, icon-192.png, icon-180.png, icon-maskable-512.png, og.png');
