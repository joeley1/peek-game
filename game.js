const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height;

let best = Number(localStorage.getItem("buzzerBest") || 0);

const state = {
  running: true,
  score: 0,

  // Jump animation (0..1). Each jump is a single burst.
  jump: 0,
  jumping: false,
  jumpId: 0,
  scoredJumpId: -1,

  // Axe swing
  axe: { t: 0, baseSpeed: 1.6, speed: 1.6 },

  // gesture tracking
  gesture: { active: false, startY: 0, startT: 0, maxDy: 0 },

  cooldown: 0
};

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function easeOutQuad(x){ return 1 - (1 - x) * (1 - x); }

function reset(){
  state.running = true;
  state.score = 0;

  state.jump = 0;
  state.jumping = false;
  state.jumpId = 0;
  state.scoredJumpId = -1;

  state.axe.t = 0;
  state.axe.baseSpeed = 1.6;
  state.axe.speed = 1.6;

  state.cooldown = 0;
}

function updateAxeSpeed(){
  // Every 5 points => +5% speed (multiplicative)
  const steps = Math.floor(state.score / 5);
  state.axe.speed = state.axe.baseSpeed * Math.pow(1.05, steps);
}

function swingAngle(){
  return 0.95 * Math.sin(state.axe.t);
}

// --- World layout ---
function coverY(){ return H * 0.72; }        // ground/cover line
function peasantX(){ return W / 2; }
function peasantStandHeadY(){
  // standing head position
  return coverY() - 85;
}

function buzzerY(){
  // buzzer is above peasant head
  return peasantStandHeadY() - 110;
}

function understandingLineY(){
  // little visual band where the axe passes
  return coverY() - 240;
}

// Jump curve: jumpAmount 0..1 => height amount 0..1
function jumpHeightAmount(j){
  // fast up, slow down
  return easeOutQuad(j);
}

function peasantHeadY(){
  const base = peasantStandHeadY();
  const maxUp = 150; // how high the peasant can jump
  return base - jumpHeightAmount(state.jump) * maxUp;
}

// Axe blade world position (above peasant head)
function axeBladePos(){
  const topY = understandingLineY();
  const ropeLen = 180;
  const a = swingAngle();

  const ropeTopX = W / 2;
  const ropeTopY = topY;

  // handle top = rope end
  const hx = ropeTopX + Math.sin(a) * ropeLen;
  const hy = ropeTopY + Math.cos(a) * ropeLen;

  // blade approx lower than rope end
  return { x: hx, y: hy + 110, a };
}

// Collision: if head is up and axe is near center of peasant
function isClipped(){
  const headY = peasantHeadY();
  const headVisible = state.jumping && state.jump > 0.25;

  if (!headVisible) return false;

  const blade = axeBladePos();

  const dx = Math.abs(blade.x - peasantX());
  const dy = Math.abs(blade.y - headY);

  // tune difficulty:
  return dx < 55 && dy < 70;
}

function hitBuzzer(){
  // "gold point buzzer" hit: head gets close enough to buzzer Y
  const headY = peasantHeadY();
  return headY <= buzzerY() + 10;
}

// --- Trigger jump ---
function triggerJump(){
  if (!state.running) { reset(); return; }
  if (state.cooldown > 0) return;
  if (state.jumping) return; // one jump at a time

  state.jumping = true;
  state.jump = 0;
  state.jumpId++;
  state.cooldown = 0.22;
}

function update(dt){
  if (state.cooldown > 0) state.cooldown = Math.max(0, state.cooldown - dt);

  if (state.running){
    state.axe.t += dt * state.axe.speed;
  }

  // Jump progresses automatically
  if (state.jumping){
    // duration of the jump (seconds)
    const jumpDuration = 0.42;
    state.jump += dt / jumpDuration;

    if (state.jump >= 1){
      state.jump = 1;
    }

    // Lose check while in air
    if (state.running && isClipped()){
      state.running = false;
    }

    // Score rule: once per jump, if you reach the buzzer safely
    const reached = hitBuzzer();
    const safe = !isClipped();

    if (state.running && reached && safe && state.scoredJumpId !== state.jumpId){
      state.score++;
      state.scoredJumpId = state.jumpId;

      if (state.score > best){
        best = state.score;
        localStorage.setItem("buzzerBest", String(best));
      }

      updateAxeSpeed();
    }

    // End jump: once it hits the top and falls back (we fake by just ending after 1)
    if (state.jump >= 1){
      state.jumping = false;
      state.jump = 0;
    }
  }
}

// --- Drawing (medieval-ish) ---
function drawBackground(){
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#0b1220");
  g.addColorStop(1, "#071018");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(0, 0, W, 70);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 18px system-ui";
  ctx.fillText("Jump & Buzzer", 16, 42);

  ctx.font = "14px system-ui";
  ctx.fillText(`Score: ${state.score}   Best: ${best}`, W - 175, 42);

  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fillRect(0, 70, W, 105);
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.font = "12px system-ui";
  ctx.fillText("Tap or pull down to jump (timing game)", 16, 105);
}

function drawGround(){
  const y = coverY();
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, y, W, H - y);
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(0, y, W, 8);
}

