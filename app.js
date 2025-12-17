/* Neon Alley: tiny story PWA
   - data-driven story from story.json
   - flags + inventory
   - autosave + save slots
*/

const $ = (sel) => document.querySelector(sel);

const els = {
  sceneTitle: $("#sceneTitle"),
  text: $("#text"),
  choices: $("#choices"),
  portraitWrap: $("#portraitWrap"),
  portrait: $("#portrait"),
  hudFlags: $("#hudFlags"),
  hudInv: $("#hudInv"),

  btnContinue: $("#btnContinue"),
  btnBack: $("#btnBack"),

  btnMenu: $("#btnMenu"),
  modal: $("#modal"),
  btnClose: $("#btnClose"),
  btnReset: $("#btnReset"),
  optAutosave: $("#optAutosave"),
  saveInfo: $("#saveInfo"),
};

const STORAGE_KEY = "neonAlley_autosave_v1";
const OPT_KEY = "neonAlley_options_v1";
const SLOT_KEY = (n) => `neonAlley_slot${n}_v1`;

let storyData = null;

let state = {
  sceneId: null,
  history: [],        // stack of previous sceneIds
  flags: {},          // key -> true
  inventory: [],      // array of strings
};

let options = {
  autosave: true,
};

function nowStamp(){
  const d = new Date();
  return d.toLocaleString();
}

function clampState(){
  // remove duplicates in inventory
  state.inventory = Array.from(new Set(state.inventory));
}

function saveAutosave(){
  if (!options.autosave) return;
  clampState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    state,
    savedAt: nowStamp(),
    version: 1
  }));
  updateSaveInfo();
}

function loadAutosave(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  try{
    const parsed = JSON.parse(raw);
    if (!parsed?.state?.sceneId) return false;
    state = parsed.state;
    return true;
  }catch{
    return false;
  }
}

function saveSlot(n){
  clampState();
  localStorage.setItem(SLOT_KEY(n), JSON.stringify({
    state,
    savedAt: nowStamp(),
    version: 1
  }));
  updateSaveInfo();
}

function loadSlot(n){
  const raw = localStorage.getItem(SLOT_KEY(n));
  if (!raw) return false;
  try{
    const parsed = JSON.parse(raw);
    if (!parsed?.state?.sceneId) return false;
    state = parsed.state;
    return true;
  }catch{
    return false;
  }
}

function resetGame(){
  state = {
    sceneId: storyData.start,
    history: [],
    flags: {},
    inventory: []
  };
  saveAutosave();
  render();
}

function loadOptions(){
  const raw = localStorage.getItem(OPT_KEY);
  if (!raw) return;
  try{
    const parsed = JSON.parse(raw);
    options = { ...options, ...parsed };
  }catch{}
}

function saveOptions(){
  localStorage.setItem(OPT_KEY, JSON.stringify(options));
}

function sceneById(id){
  return storyData?.scenes?.[id] ?? null;
}

function applySceneEffects(choice){
  // resets run if requested
  if (choice.resetRun){
    state.flags = {};
    state.inventory = [];
    state.history = [];
  }
  if (choice.setFlag){
    state.flags[choice.setFlag] = true;
  }
  if (choice.addItem){
    state.inventory.push(choice.addItem);
  }
}

function canShowChoice(choice){
  // Optional conditions:
  // choice.requiresFlag: "flagName"
  // choice.requiresItem: "Item Name"
  if (choice.requiresFlag && !state.flags[choice.requiresFlag]) return false;
  if (choice.requiresItem && !state.inventory.includes(choice.requiresItem)) return false;
  return true;
}

function goTo(sceneId, recordHistory=true){
  if (recordHistory && state.sceneId){
    state.history.push(state.sceneId);
  }
  state.sceneId = sceneId;
  saveAutosave();
  render();
}

function goBack(){
  const prev = state.history.pop();
  if (!prev) return;
  state.sceneId = prev;
  saveAutosave();
  render();
}

function setPortrait(src){
  if (!src){
    els.portraitWrap.hidden = true;
    els.portrait.src = "";
    els.portrait.alt = "";
    return;
  }
  els.portraitWrap.hidden = false;
  els.portrait.src = src;
  els.portrait.alt = "Character portrait";
}

