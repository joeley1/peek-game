const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const statsEl = document.getElementById("stats");
const restartBtn = document.getElementById("restart");

const W = canvas.width;
const H = canvas.height;

// ---------- UTIL ----------
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const dist = (ax,ay,bx,by)=>Math.hypot(ax-bx,ay-by);

// ---------- INPUT ----------
const Keys = new Set();
const Mouse = { x: W/2, y: H/2 };

window.addEventListener("keydown", e=>{
  Keys.add(e.key.toLowerCase());
  if(e.key.toLowerCase()==="r") reset();
});
window.addEventListener("keyup", e=>Keys.delete(e.key.toLowerCase()));

canvas.addEventListener("mousemove", e=>{
  const r = canvas.getBoundingClientRect();
  Mouse.x = (e.clientX - r.left) * (W / r.width);
  Mouse.y = (e.clientY - r.top) * (H / r.height);
});

canvas.addEventListener("mousedown", e=>{
  if(e.button===0) shoot();
});

restartBtn.onclick = reset;

// ---------- GAME ----------
const Game = {
  running:true,
  score:0
};

// ---------- PLAYER ----------
const Player = {
  x:W/2, y:H/2,
  r:16,
  speed:260,
  hp:3,
  angle:0
};

// ---------- ENTITIES ----------
let Enemies = [];
let Arrows = [];

function spawnEnemy(){
  const edge = Math.floor(Math.random()*4);
  let x,y;
  if(edge===0){ x=-20; y=Math.random()*H; }
  if(edge===1){ x=W+20; y=Math.random()*H; }
  if(edge===2){ x=Math.random()*W; y=-20; }
  if(edge===3){ x=Math.random()*W; y=H+20; }

  Enemies.push({
    x,y,
    r:15,
    speed:80+Math.random()*40
  });
}

// ---------- SHOOT ----------
function shoot(){
  if(!Game.running) return;

  const a = Player.angle;
  Arrows.push({
    x:Player.x + Math.cos(a)*18,
    y:Player.y + Math.sin(a)*18,
    vx:Math.cos(a)*520,
    vy:Math.sin(a)*520,
    life:1.2
  });
}

// ---------- RESET ----------
function reset(){
  Game.running=true;
  Game.score=0;
  Player.hp=3;
  Player.x=W/2;
  Player.y=H/2;
  Enemies=[];
  Arrows=[];
}

// ---------- UPDATE ----------
let spawnTimer=0;

function update(dt){
  Player.angle = Math.atan2(Mouse.y-Player.y, Mouse.x-Player.x);

  if(!Game.running) return;

  // movement
  let mx=0,my=0;
  if(Keys.has("w")||Keys.has("arrowup")) my--;
  if(Keys.has("s")||Keys.has("arrowdown")) my++;
  if(Keys.has("a")||Keys.has("arrowleft")) mx--;
  if(Keys.has("d")||Keys.has("arrowright")) mx++;

  if(mx||my){
    const l=Math.hypot(mx,my);
    Player.x+=mx/l*Player.speed*dt;
    Player.y+=my/l*Player.speed*dt;
  }

  Player.x=clamp(Player.x,Player.r,W-Player.r);
  Player.y=clamp(Player.y,Player.r,H-Player.r);

  // enemies
  spawnTimer+=dt;
  if(spawnTimer>1){
    spawnEnemy();
    spawnTimer=0;
  }

  Enemies.forEach(e=>{
    const dx=Player.x-e.x, dy=Player.y-e.y;
    const d=Math.hypot(dx,dy)||1;
    e.x+=dx/d*e.speed*dt;
    e.y+=dy/d*e.speed*dt;

    if(d<Player.r+e.r){
      Player.hp--;
      Game.running = Player.hp>0;
    }
  });

  // arrows
  Arrows.forEach(a=>{
    a.x+=a.vx*dt;
    a.y+=a.vy*dt;
    a.life-=dt;
  });
  Arrows=Arrows.filter(a=>a.life>0);

  // arrow hits
  for(const a of Arrows){
    for(const e of Enemies){
      if(dist(a.x,a.y,e.x,e.y)<e.r){
        e.dead=true;
        a.life=0;
        Game.score++;
      }
    }
  }
  Enemies=Enemies.filter(e=>!e.dead);

  statsEl.textContent = `Score: ${Game.score} • HP: ${Player.hp}`;
}

// ---------- DRAW ----------
function draw(){
  ctx.clearRect(0,0,W,H);

  // floor
  ctx.fillStyle="#151515";
  ctx.fillRect(0,0,W,H);

  // player
  ctx.save();
  ctx.translate(Player.x,Player.y);
  ctx.rotate(Player.angle);
  ctx.fillStyle="#5a3d2b";
  ctx.beginPath();
  ctx.arc(0,0,Player.r,0,Math.PI*2);
  ctx.fill();
  ctx.strokeStyle="#c8b48a";
  ctx.lineWidth=4;
  ctx.beginPath();
  ctx.moveTo(8,0);
  ctx.lineTo(24,0);
  ctx.stroke();
  ctx.restore();

  // arrows
  ctx.strokeStyle="#f1c40f";
  ctx.lineWidth=2;
  Arrows.forEach(a=>{
    ctx.beginPath();
    ctx.moveTo(a.x,a.y);
    ctx.lineTo(a.x-a.vx*0.03,a.y-a.vy*0.03);
    ctx.stroke();
  });

  // enemies
  ctx.fillStyle="#b71c1c";
  Enemies.forEach(e=>{
    ctx.beginPath();
    ctx.arc(e.x,e.y,e.r,0,Math.PI*2);
    ctx.fill();
  });

  // game over
  if(!Game.running){
    ctx.fillStyle="rgba(0,0,0,.6)";
    ctx.fillRect(0,0,W,H);
    ctx.fillStyle="#fff";
    ctx.font="32px system-ui";
    ctx.fillText("YOU DIED",W/2-90,H/2);
  }
}

// ---------- LOOP ----------
let last=performance.now();
function loop(now){
  const dt=(now-last)/1000;
  last=now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}
reset();
requestAnimationFrame(loop);
