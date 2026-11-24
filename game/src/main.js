// Solara Bay — main: renderer, camera rig, input, saves, the game loop, and
// the deterministic hooks the screenshot harness and the playtest drive:
// window.__step(n) advances the fixed 60 Hz sim, window.__shot(name)
// stages a scene, window.__fx(name) fires fresh combat effects, and
// window.__playtest() runs mission 1 end to end by autopilot.
import * as THREE from 'three';
import { STEP, MISSIONS, WEAPONS, fmtCash } from './config.js';
import { buildWorld } from './world.js';
import { createGame } from './missions.js';
import { updateHUD, buildWeaponSlots, setHint, showTitle, showMeta, isMetaOpen, renderMeta, loadSaves, storeSave } from './hud.js';
import { createAudio } from './audio.js';
import { stageShot, shotInput, stageFx, SHOT_NAMES } from './shots.js';

window.__errors = [];
window.addEventListener('error', e => window.__errors.push(String(e.message || e.error)));
window.addEventListener('unhandledrejection', e => window.__errors.push('rejection: ' + String(e.reason)));

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(84, 5, 46);

const world = buildWorld(scene);
const game = createGame(scene, world);
const audio = createAudio();
buildWeaponSlots();

// ---- camera rig: chase by default, fixed or follow for staged shots ----
const rig = { mode: 'chase', back: 11, right: 3.5, up: 4.2, lookAhead: 14, pos: new THREE.Vector3(), look: new THREE.Vector3() };
const camTarget = new THREE.Vector3(84, 5, 46);
const lookTarget = new THREE.Vector3(80, 1, 20);
function updateCamera(dt, snap = false) {
  const s = game.state;
  const p = s.player;
  if (rig.mode === 'fixed') {
    camTarget.copy(rig.pos); lookTarget.copy(rig.look);
  } else {
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    // True right = forward rotated -90 degrees about Y: (-cos h, sin h).
    const rx = -Math.cos(p.heading), rz = Math.sin(p.heading);
    const back = rig.mode === 'follow' ? rig.back : 11;
    const right = rig.mode === 'follow' ? rig.right : 3.5;
    const up = rig.mode === 'follow' ? rig.up : 4.2;
    const ahead = rig.mode === 'follow' ? rig.lookAhead : 14;
    const lookRight = rig.lookRight || 0;
    const lookUp = rig.lookUp || 0;
    camTarget.set(
      p.x - fx * back + rx * right,
      p.y + up,
      p.z - fz * back + rz * right,
    );
    lookTarget.set(p.x + fx * ahead + rx * lookRight, p.y + 1.6 + lookUp, p.z + fz * ahead + rz * lookRight);
  }
  const k = snap ? 1 : 1 - Math.exp(-9 * dt);
  camera.position.lerp(camTarget, k);
  const cur = new THREE.Vector3();
  camera.getWorldDirection(cur);
  camera.lookAt(lookTarget);
}

// ---- input ----
const keys = {};
const input = { forward: false, back: false, left: false, right: false, boost: false, brake: false, fire: false, reload: false, jetpackToggle: false };
let shotName = null;
let metaOpen = false;

window.addEventListener('keydown', e => {
  if (e.key === 'Tab') e.preventDefault();
  keys[e.key.toLowerCase()] = true;
  audio.unlock();
  if (e.key === 'Enter' && game.state.mode === 'title') startGame();
  if (e.key.toLowerCase() === 'e' && game.state.mode === 'play' && !e.repeat) game.enterExitCar();
  if (e.key.toLowerCase() === 'j' && game.state.mode === 'play' && !e.repeat) input.jetpackToggle = true;
  if ((e.key.toLowerCase() === 'm' || e.key === 'Tab') && game.state.mode === 'play' && !e.repeat) toggleMeta();
  if (e.key === 'Escape' && game.state.mode === 'play') { game.state.mode = 'paused'; setHint('PAUSED — Esc to resume'); }
  else if (e.key === 'Escape' && game.state.mode === 'paused') { game.state.mode = 'play'; setHint('WASD drive · E enter car · F fire · J jetpack · M map'); }
  if (/^[1-6]$/.test(e.key)) game.state.weapon = Number(e.key) - 1;
  if (e.key.toLowerCase() === 'r') input.reload = true;
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; if (e.key.toLowerCase() === 'r') input.reload = false; });
canvas.addEventListener('pointerdown', () => audio.unlock());

function readKeys() {
  input.forward = !!(keys['w'] || keys['arrowup']);
  input.back = !!(keys['s'] || keys['arrowdown']);
  input.left = !!(keys['a'] || keys['arrowleft']);
  input.right = !!(keys['d'] || keys['arrowright']);
  input.boost = !!keys['shift'];
  input.brake = !!keys[' '];
  input.fire = !!(keys['f'] || keys['mouse0']);
  return input;
}

function toggleMeta() {
  metaOpen = !metaOpen;
  if (metaOpen) { renderMeta(game); showMeta(true); }
  else showMeta(false);
}

function startGame() {
  audio.unlock();
  game.reset();
  game.state.mode = 'play';
  showTitle(false);
  setHint('WASD drive · E enter car · F fire · J jetpack · M map');
}

document.getElementById('playBtn').addEventListener('click', startGame);

// ---- staged shots via ?shot= ----
const params = new URLSearchParams(location.search);
const shotParam = params.get('shot');
const api = {
  game, world, scene,
  setHint, showTitle, showMeta,
  renderMeta: (g, saves) => renderMeta(g, saves),
  setRig(r) { Object.assign(rig, r); },
  setFov(f) { camera.fov = f; camera.updateProjectionMatrix(); },
};
if (shotParam && SHOT_NAMES.includes(shotParam)) {
  shotName = shotParam;
  const staged = stageShot(shotParam, api);
  updateCamera(STEP, true);
  renderer.render(scene, camera);
  updateHUD(game, world.sky);
}

