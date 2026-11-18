// NEON TIDE v2 — HUD, minimap, menus and end screens. Everything the
// player reads lives here: wanted stars, health, cash, the objective,
// the clock, the district, and the map of Port Meridian.
import { MAP, WEAPONS } from './config.js';
import { districtAt } from './city.js';
import { clockLabel, daylight } from './time.js';
import { shopMenu } from './economy.js';
import { missionOf, stepOf } from './missions.js';

const NEON = '#ff2e88';

export function drawHUD(G, ctx, W, H) {
  const p = G.player;
  ctx.save();
  ctx.textBaseline = 'alphabetic';

  // Top-left: wanted stars, health, armor.
  ctx.fillStyle = 'rgba(8,10,18,0.72)';
  roundRect(ctx, 12, 12, 250, 92, 10);
  ctx.fill();
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < p.wanted ? '#ffd23e' : 'rgba(255,255,255,0.22)';
    drawStar(ctx, 34 + i * 26, 34, 11);
  }
  bar(ctx, 28, 52, 210, 12, p.hp / 100, '#e5484d', 'rgba(255,255,255,0.2)');
  bar(ctx, 28, 70, 210, 8, p.armor / 100, '#5aa2e8', 'rgba(255,255,255,0.2)');
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(`HP ${Math.ceil(p.hp)}`, 28, 62);
  ctx.fillText('ARMOR', 28, 78);

  // Top-left below: cash + respect.
  ctx.fillStyle = 'rgba(8,10,18,0.72)';
  roundRect(ctx, 12, 112, 250, 34, 10);
  ctx.fill();
  ctx.fillStyle = '#7dff8a';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText(`$${p.cash.toLocaleString('en-US')}`, 26, 136);
  ctx.fillStyle = '#ffd23e';
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(`★ ${p.respect} respect  •  ${G.mission.done} jobs done`, 130, 136);

  // Top-center: objective banner.
  const obj = objectiveText(G);
  if (obj) {
    ctx.font = 'bold 15px system-ui, sans-serif';
    const w = ctx.measureText(obj).width + 36;
    ctx.fillStyle = 'rgba(8,10,18,0.78)';
    roundRect(ctx, (W - w) / 2, 12, w, 34, 10);
    ctx.fill();
    ctx.fillStyle = '#ffe9f4';
    ctx.textAlign = 'center';
    ctx.fillText(obj, W / 2, 35);
    ctx.textAlign = 'left';
  }

  // Top-right: clock, day, district.
  const d = districtAt(p.x, p.y);
  ctx.fillStyle = 'rgba(8,10,18,0.72)';
  roundRect(ctx, W - 222, 12, 210, 58, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${clockLabel(G.clock)}  •  Day ${G.clock.day}`, W - 26, 36);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = d.accent;
  ctx.fillText(d.name, W - 26, 57);
  ctx.textAlign = 'left';

  // Bottom-right: speed + weapon when driving or armed.
  if (!p.onFoot && p.car) {
    const kmh = Math.round(Math.abs(p.car.speed) * 0.36);
    ctx.fillStyle = 'rgba(8,10,18,0.72)';
    roundRect(ctx, W - 150, H - 66, 138, 54, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${kmh}`, W - 66, H - 30);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('km/h', W - 26, H - 30);
    ctx.textAlign = 'left';
  }
  if (p.onFoot) {
    const w = WEAPONS[p.weapon];
    ctx.fillStyle = 'rgba(8,10,18,0.72)';
    roundRect(ctx, W - 190, H - 66, 178, 54, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(w.name, W - 176, H - 40);
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = '#ffd23e';
    ctx.fillText(p.weapon === 'fists' ? '1 fists · 2 pistol · 3 smg' : `ammo ${p.ammo[p.weapon] || 0}`, W - 176, H - 22);
  }

  // Bottom-center: contextual hint.
  const hint = hintText(G);
  if (hint) {
    ctx.font = '13px system-ui, sans-serif';
    const w = ctx.measureText(hint).width + 28;
    ctx.fillStyle = 'rgba(8,10,18,0.66)';
    roundRect(ctx, (W - w) / 2, H - 34, w, 26, 8);
    ctx.fill();
    ctx.fillStyle = '#dfe6ff';
    ctx.textAlign = 'center';
    ctx.fillText(hint, W / 2, H - 16);
    ctx.textAlign = 'left';
  }

  drawMinimap(G, ctx, 14, H - 194);
  drawToasts(G, ctx, W, H);
  ctx.restore();
}

