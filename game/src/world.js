// Solara Bay — world: the city itself. Ground, ocean, beach, buildings with
// procedural facades, pier, Ferris wheel, yacht, palms, umbrellas, lantern
// market, clouds, and the three sky presets. One sun, fog coloured exactly
// like the horizon, real directional shadows everywhere.
import * as THREE from 'three';
import { WORLD, mulberry32, clamp } from './config.js';
import {
  facadeTexture, roadTexture, sandTexture, waterTexture, grassTexture,
  signTexture, awningTexture, sidewalkTexture,
} from './textures.js';

const SKIES = {
  noon: { sky: 0x4fb2ff, horizon: 0xbfe6ff, sun: 0xfff6d8, sunI: 2.6, hemi: 0.9, sunPos: [120, 220, 60], amb: 0.55 },
  golden: { sky: 0xff9a5c, horizon: 0xffc98a, sun: 0xffb36b, sunI: 2.2, hemi: 0.7, sunPos: [-180, 55, 120], amb: 0.45 },
  night: { sky: 0x0a1230, horizon: 0x1c2a52, sun: 0xcfd8ff, sunI: 0.9, hemi: 0.35, sunPos: [-80, 160, -60], amb: 0.22 },
};

const FACADE_BASES = ['#e86a5a', '#f2a541', '#4f9fd8', '#7ec8a9', '#d86ab0', '#f5e6c8', '#8a7fd8', '#e8d44d', '#5ac8c8', '#c96a4a'];
const FACADE_ACCENTS = ['#2b6cb0', '#c0392b', '#1e6f4a', '#7a4d8a', '#b8860b', '#204060'];

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  return m;
}
function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  return m;
}
function mat(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}

