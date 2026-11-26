# Which scene to scaffold from

Each file in `engine/scenes/` is a complete working scene with one extra mechanic. Scaffold from the one nearest to the new story, then rewrite only the choreography sections (`===== LEFT`, `===== RIGHT`, labels, moral, counter).

| scene | mechanic it already has | flaw seen in it, to avoid |
|---|---|---|
| `06-mistakes` | two kids, cube towers, falling-cube physics, red ✕ stamp, sit-and-hug pose; no end card yet (copy the `// end card` block from another scene) | — |
| `10-parents` | parent figures (scale 1.43), kneeling, handing cubes over, figures fading into the dark | the kneeling parent overlaps the child; a fading parent is cut by the frame edge |
| `11-phone-robot` | props (phone slab with a point light), a cube robot with lime eyes, clock counter, cross-legged sitting | phone screens face away; the child seems to stand on the robot from this angle |
| `12-stairs` | 8-step staircases, climbing, run bursts and sliding back, day counter, lime step ticks, labels under the set | figures small because the set is wide |
| `13-ghosts` | translucent ghost figures and ghost towers, dark band behind the moral | a ghost near the top-left edge and in the button zone at frame 0 |

Shared by all: `Figure` rig + `Track` keyframes, `simFall`, `spaced()` text, lime rings, squash, composite (navy screen, vignette, grain), bloom.

