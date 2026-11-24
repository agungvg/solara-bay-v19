// Solara Bay — missions: the sim core. Player on foot / in car / on jetpack,
// traffic, police chase AI, helicopters, shooting combat, the wanted 0–5
// state machine, eight staged story missions, and the autopilot the
// playtest and the screenshot harness drive.
import * as THREE from 'three';
import {
  MISSIONS, POLICE_UNITS, WEAPONS, STEP, WORLD, clamp, dist2d, fmtClock, fmtCash,
} from './config.js';
import { createCar, createScooter, createTank, createHeli, createJetpack, createPed, pedWalk, createDownedRing } from './entities.js';

const HERO_MAX = 42; // m/s ≈ 151 km/h
const POLICE_MAX = 40;

function flashTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,220,1)'); grad.addColorStop(0.4, 'rgba(255,200,80,0.9)'); grad.addColorStop(1, 'rgba(255,120,0,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); return t;
}

export function createGame(scene, world) {
  const state = {
    mode: 'title', t: 0, time: 12 * 60, cash: 12340, wanted: 0, health: 100,
    fuel: 100, jetpackOn: false, jetpackOwned: true,
    missionIndex: 0, stageIndex: 0, kills: 0, missionTime: 0, missionDone: [false, false, false, false, false, false, false, false],
    speedKmh: 0, weapon: 0, ammo: WEAPONS.map(w => w.ammo),
    player: { x: 80, z: 30, y: 0, heading: Math.PI, speed: 0, onFoot: false, flying: false, vy: 0 },
    banner: null, toast: null, toastT: 0, damageFlash: 0,
    dialogue: null, dialogueT: 0, lastShot: 0, reloadT: 0,
    stats: { shotsFired: 0, shotsHit: 0, carsStolen: 0, distanceKm: 0, topSpeed: 0, jetpackFlights: 0 },
    events: [],
  };

  const cars = [];      // {group, kind, x, z, heading, speed, police, unit, traffic, road, dir, alive}
  const helis = [];     // {group, angle, radius, height, police}
  const peds = [];      // {group, x, z, heading, speed, armed, hp, downed, ring, wander, shootT}
  const tracers = [];   // {line, life, max}
  const rng = { s: 1234567 };
  const rnd = () => { rng.s = (rng.s * 1664525 + 1013904223) >>> 0; return rng.s / 4294967296; };

  // ---- player rig: one ped mesh + jetpack + hero car ----
  const playerPed = createPed({ seed: 42 });
  playerPed.scale.setScalar(1.05);
  scene.add(playerPed);
  const jetpack = createJetpack();
  jetpack.position.set(0, 1.25, -0.28);
  jetpack.visible = false;
  playerPed.add(jetpack);
  const muzzle = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTexture(), transparent: true, depthWrite: false }));
  muzzle.scale.set(2.4, 2.4, 1); muzzle.visible = false;
  muzzle.position.set(0.4, 1.3, 0.6);
  playerPed.add(muzzle);

  const heroCar = createCar('hero');
  scene.add(heroCar);
  let hero = { group: heroCar, kind: 'hero', x: 80, z: 30, heading: Math.PI, speed: 0, police: false, alive: true };
  cars.push(hero);

  const beacon = world.makeBeacon();
  scene.add(beacon);

  function placePlayer(x, z, heading = Math.PI, inCar = true) {
    state.player.x = x; state.player.z = z; state.player.heading = heading;
    state.player.speed = 0; state.player.y = 0; state.player.vy = 0; state.player.flying = false;
    hero.x = x; hero.z = z; hero.heading = heading; hero.speed = 0;
    state.player.onFoot = !inCar;
    playerPed.visible = !inCar;
    if (!inCar) { playerPed.position.set(x, 0, z); playerPed.rotation.y = heading; }
    syncHero();
  }

  function syncHero() {
    heroCar.position.set(hero.x, 0, hero.z);
    // The car mesh faces local +x; the sim heading faces +z, so -90 degrees.
    heroCar.rotation.y = hero.heading - Math.PI / 2;
    const w = heroCar.userData.wheels;
    for (const wh of w) wh.rotation.z -= hero.speed * STEP * 2.2;
  }

  function spawnTraffic(n) {
    const kinds = ['traffic', 'taxi', 'red', 'teal'];
    for (let i = 0; i < n; i++) {
      const alongX = rnd() < 0.5;
      const car = createCar(kinds[i % kinds.length]);
      scene.add(car);
      const c = alongX
        ? { group: car, kind: 'traffic', x: -120 + rnd() * 190, z: WORLD.roadZ[Math.floor(rnd() * WORLD.roadZ.length)], heading: rnd() < 0.5 ? Math.PI / 2 : -Math.PI / 2, speed: 8 + rnd() * 6, traffic: 'x', dir: 1, alive: true }
        : { group: car, kind: 'traffic', x: WORLD.roadX[Math.floor(rnd() * WORLD.roadX.length)], z: -160 + rnd() * 320, heading: rnd() < 0.5 ? 0 : Math.PI, speed: 8 + rnd() * 6, traffic: 'z', dir: 1, alive: true };
      c.dir = c.heading === Math.PI / 2 || c.heading === 0 ? 1 : -1;
      cars.push(c);
    }
  }

  function spawnPolice(n, nearPlayer = true) {
    clearPolice();
    for (let i = 0; i < n; i++) {
      const car = createCar('police');
      scene.add(car);
      const a = (i / Math.max(1, n)) * Math.PI * 2 + 0.6;
      const px = nearPlayer ? state.player.x + Math.cos(a) * (16 + i * 6) : 80 + (i - 2) * 14;
      const pz = nearPlayer ? state.player.z + Math.sin(a) * (16 + i * 6) : -40 + i * 10;
      const unit = POLICE_UNITS[i % POLICE_UNITS.length];
      cars.push({ group: car, kind: 'police', x: clamp(px, -128, 118), z: clamp(pz, -168, 168), heading: a, speed: 0, police: true, unit, alive: true });
    }
    state.wanted = Math.max(state.wanted, n);
  }
  function clearPolice() {
    for (let i = cars.length - 1; i >= 0; i--) {
      if (cars[i].police) { scene.remove(cars[i].group); cars.splice(i, 1); }
    }
  }
  function policeCount() { return cars.filter(c => c.police && c.alive).length; }

  function spawnHeli(n, police = true) {
    clearHelis();
    for (let i = 0; i < n; i++) {
      const h = createHeli(police);
      scene.add(h);
      helis.push({ group: h, angle: (i / Math.max(1, n)) * Math.PI * 2, radius: 26 + i * 8, height: 26 + i * 4, police });
    }
  }
  function clearHelis() {
    for (const h of helis) scene.remove(h.group);
    helis.length = 0;
  }

  function spawnPed(x, z, opts = {}) {
    const g = createPed(opts);
    scene.add(g);
    const p = { group: g, x, z, heading: rnd() * Math.PI * 2, speed: opts.armed ? 0 : 1 + rnd() * 1.4, armed: !!opts.armed, hp: 100, downed: false, ring: null, wander: rnd() * 10, shootT: 1 + rnd() * 2, guard: !!opts.guard };
    g.position.set(x, 0, z); g.rotation.y = p.heading;
    peds.push(p);
    return p;
  }
  function spawnCrowd(n, cx, cz, spread = 26) {
    for (let i = 0; i < n; i++) spawnPed(cx + (rnd() - 0.5) * spread * 2, cz + (rnd() - 0.5) * spread * 2, { seed: 100 + i });
  }
  function spawnEnemies(n, cx, cz, spread = 12) {
    const out = [];
    for (let i = 0; i < n; i++) out.push(spawnPed(cx + (rnd() - 0.5) * spread, cz + (rnd() - 0.5) * spread, { seed: 300 + i, armed: true }));
    return out;
  }
  function clearPeds() {
    for (const p of peds) { scene.remove(p.group); if (p.ring) scene.remove(p.ring); }
    peds.length = 0;
  }

  // ---- shooting: tracers, muzzle flash, hits, enemies shooting back ----
  // Tracers are thin additive cylinders, not 1 px lines: a 1 px line is
  // invisible in a screenshot after palette reduction.
  function addTracer(from, to, color = 0xffe98a) {
    const dir = to.clone().sub(from);
    const len = dir.length();
    const geo = new THREE.CylinderGeometry(0.2, 0.2, len, 6, 1, true);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    scene.add(mesh);
    tracers.push({ line: mesh, life: 0.25, max: 0.25 });
  }
  function fireWeapon() {
    if (state.reloadT > 0 || state.mode !== 'play') return;
    if (state.ammo[state.weapon] <= 0) { state.reloadT = 1.2; state.events.push({ type: 'reload' }); return; }
    const w = WEAPONS[state.weapon];
    if (state.t - state.lastShot < w.rate) return;
    state.lastShot = state.t;
    state.ammo[state.weapon] -= 1;
    state.stats.shotsFired += 1;
    const p = state.player;
    const from = new THREE.Vector3(p.x + Math.sin(p.heading) * 0.4, p.y + 1.35, p.z + Math.cos(p.heading) * 0.4);
    // Aim assist: the nearest armed enemy near the firing line pulls the
    // shot toward them, so combat reads — and lands — instead of whistling
    // past enemies standing a few metres off axis.
    let aim = null, aimD = 45;
    for (const e of peds) {
      if (e.downed || !e.armed) continue; // same armed-only rule as the hit test: the crowd must not soak the assist
      const dx = e.x - p.x, dz = e.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > 45) continue;
      const ang = Math.abs(Math.atan2(dx, dz) - p.heading);
      const wrapped = ang > Math.PI ? Math.PI * 2 - ang : ang;
      if (wrapped < 0.7 && d < aimD) { aim = e; aimD = d; }
    }
    const dir = aim
      ? new THREE.Vector3(aim.x - from.x, 1.2 - from.y, aim.z - from.z).normalize()
      : new THREE.Vector3(Math.sin(p.heading), p.y > 2 ? -0.12 : 0.02, Math.cos(p.heading)).normalize();
    muzzle.visible = true; state.muzzleT = 0.09;
    // Hit the nearest ARMED enemy in the firing line: the crowd wanders
    // through the line, and hitting them would spread every shot so thin
    // that nothing ever drops. The tracer still reads past them.
    let best = null, bestD = 60;
    for (const e of peds) {
      if (e.downed || !e.armed) continue;
      const dx = e.x - p.x, dz = e.z - p.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > 60) continue;
      const along = dx * dir.x + dz * dir.z;
      const side = Math.abs(dx * dir.z - dz * dir.x);
      if (along > 0 && side < 3.5 + d * 0.06 && d < bestD) { best = e; bestD = d; }
    }
    let end;
    if (best) {
      end = new THREE.Vector3(best.x, 1.2, best.z);
      best.hp -= w.dmg;
      state.stats.shotsHit += 1;
      if (best.hp <= 0 && !best.downed) {
        best.downed = true; state.kills += 1;
        best.group.rotation.x = -Math.PI / 2; best.group.position.y = 0.35;
        best.ring = createDownedRing();
        best.ring.position.set(best.x, 0, best.z);
        scene.add(best.ring);
        if (state.wanted < 2) setWanted(2);
      }
    } else {
      end = from.clone().add(dir.clone().multiplyScalar(55));
    }
    addTracer(from, end, 0xffe98a);
    state.events.push({ type: 'shot' });
  }

  function enemyFire(e) {
    const p = state.player;
    const from = new THREE.Vector3(e.x, 1.3, e.z);
    const to = new THREE.Vector3(p.x + (rnd() - 0.5) * 1.5, p.y + 1.2, p.z + (rnd() - 0.5) * 1.5);
    addTracer(from, to, 0xff6a5a);
    state.health = Math.max(0, state.health - 5);
    state.damageFlash = 1;
    if (state.wanted < 2) setWanted(2);
  }

  function setWanted(n) {
    n = clamp(Math.round(n), 0, 5);
    if (n === state.wanted) return;
    state.wanted = n;
    if (n === 0) { clearPolice(); clearHelis(); return; }
    spawnPolice(Math.min(n, 5));
    if (n >= 3 && helis.length === 0) spawnHeli(1);
    if (n < 3) clearHelis();
  }

  // ---- missions ----
  function currentMission() { return MISSIONS[state.missionIndex]; }
  function currentStage() { const m = currentMission(); return m ? m.stages[state.stageIndex] : null; }
  function setMission(i, stage = 0) {
    state.missionIndex = clamp(i, 0, MISSIONS.length - 1);
    state.stageIndex = stage; state.kills = 0; state.missionTime = 0;
    const m = currentMission();
    world.setSky(m.sky);
    state.time = m.time;
    if (m.intro) showDialogue(m.intro[0], m.intro[1]);
  }
  function showDialogue(who, text, dur = 5) {
    state.dialogue = { who, text }; state.dialogueT = dur;
  }
  function completeStage() {
    const m = currentMission();
    state.stageIndex += 1;
    state.events.push({ type: 'stage' });
    if (state.stageIndex >= m.stages.length) completeMission();
    else showDialogue('MARA', 'Good. Next: ' + m.stages[state.stageIndex].label, 4);
  }
  function completeMission() {
    const m = currentMission();
    state.cash += m.cash;
    state.missionDone[state.missionIndex] = true;
    const mins = Math.max(1, Math.round(state.missionTime / 60));
    const rating = state.health > 70 && mins <= 6 ? 'S' : state.health > 40 ? 'A' : 'B';
    state.banner = { big: 'MISSION COMPLETE', sub: `${m.name}  ·  +${fmtCash(m.cash)}  ·  RATING ${rating}  ·  ${mins} MIN` };
    state.events.push({ type: 'mission-complete', mission: m.id, rating });
    setTimeout(() => { state.banner = null; }, 4200);
    if (state.missionIndex < MISSIONS.length - 1) {
      setTimeout(() => setMission(state.missionIndex + 1), 1200);
    } else {
      state.banner = { big: 'KING OF SOLARA BAY', sub: 'Every mission complete — the city is yours.' };
    }
    if (state.wanted > 0) setWanted(Math.max(0, state.wanted - 2));
  }

  // ---- input + per-frame sim ----
  function step(dt, input) {
    state.t += dt;
    state.missionTime += dt;
    if (state.mode !== 'play') { world.update(dt, state.t); return; }
    const p = state.player;
    const m = currentMission();
    const stage = currentStage();

    // Clock advances 1 game minute every 4 real seconds.
    state.time = (state.time + dt / 4) % (24 * 60);

    // --- jetpack ---
    if (input.jetpackToggle && state.jetpackOwned && !state.player.onFoot) {
      // Jetpack works on foot; stepping out of the car first is the honest route.
    }
    if (input.jetpackToggle && state.jetpackOwned) {
      state.jetpackOn = !state.jetpackOn;
      if (state.jetpackOn) { state.stats.jetpackFlights += 1; state.player.onFoot = true; playerPed.visible = true; }
      jetpack.visible = state.jetpackOn;
    }
    if (state.jetpackOn) {
      state.fuel = Math.max(0, state.fuel - dt * 22);
      if (state.fuel <= 0) state.jetpackOn = false;
      const climb = (input.forward ? 1 : 0) + (input.boost ? 1.4 : 0);
      p.vy = climb * 5.5 - 2.5;
      p.y = Math.max(0, p.y + p.vy * dt);
      const spd = 18.5 + (input.boost ? 12 : 0);
      if (input.forward) { p.x += Math.sin(p.heading) * spd * dt; p.z += Math.cos(p.heading) * spd * dt; }
      if (input.left) p.heading += dt * 2.2;
      if (input.right) p.heading -= dt * 2.2;
      if (p.y <= 0.01) { state.fuel = Math.min(100, state.fuel + dt * 45); }
      // The ped mesh must follow the jetpack player, or the shot shows sky.
      playerPed.position.set(p.x, p.y, p.z);
      playerPed.rotation.y = p.heading;
      jetpack.userData.flames.forEach((f, i) => {
        f.visible = true;
        const s = 0.8 + Math.sin(state.t * 40 + i) * 0.25 + (input.forward || input.boost ? 0.5 : 0);
        f.scale.set(s, s * (1 + (input.forward ? 0.6 : 0)), s);
      });
    } else {
      jetpack.userData.flames.forEach(f => { f.visible = false; });
      if (p.y > 0) { p.vy -= 22 * dt; p.y = Math.max(0, p.y + p.vy * dt); }
      if (p.y <= 0.01) state.fuel = Math.min(100, state.fuel + dt * 45);
    }

    // --- on foot ---
    if (state.player.onFoot && !state.jetpackOn) {
      const spd = input.boost ? 7.5 : 4.2;
      let mx = 0, mz = 0;
      if (input.forward) { mx += Math.sin(p.heading); mz += Math.cos(p.heading); }
      if (input.back) { mx -= Math.sin(p.heading); mz -= Math.cos(p.heading); }
      if (input.left) p.heading += dt * 2.6;
      if (input.right) p.heading -= dt * 2.6;
      const len = Math.hypot(mx, mz);
      if (len > 0) {
        p.x += (mx / len) * spd * dt; p.z += (mz / len) * spd * dt;
        pedWalk(playerPed, dt, spd / 4);
        state.stats.distanceKm += (spd * dt) / 1000;
      }
      playerPed.position.set(p.x, p.y, p.z);
      playerPed.rotation.y = p.heading;
      if (input.fire) fireWeapon();
      if (input.reload && state.reloadT <= 0) { state.reloadT = 1.2; }
    }

    // --- driving ---
    if (!state.player.onFoot) {
      const accel = input.forward ? 16 : input.back ? -10 : 0;
      const brake = input.brake ? 26 : 0;
      hero.speed += accel * dt;
      if (brake) hero.speed -= Math.sign(hero.speed) * brake * dt;
      hero.speed -= hero.speed * 0.35 * dt; // drag
      if (input.boost) hero.speed += 10 * dt;
      hero.speed = clamp(hero.speed, -12, HERO_MAX);
      if (Math.abs(hero.speed) > 0.5) {
        const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
        hero.heading += steer * dt * 1.9 * clamp(Math.abs(hero.speed) / 12, 0, 1) * Math.sign(hero.speed);
      }
      hero.x += Math.sin(hero.heading) * hero.speed * dt;
      hero.z += Math.cos(hero.heading) * hero.speed * dt;
      // Stay in the playable world: beach and pier are open, the ocean is not.
      const onPier = Math.abs(hero.z) < 8 && hero.x > 118;
      hero.x = clamp(hero.x, -128, onPier ? 174 : 120);
      hero.z = clamp(hero.z, -168, 168);
      p.x = hero.x; p.z = hero.z; p.heading = hero.heading; p.speed = hero.speed;
      state.speedKmh = Math.abs(hero.speed) * 3.6;
      state.stats.topSpeed = Math.max(state.stats.topSpeed, state.speedKmh);
      state.stats.distanceKm += Math.abs(hero.speed * dt) / 1000;
      if (input.fire) { /* car has no gun: honk instead */ }
      syncHero();
      // Ram damage: hitting another car hard hurts — rate-limited so one
      // pile-up cannot drain the whole bar in a single second.
      for (const c of cars) {
        if (c === hero || !c.alive) continue;
        if (dist2d(hero.x, hero.z, c.x, c.z) < 3.4 && Math.abs(hero.speed) > 12 && state.t - (state.lastRamT || -9) > 0.8) {
          state.lastRamT = state.t;
          state.health = Math.max(0, state.health - 4);
          state.damageFlash = 0.8;
          hero.speed *= 0.55;
        }
      }
    } else {
      state.speedKmh = state.jetpackOn ? Math.abs(18.5 + (input.boost ? 12 : 0)) * 3.6 : 0;
      // Keep the hero car where the player left it.
      syncHero();
    }

    // Clamp the player to the world on foot too.
    if (state.player.onFoot) {
      p.x = clamp(p.x, -128, 174); p.z = clamp(p.z, -168, 168);
    }

    // --- traffic: follow their road, wrap at the edges ---
    for (const c of cars) {
      if (c === hero || c.police || !c.alive) continue;
      if (c.traffic === 'x') { c.x += c.dir * c.speed * dt; if (c.x > 120) c.x = -128; if (c.x < -128) c.x = 120; }
      else { c.z += c.dir * c.speed * dt; if (c.z > 168) c.z = -168; if (c.z < -168) c.z = 168; }
      c.group.position.set(c.x, 0, c.z);
      c.group.rotation.y = c.heading - Math.PI / 2;
      const w = c.group.userData.wheels;
      if (w) for (const wh of w) wh.rotation.z -= c.speed * dt * 2.2;
    }

    // --- police chase AI: steer at the player, ram, flash the light bar ---
    for (const c of cars) {
      if (!c.police || !c.alive) continue;
      const dx = p.x - c.x, dz = p.z - c.z;
      const d = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      let dh = want - c.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      c.heading += clamp(dh, -1, 1) * dt * 2.4;
      const target = d > 60 ? POLICE_MAX : POLICE_MAX * (0.55 + d / 140);
      c.speed += clamp(target - c.speed, -18 * dt, 14 * dt);
      c.x += Math.sin(c.heading) * c.speed * dt;
      c.z += Math.cos(c.heading) * c.speed * dt;
      c.x = clamp(c.x, -128, 120); c.z = clamp(c.z, -168, 168);
      c.group.position.set(c.x, 0, c.z);
      c.group.rotation.y = c.heading - Math.PI / 2;
      const w = c.group.userData.wheels;
      if (w) for (const wh of w) wh.rotation.z -= c.speed * dt * 2.2;
      // Light bar alternates red / blue.
      const red = c.group.getObjectByName('lightRed');
      const blue = c.group.getObjectByName('lightBlue');
      if (red && blue) {
        const on = Math.floor(state.t * 6) % 2 === 0;
        red.material.emissiveIntensity = on ? 2.2 : 0.2;
        blue.material.emissiveIntensity = on ? 0.2 : 2.2;
      }
      // Contact: a police ram costs health — rate-limited, as above.
      if (d < 3.2 && Math.abs(c.speed) > 6 && state.t - (state.lastRamT || -9) > 0.8) {
        state.lastRamT = state.t;
        state.health = Math.max(0, state.health - 2.5);
        state.damageFlash = 0.7;
        c.speed *= 0.4;
      }
    }

    // --- helicopters: circle the player, searchlight on the ground ---
    for (const h of helis) {
      h.angle += dt * 0.35;
      const hx = p.x + Math.cos(h.angle) * h.radius;
      const hz = p.z + Math.sin(h.angle) * h.radius;
      h.group.position.set(hx, h.height + Math.sin(state.t * 0.8) * 1.2, hz);
      h.group.rotation.y = Math.atan2(p.x - hx, p.z - hz) - Math.PI / 2;
      h.group.userData.rotor.rotation.y += dt * 22;
      h.group.userData.tailRotor.rotation.x += dt * 30;
    }

    // --- pedestrians: wander, armed ones hunt the player and shoot back ---
    for (const e of peds) {
      if (e.downed) {
        if (e.ring) {
          const s = 1 + Math.sin(state.t * 5) * 0.18;
          e.ring.scale.set(s, s, 1);
          e.ring.userData.ring.material.opacity = 0.55 + Math.sin(state.t * 5) * 0.35;
        }
        continue;
      }
      if (e.armed) {
        const d = dist2d(e.x, e.z, p.x, p.z);
        if (d < 42) {
          e.heading = Math.atan2(p.x - e.x, p.z - e.z);
          e.shootT -= dt;
          if (e.shootT <= 0) { e.shootT = 1.1 + rnd() * 0.9; enemyFire(e); }
        } else {
          e.wander -= dt;
          if (e.wander <= 0) { e.wander = 2 + rnd() * 4; e.heading += (rnd() - 0.5) * 2.4; }
          e.x += Math.sin(e.heading) * 2.2 * dt; e.z += Math.cos(e.heading) * 2.2 * dt;
          pedWalk(e.group, dt, 0.6);
        }
        e.group.position.set(e.x, 0, e.z);
        e.group.rotation.y = e.heading;
      } else {
        e.wander -= dt;
        if (e.wander <= 0) { e.wander = 3 + rnd() * 5; e.heading += (rnd() - 0.5) * 2.6; }
        e.x += Math.sin(e.heading) * e.speed * dt;
        e.z += Math.cos(e.heading) * e.speed * dt;
        e.x = clamp(e.x, -128, 120); e.z = clamp(e.z, -168, 168);
        e.group.position.set(e.x, 0, e.z);
        e.group.rotation.y = e.heading;
        pedWalk(e.group, dt, e.speed / 3);
      }
    }

    // --- tracers fade out ---
    for (let i = tracers.length - 1; i >= 0; i--) {
      const tr = tracers[i];
      tr.life -= dt;
      tr.line.material.opacity = Math.max(0, tr.life / tr.max);
      if (tr.life <= 0) { scene.remove(tr.line); tr.line.geometry.dispose(); tracers.splice(i, 1); }
    }
    if (state.reloadT > 0) {
      state.reloadT -= dt;
      if (state.reloadT <= 0) state.ammo[state.weapon] = WEAPONS[state.weapon].ammo;
    }
    if (state.muzzleT > 0) { state.muzzleT -= dt; if (state.muzzleT <= 0) muzzle.visible = false; }

    // --- wanted decay: stay fast and far, the heat cools off ---
    if (state.wanted > 0) {
      const nearest = Math.min(...cars.filter(c => c.police).map(c => dist2d(p.x, p.z, c.x, c.z)), 999);
      if (nearest > 110 && Math.abs(hero.speed) > 20) {
        state.wantedT = (state.wantedT || 0) + dt;
        if (state.wantedT > 6) { setWanted(state.wanted - 1); state.wantedT = 0; }
      } else state.wantedT = 0;
    }
    if (state.wanted === 0 && state.health < 100) state.health = Math.min(100, state.health + dt * 2);

    // --- mission stages ---
    if (stage) {
      const d = stage.jetpack ? dist2d(p.x, p.z, stage.at[0], stage.at[2]) : dist2d(p.x, p.z, stage.at[0], stage.at[2]);
      const yOk = stage.jetpack && stage.at[1] > 20 ? p.y > 12 : true;
      beacon.position.set(stage.at[0], 0, stage.at[2]);
      beacon.visible = true;
      beacon.userData.ring.scale.setScalar(1 + Math.sin(state.t * 3) * 0.15);
      const combatDone = !stage.combat || state.kills >= (stage.kills || 1);
      if (d < stage.radius && combatDone && yOk) completeStage();
      state.stageDist = d;
    } else beacon.visible = false;

    if (state.dialogueT > 0) { state.dialogueT -= dt; if (state.dialogueT <= 0) state.dialogue = null; }
    if (state.toastT > 0) { state.toastT -= dt; if (state.toastT <= 0) state.toast = null; }
    if (state.damageFlash > 0) state.damageFlash = Math.max(0, state.damageFlash - dt * 2);
    if (state.health <= 0) {
      state.banner = { big: 'BUSTED', sub: 'Solara Bay PD got you — press R to restart the mission' };
      state.mode = 'busted';
    }
    world.update(dt, state.t);
  }

  // ---- autopilot: steer the hero car (or the player) at a target ----
  function autopilot(targetX, targetZ, dt, input) {
    const p = state.player;
    const dx = targetX - p.x, dz = targetZ - p.z;
    const want = Math.atan2(dx, dz);
    let dh = want - p.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    input.forward = true;
    input.left = dh > 0.12;
    input.right = dh < -0.12;
    input.boost = Math.abs(dh) < 0.3;
    return Math.hypot(dx, dz);
  }

  function enterExitCar() {
    if (state.player.onFoot && !state.jetpackOn) {
      if (dist2d(state.player.x, state.player.z, hero.x, hero.z) < 5) {
        state.player.onFoot = false;
        playerPed.visible = false;
        state.stats.carsStolen += 1;
      }
    } else if (!state.jetpackOn) {
      state.player.onFoot = true;
      playerPed.visible = true;
      const p = state.player;
      p.x = hero.x - Math.sin(hero.heading) * 2.4; p.z = hero.z - Math.cos(hero.heading) * 2.4;
      playerPed.position.set(p.x, 0, p.z);
      playerPed.rotation.y = hero.heading;
    }
  }

  function reset() {
    rng.s = 1234567;
    state.t = 0; state.muzzleT = 0;
    state.cash = 12340; state.wanted = 0; state.health = 100; state.fuel = 100;
    state.missionIndex = 0; state.stageIndex = 0; state.kills = 0;
    state.missionDone = [false, false, false, false, false, false, false, false];
    state.ammo = WEAPONS.map(w => w.ammo);
    state.stats = { shotsFired: 0, shotsHit: 0, carsStolen: 0, distanceKm: 0, topSpeed: 0, jetpackFlights: 0 };
    clearPolice(); clearHelis(); clearPeds();
    placePlayer(80, 30, Math.PI, true);
    setMission(0);
    spawnTraffic(14);
    spawnCrowd(26, 40, 60, 30);
    spawnCrowd(18, 80, 0, 40);
    spawnCrowd(14, 100, -40, 20);
  }

  return {
    state, cars, helis, peds, hero,
    step, reset, placePlayer, spawnTraffic, spawnPolice, clearPolice, spawnHeli, clearHelis,
    spawnCrowd, spawnEnemies, clearPeds, setWanted, setMission, showDialogue, addTracer,
    currentMission, currentStage, fireWeapon, enterExitCar, autopilot,
    policeCount, playerPed, heroCar, beacon,
    debugShot: () => ({ muzzle: muzzle.visible, muzzleT: state.muzzleT, tracers: tracers.length, armedHp: peds.filter(p => p.armed).map(p => Math.round(p.hp)) }),
  };
}
