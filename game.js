const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const W = canvas.width;
const H = canvas.height;

const LANES = 2;
const BASE_SPEED = 4;
const SPEED_INCREMENT = 0.10; // 10% every 10 points

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
  best: localStorage.getItem("best") || 0,
  speed: BASE_SPEED,
  closeCalls: 0,
  maxStreak: 0,
  streak: 0,
  shake: 0
};

let obstacles = [];
let lastSpawn = 0;

function laneX(lane) {
  const laneWidth = W / LANES;
  return lane * laneWidth + laneWidth / 2;
}

Player.x = laneX(Player.lane);
Player.targetX = Player.x;

/* ================= INPUT ================= */

document.addEventListener("keydown", (e) => {
  if (!Game.running && e.key.toLowerCase() === "r") restart();

  if (!Game.running) return;

  if ((e.key === "ArrowLeft" || e.key === "a") && Player.lane > 0) {
    Player.lane--;
  }
  if ((e.key === "ArrowRight" || e.key === "d") && Player.lane < LANES - 1) {
    Player.lane++;
  }
  Player.targetX = laneX(Player.lane);
});

/* TAP = SWITCH LANE / RESTART */
canvas.addEventListener("pointerdown", () => {
  if (!Game.running) {
    restart();
    return;
  }

  Player.lane = Player.lane === 0 ? 1 : 0;
  Player.targetX = laneX(Player.lane);
});

/* ================= GAME LOGIC ================= */

function spawnObstacle() {
  obstacles.push({
    lane: Math.floor(Math.random() * LANES),
    y: -30,
    radius: 20,
    hit: false
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
  Player.targetX = laneX(Player.lane);
}

function update() {
  if (!Game.running) return;

  Player.x += (Player.targetX - Player.x) * 0.15;

  if (Date.now() - lastSpawn > 900) {
    spawnObstacle();
    lastSpawn = Date.now();
  }

  obstacles.forEach((o) => {
    o.y += Game.speed;

    const dx = Math.abs(Player.x - laneX(o.lane));
    const dy = Math.abs(Player.y - o.y);
    const dist = Math.sqrt(dx * dx + dy * dy);

    const overlap = (Player.radius + o.radius) - dist;

    // CLOSE CALL
    if (overlap > -20 && overlap < 0 && !o.hit) {
      Game.closeCalls++;
      Game.streak++;
      Game.maxStreak = Math.max(Game.maxStreak, Game.streak);
    }

    // COLLISION (40% rule)
    if (overlap > Player.radius * 0.4 && !o.hit) {
      o.hit = true;
      Game.running = false;
      Game.shake = 12;
      Game.best = Math.max(Game.best, Game.score);
      localStorage.setItem("best", Game.best);
    }

    if (o.y > H + 40 && !o.hit) {
      Game.score++;
      Game.streak = 0;
      updateSpeed();
      o.hit = true;
    }
  });

  obstacles = obstacles.filter(o => o.y < H + 100);
}

function draw() {
  ctx.save();

  if (Game.shake > 0) {
    ctx.translate(
      (Math.random() - 0.5) * Game.shake,
      (Math.random() - 0.5) * Game.shake
    );
    Game.shake *= 0.9;
  }

  ctx.clearRect(0, 0, W, H);

  // Lanes
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  for (let i = 1; i < LANES; i++) {
    ctx.beginPath();
    ctx.moveTo((W / LANES) * i, 0);
    ctx.lineTo((W / LANES) * i, H);
    ctx.stroke();
  }

  // Player
  ctx.fillStyle = "#f1c40f";
  ctx.beginPath();
  ctx.arc(Player.x, Player.y, Player.radius, 0, Math.PI * 2);
  ctx.fill();

  // Obstacles
  ctx.fillStyle = "#c0392b";
  obstacles.forEach(o => {
    ctx.beginPath();
    ctx.arc(laneX(o.lane), o.y, o.radius, 0, Math.PI * 2);
    ctx.fill();
  });

  // HUD
  ctx.fillStyle = "#fff";
  ctx.font = "16px Arial";
  ctx.fillText(`Score: ${Game.score}`, 20, 30);
  ctx.fillText(`Best: ${Game.best}`, W - 100, 30);
  ctx.fillText(`Close Calls: ${Game.closeCalls}`, 20, 55);

  if (!Game.running) {
    ctx.textAlign = "center";
    ctx.font = "36px Arial";
    ctx.fillText("Game Over", W / 2, H / 2 - 40);
    ctx.font = "18px Arial";
    ctx.fillText(`Score: ${Game.score}`, W / 2, H / 2);
    ctx.fillText(`Best: ${Game.best}`, W / 2, H / 2 + 25);
    ctx.fillText(`Close Calls: ${Game.closeCalls}`, W / 2, H / 2 + 50);
    ctx.fillText(`Max Streak: ${Game.maxStreak}`, W / 2, H / 2 + 75);
    ctx.fillText("Tap or Press R to Restart", W / 2, H / 2 + 110);
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