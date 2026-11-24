// Solara Bay — shots: the four deterministic staged scenes. Each one plays
// the real rules forward from a fresh world for a fixed number of 60 Hz
// steps, steered by the same autopilot a player would use, so the frame is
// what a short game really looks like and the same seed always gives the
// same frame. ?shot=cover|foot|chase|meta stages the scene; the harness
// drives it with window.__step(n), which headless Chrome cannot throttle.
import * as THREE from 'three';
import { STEP, MISSIONS } from './config.js';
import { createDownedRing } from './entities.js';

export const SHOT_NAMES = ['cover', 'foot', 'chase', 'meta'];

// Park a police car exactly where the cover frame needs it: heading in the
// sim's +z convention, speed in m/s, light bar flashing.
function parkPolice(game, i, x, z, heading, speed) {
  const c = game.cars.filter(v => v.police)[i];
  if (!c) return;
  c.x = x; c.z = z; c.heading = heading; c.speed = speed;
  c.group.position.set(x, 0, z);
  c.group.rotation.y = heading - Math.PI / 2;
}

export function stageShot(name, api) {
  const { game, world, scene } = api;
  const s = game.state;
  game.reset();
  s.mode = 'play';
  api.setHint('WASD drive · E enter car · F fire · J jetpack · M map');
  api.showTitle(false);
  api.showMeta(false);

  if (name === 'cover') {
    // M6 WRECK THE REGENT, 12:00 noon, $18,450, wanted 5, 111 km/h.
    // A north-east chase along the beach: the hero stays left-centre while
    // the ocean, the yacht and the Ferris wheel fill the right of the frame.
    game.setMission(5);
    s.cash = 18450;
    s.time = 12 * 60;
    world.setSky('noon');
    game.placePlayer(95, 30, Math.PI * 0.75, true);
    game.hero.speed = 30.8; // 111 km/h
    game.spawnPolice(5);
    game.spawnHeli(1);
    game.helis[0].angle = -0.67; game.helis[0].radius = 35; game.helis[0].height = 26;
    // Five units parked 20–40 m north-east of the hero's end position,
    // FACING the hero — units parked facing away drive east into the x=120
    // clamp before their turn rate lets them swing around, and units parked
    // too close ram the hero and pile up on top of it.
    parkPolice(game, 0, 118, -25, -0.36, 28);
    parkPolice(game, 1, 118, -5, -0.75, 28);
    parkPolice(game, 2, 112, -30, -0.18, 30);
    parkPolice(game, 3, 106, -24, -0.03, 30);
    parkPolice(game, 4, 118, -15, -0.50, 32);
    game.spawnTraffic(3);
    game.spawnCrowd(16, 100, 40, 24);
    game.spawnCrowd(10, 96, -30, 18);
    // No dialogue in the cover: the box would sit on top of the police cars.
    s.dialogue = null; s.dialogueT = 0;
    api.setFov(70);
    api.setRig({ mode: 'follow', back: 10, right: 2, up: 4.5, lookAhead: 18, lookRight: 8, lookUp: 4 });
    return { input: 'cover', steps: 30 };
  }

  if (name === 'foot') {
    // M2 COLLECT THE DROP, 14:30, $7,270, wanted 2 — a shooting scene.
    game.setMission(1, 1);
    s.cash = 7270;
    s.time = 14 * 60 + 30;
    world.setSky('noon');
    game.placePlayer(40, 80, Math.PI, false);
    // Park the hero car out of the camera's way — it hid the player.
    game.hero.x = 18; game.hero.z = 96;
    game.setWanted(2);
    // Armed enemies offset east of the central stall, so the player's tracer
    // crosses open ground instead of hiding behind the stall awning — but
    // still inside the 0.35 rad aim-assist cone, or the shot misses.
    game.spawnEnemies(3, 46, 62, 10);
    // Stage the rifle: the pistol needs 5 hits to drop a 100 HP enemy, the
    // rifle (34 dmg) drops one in 3 of the 6 staged shots.
    s.weapon = 3;
    for (const e of game.peds.filter(p => p.armed)) { e.heading = Math.atan2(40 - e.x, 80 - e.z); e.group.rotation.y = e.heading; }
    // One downed enemy with a pulsing red ring, right of the player.
    const downed = game.spawnEnemies(1, 45, 72, 2)[0];
    downed.downed = true; downed.hp = 0;
    downed.group.rotation.x = -Math.PI / 2; downed.group.position.y = 0.35;
    downed.ring = createDownedRing();
    downed.ring.position.set(45, 0, 72);
    scene.add(downed.ring);
    game.spawnCrowd(30, 40, 58, 26);
    game.spawnCrowd(12, 30, 80, 14);
    game.showDialogue('VEX', 'The drop is in the fruit market. The Red Jacks know. Bring a gun.', 6);
    api.setHint('F — FIRE · R — RELOAD · Hold the market, drop the Red Jacks');
    api.setRig({ mode: 'fixed', pos: new THREE.Vector3(43.5, 2.4, 86), look: new THREE.Vector3(40, 1.7, 58) });
    return { input: 'foot', steps: 90 };
  }

  if (name === 'chase') {
    // M3 OUTRUN THE SUNSET ROADBLOCK, 17:45 golden hour, $12,860, wanted 3.
    game.setMission(2);
    s.cash = 12860;
    s.time = 17 * 60 + 45;
    world.setSky('golden');
    game.placePlayer(80, -16, Math.PI, false);
    s.jetpackOn = true; s.fuel = 78;
    s.player.y = 28; s.player.flying = true;
    game.playerPed.position.set(80, 28, -16);
    game.playerPed.children.forEach(c => { if (c.userData && c.userData.flames) c.visible = true; });
    game.setWanted(3);
    game.spawnHeli(2);
    game.helis[0].angle = -2.25; game.helis[0].radius = 32; game.helis[0].height = 34;
    game.helis[1].angle = -0.85; game.helis[1].radius = 22; game.helis[1].height = 36;
    game.spawnCrowd(10, 90, -40, 20);
    game.showDialogue('MARA', 'Roadblock on Ocean Drive. Take the jetpack — over it, not through it.', 6);
    api.setHint('JETPACK — WASD fly · SHIFT boost · land before the fuel runs out');
    api.setRig({ mode: 'follow', back: 12, right: 4, up: -1, lookAhead: 26 });
    return { input: 'chase', steps: 60 };
  }

  // Meta: map / stats, $21,340, 66.1%, slot 1 filled.
  s.cash = 21340;
  world.setSky('golden');
  game.setMission(5);
  // setMission resets the clock to the mission default — set the staged
  // 18:30 after it, just before the overlay renders.
  s.time = 18 * 60 + 30;
  game.placePlayer(80, 20, Math.PI, true);
  api.renderMeta(game, [
    { label: 'SOL — CAREER', detail: '$21,340 · 5/8 · 22/11/2026' },
    { label: 'VEX RUN', detail: '$8,120 · 3/8 · 21/11/2026' },
    null,
  ]);
  // The overlay is ~960 px tall; shrink it to fit the 720 px frame.
  document.getElementById('meta').style.zoom = '0.72';
  api.showMeta(true);
  return { input: 'meta', steps: 30 };
}

