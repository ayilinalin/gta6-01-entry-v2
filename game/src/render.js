// NEON TIDE v2 — the camera and everything it sees: streets, buildings,
// water, cars, people, the helicopter, muzzle flashes and the night itself.
import { MAP, BLOCK, ROAD_W, PALETTE } from './config.js';
import { districtAt, onRoad } from './city.js';
import { daylight } from './time.js';

export function makeCamera() {
  return { x: 0, y: 0, w: 1280, h: 720, zoom: 1 };
}

export function updateCamera(G, W, H) {
  const cam = G.cam;
  cam.w = W; cam.h = H;
  const p = G.player;
  const tx = Math.max(0, Math.min(MAP - W, p.x - W / 2));
  const ty = Math.max(0, Math.min(MAP - H, p.y - H / 2));
  cam.x += (tx - cam.x) * 0.12;
  cam.y += (ty - cam.y) * 0.12;
}

export function render(G, ctx, W, H) {
  const cam = G.cam;
  const dl = daylight(G.clock);
  const night = 1 - dl;
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.translate(-Math.round(cam.x), -Math.round(cam.y));

  drawGround(G, ctx, cam);
  drawWater(G, ctx);
  drawRoads(G, ctx, cam);
  drawBuildings(G, ctx);
  drawProps(G, ctx);
  drawShops(G, ctx);
  drawPickups(G, ctx);
  drawPeds(G, ctx);
  drawCars(G, ctx);
  drawCops(G, ctx);
  drawPlayer(G, ctx);
  drawBullets(G, ctx);
  drawSparks(G, ctx);
  drawHeli(G, ctx);
  drawRain(G, ctx, cam);

  // Night: darkness, then pools of light — street lamps, headlights, neon.
  if (night > 0.05) {
    ctx.fillStyle = `rgba(6,8,26,${(night * 0.55).toFixed(3)})`;
    ctx.fillRect(cam.x - 10, cam.y - 10, W + 20, H + 20);
    ctx.globalCompositeOperation = 'lighter';
    for (const b of G.city.buildings) {
      if (!b.neon) continue;
      if (b.x < cam.x - 100 || b.x > cam.x + W + 100 || b.y < cam.y - 100 || b.y > cam.y + H + 100) continue;
      glow(ctx, b.x + b.w / 2, b.y + b.h / 2, 130, b.neon, 0.20 * night);
    }
    const p = G.player;
    glow(ctx, p.x, p.y, 260, '#ffe9a8', 0.16 * night);
    if (!p.onFoot && p.car) {
      const fx = Math.cos(p.car.angle), fy = Math.sin(p.car.angle);
      glow(ctx, p.car.x + fx * 60, p.car.y + fy * 60, 170, '#fff2b0', 0.22 * night);
    }
    for (const c of G.cars) {
      if (c.kind === 'police') glow(ctx, c.x, c.y, 120, (Math.floor(G.time * 4) % 2 === 0) ? '#ff3b30' : '#3b82ff', 0.25 * night);
    }
    if (G.heli) glow(ctx, G.heli.x, G.heli.y, 200, '#fff2b0', 0.20 * night);
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.restore();
}

function drawGround(G, ctx, cam) {
  // District ground, drawn per visible block.
  const x0 = Math.max(0, Math.floor(cam.x / BLOCK) * BLOCK);
  const y0 = Math.max(0, Math.floor(cam.y / BLOCK) * BLOCK);
  const x1 = Math.min(MAP, cam.x + cam.w + BLOCK);
  const y1 = Math.min(MAP, cam.y + cam.h + BLOCK);
  for (let bx = x0; bx < x1; bx += BLOCK) {
    for (let by = y0; by < y1; by += BLOCK) {
      const d = districtAt(bx + BLOCK / 2, by + BLOCK / 2);
      ctx.fillStyle = d.ground;
      ctx.fillRect(bx, by, BLOCK, BLOCK);
    }
  }
}

function drawWater(G, ctx) {
  const w = G.city.water;
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(w.x0, w.y0, w.x1 - w.x0, w.y1 - w.y0);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  for (let y = 0; y < MAP; y += 90) {
    const off = Math.sin(G.time * 1.5 + y * 0.02) * 6;
    ctx.beginPath();
    ctx.moveTo(w.x0 + 8 + off, y);
    ctx.lineTo(w.x0 + 40 + off, y);
    ctx.stroke();
  }
  // Piers.
  ctx.fillStyle = '#6b5a44';
  for (const pier of G.city.piers) ctx.fillRect(pier.x0, pier.y0, pier.x1 - pier.x0, pier.y1 - pier.y0);
}

function drawRoads(G, ctx, cam) {
  const x0 = Math.max(0, Math.floor(cam.x / BLOCK) * BLOCK);
  const y0 = Math.max(0, Math.floor(cam.y / BLOCK) * BLOCK);
  const x1 = Math.min(MAP, cam.x + cam.w + BLOCK);
  const y1 = Math.min(MAP, cam.y + cam.h + BLOCK);
  for (let bx = x0; bx < x1; bx += BLOCK) {
    for (let by = y0; by < y1; by += BLOCK) {
      const d = districtAt(bx + BLOCK / 2, by + BLOCK / 2);
      ctx.fillStyle = d.road;
      ctx.fillRect(bx, by, ROAD_W, BLOCK);
      ctx.fillRect(bx, by, BLOCK, ROAD_W);
      // Lane dashes.
      ctx.strokeStyle = 'rgba(230,230,200,0.5)';
      ctx.lineWidth = 3;
      ctx.setLineDash([18, 22]);
      ctx.beginPath(); ctx.moveTo(bx + ROAD_W / 2, by); ctx.lineTo(bx + ROAD_W / 2, by + BLOCK); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx, by + ROAD_W / 2); ctx.lineTo(bx + BLOCK, by + ROAD_W / 2); ctx.stroke();
      ctx.setLineDash([]);
      // Sidewalk edge.
      ctx.strokeStyle = PALETTE.sidewalk;
      ctx.lineWidth = 6;
      ctx.strokeRect(bx + ROAD_W, by + ROAD_W, BLOCK - ROAD_W, BLOCK - ROAD_W);
    }
  }
}

