// Solara Bay — entities: every vehicle, helicopter, jetpack and person is
// built here from primitives. Hero cars are rounded and bevelled, never a
// dead-rear boxy slab; palms droop, police cars read POLICE from both sides.
import * as THREE from 'three';
import { mulberry32 } from './config.js';
import { policeDoorTexture } from './textures.js';

function mat(color, opts = {}) { return new THREE.MeshLambertMaterial({ color, ...opts }); }
function box(w, h, d, m, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true;
  return o;
}
function cyl(rt, rb, h, m, x = 0, y = 0, z = 0, seg = 20) {
  const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true;
  return o;
}

function makeWheel(r = 0.42, w = 0.3) {
  const g = new THREE.Group();
  const tire = cyl(r, r, w, mat(0x16181c), 0, 0, 0, 24);
  tire.rotation.x = Math.PI / 2; g.add(tire);
  const hub = cyl(r * 0.55, r * 0.55, w + 0.04, mat(0xd8dde2), 0, 0, 0, 16);
  hub.rotation.x = Math.PI / 2; g.add(hub);
  return g;
}

// Rounded, bevelled sports car in 3/4 rear-friendly proportions: a low wide
// body, a tapered nose, a sloped cabin, spoiler, and bright paint.
export function createCar(kind = 'hero') {
  const g = new THREE.Group();
  const paints = { hero: 0xffb400, police: 0xf2f5f7, traffic: 0x4f9fd8, taxi: 0xffd94d, red: 0xd8322e, teal: 0x2eb8a6 };
  const paint = paints[kind] ?? 0x4f9fd8;
  const bodyMat = mat(paint);
  const body = box(4.6, 0.62, 1.95, bodyMat, 0, 0.62, 0);
  body.geometry = new THREE.BoxGeometry(4.6, 0.62, 1.95);
  g.add(body);
  // Tapered nose + tail give the bevelled look instead of a slab.
  const nose = box(1.1, 0.42, 1.7, bodyMat, 2.55, 0.55, 0);
  nose.rotation.z = -0.12; g.add(nose);
  const tail = box(0.8, 0.5, 1.8, bodyMat, -2.5, 0.6, 0);
  tail.rotation.z = 0.1; g.add(tail);
  const cabin = box(2.3, 0.48, 1.6, new THREE.MeshLambertMaterial({ color: 0x18242f, emissive: 0x0a1a26, emissiveIntensity: 0.5 }), -0.25, 1.12, 0);
  cabin.scale.x = 1; g.add(cabin);
  const roof = box(1.9, 0.08, 1.35, bodyMat, -0.25, 1.4, 0); g.add(roof);
  // Sloped rear window so the cabin reads as glass, not a slab.
  const rearGlass = box(0.5, 0.42, 1.4, new THREE.MeshLambertMaterial({ color: 0x18242f, emissive: 0x0a1a26, emissiveIntensity: 0.5 }), -1.45, 1.05, 0);
  rearGlass.rotation.z = 0.5; g.add(rearGlass);
  // Headlights + taillights.
  const hl = new THREE.MeshLambertMaterial({ color: 0xfff6c8, emissive: 0xffe98a, emissiveIntensity: 0.9 });
  g.add(box(0.12, 0.18, 0.42, hl, 3.08, 0.62, 0.62));
  g.add(box(0.12, 0.18, 0.42, hl, 3.08, 0.62, -0.62));
  const tl = new THREE.MeshLambertMaterial({ color: 0xff2a2a, emissive: 0xcc0000, emissiveIntensity: 0.9 });
  g.add(box(0.12, 0.16, 1.5, tl, -2.92, 0.66, 0));
  // Spoiler on the hero car.
  if (kind === 'hero') {
    g.add(box(0.5, 0.08, 1.9, mat(0x1a1a1a), -2.7, 1.15, 0));
    g.add(box(0.08, 0.35, 0.08, mat(0x1a1a1a), -2.7, 0.95, 0.8));
    g.add(box(0.08, 0.35, 0.08, mat(0x1a1a1a), -2.7, 0.95, -0.8));
  }
  const wheels = [];
  for (const [wx, wz] of [[1.55, 0.95], [1.55, -0.95], [-1.55, 0.95], [-1.55, -0.95]]) {
    const w = makeWheel(kind === 'hero' ? 0.46 : 0.4);
    w.position.set(wx, 0.44, wz); g.add(w); wheels.push(w);
  }
  if (kind === 'police') {
    // Black hood + trunk bands, POLICE door lettering both sides, 911, light
    // bar, push bar — legible from any chase angle.
    g.add(box(1.5, 0.1, 1.9, mat(0x14181d), 2.1, 0.95, 0));
    g.add(box(1.1, 0.1, 1.9, mat(0x14181d), -2.2, 0.95, 0));
    const doorTex = policeDoorTexture();
    const doorMat = new THREE.MeshLambertMaterial({ map: doorTex });
    for (const s of [1, -1]) {
      const door = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.85), doorMat);
      door.position.set(-0.2, 0.68, s * 0.99); door.rotation.y = s > 0 ? 0 : Math.PI;
      g.add(door);
    }
    // Red/blue light bar with a glow.
    g.add(box(1.1, 0.16, 0.34, mat(0x222222), -0.25, 1.62, 0));
    const red = new THREE.MeshLambertMaterial({ color: 0xff2020, emissive: 0xff0000, emissiveIntensity: 1.6 });
    const blue = new THREE.MeshLambertMaterial({ color: 0x2050ff, emissive: 0x0022ff, emissiveIntensity: 1.6 });
    const lb1 = box(0.48, 0.22, 0.36, red, -0.25, 1.72, 0.2); lb1.name = 'lightRed';
    const lb2 = box(0.48, 0.22, 0.36, blue, -0.25, 1.72, -0.2); lb2.name = 'lightBlue';
    g.add(lb1); g.add(lb2);
    // Push bar on the nose.
    g.add(box(0.14, 0.5, 1.5, mat(0x222222), 3.15, 0.6, 0));
    g.add(box(0.14, 0.14, 1.5, mat(0x444444), 3.15, 0.95, 0));
  }
  g.userData.wheels = wheels;
  g.userData.kind = kind;
  return g;
}

