# 💥 Boomdle

A **Wordle clone with way more explosions.** Same 5-letters-in-6-guesses rules
you know, but every keypress sparks, every revealed tile detonates, wrong
guesses shake the board, and a win sets off a full-screen fireworks show.

![Boomdle](screenshot.png)

## How to play

Guess the hidden 5-letter word in 6 tries.

- **Green** — right letter, right spot.
- **Yellow** — right letter, wrong spot.
- **Gray** — letter not in the word.

Type on your physical keyboard or click the on-screen keys. Press **Enter**
to submit, **⌫** to delete.

## The explosions

- **Sparks** puff off every letter you type.
- **Tile detonations** — each tile bursts with a state-themed particle blast
  and shockwave ring as it flips and locks in.
- **Screen shake** on every submitted guess (and a bigger one on win/lose).
- **Mega-boom** — winning triggers staggered multi-origin fireworks.
- **Shake + rejection wobble** when a guess isn't a real word.

All effects are drawn on a single full-screen `<canvas>` particle engine
(`explosions.js`) with additive blending for that glowy-fire look.

## Dopamine features

- **📊 Game statistics** — games played, win %, current & max streak, and a
  guess-distribution chart, all saved in `localStorage` and shown after every
  game (or via the 📊 button).
- **🌙 Dark / ☀️ light mode** — toggle in the top-right, remembered between
  sessions.
- **📱 Mobile-friendly** — responsive board and keyboard scale down on phones.

## Run it

It's pure static HTML/CSS/JS — no build step, no dependencies.

```bash
# just open the file
open index.html          # macOS
xdg-open index.html      # Linux

# ...or serve it (any static server works)
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Project layout

| File | Purpose |
| --- | --- |
| `index.html` | Page structure and script includes. |
| `style.css` | Board, keyboard, and all CSS animations (shake, flip, pop). |
| `words.js` | `ANSWERS` (solution pool) and `VALID` (accepted guesses). |
| `explosions.js` | Canvas particle / shockwave / fireworks engine. |
| `script.js` | Game state, input handling, and Wordle scoring. |

## License

MIT — do whatever you like. Go make things explode.
