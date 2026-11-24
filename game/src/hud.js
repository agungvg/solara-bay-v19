// Solara Bay — HUD: the DOM overlay. Mission card, cash, clock, wanted
// stars, health and jetpack fuel, weapon slots, speed, circular minimap,
// dialogue, banners, the live police-unit list — and the full meta screen
// (map, completion ring, progress tracks, ratings, career, workshop,
// weapons, crew, saves) on a solid opaque background, so nothing bleeds
// through from the world behind it.
import { MISSIONS, POLICE_UNITS, WEAPONS, CREW, WORKSHOP, CAREER, TRACKS, MISSION_RATINGS, DISTRICTS, WORLD, fmtClock, fmtCash, clamp } from './config.js';

const $ = id => document.getElementById(id);
const els = {};
['mName', 'mObj', 'mDist', 'cash', 'clock', 'stars', 'wantedLabel', 'healthFill', 'fuelBar', 'fuelFill',
 'policeList', 'policeRows', 'speed', 'speedUnit', 'vehName', 'weapons', 'hint', 'dialogue', 'dlgWho',
 'dlgSay', 'banner', 'bannerBig', 'bannerSub', 'toast', 'crosshair', 'vignette', 'title', 'meta', 'minimap'
].forEach(id => { els[id] = $(id); });
const mm = els.minimap.getContext('2d');

const SKY_LABEL = { noon: 'NOON', golden: 'GOLDEN HOUR', night: 'NIGHT' };

function starsHtml(n) {
  let s = '';
  for (let i = 0; i < 5; i++) s += `<span class="${i < n ? 'on' : 'off'}">★</span>`;
  return s;
}

export function buildWeaponSlots() {
  els.weapons.innerHTML = WEAPONS.map((w, i) =>
    `<div class="wslot" id="wslot${i}"><div class="wic">${w.icon}</div><div class="wname">${w.name}</div><div class="wammo" id="wammo${i}">${w.ammo}</div></div>`).join('');
}

export function updateHUD(game, sky) {
  const s = game.state;
  const m = game.currentMission();
  const stage = game.currentStage();
  els.mName.textContent = m ? `M${m.id} · ${m.name}` : 'FREE ROAM';
  els.mObj.textContent = stage ? stage.label : 'Explore Solara Bay — press M for map & saves';
  els.mDist.textContent = stage ? `◆ ${Math.round(s.stageDist || 0)} m${stage.combat ? `  ·  DROPPED ${s.kills}/${stage.kills || 1}` : ''}${stage.jetpack ? '  ·  JETPACK' : ''}` : '';
  els.cash.textContent = fmtCash(s.cash);
  els.clock.textContent = `${fmtClock(s.time)} · ${SKY_LABEL[sky] || 'NOON'}`;
  els.stars.innerHTML = starsHtml(s.wanted);
  els.wantedLabel.textContent = s.wanted > 0 ? `WANTED ${s.wanted}` : 'WANTED 0';
  els.wantedLabel.style.color = s.wanted >= 4 ? '#ff5a5a' : '#ffb3b3';
  els.healthFill.style.width = `${s.health}%`;
  els.healthFill.style.background = s.health > 50 ? 'linear-gradient(90deg,#37e05e,#a4ff7a)' : s.health > 25 ? 'linear-gradient(90deg,#e0a537,#ffd94d)' : 'linear-gradient(90deg,#e03737,#ff7a7a)';
  els.fuelBar.style.display = (s.jetpackOn || s.fuel < 100) ? 'block' : 'none';
  els.fuelFill.style.width = `${s.fuel}%`;
  els.speed.textContent = Math.round(s.speedKmh);
  els.speedUnit.textContent = s.jetpackOn ? 'KM/H · JETPACK' : s.player.onFoot ? 'KM/H · ON FOOT' : 'KM/H';
  els.vehName.textContent = s.jetpackOn ? 'JETPACK — FUEL ' + Math.round(s.fuel) + '%' : s.player.onFoot ? 'ON FOOT' : 'SOLARA GT · HERO CAR';
  for (let i = 0; i < WEAPONS.length; i++) {
    const slot = document.getElementById('wslot' + i);
    if (slot) slot.classList.toggle('sel', i === s.weapon);
    const am = document.getElementById('wammo' + i);
    if (am) am.textContent = s.reloadT > 0 && i === s.weapon ? 'RELOADING' : s.ammo[i];
  }
  els.crosshair.style.display = s.player.onFoot ? 'block' : 'none';
  if (s.dialogue) {
    els.dialogue.style.display = 'block';
    els.dlgWho.textContent = s.dialogue.who;
    els.dlgSay.textContent = s.dialogue.text;
  } else els.dialogue.style.display = 'none';
  if (s.banner) {
    els.banner.style.display = 'block';
    els.bannerBig.textContent = s.banner.big;
    els.bannerSub.textContent = s.banner.sub;
  } else els.banner.style.display = 'none';
  if (s.toast) {
    els.toast.style.display = 'block';
    els.toast.textContent = s.toast;
  } else els.toast.style.display = 'none';
  els.vignette.style.boxShadow = `inset 0 0 140px 40px rgba(255,0,0,${(s.damageFlash * 0.55).toFixed(2)})`;
  // Live police-unit list with distances.
  const police = game.cars.filter(c => c.police && c.alive);
  if (police.length > 0) {
    els.policeList.style.display = 'block';
    els.policeRows.innerHTML = police.map(c => {
      const d = Math.round(Math.hypot(c.x - s.player.x, c.z - s.player.z));
      return `<div><b>${c.unit.call}</b> ${c.unit.name} · ${c.unit.role} · ${d} m</div>`;
    }).join('') + (game.helis.length ? `<div><b>AIR 1</b> Sky Eye · Helicopter · overhead</div>` : '');
  } else els.policeList.style.display = 'none';
  drawMinimap(game);
}

