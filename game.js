const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;

let best = Number(localStorage.getItem("peekBest") || 0);

const state = {
  running: true,
  score: 0,

  // Peek is now a "bounce" (auto up, auto down)
  peek: 0,            // 0..1 current peek amount
  peekTarget: 0,      // where peek is trying to go
  peekId: 0,          // increments each peek event
  scoredPeekId: -1,   // last peekId we scored

  axe: { t: 0, speed: 1.6 },

  // gesture tracking
  gesture: {
    active: false,
    startX: 0,
    startY: 0,
    startT: 0,
    maxDy: 0
  },

  cooldown: 0
};

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function reset() {
  state.running = true;
  state.score = 0;
  state.peek = 0;
  state.peekTarget = 0;
  state.peekId = 0;
  state.scoredPeekId = -1;
  state.axe.t = 0;
  state.axe.speed = 1.6;
  state.cooldown = 0;
}

// Swing position + angle (more like a pendulum feel)
function swingAngle() {
  // angle in radians
  return 0.95 * Math.sin(state.axe.t); // ~54 degrees max
}

function isDangerZone(peekAmount) {
  const coverY = H * 0.66;

  // Peasant "peeks" by rising from crouch (no jump vibe)
  // Head becomes visible only when peek is high
  const crouchHeadY = coverY + 30;             // hidden behind cover
  const peekHeadY   = coverY - 90;             // visible head height
  const headY = crouchHeadY + (peekHeadY - crouchHeadY) * peekAmount;

  const headVisible = peekAmount > 0.50;

  // Axe blade hit zone: near the bottom of the swing
  const ropeTopY = coverY - 260;
  const ropeLen = 210;

  const a = swingAngle();
  // blade center approx at end of rope
  const bladeX = W / 2 + Math.sin(a) * ropeLen;
  const bladeY = ropeTopY + Math.cos(a) * ropeLen + 95; // blade sits below handle end

  // Danger zone centered around peasant position (middle)
  const dangerX = Math.abs(bladeX - W / 2) < 60;
  const dangerY = Math.abs(bladeY - headY) < 85;

  return headVisible && dangerX && dangerY;
}

// --- Snap-style peek "burst"
function triggerPeekBurst() {
  if (!state.running) return;
  if (state.cooldown > 0) return;

  state.peekId++;
  state.peekTarget = 1;
  state.cooldown = 0.35; // seconds

  setTimeout(() => {
    state.peekTarget = 0;
  }, 240);
}

function update(dt) {
  if (state.cooldown > 0) state.cooldown = Math.max(0, state.cooldown - dt);

  if (state.running) {
    state.axe.t += dt * state.axe.speed;
    state.axe.speed = 1.6 + state.score * 0.06;
  }

  // Smooth peek motion (rise + return to crouch)
  const speedUp = 11.0;
  const speedDown = 8.0;
  const s = (state.peekTarget > state.peek) ? speedUp : speedDown;
  state.peek += (state.peekTarget - state.peek) * (1 - Math.exp(-s * dt));
  state.peek = clamp(state.peek, 0, 1);

  if (state.running && isDangerZone(state.peek)) {
    state.running = false;
  }

  // Score once per peek burst if you got visibly up safely
  const visible = state.peek > 0.62;
  const safe = !isDangerZone(state.peek);

  if (state.running && visible && safe && state.scoredPeekId !== state.peekId) {
    state.score++;
    state.scoredPeekId = state.peekId;

    if (state.score > best) {
      best = state.score;
      localStorage.setItem("peekBest", String(best));
    }
  }
}

function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#0b1220");
  g.addColorStop(1, "#071018");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // header bar
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(0, 0, W, 70);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 18px system-ui";
  ctx.fillText("Peek & Dodge", 16, 42);

  ctx.font = "14px system-ui";
  ctx.fillText(`Score: ${state.score}   Best: ${best}`, W - 175, 42);

  // pull zone
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fillRect(0, 70, W, 120);
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.font = "12px system-ui";
  ctx.fillText("Pull down here to peek", 16, 105);
}

