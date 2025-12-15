const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const statsEl = document.getElementById("stats");
const restartBtn = document.getElementById("restartBtn");

const W = canvas.width;
const H = canvas.height;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

// -------------------- GAME STATE --------------------
const Game = {
  running: true,
  score: 0,
  best: Number(localStorage.getItem("dungeonBest") || 0),

  // wave / spawn
  wave: 1,
  spawnTimer: 0,
  spawnEvery: 1.2,     // seconds
  maxEnemies: 14
};

// -------------------- INPUT --------------------
const Keys = new Set();

const Mouse = {
  x: W / 2,
  y: H / 2,
  down: false
};

window.addEventListener("keydown", (e) => {
  Keys.add(e.key.toLowerCase());
  if (e.key.toLowerCase() === "r") reset();
});

window.addEventListener("keyup", (e) => {
  Keys.delete(e.key.toLowerCase());
});

canvas.addEventListener("mousemove", (e) => {
  const r = canvas.getBoundingClientRect();
  Mouse.x = (e.clientX - r.left) * (W / r.width);
  Mouse.y = (e.clientY - r.top) * (H / r.height);
});

canvas.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  Mouse.down = true;
});

window.addEventListener("mouseup", (e) => {
  if (e.button !== 0) return;
  Mouse.down = false;
});

restartBtn.addEventListener("click", reset);

// -------------------- PLAYER --------------------
const Player = {
  x: W / 2,
  y: H / 2,
  r: 16,
  speed: 260,
  hp: 3,
  angle: 0,

  // shooting
  fireCooldown: 0,
  fireRate: 0.12, // seconds per shot
  bulletSpeed: 640
};

// -------------------- ENTITIES --------------------
let Enemies = [];
let Bullets = [];
let Particles = [];

function spawnEnemy() {
  // spawn at edges
  const edge = Math.floor(Math.random() * 4);
  let x, y;

  if (edge === 0) { x = -20; y = Math.random() * H; }
  if (edge === 1) { x = W + 20; y = Math.random() * H; }
  if (edge === 2) { x = Math.random() * W; y = -20; }
  if (edge === 3) { x = Math.random() * W; y = H + 20; }

  const base = 70 + Game.wave * 6;
  Enemies.push({
    x, y,
    r: 15,
    hp: 2 + Math.floor(Game.wave / 3),
    speed: base + Math.random() * 25
  });
}

function spawnMuzzleFlash(x, y, a) {
  for (let i = 0; i < 8; i++) {
    Particles.push({
      x, y,
      vx: Math.cos(a) * (120 + Math.random() * 240) + (Math.random() - 0.5) * 90,
      vy: Math.sin(a) * (120 + Math.random() * 240) + (Math.random() - 0.5) * 90,
      life: 0.18 + Math.random() * 0.12
    });
  }
}

function shoot() {
  if (!Game.running) return;
  if (Player.fireCooldown > 0) return;

  Player.fireCooldown = Player.fireRate;

  const a = Player.angle;
  const sx = Player.x + Math.cos(a) * (Player.r + 10);
  const sy = Player.y + Math.sin(a) * (Player.r + 10);

  Bullets.push({
    x: sx, y: sy,
    vx: Math.cos(a) * Player.bulletSpeed,
    vy: Math.sin(a) * Player.bulletSpeed,
    r: 4,
    life: 1.4
  });

  spawnMuzzleFlash(sx, sy, a);
}

// -------------------- RESET --------------------
function reset() {
  Game.running = true;
  Game.score = 0;
  Game.wave = 1;
  Game.spawnTimer = 0;
  Game.spawnEvery = 1.2;
  Game.maxEnemies = 14;

  Player.x = W / 2;
  Player.y = H / 2;
  Player.hp = 3;
  Player.fireCooldown = 0;

  Enemies = [];
  Bullets = [];
  Particles = [];
}