export function createScooter() {
  const g = new THREE.Group();
  g.add(box(1.7, 0.35, 0.55, mat(0xff5a8a), 0, 0.55, 0));
  g.add(box(0.5, 0.8, 0.4, mat(0xff5a8a), 0.7, 0.9, 0));
  const w1 = makeWheel(0.28, 0.16); w1.position.set(0.75, 0.28, 0); g.add(w1);
  const w2 = makeWheel(0.28, 0.16); w2.position.set(-0.75, 0.28, 0); g.add(w2);
  g.userData.wheels = [w1, w2];
  return g;
}

export function createTank() {
  const g = new THREE.Group();
  g.add(box(5.2, 1.1, 2.8, mat(0x4a5d3a), 0, 0.9, 0));
  g.add(box(2.2, 0.9, 2.0, mat(0x5a6d45), -0.3, 1.9, 0));
  const barrel = cyl(0.16, 0.2, 3.4, mat(0x333333), 2.6, 1.95, 0, 12);
  barrel.rotation.z = Math.PI / 2; g.add(barrel);
  for (const s of [1, -1]) g.add(box(5.4, 0.7, 0.6, mat(0x222222), 0, 0.45, s * 1.35));
  g.userData.wheels = [];
  return g;
}

// Helicopter with spinning main rotor, tail rotor, skids, and a searchlight
// cone that paints the ground below it.
export function createHeli(police = true) {
  const g = new THREE.Group();
  const bodyMat = mat(police ? 0x2b6cb0 : 0xd8322e);
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.6, 20, 14), bodyMat);
  body.scale.set(1.7, 1, 1); body.position.y = 0; body.castShadow = true; g.add(body);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), new THREE.MeshLambertMaterial({ color: 0x18242f, emissive: 0x0a2436, emissiveIntensity: 0.6 }));
  glass.scale.set(1.1, 0.8, 0.95); glass.position.set(2.2, 0.2, 0); g.add(glass);
  const tail = cyl(0.35, 0.55, 4.6, bodyMat, -3.6, 0.3, 0, 12);
  tail.rotation.z = Math.PI / 2 - 0.12; g.add(tail);
  const fin = box(0.5, 1.6, 0.18, bodyMat, -5.8, 1.1, 0); g.add(fin);
  const rotor = new THREE.Group();
  rotor.position.y = 1.7;
  rotor.add(box(7.6, 0.08, 0.5, mat(0x1a1a1a), 0, 0, 0));
  rotor.add(box(0.5, 0.08, 7.6, mat(0x1a1a1a), 0, 0, 0));
  g.add(rotor);
  const tailRotor = new THREE.Group();
  tailRotor.position.set(-5.9, 0.9, 0.3);
  tailRotor.add(box(0.08, 2.0, 0.14, mat(0x1a1a1a), 0, 0, 0));
  g.add(tailRotor);
  for (const s of [1, -1]) g.add(box(2.6, 0.12, 0.18, mat(0x222222), 0.4, -1.55, s * 0.9));
  if (police) {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.7), new THREE.MeshLambertMaterial({ map: policeDoorTexture() }));
    sign.position.set(0, -0.4, 1.62); g.add(sign);
  }
  // Searchlight cone: additive, fades toward the ground. Kept narrow so it
  // reads as a beam, not a wedge of sky.
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const cone = new THREE.Mesh(new THREE.ConeGeometry(4.5, 22, 20, 1, true), coneMat);
  cone.position.set(1.2, -12, 0); cone.rotation.x = Math.PI; g.add(cone);
  const spot = new THREE.Mesh(new THREE.CircleGeometry(3.6, 24), new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.22, depthWrite: false }));
  spot.rotation.x = -Math.PI / 2; spot.position.set(1.2, -23, 0); g.add(spot);
  g.scale.setScalar(1.35);
  g.userData.rotor = rotor; g.userData.tailRotor = tailRotor; g.userData.cone = cone; g.userData.spot = spot;
  return g;
}

