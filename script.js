const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const MAX_DOGS = 12;
const MAX_OFFLINE_SECONDS = 604800; // 7 days
const RETIRE_REFUND_RATE = 0.50; // Up to 50% of retired dog's dug bones
const LEVEL_BONUS_PER_LEVEL = 0.005; // +0.5% per level above Lv.1
const DIG_MULT_BASE = 1.0; // Base dig multiplier before dug-bone scaling
const DIG_MULT_SQRT_SCALE = 0.25; // Gentle sqrt curve from dug bones

const BREED_LABELS = {
  aussie: 'Aussie',
  beagle: 'Beagle',
  collie: 'Collie',
  husky: 'Husky',
  golden: 'Golden',
  shepherd: 'Shepherd',
  shiba: 'Shiba',
  labrador: 'Labrador'
};

const DEFAULT_PUP_NAMES = [
  'Biscuit', 'Scout', 'Max', 'Rover', 'Waffles', 'Buddy',
  'Maple', 'Ziggy', 'Otis', 'Penny', 'Bramble', 'Toby',
  'Sunny', 'Nora', 'Rosie', 'Finn'
];

let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playSound(freq = 440, type = 'sine', duration = 0.15, gainVal = 0.05) {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    
    gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    // Ignore restrictions
  }
}

const sfx = {
  collect: () => playSound(659.25, 'sine', 0.12, 0.04),
  magicCollect: () => {
    playSound(880, 'sine', 0.1, 0.04);
    setTimeout(() => playSound(1318.51, 'sine', 0.2, 0.04), 80);
  },
  upgrade: () => {
    playSound(523.25, 'sine', 0.1, 0.04);
    setTimeout(() => playSound(783.99, 'sine', 0.2, 0.04), 100);
  },
  shiny: () => {
    playSound(1046.50, 'sine', 0.15, 0.06);
    setTimeout(() => playSound(1318.51, 'sine', 0.3, 0.06), 120);
  },
  gather: () => {
    playSound(587.33, 'sine', 0.2, 0.05);
    setTimeout(() => playSound(880, 'sine', 0.3, 0.05), 100);
  },
  treat: () => {
    playSound(783.99, 'sine', 0.15, 0.06);
    setTimeout(() => playSound(1046.50, 'sine', 0.25, 0.06), 100);
  },
  squeak: () => {
    playSound(1200, 'triangle', 0.08, 0.04);
    setTimeout(() => playSound(950, 'triangle', 0.08, 0.04), 60);
  },
  quack: () => {
    playSound(450, 'sawtooth', 0.1, 0.04);
    setTimeout(() => playSound(380, 'sawtooth', 0.12, 0.04), 70);
  },
  thud: () => {
    playSound(220, 'square', 0.1, 0.04);
    setTimeout(() => playSound(150, 'square', 0.15, 0.04), 50);
  }
};

/**
 * Ranked by earnings contribution & utility over time (Dalmatian replaced by Labrador):
 * - payoutMult: standard bone dig payout multiplier
 * - scalingMult: multiplier on this dog's sqrt(bonesEarned) contribution
 * - xpMult: XP earned per dig toward leveling up
 * - magicBonus: extra magic bone probability on digs
 * - walkMult: visual walk speed multiplier
 * - digSec: base dig duration in seconds
 * - treasureChance: per-dig chance to trigger a treasure draft
 */
const BREED_CONFIG = {
  aussie:   { rank: 1, cost: 15,     costMult: 1.42, walkMult: 1.20, digSec: 1.10, payoutMult: 1.00, scalingMult: 1.00, xpMult: 1.00, magicBonus: 0.000, treasureChance: 0.00008 },
  beagle:   { rank: 2, cost: 180,    costMult: 1.46, walkMult: 1.05, digSec: 1.05, payoutMult: 1.60, scalingMult: 1.15, xpMult: 1.05, magicBonus: 0.000, treasureChance: 0.00008 },
  collie:   { rank: 3, cost: 550,    costMult: 1.50, walkMult: 1.30, digSec: 0.70, payoutMult: 1.10, scalingMult: 1.10, xpMult: 1.10, magicBonus: 0.000, treasureChance: 0.00008 },
  husky:    { rank: 4, cost: 1600,   costMult: 1.54, walkMult: 1.35, digSec: 0.95, payoutMult: 1.20, scalingMult: 1.15, xpMult: 1.15, magicBonus: 0.000, treasureChance: 0.00008 },
  golden:   { rank: 5, cost: 4800,   costMult: 1.58, walkMult: 1.10, digSec: 1.00, payoutMult: 2.00, scalingMult: 1.20, xpMult: 1.05, magicBonus: 0.005, treasureChance: 0.00008 },
  shepherd: { rank: 6, cost: 14000,  costMult: 1.62, walkMult: 1.20, digSec: 0.95, payoutMult: 1.35, scalingMult: 1.25, xpMult: 1.10, magicBonus: 0.005, treasureChance: 0.00008 },
  shiba:    { rank: 7, cost: 42000,  costMult: 1.66, walkMult: 1.15, digSec: 1.00, payoutMult: 1.25, scalingMult: 1.20, xpMult: 1.10, magicBonus: 0.015, treasureChance: 0.00064 },
  labrador: { rank: 8, cost: 110000, costMult: 1.70, walkMult: 1.25, digSec: 0.85, payoutMult: 2.20, scalingMult: 1.35, xpMult: 1.20, magicBonus: 0.010, treasureChance: 0.00012 }
};

const PERK_POOL = [
  { id: 'bp_1', name: 'Muddy Map', rarity: 'Common', desc: 'Slightly boosts bone payouts per dig (1.10x)', mult: 1.10 },
  { id: 'bp_2', name: 'Lost Compass', rarity: 'Common', desc: 'Boosts bone payouts per dig (1.15x)', mult: 1.15 },
  { id: 'bp_3', name: 'Canvas Treat Pouch', rarity: 'Common', desc: 'Boosts bone payouts per dig (1.20x)', mult: 1.20 },
  { id: 'sp_1', name: 'Sturdy Shovel', rarity: 'Common', desc: 'Boosts dig payout scaling (1.10x)', workMult: 1.10 },
  { id: 'bp_4', name: 'Golden Dog-Tag', rarity: 'Rare', desc: 'Boosts bone payouts per dig (1.30x)', mult: 1.30 },
  { id: 'bp_5', name: 'Golden Collar', rarity: 'Rare', desc: 'Boosts bone payouts per dig (1.40x)', mult: 1.40 },
  { id: 'mp_1', name: 'Mystic Chew Toy', rarity: 'Rare', desc: 'Boosts ✨ Magic Bone chance (+4%)', magicAdd: 0.04 },
  { id: 'bp_6', name: 'Diamond Bowl', rarity: 'Legendary', desc: 'Massively boosts bone payouts per dig (1.80x)', mult: 1.80 },
  { id: 'mp_2', name: 'The Golden Good-Boy Stash', rarity: 'Legendary', desc: 'Significantly boosts ✨ Magic Bone chance (+10%)', magicAdd: 0.10 },
  { id: 'myth_1', name: 'The Infinite Toy Chest', rarity: 'Mythic', desc: 'Divine relic! Triples dig bones (3.0x) & boosts scaling (1.5x)', mult: 3.0, workMult: 1.5 }
];

function generateDefaultName(breed, indexNum) {
  return DEFAULT_PUP_NAMES[(indexNum - 1) % DEFAULT_PUP_NAMES.length].trim();
}