function drawBuzzer(){
  const x = peasantX();
  const y = buzzerY();

  // glow
  const r = 14;
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = "#f1c40f";
  ctx.beginPath();
  ctx.arc(x, y, r + 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // gold button
  const gold = ctx.createLinearGradient(x - 20, y - 20, x + 20, y + 20);
  gold.addColorStop(0, "#fff4a8");
  gold.addColorStop(0.45, "#f1c40f");
  gold.addColorStop(1, "#a87800");
  ctx.fillStyle = gold;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  // shine
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x - 5, y - 6, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawAxe(){
  const topY = understandingLineY();
  const ropeLen = 180;
  const a = swingAngle();

  const ropeTopX = W / 2;
  const ropeTopY = topY;

  const hx = ropeTopX + Math.sin(a) * ropeLen;
  const hy = ropeTopY + Math.cos(a) * ropeLen;

  // rope
  ctx.strokeStyle = "#c8b48a";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(ropeTopX, ropeTopY);
  ctx.lineTo(hx, hy);
  ctx.stroke();

  // handle
  const handleLen = 150;
  const ex = hx + Math.sin(a) * handleLen;
  const ey = hy + Math.cos(a) * handleLen;

  ctx.strokeStyle = "#b78a53";
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(ex, ey);
  ctx.stroke();

  // axe head
  const headCX = hx + (ex - hx) * 0.78;
  const headCY = hy + (ey - hy) * 0.78;

  ctx.save();
  ctx.translate(headCX, headCY);
  ctx.rotate(a);

  const metal = ctx.createLinearGradient(-40, -20, 40, 20);
  metal.addColorStop(0, "#f4f6fb");
  metal.addColorStop(0.45, "#b9c1cd");
  metal.addColorStop(1, "#5a6472");
  ctx.fillStyle = metal;

  ctx.beginPath();
  ctx.moveTo(-10, -18);
  ctx.lineTo(16, -10);
  ctx.lineTo(30, 0);
  ctx.lineTo(16, 10);
  ctx.lineTo(-10, 18);
  ctx.closePath();
  ctx.fill();

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

  ctx.restore();
}

function drawPeasant(){
  const x = peasantX();
  const headY = peasantHeadY();

  // body anchor (standing)
  const bodyY = headY + 55;

  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(x, coverY() + 16, 75, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  // hood
  ctx.fillStyle = "#3b2e22";
  ctx.beginPath();
  ctx.arc(x, headY, 22, 0, Math.PI * 2);
  ctx.fill();

  // face
  ctx.fillStyle = "#d7b38c";
  ctx.beginPath();
  ctx.arc(x, headY + 4, 16, 0, Math.PI * 2);
  ctx.fill();

  // eyes
  ctx.fillStyle = "#111";
  ctx.beginPath(); ctx.arc(x - 6, headY + 2, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 6, headY + 2, 2.6, 0, Math.PI * 2); ctx.fill();

  // tunic
  ctx.fillStyle = "#5a3d2b";
  ctx.beginPath();
  ctx.roundRect(x - 30, bodyY - 10, 60, 78, 12);
  ctx.fill();

  // belt
  ctx.fillStyle = "#2b1b12";
  ctx.fillRect(x - 30, bodyY + 20, 60, 6);

  // legs (standing)
  ctx.strokeStyle = "#3b2e22";
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(x - 12, bodyY + 68); ctx.lineTo(x - 12, coverY() + 10); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 12, bodyY + 68); ctx.lineTo(x + 12, coverY() + 10); ctx.stroke();
}

function draw(){
  ctx.clearRect(0, 0, W, H);

  drawBackground();
  drawBuzzer();
  drawAxe();
  drawGround();
  drawPeasant();

  // subtle danger band for readability
  ctx.fillStyle = isClipped() ? "rgba(255,0,0,0.12)" : "rgba(0,255,0,0.05)";
  ctx.fillRect(0, understandingLineY() + 40, W, 220);

  if (!state.running){
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 28px system-ui";
    ctx.fillText("Clipped! 💀", 145, 310);
    ctx.font = "16px system-ui";
    ctx.fillText("Tap or pull down to restart", 120, 345);
  }
}

// Main loop
let last = performance.now();
function loop(now){
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// --- Controls (mobile-safe) ---
function gestureStart(y){
  state.gesture.active = true;
  state.gesture.startY = y;
  state.gesture.startT = performance.now();
  state.gesture.maxDy = 0;
}
function gestureMove(y){
  if (!state.gesture.active) return;
  const dy = y - state.gesture.startY;
  state.gesture.maxDy = Math.max(state.gesture.maxDy, dy);
}
function gestureEnd(){
  if (!state.gesture.active) return;
  state.gesture.active = false;

  const elapsedMs = performance.now() - state.gesture.startT;
  const pulled = state.gesture.maxDy;

  const pulledEnough = pulled > 55;
  const quickEnough = elapsedMs < 450;

  if (pulledEnough && quickEnough) triggerJump();
}

// Pointer events
canvas.addEventListener("pointerdown", (e) => { e.preventDefault(); gestureStart(e.clientY); }, { passive:false });
canvas.addEventListener("pointermove", (e) => { e.preventDefault(); gestureMove(e.clientY); }, { passive:false });
canvas.addEventListener("pointerup",   (e) => { e.preventDefault(); gestureEnd(); }, { passive:false });

// Touch fallback
canvas.addEventListener("touchstart", (e) => { e.preventDefault(); gestureStart(e.changedTouches[0].clientY); }, { passive:false });
canvas.addEventListener("touchmove",  (e) => { e.preventDefault(); gestureMove(e.changedTouches[0].clientY); }, { passive:false });
canvas.addEventListener("touchend",   (e) => { e.preventDefault(); gestureEnd(); }, { passive:false });

// Simple TAP to jump (nice usability on phone)
canvas.addEventListener("click", (e) => {
  // click fires on desktop + mobile after touchend; safe to allow
  triggerJump();
});

// Desktop keys
window.addEventListener("keydown", (e) => {
  if (e.key.toLowerCase() === "r") reset();
  if (e.code === "Space") { e.preventDefault(); triggerJump(); }
});

// Init
reset();
updateAxeSpeed();
