const c = document.getElementById("c");
const ctx = c.getContext("2d");
const restartBtn = document.getElementById("restart");

const W = c.width, H = c.height;

// ---------------- SOUND ----------------
let audioCtx = null;
function beep(freq = 700, dur = 0.05) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "square";
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(t); o.stop(t + dur);
  } catch {}
}

// ---------------- GAME STATE ----------------
const Game = {
  running: true,
  score: 0,
  best: Number(localStorage.getItem("odBest") || 0),

  baseSpeed: 220,
  speed: 220,
  speedLevel: 0,

  spawnEvery: 0.65,
  spawnTimer: 0,

  combo: 0,

  overlayText: "",
  overlayT: 0,
  boostT: 0
};

const Lanes = 3;
const laneX = l => (W * (l + 0.5)) / Lanes;

const Player = {
  lane: 1,
  y: H - 90,
  r: 18
};

let Obstacles = [];

// ---------------- RESET ----------------
function reset() {
  Game.running = true;
  Game.score = 0;
  Game.combo = 0;

  Game.speedLevel = 0;
  Game.speed = Game.baseSpeed;

  Game.spawnEvery = 0.65;
  Game.spawnTimer = 0;

  Game.overlayText = "";
  Game.overlayT = 0;
  Game.boostT = 0;

  Player.lane = 1;
  Obstacles = [];
}

// ---------------- GAMEPLAY ----------------
function switchLane() {
  if (!Game.running) return;
  Player.lane = (Player.lane + 1) % Lanes;
  beep(650);
}

function spawnObstacle() {
  Obstacles.push({
    lane: Math.floor(Math.random() * Lanes),
    y: -30,
    r: 18,
    scored: false
  });
}

// 40% overlap rule
function hitDistance(obs) {
  return Player.r + obs.r * 0.60;
}

// ---------------- UPDATE ----------------
function update(dt) {
  if (Game.overlayT > 0) Game.overlayT -= dt;
  if (Game.boostT > 0) Game.boostT -= dt;
  if (!Game.running) return;

  Game.spawnEvery = Math.max(0.32, 0.65 - Game.score * 0.002);

  Game.spawnTimer += dt;
  if (Game.spawnTimer >= Game.spawnEvery) {
    spawnObstacle();
    Game.spawnTimer = 0;
  }

  for (const o of Obstacles) {
    o.y += Game.speed * dt;

    const px = laneX(Player.lane), py = Player.y;
    const ox = laneX(o.lane), oy = o.y;
    const d = Math.hypot(px - ox, py - oy);

    // death
    if (d < hitDistance(o)) {
      Game.running = false;
      Game.best = Math.max(Game.best, Game.score);
      localStorage.setItem("odBest", String(Game.best));
      Game.combo = 0;
      return;
    }

    // PERFECT DODGE CHECK
    if (!o.scored && o.lane === Player.lane && o.y > Player.y) {
      const perfectMargin = 8; // pixels
      if (d <= hitDistance(o) + perfectMargin) {
        Game.combo++;
        Game.score += Game.combo; // bonus scales
        Game.overlayText = `PERFECT x${Game.combo}`;
        Game.overlayT = 0.6;
        beep(980);
      } else {
        Game.combo = 0;
        Game.score += 1;
      }
      o.scored = true;

      // SPEED SCALING — TRUE 10%
      const lvl = Math.floor(Game.score / 10);
      if (lvl !== Game.speedLevel) {
        Game.speedLevel = lvl;
        Game.speed = Game.baseSpeed * Math.pow(1.10, Game.speedLevel);
        Game.overlayText = "+10% SPEED!";
        Game.overlayT = 0.8;
        Game.boostT = 0.35;
      }
    }
  }

  Obstacles = Obstacles.filter(o => o.y < H + 40);
}

// ---------------- DRAW ----------------
function draw() {
  ctx.clearRect(0, 0, W, H);

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#0b1220");
  g.addColorStop(1, "#071018");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  if (Game.boostT > 0) {
    ctx.fillStyle = `rgba(255,215,0,${0.1 * (Game.boostT / 0.35)})`;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#fff";
  for (let i = 1; i < Lanes; i++) {
    const x = (W * i) / Lanes;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#f1c40f";
  ctx.beginPath();
  ctx.arc(laneX(Player.lane), Player.y, Player.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#e74c3c";
  for (const o of Obstacles) {
    ctx.beginPath();
    ctx.arc(laneX(o.lane), o.y, o.r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#fff";
  ctx.font = "14px system-ui";
  ctx.fillText(`Score: ${Game.score}   Best: ${Game.best}   Combo: x${Game.combo}`, 12, 28);

  if (Game.overlayT > 0) {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 60, W, 44);
    ctx.fillStyle = "#ffd54a";
    ctx.font = "bold 18px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(Game.overlayText, W / 2, 88);
    ctx.textAlign = "left";
  }

  if (!Game.running) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 28px system-ui";
    ctx.fillText("Game Over", W / 2 - 80, H / 2 - 10);
    ctx.font = "16px system-ui";
    ctx.fillText("Tap / R to restart", W / 2 - 70, H / 2 + 20);
  }
}

// ---------------- LOOP ----------------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ---------------- CONTROLS ----------------
window.addEventListener("keydown", e => {
  if (e.code === "Space") { e.preventDefault(); switchLane(); }
  if (e.key.toLowerCase() === "r") reset();
});

function handleTap(e) {
  e.preventDefault();
  if (!Game.running) reset();
  else switchLane();
}
c.addEventListener("touchstart", handleTap, { passive: false });
c.addEventListener("click", handleTap, { passive: false });

restartBtn.addEventListener("click", reset);

reset();