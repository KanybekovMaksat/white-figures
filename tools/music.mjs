// Instrumental music for an episode via ElevenLabs /v1/music.
//   node tools/music.mjs episodes/<slug> <seconds> "<prompt>"   → audio/music.mp3
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = process.env.WF_ROOT ?? process.cwd(); // the project folder that holds episodes/ and .env
const [ep, sec, prompt] = process.argv.slice(2);
const env = Object.fromEntries(readFileSync(join(ROOT, ".env"), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]));
for (let i = 0; i < 5; i++) {
  const r = await fetch("https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128", { method: "POST", headers: { "xi-api-key": env.ELEVENLABS_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ prompt, music_length_ms: Math.round(+sec * 1000), force_instrumental: true }) });
  if (r.ok) { writeFileSync(join(ROOT, ep.replace(/^.*?episodes\//, "episodes/"), "audio/music.mp3"), Buffer.from(await r.arrayBuffer())); console.log("music ok", ep); process.exit(0); }
  console.error(r.status, (await r.text()).slice(0, 200)); await new Promise((res) => setTimeout(res, 4000 * 2 ** i));
}
process.exit(1);
