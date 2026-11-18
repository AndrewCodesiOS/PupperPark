const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- PROCEDURAL SOUND EFFECTS ---
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
  }
};

// Game State
let state = {
  bones: 0,
  magicBones: 0,
  dogs: {
    aussie: 1,
    corgi: 0,
    collie: 0
  },
  shinyDogs: [],
  digPower: 1,
  speedMultiplier: 1,
  magicChance: 0.12,
  costs: {
    aussie: 15,
    corgi: 75,
    collie: 250,
    digPower: 25,
    zoomies: 40,
    mushrooms: 5
  },
  lastSaveTime: Date.now()
};

function getTotalDogs() {
  return state.dogs.aussie + state.dogs.corgi + state.dogs.collie + state.shinyDogs.length;
}

function getBPS() {
  const normalBase = (state.dogs.aussie * 1) + (state.dogs.corgi * 1.5) + (state.dogs.collie * 4);
  const shinyBase = state.shinyDogs.reduce((acc, d) => acc + (d.breed === 'collie' ? 4 : (d.breed === 'corgi' ? 1.5 : 1)), 0);
  return (normalBase + shinyBase) * state.digPower * state.speedMultiplier * 0.45;
}

function loadGame() {
  const saved = localStorage.getItem('pupperpark_save');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      state = { ...state, ...parsed };
      if (!state.shinyDogs) state.shinyDogs = [];
      if (typeof state.dogs === 'number') {
        const oldTotal = state.dogs;
        state.dogs = { aussie: oldTotal, corgi: 0, collie: 0 };
      }
    } catch (e) {
      console.error('Failed to load save data', e);
    }
  }

  const now = Date.now();
  const elapsedSeconds = (now - state.lastSaveTime) / 1000;

  if (elapsedSeconds > 15) {
    const earned = Math.floor(getBPS() * elapsedSeconds * 0.6);
    if (earned > 0) {
      state.bones += earned;
      showOfflineModal(earned);
    }
  }

  state.lastSaveTime = now;
  saveGame();

  ['aussie', 'corgi', 'collie'].forEach(breed => {
    for (let i = 0; i < state.dogs[breed]; i++) {
      dogs.push(new Dog(1.5 + Math.random() * 4, 1.5 + Math.random() * 4, breed, false));
    }
  });

  state.shinyDogs.forEach(shiny => {
    dogs.push(new Dog(1.5 + Math.random() * 4, 1.5 + Math.random() * 4, shiny.breed, true, shiny.color));
  });
}

function saveGame() {
  state.lastSaveTime = Date.now();
  localStorage.setItem('pupperpark_save', JSON.stringify(state));
}

setInterval(saveGame, 10000);

function showOfflineModal(earned) {
  const modal = document.getElementById('offlineModal');
  const text = document.getElementById('offlineEarnings');
  if (text) {
    text.textContent = `Earned ${earned.toLocaleString()} Bones!`;
  }
  if (modal) {
    modal.style.display = 'flex';
  }
}

document.getElementById('btnCloseOffline').addEventListener('click', () => {
  document.getElementById('offlineModal').style.display = 'none';
});

// Menu Drawer Controls & Drag-to-Close Logic
const gameModal = document.getElementById('gameModal');
const drawerWindow = document.getElementById('drawerWindow');
const drawerHandle = document.getElementById('drawerHandle');