function drawMinimap(game) {
  const s = game.state;
  const W = 208, C = W / 2;
  const scale = W / 340; // world x -130..210, z -170..170 mapped into the circle
  const px = x => C + (x - 40) * scale;
  const py = z => C + z * scale;
  mm.clearRect(0, 0, W, W);
  mm.save();
  mm.beginPath(); mm.arc(C, C, C - 2, 0, 7); mm.clip();
  // Ocean + sand + city base.
  mm.fillStyle = '#12324a'; mm.fillRect(0, 0, W, W);
  mm.fillStyle = '#1b7fb8'; mm.fillRect(px(122), 0, W - px(122), W);
  mm.fillStyle = '#e8cf9a'; mm.fillRect(px(86), 0, px(122) - px(86), W);
  mm.fillStyle = '#2c4a63'; mm.fillRect(0, 0, px(86), W);
  // Districts, faint.
  for (const d of DISTRICTS) {
    mm.fillStyle = d.color + '55';
    mm.fillRect(px(d.x - d.w / 2), py(d.z - d.h / 2), d.w * scale, d.h * scale);
  }
  // Roads.
  mm.strokeStyle = 'rgba(255,255,255,0.55)'; mm.lineWidth = 2;
  for (const x of WORLD.roadX) { mm.beginPath(); mm.moveTo(px(x), 0); mm.lineTo(px(x), W); mm.stroke(); }
  for (const z of WORLD.roadZ) { mm.beginPath(); mm.moveTo(0, py(z)); mm.lineTo(W, py(z)); mm.stroke(); }
  // Pier + Ferris wheel + yacht.
  mm.strokeStyle = '#e8a33d'; mm.lineWidth = 4;
  mm.beginPath(); mm.moveTo(px(122), py(0)); mm.lineTo(px(176), py(0)); mm.stroke();
  mm.fillStyle = '#ff5a7a'; mm.beginPath(); mm.arc(px(152), py(0), 6, 0, 7); mm.fill();
  mm.fillStyle = '#ffffff'; mm.beginPath(); mm.arc(px(150), py(-40), 4, 0, 7); mm.fill();
  mm.strokeStyle = '#ffffff'; mm.lineWidth = 1.5; mm.beginPath(); mm.arc(px(150), py(-40), 7, 0, 7); mm.stroke();
  // Mission beacon.
  const stage = game.currentStage();
  if (stage) {
    mm.fillStyle = '#ffd94d';
    mm.save(); mm.translate(px(stage.at[0]), py(stage.at[2])); mm.rotate(Math.PI / 4);
    mm.fillRect(-5, -5, 10, 10); mm.restore();
    mm.strokeStyle = '#ffd94d'; mm.lineWidth = 2;
    mm.beginPath(); mm.arc(px(stage.at[0]), py(stage.at[2]), 10 + Math.sin(s.t * 3) * 3, 0, 7); mm.stroke();
  }
  // Police dots, crowd dots, player arrow.
  for (const c of game.cars) {
    if (c === game.hero) continue;
    mm.fillStyle = c.police ? '#ff4040' : '#cfe9ff';
    mm.beginPath(); mm.arc(px(c.x), py(c.z), c.police ? 4 : 2.5, 0, 7); mm.fill();
  }
  for (const e of game.peds) {
    if (e.downed) { mm.fillStyle = '#ff2020'; mm.beginPath(); mm.arc(px(e.x), py(e.z), 3, 0, 7); mm.fill(); }
  }
  mm.save();
  mm.translate(px(s.player.x), py(s.player.z));
  mm.rotate(-s.player.heading + Math.PI);
  mm.fillStyle = '#ffffff'; mm.strokeStyle = '#111'; mm.lineWidth = 1.5;
  mm.beginPath(); mm.moveTo(0, -8); mm.lineTo(6, 6); mm.lineTo(0, 3); mm.lineTo(-6, 6); mm.closePath(); mm.fill(); mm.stroke();
  mm.restore();
  mm.restore();
  // North tick.
  mm.fillStyle = '#fff'; mm.font = '900 12px Arial'; mm.textAlign = 'center';
  mm.fillText('N', C, 14);
}