function objectiveText(G) {
  const ms = G.mission;
  if (ms.active) {
    const m = missionOf(G);
    return `${m.name}: ${stepOf(G).text}`;
  }
  if (ms.nextOffer !== undefined && ms.nextOffer !== null) return `New job: ${ms.nextOffer} — press N to take it`;
  return 'Free roam — press N for the next job';
}

function hintText(G) {
  const p = G.player;
  if (G.shopNear && p.onFoot) return `Press E — ${G.shopNear.name} (${G.shopNear.blurb})`;
  if (p.onFoot) {
    const near = G.nearestCar;
    if (near) return 'Press E to steal the car';
    return 'WASD move · Shift run · Mouse aim · Click attack · E enter car';
  }
  return 'WASD drive · Space handbrake · F leave car · E interact';
}

export function drawMinimap(G, ctx, x, y) {
  const S = 180;
  const scale = S / MAP;
  ctx.save();
  ctx.fillStyle = 'rgba(8,10,18,0.78)';
  roundRect(ctx, x - 6, y - 6, S + 12, S + 12, 10);
  ctx.fill();
  // Ground + roads.
  ctx.fillStyle = '#20242c';
  ctx.fillRect(x, y, S, S);
  ctx.strokeStyle = '#4a4f58';
  ctx.lineWidth = 2;
  for (let gx = 0; gx <= MAP; gx += 384) {
    ctx.beginPath(); ctx.moveTo(x + gx * scale, y); ctx.lineTo(x + gx * scale, y + S); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + gx * scale); ctx.lineTo(x + S, y + gx * scale); ctx.stroke();
  }
  // Water strip.
  ctx.fillStyle = '#1d5f8a';
  ctx.fillRect(x, y, 64 * scale, S);
  const dot = (wx, wy, color, r) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x + wx * scale, y + wy * scale, r || 3, 0, Math.PI * 2); ctx.fill();
  };
  for (const s of G.city.shops) dot(s.x, s.y, s.kind === 'hideout' ? '#7a5cff' : '#2ee6c8', 3);
  const ms = G.mission;
  if (ms.active && ms.target) dot(ms.target.x, ms.target.y, '#ffd23e', 5);
  for (const c of G.cars) if (c.kind === 'police') dot(c.x, c.y, '#5aa2e8', 2.5);
  if (G.heli) dot(G.heli.x, G.heli.y, '#5aa2e8', 3);
  const p = G.player;
  dot(p.x, p.y, '#ff2e88', 4);
  // View rectangle.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + G.cam.x * scale, y + G.cam.y * scale, G.cam.w * scale, G.cam.h * scale);
  ctx.restore();
}

function drawToasts(G, ctx, W, H) {
  const now = G.time;
  let y = H - 220;
  for (let i = G.toasts.length - 1; i >= 0; i -= 1) {
    const t = G.toasts[i];
    const age = now - t.at;
    if (age > 5) { G.toasts.splice(i, 1); continue; }
    ctx.globalAlpha = age > 4 ? (5 - age) : 1;
    ctx.font = '13px system-ui, sans-serif';
    const w = ctx.measureText(t.text).width + 24;
    ctx.fillStyle = t.kind === 'bad' ? 'rgba(120,20,30,0.85)' : t.kind === 'good' ? 'rgba(20,90,40,0.85)' : 'rgba(20,30,60,0.85)';
    roundRect(ctx, 14, y - 20, w, 24, 7);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(t.text, 26, y - 3);
    y -= 30;
  }
  ctx.globalAlpha = 1;
}

