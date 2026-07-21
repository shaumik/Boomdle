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

  // ---------- Persistent stats (localStorage) ----------
  const STATS_KEY = "boomdle.stats";
  const THEME_KEY = "boomdle.theme";

  function loadStats() {
    try {
      const s = JSON.parse(localStorage.getItem(STATS_KEY));
      if (s && s.dist) return s;
    } catch (_) {}
    return { played: 0, wins: 0, streak: 0, maxStreak: 0, dist: [0, 0, 0, 0, 0, 0] };
  }
  function saveStats(s) {
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(s));
    } catch (_) {}
  }
  let stats = loadStats();

  function recordResult(won, guessCount) {
    stats.played++;
    if (won) {
      stats.wins++;
      stats.streak++;
      stats.maxStreak = Math.max(stats.maxStreak, stats.streak);
      stats.dist[guessCount - 1]++;
    } else {
      stats.streak = 0;
    }
    saveStats(stats);
  }

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
            count: states[i] === "correct" ? 26 : 16,
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
    const guessCount = row + 1;
    recordResult(true, guessCount);
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
    showReset();
    setTimeout(() => openStats(guessCount), 1600);
  }

  function lose() {
    recordResult(false);
    setMessage(`💀 The word was "${answer.toUpperCase()}"`);
    shakeScreen(true);
    showReset();
    setTimeout(() => openStats(-1), 1200);
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

  // ---------- Stats modal ----------
  const statsModal = document.getElementById("statsModal");
  const distEl = document.getElementById("dist");

  function renderStats(highlight) {
    const winPct = stats.played
      ? Math.round((stats.wins / stats.played) * 100)
      : 0;
    document.getElementById("stPlayed").textContent = stats.played;
    document.getElementById("stWin").textContent = winPct;
    document.getElementById("stStreak").textContent = stats.streak;
    document.getElementById("stMax").textContent = stats.maxStreak;

    const max = Math.max(1, ...stats.dist);
    distEl.innerHTML = "";
    stats.dist.forEach((count, i) => {
      const rowEl = document.createElement("div");
      rowEl.className = "dist-row";
      const bar = document.createElement("div");
      bar.className = "dist-bar" + (i + 1 === highlight ? " hot" : "");
      bar.style.width = 10 + (count / max) * 90 + "%";
      bar.textContent = count;
      rowEl.innerHTML = `<span class="n">${i + 1}</span>`;
      rowEl.appendChild(bar);
      distEl.appendChild(rowEl);
    });
  }

  function openStats(highlight) {
    renderStats(highlight);
    statsModal.hidden = false;
  }
  function closeStats() {
    statsModal.hidden = true;
  }

  document.getElementById("statsBtn").addEventListener("click", () => openStats(0));
  document.getElementById("statsClose").addEventListener("click", closeStats);
  document.getElementById("statsPlay").addEventListener("click", () => {
    closeStats();
    newGame();
  });
  statsModal.addEventListener("click", (e) => {
    if (e.target === statsModal) closeStats();
  });

  // ---------- Theme toggle ----------
  const themeBtn = document.getElementById("themeBtn");
  function applyTheme(theme) {
    if (theme === "light") {
      document.documentElement.setAttribute("data-theme", "light");
      themeBtn.textContent = "☀️";
    } else {
      document.documentElement.removeAttribute("data-theme");
      themeBtn.textContent = "🌙";
    }
  }
  applyTheme(localStorage.getItem(THEME_KEY) || "dark");
  themeBtn.addEventListener("click", () => {
    const next =
      document.documentElement.getAttribute("data-theme") === "light"
        ? "dark"
        : "light";
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (_) {}
    applyTheme(next);
  });

  newGame();
})();
