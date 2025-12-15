const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;

// -------------------- GAME STATE --------------------
const Game = {
  running: true,
  score: 0,
  time: 0
};

// -------------------- INPUT --------------------
const Input = {
  x: 0,
  y: 0,
  active: false
};

canvas.addEventListener("pointerdown", e => {
  Input.active = true;
  Input.x = e.offsetX;
  Input.y = e.offsetY;
});

canvas.addEventListener("pointermove", e => {
  if (!Input.active) return;
  Input.x = e.offsetX;
  Input.y = e.offsetY;
});

canvas.addEventListener("pointerup", () => {
  Input.active = false;
});

// -------------------- PLAYER --------------------
const Player = {
  x: W / 2,
  y: H / 2,
  r: 18,
  speed: 220,
  hp: 3
};

// -------------------- ENEMIES --------------------
const Enemies = [];

function spawnEnemy() {
  const edge = Math.floor(Math.random() * 4);
  let x, y;

  if (edge === 0) { x = 0; y = Math.random() * H; }
  if (edge === 1) { x = W; y = Math.random() * H; }
  if (edge === 2) { x = Math.random() * W; y = 0; }
  if (edge === 3) { x = Math.random() * W; y = H; }

  Enemies.push({
    x, y,
    r: 16,
    speed: 60 + Math.random() * 40
  });
}

// -------------------- UPDATE --------------------
function update(dt) {
  Game.time += dt;

  // Move player toward finger
  if (Input.active) {
    const dx = Input.x - Player.x;
    const dy = Input.y - Player.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 1) {
      Player.x += (dx / dist) * Player.speed * dt;
      Player.y += (dy / dist) * Player.speed * dt;
    }
  }

  // Spawn enemies
  if (Game.time > 1) {
    spawnEnemy();
    Game.time = 0;
  }

  // Move enemies
  Enemies.forEach(e => {
    const dx = Player.x - e.x;
    const dy = Player.y - e.y;
    const d = Math.hypot(dx, dy);
    e.x += (dx / d) * e.speed * dt;
    e.y += (dy / d) * e.speed * dt;

    // Collision
    if (d < Player.r + e.r) {
      Game.running = false;
    }
  });
}

// -------------------- DRAW --------------------
function draw() {
  ctx.clearRect(0, 0, W, H);

  // Floor
  ctx.fillStyle = "#1b1b1b";
  ctx.fillRect(0, 0, W, H);

  // Player
  ctx.fillStyle = "#4caf50";
  ctx.beginPath();
  ctx.arc(Player.x, Player.y, Player.r, 0, Math.PI * 2);
  ctx.fill();

  // Enemies
  ctx.fillStyle = "#b71c1c";
  Enemies.forEach(e => {
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fill();
  });

  // Game Over
  if (!Game.running) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.font = "24px system-ui";
    ctx.fillText("You Died", 150, 350);
  }
}

// -------------------- LOOP --------------------
let last = performance.now();
function loop(now) {
  const dt = (now - last) / 1000;
  last = now;

  if (Game.running) update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
