// Hook cover for a reel: the strongest frame of the clean (caption-free) style render + a hook title in the
// Codify brandbook (deep blue #180E85, lime #B9E132 never on white, Montserrat). Everything that matters sits
// inside the 3:4 profile-grid crop (y 240–1680).
//
//   node tools/cover.mjs episodes/<slug> [style]   (reads <slug>/cover.json)
//   → out/cover.png (1080×1920), out/cover-grid.png (3:4 crop as the profile grid shows it), out/cover-small.png
//
// cover.json: { "t": 4.3, "kicker": "Ребёнок отвечает «нормально»?", "title": [["3 фразы", "lime"], ["после школы"]],
//               "badge": "совет" , "zoom": 1.15, "focusY": 0.42, "dark": true, "style": "speedy" }
// "dark": navy fade + white title (for the dark 3D formats); "style" in cover.json replaces the CLI style.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = (() => { try { return require("playwright"); } catch { return require(join(execFileSync("npm", ["root", "-g"]).toString().trim(), "playwright")); } })();
const ROOT = process.env.WF_ROOT ?? process.cwd(); // the project folder that holds episodes/ and .env
const EP = join(ROOT, process.argv[2].replace(/^.*?episodes\//, "episodes/"));
const c = JSON.parse(readFileSync(join(EP, "cover.json"), "utf8"));
const style = process.argv[3] ?? c.style ?? "folk-tale";
const paper = c.dark ? "#14213F" : "#efe6d2";
const OUT = join(EP, "out");
mkdirSync(OUT, { recursive: true });

// the clean frame (no captions), full resolution
const frame = join(OUT, ".cover-frame.png");
execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(c.t), "-i", join(EP, "styles", style, "out/video.mp4"), "-frames:v", "1", frame]);
const b64 = (p) => readFileSync(p).toString("base64");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const title = c.title.map(([text, tone]) => `<span class="${tone === "lime" ? "lime" : "ink"}">${esc(text)}</span>`).join("");
const html = `<!doctype html><html><head><style>
@font-face{font-family:M;src:url(data:font/ttf;base64,${b64(join(dirname(fileURLToPath(import.meta.url)), "../engine/assets/Montserrat-VF.ttf"))});font-weight:100 900}
html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:${paper}}
.bg{position:absolute;inset:0;background:url(data:image/png;base64,${b64(frame)}) center/cover;
  transform:translateY(${c.shiftY ?? -120}px) scale(${c.zoom ?? 1.08});transform-origin:50% ${((c.focusY ?? 0.4) * 100).toFixed(1)}%}
/* soft paper fade under the title so it reads on any frame */
.fade{position:absolute;left:0;right:0;top:1060px;bottom:0;background:linear-gradient(${paper}00,${paper}e6 32%,${paper} 60%)}
.kicker{position:absolute;left:80px;right:80px;top:${c.kickerY ?? 300}px;display:flex;justify-content:center}
.kicker span{font:800 50px/1.2 M;color:#fff;background:#180E85;padding:20px 34px 22px;border-radius:26px;text-align:center;text-wrap:balance;max-width:820px;
  box-shadow:0 10px 0 #0c0743;transform:rotate(-2deg)}
.title{position:absolute;left:60px;right:60px;top:${c.titleY ?? 1150}px;display:flex;flex-direction:column;align-items:center;gap:10px}
.title span{font:900 ${c.size ?? 124}px/0.98 M;letter-spacing:-3px;text-transform:uppercase;padding:14px 34px 20px;border-radius:30px;text-align:center}
.ink{color:${c.dark ? "#fff" : "#180E85"}}
.lime{color:#180E85;background:#B9E132;box-shadow:0 12px 0 #180E85;transform:rotate(1.5deg)}
.badge{position:absolute;right:70px;top:${c.badgeY ?? 470}px;width:210px;height:210px;border-radius:50%;padding:18px;box-sizing:border-box;background:#B9E132;
  display:flex;align-items:center;justify-content:center;transform:rotate(12deg);box-shadow:0 10px 0 #180E85;
  font:900 ${c.badgeSize ?? 30}px/1.05 M;color:#180E85;text-transform:uppercase;text-align:center}
.brand{position:absolute;left:0;right:0;top:1585px;text-align:center;font:700 34px M;color:#180E85;opacity:.75;letter-spacing:1px}
</style></head><body>
<div class="bg"></div><div class="fade"></div>
${c.kicker ? `<div class="kicker"><span>${esc(c.kicker)}</span></div>` : ""}
${c.badge ? `<div class="badge">${esc(c.badge)}</div>` : ""}
<div class="title">${title}</div>
${c.brand ? `<div class="brand">${esc(c.brand)}</div>` : ""}
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
const cover = join(OUT, "cover.png");
await page.screenshot({ path: cover });
// fail loudly if any text box leaves the 3:4 grid crop
const outside = await page.evaluate(() => [...document.querySelectorAll(".kicker span,.title span,.badge,.brand")]
  .map((e) => ({ t: e.textContent, r: e.getBoundingClientRect() }))
  .filter(({ r }) => r.top < 240 || r.bottom > 1680 || r.left < 0 || r.right > 1080).map((x) => x.t));
await browser.close();
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", cover, "-vf", "crop=1080:1440:0:240", join(OUT, "cover-grid.png")]);
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", cover, "-vf", "crop=1080:1440:0:240,scale=240:-1", join(OUT, "cover-small.png")]);
console.log(`${basename(EP)}: out/cover.png${outside.length ? `  ⚠ outside the 3:4 grid: ${outside.join(" | ")}` : "  (all text inside the 3:4 grid)"}`);
