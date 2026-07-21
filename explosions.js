/*
 * Boomdle explosion engine.
 * A single full-screen canvas hosts every particle. Callers push explosions
 * at page coordinates; the engine owns the animation loop and cleans itself
 * up when nothing is left on screen.
 */
const Explosions = (() => {
  const canvas = document.getElementById("fx");
  const ctx = canvas.getContext("2d");
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  const particles = [];
  const shockwaves = [];
  let running = false;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  const GRAVITY = 0.28;
  // Hard ceiling on live particles. Past this, new spawns are dropped so a
  // win (or rapid guesses) can never flood the frame and stall the browser.
  const MAX_PARTICLES = 460;
  const rand = (min, max) => min + Math.random() * (max - min);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  // Pre-rendered glow sprites, one per color. A radial gradient baked into a
  // small offscreen canvas is drawn with drawImage under "lighter" blending —
  // this gives the same soft glow as ctx.shadowBlur at a tiny fraction of the
  // cost (shadowBlur re-blurs every particle every frame and is the main
  // cause of lag once there are a few hundred on screen).
  const spriteCache = new Map();
  function sprite(color) {
    let c = spriteCache.get(color);
    if (c) return c;
    const S = 32;
    c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grd.addColorStop(0, color);
    grd.addColorStop(0.3, color);
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.beginPath();
    g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2);
    g.fill();
    spriteCache.set(color, c);
    return c;
  }

  // Warm "fire" palette plus a few bright sparks.
  const FIRE = ["#fff3b0", "#ffd23f", "#ff8c00", "#ff5a1f", "#ff2d00", "#c81d11"];
  const SPARK = ["#fffbe6", "#ffe08a", "#ffffff"];

  function spawnParticles(x, y, opts = {}) {
    const {
      count = 34,
      speed = 7,
      colors = FIRE,
      size = 4,
      spread = Math.PI * 2,
      angle = 0,
      life = 60,
    } = opts;

    // Drop the spawn (partially or fully) if we're at the particle ceiling.
    const room = MAX_PARTICLES - particles.length;
    if (room <= 0) return;
    const n = Math.min(count, room);

    for (let i = 0; i < n; i++) {
      const a = angle + rand(-spread / 2, spread / 2);
      const v = rand(speed * 0.35, speed);
      particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - rand(0, 2),
        r: rand(size * 0.5, size),
        spr: sprite(pick(colors)),
        life: rand(life * 0.6, life),
        maxLife: life,
        gravity: opts.gravity ?? GRAVITY,
      });
    }
  }

  function spawnShockwave(x, y, opts = {}) {
    shockwaves.push({
      x,
      y,
      r: opts.r0 ?? 4,
      max: opts.max ?? 90,
      speed: opts.speed ?? 6,
      color: opts.color ?? "#ffce54",
      width: opts.width ?? 4,
      alpha: 1,
    });
  }

  function ensureLoop() {
    if (running) return;
    running = true;
    requestAnimationFrame(loop);
  }

  function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Shockwave rings.
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const s = shockwaves[i];
      s.r += s.speed;
      s.alpha = Math.max(0, 1 - s.r / s.max);
      if (s.alpha <= 0) {
        shockwaves.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = s.alpha;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width * s.alpha;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Particles. Additive blending + a cached glow sprite per color.
    ctx.globalCompositeOperation = "lighter";
    const h = window.innerHeight;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vx *= 0.985;
      p.vy = p.vy * 0.985 + p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.life--;

      if (p.life <= 0 || p.y > h + 40) {
        particles.splice(i, 1);
        continue;
      }

      const t = p.life / p.maxLife;
      ctx.globalAlpha = t < 0 ? 0 : t;
      // Sprite covers ~3x the particle radius so its soft edge reads as glow.
      const d = p.r * 3 * (0.5 + t * 0.5);
      ctx.drawImage(p.spr, p.x - d / 2, p.y - d / 2, d, d);
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    if (particles.length || shockwaves.length) {
      requestAnimationFrame(loop);
    } else {
      running = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  // ---- Public API ----

  // Center-of-element burst. Used when a tile "detonates".
  function boomAt(el, opts = {}) {
    const rect = el.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    spawnParticles(x, y, { count: 26, speed: 6, size: 4, ...opts });
    spawnShockwave(x, y, { max: 70, speed: 5, ...(opts.shock || {}) });
    ensureLoop();
  }

  // A quick spark puff, e.g. on a keypress.
  function spark(x, y) {
    spawnParticles(x, y, {
      count: 8,
      speed: 4,
      size: 2.4,
      colors: SPARK,
      life: 34,
      gravity: 0.15,
    });
    ensureLoop();
  }

  // Big celebratory blast: confetti-fireworks from multiple origins.
  function megaBoom() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const origins = [
      [w * 0.5, h * 0.4],
      [w * 0.28, h * 0.5],
      [w * 0.72, h * 0.5],
      [w * 0.5, h * 0.62],
    ];
    origins.forEach(([x, y], i) => {
      setTimeout(() => {
        spawnParticles(x, y, {
          count: 42,
          speed: 11,
          size: 5,
          colors: [...FIRE, "#4caf50", "#42a5f5", "#ab47bc", "#fff"],
          life: 80,
        });
        spawnShockwave(x, y, { max: 160, speed: 8, width: 6 });
        ensureLoop();
      }, i * 150);
    });
  }

  // Rolling explosion across a whole row of tiles.
  function detonateRow(tiles, colorFor) {
    tiles.forEach((tile, i) => {
      setTimeout(() => {
        const colors =
          colorFor && colorFor(i)
            ? shadeColors(colorFor(i))
            : FIRE;
        boomAt(tile, { count: 30, speed: 7, colors });
        tile.classList.add("boom");
        setTimeout(() => tile.classList.remove("boom"), 400);
      }, i * 90);
    });
  }

  // Map a tile state color to a small themed palette.
  function shadeColors(state) {
    switch (state) {
      case "correct":
        return ["#e8f5e9", "#a5d6a7", "#4caf50", "#2e7d32"];
      case "present":
        return ["#fff8e1", "#ffe082", "#ffca28", "#c9a227"];
      default:
        return ["#eceff1", "#b0bec5", "#78909c", "#455a64"];
    }
  }

  return { boomAt, spark, megaBoom, detonateRow };
})();