function createRosterEntry(breed, isShiny = false, shinyColor = null, customName = null) {
  const nextIndex = (state.roster ? state.roster.length : 0) + 1;
  return {
    id: `dog_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    breed,
    name: customName || generateDefaultName(breed, nextIndex),
    level: 1,
    xp: 0,
    bonesEarned: 0,
    isShiny,
    shinyColor: shinyColor || null
  };
}

function getXpNeededForLevel(level) {
  return Math.floor(25 * Math.pow(1.2, Math.max(0, level - 1)));
}

function getDogLevelBonusMult(entry) {
  const lvl = entry && entry.level ? entry.level : 1;
  return 1 + Math.max(0, lvl - 1) * LEVEL_BONUS_PER_LEVEL;
}

let state = {
  bones: 1000000,
  lifetimeBones: 0,
  magicBones: 0,
  dogs: {
    aussie: 1, beagle: 0, collie: 0, husky: 0,
    golden: 0, shepherd: 0, shiba: 0, labrador: 0
  },
  shinyDogs: [],
  roster: [],
  perks: [],
  decorInventory: { tree: 0, flowers: 0, fountain: 0 },
  placedDecorations: [],
  isPlacingDecor: false,
  activeDecorType: null,
  showNameTags: true,
  digPower: 1,
  speedMultiplier: 1,
  idleMultiplier: 0.6,
  magicChance: 0.12,
  
  kongTimer: 0,
  baconTimer: 0,
  pupCupTimer: 0,
  feastAnimTimer: 0,
  
  hasTennisBall: false,
  hasFrisbee: false,
  hasRedBone: false,
  hasDuck: false,

  isDraftingPerk: false,

  costs: {},
  lastSaveTime: Date.now()
};

Object.keys(BREED_CONFIG).forEach(b => {
  state.costs[b] = BREED_CONFIG[b].cost;
});
state.costs.toyBones = 25;
state.costs.toySpeed = 40;
state.costs.toyDig = 100;
state.costs.toyIdle = 200;

state.costs.treatKong = 150;
state.costs.treatBacon = 300;
state.costs.treatFeast = 500;
state.costs.treatCup = 750;

let tennisBall = { gx: 3.5, gy: 3.5, targetGx: 3.5, targetGy: 3.5, isRolling: false, timer: 6.0, bouncePhase: 0 };
let frisbee = { gx: 2.0, gy: 5.0, targetGx: 2.0, targetGy: 5.0, isMoving: false, timer: 7.5 };
let redBone = { gx: 5.0, gy: 2.0, targetGx: 5.0, targetGy: 2.0, isMoved: false, timer: 9.0 };
let duck = { gx: 5.0, gy: 5.0, targetGx: 5.0, targetGy: 5.0, isMoved: false, timer: 5.5, quackPhase: 0 };

let pendingRetireDogId = null;

function syncBreedCountsFromRoster() {
  Object.keys(state.dogs).forEach(b => {
    state.dogs[b] = 0;
  });
  state.shinyDogs = [];

  state.roster.forEach(entry => {
    if (entry.isShiny) {
      state.shinyDogs.push({ breed: entry.breed, color: entry.shinyColor });
    } else if (state.dogs[entry.breed] !== undefined) {
      state.dogs[entry.breed]++;
    }
  });
}

function getTotalDogs() {
  return state.roster.length;
}

function getPerkMultipliers() {
  let boneMult = 1;
  let workBonus = 1;
  let magicBonus = 0;
  state.perks.forEach(p => {
    if (p.mult) boneMult *= p.mult;
    if (p.workMult) workBonus *= p.workMult;
    if (p.magicAdd) magicBonus += p.magicAdd;
  });
  return { boneMult, workBonus, magicBonus };
}

/**
 * Computes the dog's personal dug-bone scaling factor (0 until the dog digs its first bone),
 * using a gentle Math.sqrt curve multiplied by the breed's scalingMult and level bonus.
 */
function getDogDugScaling(entry) {
  const dug = entry && entry.bonesEarned ? entry.bonesEarned : 0;
  if (dug <= 0) return 0; // Waits until this dog digs its first bone
  const cfg = (entry && BREED_CONFIG[entry.breed]) || BREED_CONFIG.aussie;
  return Math.sqrt(dug) * DIG_MULT_SQRT_SCALE * (cfg.scalingMult || 1.0) * getDogLevelBonusMult(entry);
}

/**
 * Overall dig payout multiplier for the pack (or for a specific dog entry),
 * combining dug-bone scaling, Frisbee speedMultiplier, Bacon treat, and Treasure perks.
 */
function getDigMultiplier(entry = null) {
  let dugSum = 0;
  if (entry) {
    dugSum = getDogDugScaling(entry);
  } else {
    state.roster.forEach(r => {
      dugSum += getDogDugScaling(r);
    });
  }

  const { boneMult, workBonus } = getPerkMultipliers();
  const baconBonus = state.baconTimer > 0 ? 3.0 : 1.0;
  return (DIG_MULT_BASE + dugSum) * state.speedMultiplier * baconBonus * workBonus * boneMult;
}

/**
 * Estimates average bones awarded per standard dog dig across the current roster.
 */
function getAverageBonesPerDig() {
  if (!state.roster || state.roster.length === 0) return state.digPower;
  const cupMult = state.pupCupTimer > 0 ? 2 : 1;
  const { boneMult, workBonus } = getPerkMultipliers();
  const baconBonus = state.baconTimer > 0 ? 3.0 : 1.0;

  let total = 0;
  state.roster.forEach(entry => {
    const cfg = BREED_CONFIG[entry.breed] || BREED_CONFIG.aussie;
    const perDogMult = (DIG_MULT_BASE + getDogDugScaling(entry)) * state.speedMultiplier * baconBonus * workBonus * boneMult;
    const raw = state.digPower * (cfg.payoutMult || 1.0) * cupMult * perDogMult;
    total += Math.max(1, Math.round(raw * 10) / 10);
  });

  return total / state.roster.length;
}

/**
 * Estimates total digs performed over `seconds` across the current roster
 * using each dog's walk speed, dig duration, and work bonus.
 */
function estimateOfflineDigs(seconds) {
  if (!state.roster || state.roster.length === 0 || seconds <= 0) return 0;
  const { workBonus } = getPerkMultipliers();
  const cadenceFactor = Math.min(2.0, Math.sqrt(Math.max(1, workBonus)));

  let totalDigs = 0;
  state.roster.forEach(entry => {
    const cfg = BREED_CONFIG[entry.breed] || BREED_CONFIG.aussie;
    const estWalkSec = 1.6 / Math.max(0.5, cfg.walkMult || 1.0);
    const estIdleSec = 1.0;
    const avgCycleSec = Math.max(0.8, (estIdleSec + estWalkSec + (cfg.digSec || 1.0)) / cadenceFactor);
    totalDigs += seconds / avgCycleSec;
  });

  return Math.max(1, Math.floor(totalDigs));
}

function rebuildCanvasDogsFromRoster() {
  dogs.length = 0;
  state.roster.forEach(entry => {
    dogs.push(new Dog(
      1.5 + Math.random() * 4,
      1.5 + Math.random() * 4,
      entry.id,
      entry.breed,
      Boolean(entry.isShiny),
      entry.shinyColor || null
    ));
  });
}

function normalizeBreedKey(breed) {
  if (breed === 'dalmatian') return 'labrador';
  return BREED_CONFIG[breed] ? breed : 'aussie';
}

function loadGame() {
  const saved = localStorage.getItem('pupperpark_save');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      state = { ...state, ...parsed };
      if (typeof state.lifetimeBones !== 'number' || Number.isNaN(state.lifetimeBones)) {
        state.lifetimeBones = state.bones || 0;
      }
      if (typeof state.showNameTags !== 'boolean') {
        state.showNameTags = true;
      }
      if (!state.shinyDogs) state.shinyDogs = [];
      if (!state.perks) state.perks = [];
      if (!state.decorInventory) state.decorInventory = { tree: 0, flowers: 0, fountain: 0 };
      if (!state.placedDecorations) state.placedDecorations = [];
      if (!state.idleMultiplier) state.idleMultiplier = 0.6;
      state.isDraftingPerk = false;
      state.isPlacingDecor = false;
      state.activeDecorType = null;
      if (!state.dogs) state.dogs = {};
      if (!state.costs) state.costs = {};
      Object.keys(BREED_CONFIG).forEach(b => {
        if (state.dogs[b] === undefined) state.dogs[b] = 0;
        if (!state.costs[b]) state.costs[b] = BREED_CONFIG[b].cost;
      });
      if (!state.costs.toyBones) state.costs.toyBones = 25;
      if (!state.costs.toySpeed) state.costs.toySpeed = 40;
      if (!state.costs.toyDig) state.costs.toyDig = 100;
      if (!state.costs.toyIdle) state.costs.toyIdle = 200;
      if (!state.costs.treatKong) state.costs.treatKong = 150;
      if (!state.costs.treatBacon) state.costs.treatBacon = 300;
      if (!state.costs.treatFeast) state.costs.treatFeast = 500;
      if (!state.costs.treatCup) state.costs.treatCup = 750;
    } catch (e) {
      console.error('Failed to load save data, resetting save', e);
      localStorage.removeItem('pupperpark_save');
    }
  }

  // Migrate legacy dogs/shinyDogs into roster if roster is empty
  if (!Array.isArray(state.roster) || state.roster.length === 0) {
    state.roster = [];
    Object.keys(state.dogs || {}).forEach(rawBreed => {
      const breed = normalizeBreedKey(rawBreed);
      const count = state.dogs[rawBreed] || 0;
      for (let i = 0; i < count; i++) {
        state.roster.push(createRosterEntry(breed, false, null));
      }
    });
    (state.shinyDogs || []).forEach(shiny => {
      state.roster.push(createRosterEntry(normalizeBreedKey(shiny.breed), true, shiny.color));
    });
  }

  // Enforce max 12 dogs if an older save had more
  if (state.roster.length > MAX_DOGS) {
    state.roster = state.roster.slice(0, MAX_DOGS);
  }

  if (state.roster.length === 0) {
    state.roster.push(createRosterEntry('aussie', false, null, 'Biscuit'));
  }

  state.roster.forEach((entry, idx) => {
    entry.breed = normalizeBreedKey(entry.breed);
    if (!entry.id) entry.id = `dog_${idx}_${Math.random().toString(36).slice(2, 6)}`;
    if (!entry.name) entry.name = generateDefaultName(entry.breed, idx + 1);
    if (typeof entry.level !== 'number' || entry.level < 1) entry.level = 1;
    if (typeof entry.xp !== 'number' || entry.xp < 0) entry.xp = 0;
    if (typeof entry.bonesEarned !== 'number' || entry.bonesEarned < 0) entry.bonesEarned = 0;
  });

  if (typeof state.lifetimeBones !== 'number' || Number.isNaN(state.lifetimeBones)) {
    state.lifetimeBones = state.bones || 0;
  }
  if (state.lifetimeBones < state.bones) {
    state.lifetimeBones = state.bones;
  }

  syncBreedCountsFromRoster();

  const now = Date.now();
  const elapsedSeconds = (now - state.lastSaveTime) / 1000;

  if (elapsedSeconds > 15) {
    const effectiveSeconds = Math.min(elapsedSeconds, MAX_OFFLINE_SECONDS);
    const estimatedDigs = estimateOfflineDigs(effectiveSeconds);
    const avgPerDig = getAverageBonesPerDig();
    const earned = Math.floor(estimatedDigs * avgPerDig * state.idleMultiplier);
    if (earned > 0) {
      state.bones += earned;
      state.lifetimeBones += earned;
      showOfflineModal(earned, estimatedDigs);
    }
  }

  state.lastSaveTime = now;
  saveGame();
  rebuildCanvasDogsFromRoster();
}

const SAVE_COOLDOWN_MS = 1200;
let pendingSaveTimeout = null;
let lastWrittenSaveAt = 0;

function saveGame() {
  state.lastSaveTime = Date.now();
  lastWrittenSaveAt = state.lastSaveTime;
  if (pendingSaveTimeout) {
    clearTimeout(pendingSaveTimeout);
    pendingSaveTimeout = null;
  }
  try {
    localStorage.setItem('pupperpark_save', JSON.stringify(state));
  } catch (e) {
    // Ignore storage quota/restriction errors
  }
}

function requestSave() {
  const elapsed = Date.now() - lastWrittenSaveAt;
  if (elapsed >= SAVE_COOLDOWN_MS) {
    saveGame();
  } else if (!pendingSaveTimeout) {
    pendingSaveTimeout = setTimeout(() => {
      pendingSaveTimeout = null;
      saveGame();
    }, SAVE_COOLDOWN_MS - elapsed);
  }
}

setInterval(saveGame, 10000);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    saveGame();
  }
});

window.addEventListener('pagehide', saveGame);
window.addEventListener('beforeunload', saveGame);

function showOfflineModal(earned, estimatedDigs = 0) {
  const modal = document.getElementById('offlineModal');
  const text = document.getElementById('offlineEarnings');
  if (text) {
    if (estimatedDigs > 0) {
      text.textContent = `~${estimatedDigs.toLocaleString()} digs estimated — they dug ${earned.toLocaleString()} Bones while you were away!`;
    } else {
      text.textContent = `They dug ${earned.toLocaleString()} Bones while you were away!`;
    }
  }
  if (modal) {
    modal.style.display = 'flex';
  }
}

document.getElementById('btnCloseOffline').addEventListener('click', () => {
  document.getElementById('offlineModal').style.display = 'none';
});

const gameModal = document.getElementById('gameModal');
const drawerWindow = document.getElementById('drawerWindow');
const drawerHandle = document.getElementById('drawerHandle');

document.getElementById('btnOpenMenu').addEventListener('click', () => {
  initAudio();
  gameModal.style.display = 'flex';
  drawerWindow.style.transform = 'translateY(0)';
  renderRosterTab();
});

function closeMenu() {
  gameModal.style.display = 'none';
}

document.getElementById('btnCloseMenu').addEventListener('click', closeMenu);

let drawerStartY = 0;
let drawerCurrentY = 0;
let isDrawerDragging = false;

drawerHandle.addEventListener('pointerdown', (e) => {
  isDrawerDragging = true;
  drawerStartY = e.clientY;
  drawerHandle.setPointerCapture(e.pointerId);
});

drawerHandle.addEventListener('pointermove', (e) => {
  if (!isDrawerDragging) return;
  drawerCurrentY = e.clientY - drawerStartY;
  if (drawerCurrentY > 0) {
    drawerWindow.style.transform = `translateY(${drawerCurrentY}px)`;
  }
});

drawerHandle.addEventListener('pointerup', (e) => {
  if (!isDrawerDragging) return;
  isDrawerDragging = false;
  drawerHandle.releasePointerCapture(e.pointerId);
  
  if (drawerCurrentY > 80) {
    closeMenu();
  }
  drawerWindow.style.transform = 'translateY(0)';
  drawerCurrentY = 0;
});

const tabBtns = document.querySelectorAll('.tab-btn');
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'tab-roster') {
      renderRosterTab();
    }
  });
});

// Retire Dog Confirmation Modal Handlers (up to 50% refund)
const retireConfirmModal = document.getElementById('retireConfirmModal');
const retireConfirmText = document.getElementById('retireConfirmText');

function openRetireConfirm(dogId) {
  initAudio();
  if (state.roster.length <= 1) return;
  const target = state.roster.find(d => d.id === dogId);
  if (!target) return;

  pendingRetireDogId = dogId;
  const refundPct = Math.round(RETIRE_REFUND_RATE * 100);
  const refundPreview = Math.floor((target.bonesEarned || 0) * RETIRE_REFUND_RATE);
  if (retireConfirmText) {
    retireConfirmText.textContent = `Retire ${target.name} and receive +${refundPreview.toLocaleString()} Bones (${refundPct}% of their ${Math.floor(target.bonesEarned || 0).toLocaleString()} lifetime bones dug)?`;
  }
  if (retireConfirmModal) {
    retireConfirmModal.style.display = 'flex';
  }
}

document.getElementById('btnCancelRetire')?.addEventListener('click', () => {
  initAudio();
  pendingRetireDogId = null;
  if (retireConfirmModal) retireConfirmModal.style.display = 'none';
});

document.getElementById('btnConfirmRetire')?.addEventListener('click', () => {
  const idToRetire = pendingRetireDogId;
  pendingRetireDogId = null;
  if (retireConfirmModal) retireConfirmModal.style.display = 'none';
  if (idToRetire) {
    retireDog(idToRetire);
  }
});

function retireDog(dogId) {
  initAudio();
  if (state.roster.length <= 1) return;

  const idx = state.roster.findIndex(d => d.id === dogId);
  if (idx === -1) return;

  const [retiredDog] = state.roster.splice(idx, 1);
  const refundPct = Math.round(RETIRE_REFUND_RATE * 100);
  const refund = Math.floor((retiredDog.bonesEarned || 0) * RETIRE_REFUND_RATE);

  if (refund > 0) {
    state.bones += refund;
    state.lifetimeBones += refund;
  }

  syncBreedCountsFromRoster();
  rebuildCanvasDogsFromRoster();
  sfx.thud();

  const noticeEl = document.getElementById('retireNotice');
  if (noticeEl) {
    noticeEl.textContent = `${retiredDog.name} retired! You received ${refund.toLocaleString()} Bones (${refundPct}% of their ${Math.floor(retiredDog.bonesEarned).toLocaleString()} lifetime bones dug).`;
    noticeEl.style.display = 'block';
  }

  updateUI();
  renderRosterTab();
  saveGame();
}

function renderRosterTab() {
  const container = document.getElementById('rosterListContainer');
  if (!container) return;

  const canRetire = state.roster.length > 1;
  container.innerHTML = '';

  state.roster.forEach(entry => {
    const cfg = BREED_CONFIG[entry.breed] || BREED_CONFIG.aussie;
    const xpNeeded = getXpNeededForLevel(entry.level);
    const pct = Math.min(100, Math.max(0, (entry.xp / xpNeeded) * 100));
    const levelBonusPct = ((getDogLevelBonusMult(entry) - 1) * 100).toFixed(1);
    const refundPreview = Math.floor((entry.bonesEarned || 0) * RETIRE_REFUND_RATE);
    const breedName = BREED_LABELS[entry.breed] || entry.breed;

    const card = document.createElement('div');
    card.className = 'roster-card';

    const mainCol = document.createElement('div');
    mainCol.className = 'roster-main';

    const topRow = document.createElement('div');
    topRow.className = 'roster-top';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'roster-name-input';
    nameInput.value = entry.name;
    nameInput.maxLength = 24;
    nameInput.setAttribute('aria-label', `Name for ${breedName}`);

    const commitName = () => {
      const cleaned = nameInput.value.trim();
      entry.name = cleaned || breedName;
      nameInput.value = entry.name;
      requestSave();
    };
    nameInput.addEventListener('change', commitName);
    nameInput.addEventListener('blur', commitName);

    topRow.appendChild(nameInput);

    const xpBarOuter = document.createElement('div');
    xpBarOuter.className = 'roster-xp-track';

    const xpBarInner = document.createElement('div');
    xpBarInner.className = 'roster-xp-fill';
    xpBarInner.style.width = `${pct}%`;
    xpBarOuter.appendChild(xpBarInner);

    const chipsRow = document.createElement('div');
    chipsRow.className = 'roster-chips';
    chipsRow.innerHTML = `
      <span class="roster-chip">${breedName} #${cfg.rank}</span>
      <span class="roster-lvl-badge${entry.isShiny ? ' shiny' : ''}">Lv. ${entry.level}${entry.isShiny ? ' ✨' : ''}</span>
      <span class="roster-chip">Dug <strong>${Math.floor(entry.bonesEarned).toLocaleString()}</strong> 🦴</span>
      <span class="roster-chip">Payout <strong>${cfg.payoutMult.toFixed(1)}x</strong></span>
      <span class="roster-chip">Scale <strong>${cfg.scalingMult.toFixed(2)}x</strong></span>
      <span class="roster-chip">XP <strong>${Math.floor(entry.xp)}/${xpNeeded}</strong> (${cfg.xpMult.toFixed(2)}x)</span>
      <span class="roster-chip">Lvl +<strong>${levelBonusPct}%</strong></span>
    `;

    mainCol.appendChild(topRow);
    mainCol.appendChild(xpBarOuter);
    mainCol.appendChild(chipsRow);
    card.appendChild(mainCol);

    if (canRetire) {
      const rightAction = document.createElement('div');
      rightAction.className = 'roster-right-action';

      const retireBtn = document.createElement('button');
      retireBtn.className = 'retire-pill-btn';
      retireBtn.textContent = `Retire +${refundPreview.toLocaleString()} 🦴`;
      retireBtn.addEventListener('click', () => openRetireConfirm(entry.id));

      rightAction.appendChild(retireBtn);
      card.appendChild(rightAction);
    }

    container.appendChild(card);
  });
}

// Decor Buy Handlers (capped at max placement limit: Tree 3, Flowers 5, Fountain 2)
document.getElementById('btnBuyDecorTree').addEventListener('click', () => {
  initAudio();
  const currentTreeOwned = state.decorInventory.tree || 0;
  if (state.magicBones >= 500 && currentTreeOwned < 3) {
    state.magicBones -= 500;
    state.decorInventory.tree = currentTreeOwned + 1;
    sfx.upgrade();
    updateUI();
    saveGame();
  }
});

document.getElementById('btnBuyDecorFlowers').addEventListener('click', () => {
  initAudio();
  const currentFlowersOwned = state.decorInventory.flowers || 0;
  if (state.magicBones >= 250 && currentFlowersOwned < 5) {
    state.magicBones -= 250;
    state.decorInventory.flowers = currentFlowersOwned + 1;
    sfx.upgrade();
    updateUI();
    saveGame();
  }
});

document.getElementById('btnBuyDecorFountain').addEventListener('click', () => {
  initAudio();
  const currentFountainOwned = state.decorInventory.fountain || 0;
  if (state.magicBones >= 1000 && currentFountainOwned < 2) {
    state.magicBones -= 1000;
    state.decorInventory.fountain = currentFountainOwned + 1;
    sfx.upgrade();
    updateUI();
    saveGame();
  }
});

// Decor Place Handlers
document.getElementById('btnPlaceDecorTree').addEventListener('click', () => {
  initAudio();
  const placedCount = state.placedDecorations.filter(d => d.type === 'tree').length;
  const available = (state.decorInventory.tree || 0) - placedCount;
  if (available <= 0 || placedCount >= 3) return;

  state.isPlacingDecor = true;
  state.activeDecorType = 'tree';
  closeMenu();
  document.getElementById('placementBanner').textContent = 'Tap any park tile to place your tree!';
  document.getElementById('placementBanner').style.display = 'block';
  sfx.gather();
});

document.getElementById('btnPlaceDecorFlowers').addEventListener('click', () => {
  initAudio();
  const placedCount = state.placedDecorations.filter(d => d.type === 'flowers').length;
  const available = (state.decorInventory.flowers || 0) - placedCount;
  if (available <= 0 || placedCount >= 5) return;

  state.isPlacingDecor = true;
  state.activeDecorType = 'flowers';
  closeMenu();
  document.getElementById('placementBanner').textContent = 'Tap any park tile to place your flower patch!';
  document.getElementById('placementBanner').style.display = 'block';
  sfx.gather();
});

document.getElementById('btnPlaceDecorFountain').addEventListener('click', () => {
  initAudio();
  const placedCount = state.placedDecorations.filter(d => d.type === 'fountain').length;
  const available = (state.decorInventory.fountain || 0) - placedCount;
  if (available <= 0 || placedCount >= 2) return;

  state.isPlacingDecor = true;
  state.activeDecorType = 'fountain';
  closeMenu();
  document.getElementById('placementBanner').textContent = 'Tap any park tile to place your water fountain!';
  document.getElementById('placementBanner').style.display = 'block';
  sfx.gather();
});

// Clear Park Confirmation Modal Handlers
const clearDecorConfirmModal = document.getElementById('clearDecorConfirmModal');
document.getElementById('btnClearDecor').addEventListener('click', () => {
  initAudio();
  clearDecorConfirmModal.style.display = 'flex';
});

document.getElementById('btnCancelClearDecor').addEventListener('click', () => {
  initAudio();
  clearDecorConfirmModal.style.display = 'none';
});

document.getElementById('btnConfirmClearDecor').addEventListener('click', () => {
  initAudio();
  state.placedDecorations = [];
  sfx.thud();
  clearDecorConfirmModal.style.display = 'none';
  updateUI();
  saveGame();
});

// Settings: Name Tags Toggle Handler
document.getElementById('btnToggleNameTags')?.addEventListener('click', () => {
  initAudio();
  state.showNameTags = !state.showNameTags;
  sfx.gather();
  updateUI();
  saveGame();
});

// Settings: Reset Progress Modal Handlers
const resetConfirmModal = document.getElementById('resetConfirmModal');
document.getElementById('btnResetProgress').addEventListener('click', () => {
  initAudio();
  resetConfirmModal.style.display = 'flex';
});

document.getElementById('btnCancelReset').addEventListener('click', () => {
  initAudio();
  resetConfirmModal.style.display = 'none';
});

document.getElementById('btnConfirmReset').addEventListener('click', () => {
  initAudio();
  localStorage.removeItem('pupperpark_save');
  pendingRetireDogId = null;

  state = {
    bones: 0,
    lifetimeBones: 0,
    magicBones: 0,
    dogs: {
      aussie: 1, beagle: 0, collie: 0, husky: 0,
      golden: 0, shepherd: 0, shiba: 0, labrador: 0
    },
    shinyDogs: [],
    roster: [createRosterEntry('aussie', false, null, 'Biscuit')],
    perks: [],
    decorInventory: { tree: 0, flowers: 0, fountain: 0 },
    placedDecorations: [],
    isPlacingDecor: false,
    activeDecorType: null,
    showNameTags: true,
    digPower: 1,
    speedMultiplier: 1,
    idleMultiplier: 0.6,
    magicChance: 0.12,
    
    kongTimer: 0,
    baconTimer: 0,
    pupCupTimer: 0,
    feastAnimTimer: 0,
    
    hasTennisBall: false,
    hasFrisbee: false,
    hasRedBone: false,
    hasDuck: false,

    isDraftingPerk: false,

    costs: {},
    lastSaveTime: Date.now()
  };

  Object.keys(BREED_CONFIG).forEach(b => {
    state.costs[b] = BREED_CONFIG[b].cost;
  });
  state.costs.toyBones = 25;
  state.costs.toySpeed = 40;
  state.costs.toyDig = 100;
  state.costs.toyIdle = 200;

  state.costs.treatKong = 150;
  state.costs.treatBacon = 300;
  state.costs.treatFeast = 500;
  state.costs.treatCup = 750;

  rebuildCanvasDogsFromRoster();
  droppedBones.length = 0;
  particles.length = 0;

  const noticeEl = document.getElementById('retireNotice');
  if (noticeEl) noticeEl.style.display = 'none';

  resetConfirmModal.style.display = 'none';
  if (retireConfirmModal) retireConfirmModal.style.display = 'none';
  document.getElementById('placementBanner').style.display = 'none';
  closeMenu();
  updateUI();
  renderRosterTab();
  saveGame();
});

const GRID_SIZE = 7;
const TILE_W = 96;
const TILE_H = 48;

let originX = 0;
let originY = 0;
let cameraAngle = 0;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  originX = canvas.width / 2;
  originY = canvas.height / 2;
}
window.addEventListener('resize', resize);
resize();

function gridToScreen(gx, gy) {
  const cx = GRID_SIZE / 2;
  const cy = GRID_SIZE / 2;
  
  const relX = gx - cx;
  const relY = gy - cy;

  const cosA = Math.cos(cameraAngle);
  const sinA = Math.sin(cameraAngle);
  const rotX = relX * cosA - relY * sinA;
  const rotY = relX * sinA + relY * cosA;

  return {
    x: originX + (rotX - rotY) * (TILE_W / 2),
    y: originY + (rotX + rotY) * (TILE_H / 2)
  };
}

function screenToGrid(sx, sy) {
  const dx = sx - originX;
  const dy = sy - originY;
  
  const isoX = dx / (TILE_W / 2);
  const isoY = dy / (TILE_H / 2);

  const rotX = (isoX + isoY) / 2;
  const rotY = (isoY - isoX) / 2;

  const cosA = Math.cos(-cameraAngle);
  const sinA = Math.sin(-cameraAngle);
  const relX = rotX * cosA - rotY * sinA;
  const relY = rotX * sinA + rotY * cosA;

  const cx = GRID_SIZE / 2;
  const cy = GRID_SIZE / 2;

  return {
    gx: relX + cx,
    gy: relY + cy
  };
}

let isRotating = false;
let lastMouseX = 0;
let lastMouseY = 0;
let holdTimer = null;
let holdStartTime = 0;
let holdPosition = { x: 0, y: 0 };
const HOLD_DURATION = 4000;

canvas.addEventListener('pointerdown', (e) => {
  isRotating = true;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
  try { canvas.setPointerCapture(e.pointerId); } catch(err) {}

  holdStartTime = performance.now();
  holdPosition = { x: e.clientX, y: e.clientY };
  
  if (holdTimer) clearTimeout(holdTimer);
  holdTimer = setTimeout(() => {
    initAudio();
    sfx.gather();
    const rect = canvas.getBoundingClientRect();
    const clickX = holdPosition.x - rect.left;
    const clickY = holdPosition.y - rect.top;
    const targetGrid = screenToGrid(clickX, clickY);

    dogs.forEach(dog => {
      dog.targetGx = Math.max(0.5, Math.min(GRID_SIZE - 0.5, targetGrid.gx + (Math.random() - 0.5) * 0.6));
      dog.targetGy = Math.max(0.5, Math.min(GRID_SIZE - 0.5, targetGrid.gy + (Math.random() - 0.5) * 0.6));
      dog.state = 'WALK';
    });

    particles.push({
      x: clickX,
      y: clickY,
      vx: 0,
      vy: 0,
      life: 0.8,
      maxLife: 0.8,
      color: '#ffeaa7',
      size: 5,
      isRing: true
    });

    isRotating = false;
  }, HOLD_DURATION);
});

canvas.addEventListener('pointermove', (e) => {
  const moveDist = Math.hypot(e.clientX - lastMouseX, e.clientY - lastMouseY);
  
  if (moveDist > 15) {
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  }

  if (!isRotating) return;
  const deltaX = e.clientX - lastMouseX;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
  cameraAngle += deltaX * 0.008;
});

canvas.addEventListener('pointerup', (e) => {
  if (holdTimer) {
    clearTimeout(holdTimer);
    holdTimer = null;
  }

  if (!isRotating) {
    isRotating = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch(err) {}
    return;
  }

  isRotating = false;
  try { canvas.releasePointerCapture(e.pointerId); } catch(err) {}
  
  const totalDrag = Math.abs(e.clientX - lastMouseX);
  if (totalDrag < 5) {
    initAudio();
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const gridPos = screenToGrid(clickX, clickY);

    if (state.isPlacingDecor) {
      if (
        gridPos.gx >= 0 && gridPos.gx <= GRID_SIZE &&
        gridPos.gy >= 0 && gridPos.gy <= GRID_SIZE
      ) {
        state.placedDecorations.push({
          type: state.activeDecorType,
          gx: Math.floor(gridPos.gx),
          gy: Math.floor(gridPos.gy)
        });
        state.isPlacingDecor = false;
        state.activeDecorType = null;
        document.getElementById('placementBanner').style.display = 'none';
        sfx.gather();
        updateUI();
        saveGame();
      }
      return;
    }

    if (
      gridPos.gx >= 0 && gridPos.gx <= GRID_SIZE &&
      gridPos.gy >= 0 && gridPos.gy <= GRID_SIZE
    ) {
      const { magicBonus } = getPerkMultipliers();
      const isMagic = Math.random() < (state.magicChance + magicBonus) || state.kongTimer > 0;
      const cupMult = state.pupCupTimer > 0 ? 2 : 1;
      droppedBones.push({
        x: clickX,
        y: clickY - 10,
        vx: (Math.random() - 0.5) * 40,
        vy: -95,
        groundY: clickY + 5,
        age: 0,
        isMagic,
        value: (isMagic ? 1 : state.digPower) * cupMult
      });
    }
  }
});

const mushrooms = [
  { gx: 2.2, gy: 2.2, color: '#a29bfe', glow: 'rgba(162, 155, 254, 0.35)' },
  { gx: 4.8, gy: 2.4, color: '#fd79a8', glow: 'rgba(253, 121, 168, 0.35)' },
  { gx: 2.4, gy: 4.8, color: '#55efc4', glow: 'rgba(85, 239, 196, 0.35)' },
  { gx: 4.6, gy: 4.6, color: '#ffeaa7', glow: 'rgba(255, 234, 167, 0.35)' }
];

const dogs = [];
const droppedBones = [];
const particles = [];

class Dog {
  constructor(gx, gy, rosterId, breed = 'aussie', isShiny = false, shinyColor = null) {
    this.gx = gx;
    this.gy = gy;
    this.targetGx = gx;
    this.targetGy = gy;
    this.state = 'IDLE'; 
    this.timer = 0.5 + Math.random() * 1.5;
    this.facingRight = Math.random() > 0.5;
    this.animPhase = Math.random() * Math.PI * 2;
    this.rosterId = rosterId;
    this.breed = normalizeBreedKey(breed);
    this.isShiny = isShiny;
    
    const shinyPalettes = ['#f1c40f', '#e67e22', '#e84393', '#00cec9', '#fd79a8'];
    this.shinyColor = shinyColor || shinyPalettes[Math.floor(Math.random() * shinyPalettes.length)];
    this.isMagicDig = false;
    this.onReachToy = null;
  }

  getRosterEntry() {
    return state.roster.find(r => r.id === this.rosterId) || null;
  }

  pickNewTarget() {
    this.targetGx = 0.7 + Math.random() * (GRID_SIZE - 1.4);
    this.targetGy = 0.7 + Math.random() * (GRID_SIZE - 1.4);
    this.state = 'WALK';
  }

  update(dt) {
    const cfg = BREED_CONFIG[this.breed] || BREED_CONFIG.aussie;
    const { workBonus } = getPerkMultipliers();

    // Keep visual movement & animation speeds gentle and capped so dogs stay smooth
    const visualPace = Math.min(1.6, 1 + Math.log1p(Math.max(0, workBonus - 1)) * 0.25);
    const walkSpeed = (cfg.walkMult || 1.1) * visualPace;

    this.animPhase += dt * (this.state === 'WALK' ? 9 * Math.min(1.25, visualPace) : 5 * Math.min(1.25, visualPace));

    if (this.state === 'IDLE') {
      this.timer -= dt * visualPace;
      if (this.timer <= 0) {
        this.pickNewTarget();
      }
    } else if (this.state === 'WALK') {
      const dx = this.targetGx - this.gx;
      const dy = this.targetGy - this.gy;
      const dist = Math.hypot(dx, dy);

      const screenDeltaX = (dx - dy);
      if (Math.abs(screenDeltaX) > 0.01) {
        this.facingRight = screenDeltaX >= 0;
      }

      if (dist < 0.08) {
        this.gx = this.targetGx;
        this.gy = this.targetGy;

        if (this.onReachToy) {
          this.onReachToy();
          this.onReachToy = null;
        }

        this.state = 'DIG';
        this.timer = (cfg.digSec || 1.0) / visualPace;
        
        const { magicBonus } = getPerkMultipliers();
        const magicChanceTotal = Math.min(0.9, state.magicChance + magicBonus + (cfg.magicBonus || 0));
        this.isMagicDig = Math.random() < magicChanceTotal || state.kongTimer > 0;
        
        const treasureChance = cfg.treasureChance || 0.00008;
        if (!state.isDraftingPerk && Math.random() < treasureChance) {
          triggerPerkDraft();
        }
      } else {
        this.gx += (dx / dist) * walkSpeed * dt;
        this.gy += (dy / dist) * walkSpeed * dt;
        this.gx = Math.max(0.5, Math.min(GRID_SIZE - 0.5, this.gx));
        this.gy = Math.max(0.5, Math.min(GRID_SIZE - 0.5, this.gy));
      }
    } else if (this.state === 'DIG') {
      this.timer -= dt;
      if (Math.random() < 0.35) {
        const pos = gridToScreen(this.gx, this.gy);
        particles.push({
          x: pos.x + (this.facingRight ? 12 : -12),
          y: pos.y + 4,
          vx: (Math.random() - 0.5) * 45,
          vy: -30 - Math.random() * 40,
          life: 0.5,
          maxLife: 0.5,
          color: this.isMagicDig ? '#ffeaa7' : '#795548',
          size: this.isMagicDig ? 3.5 : 3
        });
      }

      if (this.timer <= 0) {
        this.finishDig();
        this.state = 'IDLE';
        this.timer = 0.6 + Math.random() * 1.2;
      }
    }
  }

  finishDig() {
    const entry = this.getRosterEntry();
    const cfg = BREED_CONFIG[this.breed] || BREED_CONFIG.aussie;
    const cupMult = state.pupCupTimer > 0 ? 2 : 1;

    // Scale standard bones per dig using the dog's dug-bone scaling + pack dig multiplier
    const dogDigMult = getDigMultiplier(entry);
    const rawAmount = state.digPower * (cfg.payoutMult || 1.0) * cupMult * dogDigMult;
    const amount = Math.max(1, Math.round(rawAmount * 10) / 10);
    const boneValue = this.isMagicDig ? cupMult : amount;
    const pos = gridToScreen(this.gx, this.gy);

    if (entry) {
      entry.bonesEarned = (entry.bonesEarned || 0) + boneValue;
      const baseXp = this.isMagicDig ? 2 : Math.max(1, Math.floor(amount));
      const xpGain = Math.max(1, Math.round(baseXp * (cfg.xpMult || 1.0) * (this.isMagicDig ? 2 : 1)));
      entry.xp = (entry.xp || 0) + xpGain;

      let leveledUp = false;
      while (entry.xp >= getXpNeededForLevel(entry.level)) {
        entry.xp -= getXpNeededForLevel(entry.level);
        entry.level += 1;
        leveledUp = true;
      }
      if (leveledUp) {
        sfx.upgrade();
      }
    }

    droppedBones.push({
      x: pos.x,
      y: pos.y - 6,
      vx: (Math.random() - 0.5) * 50,
      vy: -110,
      groundY: pos.y + 4,
      age: 0,
      isMagic: this.isMagicDig,
      value: boneValue
    });
  }

  draw(ctx) {
    const pos = gridToScreen(this.gx, this.gy);
    ctx.save();
    ctx.translate(pos.x, pos.y);

    if (this.isShiny) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 234, 167, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 4, 24 + Math.sin(this.animPhase * 3) * 3, 12, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (this.state === 'DIG' && this.isMagicDig) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 234, 167, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 6, 26 + Math.sin(this.animPhase * 2) * 3, 13, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(0, 6, 17, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    if (!this.facingRight) {
      ctx.scale(-1, 1);
    }

    let feastJump = 0;
    if (state.feastAnimTimer > 0) {
      feastJump = Math.abs(Math.sin(state.feastAnimTimer * Math.PI * 4)) * 14;
    }

    const bounce = (this.state === 'WALK' ? Math.abs(Math.sin(this.animPhase)) * 3 : 0) + feastJump;
    const digTilt = this.state === 'DIG' ? 0.25 : 0;
    ctx.translate(0, -bounce);
    ctx.rotate(digTilt);

    const legSwing = this.state === 'WALK' ? Math.sin(this.animPhase) * 4 : (this.state === 'DIG' ? Math.sin(this.animPhase * 3) * 5 : 0);

    if (this.breed === 'aussie') {
      const primaryColor = this.isShiny ? this.shinyColor : '#c87d4b';
      ctx.fillStyle = primaryColor;
      ctx.fillRect(-11 - legSwing, -3, 4, 9);
      ctx.fillRect(6 + legSwing, -3, 4, 9);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-11 - legSwing, 4, 4, 3);
      ctx.fillRect(6 + legSwing, 4, 4, 3);
      const wag = Math.sin(this.animPhase * 1.5) * 2;
      ctx.fillStyle = '#4e433f';
      ctx.beginPath(); ctx.arc(-15, -10 + wag, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4e433f';
      ctx.beginPath(); ctx.ellipse(-2, -9, 14, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#736560';
      ctx.beginPath(); ctx.ellipse(-3, -11, 9, 5, -0.1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f8f9fa';
      ctx.beginPath(); ctx.arc(9, -8, 7.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4e433f';
      ctx.beginPath(); ctx.arc(11, -17, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = primaryColor;
      ctx.beginPath(); ctx.arc(13, -15, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(17, -15, 4.5, 3.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1e1e1e';
      ctx.beginPath(); ctx.arc(20.5, -16, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1e272e';
      ctx.beginPath(); ctx.arc(14, -18.5, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#382f2c';
      ctx.beginPath(); ctx.ellipse(7, -19, 3.5, 5.5, 0.35, 0, Math.PI * 2); ctx.fill();

    } else if (this.breed === 'collie') {
      const collieColor = this.isShiny ? this.shinyColor : '#2d3436';
      ctx.fillStyle = collieColor;
      ctx.fillRect(-12 - legSwing, -3, 3.5, 10);
      ctx.fillRect(7 + legSwing, -3, 3.5, 10);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-12 - legSwing, 4, 3.5, 3);
      ctx.fillRect(7 + legSwing, 4, 3.5, 3);
      const wag = Math.sin(this.animPhase * 2) * 3;
      ctx.fillStyle = collieColor; ctx.beginPath(); ctx.moveTo(-15, -9); ctx.quadraticCurveTo(-23, -13 + wag, -26, -8); ctx.lineWidth = 3; ctx.strokeStyle = collieColor; ctx.stroke();
      ctx.fillStyle = collieColor;
      ctx.beginPath(); ctx.ellipse(-1, -10, 15, 8, -0.1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(5, -11, 5, 7, 0.25, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = collieColor;
      ctx.beginPath(); ctx.arc(11, -17, 7.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.moveTo(11, -16); ctx.lineTo(20, -14); ctx.lineTo(13, -11); ctx.fill();
      ctx.fillStyle = '#1e272e';
      ctx.beginPath(); ctx.ellipse(8, -21, 3, 5, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1e1e1e';
      ctx.beginPath(); ctx.arc(20.5, -14.5, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(14, -18.5, 1.4, 0, Math.PI * 2); ctx.fill();

    } else if (this.breed === 'golden') {
      const col = this.isShiny ? this.shinyColor : '#f39c12';
      ctx.fillStyle = col; ctx.fillRect(-11 - legSwing, -3, 4.5, 10); ctx.fillRect(6 + legSwing, -3, 4.5, 10);
      const wag = Math.sin(this.animPhase * 2) * 4;
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-15, -9); ctx.quadraticCurveTo(-23, -16 + wag, -26, -11); ctx.lineWidth = 4; ctx.strokeStyle = col; ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(-1, -9, 15, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(11, -16, 7.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d35400'; ctx.beginPath(); ctx.ellipse(8, -13, 3, 6, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(11, -15); ctx.lineTo(19, -13); ctx.lineTo(13, -10); ctx.fill();
      ctx.fillStyle = '#1e1e1e'; ctx.beginPath(); ctx.arc(19.5, -13.5, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1e1e1e'; ctx.beginPath(); ctx.arc(13, -18, 1.4, 0, Math.PI * 2); ctx.fill();

    } else if (this.breed === 'husky') {
      const col = this.isShiny ? this.shinyColor : '#636e72';
      ctx.fillStyle = col; ctx.fillRect(-11 - legSwing, -3, 4, 10); ctx.fillRect(6 + legSwing, -3, 4, 10);
      const wag = Math.sin(this.animPhase * 2) * 3;
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(-15, -9); ctx.quadraticCurveTo(-24, -17 + wag, -27, -10); ctx.lineWidth = 5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(-1, -10, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(10, -17, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2d3436'; ctx.beginPath(); ctx.moveTo(6, -21); ctx.lineTo(10, -27); ctx.lineTo(13, -18); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(10, -16); ctx.lineTo(18, -14); ctx.lineTo(12, -11); ctx.fill();
      ctx.fillStyle = '#1e1e1e'; ctx.beginPath(); ctx.arc(18.5, -14.5, 1.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0984e3'; ctx.beginPath(); ctx.arc(13, -18, 1.4, 0, Math.PI * 2); ctx.fill();

    } else if (this.breed === 'shiba') {
      const col = this.isShiny ? this.shinyColor : '#d35400';
      ctx.fillStyle = col; ctx.fillRect(-10 - legSwing, -2, 4, 9); ctx.fillRect(6 + legSwing, -2, 4, 9);
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(-14, -15, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, -9, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(0, -6, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(10, -16, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(6, -21); ctx.lineTo(10, -28); ctx.lineTo(14, -18); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(10, -15); ctx.lineTo(17, -13); ctx.lineTo(12, -10); ctx.fill();
      ctx.fillStyle = '#1e1e1e'; ctx.beginPath(); ctx.arc(17.5, -13.5, 1.5, 0, Math.PI * 2); ctx.fill();

    } else if (this.breed === 'shepherd') {
      const col = this.isShiny ? this.shinyColor : '#d35400';
      ctx.fillStyle = '#2c3e50'; ctx.fillRect(-12 - legSwing, -3, 4, 10); ctx.fillRect(7 + legSwing, -3, 4, 10);
      const wag = Math.sin(this.animPhase * 2) * 3;
      ctx.fillStyle = '#2c3e50'; ctx.beginPath(); ctx.moveTo(-15, -9); ctx.quadraticCurveTo(-22, -14 + wag, -24, -5); ctx.lineWidth = 3; ctx.strokeStyle = '#2c3e50'; ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(-1, -10, 15, 8.5, -0.1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2c3e50'; ctx.beginPath(); ctx.ellipse(-1, -12, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(11, -17, 7.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2c3e50'; ctx.beginPath(); ctx.moveTo(7, -21); ctx.lineTo(11, -28); ctx.lineTo(14, -18); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(11, -16); ctx.lineTo(19, -13); ctx.lineTo(13, -10); ctx.fill();
      ctx.fillStyle = '#1e1e1e'; ctx.beginPath(); ctx.arc(19.5, -13.5, 1.6, 0, Math.PI * 2); ctx.fill();

    } else if (this.breed === 'beagle') {
      const col = this.isShiny ? this.shinyColor : '#e67e22';
      ctx.fillStyle = col; ctx.fillRect(-10 - legSwing, -2, 4, 8); ctx.fillRect(5 + legSwing, -2, 4, 8);
      ctx.fillStyle = '#fff'; ctx.fillRect(-10 - legSwing, 4, 4, 3); ctx.fillRect(5 + legSwing, 4, 4, 3);
      const wag = Math.sin(this.animPhase * 2) * 4;
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-14, -9); ctx.quadraticCurveTo(-20, -18 + wag, -18, -22); ctx.lineWidth = 3; ctx.strokeStyle = col; ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(0, -8, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(7, -7, 6, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(10, -15, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#795548'; ctx.beginPath(); ctx.ellipse(7, -12, 3.5, 7, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(10, -14); ctx.lineTo(17, -12); ctx.lineTo(12, -9); ctx.fill();
      ctx.fillStyle = '#1e1e1e'; ctx.beginPath(); ctx.arc(17.5, -12.5, 1.5, 0, Math.PI * 2); ctx.fill();

    } else if (this.breed === 'labrador') {
      // Labrador Retriever: warm golden/fox-red coat (or shiny color), thick otter tail, floppy ears
      const col = this.isShiny ? this.shinyColor : '#e5a93c';
      const earCol = this.isShiny ? this.shinyColor : '#c78924';
      ctx.fillStyle = col;
      ctx.fillRect(-11 - legSwing, -3, 4.5, 9.5);
      ctx.fillRect(6 + legSwing, -3, 4.5, 9.5);
      const wag = Math.sin(this.animPhase * 2.2) * 3.5;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(-14, -9);
      ctx.quadraticCurveTo(-22, -13 + wag, -25, -9 + wag * 0.5);
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.strokeStyle = col;
      ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(-1, -9, 14.5, 8.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(11, -16.5, 7.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = earCol;
      ctx.beginPath(); ctx.ellipse(8.5, -13.5, 3.2, 6.2, 0.28, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.ellipse(17, -14, 5.2, 3.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1e1e1e';
      ctx.beginPath(); ctx.arc(21.2, -15, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(14, -18.5, 1.5, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();

    if (state.showNameTags) {
      const entry = this.getRosterEntry();
      const label = entry ? entry.name : (BREED_LABELS[this.breed] || this.breed);
      const tagY = -36 - bounce;

      ctx.font = '700 11px "Segoe UI", Tahoma, Geneva, Verdana, sans-serif';
      const textWidth = ctx.measureText(label).width;
      const padX = 7;
      const boxW = textWidth + padX * 2;
      const boxH = 18;

      ctx.fillStyle = 'rgba(13, 11, 26, 0.78)';
      ctx.beginPath();
      ctx.roundRect(-boxW / 2, tagY - boxH / 2, boxW, boxH, 7);
      ctx.fill();

      ctx.strokeStyle = this.isShiny ? 'rgba(255, 234, 167, 0.85)' : 'rgba(162, 155, 254, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = this.isShiny ? '#ffeaa7' : '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, tagY + 0.5);
    }

    ctx.restore();
  }
}

function triggerPerkDraft() {
  state.isDraftingPerk = true;
  sfx.shiny();
  const modal = document.getElementById('perkModal');
  const choicesContainer = document.getElementById('perkChoices');
  choicesContainer.innerHTML = '';
  choicesContainer.style.display = 'flex';
  choicesContainer.style.flexDirection = 'column';
  choicesContainer.style.gap = '10px';
  choicesContainer.style.marginTop = '10px';

  const shuffled = [...PERK_POOL].sort(() => 0.5 - Math.random());
  const options = shuffled.slice(0, 3);

  options.forEach(perk => {
    const btn = document.createElement('button');
    btn.className = 'perk-choice-btn';
    
    let rarityColor = '#a29bfe';
    if (perk.rarity === 'Rare') rarityColor = '#0984e3';
    if (perk.rarity === 'Legendary') rarityColor = '#f1c40f';
    if (perk.rarity === 'Mythic') rarityColor = '#e84393';

    btn.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
        <span style="font-weight: 800; font-size: 1rem; color: #fff;">${perk.name}</span>
        <span style="font-size: 0.75rem; font-weight: 700; color: ${rarityColor}; background: rgba(0,0,0,0.3); padding: 2px 8px; border-radius: 6px;">[${perk.rarity}]</span>
      </div>
      <div style="font-size: 0.8rem; color: #b2bec3; margin-top: 2px;">${perk.desc}</div>
    `;
    
    btn.addEventListener('click', () => {
      state.perks.push(perk);
      state.isDraftingPerk = false;
      modal.style.display = 'none';
      sfx.upgrade();
      updateUI();
      saveGame();
    });

    choicesContainer.appendChild(btn);
  });

  modal.style.display = 'flex';
}

