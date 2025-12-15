const c = document.getElementById("c");
const ctx = c.getContext("2d");
const restartBtn = document.getElementById("restart");

const W = c.width, H = c.height;

const Game = {
  running: true,
  score: 0,
  best: Number(localStorage.getItem("odBest") || 0),

  // base difficulty
  baseSpeed: 220,      // starting obstacle fall speed
  speed: 220,          // current speed (will scale)
  spawnEvery: 0.65,    // seconds
  spawnTimer: 0,

  // NEW: speed scaling every 10 points
  speedLevel: 0        // 0 at score 0..9, 1 at 10..19, etc.
};

const Lanes = 3;
const laneX = (lane) => (W * (lane + 0.5)) / Lanes;

const Player = {
  lane: 1,
  y: H - 90,
  r: 18
};

let Obstacles = [];

function reset() {
  Game.running = true;
  Game.score = 0;

  Game.baseSpeed = 220;
  Game.speed = Game.baseSpeed;
  Game.spawnEvery = 0.65;
  Game.spawnTimer = 0;

  Game.speedLevel = 0;

  Player.lane = 1;
  Obstacles = [];
}

function switchLane() {
  if (!Game.running) return;
  Player.lane = (Player.lane + 1) % Lanes; // cycles 0->1->2->0
}

function spawnObstacle() {
  const lane = Math.floor(Math.random() * Lanes);
  Obstacles.push({
    lane,
    y: -30,
    r: 18
  });
}

function hitTest(obs) {
  const px = laneX(Player.lane), py = Player.y;
  const ox = laneX(obs.lane), oy = obs.y;
  const dx = px - ox, dy = py - oy;
  const d = Math.hypot(dx, dy);
  return d < Player.r + obs.r;
}

function update(dt) {
  if (!Game.running) return;

  // spawning timing (unchanged)
  Game.spawnEvery = Math.max(0.32, 0.65 - Game.score * 0.002);

  // spawning
  Game.spawnTimer += dt;
  if (Game.spawnTimer >= Game.spawnEvery) {
    spawnObstacle();
    Game.spawnTimer = 0;
  }

  // move obstacles + collision
  for (const o of Obstacles) {
    o.y += Game.speed * dt;

    if (hitTest(o)) {
      Game.running = false;
      Game.best = Math.max(Game.best, Game.score);
      localStorage.setItem("odBest", String(Game.best));
    }
  }

  // score: +1 per obstacle successfully passed
  const before = Obstacles.length;
  Obstacles = Obstacles.filter(o => o.y < H + 40);
  const removed = before - Obstacles.length;

  if (removed > 0) {
    Game.score += removed;

    // NEW: every time score crosses 10, 20, 30... increase speed by 5%
    const newLevel = Math.floor(Game.score / 10);
    if (newLevel !== Game.speedLevel) {
      Game.speedLevel = newLevel;

      // 5% increase per level: baseSpeed * (1.05 ^ level)
      Game.speed = Game.baseSpeed * Math.pow(1.05, Game.speedLevel);
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  // background
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#0b1220");
  g.addColorStop(1, "#071018");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // lane dividers
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  for (let i = 1; i < Lanes; i++) {
    const x = (W * i) / Lanes;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // HUD
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(0, 0, W, 60);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 18px system-ui";
  ctx.fillText("Obstacle Dodge", 14, 38);
  ctx.font = "14px system-ui";
  ctx.fillText(`Score: ${Game.score}   Best: ${Game.best}`, W - 190, 38);

  // player
  const px = laneX(Player.lane);
  ctx.fillStyle = "#f1c40f";
  ctx.beginPath();
  ctx.arc(px, Player.y, Player.r, 0, Math.PI * 2);
  ctx.fill();

  // obstacles
  ctx.fillStyle = "#e74c3c";
  for (const o of Obstacles) {
    const ox = laneX(o.lane);
    ctx.beginPath();
    ctx.arc(ox, o.y, o.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // game over overlay
  if (!Game.running) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 30px system-ui";
    ctx.fillText("Game Over", 120, 320);
    ctx.font = "16px system-ui";
    ctx.fillText("Tap to restart • or press R", 105, 355);
  }
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

// Keyboard controls
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (e.code === "Space" || k === " ") { e.preventDefault(); switchLane(); }
  if (k === "r") reset();
});

// Mobile-friendly tap handling
function handleTap(e) {
  e.preventDefault();

  if (!Game.running) {
    reset();
    return;
  }
  switchLane();
}

c.addEventListener("touchstart", handleTap, { passive: false });
c.addEventListener("click", handleTap, { passive: false });

restartBtn.addEventListener("click", reset);

reset();