/*
 * Boomdle — a Wordle clone where every guess detonates.
 * Depends on words.js (ANSWERS, VALID), sound.js (Sound), explosions.js.
 *
 * Game-feel notes:
 *  - Reveals are fast (~680ms) and NON-blocking: because scoring is
 *    synchronous we know the outcome instantly, so on a non-final guess we
 *    advance the active row immediately and let the player type the next word
 *    while the previous row is still flipping (type-ahead). A submitted Enter
 *    during a reveal is buffered and fired the moment it finishes.
 *  - Shake is targeted (row shake for errors, screen shake only on win/lose)
 *    instead of shaking the whole page every turn.
 */
(() => {
  "use strict";

  const ROWS = 6;
  const COLS = 5;
  const STAGGER = 95; // ms between tile flips
  const SWAP = 150; // ms into a flip when the color/detonation lands
  const REVEAL_MS = (COLS - 1) * STAGGER + 300; // total row reveal time

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const boardEl = document.getElementById("board");
  const keyboardEl = document.getElementById("keyboard");
  const messageEl = document.getElementById("message");
  const actionsEl = document.getElementById("actions");
  const nextBtn = document.getElementById("nextBtn");
  const shareBtn = document.getElementById("shareBtn");

  let answer = "";
  let row = 0;
  let col = 0;
  let grid = []; // grid[r][c] = letter
  let tiles = []; // tiles[r][c] = element
  let keyEls = {}; // "a".."z" -> key element
  let allKeys = {}; // includes Enter / Back
  let over = false;
  let animating = false; // a row reveal is in flight
  let pendingEnter = false; // Enter pressed mid-reveal, fire when done
  let history = []; // [{ guess, states }] for the share grid
  let startTime = 0; // ms, for the speed bonus

  // ---------- Persistent stats (localStorage) ----------
  const STATS_KEY = "boomdle.stats";
  const THEME_KEY = "boomdle.theme";
  const SOUND_KEY = "boomdle.sound";
  const CAT_KEY = "boomdle.category";

  // Selected word pack (falls back to "all" if a saved key no longer exists).
  let category = localStorage.getItem(CAT_KEY) || "all";
  if (!CATEGORIES[category]) category = "all";

  function loadStats() {
    try {
      const s = JSON.parse(localStorage.getItem(STATS_KEY));
      if (s && s.dist) {
        if (typeof s.score !== "number") s.score = 0;
        return s;
      }
    } catch (_) {}
    return {
      played: 0,
      wins: 0,
      streak: 0,
      maxStreak: 0,
      score: 0,
      dist: [0, 0, 0, 0, 0, 0],
    };
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

  // ---------- Haptics ----------
  function vibe(pattern) {
    if (navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch (_) {}
    }
  }

  // ---------- New game ----------
  function newGame() {
    const pool = (CATEGORIES[category] || CATEGORIES.all).words;
    answer = pool[(Math.random() * pool.length) | 0];
    row = 0;
    col = 0;
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(""));
    over = false;
    animating = false;
    pendingEnter = false;
    history = [];
    startTime = Date.now();
    setMessage("");
    actionsEl.hidden = true;
    buildBoard();
    buildKeyboard();
    updateHud(false);
    setCursor();
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
    allKeys = {};
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
        allKeys[k] = btn;
        if (k.length === 1) keyEls[k] = btn;
      }
      keyboardEl.appendChild(krow);
    }
  }

  function setMessage(text) {
    messageEl.textContent = text;
  }

  // ---------- Input ----------
  function handleKey(k) {
    // After the round ends, Enter (or Space) jumps straight to the next word.
    if (over) {
      if (k === "Enter") nextGame();
      return;
    }

    pressKey(k);

    if (k === "Enter") {
      if (animating) {
        pendingEnter = true; // fire as soon as the current reveal finishes
      } else {
        submitGuess();
      }
    } else if (k === "Back" || k === "Backspace") {
      deleteLetter();
    } else if (/^[a-z]$/i.test(k)) {
      addLetter(k.toLowerCase());
    }
  }

  // Flash the on-screen key so physical typing feels tactile too.
  function pressKey(k) {
    const el = allKeys[k] || allKeys[k === "Backspace" ? "Back" : k];
    if (!el) return;
    el.classList.add("pressed");
    setTimeout(() => el.classList.remove("pressed"), 110);
  }

  function addLetter(letter) {
    if (col >= COLS) return;
    grid[row][col] = letter;
    const t = tiles[row][col];
    t.textContent = letter;
    t.classList.remove("cursor");
    t.classList.add("filled");
    setTimeout(() => t.classList.remove("filled"), 120);

    Sound.key();
    vibe(6);

    const rect = t.getBoundingClientRect();
    Explosions.spark(rect.left + rect.width / 2, rect.top + rect.height / 2);

    col++;
    setCursor();
  }

  function deleteLetter() {
    if (col <= 0) return;
    col--;
    grid[row][col] = "";
    const t = tiles[row][col];
    t.textContent = "";
    t.classList.remove("filled");
    Sound.del();
    setCursor();
  }

  // Highlight the tile the next letter will land in.
  function setCursor() {
    for (const rowTiles of tiles) {
      for (const t of rowTiles) t.classList.remove("cursor");
    }
    if (!over && col < COLS && tiles[row]) {
      tiles[row][col].classList.add("cursor");
    }
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
    history.push({ guess, states });

    const r = row;
    const won = guess === answer;
    const lastRow = row === ROWS - 1;

    tiles[r].forEach((t) => t.classList.remove("cursor"));

    if (won) {
      over = true;
      startReveal(r, guess, states, () => win(r + 1));
    } else if (lastRow) {
      over = true;
      startReveal(r, guess, states, () => lose());
    } else {
      // Advance immediately so the player can type the next word while this
      // row is still animating.
      row++;
      col = 0;
      setCursor();
      startReveal(r, guess, states, onRevealDone);
    }
  }

  // Returns "correct" | "present" | "absent" per column, handling duplicate
  // letters the same way Wordle does.
  function scoreGuess(guess, answer) {
    const states = Array(COLS).fill("absent");
    const counts = {};
    for (const ch of answer) counts[ch] = (counts[ch] || 0) + 1;
    for (let i = 0; i < COLS; i++) {
      if (guess[i] === answer[i]) {
        states[i] = "correct";
        counts[guess[i]]--;
      }
    }
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

  function startReveal(r, guess, states, onDone) {
    animating = true;
    const rowTiles = tiles[r];

    rowTiles.forEach((t, i) => {
      setTimeout(() => {
        t.classList.add("reveal");
        setTimeout(() => {
          t.classList.add(states[i]);
          updateKey(guess[i], states[i]);
          Sound.flip(states[i], i);
          Explosions.boomAt(t, {
            count: states[i] === "correct" ? 26 : 16,
            speed: states[i] === "correct" ? 8 : 5,
            colors: TILE_COLORS[states[i]],
          });
          t.classList.add("boom");
          setTimeout(() => t.classList.remove("boom"), 380);
          if (states[i] === "correct") vibe(14);
        }, SWAP);
      }, i * STAGGER);
    });

    setTimeout(onDone, REVEAL_MS);
  }

  function onRevealDone() {
    animating = false;
    // Flush a buffered Enter (type-ahead): submit the row the player queued.
    if (pendingEnter && !over) {
      pendingEnter = false;
      submitGuess();
    }
  }

  // ---------- Outcomes ----------
  function win(guessCount) {
    animating = false;
    recordResult(true, guessCount);
    const gained = computeScore(guessCount);
    stats.score += gained;
    saveStats(stats);

    const messages = ["💥 BOOM! You got it!", "🎉 Explosive victory!", "🔥 Nailed it!"];
    setMessage(messages[(guessCount - 1) % messages.length]);
    scorePopup(gained);
    updateHud(true);

    Sound.win();
    vibe([30, 40, 60]);
    Explosions.megaBoom();
    if (!reduceMotion) shakeScreen(true);
    Explosions.detonateRow(tiles[guessCount - 1], () => "correct");
    showActions();
  }

  function lose() {
    animating = false;
    recordResult(false);
    updateHud(true);
    setMessage(`💀 The word was "${answer.toUpperCase()}"`);
    Sound.lose();
    vibe(60);
    if (!reduceMotion) shakeScreen(true);
    showActions();
  }

  function computeScore(guessCount) {
    const secs = (Date.now() - startTime) / 1000;
    const base = 100;
    const guessBonus = (ROWS - guessCount) * 60; // 1 guess → 300, 6 → 0
    const speedBonus = Math.max(0, Math.round((60 - secs) * 3));
    const streakBonus = Math.min(stats.streak, 20) * 20;
    return base + guessBonus + speedBonus + streakBonus;
  }

  function showActions() {
    actionsEl.hidden = false;
    // Focus Next so a keyboard player can hit Enter to keep the run going.
    nextBtn.focus();
  }

  function nextGame() {
    actionsEl.hidden = true;
    newGame();
  }

  // ---------- HUD ----------
  const hudScore = document.getElementById("hudScore");
  const hudStreak = document.getElementById("hudStreak");
  const hudBest = document.getElementById("hudBest");

  function updateHud(animate) {
    hudStreak.textContent = stats.streak;
    hudBest.textContent = stats.maxStreak;
    if (animate) {
      animateNumber(hudScore, parseInt(hudScore.textContent, 10) || 0, stats.score, 600);
      hudScore.parentElement.classList.add("bump");
      setTimeout(() => hudScore.parentElement.classList.remove("bump"), 400);
    } else {
      hudScore.textContent = stats.score;
    }
  }

  function animateNumber(el, from, to, dur) {
    const start = performance.now();
    function step(now) {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(from + (to - from) * eased);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // Floating "+N" above the board.
  function scorePopup(n) {
    const rect = boardEl.getBoundingClientRect();
    const el = document.createElement("div");
    el.className = "score-popup";
    el.textContent = "+" + n;
    el.style.left = rect.left + rect.width / 2 + "px";
    el.style.top = rect.top + 20 + "px";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }

  // ---------- Share ----------
  function buildShare() {
    const solved = history.length && history[history.length - 1].guess === answer;
    const scoreLine = `⭐ ${stats.score} pts`;
    const rows = history
      .map((h) =>
        h.states
          .map((s) => (s === "correct" ? "🟩" : s === "present" ? "🟨" : "⬛"))
          .join("")
      )
      .join("\n");
    const header = `Boomdle 💥 ${solved ? history.length : "X"}/${ROWS}`;
    return `${header}\n${scoreLine}\n${rows}`;
  }

  async function share() {
    const text = buildShare();
    let ok = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch (_) {}
    if (!ok) {
      // Fallback for clipboard-restricted contexts.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        ok = document.execCommand("copy");
      } catch (_) {}
      ta.remove();
    }
    toast(ok ? "Copied to clipboard!" : "Copy failed — long-press to select");
  }

  let toastTimer = null;
  function toast(msg) {
    setMessage(msg);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (messageEl.textContent === msg) setMessage("");
    }, 1600);
  }

  // ---------- Key coloring ----------
  function updateKey(letter, state) {
    const el = keyEls[letter];
    if (!el) return;
    const rank = { correct: 3, present: 2, absent: 1 };
    const current = el.dataset.state;
    if (current && rank[current] >= rank[state]) return;
    el.dataset.state = state;
    el.classList.remove("correct", "present", "absent");
    el.classList.add(state);
  }

  // ---------- Shake ----------
  function shakeRow(msg) {
    setMessage(msg);
    Sound.invalid();
    vibe(50);
    const rowTiles = tiles[row];
    rowTiles.forEach((t) => {
      t.classList.add("invalid");
      setTimeout(() => t.classList.remove("invalid"), 400);
    });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (messageEl.textContent === msg) setMessage("");
    }, 1100);
  }

  function shakeScreen(big) {
    const cls = big ? "shake-big" : "shake";
    document.body.classList.remove("shake", "shake-big");
    void document.body.offsetWidth;
    document.body.classList.add(cls);
    setTimeout(() => document.body.classList.remove(cls), big ? 700 : 450);
  }

  // ---------- Global input ----------
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Enter") {
      handleKey("Enter");
    } else if (e.key === "Backspace") {
      handleKey("Back");
    } else if (/^[a-z]$/i.test(e.key)) {
      handleKey(e.key);
    }
  });

  nextBtn.addEventListener("click", nextGame);
  shareBtn.addEventListener("click", share);

  // ---------- Stats modal ----------
  const statsModal = document.getElementById("statsModal");
  const distEl = document.getElementById("dist");

  function renderStats(highlight) {
    const winPct = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
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

  function openStats() {
    renderStats(0);
    statsModal.hidden = false;
  }
  function closeStats() {
    statsModal.hidden = true;
  }

  document.getElementById("statsBtn").addEventListener("click", openStats);
  document.getElementById("statsClose").addEventListener("click", closeStats);
  document.getElementById("statsPlay").addEventListener("click", () => {
    closeStats();
    nextGame();
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
      document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (_) {}
    applyTheme(next);
  });

  // ---------- Sound toggle ----------
  const soundBtn = document.getElementById("soundBtn");
  function applySound(on) {
    Sound.setMuted(!on);
    soundBtn.textContent = on ? "🔊" : "🔇";
  }
  const soundPref = localStorage.getItem(SOUND_KEY);
  applySound(soundPref !== "off"); // sound on by default
  soundBtn.addEventListener("click", () => {
    const on = Sound.isMuted(); // toggling: if muted, turn on
    applySound(on);
    try {
      localStorage.setItem(SOUND_KEY, on ? "on" : "off");
    } catch (_) {}
  });
  // Browsers require a gesture before audio can start.
  window.addEventListener("pointerdown", () => Sound.ensure(), { once: true });
  window.addEventListener("keydown", () => Sound.ensure(), { once: true });

  // ---------- Pack picker ----------
  const catChips = document.getElementById("catChips");
  // Show packs in a friendly order.
  const CAT_ORDER = ["all", "common", "genz", "vulgar"];

  function buildCatChips() {
    catChips.innerHTML = "";
    for (const key of CAT_ORDER) {
      const c = CATEGORIES[key];
      if (!c) continue;
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "cat-chip" + (key === category ? " active" : "");
      chip.textContent = `${c.emoji} ${c.label}`;
      chip.title = `${c.words.length} words`;
      chip.setAttribute("aria-pressed", key === category ? "true" : "false");
      chip.addEventListener("click", () => setCategory(key));
      catChips.appendChild(chip);
    }
  }

  function setCategory(key) {
    if (!CATEGORIES[key] || key === category) return;
    category = key;
    try {
      localStorage.setItem(CAT_KEY, key);
    } catch (_) {}
    buildCatChips();
    newGame();
  }

  buildCatChips();
  newGame();
})();