function drawIsometricTile(gx, gy) {
  const top = gridToScreen(gx, gy);
  const right = gridToScreen(gx + 1, gy);
  const bottom = gridToScreen(gx + 1, gy + 1);
  const left = gridToScreen(gx, gy + 1);

  const isChecker = (gx + gy) % 2 === 0;

  ctx.beginPath();
  ctx.moveTo(top.x, top.y);
  ctx.lineTo(right.x, right.y);
  ctx.lineTo(bottom.x, bottom.y);
  ctx.lineTo(left.x, left.y);
  ctx.closePath();
  ctx.fillStyle = isChecker ? '#4cd137' : '#44bd32';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawDoghouse() {
  const pos = gridToScreen(1.2, 1.2);
  ctx.save();
  ctx.translate(pos.x, pos.y);

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 6, 28, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#8d5524';
  ctx.fillRect(-20, -24, 40, 26);

  ctx.fillStyle = '#171033';
  ctx.beginPath();
  ctx.arc(0, -10, 10, Math.PI, 0);
  ctx.lineTo(10, 2);
  ctx.lineTo(-10, 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#40739e';
  ctx.beginPath();
  ctx.moveTo(-26, -22);
  ctx.lineTo(0, -40);
  ctx.lineTo(26, -22);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawTree() {
  const pos = gridToScreen(5.8, 1.2);
  ctx.save();
  ctx.translate(pos.x, pos.y);

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 16, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#795548';
  ctx.fillRect(-4, -18, 8, 20);

  ctx.fillStyle = '#27ae60';
  ctx.beginPath();
  ctx.arc(0, -26, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#2ecc71';
  ctx.beginPath();
  ctx.arc(-6, -32, 12, 0, Math.PI * 2);
  ctx.arc(6, -32, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawCustomTree(gx, gy) {
  const pos = gridToScreen(gx, gy);
  ctx.save();
  ctx.translate(pos.x, pos.y);

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 16, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#795548';
  ctx.fillRect(-4, -18, 8, 20);

  ctx.fillStyle = '#27ae60';
  ctx.beginPath();
  ctx.arc(0, -26, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#2ecc71';
  ctx.beginPath();
  ctx.arc(-6, -32, 12, 0, Math.PI * 2);
  ctx.arc(6, -32, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawFlowerPatch(gx, gy) {
  const pos = gridToScreen(gx, gy);
  ctx.save();
  ctx.translate(pos.x, pos.y);

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 3, 15, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#8b5a2b';
  ctx.beginPath();
  ctx.ellipse(0, 1, 13, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5c3a21';
  ctx.lineWidth = 1;
  ctx.stroke();

  const flowerData = [
    { x: -5, y: -2, c: '#fd79a8', center: '#ffeaa7' },
    { x: 4, y: -4, c: '#ff7675', center: '#fab1a0' },
    { x: -2, y: -6, c: '#a29bfe', center: '#dfe6e9' },
    { x: 6, y: -1, c: '#ffeaa7', center: '#fdcb6e' },
    { x: 1, y: -2, c: '#74b9ff', center: '#81ecec' }
  ];

  flowerData.forEach(f => {
    ctx.fillStyle = '#00b894';
    ctx.fillRect(f.x - 1, f.y, 2, 4);

    ctx.fillStyle = f.c;
    ctx.beginPath();
    ctx.arc(f.x, f.y - 1, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = f.center;
    ctx.beginPath();
    ctx.arc(f.x, f.y - 1, 1.5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

let fountainAnimPhase = 0;

function drawWaterFountain(gx, gy, dt) {
  const pos = gridToScreen(gx, gy);
  fountainAnimPhase += dt * 5;
  ctx.save();
  ctx.translate(pos.x, pos.y);

  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 18, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#b2bec3';
  ctx.strokeStyle = '#636e72';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#0984e3';
  ctx.beginPath();
  ctx.ellipse(0, -1, 13, 6.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1;
  const rippleRadius = 3 + (Math.sin(fountainAnimPhase) + 1) * 4;
  ctx.beginPath();
  ctx.ellipse(0, -1, rippleRadius, rippleRadius * 0.5, 0, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#dfe6e9';
  ctx.fillRect(-3, -22, 6, 22);
  ctx.strokeStyle = '#b2bec3';
  ctx.strokeRect(-3, -22, 6, 22);

  ctx.fillStyle = '#b2bec3';
  ctx.beginPath();
  ctx.ellipse(0, -18, 9, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#74b9ff';
  ctx.beginPath();
  ctx.ellipse(0, -18.5, 7, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#dfe6e9';
  ctx.beginPath();
  ctx.arc(0, -26, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  const jetHeight = Math.abs(Math.sin(fountainAnimPhase * 2)) * 5;
  ctx.beginPath();
  ctx.arc(0, -29 - jetHeight, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(116, 185, 255, 0.8)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-2, -26);
  ctx.quadraticCurveTo(-7, -22, -9, -18);
  ctx.moveTo(2, -26);
  ctx.quadraticCurveTo(7, -22, 9, -18);
  ctx.stroke();

  ctx.restore();
}

function drawMushroomCluster(m) {
  const pos = gridToScreen(m.gx, m.gy);
  ctx.save();
  ctx.translate(pos.x, pos.y);

  const grad = ctx.createRadialGradient(0, -6, 2, 0, -6, 24);
  grad.addColorStop(0, m.glow);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, -6, 24, 0, Math.PI * 2);
  ctx.fill();

  const offsets = [
    { x: -7, y: 2, s: 0.75 },
    { x: 7, y: 3, s: 0.7 },
    { x: 0, y: 0, s: 1.0 }
  ];

  offsets.forEach(o => {
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.scale(o.s, o.s);

    ctx.fillStyle = '#f5f6fa';
    ctx.fillRect(-2.5, -10, 5, 10);

    ctx.fillStyle = m.color;
    ctx.beginPath();
    ctx.arc(0, -10, 8, Math.PI, 0);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  });

  ctx.restore();
}

function drawBoneSprite(x, y, isMagic) {
  ctx.save();
  ctx.translate(x, y);

  if (isMagic) {
    ctx.shadowColor = '#ffeaa7';
    ctx.shadowBlur = 12;
  }

  ctx.fillStyle = isMagic ? '#ffeaa7' : '#f5f6fa';
  ctx.strokeStyle = isMagic ? '#f39c12' : '#b2bec3';
  ctx.lineWidth = 1.5;

  ctx.fillRect(-7, -2.5, 14, 5);
  const knobs = [
    [-7, -3], [-7, 3],
    [7, -3], [7, 3]
  ];
  knobs.forEach(([kx, ky]) => {
    ctx.beginPath();
    ctx.arc(kx, ky, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

function drawTennisBall() {
  if (!state.hasTennisBall) return;
  const pos = gridToScreen(tennisBall.gx, tennisBall.gy);
  ctx.save();
  ctx.translate(pos.x, pos.y);

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 7, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  const bounceOffset = Math.abs(Math.sin(tennisBall.bouncePhase * 6)) * 8;
  ctx.translate(0, -bounceOffset);

  ctx.fillStyle = '#ccff00';
  ctx.strokeStyle = '#739900';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, -4, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(-2, -6, 4, 0.2, Math.PI * 0.8);
  ctx.stroke();

  ctx.restore();
}

function drawFrisbee() {
  if (!state.hasFrisbee) return;
  const pos = gridToScreen(frisbee.gx, frisbee.gy);
  ctx.save();
  ctx.translate(pos.x, pos.y);

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 9, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#0984e3';
  ctx.strokeStyle = '#00cec9';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, -2, 11, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#74b9ff';
  ctx.beginPath();
  ctx.ellipse(0, -3, 6, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawRedBone() {
  if (!state.hasRedBone) return;
  const pos = gridToScreen(redBone.gx, redBone.gy);
  ctx.save();
  ctx.translate(pos.x, pos.y);

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 10, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ff7675';
  ctx.strokeStyle = '#d63031';
  ctx.lineWidth = 1.5;

  ctx.fillRect(-8, -3, 16, 6);
  [[ -8, -3.5 ], [ -8, 3.5 ], [ 8, -3.5 ], [ 8, 3.5 ]].forEach(([kx, ky]) => {
    ctx.beginPath();
    ctx.arc(kx, ky, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  ctx.restore();
}

function drawDuck() {
  if (!state.hasDuck) return;
  const pos = gridToScreen(duck.gx, duck.gy);
  ctx.save();
  ctx.translate(pos.x, pos.y);

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 9, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ffeaa7';
  ctx.strokeStyle = '#fdcb6e';
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.ellipse(0, -3, 8, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(5, -10, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#e17055';
  ctx.beginPath();
  ctx.ellipse(9, -9, 3.5, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#2d3436';
  ctx.beginPath();
  ctx.arc(6, -11, 1, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function recruitDog(breed) {
  initAudio();
  if (getTotalDogs() >= MAX_DOGS) return;
  const normBreed = normalizeBreedKey(breed);
  const cost = state.costs[normBreed];
  if (state.bones >= cost) {
    state.bones -= cost;
    state.costs[normBreed] = Math.floor(cost * BREED_CONFIG[normBreed].costMult);
    
    const isShiny = Math.random() < (1 / 8000);
    const shinyPalettes = ['#f1c40f', '#e67e22', '#e84393', '#00cec9', '#fd79a8'];
    const chosenColor = isShiny ? shinyPalettes[Math.floor(Math.random() * shinyPalettes.length)] : null;

    const entry = createRosterEntry(normBreed, isShiny, chosenColor);
    state.roster.push(entry);
    syncBreedCountsFromRoster();
    dogs.push(new Dog(1.5, 1.5, entry.id, normBreed, isShiny, chosenColor));

    if (isShiny) {
      sfx.shiny();
    } else {
      sfx.upgrade();
    }

    updateUI();
    renderRosterTab();
    saveGame();
  }
}

document.getElementById('btnSummonAussie').addEventListener('click', () => recruitDog('aussie'));
document.getElementById('btnSummonBeagle').addEventListener('click', () => recruitDog('beagle'));
document.getElementById('btnSummonCollie').addEventListener('click', () => recruitDog('collie'));
document.getElementById('btnSummonHusky').addEventListener('click', () => recruitDog('husky'));
document.getElementById('btnSummonGolden').addEventListener('click', () => recruitDog('golden'));
document.getElementById('btnSummonShepherd').addEventListener('click', () => recruitDog('shepherd'));
document.getElementById('btnSummonShiba').addEventListener('click', () => recruitDog('shiba'));
document.getElementById('btnSummonLabrador').addEventListener('click', () => recruitDog('labrador'));

document.getElementById('btnToyBones').addEventListener('click', () => {
  initAudio();
  if (state.bones >= state.costs.toyBones) {
    state.bones -= state.costs.toyBones;
    state.digPower += 1;
    state.costs.toyBones = Math.floor(state.costs.toyBones * 1.55);
    state.hasTennisBall = true;
    sfx.upgrade();
    updateUI();
    saveGame();
  }
});

document.getElementById('btnToySpeed').addEventListener('click', () => {
  initAudio();
  if (state.bones >= state.costs.toySpeed) {
    state.bones -= state.costs.toySpeed;
    state.speedMultiplier *= 1.2;
    state.costs.toySpeed = Math.floor(state.costs.toySpeed * 1.65);
    state.hasFrisbee = true;
    sfx.upgrade();
    updateUI();
    saveGame();
  }
});

document.getElementById('btnToyDig').addEventListener('click', () => {
  initAudio();
  if (state.bones >= state.costs.toyDig) {
    state.bones -= state.costs.toyDig;
    state.digPower += 2;
    state.costs.toyDig = Math.floor(state.costs.toyDig * 1.60);
    state.hasRedBone = true;
    sfx.upgrade();
    updateUI();
    saveGame();
  }
});

document.getElementById('btnToyIdle').addEventListener('click', () => {
  initAudio();
  if (state.bones >= state.costs.toyIdle) {
    state.bones -= state.costs.toyIdle;
    state.idleMultiplier = Math.min(0.95, state.idleMultiplier + 0.1);
    state.costs.toyIdle = Math.floor(state.costs.toyIdle * 1.70);
    state.hasDuck = true;
    sfx.upgrade();
    updateUI();
    saveGame();
  }
});

document.getElementById('btnTreatKong').addEventListener('click', () => {
  initAudio();
  if (state.bones >= state.costs.treatKong) {
    state.bones -= state.costs.treatKong;
    state.kongTimer = 15;
    state.costs.treatKong = Math.floor(state.costs.treatKong * 1.6);
    sfx.treat();
    updateUI();
    saveGame();
  }
});

document.getElementById('btnTreatBacon').addEventListener('click', () => {
  initAudio();
  if (state.bones >= state.costs.treatBacon) {
    state.bones -= state.costs.treatBacon;
    state.baconTimer = 20;
    state.costs.treatBacon = Math.floor(state.costs.treatBacon * 1.6);
    sfx.treat();
    updateUI();
    saveGame();
  }
});

document.getElementById('btnTreatFeast').addEventListener('click', () => {
  initAudio();
  if (state.bones >= state.costs.treatFeast) {
    state.bones -= state.costs.treatFeast;
    const feastPayout = Math.max(10, Math.floor(getAverageBonesPerDig() * Math.max(1, state.roster.length) * 2));
    state.bones += feastPayout;
    state.lifetimeBones += feastPayout;
    state.costs.treatFeast = Math.floor(state.costs.treatFeast * 1.6);
    state.feastAnimTimer = 1.5;
    sfx.treat();
    updateUI();
    saveGame();
  }
});

document.getElementById('btnTreatCup').addEventListener('click', () => {
  initAudio();
  if (state.bones >= state.costs.treatCup) {
    state.bones -= state.costs.treatCup;
    state.pupCupTimer = 25;
    state.costs.treatCup = Math.floor(state.costs.treatCup * 1.6);
    sfx.treat();
    updateUI();
    saveGame();
  }
});

function updateUI() {
  document.getElementById('boneCount').textContent = Math.floor(state.bones).toLocaleString();
  document.getElementById('magicBoneCount').textContent = Math.floor(state.magicBones).toLocaleString();
  
  const total = getTotalDogs();
  const atDogCap = total >= MAX_DOGS;
  document.getElementById('miniDogs').textContent = `${total}/${MAX_DOGS}`;

  const nameTagLabel = document.getElementById('nameTagSettingLabel');
  if (nameTagLabel) {
    nameTagLabel.textContent = state.showNameTags ? 'ON' : 'OFF';
  }

  Object.keys(BREED_CONFIG).forEach(breed => {
    const capBreed = breed.charAt(0).toUpperCase() + breed.slice(1);
    const el = document.getElementById(`count${capBreed}`);
    if (el) {
      const breedTotal = state.roster.filter(d => d.breed === breed).length;
      el.textContent = breedTotal;
    }
    const costEl = document.getElementById(`cost${capBreed}`);
    if (costEl) {
      costEl.textContent = atDogCap ? `Park Full (${MAX_DOGS}/${MAX_DOGS})` : `${state.costs[breed].toLocaleString()} 🦴`;
    }
    const btnEl = document.getElementById(`btnSummon${capBreed}`);
    if (btnEl) {
      btnEl.disabled = atDogCap || state.bones < state.costs[breed];
    }
  });

  document.getElementById('perkCountDisplay').textContent = state.perks.length;
  
  const perkListContainer = document.getElementById('perkListContainer');
  if (perkListContainer) {
    perkListContainer.innerHTML = '';
    state.perks.forEach(p => {
      const div = document.createElement('div');
      div.className = 'shop-card';
      div.style.padding = '8px 12px';
      div.innerHTML = `
        <div class="shop-info">
          <h4 style="color: #ffeaa7; font-size: 0.85rem;">${p.name} <span style="font-size:0.7rem; color:#a29bfe;">[${p.rarity}]</span></h4>
          <p style="font-size:0.7rem; margin:0;">${p.desc}</p>
        </div>
      `;
      perkListContainer.appendChild(div);
    });
  }

  const treeCount = state.placedDecorations ? state.placedDecorations.filter(d => d.type === 'tree').length : 0;
  const flowerCount = state.placedDecorations ? state.placedDecorations.filter(d => d.type === 'flowers').length : 0;
  const fountainCount = state.placedDecorations ? state.placedDecorations.filter(d => d.type === 'fountain').length : 0;

  const ownedTree = state.decorInventory.tree || 0;
  const ownedFlowers = state.decorInventory.flowers || 0;
  const ownedFountain = state.decorInventory.fountain || 0;

  document.getElementById('ownedDecorTree').textContent = ownedTree;
  document.getElementById('countDecorTree').textContent = treeCount;

  document.getElementById('ownedDecorFlowers').textContent = ownedFlowers;
  document.getElementById('countDecorFlowers').textContent = flowerCount;

  document.getElementById('ownedDecorFountain').textContent = ownedFountain;
  document.getElementById('countDecorFountain').textContent = fountainCount;

  const btnBuyDecorTree = document.getElementById('btnBuyDecorTree');
  if (btnBuyDecorTree) {
    const atMaxTree = ownedTree >= 3;
    btnBuyDecorTree.disabled = state.magicBones < 500 || atMaxTree;
    if (atMaxTree) {
      btnBuyDecorTree.querySelector('.btn-name').textContent = 'Max Owned';
    } else {
      btnBuyDecorTree.querySelector('.btn-name').textContent = 'Buy Tree';
    }
  }

  const btnPlaceDecorTree = document.getElementById('btnPlaceDecorTree');
  if (btnPlaceDecorTree) {
    const unplacedTree = ownedTree - treeCount;
    if (treeCount >= 3) {
      btnPlaceDecorTree.querySelector('.btn-name').textContent = 'Max Placed';
      btnPlaceDecorTree.disabled = true;
    } else if (unplacedTree <= 0) {
      btnPlaceDecorTree.querySelector('.btn-name').textContent = 'Place';
      btnPlaceDecorTree.disabled = true;
    } else {
      btnPlaceDecorTree.querySelector('.btn-name').textContent = 'Place';
      btnPlaceDecorTree.disabled = false;
    }
  }

  const btnBuyDecorFlowers = document.getElementById('btnBuyDecorFlowers');
  if (btnBuyDecorFlowers) {
    const atMaxFlowers = ownedFlowers >= 5;
    btnBuyDecorFlowers.disabled = state.magicBones < 250 || atMaxFlowers;
    if (atMaxFlowers) {
      btnBuyDecorFlowers.querySelector('.btn-name').textContent = 'Max Owned';
    } else {
      btnBuyDecorFlowers.querySelector('.btn-name').textContent = 'Buy Flowers';
    }
  }

  const btnPlaceDecorFlowers = document.getElementById('btnPlaceDecorFlowers');
  if (btnPlaceDecorFlowers) {
    const unplacedFlowers = ownedFlowers - flowerCount;
    if (flowerCount >= 5) {
      btnPlaceDecorFlowers.querySelector('.btn-name').textContent = 'Max Placed';
      btnPlaceDecorFlowers.disabled = true;
    } else if (unplacedFlowers <= 0) {
      btnPlaceDecorFlowers.querySelector('.btn-name').textContent = 'Place';
      btnPlaceDecorFlowers.disabled = true;
    } else {
      btnPlaceDecorFlowers.querySelector('.btn-name').textContent = 'Place';
      btnPlaceDecorFlowers.disabled = false;
    }
  }

  const btnBuyDecorFountain = document.getElementById('btnBuyDecorFountain');
  if (btnBuyDecorFountain) {
    const atMaxFountain = ownedFountain >= 2;
    btnBuyDecorFountain.disabled = state.magicBones < 1000 || atMaxFountain;
    if (atMaxFountain) {
      btnBuyDecorFountain.querySelector('.btn-name').textContent = 'Max Owned';
    } else {
      btnBuyDecorFountain.querySelector('.btn-name').textContent = 'Buy Fountain';
    }
  }

  const btnPlaceDecorFountain = document.getElementById('btnPlaceDecorFountain');
  if (btnPlaceDecorFountain) {
    const unplacedFountain = ownedFountain - fountainCount;
    if (fountainCount >= 2) {
      btnPlaceDecorFountain.querySelector('.btn-name').textContent = 'Max Placed';
      btnPlaceDecorFountain.disabled = true;
    } else if (unplacedFountain <= 0) {
      btnPlaceDecorFountain.querySelector('.btn-name').textContent = 'Place';
      btnPlaceDecorFountain.disabled = true;
    } else {
      btnPlaceDecorFountain.querySelector('.btn-name').textContent = 'Place';
      btnPlaceDecorFountain.disabled = false;
    }
  }

  document.getElementById('bpsCount').textContent = `${getDigMultiplier().toFixed(1)}x/dig`;

  document.getElementById('costToyBones').textContent = `${state.costs.toyBones.toLocaleString()} 🦴`;
  document.getElementById('costToySpeed').textContent = `${state.costs.toySpeed.toLocaleString()} 🦴`;
  document.getElementById('costToyDig').textContent = `${state.costs.toyDig.toLocaleString()} 🦴`;
  document.getElementById('costToyIdle').textContent = `${state.costs.toyIdle.toLocaleString()} 🦴`;

  document.getElementById('costTreatKong').textContent = `${state.costs.treatKong.toLocaleString()} 🦴`;
  document.getElementById('costTreatBacon').textContent = `${state.costs.treatBacon.toLocaleString()} 🦴`;
  document.getElementById('costTreatFeast').textContent = `${state.costs.treatFeast.toLocaleString()} 🦴`;
  document.getElementById('costTreatCup').textContent = `${state.costs.treatCup.toLocaleString()} 🦴`;

  document.getElementById('statDigPower').textContent = state.digPower;
  document.getElementById('statSpeed').textContent = `${getDigMultiplier().toFixed(1)}x`;
  document.getElementById('statChance').textContent = `${Math.round((state.magicChance + getPerkMultipliers().magicBonus) * 100)}%`;
  const lifetimeEl = document.getElementById('statLifetimeBones');
  if (lifetimeEl) {
    lifetimeEl.textContent = Math.floor(state.lifetimeBones).toLocaleString();
  }

  document.getElementById('btnToyBones').disabled = state.bones < state.costs.toyBones;
  document.getElementById('btnToySpeed').disabled = state.bones < state.costs.toySpeed;
  document.getElementById('btnToyDig').disabled = state.bones < state.costs.toyDig;
  document.getElementById('btnToyIdle').disabled = state.bones < state.costs.toyIdle;

  document.getElementById('btnTreatKong').disabled = state.bones < state.costs.treatKong;
  document.getElementById('btnTreatBacon').disabled = state.bones < state.costs.treatBacon;
  document.getElementById('btnTreatFeast').disabled = state.bones < state.costs.treatFeast;
  document.getElementById('btnTreatCup').disabled = state.bones < state.costs.treatCup;
}

loadGame();

let lastTime = performance.now();
let lastRosterUiRefresh = 0;
function loop(now) {
  try {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    if (state.kongTimer > 0) state.kongTimer = Math.max(0, state.kongTimer - dt);
    if (state.baconTimer > 0) state.baconTimer = Math.max(0, state.baconTimer - dt);
    if (state.pupCupTimer > 0) state.pupCupTimer = Math.max(0, state.pupCupTimer - dt);
    if (state.feastAnimTimer > 0) state.feastAnimTimer = Math.max(0, state.feastAnimTimer - dt);

    if (state.hasTennisBall) {
      tennisBall.bouncePhase += dt;
      if (tennisBall.isRolling) {
        tennisBall.gx += (tennisBall.targetGx - tennisBall.gx) * (dt * 5);
        tennisBall.gy += (tennisBall.targetGy - tennisBall.gy) * (dt * 5);
        if (Math.hypot(tennisBall.targetGx - tennisBall.gx, tennisBall.targetGy - tennisBall.gy) < 0.05) {
          tennisBall.isRolling = false;
        }
      } else {
        tennisBall.timer -= dt;
        if (tennisBall.timer <= 0 && dogs.length > 0) {
          tennisBall.timer = 8.0 + Math.random() * 6.0;
          const walker = dogs[Math.floor(Math.random() * dogs.length)];
          walker.targetGx = tennisBall.gx;
          walker.targetGy = tennisBall.gy;
          walker.state = 'WALK';
          walker.onReachToy = () => {
            sfx.squeak();
            tennisBall.isRolling = true;
            tennisBall.targetGx = Math.max(0.7, Math.min(GRID_SIZE - 0.7, tennisBall.gx + (Math.random() - 0.5) * 3.5));
            tennisBall.targetGy = Math.max(0.7, Math.min(GRID_SIZE - 0.7, tennisBall.gy + (Math.random() - 0.5) * 3.5));
          };
        }
      }
    }

    if (state.hasFrisbee) {
      if (frisbee.isMoving) {
        frisbee.gx += (frisbee.targetGx - frisbee.gx) * (dt * 5);
        frisbee.gy += (frisbee.targetGy - frisbee.gy) * (dt * 5);
        if (Math.hypot(frisbee.targetGx - frisbee.gx, frisbee.targetGy - frisbee.gy) < 0.05) {
          frisbee.isMoving = false;
        }
      } else {
        frisbee.timer -= dt;
        if (frisbee.timer <= 0 && dogs.length > 0) {
          frisbee.timer = 10.0 + Math.random() * 8.0;
          const walker = dogs[Math.floor(Math.random() * dogs.length)];
          walker.targetGx = frisbee.gx;
          walker.targetGy = frisbee.gy;
          walker.state = 'WALK';
          walker.onReachToy = () => {
            sfx.shiny();
            frisbee.isMoving = true;
            frisbee.targetGx = Math.max(0.7, Math.min(GRID_SIZE - 0.7, frisbee.gx + (Math.random() - 0.5) * 3.5));
            frisbee.targetGy = Math.max(0.7, Math.min(GRID_SIZE - 0.7, frisbee.gy + (Math.random() - 0.5) * 3.5));
          };
        }
      }
    }

    if (state.hasRedBone) {
      if (redBone.isMoved) {
        redBone.gx += (redBone.targetGx - redBone.gx) * (dt * 4);
        redBone.gy += (redBone.targetGy - redBone.gy) * (dt * 4);
        if (Math.hypot(redBone.targetGx - redBone.gx, redBone.targetGy - redBone.gy) < 0.05) {
          redBone.isMoved = false;
        }
      } else {
        redBone.timer -= dt;
        if (redBone.timer <= 0 && dogs.length > 0) {
          redBone.timer = 11.0 + Math.random() * 7.0;
          const walker = dogs[Math.floor(Math.random() * dogs.length)];
          walker.targetGx = redBone.gx;
          walker.targetGy = redBone.gy;
          walker.state = 'WALK';
          walker.onReachToy = () => {
            sfx.thud();
            redBone.isMoved = true;
            redBone.targetGx = Math.max(0.7, Math.min(GRID_SIZE - 0.7, redBone.gx + (Math.random() - 0.5) * 2.5));
            redBone.targetGy = Math.max(0.7, Math.min(GRID_SIZE - 0.7, redBone.gy + (Math.random() - 0.5) * 2.5));
          };
        }
      }
    }

    if (state.hasDuck) {
      if (duck.isMoved) {
        duck.gx += (duck.targetGx - duck.gx) * (dt * 4);
        duck.gy += (duck.targetGy - duck.gy) * (dt * 4);
        if (Math.hypot(duck.targetGx - duck.gx, duck.targetGy - duck.gy) < 0.05) {
          duck.isMoved = false;
        }
      } else {
        duck.timer -= dt;
        if (duck.timer <= 0 && dogs.length > 0) {
          duck.timer = 9.0 + Math.random() * 6.0;
          const walker = dogs[Math.floor(Math.random() * dogs.length)];
          walker.targetGx = duck.gx;
          walker.targetGy = duck.gy;
          walker.state = 'WALK';
          walker.onReachToy = () => {
            sfx.quack();
            duck.isMoved = true;
            duck.targetGx = Math.max(0.7, Math.min(GRID_SIZE - 0.7, duck.gx + (Math.random() - 0.5) * 2.5));
            duck.targetGy = Math.max(0.7, Math.min(GRID_SIZE - 0.7, duck.gy + (Math.random() - 0.5) * 2.5));
          };
        }
      }
    }

    // Bones are awarded when digs complete and bones are collected—no side-clock tick here.

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let gx = 0; gx < GRID_SIZE; gx++) {
      for (let gy = 0; gy < GRID_SIZE; gy++) {
        drawIsometricTile(gx, gy);
      }
    }

    const renderables = [];
    renderables.push({ sortY: gridToScreen(1.2, 1.2).y, draw: drawDoghouse });
    renderables.push({ sortY: gridToScreen(5.8, 1.2).y, draw: drawTree });

    if (state.placedDecorations) {
      state.placedDecorations.forEach(dec => {
        if (dec.type === 'tree') {
          renderables.push({
            sortY: gridToScreen(dec.gx, dec.gy).y,
            draw: () => drawCustomTree(dec.gx, dec.gy)
          });
        } else if (dec.type === 'flowers') {
          renderables.push({
            sortY: gridToScreen(dec.gx, dec.gy).y,
            draw: () => drawFlowerPatch(dec.gx, dec.gy)
          });
        } else if (dec.type === 'fountain') {
          renderables.push({
            sortY: gridToScreen(dec.gx, dec.gy).y,
            draw: () => drawWaterFountain(dec.gx, dec.gy, dt)
          });
        }
      });
    }

    if (state.hasTennisBall) {
      renderables.push({ sortY: gridToScreen(tennisBall.gx, tennisBall.gy).y, draw: drawTennisBall });
    }
    if (state.hasFrisbee) {
      renderables.push({ sortY: gridToScreen(frisbee.gx, frisbee.gy).y, draw: drawFrisbee });
    }
    if (state.hasRedBone) {
      renderables.push({ sortY: gridToScreen(redBone.gx, redBone.gy).y, draw: drawRedBone });
    }
    if (state.hasDuck) {
      renderables.push({ sortY: gridToScreen(duck.gx, duck.gy).y, draw: drawDuck });
    }

    mushrooms.forEach(m => {
      renderables.push({
        sortY: gridToScreen(m.gx, m.gy).y,
        draw: () => drawMushroomCluster(m)
      });
    });

    dogs.forEach(dog => {
      dog.update(dt);
      renderables.push({
        sortY: gridToScreen(dog.gx, dog.gy).y,
        draw: () => dog.draw(ctx)
      });
    });

    renderables.sort((a, b) => a.sortY - b.sortY);
    renderables.forEach(item => {
      if (item && typeof item.draw === 'function') {
        item.draw();
      }
    });

    if (holdTimer) {
      const elapsed = performance.now() - holdStartTime;
      const progress = Math.min(1, elapsed / HOLD_DURATION);
      const rect = canvas.getBoundingClientRect();
      const hx = holdPosition.x - rect.left;
      const hy = holdPosition.y - rect.top;

      ctx.save();
      ctx.strokeStyle = 'rgba(255, 234, 167, 0.85)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(hx, hy, 26, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 234, 167, 0.25)';
      ctx.beginPath();
      ctx.arc(hx, hy, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (let i = droppedBones.length - 1; i >= 0; i--) {
      const b = droppedBones[i];
      b.age += dt;

      if (b.age < 0.65) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.vy += 320 * dt;
        if (b.y > b.groundY) {
          b.y = b.groundY;
          b.vy *= -0.4;
        }
      } else {
        const targetX = 35;
        const targetY = 32;
        b.x += (targetX - b.x) * 6 * dt;
        b.y += (targetY - b.y) * 6 * dt;

        if (Math.hypot(targetX - b.x, targetY - b.y) < 18) {
          if (b.isMagic) {
            state.magicBones += b.value;
            state.lifetimeBones += b.value;
            sfx.magicCollect();
          } else {
            state.bones += b.value;
            state.lifetimeBones += b.value;
            sfx.collect();
          }
          droppedBones.splice(i, 1);
          requestSave();
          updateUI();
          continue;
        }
      }

      drawBoneSprite(b.x, b.y, b.isMagic);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (!p) continue;
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 120 * dt;

      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      ctx.globalAlpha = p.life / p.maxLife;
      if (p.isRing) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, (1 - p.life / p.maxLife) * 45, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Refresh roster tab bars/stats periodically while open so typing in inputs isn't interrupted
    const rosterTab = document.getElementById('tab-roster');
    if (
      gameModal.style.display === 'flex' &&
      rosterTab &&
      rosterTab.classList.contains('active') &&
      document.activeElement?.tagName !== 'INPUT' &&
      now - lastRosterUiRefresh > 600
    ) {
      lastRosterUiRefresh = now;
      renderRosterTab();
    }
  } catch (err) {
    console.error("Game loop error caught:", err);
  }

  requestAnimationFrame(loop);
}

updateUI();
requestAnimationFrame(loop);