// -------------------- UPDATE --------------------
function update(dt) {
  // aim always updates
  Player.angle = Math.atan2(Mouse.y - Player.y, Mouse.x - Player.x);

  if (!Game.running) return;

  // movement: WASD + arrows
  let mx = 0, my = 0;
  if (Keys.has("w") || Keys.has("arrowup")) my -= 1;
  if (Keys.has("s") || Keys.has("arrowdown")) my += 1;
  if (Keys.has("a") || Keys.has("arrowleft")) mx -= 1;
  if (Keys.has("d") || Keys.has("arrowright")) mx += 1;

  // normalize diagonal
  if (mx !== 0 || my !== 0) {
    const len = Math.hypot(mx, my);
    mx /= len; my /= len;
    Player.x += mx * Player.speed * dt;
    Player.y += my * Player.speed * dt;
  }

  // keep in bounds
  Player.x = clamp(Player.x, Player.r, W - Player.r);
  Player.y = clamp(Player.y, Player.r, H - Player.r);

  // shooting
  Player.fireCooldown = Math.max(0, Player.fireCooldown - dt);
  if (Mouse.down) shoot();

  // spawn enemies over time (wave scales it)
  Game.spawnTimer += dt;
  const targetCount = Math.min(Game.maxEnemies + Game.wave * 2, 40);

  if (Game.spawnTimer >= Game.spawnEvery && Enemies.length < targetCount) {
    spawnEnemy();
    Game.spawnTimer = 0;

    // speed up spawning slowly as waves increase
    Game.spawnEvery = Math.max(0.45, 1.2 - Game.wave * 0.05);
  }

  // bullets update
  for (const b of Bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
  }
  Bullets = Bullets.filter(b => b.life > 0 && b.x > -30 && b.x < W + 30 && b.y > -30 && b.y < H + 30);

  // enemies update + collision with player
  for (const e of Enemies) {
    const dx = Player.x - e.x;
    const dy = Player.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    e.x += (dx / d) * e.speed * dt;
    e.y += (dy / d) * e.speed * dt;

    // enemy hits player
    if (d < Player.r + e.r) {
      Player.hp -= 1;
      // knockback
      e.x -= (dx / d) * 28;
      e.y -= (dy / d) * 28;

      if (Player.hp <= 0) {
        Game.running = false;
        Game.best = Math.max(Game.best, Game.score);
        localStorage.setItem("dungeonBest", String(Game.best));
      }
    }
  }

  // bullet hits enemy
  for (const b of Bullets) {
    for (const e of Enemies) {
      if (e.hp <= 0) continue;
      const d = dist(b.x, b.y, e.x, e.y);
      if (d < b.r + e.r) {
        e.hp -= 1;
        b.life = 0;

        // hit particles
        for (let i = 0; i < 10; i++) {
          Particles.push({
            x: e.x,
            y: e.y,
            vx: (Math.random() - 0.5) * 260,
            vy: (Math.random() - 0.5) * 260,
            life: 0.25 + Math.random() * 0.15
          });
        }

        if (e.hp <= 0) {
          Game.score += 1;

          // wave progression: every 12 kills = next wave
          if (Game.score % 12 === 0) Game.wave += 1;

          if (Game.score > Game.best) {
            Game.best = Game.score;
            localStorage.setItem("dungeonBest", String(Game.best));
          }
        }
      }
    }
  }

  Enemies = Enemies.filter(e => e.hp > 0);

  // particles update
  for (const p of Particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  }
  Particles = Particles.filter(p => p.life > 0);

  // HUD
  statsEl.textContent = `Score: ${Game.score} • Best: ${Game.best} • HP: ${Player.hp} • Wave: ${Game.wave}`;
}

// -------------------- DRAW --------------------
function drawDungeonFloor() {
  // dark stone floor
  ctx.fillStyle = "#151515";
  ctx.fillRect(0, 0, W, H);

  // subtle vignette
  const g = ctx.createRadialGradient(W/2, H/2, 60, W/2, H/2, Math.max(W, H));
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // brick-ish lines
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  for (let y = 0; y < H; y += 34) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  for (let x = 0; x < W; x += 60) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawPlayer() {
  // body
  ctx.save();
  ctx.translate(Player.x, Player.y);
  ctx.rotate(Player.angle);

  // cloak / peasant-ish tunic
  ctx.fillStyle = "#5a3d2b";
  ctx.beginPath();
  ctx.ellipse(0, 4, 18, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  // hood
  ctx.fillStyle = "#3b2e22";
  ctx.beginPath();
  ctx.arc(0, -10, 14, 0, Math.PI * 2);
  ctx.fill();

  // face
  ctx.fillStyle = "#d7b38c";
  ctx.beginPath();
  ctx.arc(2, -8, 9, 0, Math.PI * 2);
  ctx.fill();

  // bow/aim direction marker
  ctx.strokeStyle = "#c8b48a";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(10, -2);
  ctx.lineTo(28, -2);
  ctx.stroke();

  ctx.restore();
}

function drawEnemies() {
  for (const e of Enemies) {
    // enemy body
    ctx.fillStyle = "#b71c1c";
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fill();

    // hp pips (tiny)
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#fff";
    for (let i = 0; i < Math.min(4, e.hp); i++) {
      ctx.fillRect(e.x - 10 + i * 6, e.y - e.r - 10, 4, 4);
    }
    ctx.globalAlpha = 1;
  }
}

function drawBullets() {
  ctx.fillStyle = "#f1c40f";
  for (const b of Bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles() {
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "#f5f5f5";
  for (const p of Particles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawCrosshair() {
  // simple crosshair at mouse
  ctx.globalAlpha = 0.7;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(Mouse.x - 10, Mouse.y);
  ctx.lineTo(Mouse.x + 10, Mouse.y);
  ctx.moveTo(Mouse.x, Mouse.y - 10);
  ctx.lineTo(Mouse.x, Mouse.y + 10);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawGameOver() {
  if (Game.running) return;

  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 34px system-ui";
  ctx.fillText("YOU DIED", W/2 - 95, H/2 - 10);

  ctx.font = "16px system-ui";
  ctx.fillText("Press R or click Restart", W/2 - 105, H/2 + 20);
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  drawDungeonFloor();
  drawEnemies();
  drawBullets();
  drawParticles();
  drawPlayer();
  drawCrosshair();
  drawGameOver();

  // keep HUD updated even when dead
  statsEl.textContent = `Score: ${Game.score} • Best: ${Game.best} • HP: ${Player.hp} • Wave: ${Game.wave}`;
}

// -------------------- LOOP --------------------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  update(dt);
  draw();
  requestAnimationFrame(loop);
}
reset();
requestAnimationFrame(loop);
