# Sound

Neuron Visuals (studied 26.11.2026) puts ONE well-known emotional track from the Instagram music library under each reel and nothing else: no sound effects, no voice. Seen on their reels: Марк Бернес «Тёмная ночь» (102M views), Yann Tiersen «Comptine d'un autre été», Ludovico Einaudi «Experience», ridgeclub «biting bullets», Kevin MacLeod «Monkeys Spinning Monkeys». The track is chosen in Instagram at posting, which also puts the reel on that track's audio page.

So each reel gets two things:

1. **Own track inside the mp4** (`audio/music.mp3`, via `tools/music.mjs`), so the file also works outside Instagram. Solo felt piano or piano with a string quartet, slow, intimate, one simple repeating motif that grows, the emotional peak at 12.5 s, a held last chord. Name the mood of the story (wistful → hopeful, tender, bittersweet). Describe the sound in words; artist names in the prompt get the request rejected. `sound.json` keeps `"sfx": []`.
2. **A recommended Instagram track** in the final report: one known, emotional, mostly instrumental piece that fits the story (piano classics, a nostalgic song the audience grew up with). The user adds it when posting and sets the original audio to 0.

`sfx/` stays in the repo for the rare story that truly needs one hit; the default is none.