function drawCover(coverY) {
  // Stone wall / cover
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, coverY, W, H - coverY);

  // edge highlight
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(0, coverY, W, 8);

  // simple stone brick pattern
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1;
  for (let y = coverY + 18; y < H; y += 34) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  for (let x = 0; x < W; x += 54) {
    ctx.beginPath();
    ctx.moveTo(x, coverY);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawPeasant(coverY) {
  // Crouch → peek rise (feels like standing up a bit, not jumping)
  const t = state.peek;
  const x = W / 2;

  const crouchY = coverY + 40;
  const peekY = coverY - 70;
  const bodyY = crouchY + (peekY - crouchY) * t;

  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(x, coverY + 18, 70, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  // hood (peasant)
  const headR = 16;
  const headY = bodyY - 38;

  // hood outer
  ctx.fillStyle = "#3b2e22";
  ctx.beginPath();
  ctx.arc(x, headY, headR + 6, 0, Math.PI * 2);
  ctx.fill();

  // face
  ctx.fillStyle = "#d7b38c";
  ctx.beginPath();
  ctx.arc(x, headY + 3, headR, 0, Math.PI * 2);
  ctx.fill();

  // eyes
  ctx.fillStyle = "#111";
  ctx.beginPath(); ctx.arc(x - 6, headY, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 6, headY, 2.6, 0, Math.PI * 2); ctx.fill();

  // tunic/body
  const bodyW = 56;
  const bodyH = 60;
  ctx.fillStyle = "#5a3d2b";
  ctx.beginPath();
  ctx.roundRect(x - bodyW / 2, bodyY - 18, bodyW, bodyH, 10);
  ctx.fill();

  // belt
  ctx.fillStyle = "#2b1b12";
  ctx.fillRect(x - bodyW / 2, bodyY + 12, bodyW, 6);

  // arms tucked (crouching)
  ctx.strokeStyle = "#3b2e22";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - 24, bodyY + 18);
  ctx.lineTo(x - 10, bodyY + 30);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + 24, bodyY + 18);
  ctx.lineTo(x + 10, bodyY + 30);
  ctx.stroke();
}

// Medieval axe: rope + handle + shaded head
function drawAxe(coverY) {
  const ropeTopX = W / 2;
  const ropeTopY = coverY - 260;
  const ropeLen = 210;

  const a = swingAngle();

  // Rope end (handle top)
  const hx = ropeTopX + Math.sin(a) * ropeLen;
  const hy = ropeTopY + Math.cos(a) * ropeLen;

  // Rope
  ctx.strokeStyle = "#c8b48a";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(ropeTopX, ropeTopY);
  ctx.lineTo(hx, hy);
  ctx.stroke();

  // Rope twist hint
  ctx.globalAlpha = 0.25;
  ctx.strokeStyle = "#6b5b3d";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ropeTopX, ropeTopY + 10);
  ctx.lineTo(hx, hy);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Handle (wood)
  const handleLen = 150;
  const handleEndX = hx + Math.sin(a) * handleLen;
  const handleEndY = hy + Math.cos(a) * handleLen;

  ctx.strokeStyle = "#b78a53";
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(handleEndX, handleEndY);
  ctx.stroke();

  // Handle grip wrap
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = "#6b4a2a";
  ctx.lineWidth = 4;
  for (let i = 0; i < 7; i++) {
    const t = i / 7;
    const px = hx + (handleEndX - hx) * (0.55 + t * 0.35);
    const py = hy + (handleEndY - hy) * (0.55 + t * 0.35);
    ctx.beginPath();
    ctx.moveTo(px - 10, py + 4);
    ctx.lineTo(px + 10, py - 4);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Axe head (metal), positioned near lower handle
  const headCX = hx + (handleEndX - hx) * 0.78;
  const headCY = hy + (handleEndY - hy) * 0.78;

  // rotate drawing around head by angle a
  ctx.save();
  ctx.translate(headCX, headCY);
  ctx.rotate(a);

  // Metal head base
  const metal = ctx.createLinearGradient(-40, -20, 40, 20);
  metal.addColorStop(0, "#f4f6fb");
  metal.addColorStop(0.45, "#b9c1cd");
  metal.addColorStop(1, "#5a6472");
  ctx.fillStyle = metal;

  // main head shape
  ctx.beginPath();
  ctx.moveTo(-10, -18);
  ctx.lineTo(16, -10);
  ctx.lineTo(30, 0);
  ctx.lineTo(16, 10);
  ctx.lineTo(-10, 18);
  ctx.closePath();
  ctx.fill();

  // Blade
  const blade = ctx.createLinearGradient(10, -25, 55, 25);
  blade.addColorStop(0, "#ffffff");
  blade.addColorStop(0.5, "#cfd7e3");
  blade.addColorStop(1, "#7a8596");
  ctx.fillStyle = blade;

  ctx.beginPath();
  ctx.moveTo(18, -20);
  ctx.lineTo(58, -10);
  ctx.lineTo(58, 10);
  ctx.lineTo(18, 20);
  ctx.closePath();
  ctx.fill();

  // blade edge highlight
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(56, -10);
  ctx.lineTo(56, 10);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // rivet / hole detail
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.arc(6, 0, 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  const coverY = H * 0.66;

  drawBackground();

  // Subtle danger hint band (optional readability)
  const danger = isDangerZone(state.peek);
  ctx.fillStyle = danger ? "rgba(255,0,0,0.14)" : "rgba(0,255,0,0.06)";
  ctx.fillRect(0, coverY - 210, W, 210);

  drawAxe(coverY);
  drawCover(coverY);
  drawPeasant(coverY);

  if (!state.running) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 28px system-ui";
    ctx.fillText("Clipped! 💀", 145, 310);
    ctx.font = "16px system-ui";
    ctx.fillText("Pull down to try again", 140, 345);
  }
}

