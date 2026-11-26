---
name: white-figures
description: White Figures — рилс-притча на 15 секунд без слов. Белые безликие фигурки на чёрном стекле, «левая сторона против правой», мораль, лаймовая победа, в конце «Смотрите подробности в описании», плюс обложка и текст описания. Используй, когда просят притчу, рилс с белыми человечками, «как 06 / 10–13», или ещё вариантов таких роликов.
argument-hint: "[тема или пара противоположностей] [сколько штук]"
---

# White Figures

A притча is a wordless 15-second split: two sides start the same, one difference in how adults treat the child (or in the child's daily choice), the gap grows, the right choice wins in lime. One притча = one episode folder `episodes/<NN-slug>/` in the project + three files in `Готовые рилсы/` (mp4, обложка, описание).

`$SKILL` below is this skill's folder. Run every command from the project folder (the one that holds `episodes/` and `.env` with `ELEVENLABS_API_KEY`). Needs node, ffmpeg and a global `playwright`.

Several at once: do steps 1–2 for all of them yourself, then one subagent per episode for step 3 (they share nothing but the look), then steps 4–5 yourself.

## 1. Story

Find the pair before anything else. A good pair passes all four:

- **A parent recognises themselves on the left** within a second («это я»), and the left side is a common, well-meant habit, never cruelty.
- **Readable on mute, without the labels**: the difference is a body action (builds / watches, climbs / slides back, scrolls / assembles), and the result is a height or an object you can see.
- **One variable**: both children are equal at frame 0.
- **Fresh**: the pair and the moral are absent from the episodes already made (`ls episodes/`, read their BRIEF.md titles).

Write for each: two labels (two short lines each, uppercase), the moral (two lines, ≤26 characters each), the cover title (2 lines, the first goes in the lime plaque), a 4–6 word name for the ready folder.

Fixed timeline, the same in every притча:

| time | beat |
|---|---|
| frame 0 | both sides, labels, first action already visible |
| by 1.5 s | the first difference (the hook) |
| 2–8 s | the gap grows; the winning side has one setback and gets up |
| 8.0 s | moral fades in |
| 12.6 s | payoff on the music peak: lime glow, arms up; the other side looks over |
| 13.6–15 s | end card «СМОТРИТЕ ПОДРОБНОСТИ / В ОПИСАНИИ» |

Done when: each притча has labels, moral, cover title and a beat list on that timeline.

## 2. Scaffold, brief, music

Pick the scene from [`references/mechanics.md`](references/mechanics.md), then:

```
$SKILL/scripts/scaffold.sh <NN-slug> <scene>
node $SKILL/tools/music.mjs episodes/<NN-slug> 15 "<mood>, 15 seconds, … peak at 12.5 seconds, then rings out. For a short wordless parable video."
```

Fill `episodes/<NN-slug>/BRIEF.md` (the template is already there) and the title in `cover.json`. Music: instrumental, the mood follows the story arc (cold → warm, fragile → hopeful), a different instrument palette from the neighbouring episodes; two requests at a time at most.

Done when: BRIEF.md has no «…» left and `audio/music.mp3` exists.

## 3. Picture

Rewrite the choreography in `episodes/<NN-slug>/styles/neuron/scene.js`; renderer, lights, floor, materials, figure rig, grain and bloom stay as scaffolded so the series looks like one hand. Rules of the look: [`references/look.md`](references/look.md).

1. Stills first: `cd styles/neuron && node render.mjs stills 0 45 150 250 380 430`. Open every still and fix until each passes:
   - frame 0 tells the conflict (both sides, labels, action);
   - labels, moral, counter and end card overlap nothing and each other;
   - figures, text and props sit inside the safe frame from look.md;
   - figures stand on things, not inside them; everybody is whole inside the frame;
   - lime only on the winning side, red only as a mistake mark.
2. `node render.mjs video` (450 frames, ~3–5 min).
3. Write `out/cover-frame.txt`: the second of the strongest frame between the payoff and 13.5 s (before the end card).
4. Fill `sound.json` with the real moments from the choreography: falls → `fail`, placements or jumps → `pop`, fast moves → `whoosh`, payoff → `win` at 12.6.

Done when: the video is rendered from the last version of scene.js and every still check passes.

## 4. Description

Write `Готовые рилсы/<NN Название> — описание.txt` by [`references/description.md`](references/description.md).

## 5. Finish and check

```
$SKILL/scripts/finish.sh <NN-slug> "<NN Название>"
```

It builds the sheet, assembles sound, makes the cover and copies everything into `Готовые рилсы/`. Then look at `sheet.jpg` and `out/cover.png` yourself:

- the sheet reads as the story with no explanation; if a beat is unclear, fix scene.js and re-render;
- the cover title covers neither figure's head nor the moral; if `cover.mjs` prints «outside the 3:4 grid», add `"size": 112` to cover.json (or shorten the title);
- loudness printed by assemble is −14…−17 LUFS with the peak below −1.5 dB.

Report to the user visual-first: the strip of covers, a table «№ / притча / мораль», where the descriptions are, and every flaw you saw on the sheets, stated plainly, including that the motion was checked on frames and wants one viewing with sound on a phone.
