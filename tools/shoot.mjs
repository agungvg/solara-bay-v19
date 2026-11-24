// Solara Bay — shoot harness (Node 22+ stdlib only). Drives headless Chrome
// over CDP, stages a deterministic scene (?shot=…), advances the fixed
// 60 Hz sim with window.__step (headless Chrome throttles rAF, so the game
// never relies on it), fires fresh combat effects, and captures a 1280x720
// PNG. If the PNG is over the 256 KiB cap it is re-encoded with an adaptive
// palette + Floyd–Steinberg dithering — pixels only, nothing in the frame
// moves, nothing is added or removed.
//   node tools/shoot.mjs --shot cover --out screenshots/1-cover.png
//   node tools/shoot.mjs --playtest
import { spawn } from 'node:child_process';
import { writeFileSync, statSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const args = new Map();
for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i].startsWith('--')) args.set(process.argv[i].slice(2), process.argv[i + 1] ?? '1');
}
const PORT = Number(args.get('port') || 8901);
const CHROME = process.env.CHROME || 'chrome-headless-shell';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Minimal PNG decoder for 8-bit non-interlaced RGB/RGBA screenshots: parse
// chunks, inflate IDAT, undo per-row filters, return RGBA bytes.
import { inflateSync } from 'node:zlib';
function decodePNG(png) {
  let pos = 8, w = 0, h = 0, colorType = 6, bitDepth = 8;
  const idat = [];
  while (pos < png.length) {
    const len = png.readUInt32BE(pos);
    const type = png.toString('ascii', pos + 4, pos + 8);
    const data = png.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) throw new Error(`unsupported PNG: depth ${bitDepth} type ${colorType}`);
  const channels = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * channels;
  const out = Buffer.alloc(w * h * 4);
  let p = 0;
  const prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    const row = raw.subarray(p, p + stride); p += stride;
    const cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let v = row[x];
      if (filter === 1) v = (v + a) & 0xff;
      else if (filter === 2) v = (v + b) & 0xff;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
      }
      cur[x] = v;
    }
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4, s = x * channels;
      out[o] = cur[s]; out[o + 1] = cur[s + 1]; out[o + 2] = cur[s + 2];
      out[o + 3] = channels === 4 ? cur[s + 3] : 255;
    }
    prev.set(cur);
  }
  return out;
}

// ---------- minimal PNG encoder (colour type 3, adaptive palette) ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
function encodePalettedPNG(w, h, indices, palette) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 3; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(h * (w + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w + 1)] = 0;
    indices.copy(raw, y * (w + 1) + 1, y * w, (y + 1) * w);
  }
  const plte = Buffer.from(palette.flatMap(c => [c[0], c[1], c[2]]));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('PLTE', plte),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Median-cut palette from raw RGBA pixels.
function medianCutPalette(rgba, maxColors) {
  const pixels = [];
  for (let i = 0; i < rgba.length; i += 4) pixels.push([rgba[i], rgba[i + 1], rgba[i + 2]]);
  let boxes = [pixels];
  while (boxes.length < maxColors) {
    let bi = -1, bestRange = 0, bestCh = 0;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i].length < 2) continue;
      for (let ch = 0; ch < 3; ch++) {
        let lo = 255, hi = 0;
        for (const p of boxes[i]) { if (p[ch] < lo) lo = p[ch]; if (p[ch] > hi) hi = p[ch]; }
        if (hi - lo > bestRange) { bestRange = hi - lo; bestCh = ch; bi = i; }
      }
    }
    if (bi === -1) break;
    const box = boxes[bi].sort((a, b) => a[bestCh] - b[bestCh]);
    const mid = box.length >> 1;
    boxes.splice(bi, 1, box.slice(0, mid), box.slice(mid));
  }
  return boxes.map(box => {
    let r = 0, g = 0, b = 0;
    for (const p of box) { r += p[0]; g += p[1]; b += p[2]; }
    const n = box.length || 1;
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  });
}

function quantize(rgba, w, h, maxColors) {
  const palette = medianCutPalette(rgba, maxColors);
  const cache = new Map();
  function nearest(r, g, b) {
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    let bi = 0, bd = Infinity;
    for (let i = 0; i < palette.length; i++) {
      const dr = r - palette[i][0], dg = g - palette[i][1], db = b - palette[i][2];
      const d = dr * dr + dg * dg + db * db;
      if (d < bd) { bd = d; bi = i; }
    }
    cache.set(key, bi);
    return bi;
  }
  const indices = Buffer.alloc(w * h);
  const err = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, o = (y * w + x) * 3;
      const r = Math.max(0, Math.min(255, rgba[i] + err[o]));
      const g = Math.max(0, Math.min(255, rgba[i + 1] + err[o + 1]));
      const b = Math.max(0, Math.min(255, rgba[i + 2] + err[o + 2]));
      const pi = nearest(r, g, b);
      indices[y * w + x] = pi;
      const er = r - palette[pi][0], eg = g - palette[pi][1], eb = b - palette[pi][2];
      const spread = [[1, 0, 7 / 16], [-1, 1, 3 / 16], [0, 1, 5 / 16], [1, 1, 1 / 16]];
      for (const [dx, dy, f] of spread) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= w || ny >= h) continue;
        const no = (ny * w + nx) * 3;
        err[no] += er * f; err[no + 1] += eg * f; err[no + 2] += eb * f;
      }
    }
  }
  return encodePalettedPNG(w, h, indices, palette);
}

