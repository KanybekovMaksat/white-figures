// Final reel for one style: styles/<style>/out/video.mp4 + audio/captions.mov + audio/vo.wav
// + SFX on words (sound.json) + music ducked under the voice → out/<slug>-<style>.mp4
//
//   node tools/assemble.mjs episodes/<slug> <style>      (style "all" = every styles/*/out/video.mp4)
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.env.WF_ROOT ?? process.cwd(); // the project folder that holds episodes/ and .env
const EP = join(ROOT, process.argv[2].replace(/^.*?episodes\//, "episodes/"));
const want = process.argv[3] ?? "all";
const data = JSON.parse(readFileSync(join(EP, "audio/words.json"), "utf8"));
const snd = JSON.parse(readFileSync(join(EP, "sound.json"), "utf8"));
const slug = basename(EP);
mkdirSync(join(EP, "out"), { recursive: true });

// a cue is { at: "<word>" | seconds, line?: "l3", sfx: "pop", gain? } — a word cue lands on that word's start
function when(c) {
  if (typeof c.at === "number") return c.at;
  const w = data.words.find((x) => (!c.line || x.line === c.line) && x.w.toLowerCase().replace(/[^а-яёa-z-]/gi, "") === c.at.toLowerCase());
  if (!w) throw new Error(`cue word not found: ${c.at} ${c.line ?? ""}`);
  return Math.max(0, w.start + (c.offset ?? 0));
}

const styles = want === "all" ? readdirSync(join(EP, "styles")).filter((s) => existsSync(join(EP, "styles", s, "out/video.mp4"))) : [want];
for (const style of styles) {
  const video = join(EP, "styles", style, "out/video.mp4");
  const out = join(EP, "out", `${slug}-${style}.mp4`);
  // no captions.mov (silent parable) → a blank overlay; no vo.wav → silence, music is not ducked
  const caps = existsSync(join(EP, "audio/captions.mov")) ? ["-i", join(EP, "audio/captions.mov")] : ["-f", "lavfi", "-i", "color=c=black@0:s=1080x1920:r=30,format=argb"];
  const vo = existsSync(join(EP, "audio/vo.wav")) ? ["-i", join(EP, "audio/vo.wav")] : ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"];
  const inputs = ["-i", video, ...caps, ...vo, "-stream_loop", "-1", "-i", snd.music.src];
  const fx = [];
  snd.sfx.forEach((c, k) => {
    inputs.push("-i", join(snd.sfxDir, `${c.sfx}.wav`));
    const ms = Math.round(when(c) * 1000);
    fx.push(`[${4 + k}:a]aresample=48000,volume=${c.gain ?? 0.5},adelay=${ms}|${ms}[f${k}]`);
  });
  const D = data.duration.toFixed(3);
  const graph = [
    `[0:v]scale=1080:1920,fps=30,format=yuv420p[bg]`,
    `[bg][1:v]overlay=0:0:shortest=1[v]`,
    `[2:a]aresample=48000,asplit=2[vo][key]`,
    `[3:a]aresample=48000,atrim=start=${snd.music.start ?? 0},asetpts=PTS-STARTPTS,volume=${snd.music.gain},afade=t=out:st=${(data.duration - 1.2).toFixed(2)}:d=1.2[mus]`,
    `[mus][key]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=350[duck]`,
    ...fx,
    `[vo][duck]${fx.map((_, k) => `[f${k}]`).join("")}amix=inputs=${2 + fx.length}:normalize=0:duration=first,atrim=0:${D},loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000,alimiter=limit=0.82:level=false:attack=1:release=60,aresample=48000[a]`,
  ].join(";");
  execFileSync("ffmpeg", ["-v", "error", "-y", ...inputs, "-filter_complex", graph, "-map", "[v]", "-map", "[a]", "-t", D,
    "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out]);
  const probe = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "csv=p=0", out]).toString().trim().replace(/\n/g, " | ");
  const r = spawnSync("ffmpeg", ["-hide_banner", "-i", out, "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8" });
  const I = r.stderr.match(/I:\s+(-?[\d.]+) LUFS/g)?.at(-1), P = r.stderr.match(/Peak:\s+(-?[\d.]+) dBFS/g)?.at(-1);
  console.log(`${style}: ${out}\n  ${probe} · ${I} · ${P}`);
}