export function buildWorld(scene) {
  const rnd = mulberry32(20261124);
  const group = new THREE.Group();
  scene.add(group);

  // ---- lights: one sun, one hemisphere, one ambient ----
  const sun = new THREE.DirectionalLight(0xfff6d8, 2.6);
  sun.position.set(120, 220, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -220; sun.shadow.camera.right = 220;
  sun.shadow.camera.top = 220; sun.shadow.camera.bottom = -220;
  sun.shadow.camera.far = 700; sun.shadow.bias = -0.0006;
  scene.add(sun); scene.add(sun.target);
  const hemi = new THREE.HemisphereLight(0xbfe6ff, 0x8a6d4b, 0.9);
  scene.add(hemi);
  const amb = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(amb);

  // ---- ground planes: city grass base (land only — it must not cover the
  // ocean), beach sand, ocean ----
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(472, 700), new THREE.MeshLambertMaterial({ map: grassTexture(7) }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(-114, -0.05, 0); ground.receiveShadow = true;
  group.add(ground);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(40, 420), new THREE.MeshLambertMaterial({ map: sandTexture(11) }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(104, 0.02, 0); sand.receiveShadow = true;
  group.add(sand);
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(480, 800), new THREE.MeshLambertMaterial({ map: waterTexture(3) }));
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(360, -0.15, 0); ocean.receiveShadow = true;
  group.add(ocean);

  // ---- roads: boulevard + grid, with sidewalks and crosswalks ----
  // The dash strip runs along U, so X-roads tile along U and Z-roads use a
  // 90-degree-rotated copy that tiles along V.
  const roadTexX = roadTexture(5); roadTexX.repeat.set(10, 1);
  const roadTexZ = roadTexture(5); roadTexZ.center.set(0.5, 0.5); roadTexZ.rotation = Math.PI / 2; roadTexZ.repeat.set(1, 10);
  const roadMatX = new THREE.MeshLambertMaterial({ map: roadTexX });
  const roadMatZ = new THREE.MeshLambertMaterial({ map: roadTexZ });
  const walkMat = new THREE.MeshLambertMaterial({ map: sidewalkTexture(9) });
  const roadGeoX = new THREE.PlaneGeometry(340, 12);
  const roadGeoZ = new THREE.PlaneGeometry(12, 340);
  for (const z of WORLD.roadZ) {
    const r = new THREE.Mesh(roadGeoX, roadMatX);
    r.rotation.x = -Math.PI / 2; r.position.set(-22, 0.06, z); r.receiveShadow = true; group.add(r);
    const w1 = new THREE.Mesh(new THREE.PlaneGeometry(340, 3), walkMat);
    w1.rotation.x = -Math.PI / 2; w1.position.set(-22, 0.07, z - 7.5); w1.receiveShadow = true; group.add(w1);
    const w2 = w1.clone(); w2.position.z = z + 7.5; group.add(w2);
  }
  for (const x of WORLD.roadX) {
    const r = new THREE.Mesh(roadGeoZ, roadMatZ);
    r.rotation.x = -Math.PI / 2; r.position.set(x, 0.06, 0); r.receiveShadow = true; group.add(r);
  }
  // Boulevard Ocean Drive gets a wider, warmer ribbon.
  const blvd = new THREE.Mesh(new THREE.PlaneGeometry(18, 340), roadMatZ);
  blvd.rotation.x = -Math.PI / 2; blvd.position.set(80, 0.08, 0); blvd.receiveShadow = true; group.add(blvd);
  // Crosswalks at the boulevard intersections.
  const crossMat = mat(0xf5f2e8);
  for (const z of [-120, -40, 0, 40, 120]) {
    for (let i = -2; i <= 2; i++) {
      const s = box(1.6, 0.06, 7, crossMat, 80 + i * 3.2, 0.1, z);
      s.castShadow = false; group.add(s);
    }
  }

  // ---- buildings: varied heights, colours, facades; never on roads ----
  const onRoad = (x, z) => WORLD.roadX.some(rx => Math.abs(x - rx) < 11) || WORLD.roadZ.some(rz => Math.abs(z - rz) < 11);
  let bi = 0;
  for (let gx = -120; gx <= 60; gx += 20) {
    for (let gz = -160; gz <= 160; gz += 20) {
      const x = gx + 10, z = gz + 10;
      if (x > 70 || onRoad(x, z)) continue;
      if (rnd() < 0.12) continue; // plaza gaps keep the city breathable
      const h = 8 + rnd() * rnd() * 34;
      const w = 12 + rnd() * 6, d = 12 + rnd() * 6;
      const base = FACADE_BASES[bi % FACADE_BASES.length];
      const accent = FACADE_ACCENTS[Math.floor(rnd() * FACADE_ACCENTS.length)];
      const facade = facadeTexture(base, accent, 100 + bi * 7, Math.max(3, Math.round(h / 5)));
      const side = new THREE.MeshLambertMaterial({ map: facade });
      const roof = mat(0x3a3f46);
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, roof, roof, side, side]);
      b.position.set(x, h / 2, z); b.castShadow = true; b.receiveShadow = true;
      group.add(b);
      // Roof plant: AC box + antenna so rooftops are not bare slabs.
      group.add(box(2.4, 1.2, 2, mat(0x9aa0a8), x + w / 4, h + 0.6, z));
      group.add(cyl(0.08, 0.08, 5, mat(0x666666), x - w / 4, h + 2.5, z - d / 4, 8));
      // Warm shop awning on the street face.
      const awn = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.7, 2.2), new THREE.MeshLambertMaterial({ map: awningTexture('#e84a5f', '#fff3e0'), side: THREE.DoubleSide }));
      awn.position.set(x, 4.4, z + d / 2 + 0.6); awn.rotation.x = -0.35; group.add(awn);
      bi++;
    }
  }
  // Far skyline silhouettes for depth beyond the playable grid.
  for (let i = 0; i < 14; i++) {
    const h = 30 + rnd() * 50;
    const b = box(16, h, 16, mat(new THREE.Color().setHSL(0.58, 0.25, 0.32 + rnd() * 0.12)), -170 - rnd() * 40, h / 2, -180 + i * 28);
    b.castShadow = false; group.add(b);
  }

  // ---- beach: umbrellas, towels, chairs, people dots ----
  const umbColors = [0xff5a5a, 0xffd94d, 0x4fc3f7, 0x7dff9b, 0xff8ac2, 0xff9d2e];
  for (let i = 0; i < 26; i++) {
    const x = 90 + rnd() * 28, z = -160 + rnd() * 320;
    // Keep the cover shot's beach corridor (x 88..122, z -45..45) clear:
    // an umbrella 2 m from the chase camera fills the whole frame.
    if (x > 88 && z > -45 && z < 45) continue;
    const c = umbColors[i % umbColors.length];
    group.add(cyl(0.09, 0.09, 3.2, mat(0xe8e0cc), x, 1.6, z, 8));
    const cone = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.6, 24), mat(c));
    cone.position.set(x, 3.9, z); cone.castShadow = true; group.add(cone);
    const towel = box(1.2, 0.08, 2.4, mat(umbColors[(i + 2) % umbColors.length]), x + 2.5, 0.12, z + 1);
    towel.castShadow = false; group.add(towel);
    if (i % 3 === 0) group.add(box(1.1, 0.5, 1.8, mat(0xf2f5f7), x - 2.4, 0.3, z - 1.5));
  }

  // ---- palms: curved trunks, drooping fronds, coconuts ----
  const trunkMat = mat(0x8a6d4b);
  const frondMat = mat(0x2f9e4f);
  function palm(x, z, s = 1) {
    const g = new THREE.Group();
    const lean = (rnd() - 0.5) * 0.5;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(lean * 2, 3.4 * s, 0),
      new THREE.Vector3(lean * 4.5, 6.8 * s, 0),
    ]);
    const trunk = new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.28 * s, 8), trunkMat);
    trunk.castShadow = true; g.add(trunk);
    const top = new THREE.Vector3(lean * 4.5, 6.8 * s, 0);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const droop = new THREE.CatmullRomCurve3([
        top.clone(),
        top.clone().add(dir.clone().multiplyScalar(2.2 * s)).add(new THREE.Vector3(0, 0.4, 0)),
        top.clone().add(dir.clone().multiplyScalar(4.2 * s)).add(new THREE.Vector3(0, -2.2 * s, 0)),
      ]);
      const frond = new THREE.Mesh(new THREE.TubeGeometry(droop, 8, 0.16 * s, 6), frondMat);
      frond.castShadow = true; g.add(frond);
    }
    const nut = new THREE.Mesh(new THREE.SphereGeometry(0.32 * s, 12, 10), mat(0x6b4a2b));
    nut.position.copy(top).add(new THREE.Vector3(0.3, -0.3, 0)); nut.castShadow = true; g.add(nut);
    g.position.set(x, 0, z);
    return g;
  }
  for (let z = -160; z <= 160; z += 16) {
    // Leave the beachfront vista clear near the pier approach (z -90..50):
    // the cover shot needs an unobstructed look at the ocean and yacht.
    if (z > -90 && z < 50) { if (rnd() < 0.6) group.add(palm(72, z + 8, 0.9 + rnd() * 0.4)); continue; }
    group.add(palm(86 + (rnd() < 0.5 ? 1 : 4), z + rnd() * 6, 0.9 + rnd() * 0.5));
    if (rnd() < 0.6) group.add(palm(72, z + 8, 0.9 + rnd() * 0.4));
  }
  for (let i = 0; i < 18; i++) group.add(palm(-120 + rnd() * 180, -160 + rnd() * 320, 0.8 + rnd() * 0.5));

  // ---- pier: planks, posts, lamps, and the Ferris wheel ----
  const pierMat = mat(0x9a7b52);
  const pier = box(56, 1.2, 14, pierMat, 149, 1.4, 0);
  group.add(pier);
  for (let x = 126; x <= 174; x += 6) {
    group.add(cyl(0.35, 0.35, 3.4, mat(0x6b4a2b), x, 0.2, -6.4, 10));
    group.add(cyl(0.35, 0.35, 3.4, mat(0x6b4a2b), x, 0.2, 6.4, 10));
  }
  for (let x = 128; x <= 172; x += 11) {
    group.add(cyl(0.12, 0.12, 4.4, mat(0x2b2f36), x, 3.6, -6, 8));
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffc94d, emissiveIntensity: 0.7 }));
    lamp.position.set(x, 5.9, -6); group.add(lamp);
  }

  // Ferris wheel: big rim, spokes, gondolas, A-frame legs — fully visible.
  const ferris = new THREE.Group();
  ferris.position.set(WORLD.ferrisX, 30, WORLD.ferrisZ);
  const wheel = new THREE.Group();
  const rimMat = mat(0xff5a7a);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(24, 0.9, 12, 48), rimMat);
  rim.castShadow = true; wheel.add(rim);
  const rim2 = new THREE.Mesh(new THREE.TorusGeometry(20, 0.5, 10, 40), mat(0xffd94d));
  wheel.add(rim2);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const spoke = cyl(0.35, 0.35, 24, mat(0xffffff), Math.cos(a) * 12, Math.sin(a) * 12, 0, 8);
    spoke.rotation.z = a + Math.PI / 2; spoke.castShadow = true; wheel.add(spoke);
  }
  const gondolaColors = [0xff5a5a, 0xffd94d, 0x4fc3f7, 0x7dff9b, 0xff8ac2, 0xff9d2e];
  const gondolas = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const g = box(3.2, 2.6, 2.4, mat(gondolaColors[i % gondolaColors.length]), Math.cos(a) * 24, Math.sin(a) * 24, 0);
    const arm = cyl(0.18, 0.18, 2.4, mat(0xdddddd), Math.cos(a) * 24, Math.sin(a) * 24, 0, 6);
    wheel.add(g); wheel.add(arm); gondolas.push(g);
  }
  const hub = new THREE.Mesh(new THREE.SphereGeometry(2.2, 20, 16), mat(0xffd94d));
  hub.castShadow = true; wheel.add(hub);
  ferris.add(wheel);
  const legL = cyl(0.8, 1.1, 32, mat(0xffffff), -7, -15, 0, 10);
  legL.rotation.z = 0.32; ferris.add(legL);
  const legR = cyl(0.8, 1.1, 32, mat(0xffffff), 7, -15, 0, 10);
  legR.rotation.z = -0.32; ferris.add(legR);
  const base = box(10, 2, 12, mat(0x2b6cb0), 0, -29, 0); ferris.add(base);
  group.add(ferris);

  // ---- the BIG yacht: white hull, blue stripe, glass superstructure ----
  const yacht = new THREE.Group();
  const hullMat = mat(0xf2f5f7);
  const hull = box(34, 4, 9, hullMat, 0, 1.2, 0);
  hull.scale.x = 1; yacht.add(hull);
  const bow = new THREE.Mesh(new THREE.ConeGeometry(4.5, 10, 4), hullMat);
  bow.rotation.z = -Math.PI / 2; bow.rotation.y = Math.PI / 4; bow.scale.set(1, 1, 0.55);
  bow.position.set(22, 1.2, 0); bow.castShadow = true; yacht.add(bow);
  yacht.add(box(34, 0.9, 9.2, mat(0x1e6f9e), 0, 3.2, 0));
  yacht.add(box(22, 3.4, 7, mat(0xffffff), -2, 5, 0));
  const glass = box(20, 1.4, 7.2, new THREE.MeshLambertMaterial({ color: 0x12324a, emissive: 0x1a4a66, emissiveIntensity: 0.4 }), -2, 5.4, 0);
  yacht.add(glass);
  yacht.add(box(10, 2.6, 5.5, mat(0xffffff), -8, 8, 0));
  yacht.add(cyl(0.18, 0.18, 7, mat(0xdddddd), -12, 10, 0, 8));
  const radar = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 10), mat(0xffffff));
  radar.position.set(-12, 13.6, 0); radar.castShadow = true; yacht.add(radar);
  for (let i = 0; i < 5; i++) {
    const win = box(2.2, 1.1, 0.2, mat(0x12324a), -12 + i * 5, 5, 3.6);
    win.castShadow = false; yacht.add(win);
  }
  yacht.position.set(WORLD.yacht.x, 0, WORLD.yacht.z);
  yacht.rotation.y = 0.35;
  yacht.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(yacht);

  // ---- lantern market: stalls, awnings, fruit piles, FRUIT sign ----
  const market = new THREE.Group();
  market.position.set(WORLD.market.x, 0, WORLD.market.z);
  const stallCols = ['#e84a5f', '#2b9fd8', '#f2a541', '#7ec8a9'];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const sx = Math.cos(a) * 13, sz = Math.sin(a) * 13;
    const stall = new THREE.Group();
    stall.add(box(4.4, 1.1, 2.2, mat(0x8a6d4b), 0, 0.55, 0));
    const awn = new THREE.Mesh(new THREE.PlaneGeometry(5, 3), new THREE.MeshLambertMaterial({ map: awningTexture(stallCols[i % 4], '#fff3e0'), side: THREE.DoubleSide }));
    awn.position.set(0, 2.9, 0); awn.rotation.x = -0.5; stall.add(awn);
    for (const [px, pz] of [[-2, -1], [2, -1], [-2, 1], [2, 1]]) stall.add(cyl(0.08, 0.08, 2.6, mat(0x5a4632), px, 1.3, pz, 6));
    // Fruit piles: bright spheres in a row.
    const fruits = [0xff5a3c, 0xffd94d, 0x7dff5a, 0xff8ac2, 0xff9d2e];
    for (let f = 0; f < 9; f++) {
      const fr = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), mat(fruits[f % fruits.length]));
      fr.position.set(-1.6 + (f % 3) * 1.6, 1.35, -0.5 + Math.floor(f / 3) * 0.7);
      fr.castShadow = true; stall.add(fr);
    }
    stall.add(box(1.4, 1, 1, mat(0xa8845a), 2.6, 0.5, 0.8));
    stall.position.set(sx, 0, sz); stall.rotation.y = -a + Math.PI / 2;
    market.add(stall);
  }
  // The FRUIT sign: huge, one plane, never split.
  const fruitSign = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshLambertMaterial({ map: signTexture('FRUIT', '#ff5a3c', '#ffffff', 'FRESH · MARKET'), side: THREE.DoubleSide }));
  fruitSign.position.set(0, 7.5, -16); fruitSign.castShadow = true; market.add(fruitSign);
  market.add(box(0.5, 7.5, 0.5, mat(0x5a4632), -7.5, 3.75, -16));
  market.add(box(0.5, 7.5, 0.5, mat(0x5a4632), 7.5, 3.75, -16));
  const sign2 = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), new THREE.MeshLambertMaterial({ map: signTexture('MARKET', '#2b9fd8', '#ffffff', 'LANTERN ROW'), side: THREE.DoubleSide }));
  sign2.position.set(-18, 6, 6); sign2.rotation.y = 0.9; market.add(sign2);
  // Lantern strings: coloured glowing balls on sagging lines.
  const lantCols = [0xff5a5a, 0xffd94d, 0x4fc3f7, 0x7dff9b, 0xff8ac2];
  for (let s = 0; s < 4; s++) {
    const a0 = (s / 4) * Math.PI * 2, a1 = ((s + 1) / 4) * Math.PI * 2;
    const p0 = new THREE.Vector3(Math.cos(a0) * 15, 6.5, Math.sin(a0) * 15);
    const p1 = new THREE.Vector3(Math.cos(a1) * 15, 6.5, Math.sin(a1) * 15);
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const p = p0.clone().lerp(p1, t); p.y -= Math.sin(t * Math.PI) * 1.6;
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), new THREE.MeshLambertMaterial({ color: lantCols[i % lantCols.length], emissive: lantCols[i % lantCols.length], emissiveIntensity: 0.55 }));
      l.position.copy(p); market.add(l);
    }
  }
  group.add(market);

  // ---- street lamps along the boulevard ----
  for (let z = -160; z <= 160; z += 40) {
    group.add(cyl(0.14, 0.18, 7, mat(0x2b2f36), 72, 3.5, z, 8));
    const head = box(1.6, 0.3, 0.5, mat(0x333333), 72.8, 7, z);
    group.add(head);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffc94d, emissiveIntensity: 0.8 }));
    bulb.position.set(73.4, 6.8, z); group.add(bulb);
  }

  // ---- clouds: big fluffy Tier-2 billboards of spheres ----
  const clouds = [];
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.96 });
  for (let i = 0; i < 15; i++) {
    const cl = new THREE.Group();
    const n = 4 + Math.floor(rnd() * 3);
    for (let j = 0; j < n; j++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(6 + rnd() * 7, 16, 12), cloudMat);
      s.position.set((j - n / 2) * 7 + rnd() * 3, rnd() * 2.5, rnd() * 5 - 2.5);
      s.scale.y = 0.55; cl.add(s);
    }
    cl.position.set(-180 + rnd() * 420, 95 + rnd() * 45, -220 + rnd() * 440);
    clouds.push(cl); group.add(cl);
  }

  // ---- the one sun: a bright disc with a soft glow sprite ----
  const [gc, gg] = (() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,250,220,1)'); grad.addColorStop(0.35, 'rgba(255,230,160,0.55)'); grad.addColorStop(1, 'rgba(255,230,160,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    return [c, g];
  })();
  const glowTex = new THREE.CanvasTexture(gc);
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false }));
  sunSprite.scale.set(90, 90, 1);
  scene.add(sunSprite);

  let currentSky = 'noon';
  function setSky(name) {
    const s = SKIES[name] || SKIES.noon;
    currentSky = name;
    scene.background = new THREE.Color(s.sky);
    scene.fog = new THREE.Fog(s.horizon, 170, 720);
    sun.color.setHex(s.sun); sun.intensity = s.sunI;
    sun.position.set(s.sunPos[0], s.sunPos[1], s.sunPos[2]);
    hemi.intensity = s.hemi; amb.intensity = s.amb;
    sunSprite.position.set(s.sunPos[0] * 2.4, Math.max(60, s.sunPos[1] * 2.2), s.sunPos[2] * 2.4);
    sunSprite.material.color.setHex(name === 'night' ? 0xdfe8ff : 0xfff2b0);
    sunSprite.material.opacity = name === 'night' ? 0.85 : 1;
    cloudMat.color.setHex(name === 'golden' ? 0xffd9c2 : name === 'night' ? 0x8a94b8 : 0xffffff);
    cloudMat.opacity = name === 'night' ? 0.55 : 0.96;
  }
  setSky('noon');

  // Waypoint beacon: a slim glowing column + pulsing ground ring. Slim on
  // purpose — a fat column fills the chase frame when the player flies at it.
  function makeBeacon() {
    const g = new THREE.Group();
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.1, 26, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd94d, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
    );
    col.position.y = 13; g.add(col);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.4, 3.4, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd94d, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
    );
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15; g.add(ring);
    g.userData.ring = ring;
    return g;
  }

  function update(dt, t) {
    wheel.rotation.z -= dt * 0.12;
    for (const g of gondolas) g.rotation.z = -wheel.rotation.z;
    yacht.position.y = Math.sin(t * 0.5) * 0.35 - 0.4;
    yacht.rotation.z = Math.sin(t * 0.4) * 0.012;
    for (const cl of clouds) cl.position.x += dt * 0.7;
    for (const cl of clouds) if (cl.position.x > 260) cl.position.x = -220;
  }

  return { group, setSky, get sky() { return currentSky; }, ferris, yacht, makeBeacon, update };
}