export function drawTitle(G, ctx, W, H) {
  ctx.save();
  ctx.fillStyle = 'rgba(5,6,14,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = NEON;
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.fillText('NEON TIDE', W / 2, H / 2 - 110);
  ctx.fillStyle = '#2ee6c8';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText('P O R T   M E R I D I A N', W / 2, H / 2 - 66);
  ctx.fillStyle = '#fff';
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText('Steal cars. Outrun the PMPD. Run the jobs. Own the city.', W / 2, H / 2 - 28);
  const saves = G.saves || [];
  const lines = [
    'ENTER — New game',
    saves[0] ? 'C — Continue (save 1)' : 'C — Continue (no save yet)',
    'H — How to play',
    '',
    'WASD move / drive · Mouse aim · Click attack · E enter car / shop',
    'F leave car · Space handbrake · 1/2/3 weapons · M mute · Esc pause',
  ];
  ctx.font = '16px system-ui, sans-serif';
  lines.forEach((line, i) => {
    ctx.fillStyle = line.startsWith('ENTER') ? '#ffd23e' : '#dfe6ff';
    ctx.fillText(line, W / 2, H / 2 + 24 + i * 28);
  });
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('An original game. Port Meridian, its people and its stories are invented.', W / 2, H - 24);
  ctx.restore();
}

export function drawHowTo(G, ctx, W, H) {
  ctx.save();
  ctx.fillStyle = 'rgba(5,6,14,0.88)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 30px system-ui, sans-serif';
  ctx.fillText('HOW TO PLAY', 90, 90);
  ctx.font = '16px system-ui, sans-serif';
  const lines = [
    'You are a newcomer in Port Meridian. Make money, earn respect, stay out of jail.',
    '',
    'ON FOOT — WASD to walk, Shift to run. Mouse aims, click attacks. E steals the nearest car.',
    'DRIVING — W accelerate, S brake, A/D steer, Space handbrake, F step out.',
    'WANTED — crime raises your stars. At 3 stars the PMPD sets roadblocks; at 4 a helicopter joins.',
    'Lose the heat by hiding, or pay for a respray at Neon Spray. Getting busted costs you cash.',
    'JOBS — press N to take the next job from Rook and Mara. Eight story jobs, plus fares and side work.',
    'SHOPS — Ironworks Arms sells guns and armor. Meridian General heals. The Tide Diner feeds.',
    'SAVE — progress saves at every completed job. C continues your latest save from the title screen.',
    '',
    'Press H or Esc to go back.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, 90, 140 + i * 28));
  ctx.restore();
}

export function drawEnd(G, ctx, W, H, kind) {
  ctx.save();
  ctx.fillStyle = kind === 'busted' ? 'rgba(20,30,90,0.72)' : 'rgba(90,10,20,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 72px system-ui, sans-serif';
  ctx.fillText(kind === 'busted' ? 'BUSTED' : 'WASTED', W / 2, H / 2 - 40);
  ctx.font = '18px system-ui, sans-serif';
  const p = G.player;
  ctx.fillText(kind === 'busted'
    ? `The PMPD hauled you in. You lost $${Math.min(p.cash, 300)} in fines — and a little pride.`
    : 'Port Meridian chewed you up. The Tide crew will remember you, briefly.', W / 2, H / 2 + 6);
  ctx.fillText(`Cash $${p.cash.toLocaleString('en-US')}  •  ${G.mission.done} jobs done  •  Respect ★ ${p.respect}`, W / 2, H / 2 + 44);
  ctx.fillStyle = '#ffd23e';
  ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText('ENTER — try again', W / 2, H / 2 + 92);
  ctx.restore();
}

export function drawPause(G, ctx, W, H) {
  ctx.save();
  ctx.fillStyle = 'rgba(5,6,14,0.6)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText('PAUSED', W / 2, H / 2 - 30);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('Esc resume · M mute · Q save & quit to title', W / 2, H / 2 + 12);
  ctx.restore();
}

export function drawShop(G, ctx, W, H) {
  const shop = G.shopOpen;
  if (!shop) return;
  const menu = shopMenu(shop);
  ctx.save();
  const w = 460, h = 90 + menu.length * 36;
  const x = (W - w) / 2, y = (H - h) / 2;
  ctx.fillStyle = 'rgba(8,10,18,0.92)';
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = NEON;
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 12);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(shop.name, W / 2, y + 36);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = '#ffd23e';
  ctx.fillText(`Cash $${G.player.cash.toLocaleString('en-US')}  •  1–${menu.length} buy · Esc close`, W / 2, y + 60);
  ctx.textAlign = 'left';
  menu.forEach((item, i) => {
    ctx.fillStyle = i === G.shopSel ? '#2ee6c8' : '#dfe6ff';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(`${i + 1}. ${item.label}`, x + 24, y + 92 + i * 36);
  });
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function bar(ctx, x, y, w, h, frac, color, bg) {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
}

function drawStar(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}
