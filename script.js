const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
let state = {
  bones: 0,
  magicBones: 0,
  dogCount: 1,
  digPower: 1,
  speedMultiplier: 1,
  magicChance: 0.12,
  costs: {
    summon: 15,
    digPower: 25,
    zoomies: 40,
    mushrooms: 5
  },
  lastSaveTime: Date.now()
};

// Load from LocalStorage if available
function loadGame() {
  const saved = localStorage.getItem('magical_aussie_save');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      state = { ...state, ...parsed };
    } catch (e) {
      console.error('Failed to load save data', e);
    }
  }

  // Calculate Offline Progression
  const now = Date.now();
  const elapsedSeconds = (now - state.lastSaveTime) / 1000;
  if (elapsedSeconds > 10) {
    // Estimate passive offline earnings (50% efficiency while away)
    const bonesPerSec = state.dogCount * state.digPower * state.speedMultiplier * 0.45;
    const earned = Math.floor(bonesPerSec * elapsedSeconds * 0.5);
    
    if (earned > 0) {
      state.bones += earned;
      showOfflineModal(earned, elapsedSeconds);
    }
  }

  // Re-instantiate dogs based on saved count
  for (let i = 0; i < state.dogCount; i++) {
    dogs.push(new AustralianShepherd(1.5 + Math.random() * 4, 1.5 + Math.random() * 4));
  }
}

function saveGame() {
  state.lastSaveTime = Date.now();
  localStorage.setItem('magical_aussie_save', JSON.stringify(state));
}

// Auto-save every 10 seconds
setInterval(saveGame, 10000);

function showOfflineModal(earned, seconds) {
  const modal = document.getElementById('offlineModal');
  const text = document.getElementById('offlineEarnings');
  const mins = Math.floor(seconds / 60);
  text.textContent = `Earned ${earned.toLocaleString()} Bones in ${mins} minutes!`;
  modal.style.display = 'flex';
}

document.getElementById('btnCloseModal').addEventListener('click', () => {
  document.getElementById('offlineModal').style.display = 'none';
});

// Isometric Grid Settings (2.5D Diorama)
const GRID_SIZE = 7;
const TILE_W = 96;
const TILE_H = 48;
const TILE_DEPTH = 26;

let originX = 0;
let originY = 0;

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  originX = canvas.width / 2;
  originY = canvas.height / 2 - (GRID_SIZE * TILE_H) / 2 + 20;
}
window.addEventListener('resize', resize);
resize();

function gridToScreen(gx, gy) {
  return {
    x: originX + (gx - gy) * (TILE_W / 2),
    y: originY + (gx + gy) * (TILE_H / 2)
  };
}

function screenToGrid(sx, sy) {
  const dx = sx - originX;
  const dy = sy - originY;
  return {
    gx: (dx / (TILE_W / 2) + dy / (TILE_H / 2)) / 2,
    gy: (dy / (TILE_H / 2) - dx / (TILE_W / 2)) / 2
  };
}

// Environment Props
const mushrooms = [
  { gx: 1.3, gy: 1.4, color: '#a29bfe', glow: 'rgba(162, 155, 254, 0.35)' },
  { gx: 5.5, gy: 1.8, color: '#fd79a8', glow: 'rgba(253, 121, 168, 0.35)' },
  { gx: 1.6, gy: 5.3, color: '#55efc4', glow: 'rgba(85, 239, 196, 0.35)' },
  { gx: 5.2, gy: 5.4, color: '#ffeaa7', glow: 'rgba(255, 234, 167, 0.35)' }
];

const dogs = [];
const droppedBones = [];
const particles = [];

class AustralianShepherd {
  constructor(gx, gy) {
    this.gx = gx;
    this.gy = gy;
    this.targetGx = gx;
    this.targetGy = gy;
    this.state = 'IDLE'; 
    this.timer = 0.5 + Math.random() * 1.5;
    this.facingRight = Math.random() > 0.5;
    this.animPhase = Math.random() * Math.PI * 2;
    this.isMagicDig = false;
  }

  pickNewTarget() {
    this.targetGx = 0.7 + Math.random() * (GRID_SIZE - 1.4);
    this.targetGy = 0.7 + Math.random() * (GRID_SIZE - 1.4);
    this.state = 'WALK';
  }

