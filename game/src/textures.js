// Solara Bay — textures: every surface is a procedural canvas texture, so
// nothing in the city is flat or empty: facades get windows and grime, roads
// get lane paint and cracks, sand gets speckles, water gets sparkle.
import * as THREE from 'three';
import { mulberry32 } from './config.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function tex(c, rx = 1, ry = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry); t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A building facade: base colour, floor grid of lit windows, darker ground
// floor with a shopfront, grime streaks near the top and bottom.
export function facadeTexture(base, accent, seed, floors = 8) {
  const [c, g] = canvas(256, 512);
  const rnd = mulberry32(seed);
  g.fillStyle = base; g.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(0,0,0,${0.02 + rnd() * 0.05})`;
    g.fillRect(rnd() * 256, rnd() * 512, 2 + rnd() * 8, 2 + rnd() * 20);
  }
  const fh = 512 / floors;
  for (let f = 0; f < floors; f++) {
    const y = f * fh + 8;
    for (let x = 14; x < 242; x += 34) {
      const lit = rnd() < 0.55;
      g.fillStyle = lit ? (rnd() < 0.5 ? '#ffe9a8' : '#bfe9ff') : 'rgba(20,28,44,0.85)';
      g.fillRect(x, y, 22, fh - 20);
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.fillRect(x, y, 22, 3);
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2;
      g.strokeRect(x, y, 22, fh - 20);
    }
  }
  // Ground-floor shopfront.
  g.fillStyle = accent; g.fillRect(0, 512 - 74, 256, 74);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (let x = 12; x < 244; x += 46) g.fillRect(x, 512 - 62, 34, 40);
  g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, 512 - 78, 256, 4);
  return tex(c);
}

// Asphalt with a dashed centre line running along the tile's U axis, edge
// lines, cracks and patch stains. Roads tile it along their length.
export function roadTexture(seed) {
  const [c, g] = canvas(256, 256);
  const rnd = mulberry32(seed);
  g.fillStyle = '#33383f'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${rnd() < 0.5 ? '255,255,255' : '0,0,0'},${0.02 + rnd() * 0.05})`;
    g.fillRect(rnd() * 256, rnd() * 256, 2, 2);
  }
  for (let i = 0; i < 7; i++) {
    g.fillStyle = `rgba(0,0,0,${0.08 + rnd() * 0.1})`;
    g.beginPath(); g.ellipse(rnd() * 256, rnd() * 256, 12 + rnd() * 26, 8 + rnd() * 18, rnd() * 3, 0, 7); g.fill();
  }
  g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    g.beginPath(); let x = rnd() * 256, y = rnd() * 256;
    g.moveTo(x, y);
    for (let s = 0; s < 6; s++) { x += (rnd() - 0.5) * 40; y += (rnd() - 0.5) * 40; g.lineTo(x, y); }
    g.stroke();
  }
  // Centre dashes run along U (the road's length); edge lines frame it.
  g.fillStyle = '#f5d76e';
  for (let x = 0; x < 256; x += 64) g.fillRect(x + 8, 124, 34, 8);
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.fillRect(0, 6, 256, 4); g.fillRect(0, 246, 256, 4);
  return tex(c);
}

// Warm beach sand with speckles, shell dots and a wet band at the waterline.
export function sandTexture(seed) {
  const [c, g] = canvas(256, 256);
  const rnd = mulberry32(seed);
  g.fillStyle = '#e8cf9a'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const v = rnd();
    g.fillStyle = v < 0.4 ? 'rgba(190,150,90,0.35)' : v < 0.8 ? 'rgba(255,240,200,0.4)' : 'rgba(255,255,255,0.5)';
    g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  for (let i = 0; i < 24; i++) {
    g.fillStyle = `rgba(255,${220 + Math.floor(rnd() * 30)},${200 + Math.floor(rnd() * 40)},0.8)`;
    g.beginPath(); g.arc(rnd() * 256, rnd() * 256, 1.5 + rnd() * 2.5, 0, 7); g.fill();
  }
  return tex(c, 8, 8);
}

// Ocean: deep blue with sun sparkle and slow-looking wave streaks.
export function waterTexture(seed) {
  const [c, g] = canvas(256, 256);
  const rnd = mulberry32(seed);
  const grad = g.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, '#1b7fb8'); grad.addColorStop(0.5, '#1570a8'); grad.addColorStop(1, '#1e8fc4');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 60; i++) {
    g.strokeStyle = `rgba(255,255,255,${0.05 + rnd() * 0.12})`; g.lineWidth = 1 + rnd() * 2;
    const y = rnd() * 256, x = rnd() * 256, len = 20 + rnd() * 60;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + len / 2, y + (rnd() - 0.5) * 8, x + len, y); g.stroke();
  }
  for (let i = 0; i < 130; i++) {
    g.fillStyle = `rgba(255,255,255,${0.15 + rnd() * 0.35})`;
    g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 2, 1);
  }
  return tex(c, 10, 10);
}

// Grass / park green with mow stripes and speckle.
export function grassTexture(seed) {
  const [c, g] = canvas(256, 256);
  const rnd = mulberry32(seed);
  g.fillStyle = '#4d9e4f'; g.fillRect(0, 0, 256, 256);
  for (let s = 0; s < 8; s++) { g.fillStyle = s % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'; g.fillRect(0, s * 32, 256, 32); }
  for (let i = 0; i < 1800; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(0,60,0,0.25)' : 'rgba(180,255,150,0.2)';
    g.fillRect(rnd() * 256, rnd() * 256, 1, 2 + rnd() * 3);
  }
  return tex(c, 6, 6);
}

// A big bold shop sign painted on canvas: legible at a distance, never split.
export function signTexture(text, bg, fg, sub = '') {
  const [c, g] = canvas(512, 256);
  g.fillStyle = bg; g.fillRect(0, 0, 512, 256);
  g.strokeStyle = fg; g.lineWidth = 10; g.strokeRect(8, 8, 496, 240);
  g.fillStyle = fg; g.font = '900 120px Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 256, sub ? 108 : 128);
  if (sub) {
    g.font = '800 44px Arial, sans-serif';
    g.fillText(sub, 256, 196);
  }
  return tex(c);
}

// POLICE door lettering: white door panel, black POLICE wordmark, badge dot.
export function policeDoorTexture() {
  const [c, g] = canvas(256, 128);
  g.fillStyle = '#f2f5f7'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#111'; g.font = '900 52px Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('POLICE', 128, 52);
  g.fillStyle = '#c8a227'; g.beginPath(); g.arc(128, 102, 12, 0, 7); g.fill();
  g.fillStyle = '#111'; g.font = '900 16px Arial'; g.fillText('911', 128, 103);
  return tex(c);
}

// Striped awning for market stalls and shopfronts.
export function awningTexture(c1, c2) {
  const [c, g] = canvas(128, 64);
  for (let x = 0; x < 128; x += 16) { g.fillStyle = (x / 16) % 2 ? c1 : c2; g.fillRect(x, 0, 16, 64); }
  g.fillStyle = 'rgba(0,0,0,0.12)';
  for (let x = 0; x < 128; x += 16) g.fillRect(x, 0, 2, 64);
  return tex(c, 2, 1);
}

// Sidewalk slabs with joints and speckle.
export function sidewalkTexture(seed) {
  const [c, g] = canvas(256, 256);
  const rnd = mulberry32(seed);
  g.fillStyle = '#b9b3a4'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 3;
  for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke(); }
  for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(0,0,0,${0.03 + rnd() * 0.05})`; g.fillRect(rnd() * 256, rnd() * 256, 2, 2); }
  return tex(c, 6, 6);
}
