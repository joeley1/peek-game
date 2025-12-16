const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

const W = canvas.width;
const H = canvas.height;

const LANES = 3;

// Speed model (stable across devices)
const BASE_SPEED_PX = 280;      // pixels/second baseline
const SPEED_INCREMENT = 0.10;   // +10% every 10 points

// Close call tuning
const CLOSE_MARGIN_PX = 35;     // you chose 20

const Player = {
  lane: 0,
  x: 0,
  y: H - 120,
  r: 18,
  targetX: 0
};

const Game = {
  running: true,
  score: 0,
  best: Number(localStorage.getItem("best") || 0),

  // derived each frame:
  speedMul: 1.0,
  speedPx: BASE_SPEED_PX,

  closeCalls: 0,
  streak: 0,
  maxStreak: 0,

  shakeT: 0,
  shakeMag: 0
};

let obstacles = [];
let spawnAcc = 0;

// ---------- AUDIO (unlocked correctly) ----------
let audioCtx = null;

function ensureAudioUnlocked() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch (_) {}
}

function playClick() {
  try {
    ensureAudioUnlocked();
    if (!audioCtx) return;

    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();

    o.type = "square";
    o.frequency.setValueAtTime(780, t);
    o.frequency.exponentialRampToValueAtTime(520, t + 0.035);

    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.14, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);

    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(t);
    o.stop(t + 0.07);
  } catch (_) {}
}

function playDeath() {
  try {
    ensureAudioUnlocked();
    if (!audioCtx) return;

    // Harsh “drop” sound (more aggressive than before)
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();

    o.type = "sawtooth";
    o.frequency.setValueAtTime(240, t);
    o.frequency.exponentialRampToValueAtTime(65, t + 0.22);

    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);

    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(t);
    o.stop(t + 0.30);
  } catch (_) {}
}

// ---------- helpers ----------
function laneX(lane) {
  return (W / (LANES + 1)) * (lane + 1);
}

function updateSpeedFromScore() {
  const level = Math.floor(Game.score / 10);
  Game.speedMul = Math.pow(1 + SPEED_INCREMENT, level);   // 1.00, 1.10, 1.21, ...
  Game.speedPx = BASE_SPEED_PX * Game.speedMul;
}

function spawnObstacle() {
  obstacles.push({
    lane: Math.floor(Math.random() * LANES),
    y: -30,
    r: 20,
    hit: false,
    checked: false,
    scored: false
  });
}

function restart() {
  Game.running = true;
  Game.score = 0;
  Game.closeCalls = 0;
  Game.streak = 0;
  Game.maxStreak = 0;

  Game.shakeT = 0;
  Game.shakeMag = 0;

  obstacles = [];
  spawnAcc = 0;

  Player.lane = 0;
  Player.x = laneX(Player.lane);
  Player.targetX = Player.x;

  updateSpeedFromScore();
}

Player.x = laneX(Player.lane);
Player.targetX = Player.x;
updateSpeedFromScore();

// ---------- INPUT ----------
document.addEventListener("keydown", (e) => {
  ensureAudioUnlocked();

  const k = e.key.toLowerCase();

  if (!Game.running && k === "r") {
    restart();
    return;
  }
  if (!Game.running) return;

  if ((e.key === "ArrowLeft" || k === "a") && Player.lane > 0) {
    Player.lane--;
    Player.targetX = laneX(Player.lane);
    playClick();
  }

  if ((e.key === "ArrowRight" || k === "d") && Player.lane < LANES - 1) {
    Player.lane++;
    Player.targetX = laneX(Player.lane);
    playClick();
  }
});

// Tap anywhere: alive => move RIGHT (cycle). dead => restart.
canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  ensureAudioUnlocked();

  if (!Game.running) {
    restart();
    return;
  }

  Player.lane = (Player.lane + 1) % LANES;
  Player.targetX = laneX(Player.lane);
  playClick();
}, { passive: false });