function drawBuildings(G, ctx) {
  const cam = G.cam;
  for (const b of G.city.buildings) {
    if (b.x + b.w < cam.x - 80 || b.x > cam.x + cam.w + 80 || b.y + b.h < cam.y - 80 || b.y > cam.y + cam.h + 80) continue;
    // Drop shadow in the sun's direction.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    // Rooftop details: AC units and a helipad on the tall ones.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(b.x + 10, b.y + 10, 14, 10);
    ctx.fillRect(b.x + b.w - 26, b.y + b.h - 22, 16, 12);
    if (b.height > 24) {
      ctx.strokeStyle = '#ffd23e';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 16, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffd23e';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('H', b.x + b.w / 2, b.y + b.h / 2 + 4);
      ctx.textAlign = 'left';
    }
    if (b.neon) {
      ctx.strokeStyle = b.neon;
      ctx.lineWidth = 3;
      ctx.strokeRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4);
    }
  }
}

function drawProps(G, ctx) {
  for (const pr of G.city.props) {
    if (pr.x < G.cam.x - 60 || pr.x > G.cam.x + G.cam.w + 60 || pr.y < G.cam.y - 60 || pr.y > G.cam.y + G.cam.h + 60) continue;
    if (pr.kind === 'palm') {
      ctx.strokeStyle = '#4a6a3a';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(pr.x, pr.y); ctx.lineTo(pr.x + 4, pr.y - 18); ctx.stroke();
      ctx.fillStyle = '#3f7a3a';
      ctx.beginPath(); ctx.arc(pr.x + 4, pr.y - 20, 10, 0, Math.PI * 2); ctx.fill();
    } else if (pr.kind === 'container') {
      ctx.fillStyle = pr.color;
      ctx.fillRect(pr.x - pr.s / 2, pr.y - pr.s / 4, pr.s, pr.s / 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.strokeRect(pr.x - pr.s / 2, pr.y - pr.s / 4, pr.s, pr.s / 2);
    } else if (pr.kind === 'lamp') {
      ctx.fillStyle = '#2a2d33';
      ctx.fillRect(pr.x - 2, pr.y - 2, 4, 4);
      ctx.fillStyle = '#ffe9a8';
      ctx.beginPath(); ctx.arc(pr.x, pr.y, 3, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = pr.color;
      ctx.fillRect(pr.x - 5, pr.y - 5, 10, 10);
    }
  }
}

function drawShops(G, ctx) {
  for (const s of G.city.shops) {
    ctx.fillStyle = 'rgba(8,10,18,0.7)';
    ctx.beginPath(); ctx.arc(s.x, s.y, 20, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = s.kind === 'hideout' ? '#7a5cff' : '#2ee6c8';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(s.kind === 'arms' ? 'GUN' : s.kind === 'spray' ? 'SPRAY' : s.kind === 'hospital' ? '+' : s.kind === 'diner' ? 'EAT' : 'HIDE', s.x, s.y + 5);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(s.name, s.x - 30, s.y + 34);
  }
}

function drawPickups(G, ctx) {
  for (const pk of G.pickups) {
    const bob = Math.sin(G.time * 4 + pk.x) * 3;
    ctx.fillStyle = pk.kind === 'cash' ? '#7dff8a' : pk.kind === 'health' ? '#ff5c5c' : pk.kind === 'armor' ? '#5aa2e8' : '#ffd23e';
    ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0b0e1a';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pk.kind === 'cash' ? '$' : pk.kind === 'health' ? '+' : 'A', pk.x, pk.y + bob + 4);
    ctx.textAlign = 'left';
  }
}

function drawPeds(G, ctx) {
  for (const ped of G.peds) {
    if (ped.state === 'down') {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath(); ctx.ellipse(ped.x, ped.y, 12, 5, ped.angle, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(ped.x, ped.y + 6, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath(); ctx.arc(ped.x, ped.y, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath(); ctx.arc(ped.x + Math.cos(ped.angle) * 4, ped.y + Math.sin(ped.angle) * 4, 4, 0, Math.PI * 2); ctx.fill();
    if (ped.state === 'flee') {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText('!', ped.x - 3, ped.y - 14);
    }
  }
}

function drawCarShape(ctx, car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-car.length / 2 + 4, -car.width / 2 + 5, car.length, car.width);
  ctx.fillStyle = car.color;
  roundRectPath(ctx, -car.length / 2, -car.width / 2, car.length, car.width, 6);
  ctx.fill();
  ctx.fillStyle = car.roof;
  roundRectPath(ctx, -car.length / 2 + 8, -car.width / 2 + 3, car.length - 16, car.width - 6, 4);
  ctx.fill();
  // Windshield + headlights.
  ctx.fillStyle = '#1a2634';
  ctx.fillRect(car.length / 2 - 12, -car.width / 2 + 3, 6, car.width - 6);
  ctx.fillStyle = '#fff2b0';
  ctx.fillRect(car.length / 2 - 2, -car.width / 2 + 1, 3, 5);
  ctx.fillRect(car.length / 2 - 2, car.width / 2 - 6, 3, 5);
  if (car.kind === 'police') {
    ctx.fillStyle = '#fff';
    ctx.fillRect(-4, -car.width / 2, 8, car.width);
    ctx.fillStyle = (Math.floor(performance.now() / 250) % 2 === 0) ? '#ff3b30' : '#3b82ff';
    ctx.fillRect(-6, -5, 12, 4);
  }
  if (car.type === 'taxi') {
    ctx.fillStyle = '#20242c';
    ctx.font = 'bold 7px system-ui, sans-serif';
    ctx.fillText('TAXI', -10, 3);
  }
  ctx.restore();
}

function drawCars(G, ctx) {
  for (const car of G.cars) {
    if (car.kind === 'player') continue; // the player's car is drawn with the player
    drawCarShape(ctx, car);
    if (car.kind === 'target') {
      ctx.strokeStyle = '#ffd23e';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(car.x, car.y, 30, 0, Math.PI * 2); ctx.stroke();
    }
    if (car.hp < car.maxHp * 0.5) {
      ctx.fillStyle = 'rgba(120,120,120,0.7)';
      ctx.beginPath(); ctx.arc(car.x - 10, car.y - 8, 8 + Math.sin(G.time * 9) * 2, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawCops(G, ctx) {
  for (const cop of G.cops) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(cop.x, cop.y + 6, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#20242c';
    ctx.beginPath(); ctx.arc(cop.x, cop.y, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8e4da';
    ctx.beginPath(); ctx.arc(cop.x + Math.cos(cop.angle) * 4, cop.y + Math.sin(cop.angle) * 4, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3b82ff';
    ctx.fillRect(cop.x - 5, cop.y - 13, 10, 3);
  }
}

function drawPlayer(G, ctx) {
  const p = G.player;
  if (!p.onFoot && p.car) {
    drawCarShape(ctx, p.car);
    if (p.car.hp < p.car.maxHp * 0.5) {
      ctx.fillStyle = 'rgba(120,120,120,0.7)';
      ctx.beginPath(); ctx.arc(p.car.x - 10, p.car.y - 8, 8 + Math.sin(G.time * 9) * 2, 0, Math.PI * 2); ctx.fill();
    }
    return;
  }
  // On foot: shadow, body, head, gun when armed.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(p.x, p.y + 7, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff2e88';
  ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c9a0';
  ctx.beginPath(); ctx.arc(p.x + Math.cos(p.angle) * 5, p.y + Math.sin(p.angle) * 5, 5, 0, Math.PI * 2); ctx.fill();
  if (p.weapon !== 'fists') {
    ctx.strokeStyle = '#20242c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(p.angle) * 8, p.y + Math.sin(p.angle) * 8);
    ctx.lineTo(p.x + Math.cos(p.angle) * 22, p.y + Math.sin(p.angle) * 22);
    ctx.stroke();
  }
  // Crosshair.
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(p.aimX, p.aimY, 9, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(p.aimX - 13, p.aimY); ctx.lineTo(p.aimX - 5, p.aimY);
  ctx.moveTo(p.aimX + 5, p.aimY); ctx.lineTo(p.aimX + 13, p.aimY);
  ctx.moveTo(p.aimX, p.aimY - 13); ctx.lineTo(p.aimX, p.aimY - 5);
  ctx.moveTo(p.aimX, p.aimY + 5); ctx.lineTo(p.aimX, p.aimY + 13);
  ctx.stroke();
  if (G.muzzle > 0) {
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath(); ctx.arc(p.x + Math.cos(p.angle) * 26, p.y + Math.sin(p.angle) * 26, 10, 0, Math.PI * 2); ctx.fill();
  }
}

function drawBullets(G, ctx) {
  ctx.strokeStyle = '#ffe9a8';
  ctx.lineWidth = 3;
  for (const b of G.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

function drawSparks(G, ctx) {
  for (const s of G.sparks) {
    ctx.globalAlpha = Math.max(0, s.life / s.max);
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath(); ctx.arc(s.x, s.y, 6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawHeli(G, ctx) {
  const h = G.heli;
  if (!h) return;
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(6, 8, 26, 12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#20242c';
  ctx.beginPath(); ctx.ellipse(0, 0, 24, 11, h.angle, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3b82ff';
  ctx.beginPath(); ctx.arc(10, 0, 5, 0, Math.PI * 2); ctx.fill();
  // Rotor blur.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  const r = h.rotor % (Math.PI * 2);
  ctx.beginPath();
  ctx.moveTo(Math.cos(r) * -30, Math.sin(r) * -30);
  ctx.lineTo(Math.cos(r) * 30, Math.sin(r) * 30);
  ctx.stroke();
  // Searchlight cone at night.
  ctx.restore();
}

function drawRain(G, ctx, cam) {
  const c = G.clock;
  if (c.rain < 0.05) return;
  ctx.strokeStyle = `rgba(180,200,230,${(c.rain * 0.5).toFixed(2)})`;
  ctx.lineWidth = 1;
  const n = Math.floor(c.rain * 90);
  for (let i = 0; i < n; i += 1) {
    const x = cam.x + ((i * 137.5 + G.time * 900) % (cam.w + 40)) - 20;
    const y = cam.y + ((i * 89.3 + G.time * 1400) % (cam.h + 40)) - 20;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 14); ctx.stroke();
  }
}

function glow(ctx, x, y, r, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 4, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export { onRoad };