  update(dt) {
    const speed = 1.4 * state.speedMultiplier;
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
        this.timer = 1.1 / state.speedMultiplier;
        this.isMagicDig = Math.random() < state.magicChance;
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
    const amount = state.digPower;
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
    ctx.fillStyle = '#c87d4b';
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

    ctx.fillStyle = '#d6894b';
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

  if (gy === GRID_SIZE - 1) {
    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.lineTo(bottom.x, bottom.y + TILE_DEPTH);
    ctx.lineTo(left.x, left.y + TILE_DEPTH);
    ctx.closePath();
    ctx.fillStyle = '#795548';
    ctx.fill();
  }

  if (gx === GRID_SIZE - 1) {
    ctx.beginPath();
    ctx.moveTo(right.x, right.y);
    ctx.lineTo(bottom.x, bottom.y);
    ctx.lineTo(bottom.x, bottom.y + TILE_DEPTH);
    ctx.lineTo(right.x, right.y + TILE_DEPTH);
    ctx.closePath();
    ctx.fillStyle = '#5d4037';
    ctx.fill();
  }
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

  ctx.fillStyle = '#2c2c54';
  ctx.beginPath();
  ctx.arc(0, -10, 10, Math.PI, 0);
  ctx.lineTo(10, 2);
  ctx.lineTo(-10, 2);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#70a1ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, -8, 5 + Math.sin(Date.now() * 0.005) * 1.5, 0, Math.PI * 1.5);
  ctx.stroke();

  ctx.fillStyle = '#40739e';
  ctx.beginPath();
  ctx.moveTo(-26, -22);
  ctx.lineTo(0, -40);
  ctx.lineTo(26, -22);
  ctx.closePath();
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

canvas.addEventListener('pointerdown', (e) => {
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
});

document.getElementById('btnSummon').addEventListener('click', () => {
  if (state.bones >= state.costs.summon) {
    state.bones -= state.costs.summon;
    state.costs.summon = Math.floor(state.costs.summon * 1.45);
    state.dogCount++;
    dogs.push(new AustralianShepherd(1.5, 1.5));
    updateUI();
    saveGame();
  }
});

document.getElementById('btnDigPower').addEventListener('click', () => {
  if (state.bones >= state.costs.digPower) {
    state.bones -= state.costs.digPower;
    state.digPower += 1;
    state.costs.digPower = Math.floor(state.costs.digPower * 1.55);
    updateUI();
    saveGame();
  }
});

document.getElementById('btnZoomies').addEventListener('click', () => {
  if (state.bones >= state.costs.zoomies) {
    state.bones -= state.costs.zoomies;
    state.speedMultiplier *= 1.2;
    state.costs.zoomies = Math.floor(state.costs.zoomies * 1.65);
    updateUI();
    saveGame();
  }
});

document.getElementById('btnMushrooms').addEventListener('click', () => {
  if (state.magicBones >= state.costs.mushrooms) {
    state.magicBones -= state.costs.mushrooms;
    state.magicChance = Math.min(0.85, state.magicChance + 0.1);
    state.costs.mushrooms = Math.floor(state.costs.mushrooms * 1.6);
    updateUI();
    saveGame();
  }
});

function updateUI() {
  document.getElementById('boneCount').textContent = Math.floor(state.bones);
  document.getElementById('magicBoneCount').textContent = Math.floor(state.magicBones);
  document.getElementById('dogCount').textContent = dogs.length;

  const estBps = (dogs.length * state.digPower * state.speedMultiplier * 0.45).toFixed(1);
  document.getElementById('bpsCount').textContent = estBps;

  document.getElementById('costSummon').textContent = `${state.costs.summon} Bones`;
  document.getElementById('costDigPower').textContent = `${state.costs.digPower} Bones`;
  document.getElementById('costZoomies').textContent = `${state.costs.zoomies} Bones`;
  document.getElementById('costMushrooms').textContent = `${state.costs.mushrooms} Magic Bones`;

  document.getElementById('btnSummon').disabled = state.bones < state.costs.summon;
  document.getElementById('btnDigPower').disabled = state.bones < state.costs.digPower;
  document.getElementById('btnZoomies').disabled = state.bones < state.costs.zoomies;
  document.getElementById('btnMushrooms').disabled = state.magicBones < state.costs.mushrooms;
}

// Initialize Save & Load
loadGame();

let lastTime = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let gx = 0; gx < GRID_SIZE; gx++) {
    for (let gy = 0; gy < GRID_SIZE; gy++) {
      drawIsometricTile(gx, gy);
    }
  }

  const renderables = [];
  renderables.push({ sortY: gridToScreen(1.2, 1.2).y, draw: drawDoghouse });

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
      const targetX = canvas.width / 2 - 120;
      const targetY = 36;
      b.x += (targetX - b.x) * 6 * dt;
      b.y += (targetY - b.y) * 6 * dt;

      if (Math.hypot(targetX - b.x, targetY - b.y) < 18) {
        if (b.isMagic) {
          state.magicBones += b.value;
        } else {
          state.bones += b.value;
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