// ---- one fixed step + render (shared by the live loop and __step) ----
// simStep is the pure simulation (no render/HUD/audio) — the playtest runs
// thousands of these, and rendering each one in SwiftShader would take
// hours, so it renders once at the end instead.
function simStep(dt, inp) {
  game.step(dt, inp);
  input.jetpackToggle = false;
  // Drain sim events: sounds, toasts, autosave.
  const evs = game.state.events;
  while (evs.length) {
    const ev = evs.shift();
    if (ev.type === 'shot') audio.shot();
    if (ev.type === 'stage') { audio.stage(); game.state.toast = 'OBJECTIVE COMPLETE'; game.state.toastT = 2.5; }
    if (ev.type === 'mission-complete') {
      audio.missionComplete();
      const done = game.state.missionDone.filter(Boolean).length;
      const d = new Date();
      const ds = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      storeSave(0, 'SOL — CAREER', `${fmtCash(game.state.cash)} · ${done}/8 · ${ds}`);
    }
    if (ev.type === 'reload') game.state.toast = 'RELOADING…';
  }
}
function renderFrame(dt) {
  updateCamera(dt, shotName !== null);
  renderer.render(scene, camera);
  updateHUD(game, world.sky);
  audio.engine(game.state.speedKmh, !game.state.player.onFoot);
  audio.siren(game.state.wanted);
}
function frame(dt, inp) {
  simStep(dt, inp);
  renderFrame(dt);
}

// ---- live loop (desktop Chrome) ----
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (game.state.mode === 'play' && !metaOpen && !shotName) frame(dt, readKeys());
  else if (game.state.mode === 'title') { world.update(dt, game.state.t); game.state.t += dt; renderer.render(scene, camera); }
  // In shot mode the harness drives every render through __step / __fx;
  // the live loop renders nothing, so it cannot starve the CDP calls.
}
// A staged shot already reset the world inside stageShot; a plain load
// starts from a fresh world behind the title screen.
if (!shotName) game.reset();
requestAnimationFrame(loop);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- deterministic hooks for the harness and the playtest ----
// The sim advances every step, but the harness renders only every 15th
// step and the final one: the sim is deterministic and the camera snaps in
// shot mode, so the final frame is identical — while 150 full SwiftShader
// renders in a row wedge the headless compositor.
window.__step = function (n, renderEvery = 15) {
  const inp = { forward: false, back: false, left: false, right: false, boost: false, brake: false, fire: false, reload: false, jetpackToggle: false };
  for (let i = 0; i < n; i++) {
    if (shotName) shotInput(shotName, game, inp);
    else readKeys();
    simStep(STEP, inp);
    if (i % renderEvery === renderEvery - 1 || i === n - 1) renderFrame(STEP);
  }
  const s = game.state;
  return { mode: s.mode, mission: s.missionIndex + 1, stage: s.stageIndex, cash: Math.round(s.cash), wanted: s.wanted, speed: Math.round(s.speedKmh), health: Math.round(s.health), fuel: Math.round(s.fuel), errors: window.__errors.slice(), player: [Math.round(s.player.x), Math.round(s.player.y), Math.round(s.player.z)], helis: game.helis.map(h => [Math.round(h.group.position.x), Math.round(h.group.position.y), Math.round(h.group.position.z)]), police: game.cars.filter(c => c.police).map(c => [Math.round(c.x), Math.round(c.z)]) };
};
window.__shot = function (name) {
  if (!SHOT_NAMES.includes(name)) return { ok: false };
  shotName = name;
  const staged = stageShot(name, api);
  updateCamera(STEP, true);
  renderer.render(scene, camera);
  updateHUD(game, world.sky);
  return { ok: true, ...staged };
};
window.__fx = function (name) {
  stageFx(name || shotName, game, scene);
  const inp = { forward: false, back: false, left: false, right: false, boost: false, brake: false, fire: false, reload: false, jetpackToggle: false };
  if (shotName) shotInput(shotName, game, inp);
  simStep(STEP, inp);
  renderFrame(STEP);
  return { ok: true, errors: window.__errors.slice(), kills: game.state.kills, ammo: game.state.ammo[game.state.weapon], shot: game.debugShot() };
};
window.__playtest = function () {
  shotName = null;
  game.reset();
  game.state.mode = 'play';
  showTitle(false);
  const inp = { forward: false, back: false, left: false, right: false, boost: false, brake: false, fire: false, reload: false, jetpackToggle: false };
  let steps = 0;
  const maxSteps = 60 * 240;
  while (steps < maxSteps) {
    const stage = game.currentStage();
    if (!stage) break;
    if (game.state.missionDone[0]) break;
    if (game.state.mode === 'busted') break;
    if (game.state.player.onFoot) game.enterExitCar();
    game.autopilot(stage.at[0], stage.at[2], STEP, inp);
    simStep(STEP, inp);
    steps++;
  }
  updateCamera(STEP, true);
  renderer.render(scene, camera);
  updateHUD(game, world.sky);
  const s = game.state;
  return { complete: !!s.missionDone[0], steps, simSeconds: steps / 60, mission: s.missionIndex + 1, stage: s.stageIndex, cash: Math.round(s.cash), health: Math.round(s.health), wanted: s.wanted, mode: s.mode, errors: window.__errors.slice() };
};
window.__game = game;
window.__world = world;
window.__shotNames = SHOT_NAMES;
