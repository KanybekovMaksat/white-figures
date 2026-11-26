#!/bin/bash
# New episode from one of the bundled scenes. Run from the project folder (or set WF_ROOT).
#   scaffold.sh <NN-slug> <scene>      e.g. scaffold.sh 14-afraid-to-ask 12-stairs      (scenes: ls engine/scenes)
set -euo pipefail
SKILL="$(cd "$(dirname "$0")/.." && pwd)"; ROOT="${WF_ROOT:-$PWD}"
NEW="$ROOT/episodes/$1"; SCENE="$SKILL/engine/scenes/$2.js"
[ -e "$NEW" ] && { echo "exists: $NEW"; exit 1; }
[ -f "$SCENE" ] || { echo "no scene $2; have: $(ls "$SKILL/engine/scenes" | sed 's/\.js$//' | tr '\n' ' ')"; exit 1; }
mkdir -p "$NEW/audio" "$NEW/out" "$NEW/styles/neuron"
cp -R "$SKILL/engine/index.html" "$SKILL/engine/render.mjs" "$SKILL/engine/assets" "$SKILL/engine/vendor" "$NEW/styles/neuron/"
cp "$SCENE" "$NEW/styles/neuron/scene.js"
echo '{"duration": 15.0, "fps": 30, "lines": [], "words": []}' > "$NEW/audio/words.json"
cat > "$NEW/sound.json" <<J
{ "sfxDir": "$SKILL/sfx", "music": { "src": "$NEW/audio/music.mp3", "gain": 1.0, "start": 0 },
  "sfx": [] }
J
echo '{"style": "neuron", "dark": true, "t": 13.0, "shiftY": 0, "zoom": 1.08, "title": [["СЛОВО", "lime"], ["вопрос?"]]}' > "$NEW/cover.json"
cp "$SKILL/references/brief-template.md" "$NEW/BRIEF.md"
echo "scaffolded $NEW (scene $2). Next: fill BRIEF.md, generate audio/music.mp3, rewrite styles/neuron/scene.js"
