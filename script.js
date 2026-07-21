/*
 * Boomdle — a Wordle clone where every guess detonates.
 * Depends on words.js (ANSWERS, VALID) and explosions.js (Explosions).
 */
(() => {
  "use strict";

  const ROWS = 6;
  const COLS = 5;

  const boardEl = document.getElementById("board");
  const keyboardEl = document.getElementById("keyboard");
  const messageEl = document.getElementById("message");
  const resetBtn = document.getElementById("reset");

  let answer = "";
  let row = 0;
  let col = 0;
  let grid = []; // grid[r][c] = letter
  let tiles = []; // tiles[r][c] = element
  let keyEls = {}; // letter -> key element
  let locked = false; // block input during animations
  let over = false;

  const TILE_COLORS = {
    correct: ["#e8f5e9", "#a5d6a7", "#4caf50", "#2e7d32"],
    present: ["#fff8e1", "#ffe082", "#ffca28", "#c9a227"],
    absent: ["#fff3b0", "#ffd23f", "#ff8c00", "#ff5a1f", "#ff2d00"],
  };

  const KEY_LAYOUT = [
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
    ["Enter", "z", "x", "c", "v", "b", "n", "m", "Back"],
  ];

  function newGame() {
    answer = ANSWERS[(Math.random() * ANSWERS.length) | 0];
    row = 0;
    col = 0;
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(""));
    locked = false;
    over = false;
    setMessage("");
    resetBtn.hidden = true;
    buildBoard();
    buildKeyboard();
  }

  function buildBoard() {
    boardEl.innerHTML = "";
    tiles = [];
    for (let r = 0; r < ROWS; r++) {
      const rowEl = document.createElement("div");
      rowEl.className = "row";
      const rowTiles = [];
      for (let c = 0; c < COLS; c++) {
        const t = document.createElement("div");
        t.className = "tile";
        rowEl.appendChild(t);
        rowTiles.push(t);
      }
      boardEl.appendChild(rowEl);
      tiles.push(rowTiles);
    }
  }

  function buildKeyboard() {
    keyboardEl.innerHTML = "";
    keyEls = {};
    for (const rowKeys of KEY_LAYOUT) {
      const krow = document.createElement("div");
      krow.className = "krow";
      for (const k of rowKeys) {
        const btn = document.createElement("button");
        btn.className = "key";
        btn.type = "button";
        if (k === "Enter" || k === "Back") btn.classList.add("wide");
        btn.textContent = k === "Back" ? "⌫" : k;
        btn.dataset.key = k;
        btn.addEventListener("click", () => handleKey(k));
        krow.appendChild(btn);
        if (k.length === 1) keyEls[k] = btn;
      }
      keyboardEl.appendChild(krow);
    }
  }

  function setMessage(text) {
    messageEl.textContent = text;
  }

  function handleKey(k) {
    if (over || locked) return;

    if (k === "Enter") {
      submitGuess();
    } else if (k === "Back" || k === "Backspace") {
      deleteLetter();
    } else if (/^[a-z]$/i.test(k)) {
      addLetter(k.toLowerCase());
    }
  }

  function addLetter(letter) {
    if (col >= COLS) return;
    grid[row][col] = letter;
    const t = tiles[row][col];
    t.textContent = letter;
    t.classList.add("filled");
    setTimeout(() => t.classList.remove("filled"), 120);

    // Little spark at the tile that was just filled.
    const rect = t.getBoundingClientRect();
    Explosions.spark(rect.left + rect.width / 2, rect.top + rect.height / 2);

    col++;
  }

  function deleteLetter() {
    if (col <= 0) return;
    col--;
    grid[row][col] = "";
    const t = tiles[row][col];
    t.textContent = "";
    t.classList.remove("filled");
  }

  function submitGuess() {
    if (col < COLS) {
      shakeRow("Not enough letters");
      return;
    }
    const guess = grid[row].join("");
    if (!VALID.has(guess)) {
      shakeRow("Not in word list");
      return;
    }

    const states = scoreGuess(guess, answer);
    revealRow(guess, states);
  }

  // Returns an array of "correct" | "present" | "absent" for each column,
  // handling duplicate letters the same way Wordle does.
  function scoreGuess(guess, answer) {
    const states = Array(COLS).fill("absent");
    const counts = {};
    for (const ch of answer) counts[ch] = (counts[ch] || 0) + 1;

    // First pass: exact matches.
    for (let i = 0; i < COLS; i++) {
      if (guess[i] === answer[i]) {
        states[i] = "correct";
        counts[guess[i]]--;
      }
    }
    // Second pass: present-but-misplaced, limited by remaining counts.
    for (let i = 0; i < COLS; i++) {
      if (states[i] === "correct") continue;
      const ch = guess[i];
      if (counts[ch] > 0) {
        states[i] = "present";
        counts[ch]--;
      }
    }
    return states;
  }

  function revealRow(guess, states) {
    locked = true;
    const rowTiles = tiles[row];

    rowTiles.forEach((t, i) => {
      setTimeout(() => {
        t.classList.add("reveal");
        // Swap in the color at the midpoint of the flip.
        setTimeout(() => {
          t.classList.add(states[i]);
          updateKey(guess[i], states[i]);
          // Detonate this tile as it locks in, themed to its state.
          Explosions.boomAt(t, {
            count: states[i] === "correct" ? 34 : 20,
            speed: states[i] === "correct" ? 8 : 5,
            colors: TILE_COLORS[states[i]],
          });
          detonateTile(t, states[i]);
        }, 270);
      }, i * 260);
    });

    const total = (COLS - 1) * 260 + 550;
    setTimeout(() => finishRow(guess), total);
  }

  function detonateTile(tile, state) {
    tile.classList.add("boom");
    setTimeout(() => tile.classList.remove("boom"), 400);
    shakeScreen(false);
  }

  function finishRow(guess) {
    locked = false;

    if (guess === answer) {
      over = true;
      win();
      return;
    }

    row++;
    col = 0;
    if (row >= ROWS) {
      over = true;
      lose();
    }
  }

  function win() {
    const messages = [
      "💥 BOOM! You got it!",
      "🎉 Explosive victory!",
      "🔥 Nailed it!",
    ];
    setMessage(messages[row % messages.length]);
    Explosions.megaBoom();
    shakeScreen(true);
    // Roll a victory detonation across the winning row.
    Explosions.detonateRow(tiles[row], () => "correct");
    setTimeout(() => Explosions.megaBoom(), 700);
    showReset();
  }

  function lose() {
    setMessage(`💀 The word was "${answer.toUpperCase()}"`);
    shakeScreen(true);
    showReset();
  }

  function showReset() {
    resetBtn.hidden = false;
  }

  function updateKey(letter, state) {
    const el = keyEls[letter];
    if (!el) return;
    // Never downgrade a key's color (correct > present > absent).
    const rank = { correct: 3, present: 2, absent: 1 };
    const current = el.dataset.state;
    if (current && rank[current] >= rank[state]) return;
    el.dataset.state = state;
    el.classList.remove("correct", "present", "absent");
    el.classList.add(state);
  }

  function shakeRow(msg) {
    setMessage(msg);
    const rowTiles = tiles[row];
    rowTiles.forEach((t) => {
      t.classList.add("invalid");
      setTimeout(() => t.classList.remove("invalid"), 400);
    });
    setTimeout(() => {
      if (messageEl.textContent === msg) setMessage("");
    }, 1200);
  }

  function shakeScreen(big) {
    const cls = big ? "shake-big" : "shake";
    document.body.classList.remove("shake", "shake-big");
    // Force reflow so the animation restarts even on rapid calls.
    void document.body.offsetWidth;
    document.body.classList.add(cls);
    setTimeout(() => document.body.classList.remove(cls), big ? 700 : 450);
  }

  // ---- Global input ----
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Enter") handleKey("Enter");
    else if (e.key === "Backspace") handleKey("Back");
    else if (/^[a-z]$/i.test(e.key)) handleKey(e.key);
  });

  resetBtn.addEventListener("click", newGame);

  newGame();
})();