export function setHint(text) { els.hint.textContent = text; }
export function showTitle(show) { els.title.style.display = show ? 'flex' : 'none'; }
export function showMeta(show) { els.meta.style.display = show ? 'block' : 'none'; }
export function isMetaOpen() { return els.meta.style.display === 'block'; }

// ---- the meta screen: map, ring, tracks, ratings, career, workshop,
// weapons, crew, saves — solid opaque, nothing behind it shows through. ----
export function renderMeta(game, stagedSaves) {
  const s = game.state;
  const saves = stagedSaves || loadSaves();
  const ringR = 54, ringC = 2 * Math.PI * ringR;
  const off = ringC * (1 - CAREER.completion / 100);
  const missionRows = MISSIONS.map((m, i) => {
    const done = i < 5 || s.missionDone[i];
    return `<div class="mrow"><span>M${m.id} · ${m.name}</span><span>${done ? `<span class="gold">${MISSION_RATINGS[i]}</span> · ${fmtCash(m.cash)}` : '<span style="color:#8aa">LOCKED</span>'}</span></div>`;
  }).join('');
  const trackRows = TRACKS.map(t =>
    `<div class="track"><div class="tl"><span>${t.name}</span><span>${t.pct}%</span></div><div class="tb"><div class="tf" style="width:${t.pct}%"></div></div></div>`).join('');
  const shopRows = WORKSHOP.map(w =>
    `<div class="mrow"><span>${w.name}</span><span>${w.owned ? '<b>OWNED</b>' : `<span class="gold">${fmtCash(w.price)}</span> · LOCKED`}</span></div>`).join('');
  const weaponRows = WEAPONS.map((w, i) =>
    `<div class="mrow"><span>${w.icon} ${w.name}</span><span>${s.ammo[i]} ammo · ${w.dmg} dmg</span></div>`).join('');
  const crewRows = CREW.map(c => `<div class="mrow"><span>${c.name}</span><span>${c.role} · <b>${c.status}</b></span></div>`).join('');
  const slotHtml = [0, 1, 2].map(i => {
    const sv = saves[i];
    return sv
      ? `<div class="slot filled"><div class="s1">SLOT ${i + 1} — ${sv.label}</div><div class="s2">${sv.detail}</div></div>`
      : `<div class="slot"><div class="s1">SLOT ${i + 1} — EMPTY</div><div class="s2">No save yet</div></div>`;
  }).join('');
  els.meta.innerHTML = `
    <h1>SOLARA <span>BAY</span> — MAP &amp; STATS</h1>
    <div class="msub">M5 · TANK IT UP · ${fmtCash(s.cash)} · WANTED ${s.wanted} · ${fmtClock(s.time)} · SOL</div>
    <div class="mgrid">
      <div class="mcard"><h2>MAP — 8 DISTRICTS</h2><canvas id="metaMap" width="420" height="360" style="width:100%;border-radius:8px"></canvas>
        <div class="mrow"><span>Completion</span><span><b>${CAREER.completion}%</b></span></div>
        <div class="ringwrap" style="margin-top:10px">
          <svg width="130" height="130" viewBox="0 0 130 130">
            <circle cx="65" cy="65" r="${ringR}" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="11"/>
            <circle cx="65" cy="65" r="${ringR}" fill="none" stroke="#7dff9b" stroke-width="11" stroke-linecap="round" stroke-dasharray="${ringC.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 65 65)"/>
            <text x="65" y="72" text-anchor="middle" fill="#7dff9b" font-size="22" font-weight="900">${CAREER.completion}%</text>
          </svg>
          <div><div class="pct">${CAREER.missionsDone}/${CAREER.missionsTotal} missions</div><div style="font-size:13px;color:#9fe8ff">${CAREER.playtime} played · ${CAREER.distanceKm} km driven</div></div>
        </div>
      </div>
      <div class="mcard"><h2>PROGRESS TRACKS</h2>${trackRows}<h2 style="margin-top:16px">MISSION RATINGS</h2>${missionRows}</div>
      <div>
        <div class="mcard"><h2>CAREER STATS</h2>
          <div class="mrow"><span>Cash</span><b>${fmtCash(CAREER.cash)}</b></div>
          <div class="mrow"><span>Top speed</span><span>${CAREER.topSpeed} km/h</span></div>
          <div class="mrow"><span>Cars stolen</span><span>${CAREER.carsStolen}</span></div>
          <div class="mrow"><span>Jetpack flights</span><span>${CAREER.jetpackFlights}</span></div>
          <div class="mrow"><span>Shots hit</span><span>${CAREER.shotsHit} / ${CAREER.shotsFired}</span></div>
          <div class="mrow"><span>Arrests</span><span>${CAREER.arrests}</span></div>
        </div>
        <div class="mcard" style="margin-top:16px"><h2>WORKSHOP</h2>${shopRows}</div>
      </div>
      <div class="mcard"><h2>WEAPONS &amp; GEAR</h2>${weaponRows}</div>
      <div class="mcard"><h2>CREW</h2>${crewRows}<h2 style="margin-top:16px">SAVE SLOTS</h2>${slotHtml}</div>
      <div class="mcard"><h2>DISTRICTS</h2>${DISTRICTS.map(d => `<div class="mrow"><span>${d.name}</span><span style="color:${d.color}">●</span></div>`).join('')}
      <div class="mrow"><span>Next job</span><span class="gold">M6 · WRECK THE REGENT</span></div></div>
    </div>
    <button id="metaClose">CLOSE — BACK TO SOLARA BAY (M)</button>`;
  $('metaClose').addEventListener('click', () => showMeta(false));
  drawMetaMap(game);
}