function renderHUD(){
  const flagList = Object.keys(state.flags).filter(k => state.flags[k]);
  els.hudFlags.textContent = flagList.length ? `Flags: ${flagList.join(", ")}` : "Flags: —";
  els.hudInv.textContent = state.inventory.length ? `Inventory: ${state.inventory.join(", ")}` : "Inventory: —";
}

function render(){
  const scene = sceneById(state.sceneId);
  if (!scene){
    els.sceneTitle.textContent = "Error";
    els.text.textContent = "Scene not found.";
    els.choices.innerHTML = "";
    return;
  }

  els.sceneTitle.textContent = scene.title ?? "";
  setPortrait(scene.portrait ?? "");

  els.text.textContent = (scene.lines ?? []).join("\n");

  els.choices.innerHTML = "";
  const choices = (scene.choices ?? []).filter(canShowChoice);

  // If there are choices, hide continue button (choices drive progress)
  const hasChoices = choices.length > 0;

  for (const c of choices){
    const b = document.createElement("button");
    b.className = "btn";
    b.textContent = c.text;
    b.addEventListener("click", () => {
      applySceneEffects(c);
      goTo(c.to, true);
    });
    els.choices.appendChild(b);
  }

  // Continue button jumps to first choice if present, otherwise does nothing
  els.btnContinue.disabled = hasChoices ? false : true;

  // Back button enabled only if history exists
  els.btnBack.disabled = state.history.length === 0;

  renderHUD();
  updateSaveInfo();
}

function updateSaveInfo(){
  const a = localStorage.getItem(STORAGE_KEY);
  let msg = "";
  if (a){
    try{
      const parsed = JSON.parse(a);
      msg += `Autosave: ${parsed.savedAt || "unknown"}\n`;
    }catch{}
  } else {
    msg += "Autosave: none\n";
  }

  for (let i=1;i<=3;i++){
    const raw = localStorage.getItem(SLOT_KEY(i));
    if (!raw){
      msg += `Slot ${i}: empty\n`;
      continue;
    }
    try{
      const parsed = JSON.parse(raw);
      msg += `Slot ${i}: ${parsed.savedAt || "unknown"}\n`;
    }catch{
      msg += `Slot ${i}: unreadable\n`;
    }
  }
  els.saveInfo.textContent = msg.trim();
}

function openMenu(){
  els.modal.hidden = false;
}
function closeMenu(){
  els.modal.hidden = true;
}

function wireUI(){
  els.btnMenu.addEventListener("click", openMenu);
  els.btnClose.addEventListener("click", closeMenu);

  els.modal.addEventListener("click", (e) => {
    if (e.target === els.modal) closeMenu();
  });

  els.btnBack.addEventListener("click", goBack);

  els.btnContinue.addEventListener("click", () => {
    const scene = sceneById(state.sceneId);
    const choices = (scene?.choices ?? []).filter(canShowChoice);
    if (choices.length){
      const c = choices[0];
      applySceneEffects(c);
      goTo(c.to, true);
    }
  });

  // Save/load buttons inside modal
  els.modal.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const saveN = btn.getAttribute("data-save");
    const loadN = btn.getAttribute("data-load");

    if (saveN){
      saveSlot(Number(saveN));
    }
    if (loadN){
      const ok = loadSlot(Number(loadN));
      if (ok) render();
    }
  });

  els.optAutosave.addEventListener("change", () => {
    options.autosave = !!els.optAutosave.checked;
    saveOptions();
    saveAutosave();
    updateSaveInfo();
  });

  els.btnReset.addEventListener("click", () => {
    const ok = confirm("Reset game? This clears current run (not save slots).");
    if (!ok) return;
    resetGame();
    closeMenu();
  });

  // Escape closes menu
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.modal.hidden) closeMenu();
  });
}

async function init(){
  // Register service worker for offline PWA
  if ("serviceWorker" in navigator){
    try{
      await navigator.serviceWorker.register("./sw.js");
    }catch{}
  }

  loadOptions();
  els.optAutosave.checked = !!options.autosave;

  const res = await fetch("./story.json", { cache: "no-store" });
  storyData = await res.json();

  // try autosave, else start fresh
  const loaded = loadAutosave();
  if (!loaded){
    state.sceneId = storyData.start;
  } else {
    // if story changed and scene missing, restart
    if (!sceneById(state.sceneId)){
      state.sceneId = storyData.start;
      state.history = [];
    }
  }

  wireUI();
  render();
}

init();