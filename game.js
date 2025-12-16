const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;

/* =========================
   GAME STATE
========================= */
const Game = {
  running: true,
  score: 0,
  best: Number(localStorage.getItem("bestScore") || 0),

  speed: 1,
  speedLevel: 0,

  flashT: 0,
  flashDur: 0.25,

  boostT: 0,
  speedMsgT: 0,

  shakeT: 0,
  shakeMag: 0,

  closeMeter: 0,
  lastCloseTier: 0,

  sessionCloseCalls: 0,
  sessionMaxCombo: 0
};

/* =========================
   PLAYER
========================= */
const Player = {
  lane: 1,
  x: 0,
  targetX: 0,
  y: H - 120,
  r: 18,
  combo: 0
};

const LANES = 3;
const laneX = i => (W / (LANES + 1)) * (i + 1);
Player.x = Player.targetX = laneX(Player.lane);

/* =========================
   OBSTACLES
========================= */
const obstacles = [];
let spawnT = 0;

function spawnObstacle() {
  obstacles.push({
    lane: Math.floor(Math.random() * LANES),
    y: -40,
    r: 22,
    scored: false,
    checked: false
  });
}

/* =========================
   UPDATE
========================= */
function update(dt) {
  const alive = Game.running;

  /* ---- Gameplay only when alive ---- */
  if (alive) {
    spawnT -= dt * Game.speed;
    if (spawnT <= 0) {
      spawnObstacle();
      spawnT = 0.9;
    }
  }

  // Smooth lane movement (always allowed)
  Player.x += (Player.targetX - Player.x) * (1 - Math.exp(-18 * dt));

  obstacles.forEach(o => {
    if (alive) o.y += 260 * dt * Game.speed;

    const px = Player.x;
    const ox = laneX(o.lane);
    const d = Math.hypot(px - ox, Player.y - o.y);

    const hitD = Player.r + o.r * 0.6; // 40% forgiveness
    const margin = 20;

    // ---- Death ----
    if (alive && d < hitD) {
      Game.running = false;
      Game.shakeT = 0.28;
      Game.shakeMag = 7;
    }

    // ---- Close Call ----
    if (alive && !o.checked && o.y > Player.y) {
      o.checked = true;

      if (o.lane === Player.lane && d > hitD && d <= hitD + margin) {
        Game.lastCloseTier = d <= hitD + 8 ? 2 : 1;

        Player.combo += Game.lastCloseTier;
        Game.sessionMaxCombo = Math.max(Game.sessionMaxCombo, Player.combo);
        Game.closeMeter += Game.lastCloseTier;
        Game.sessionCloseCalls++;

        Game.flashT = Game.flashDur;
        Game.shakeT = 0.12;
        Game.shakeMag = Game.lastCloseTier === 2 ? 4 : 2;
      } else {
        Player.combo = 0;
      }
    }

    // ---- Scoring ----
    if (alive && !o.scored && o.y > Player.y + 40) {
      o.scored = true;
      Game.score++;

      const lvl = Math.floor(Game.score / 10);
      if (lvl > Game.speedLevel) {
        Game.speedLevel = lvl;
        Game.speed *= 1.10; // ✅ 10% increase
        Game.boostT = 0.3;
        Game.speedMsgT = 0.8;
      }

      if (Game.score > Game.best) {
        Game.best = Game.score;
        localStorage.setItem("bestScore", Game.best);
      }
    }
  });

  // Cleanup
  while (obstacles.length && obstacles[0].y > H + 60) {
    obstacles.shift();
  }

  /* ---- Effects update ALWAYS ---- */
  if (Game.flashT > 0) Game.flashT -= dt;
  if (Game.boostT > 0) Game.boostT -= dt;
  if (Game.speedMsgT > 0) Game.speedMsgT -= dt;
  if (Game.shakeT > 0) Game.shakeT -= dt;
}

/* =========================
   DRAW
========================= */
function draw() {
  let sx = 0, sy = 0;
  if (Game.shakeT > 0) {
    sx = (Math.random() - 0.5) * Game.shakeMag;
    sy = (Math.random() - 0.5) * Game.shakeMag;
  }

  ctx.save();
  ctx.translate(sx, sy);

  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, W, H);

  // Obstacles
  ctx.fillStyle = "#e74c3c";
  obstacles.forEach(o => {
    ctx.beginPath();
    ctx.arc(laneX(o.lane), o.y, o.r, 0, Math.PI * 2);
    ctx.fill();
  });

  // Player
  ctx.fillStyle = "#f1c40f";
  ctx.beginPath();
  ctx.arc(Player.x, Player.y, Player.r, 0, Math.PI * 2);
  ctx.fill();

  // Close call flash
  if (Game.flashT > 0) {
    const a = (Game.flashT / Game.flashDur) * 0.12;
    ctx.fillStyle = `rgba(255,213,74,${a})`;
    ctx.fillRect(0, 0, W, H);
  }

  // UI
  ctx.fillStyle = "#fff";
  ctx.font = "16px system-ui";
  ctx.fillText(`Score: ${Game.score}`, 16, 30);
  ctx.fillText(`Best: ${Game.best}`, W - 90, 30);
  ctx.fillText(`Close Calls: ${Game.closeMeter}`, 16, 55);

  if (Game.speedMsgT > 0) {
    ctx.globalAlpha = Math.min(1, Game.speedMsgT);
    ctx.font = "bold 26px system-ui";
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffd54a";
    ctx.fillText("SPEED UP!", W / 2, H * 0.25);
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  }

  // Death overlay
  if (!Game.running) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 28px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Game Over", W / 2, H * 0.35);

    ctx.font = "16px system-ui";
    ctx.fillText(`Score: ${Game.score}`, W / 2, H * 0.42);
    ctx.fillText(`Best: ${Game.best}`, W / 2, H * 0.47);
    ctx.fillText(`Close Calls: ${Game.sessionCloseCalls}`, W / 2, H * 0.52);
    ctx.fillText(`Max Streak: ${Game.sessionMaxCombo}`, W / 2, H * 0.57);
    ctx.fillText("Tap or Press R to Restart", W / 2, H * 0.65);
    ctx.textAlign = "left";
  }

  ctx.restore();
}

/* =========================
   LOOP
========================= */
let last = performance.now();
function loop(t) {
  const dt = Math.min(0.05, (t - last) / 1000);
  last = t;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* =========================
   CONTROLS
========================= */
function restart() {
  Game.running = true;
  Game.score = 0;
  Game.speed = 1;
  Game.speedLevel = 0;
  Game.closeMeter = 0;
  Game.sessionCloseCalls = 0;
  Game.sessionMaxCombo = 0;
  Player.combo = 0;
  obstacles.length = 0;
  spawnT = 0;
}

window.addEventListener("keydown", e => {
  if (e.key === "ArrowLeft" && Player.lane > 0) {
    Player.lane--;
    Player.targetX = laneX(Player.lane);
  }
  if (e.key === "ArrowRight" && Player.lane < LANES - 1) {
    Player.lane++;
    Player.targetX = laneX(Player.lane);
  }
  if (e.key.toLowerCase() === "r" && !Game.running) restart();
});

canvas.addEventListener("pointerdown", () => {
  if (!Game.running) restart();
});