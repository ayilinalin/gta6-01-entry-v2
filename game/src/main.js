// NEON TIDE v2 — entry point: the loop, the screens, and the ?shot= mode
// the screenshots are taken in. The sim itself lives in world.js; this
// file only runs it, draws it, and listens to the player.
import { createGame, stepWorld, resetWorld, STEP } from './world.js';
import { createInput } from './input.js';
import { render, updateCamera } from './render.js';
import { drawHUD, drawTitle, drawHowTo, drawEnd, drawPause, drawShop } from './hud.js';
import { stageShot } from './shots.js';
import { buyItem, shopMenu } from './economy.js';
import { startMission } from './missions.js';
import { saveGame, loadGame, listSaves } from './save.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 1) || 1;
const shotName = params.get('shot') || '';

const G = createGame(seed);
const input = createInput(canvas);
let W = 1280, H = 720;
let prevMouseDown = false;
let shotDone = false;

window.__NEON_TIDE__ = { shot: shotName || null, screen: G.screen, errors: [], time: 0 };
window.addEventListener('error', (e) => {
  window.__NEON_TIDE__.errors.push(String(e.message || e.error || 'error').slice(0, 300));
});

function resize() {
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W; canvas.height = H;
}
window.addEventListener('resize', resize);
resize();

function announce(text) {
  if (statusEl) statusEl.textContent = text;
}

function draw() {
  updateCamera(G, W, H);
  render(G, ctx, W, H);
  if (G.screen === 'play' || G.screen === 'shop') drawHUD(G, ctx, W, H);
  if (G.screen === 'title') drawTitle(G, ctx, W, H);
  if (G.screen === 'howto') drawHowTo(G, ctx, W, H);
  if (G.screen === 'pause') drawPause(G, ctx, W, H);
  if (G.screen === 'shop') drawShop(G, ctx, W, H);
  if (G.screen === 'busted') drawEnd(G, ctx, W, H, 'busted');
  if (G.screen === 'wasted') drawEnd(G, ctx, W, H, 'wasted');
}

function respawn(G, kind) {
  const p = G.player;
  p.hp = 100;
  p.x = 1650; p.y = 2450; // outside Meridian General
  p.onFoot = true;
  if (p.car) { p.car.kind = 'parked'; p.car.driver = false; p.car = null; }
  p.wanted = 0; p.heat = 0;
  G.cops = [];
  G.screen = 'play';
  G.toast(kind === 'busted' ? 'Out on bail. Stay clean — or at least stay quick.' : 'Patched up at Meridian General. Back to work.', 'info');
}

function handleScreenKeys() {
  const p = G.player;
  if (G.screen === 'title') {
    if (input.consumePressed('Enter')) {
      resetWorld(G, seed);
      G.screen = 'play';
      G.audio.resume();
      G.toast('Welcome to Port Meridian. Press N for your first job.', 'info');
      announce('Game started.');
    } else if (input.consumePressed('KeyC')) {
      resetWorld(G, seed);
      if (loadGame(G, 0)) { G.screen = 'play'; G.toast('Save loaded — welcome back.', 'good'); }
      else G.toast('No save in slot 1 yet.', 'bad');
    } else if (input.consumePressed('KeyH')) {
      G.screen = 'howto';
    }
  } else if (G.screen === 'howto') {
    if (input.consumePressed('KeyH') || input.consumePressed('Escape')) G.screen = 'title';
  } else if (G.screen === 'play') {
    if (input.consumePressed('Escape')) { G.screen = 'pause'; return; }
    if (input.consumePressed('KeyM')) {
      const muted = G.audio.toggleMute();
      G.toast(muted ? 'Sound off.' : 'Sound on.', 'info');
    }
  } else if (G.screen === 'pause') {
    if (input.consumePressed('Escape')) G.screen = 'play';
    else if (input.consumePressed('KeyQ')) {
      saveGame(G, 0);
      G.saves = listSaves();
      G.screen = 'title';
    } else if (input.consumePressed('KeyM')) G.audio.toggleMute();
  } else if (G.screen === 'shop') {
    if (input.consumePressed('Escape')) { G.shopOpen = null; G.screen = 'play'; return; }
    const menu = shopMenu(G.shopOpen);
    for (let i = 0; i < menu.length; i += 1) {
      if (input.consumePressed(`Digit${i + 1}`)) buyItem(G, menu[i].action);
    }
    if (input.consumePressed('ArrowDown')) G.shopSel = Math.min(menu.length - 1, G.shopSel + 1);
    if (input.consumePressed('ArrowUp')) G.shopSel = Math.max(0, G.shopSel - 1);
    if (input.consumePressed('Enter') && menu[G.shopSel]) buyItem(G, menu[G.shopSel].action);
  } else if (G.screen === 'busted' || G.screen === 'wasted') {
    if (input.consumePressed('Enter')) respawn(G, G.screen);
  }
}

let acc = 0;
let last = performance.now();

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  input.mousePressedEdge = input.mouseDown && !prevMouseDown;
  prevMouseDown = input.mouseDown;

  handleScreenKeys();
  if (G.screen === 'play') {
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 5) {
      stepWorld(G, input, STEP);
      acc -= STEP;
      n += 1;
      if (G.screen !== 'play') break;
    }
    if (n === 5) acc = 0;
  }
  input.clearPressed();
  draw();
  window.__NEON_TIDE__.screen = G.screen;
  window.__NEON_TIDE__.time = G.time;
  window.__NEON_TIDE__.wanted = G.player.wanted;
  window.__NEON_TIDE__.cash = G.player.cash;
  window.__NEON_TIDE__.missionsDone = G.mission.done;
  window.__NEON_TIDE__.player = { x: Math.round(G.player.x), y: Math.round(G.player.y), onFoot: G.player.onFoot };
}

// Screenshot mode: stage the scene, draw one frame, stop. No loop, so the
// captured frame is exactly the staged state.
if (shotName) {
  try {
    const staged = stageShot(shotName, G);
    G.screen = staged.screen;
    resize();
    // Snap the camera onto the player: updateCamera only lerps 12% a
    // frame, and a staged shot draws exactly one frame.
    const p = G.player;
    G.cam.x = Math.max(0, Math.min(3072 - W, p.x - W / 2));
    G.cam.y = Math.max(0, Math.min(3072 - H, p.y - H / 2));
    draw();
    window.__NEON_TIDE__.screen = G.screen;
    window.__NEON_TIDE__.time = G.time;
    window.__NEON_TIDE__.wanted = G.player.wanted;
    window.__NEON_TIDE__.cash = G.player.cash;
    window.__NEON_TIDE__.missionsDone = G.mission.done;
    window.__NEON_TIDE__.player = { x: Math.round(G.player.x), y: Math.round(G.player.y), onFoot: G.player.onFoot };
    window.__NEON_TIDE__.staged = true;
    shotDone = true;
  } catch (err) {
    window.__NEON_TIDE__.errors.push(`stageShot failed: ${String(err && err.message || err).slice(0, 300)}`);
  }
}

if (!shotDone) requestAnimationFrame(frame);
