const c = document.getElementById("c");
const ctx = c.getContext("2d");
const restartBtn = document.getElementById("restart");

const W = c.width, H = c.height;

// ---------------- SOUND (no files) ----------------
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

function beepPerfect() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime;

    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();

    o.type = "sine";
    o.frequency.setValueAtTime(980, t);
    o.frequency.exponentialRampToValueAtTime(1280, t + 0.05);

    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.15, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);

    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(t);
    o.stop(t + 0.10);
  } catch (_) {}
}

// ---------------- GAME STATE ----------------
const Game = {
  running: true,
  score: 0,
  best: Number(localStorage.getItem("odBest") || 0),

  baseSpeed: 220,
  speed: 220,

  spawnEvery: 0.65,
  spawnTimer: 0,

  speedLevel: 0,

  // Close Call meter (not "combo")
  closeCalls: 0,      // current streak of close calls
  closeBest: 0,       // best streak this run

  // overlay + boost effects
  overlayText: "",
  overlayT: 0,
  boostT: 0,

  // NEW: near-miss ring flash
  flashT: 0,          // seconds remaining
  flashDur: 0.18,     // total duration

  // death popup state
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

// Prevent double-trigger on mobile (touchstart + click)
let lastTapMs = 0;

// ---------------- RESET ----------------
function reset() {
  Game.running = true;
  Game.score = 0;

  Game.baseSpeed = 220;
  Game.speed = Game.baseSpeed;

  Game.spawnEvery = 0.65;
  Game.spawnTimer = 0;

  Game.speedLevel = 0;

  Game.closeCalls = 0;
  Game.closeBest = 0;

  Game.overlayText = "";
  Game.overlayT = 0;
  Game.boostT = 0;

  Game.flashT = 0;

  Game.diedNewBest = false;

  Player.lane = 1;
  Obstacles = [];
}

function showLevelUpOverlay() {
  Game.overlayText = "+10% SPEED!";
  Game.overlayT = 0.85;
  Game.boostT = 0.35;
}

function showCloseCallOverlay(streak) {
  Game.overlayText = `CLOSE CALL x${streak}`;
  Game.overlayT = 0.55;
  Game.boostT = 0.12;
}

// ---------------- CORE MECHANICS ----------------
function switchLane() {
  if (!Game.running) return;
  Player.lane = (Player.lane + 1) % Lanes;
  beepClick();
}

function spawnObstacle() {
  const lane = Math.floor(Math.random() * Lanes);
  Obstacles.push({
    lane,
    y: -30,
    r: 18,
    passed: false // important: score once when it passes you
  });
}

// 40% overlap death rule (as agreed)
// Death only when obstacle penetrates meaningfully, not just a graze.
function hitDistance(obs) {
  return Player.r + obs.r * 0.60; // <-- 40% overlap required
}

function centerDistanceToPlayer(obs) {
  const px = laneX(Player.lane), py = Player.y;
  const ox = laneX(obs.lane), oy = obs.y;
  return Math.hypot(px - ox, py - oy);
}

function die() {
  // update best
  const oldBest = Game.best;
  if (Game.score > oldBest) {
    Game.best = Game.score;
    Game.diedNewBest = true;
    localStorage.setItem("odBest", String(Game.best));
  } else {
    Game.diedNewBest = false;
  }
  Game.running = false;
}

// ---------------- UPDATE ----------------
function update(dt) {
  // timers (run even when dead)
  if (Game.overlayT > 0) Game.overlayT = Math.max(0, Game.overlayT - dt);
  if (Game.boostT > 0) Game.boostT = Math.max(0, Game.boostT - dt);

  // NEW: flash timer
  if (Game.flashT > 0) Game.flashT = Math.max(0, Game.flashT - dt);

  if (!Game.running) return;

  // Spawn pacing (kept from the good version)
  Game.spawnEvery = Math.max(0.32, 0.65 - Game.score * 0.002);

  // Spawn
  Game.spawnTimer += dt;
  if (Game.spawnTimer >= Game.spawnEvery) {
    spawnObstacle();
    Game.spawnTimer = 0;
  }

  // Move + collisions + scoring
  for (const o of Obstacles) {
    o.y += Game.speed * dt;

    // collision check
    const d = centerDistanceToPlayer(o);
    if (d < hitDistance(o)) {
      die();
      return;
    }

    // scoring event: when obstacle crosses player Y (once)
    // This makes score follow the actual "dodge flow", not "random"
    if (!o.passed && o.y >= Player.y) {
      o.passed = true;

      // Base point for dodging an obstacle (always)
      Game.score += 1;

      // Close Call rule (Option A):
      // - same lane
      // - near miss window: just outside hit distance
      // Tune this margin to taste.
      const sameLane = (o.lane === Player.lane);
      const margin = 10; // px: increase for more close calls; decrease to make it rarer

      const nearMiss = sameLane && (d >= hitDistance(o)) && (d <= hitDistance(o) + margin);

      if (nearMiss) {
        Game.closeCalls += 1;
        Game.closeBest = Math.max(Game.closeBest, Game.closeCalls);

        // Bonus points (small but meaningful, feels earned)
        Game.score += Game.closeCalls;

        // NEW: ring flash on close call
        Game.flashT = Game.flashDur;

        showCloseCallOverlay(Game.closeCalls);
        beepPerfect();
      } else {
        // Not a close call -> streak resets
        Game.closeCalls = 0;
      }

      // Speed scaling: TRUE +10% every 10 points (NOT 20%)
      const newLevel = Math.floor(Game.score / 10);
      if (newLevel !== Game.speedLevel) {
        Game.speedLevel = newLevel;
        Game.speed = Game.baseSpeed * Math.pow(1.10, Game.speedLevel);
        showLevelUpOverlay();
      }
    }
  }

  // Cleanup offscreen obstacles
  Obstacles = Obstacles.filter(o => o.y < H + 60);
}

// ---------------- DRAW ----------------
function drawPopupMenu() {
  const boxW = 300;
  const boxH = 210;
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
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.font = "bold 28px system-ui";
  ctx.fillText("Game Over", W / 2, y + 42);

  ctx.font = "16px system-ui";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText(`Score: ${Game.score}`, W / 2 - 70, y + 92);
  ctx.fillText(`Best: ${Game.best}`,  W / 2 + 70, y + 92);

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(`Close Call Best: x${Game.closeBest}`, W / 2, y + 120);

  if (Game.diedNewBest && Game.score > 0) {
    ctx.fillStyle = "#ffd54a";
    ctx.font = "bold 14px system-ui";
    ctx.fillText("NEW BEST!", W / 2, y + 145);
  }

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "14px system-ui";
  ctx.fillText("Tap to restart", W / 2, y + 172);
  ctx.fillText("or press R / Restart button", W / 2, y + 192);

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

  // boost flash effect (subtle)
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

  // HUD bar
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(0, 0, W, 60);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 18px system-ui";
  ctx.fillText("Obstacle Dodge", 14, 38);

  ctx.font = "14px system-ui";
  ctx.fillText(`Score: ${Game.score}   Best: ${Game.best}`, W - 210, 38);

  // Close Call meter (rename requested)
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "13px system-ui";
  ctx.fillText(`Close Calls: x${Game.closeCalls}`, 14, 56);

  // player
  const px = laneX(Player.lane);
  ctx.fillStyle = "#f1c40f";
  ctx.beginPath();
  ctx.arc(px, Player.y, Player.r, 0, Math.PI * 2);
  ctx.fill();

  // NEW: near-miss ring flash (only on Close Call)
  if (Game.flashT > 0) {
    const t = 1 - (Game.flashT / Game.flashDur); // 0 -> 1
    const alpha = (1 - t) * 0.9;                 // fade out
    const ringR = Player.r + 6 + t * 14;         // expands

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "#ffd54a";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(px, Player.y, ringR, 0, Math.PI * 2);
    ctx.stroke();

    // small inner ring for pop
    ctx.globalAlpha = alpha * 0.6;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, Player.y, ringR - 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // obstacles
  ctx.fillStyle = "#e74c3c";
  for (const o of Obstacles) {
    const ox = laneX(o.lane);
    ctx.beginPath();
    ctx.arc(ox, o.y, o.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // overlay banner
  if (Game.overlayT > 0) {
    const alpha = Math.min(1, Game.overlayT / 0.15);
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

  // popup on death
  if (!Game.running) {
    drawPopupMenu();
  }
}

// ---------------- MAIN LOOP ----------------
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
window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (e.code === "Space" || k === " ") { e.preventDefault(); switchLane(); }
  if (k === "r") reset();
});

// Tap = switch lane (alive) / restart (dead)
function handleTap(e) {
  e.preventDefault();

  // block double fire (touchstart + click)
  const now = Date.now();
  if (now - lastTapMs < 350) return;
  lastTapMs = now;

  if (!Game.running) { reset(); return; }
  switchLane();
}

c.addEventListener("touchstart", handleTap, { passive: false });
c.addEventListener("click", handleTap, { passive: false });

restartBtn.addEventListener("click", reset);

// Init
reset();
