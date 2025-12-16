const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

// IMPORTANT: do NOT override your HTML canvas size.
// Your index.html already sets width/height.
const W = canvas.width;
const H = canvas.height;

const LANES = 3;                // ✅ back to 3 lanes
const BASE_SPEED = 4;
const SPEED_INCREMENT = 0.10;   // 10% every 10 points

const Player = {
  lane: 0,
  x: 0,
  y: H - 120,
  radius: 18,
  targetX: 0
};

const Game = {
  running: true,
  score: 0,
  best: Number(localStorage.getItem("best") || 0),
  speed: BASE_SPEED,
  closeCalls: 0,
  maxStreak: 0,
  streak: 0,
  shake: 0
};

let obstacles = [];
let lastSpawn = 0;

function laneX(lane) {
  // evenly spaced lanes across the canvas
  return (W / (LANES + 1)) * (lane + 1);
}

Player.x = laneX(Player.lane);
Player.targetX = Player.x;

/* ================= INPUT ================= */

document.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();

  if (!Game.running && k === "r") restart();
  if (!Game.running) return;

  if ((e.key === "ArrowLeft" || k === "a") && Player.lane > 0) {
    Player.lane--;
    Player.targetX = laneX(Player.lane);
  }

  if ((e.key === "ArrowRight" || k === "d") && Player.lane < LANES - 1) {
    Player.lane++;
    Player.targetX = laneX(Player.lane);
  }
});

// Tap = move RIGHT one lane (cycle). If dead, restart.
canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();

  if (!Game.running) {
    restart();
    return;
  }

  Player.lane = (Player.lane + 1) % LANES;  // ✅ tap cycles right
  Player.targetX = laneX(Player.lane);
});

/* ================= GAME LOGIC ================= */

function spawnObstacle() {
  obstacles.push({
    lane: Math.floor(Math.random() * LANES),
    y: -30,
    radius: 20,
    hit: false,
    checked: false
  });
}

function updateSpeed() {
  const level = Math.floor(Game.score / 10);
  Game.speed = BASE_SPEED * Math.pow(1 + SPEED_INCREMENT, level);
}

function restart() {
  Game.running = true;
  Game.score = 0;
  Game.speed = BASE_SPEED;
  Game.closeCalls = 0;
  Game.streak = 0;
  Game.maxStreak = 0;
  obstacles = [];
  Player.lane = 0;
  Player.x = laneX(Player.lane);
  Player.targetX = Player.x;
  lastSpawn = Date.now();
}

function update() {
  if (!Game.running) return;

  // Smooth movement toward lane
  Player.x += (Player.targetX - Player.x) * 0.15;

  // Spawn
  if (Date.now() - lastSpawn > 900) {
    spawnObstacle();
    lastSpawn = Date.now();
  }

  obstacles.forEach((o) => {
    o.y += Game.speed;

    const ox = laneX(o.lane);
    const dx = Player.x - ox;
    const dy = Player.y - o.y;
    const dist = Math.hypot(dx, dy);

    const overlap = (Player.radius + o.radius) - dist;

    // Close call (within 20px margin but not colliding)
    // Only check once when obstacle passes player area
    if (!o.checked && o.y > Player.y) {
      o.checked = true;

      if (overlap < 0 && overlap > -20 && o.lane === Player.lane) {
        Game.closeCalls++;
        Game.streak++;
        Game.maxStreak = Math.max(Game.maxStreak, Game.streak);
      } else {
        Game.streak = 0;
      }
    }

    // Collision (40% overlap rule)
    if (overlap > Player.radius * 0.4 && !o.hit) {
      o.hit = true;
      Game.running = false;
      Game.shake = 12;

      Game.best = Math.max(Game.best, Game.score);
      localStorage.setItem("best", String(Game.best));
    }

    // Score when obstacle passes below player
    if (o.y > H + 40 && !o.hit) {
      Game.score++;
      updateSpeed();
      o.hit = true;
    }
  });

  obstacles = obstacles.filter(o => o.y < H + 100);
}

function draw() {
  ctx.save();

  // Camera shake on death
  if (Game.shake > 0) {
    ctx.translate(
      (Math.random() - 0.5) * Game.shake,
      (Math.random() - 0.5) * Game.shake
    );
    Game.shake *= 0.9;
  }

  ctx.clearRect(0, 0, W, H);

  // Background
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
  obstacles.forEach(o => {
    ctx.beginPath();
    ctx.arc(laneX(o.lane), o.y, o.radius, 0, Math.PI * 2);
    ctx.fill();
  });

  // Player
  ctx.fillStyle = "#f1c40f";
  ctx.beginPath();
  ctx.arc(Player.x, Player.y, Player.radius, 0, Math.PI * 2);
  ctx.fill();

  // HUD
  ctx.fillStyle = "#fff";
  ctx.font = "16px system-ui";
  ctx.fillText(`Score: ${Game.score}`, 16, 28);
  ctx.fillText(`Best: ${Game.best}`, W - 90, 28);
  ctx.fillText(`Close Calls: ${Game.closeCalls}`, 16, 52);

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

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();