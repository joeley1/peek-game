const c = document.getElementById("c");
const ctx = c.getContext("2d");
const restartBtn = document.getElementById("restart");

const W = c.width, H = c.height;

// --- tiny sound (no files) ---
let audioCtx = null;
function beepClick() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime;

    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();

    o.type = "square";
    o.frequency.setValueAtTime(780, t);
    o.frequency.exponentialRampToValueAtTime(520, t + 0.035);

    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);

    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(t);
    o.stop(t + 0.055);
  } catch (_) {}
}

const Game = {
  running: true,
  score: 0,
  best: Number(localStorage.getItem("odBest") || 0),

  baseSpeed: 220,
  speed: 220,
  spawnEvery: 0.65,
  spawnTimer: 0,

  speedLevel: 0,

  // overlay + boost effects
  overlayText: "",
  overlayT: 0,
  boostT: 0,

  // game over popup state
  justDied: false,
  diedBestBefore: 0,
  diedNewBest: false
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

  Game.overlayText = "";
  Game.overlayT = 0;
  Game.boostT = 0;

  Game.justDied = false;
  Game.diedBestBefore = 0;
  Game.diedNewBest = false;

  Player.lane = 1;
  Obstacles = [];
}

function showLevelUpOverlay() {
  Game.overlayText = "+20% SPEED!";
  Game.overlayT = 0.85;
  Game.boostT = 0.35;
}

function switchLane() {
  if (!Game.running) return;
  Player.lane = (Player.lane + 1) % Lanes;
  beepClick();
}

function spawnObstacle() {
  const lane = Math.floor(Math.random() * Lanes);
  Obstacles.push({ lane, y: -30, r: 18 });
}

// NEW: "40% overlap" collision rule
// Death only triggers when the obstacle overlaps the player meaningfully,
// not when it barely grazes the edge.
//
// Equivalent to requiring >= 40% of obstacle radius penetrates into player circle:
// distance <= Player.r + 0.60 * obs.r
function hitTest(obs) {
  const px = laneX(Player.lane), py = Player.y;
  const ox = laneX(obs.lane), oy = obs.y;

  const d = Math.hypot(px - ox, py - oy);
  const hitDistance = Player.r + obs.r * 0.60;

  return d < hitDistance;
}

function die() {
  const bestBefore = Game.best;

  let newBest = bestBefore;
  let isNew = false;

  if (Game.score > bestBefore) {
    newBest = Game.score;
    isNew = true;
  } else if (bestBefore === 0 && Game.score >= 0) {
    newBest = Math.max(bestBefore, Game.score);
    isNew = (Game.score > 0);
  }

  Game.diedBestBefore = bestBefore;
  Game.diedNewBest = isNew;

  Game.best = Math.max(bestBefore, newBest);
  localStorage.setItem("odBest", String(Game.best));

  Game.running = false;
  Game.justDied = true;
}

function update(dt) {
  // timers for overlays even when dead
  if (Game.overlayT > 0) Game.overlayT = Math.max(0, Game.overlayT - dt);
  if (Game.boostT > 0) Game.boostT = Math.max(0, Game.boostT - dt);

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
      die();
      break;
    }
  }

  // score: +1 per obstacle successfully passed
  const before = Obstacles.length;
  Obstacles = Obstacles.filter(o => o.y < H + 40);
  const removed = before - Obstacles.length;

  if (removed > 0) {
    Game.score += removed;

    // every 10 points -> +20% speed
    const newLevel = Math.floor(Game.score / 10);
    if (newLevel !== Game.speedLevel) {
      Game.speedLevel = newLevel;
      Game.speed = Game.baseSpeed * Math.pow(1.20, Game.speedLevel);
      showLevelUpOverlay();
    }
  }
}

function drawPopupMenu() {
  const boxW = 290;
  const boxH = 190;
  const x = (W - boxW) / 2;
  const y = (H - boxH) / 2;

  ctx.fillStyle = "rgba(0,0,0,0.65)";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(20,20,30,0.92)";
  ctx.fillRect(x, y, boxW, boxH);

  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, boxW, boxH);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 28px system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Game Over", W / 2, y + 40);

  ctx.font = "16px system-ui";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText(`Score: ${Game.score}`, W / 2 - 70, y + 88);
  ctx.fillText(`Best: ${Game.best}`,  W / 2 + 70, y + 88);

  if (Game.diedNewBest && Game.score > 0) {
    ctx.fillStyle = "#ffd54a";
    ctx.font = "bold 14px system-ui";
    ctx.fillText("NEW BEST!", W / 2, y + 115);
  }

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "14px system-ui";
  ctx.fillText("Tap to restart", W / 2, y + 148);
  ctx.fillText("or press R / Restart button", W / 2, y + 170);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  // background
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#0b1220");
  g.addColorStop(1, "#071018");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // boost flash effect
  if (Game.boostT > 0) {
    const a = Math.min(1, Game.boostT / 0.35);
    ctx.fillStyle = `rgba(255, 215, 0, ${0.10 * a})`;
    ctx.fillRect(0, 0, W, H);
  }

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

  // level-up overlay
  if (Game.overlayT > 0) {
    const t = Game.overlayT;
    const alpha = Math.min(1, t / 0.15);
    ctx.save();
    ctx.globalAlpha = alpha;

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(0, 70, W, 46);

    ctx.fillStyle = "#ffd54a";
    ctx.font = "bold 18px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(Game.overlayText, W / 2, 93);

    ctx.restore();
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  // game over popup
  if (!Game.running) {
    drawPopupMenu();
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
  if (!Game.running) { reset(); return; }
  switchLane();
}
c.addEventListener("touchstart", handleTap, { passive: false });
c.addEventListener("click", handleTap, { passive: false });

restartBtn.addEventListener("click", reset);

reset();