// Per-shot autopilot input for __step: cover drives the chase, chase flies
// the jetpack forward on boost, foot stands and fires.
export function shotInput(name, game, input) {
  const s = game.state;
  input.forward = false; input.back = false; input.left = false; input.right = false;
  input.boost = false; input.brake = false; input.fire = false;
  if (name === 'cover') {
    // Chase north-east up the beach toward the waterline, not the stage
    // beacon on the boulevard: the frame needs the ocean on its right.
    game.autopilot(118, -40, STEP, input);
    // The staged chase holds 111 km/h: cruise-control the hero speed so
    // police rams cannot drag the frame's speedometer off the mark.
    game.hero.speed = 30.8;
    input.forward = true; input.boost = false; input.brake = false;
    return input;
  }
  if (name === 'chase') {
    input.forward = true; input.boost = true;
    return input;
  }
  if (name === 'foot') {
    input.fire = true;
    return input;
  }
  return input;
}

// Fresh combat effects right before the screenshot, so tracers and the
// muzzle flash are alive in the frame (they fade in 0.14 s of sim time).
export function stageFx(name, game, scene) {
  const s = game.state;
  if (name === 'foot') {
    s.lastShot = -10;
    game.fireWeapon();
    return;
  }
  if (name === 'chase') {
    for (const h of game.helis) {
      const from = h.group.position.clone();
      const to = new THREE.Vector3(s.player.x + (Math.random() - 0.5) * 4, s.player.y + 1, s.player.z + (Math.random() - 0.5) * 4);
      game.addTracer(from, to, 0xff6a5a);
    }
  }
}