// ---------- CDP driver ----------
class CDP {
  constructor(wsUrl) { this.ws = new WebSocket(wsUrl); this.id = 0; this.pending = new Map(); this.events = []; }
  async open(timeoutMs = 15000) {
    await new Promise((res, rej) => {
      const to = setTimeout(() => rej(new Error('websocket connect timeout')), timeoutMs);
      this.ws.onopen = () => { clearTimeout(to); res(); };
      this.ws.onerror = e => { clearTimeout(to); rej(new Error('websocket error')); };
    });
    this.ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) { this.pending.get(m.id)(m); this.pending.delete(m.id); }
      else if (m.method) this.events.push(m);
    };
  }
  call(method, params = {}, timeoutMs = 120000) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      const to = setTimeout(() => { this.pending.delete(id); rej(new Error('CDP call timeout: ' + method)); }, timeoutMs);
      this.pending.set(id, m => { clearTimeout(to); m.error ? rej(new Error(m.error.message)) : res(m.result); });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expr) {
    const r = await this.call('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('page error: ' + JSON.stringify(r.exceptionDetails).slice(0, 600));
    return r.result.value;
  }
  async waitFor(cond, timeout = 30000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      try { if (await this.eval(cond)) return true; } catch { /* not ready yet */ }
      await sleep(250);
    }
    throw new Error('timeout waiting for ' + cond);
  }
  close() { try { this.ws.close(); } catch { /* already closed */ } }
}

async function main() {
  const server = spawn('node', [join(root, 'serve.ts'), '--port', String(PORT)], { stdio: 'pipe' });
  await sleep(1200);
  const chrome = spawn(CHROME, [
    '--headless', '--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader',
    `--remote-debugging-port=9223`, '--window-size=1280,720', '--hide-scrollbars',
    'about:blank',
  ], { stdio: 'pipe' });
  try {
    await sleep(2500);
    // Wait for the DevTools HTTP endpoint before creating a target.
    let created = null;
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        const playtest0 = args.has('playtest');
        const shot0 = args.get('shot');
        const url0 = `http://127.0.0.1:${PORT}/index.html${shot0 ? `?shot=${shot0}` : ''}`;
        created = await (await fetch('http://127.0.0.1:9223/json/new?' + encodeURIComponent(url0), { method: 'PUT' })).json();
        break;
      } catch { await sleep(500); }
    }
    if (!created) throw new Error('chrome DevTools endpoint never came up');
    const target = new CDP(created.webSocketDebuggerUrl);
    await target.open();
    await target.call('Page.enable');
    await target.call('Runtime.enable');
    await target.call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    await target.waitFor('window.__game && document.readyState === "complete"');
    await sleep(1200);
    const webgl = await target.eval('(()=>{const c=document.createElement("canvas");return !!c.getContext("webgl2")})()');
    console.log('webgl2:', webgl);
    const playtest = args.has('playtest');
    const shot = args.get('shot');
    if (playtest) {
      const res = await target.eval('window.__playtest()');
      console.log('PLAYTEST:', JSON.stringify(res));
      return;
    }
    if (!shot) throw new Error('pass --shot <name> or --playtest');
    console.log('stepping…');
    const stepped = await target.eval(`window.__step(${shot === 'cover' ? 30 : shot === 'chase' ? 60 : shot === 'foot' ? 90 : 30})`);
    console.log('stepped:', JSON.stringify(stepped));
    console.log('fx…');
    const fxRes = await target.eval(`window.__fx(${JSON.stringify(shot)})`);
    console.log('fx done:', JSON.stringify(fxRes));
    await sleep(80);
    console.log('capturing…');
    let shot64 = (await target.call('Page.captureScreenshot', { format: 'png' })).data;
    let png = Buffer.from(shot64, 'base64');
    console.log('raw png bytes:', png.length);
    const out = args.get('out') || join(root, 'screenshots', `${shot}.png`);
    if (png.length > 262144) {
      console.log('over cap — quantizing from the captured PNG…');
      const rgba = decodePNG(png);
      for (const colors of [256, 192, 128, 96, 64]) {
        png = quantize(rgba, 1280, 720, colors);
        console.log(`palette ${colors}: ${png.length} bytes`);
        if (png.length <= 262144) break;
      }
    }
    writeFileSync(out, png);
    console.log('wrote', out, statSync(out).size, 'bytes');
  } finally {
    chrome.kill('SIGKILL');
    server.kill('SIGKILL');
  }
}
main().catch(e => { console.error('SHOOT FAILED:', e.message); process.exit(1); });