// Jetpack: twin tanks, nozzles, and a visible flame cone that grows with thrust.
export function createJetpack() {
  const g = new THREE.Group();
  for (const s of [1, -1]) {
    g.add(cyl(0.22, 0.22, 0.85, mat(0xb8c0c8), 0, 0.1, s * 0.3, 14));
    g.add(cyl(0.1, 0.16, 0.3, mat(0x333333), 0, -0.45, s * 0.3, 10));
  }
  g.add(box(0.5, 0.5, 0.7, mat(0x2b6cb0), 0, 0.15, 0));
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffa02e, transparent: true, opacity: 0.95 });
  const flameMat2 = new THREE.MeshBasicMaterial({ color: 0xffe98a, transparent: true, opacity: 0.95 });
  const flames = [];
  for (const s of [1, -1]) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.26, 1.5, 12), flameMat);
    f.position.set(0, -1.3, s * 0.3); f.rotation.x = Math.PI; g.add(f); flames.push(f);
    const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.9, 10), flameMat2);
    f2.position.set(0, -1.15, s * 0.3); f2.rotation.x = Math.PI; g.add(f2); flames.push(f2);
  }
  g.userData.flames = flames;
  return g;
}

const SKINS = [0xc98d64, 0x8a5a3b, 0xe8b98a, 0x6b4426, 0xf2c9a0];
const SHIRTS = [0xff5a5a, 0x4fc3f7, 0xffd94d, 0x7dff9b, 0xff8ac2, 0xffffff, 0x2b6cb0, 0xf2a541, 0xd86ab0, 0x3da66e];
const PANTS = [0x2b3a4a, 0x4a3a2b, 0x6b6b6b, 0x1e3a5a, 0x7a2b2b];

// A pedestrian: head, torso, legs that swing when walking, arms; armed ones
// carry a rifle box. Initials only — never a drawn face.
export function createPed(opts = {}) {
  const rnd = mulberry32(opts.seed || 7);
  const g = new THREE.Group();
  const skin = mat(SKINS[Math.floor(rnd() * SKINS.length)]);
  const shirt = mat(opts.armed ? 0x8a1f1f : SHIRTS[Math.floor(rnd() * SHIRTS.length)]);
  const pants = mat(PANTS[Math.floor(rnd() * PANTS.length)]);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 12), skin);
  head.position.y = 1.62; head.castShadow = true; g.add(head);
  // Hair cap so the silhouette reads at a glance.
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, 1.2), mat([0x1a1a1a, 0x4a2b12, 0x888888][Math.floor(rnd() * 3)]));
  hair.position.y = 1.66; g.add(hair);
  const torso = box(0.52, 0.68, 0.3, shirt, 0, 1.12, 0); g.add(torso);
  const legL = box(0.2, 0.72, 0.22, pants, -0.14, 0.36, 0); legL.geometry.translate(0, -0.36, 0); legL.position.y = 0.72; g.add(legL);
  const legR = box(0.2, 0.72, 0.22, pants, 0.14, 0.36, 0); legR.geometry.translate(0, -0.36, 0); legR.position.y = 0.72; g.add(legR);
  const armL = box(0.16, 0.6, 0.18, shirt, -0.35, 1.15, 0); armL.geometry.translate(0, -0.3, 0); armL.position.y = 1.45; g.add(armL);
  const armR = box(0.16, 0.6, 0.18, shirt, 0.35, 1.15, 0); armR.geometry.translate(0, -0.3, 0); armR.position.y = 1.45; g.add(armR);
  if (opts.armed) {
    const gun = box(0.85, 0.12, 0.12, mat(0x1a1a1a), 0.15, 1.25, 0.25);
    gun.rotation.y = 0.2; g.add(gun);
    armR.rotation.x = -1.2; armL.rotation.x = -1.1;
  }
  if (opts.guard) {
    g.add(box(0.56, 0.1, 0.34, mat(0x111111), 0, 1.32, 0)); // vest stripe
  }
  g.userData = { legL, legR, armL, armR, walkPhase: rnd() * 6, armed: !!opts.armed, guard: !!opts.guard };
  return g;
}

export function pedWalk(ped, dt, speed) {
  const u = ped.userData;
  u.walkPhase += dt * speed * 5.2;
  const s = Math.sin(u.walkPhase) * 0.55 * Math.min(1, speed);
  u.legL.rotation.x = s; u.legR.rotation.x = -s;
  if (!u.armed) { u.armL.rotation.x = -s * 0.7; u.armR.rotation.x = s * 0.7; }
}

// Downed enemy: lying flat + a pulsing red ring on the ground.
export function createDownedRing() {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1.25, 32),
    new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; g.add(ring);
  const fill = new THREE.Mesh(
    new THREE.CircleGeometry(0.9, 24),
    new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.18, depthWrite: false }),
  );
  fill.rotation.x = -Math.PI / 2; fill.position.y = 0.05; g.add(fill);
  g.userData.ring = ring; g.userData.fill = fill;
  return g;
}
