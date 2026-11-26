#!/bin/bash
# After styles/neuron/out/video.mp4 is rendered: sheet → assemble → cover → copy into «Готовые рилсы».
# Run from the project folder (or set WF_ROOT).     finish.sh <NN-slug> "<NN Название ролика>"
set -euo pipefail
SKILL="$(cd "$(dirname "$0")/.." && pwd)"; export WF_ROOT="${WF_ROOT:-$PWD}"
E="$WF_ROOT/episodes/$1"; O="$E/styles/neuron/out"; READY="$WF_ROOT/Готовые рилсы"; mkdir -p "$READY"
N=$(ffprobe -v error -count_frames -select_streams v -show_entries stream=nb_read_frames -of csv=p=0 "$O/video.mp4")
[ "$N" = "450" ] || { echo "video.mp4 has $N frames, need 450"; exit 1; }
ffmpeg -v error -y -i "$O/video.mp4" -vf "fps=16/15,scale=270:-2,tile=8x2:padding=6" -frames:v 1 "$O/sheet.jpg"
T=$(tr -d ' \n' < "$O/cover-frame.txt")
sed -i.bak "s/\"t\": [0-9.]*/\"t\": $T/" "$E/cover.json" && rm "$E/cover.json.bak"
node "$SKILL/tools/assemble.mjs" "episodes/$1" neuron
node "$SKILL/tools/cover.mjs" "episodes/$1"
cp "$E/out/$1-neuron.mp4" "$READY/$2.mp4"
cp "$E/out/cover.png" "$READY/$2 — обложка.png"
[ -f "$E/description.txt" ] || echo "MISSING: $E/description.txt"
echo "sheet: $O/sheet.jpg   cover: $E/out/cover.png   ← LOOK at both"