// ---------- GAME LOOP ----------
function update(dt) {
  // Smooth lane movement (dt-safe)
  const smoothing = 18; // higher = snappier
  Player.x += (Player.targetX - Player.x) * (1 - Math.exp(-smoothing * dt));

  // Effects timers (even if dead, shake still drawn)
  if (Game.shakeT > 0) {
    Game.shakeT -= dt;
    if (Game.shakeT < 0) Game.shakeT = 0;
  }

  if (!Game.running) return;

  // Spawn logic: roughly consistent with earlier feel
  // Spawn interval decreases slightly as score increases
  const spawnInterval = Math.max(0.45, 0.90 - Game.score * 0.01); // seconds
  spawnAcc += dt;
  while (spawnAcc >= spawnInterval) {
    spawnObstacle();
    spawnAcc -= spawnInterval;
  }

  // Move obstacles + evaluate
  for (const o of obstacles) {
    o.y += Game.speedPx * dt;

    const ox = laneX(o.lane);
    const dist = Math.hypot(Player.x - ox, Player.y - o.y);
    const overlap = (Player.r + o.r) - dist;

    // 40% “bite” rule:
    // Require overlap > 0.4 * obstacle radius (not player radius)
    // This matches your original intent more closely.
    const killOverlap = 0.40 * o.r;

    if (!o.hit && overlap > killOverlap) {
      o.hit = true;
      Game.running = false;

      Game.shakeT = 0.25;
      Game.shakeMag = 7;
      playDeath();

      Game.best = Math.max(Game.best, Game.score);
      localStorage.setItem("best", String(Game.best));
      break;
    }

    // Close call check once, when obstacle crosses player Y
    if (!o.checked && o.y > Player.y) {
      o.checked = true;

      const hitD = (Player.r + o.r) - killOverlap; // threshold distance where kill starts
      // Close call: just outside kill threshold, same lane
      if (o.lane === Player.lane && dist >= hitD && dist <= hitD + CLOSE_MARGIN_PX) {
        Game.closeCalls++;
        Game.streak++;
        Game.maxStreak = Math.max(Game.maxStreak, Game.streak);

        // tiny shake for feedback (optional)
        Game.shakeT = 0.10;
        Game.shakeMag = 2;
      } else {
        Game.streak = 0;
      }
    }

    // Score when obstacle fully leaves screen bottom
    if (!o.scored && o.y > H + 40) {
      o.scored = true;
      Game.score++;
      updateSpeedFromScore(); // ✅ speed updates exactly every 10 points
    }
  }

  // Cleanup
  obstacles = obstacles.filter(o => o.y < H + 120);
}

function draw() {
  // Shake translate (visual)
  let sx = 0, sy = 0;
  if (Game.shakeT > 0) {
    sx = (Math.random() - 0.5) * Game.shakeMag;
    sy = (Math.random() - 0.5) * Game.shakeMag;
  }

  ctx.save();
  ctx.translate(sx, sy);

  // Background
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#0b1220";
  ctx.fillRect(0, 0, W, H);

  // Lane dividers
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 2;
  for (let i = 1; i < LANES; i++) {
    const x = (W / LANES) * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  // Obstacles
  ctx.fillStyle = "#c0392b";
  for (const o of obstacles) {
    ctx.beginPath();
    ctx.arc(laneX(o.lane), o.y, o.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player
  ctx.fillStyle = "#f1c40f";
  ctx.beginPath();
  ctx.arc(Player.x, Player.y, Player.r, 0, Math.PI * 2);
  ctx.fill();

  // HUD
  ctx.fillStyle = "#fff";
  ctx.font = "16px system-ui";
  ctx.fillText(`Score: ${Game.score}`, 16, 28);
  ctx.fillText(`Best: ${Game.best}`, W - 90, 28);
  ctx.fillText(`Close Calls: ${Game.closeCalls}  (Streak: ${Game.streak})`, 16, 52);

  // Show speed multiplier so you can verify 10% steps:
  ctx.font = "13px system-ui";
  ctx.fillStyle = "rgba(255,255,255,0.8)";
  ctx.fillText(`Speed x${Game.speedMul.toFixed(2)}  (+10% every 10 pts)`, 16, 74);

  // Game over overlay
  if (!Game.running) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = "bold 34px system-ui";
    ctx.fillText("Game Over", W / 2, H * 0.40);

    ctx.font = "16px system-ui";
    ctx.fillText(`Score: ${Game.score}`, W / 2, H * 0.48);
    ctx.fillText(`Best: ${Game.best}`, W / 2, H * 0.53);
    ctx.fillText(`Close Calls: ${Game.closeCalls}`, W / 2, H * 0.58);
    ctx.fillText(`Max Streak: ${Game.maxStreak}`, W / 2, H * 0.63);
    ctx.fillText("Tap or Press R to Restart", W / 2, H * 0.72);
    ctx.textAlign = "left";
  }

  ctx.restore();
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);