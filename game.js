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



  // prevents spam-peeking

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



function axeX() {

  const minX = 90, maxX = W - 90;

  const mid = (minX + maxX) / 2;

  const amp = (maxX - minX) / 2;

  return mid + amp * Math.sin(state.axe.t);

}



function isDangerZone(peekAmount) {

  const coverY = H * 0.62;

  const headY = coverY - (peekAmount * 140);



  const hitY = coverY - 95;



  const headVisible = peekAmount > 0.35;



  const ax = axeX();

  const dangerX = Math.abs(ax - W / 2) < 55;



  const dangerY = Math.abs(headY - hitY) < 70;



  return headVisible && dangerX && dangerY;

}



// --- Snap-style peek "burst"

function triggerPeekBurst() {

  if (!state.running) return;

  if (state.cooldown > 0) return;



  state.peekId++;

  state.peekTarget = 1;

  state.cooldown = 0.35; // seconds



  // Auto-duck after a short moment (peek bounce)

  setTimeout(() => {

    // If game ended during peek, still allow it to fall back

    state.peekTarget = 0;

  }, 240);

}



function update(dt) {

  if (state.cooldown > 0) state.cooldown = Math.max(0, state.cooldown - dt);



  if (state.running) {

    state.axe.t += dt * state.axe.speed;

    state.axe.speed = 1.6 + state.score * 0.06;

  }



  // Smoothly move peek toward target (nice bounce feel)

  const speedUp = 10.5;

  const speedDown = 7.5;

  const s = (state.peekTarget > state.peek) ? speedUp : speedDown;

  state.peek += (state.peekTarget - state.peek) * (1 - Math.exp(-s * dt));

  state.peek = clamp(state.peek, 0, 1);



  // Lose condition: if your peek intersects danger

  if (state.running && isDangerZone(state.peek)) {

    state.running = false;

  }



  // Scoring: 1 point per peek burst IF you reached a "visible peek" safely

  // We score once per peekId when peek crosses a threshold and not in danger.

  const visible = state.peek > 0.55;

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



function draw() {

  ctx.clearRect(0, 0, W, H);



  // background gradient

  const g = ctx.createLinearGradient(0, 0, 0, H);

  g.addColorStop(0, "#0b1220");

  g.addColorStop(1, "#071018");

  ctx.fillStyle = g;

  ctx.fillRect(0, 0, W, H);



  // header bar (like an app header)

  ctx.fillStyle = "rgba(255,255,255,0.06)";

  ctx.fillRect(0, 0, W, 70);

  ctx.fillStyle = "#fff";

  ctx.font = "bold 18px system-ui";

  ctx.fillText("Peek & Dodge", 16, 42);



  // score

  ctx.font = "14px system-ui";

  ctx.fillText(`Score: ${state.score}   Best: ${best}`, W - 175, 42);



  const coverY = H * 0.62;



  // A subtle "pull zone" at the top (where you do the pull gesture)

  ctx.fillStyle = "rgba(255,255,255,0.05)";

  ctx.fillRect(0, 70, W, 120);

  ctx.fillStyle = "rgba(255,255,255,0.14)";

  ctx.font = "12px system-ui";

  ctx.fillText("Pull down here to peek", 16, 105);



  // cover/platform

  ctx.fillStyle = "#0a0a0a";

  ctx.fillRect(0, coverY, W, H - coverY);



  // top edge highlight

  ctx.fillStyle = "rgba(255,255,255,0.08)";

  ctx.fillRect(0, coverY, W, 8);



  // player head (rises with peek)

  const headX = W / 2;

  const headY = coverY - (state.peek * 140);

  const r = 18;



  // shadow behind cover

  ctx.fillStyle = "rgba(0,0,0,0.25)";

  ctx.beginPath();

  ctx.ellipse(headX, coverY + 18, 60, 18, 0, 0, Math.PI * 2);

  ctx.fill();



  // head

  ctx.fillStyle = "#f1c40f";

  ctx.beginPath();

  ctx.arc(headX, headY, r, 0, Math.PI * 2);

  ctx.fill();

  // eyes

  ctx.fillStyle = "#111";

  ctx.beginPath(); ctx.arc(headX - 6, headY - 4, 3, 0, Math.PI * 2); ctx.fill();

  ctx.beginPath(); ctx.arc(headX + 6, headY - 4, 3, 0, Math.PI * 2); ctx.fill();



  // axe swinger

  const ax = axeX();

  const pivotY = coverY - 220;

  const handleLen = 190;



  // handle

  ctx.strokeStyle = "#c7a76b";

  ctx.lineWidth = 10;

  ctx.lineCap = "round";

  ctx.beginPath();

  ctx.moveTo(ax, pivotY);

  ctx.lineTo(W / 2, pivotY + handleLen);

  ctx.stroke();



  // blade

  const bx = W / 2, by = pivotY + handleLen;

  ctx.fillStyle = "#d9dde6";

  ctx.beginPath();

  ctx.moveTo(bx, by);

  ctx.lineTo(bx + 55, by - 18);

  ctx.lineTo(bx + 55, by + 18);

  ctx.closePath();

  ctx.fill();



  // danger hint zone (subtle)

  const danger = isDangerZone(state.peek);

  ctx.fillStyle = danger ? "rgba(255,0,0,0.18)" : "rgba(0,255,0,0.08)";

  ctx.fillRect(0, coverY - 160, W, 160);



  // overlays

  if (!state.running) {

    ctx.fillStyle = "rgba(0,0,0,0.55)";

    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "#fff";

    ctx.font = "bold 28px system-ui";

    ctx.fillText("Clipped! 💀", 145, 310);

    ctx.font = "16px system-ui";

    ctx.fillText("Press R to restart", 145, 345);

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

// Gesture: start pull in top area, pull down quickly enough -> peek burst

canvas.addEventListener("pointerdown", (e) => {

  state.gesture.active = true;

  state.gesture.startX = e.clientX;

  state.gesture.startY = e.clientY;

  state.gesture.startT = performance.now();

  state.gesture.maxDy = 0;

});



canvas.addEventListener("pointermove", (e) => {

  if (!state.gesture.active) return;

  const dy = e.clientY - state.gesture.startY;

  state.gesture.maxDy = Math.max(state.gesture.maxDy, dy);

});



canvas.addEventListener("pointerup", (e) => {

  if (!state.gesture.active) return;

  state.gesture.active = false;



  // Conditions to count as a "snap-style pull":

  // - started near the top (like pulling down a feed)

  // - pulled down enough distance

  // - done fairly quickly

  const startY = state.gesture.startY;

  const elapsedMs = performance.now() - state.gesture.startT;

  const pulled = state.gesture.maxDy;



  const startedInTopZone = startY < 190;  // tweak if you want

  const pulledEnough = pulled > 65;       // distance threshold

  const quickEnough = elapsedMs < 450;    // time threshold



  if (state.running && startedInTopZone && pulledEnough && quickEnough) {

    triggerPeekBurst();

  }

});



canvas.addEventListener("pointercancel", () => {

  state.gesture.active = false;

});



window.addEventListener("keydown", (e) => {

  if (e.key.toLowerCase() === "r") reset();



  // Optional: spacebar also triggers a peek burst (nice for desktop)

  if (e.code === "Space") {

    e.preventDefault();

    triggerPeekBurst();

  }

});



// Init

reset();