// Main loop
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// --- Controls ---
// iOS Safari: add touch fallback + preventDefault to ensure responsiveness.

function gestureStart(x, y) {
  state.gesture.active = true;
  state.gesture.startX = x;
  state.gesture.startY = y;
  state.gesture.startT = performance.now();
  state.gesture.maxDy = 0;
}

function gestureMove(x, y) {
  if (!state.gesture.active) return;
  const dy = y - state.gesture.startY;
  state.gesture.maxDy = Math.max(state.gesture.maxDy, dy);
}

function gestureEnd() {
  if (!state.gesture.active) return;
  state.gesture.active = false;

  const startY = state.gesture.startY;
  const elapsedMs = performance.now() - state.gesture.startT;
  const pulled = state.gesture.maxDy;

  const startedInTopZone = startY < 190;
  const pulledEnough = pulled > 65;
  const quickEnough = elapsedMs < 450;

  if (state.running && startedInTopZone && pulledEnough && quickEnough) {
    triggerPeekBurst();
  } else if (!state.running && startedInTopZone && pulledEnough) {
    // quick restart on mobile after death
    reset();
  }
}

// Pointer events
canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  gestureStart(e.clientX, e.clientY);
}, { passive: false });

canvas.addEventListener("pointermove", (e) => {
  e.preventDefault();
  gestureMove(e.clientX, e.clientY);
}, { passive: false });

canvas.addEventListener("pointerup", (e) => {
  e.preventDefault();
  gestureEnd();
}, { passive: false });

canvas.addEventListener("pointercancel", () => {
  state.gesture.active = false;
});

// Touch fallback
canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  const t = e.changedTouches[0];
  gestureStart(t.clientX, t.clientY);
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  const t = e.changedTouches[0];
  gestureMove(t.clientX, t.clientY);
}, { passive: false });

canvas.addEventListener("touchend", (e) => {
  e.preventDefault();
  gestureEnd();
}, { passive: false });

canvas.addEventListener("touchcancel", () => {
  state.gesture.active = false;
});

// Keyboard helpers (desktop)
window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "r") reset();
  if (e.code === "Space") {
    e.preventDefault();
    triggerPeekBurst();
  }
});

// Init
reset();