document.getElementById('btnOpenMenu').addEventListener('click', () => {
  initAudio();
  gameModal.style.display = 'flex';
  drawerWindow.style.transform = 'translateY(0)';
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

// Tab Switching Logic
const tabBtns = document.querySelectorAll('.tab-btn');
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    tabBtns.forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// Isometric Grid Settings with Vertical Centering & Camera Rotation
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

// Drag-to-Rotate Canvas Interaction
let isRotating = false;
let lastMouseX = 0;

canvas.addEventListener('pointerdown', (e) => {
  isRotating = true;
  lastMouseX = e.clientX;
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  if (!isRotating) return;
  const deltaX = e.clientX - lastMouseX;
  lastMouseX = e.clientX;
  cameraAngle += deltaX * 0.008;
});

canvas.addEventListener('pointerup', (e) => {
  if (!isRotating) return;
  isRotating = false;
  canvas.releasePointerCapture(e.pointerId);
  
  const totalDrag = Math.abs(e.clientX - lastMouseX);
  if (totalDrag < 5) {
    initAudio();
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const gridPos = screenToGrid(clickX, clickY);

    if (
      gridPos.gx >= 0 && gridPos.gx <= GRID_SIZE &&
      gridPos.gy >= 0 && gridPos.gy <= GRID_SIZE
    ) {
      const isMagic = Math.random() < state.magicChance;
      droppedBones.push({
        x: clickX,
        y: clickY - 10,
        vx: (Math.random() - 0.5) * 40,
        vy: -95,
        groundY: clickY + 5,
        age: 0,
        isMagic,
        value: isMagic ? 1 : state.digPower
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

// Dog Entity with High-Detail Multi-Layered Art for Aussie, Corgi, and Collie
class Dog {
  constructor(gx, gy, breed = 'aussie', isShiny = false, shinyColor = null) {
    this.gx = gx;
    this.gy = gy;
    this.targetGx = gx;
    this.targetGy = gy;
    this.state = 'IDLE'; 
    this.timer = 0.5 + Math.random() * 1.5;
    this.facingRight = Math.random() > 0.5;
    this.animPhase = Math.random() * Math.PI * 2;
    this.breed = breed;
    this.isShiny = isShiny;
    
    const shinyPalettes = ['#f1c40f', '#e67e22', '#e84393', '#00cec9', '#fd79a8'];
    this.shinyColor = shinyColor || shinyPalettes[Math.floor(Math.random() * shinyPalettes.length)];
    this.isMagicDig = false;
  }

  pickNewTarget() {
    this.targetGx = 0.7 + Math.random() * (GRID_SIZE - 1.4);
    this.targetGy = 0.7 + Math.random() * (GRID_SIZE - 1.4);
    this.state = 'WALK';
  }

  update(dt) {
    const speedMultiplier = this.breed === 'collie' ? 1.6 : (this.breed === 'corgi' ? 1.1 : 1.4);
    const speed = speedMultiplier * state.speedMultiplier;
    this.animPhase += dt * (this.state === 'WALK' ? 12 * state.speedMultiplier : 5);

    if (this.state === 'IDLE') {
      this.timer -= dt * state.speedMultiplier;
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
        this.state = 'DIG';
        this.timer = (this.breed === 'collie' ? 0.7 : 1.1) / state.speedMultiplier;
        
        const magicBonus = this.breed === 'corgi' ? 0.15 : 0;
        this.isMagicDig = Math.random() < (state.magicChance + magicBonus);
      } else {
        this.gx += (dx / dist) * speed * dt;
        this.gy += (dy / dist) * speed * dt;
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
    const amount = state.digPower * (this.breed === 'collie' ? 2 : 1);
    const pos = gridToScreen(this.gx, this.gy);

    droppedBones.push({
      x: pos.x,
      y: pos.y - 6,
      vx: (Math.random() - 0.5) * 50,
      vy: -110,
      groundY: pos.y + 4,
      age: 0,
      isMagic: this.isMagicDig,
      value: this.isMagicDig ? 1 : amount
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

    if (!this.facingRight) {
      ctx.scale(-1, 1);
    }

    const bounce = this.state === 'WALK' ? Math.abs(Math.sin(this.animPhase)) * 3 : 0;
    const digTilt = this.state === 'DIG' ? 0.25 : 0;
    ctx.translate(0, -bounce);
    ctx.rotate(digTilt);

    const legSwing = this.state === 'WALK' ? Math.sin(this.animPhase) * 4 : (this.state === 'DIG' ? Math.sin(this.animPhase * 3) * 5 : 0);

    if (this.breed === 'aussie') {
      // --- AUSTRALIAN SHEPHERD ---
      const primaryColor = this.isShiny ? this.shinyColor : '#c87d4b';

      ctx.fillStyle = primaryColor;
      ctx.fillRect(-11 - legSwing, -3, 4, 9);
      ctx.fillRect(6 + legSwing, -3, 4, 9);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-11 - legSwing, 4, 4, 3);
      ctx.fillRect(6 + legSwing, 4, 4, 3);

      const wag = Math.sin(this.animPhase * 1.5) * 2;
      ctx.fillStyle = '#4e433f';
      ctx.beginPath();
      ctx.arc(-15, -10 + wag, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#4e433f';
      ctx.beginPath();
      ctx.ellipse(-2, -9, 14, 9, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#736560';
      ctx.beginPath();
      ctx.ellipse(-3, -11, 9, 5, -0.1, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#f8f9fa';
      ctx.beginPath();
      ctx.arc(9, -8, 7.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#4e433f';
      ctx.beginPath();
      ctx.arc(11, -17, 8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = primaryColor;
      ctx.beginPath();
      ctx.arc(13, -15, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(17, -15, 4.5, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#1e1e1e';
      ctx.beginPath();
      ctx.arc(20.5, -16, 1.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#1e272e';
      ctx.beginPath();
      ctx.arc(14, -18.5, 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#382f2c';
      ctx.beginPath();
      ctx.ellipse(7, -19, 3.5, 5.5, 0.35, 0, Math.PI * 2);
      ctx.fill();

    } else if (this.breed === 'corgi') {
      // --- PEMBROKE CORGI (Redesigned with high-detail multi-layer style) ---
      const corgiColor = this.isShiny ? this.shinyColor : '#e17055';

      // Stubby legs with white paws
      ctx.fillStyle = corgiColor;
      ctx.fillRect(-10 - legSwing, -1, 4, 8);
      ctx.fillRect(5 + legSwing, -1, 4, 8);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-10 - legSwing, 5, 4, 3);
      ctx.fillRect(5 + legSwing, 5, 4, 3);

      // Low fluffy tail wagging
      const wag = Math.sin(this.animPhase * 1.5) * 2;
      ctx.fillStyle = corgiColor;
      ctx.beginPath();
      ctx.arc(-14, -7 + wag, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Long low-slung body
      ctx.fillStyle = corgiColor;
      ctx.beginPath();
      ctx.ellipse(-1, -7, 15, 8.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Golden tan back shading
      ctx.fillStyle = '#fab1a0';
      ctx.beginPath();
      ctx.ellipse(-1, -9, 10, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // White chest ruff
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(8, -7, 7, 0, Math.PI * 2);
      ctx.fill();

      // Head
      ctx.fillStyle = corgiColor;
      ctx.beginPath();
      ctx.arc(11, -16, 7.5, 0, Math.PI * 2);
      ctx.fill();

      // Large upright pointed ears
      ctx.fillStyle = '#d63031';
      ctx.beginPath();
      ctx.moveTo(7, -20); ctx.lineTo(13, -27); ctx.lineTo(15, -18); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(11, -19); ctx.lineTo(17, -24); ctx.lineTo(13, -15); ctx.fill();

      // White snout & dark nose/eye
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(15, -15, 4, 3, 0.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#1e1e1e';
      ctx.beginPath();
      ctx.arc(18, -16, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(13, -18, 1.3, 0, Math.PI * 2);
      ctx.fill();

    } else if (this.breed === 'collie') {
      // --- BORDER COLLIE (Redesigned with high-detail multi-layer style) ---
      const collieColor = this.isShiny ? this.shinyColor : '#2d3436';

      // Athletic legs with white paws
      ctx.fillStyle = collieColor;
      ctx.fillRect(-12 - legSwing, -3, 3.5, 10);
      ctx.fillRect(7 + legSwing, -3, 3.5, 10);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-12 - legSwing, 4, 3.5, 3);
      ctx.fillRect(7 + legSwing, 4, 3.5, 3);

      // Graceful flowing tail
      const wag = Math.sin(this.animPhase * 1.5) * 3;
      ctx.fillStyle = collieColor;
      ctx.beginPath();
      ctx.arc(-16, -11 + wag, 4, 0, Math.PI * 2);
      ctx.fill();

      // Sleek athletic torso
      ctx.fillStyle = collieColor;
      ctx.beginPath();
      ctx.ellipse(-1, -10, 15, 8, -0.1, 0, Math.PI * 2);
      ctx.fill();

      // Iconic white collar ruff
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(5, -11, 5, 7, 0.25, 0, Math.PI * 2);
      ctx.fill();

      // Intelligent refined head & long snout
      ctx.fillStyle = collieColor;
      ctx.beginPath();
      ctx.arc(11, -17, 7.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(11, -16); ctx.lineTo(20, -14); ctx.lineTo(13, -11); ctx.fill();

      // Semi-floppy tipped ears
      ctx.fillStyle = '#1e272e';
      ctx.beginPath();
      ctx.ellipse(8, -21, 3, 5, -0.3, 0, Math.PI * 2);
      ctx.fill();

      // Black nose & alert eye
      ctx.fillStyle = '#1e1e1e';
      ctx.beginPath();
      ctx.arc(20.5, -14.5, 1.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(14, -18.5, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
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

// Recruit Handlers with Shiny Chance
function recruitDog(breed, costKey) {
  initAudio();
  if (state.bones >= state.costs[costKey]) {
    state.bones -= state.costs[costKey];
    state.costs[costKey] = Math.floor(state.costs[costKey] * 1.45);
    
    const isShiny = Math.random() < (1 / 8000);
    
    if (isShiny) {
      const shinyPalettes = ['#f1c40f', '#e67e22', '#e84393', '#00cec9', '#fd79a8'];
      const chosenColor = shinyPalettes[Math.floor(Math.random() * shinyPalettes.length)];
      state.shinyDogs.push({ breed, color: chosenColor });
      dogs.push(new Dog(1.5, 1.5, breed, true, chosenColor));
      sfx.shiny();
    } else {
      state.dogs[breed]++;
      dogs.push(new Dog(1.5, 1.5, breed, false));
      sfx.upgrade();
    }

    updateUI();
    saveGame();
  }
}

document.getElementById('btnSummonAussie').addEventListener('click', () => recruitDog('aussie', 'aussie'));
document.getElementById('btnSummonCorgi').addEventListener('click', () => recruitDog('corgi', 'corgi'));
document.getElementById('btnSummonCollie').addEventListener('click', () => recruitDog('collie', 'collie'));

document.getElementById('btnDigPower').addEventListener('click', () => {
  initAudio();
  if (state.bones >= state.costs.digPower) {
    state.bones -= state.costs.digPower;
    state.digPower += 1;
    state.costs.digPower = Math.floor(state.costs.digPower * 1.55);
    sfx.upgrade();
    updateUI();
    saveGame();
  }
});

document.getElementById('btnZoomies').addEventListener('click', () => {
  initAudio();
  if (state.bones >= state.costs.zoomies) {
    state.bones -= state.costs.zoomies;
    state.speedMultiplier *= 1.2;
    state.costs.zoomies = Math.floor(state.costs.zoomies * 1.65);
    sfx.upgrade();
    updateUI();
    saveGame();
  }
});

document.getElementById('btnMushrooms').addEventListener('click', () => {
  initAudio();
  if (state.magicBones >= state.costs.mushrooms) {
    state.magicBones -= state.costs.mushrooms;
    state.magicChance = Math.min(0.85, state.magicChance + 0.1);
    state.costs.mushrooms = Math.floor(state.costs.mushrooms * 1.6);
    sfx.upgrade();
    updateUI();
    saveGame();
  }
});

document.getElementById('btnPrestige').addEventListener('click', () => {
  initAudio();
  if (state.bones >= 1000) {
    state.bones = 0;
    state.dogs = { aussie: 1, corgi: 0, collie: 0 };
    
    dogs.length = 0;
    dogs.push(new Dog(1.5, 1.5, 'aussie', false));
    state.shinyDogs.forEach(shiny => {
      dogs.push(new Dog(1.5 + Math.random() * 4, 1.5 + Math.random() * 4, shiny.breed, true, shiny.color));
    });

    sfx.shiny();
    closeMenu();
    updateUI();
    saveGame();
  }
});

function updateUI() {
  document.getElementById('boneCount').textContent = Math.floor(state.bones).toLocaleString();
  document.getElementById('magicBoneCount').textContent = Math.floor(state.magicBones).toLocaleString();
  
  const total = getTotalDogs();
  document.getElementById('miniDogs').textContent = total;
  document.getElementById('countAussie').textContent = state.dogs.aussie + state.shinyDogs.filter(d => d.breed === 'aussie').length;
  document.getElementById('countCorgi').textContent = state.dogs.corgi + state.shinyDogs.filter(d => d.breed === 'corgi').length;
  document.getElementById('countCollie').textContent = state.dogs.collie + state.shinyDogs.filter(d => d.breed === 'collie').length;
  document.getElementById('shinyCountDisplay').textContent = state.shinyDogs.length;

  const estBps = getBPS().toFixed(1);
  document.getElementById('bpsCount').textContent = `+${estBps}/s`;

  document.getElementById('costAussie').textContent = `${state.costs.aussie.toLocaleString()} 🦴`;
  document.getElementById('costCorgi').textContent = `${state.costs.corgi.toLocaleString()} 🦴`;
  document.getElementById('costCollie').textContent = `${state.costs.collie.toLocaleString()} 🦴`;
  document.getElementById('costDigPower').textContent = `${state.costs.digPower.toLocaleString()} 🦴`;
  document.getElementById('costZoomies').textContent = `${state.costs.zoomies.toLocaleString()} 🦴`;
  document.getElementById('costMushrooms').textContent = `${state.costs.mushrooms} ✨`;

  document.getElementById('statDigPower').textContent = state.digPower;
  document.getElementById('statSpeed').textContent = `${state.speedMultiplier.toFixed(1)}x`;
  document.getElementById('statChance').textContent = `${Math.round(state.magicChance * 100)}%`;

  document.getElementById('btnSummonAussie').disabled = state.bones < state.costs.aussie;
  document.getElementById('btnSummonCorgi').disabled = state.bones < state.costs.corgi;
  document.getElementById('btnSummonCollie').disabled = state.bones < state.costs.collie;
  document.getElementById('btnDigPower').disabled = state.bones < state.costs.digPower;
  document.getElementById('btnZoomies').disabled = state.bones < state.costs.zoomies;
  document.getElementById('btnMushrooms').disabled = state.magicBones < state.costs.mushrooms;
  document.getElementById('btnPrestige').disabled = state.bones < 1000;
}

loadGame();

let lastTime = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  const bps = getBPS();
  if (bps > 0) {
    state.bones += bps * dt;
    updateUI();
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let gx = 0; gx < GRID_SIZE; gx++) {
    for (let gy = 0; gy < GRID_SIZE; gy++) {
      drawIsometricTile(gx, gy);
    }
  }

  const renderables = [];
  renderables.push({ sortY: gridToScreen(1.2, 1.2).y, draw: drawDoghouse });
  renderables.push({ sortY: gridToScreen(5.8, 1.2).y, draw: drawTree });

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
  renderables.forEach(item => item.draw());

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
          sfx.magicCollect();
        } else {
          state.bones += b.value;
          sfx.collect();
        }
        droppedBones.splice(i, 1);
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
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  requestAnimationFrame(loop);
}

updateUI();
requestAnimationFrame(loop);