function drawMetaMap(game) {
  const c = $('metaMap');
  if (!c) return;
  const g = c.getContext('2d');
  const W = 420, H = 360;
  g.fillStyle = '#12324a'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#1b7fb8'; g.fillRect(300, 0, 120, H);
  g.fillStyle = '#e8cf9a'; g.fillRect(272, 0, 28, H);
  g.fillStyle = '#2c4a63'; g.fillRect(0, 0, 272, H);
  const px = x => 10 + ((x + 130) / 260) * 262;
  const py = z => 10 + ((z + 170) / 340) * 340;
  // Two passes: boxes first, then all labels on top, so no label is ever
  // covered by a neighbouring district box.
  for (const d of DISTRICTS) {
    g.fillStyle = d.color;
    g.globalAlpha = 0.75;
    g.fillRect(px(d.x - d.w / 2), py(d.z - d.h / 2), d.w * (262 / 260), d.h);
    g.globalAlpha = 1;
  }
  for (const d of DISTRICTS) {
    g.fillStyle = '#fff'; g.font = '900 10px Arial'; g.textAlign = 'center';
    g.fillText(d.name.toUpperCase(), px(d.x), py(d.z) + 4);
  }
  g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 2;
  for (const x of WORLD.roadX) { g.beginPath(); g.moveTo(px(x), 0); g.lineTo(px(x), H); g.stroke(); }
  for (const z of WORLD.roadZ) { g.beginPath(); g.moveTo(0, py(z)); g.lineTo(W, py(z)); g.stroke(); }
  g.strokeStyle = '#e8a33d'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(px(122), py(0)); g.lineTo(px(176), py(0)); g.stroke();
  g.fillStyle = '#ff5a7a'; g.beginPath(); g.arc(px(152), py(0), 7, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(px(150), py(-40), 5, 0, 7); g.fill();
  g.fillStyle = '#ffd94d'; g.font = '900 12px Arial'; g.textAlign = 'left';
  g.fillText('★ PIER', px(126), py(0) - 10);
  g.fillText('⛵ YACHT', px(172), py(-15) - 10);
  g.fillText('🎡 FERRIS WHEEL', px(120), py(0) + 26);
  const s = game.state;
  g.fillStyle = '#fff'; g.strokeStyle = '#111'; g.lineWidth = 2;
  g.beginPath(); g.arc(px(s.player.x), py(s.player.z), 7, 0, 7); g.fill(); g.stroke();
  g.fillStyle = '#fff'; g.font = '900 11px Arial'; g.fillText('YOU', px(s.player.x) + 10, py(s.player.z) + 4);
}

export function loadSaves() {
  try {
    const raw = localStorage.getItem('solara-bay-saves-v19');
    if (raw) return JSON.parse(raw);
  } catch { /* storage unavailable: show empty slots */ }
  return [null, null, null];
}
export function storeSave(slot, label, detail) {
  const saves = loadSaves();
  saves[slot] = { label, detail };
  try { localStorage.setItem('solara-bay-saves-v19', JSON.stringify(saves)); } catch { /* ignore */ }
  return saves;
}
