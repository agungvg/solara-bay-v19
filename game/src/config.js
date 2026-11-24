// Solara Bay — config: missions, districts, police units, weapons, tuning.
// Every number the rest of the game reads lives here, so a mission, a unit or
// a weapon is one edit, not a hunt through the sim.
export const STEP = 1 / 60;
export const WORLD = {
  cityMinX: -130, cityMaxX: 86, cityMinZ: -170, cityMaxZ: 170,
  beachMinX: 86, beachMaxX: 122, oceanMinX: 122,
  roadX: [80, 40, 0, -40, -80, -120],
  roadZ: [-160, -120, -80, -40, 0, 40, 80, 120, 160],
  pierX: 122, pierEndX: 176, ferrisX: 152, ferrisZ: 0,
  yacht: { x: 150, z: -40 },
  market: { x: 40, z: 60 },
};

export const DISTRICTS = [
  { name: 'Marina Bay', x: 100, z: -120, w: 60, h: 60, color: '#2e7fb8' },
  { name: 'Ocean Drive', x: 60, z: -40, w: 60, h: 80, color: '#e8a33d' },
  { name: 'Lantern Row', x: 20, z: 60, w: 60, h: 80, color: '#d84a6e' },
  { name: 'Old Solara', x: -40, z: -100, w: 70, h: 70, color: '#7a5fd0' },
  { name: 'Palm Heights', x: -40, z: 20, w: 70, h: 70, color: '#3da66e' },
  { name: 'The Docks', x: -100, z: -120, w: 60, h: 60, color: '#8a6d4b' },
  { name: 'Neon Strip', x: -100, z: 40, w: 60, h: 80, color: '#c94ad8' },
  { name: 'South Beach', x: 60, z: 120, w: 70, h: 60, color: '#2eb8a6' },
];

// Eight story missions. Each stage has a label, a target point and a clock
// (game minutes after midnight). Cash varies per mission on purpose.
export const MISSIONS = [
  { id: 1, name: 'THE PIER PICKUP', cash: 1450, time: 12 * 60, sky: 'noon',
    intro: ['MARA', 'You are late, Sol. The package is on the pier — walk it, do not run it.'],
    stages: [
      { label: 'Drive to the pier and meet Mara', at: [142, 0, 0], radius: 7 },
      { label: 'Pick up the package from the dock box', at: [160, 0, 0], radius: 5 },
      { label: 'Drive the package to Lantern Row', at: [40, 0, 60], radius: 8 },
    ] },
  { id: 2, name: 'COLLECT THE DROP', cash: 2310, time: 14 * 60 + 30, sky: 'noon',
    intro: ['VEX', 'The drop is in the fruit market. The Red Jacks know. Bring a gun.'],
    stages: [
      { label: 'Reach the FRUIT market on foot', at: [40, 0, 60], radius: 8 },
      { label: 'Hold the market — drop the Red Jacks', at: [40, 0, 60], radius: 10, combat: true, kills: 3 },
      { label: 'Grab the drop and get clear', at: [40, 0, 78], radius: 6 },
    ] },
  { id: 3, name: 'OUTRUN THE SUNSET ROADBLOCK', cash: 3180, time: 17 * 60 + 45, sky: 'golden',
    intro: ['MARA', 'Roadblock on Ocean Drive. Take the jetpack — over it, not through it.'],
    stages: [
      { label: 'Fly the jetpack over the roadblock', at: [80, 0, -60], radius: 12, jetpack: true },
      { label: 'Reach the South Beach lookout', at: [80, 0, 120], radius: 10, jetpack: true },
      { label: 'Land at the marina fuel dock', at: [110, 0, -110], radius: 8 },
    ] },
  { id: 4, name: 'THE YACHT JOB', cash: 4920, time: 21 * 60 + 15, sky: 'night',
    intro: ['VEX', 'The yacht carries the Regent ledger. Swim, climb, take it. Quietly.'],
    stages: [
      { label: 'Reach the marina pier', at: [134, 0, 0], radius: 8 },
      { label: 'Signal the yacht from the pier end', at: [170, 0, 0], radius: 9 },
      { label: 'Escape to Palm Heights', at: [-40, 0, 20], radius: 10 },
    ] },
  { id: 5, name: 'TANK IT UP', cash: 3760, time: 10 * 60, sky: 'noon',
    intro: ['DRE', 'SBPD impounded my tank. Steal it back. Yes, the tank.'],
    stages: [
      { label: 'Steal the tank from the impound', at: [-100, 0, -120], radius: 9 },
      { label: 'Drive the tank to Neon Strip', at: [-100, 0, 40], radius: 10 },
      { label: 'Park it in the crew garage', at: [-60, 0, 40], radius: 8 },
    ] },
  { id: 6, name: 'WRECK THE REGENT', cash: 6840, time: 12 * 60, sky: 'noon',
    intro: ['MARA', 'The Regent runs this city. Wreck his convoy — all five cars — and do not get caught.'],
    stages: [
      { label: 'Chase the Regent convoy on Ocean Drive', at: [80, 0, -40], radius: 14, chase: true },
      { label: 'Wreck the last convoy car', at: [80, 0, 60], radius: 14, chase: true },
      { label: 'Lose the heat at the pier', at: [150, 0, 0], radius: 9 },
    ] },
  { id: 7, name: 'NIGHT SHIFT', cash: 2540, time: 23 * 60, sky: 'night',
    intro: ['VEX', 'A courier crosses Neon Strip at midnight. Intercept him — no witnesses.'],
    stages: [
      { label: 'Wait on Neon Strip for the courier', at: [-100, 0, 40], radius: 8 },
      { label: 'Take the courier case', at: [-100, 0, 60], radius: 7, combat: true, kills: 2 },
      { label: 'Deliver the case to Dre', at: [-40, 0, -100], radius: 8 },
    ] },
  { id: 8, name: 'KING OF SOLARA BAY', cash: 9210, time: 18 * 60 + 30, sky: 'golden',
    intro: ['MARA', 'One last run. Every crew, every cop, every camera. Make the city yours.'],
    stages: [
      { label: 'Hit the three crew stashes', at: [0, 0, -80], radius: 9 },
      { label: 'Jetpack to the Ferris wheel crown', at: [152, 40, 0], radius: 10, jetpack: true },
      { label: 'Return to the pier — the city is yours', at: [150, 0, 0], radius: 9 },
    ] },
];

export const POLICE_UNITS = [
  { call: 'UNIT 12', name: 'Patrol One', role: 'Chase', color: '#2b6cb0' },
  { call: 'UNIT 27', name: 'Patrol Two', role: 'Roadblock', color: '#2b6cb0' },
  { call: 'UNIT 31', name: 'Interceptor', role: 'Ram', color: '#9b2c2c' },
  { call: 'UNIT 44', name: 'K-9 Unit', role: 'Flank', color: '#2b6cb0' },
  { call: 'UNIT 58', name: 'Highway', role: 'Pursuit', color: '#9b2c2c' },
  { call: 'AIR 1', name: 'Sky Eye', role: 'Helicopter', color: '#744210' },
];

export const WEAPONS = [
  { name: 'PISTOL', icon: '🔫', ammo: 48, dmg: 20, rate: 0.28 },
  { name: 'SMG', icon: '🔫', ammo: 120, dmg: 12, rate: 0.09 },
  { name: 'SHOTGUN', icon: '💥', ammo: 24, dmg: 45, rate: 0.9 },
  { name: 'RIFLE', icon: '🎯', ammo: 90, dmg: 34, rate: 0.16 },
  { name: 'SNIPER', icon: '🔭', ammo: 12, dmg: 90, rate: 1.4 },
  { name: 'ROCKET', icon: '🚀', ammo: 4, dmg: 120, rate: 1.8 },
];

export const CREW = [
  { name: 'MARA', role: 'Fixer · plans every job', status: 'LOYAL' },
  { name: 'VEX', role: 'Driver · never caught', status: 'LOYAL' },
  { name: 'DRE', role: 'Muscle · owns the tank', status: 'LOYAL' },
  { name: 'SOL', role: 'You · King of Solara Bay', status: 'BOSS' },
];

export const WORKSHOP = [
  { name: 'Turbocharger Mk II', price: 2400, owned: true },
  { name: 'Bulletproof Tires', price: 1800, owned: true },
  { name: 'Jetpack Fuel Tank XL', price: 3200, owned: true },
  { name: 'Armored Doors', price: 4500, owned: false },
  { name: 'Nitro Boost', price: 5200, owned: false },
  { name: 'Stealth Paint', price: 6800, owned: false },
];

export const CAREER = {
  cash: 21340, completion: 66.1, missionsDone: 5, missionsTotal: 8,
  playtime: '14h 22m', distanceKm: 312, topSpeed: 187, arrests: 0,
  shotsFired: 1240, shotsHit: 862, carsStolen: 47, jetpackFlights: 23,
  date: '22/11/2026',
};

export const TRACKS = [
  { name: 'Story missions', pct: 62 },
  { name: 'Side jobs', pct: 71 },
  { name: 'Stunt jumps', pct: 48 },
  { name: 'Street races', pct: 83 },
  { name: 'Collectibles', pct: 55 },
  { name: 'Wanted escapes', pct: 77 },
  { name: 'Workshop upgrades', pct: 50 },
  { name: 'Crew loyalty', pct: 90 },
];

export const MISSION_RATINGS = ['S', 'A', 'B', 'A', 'S', '—', '—', '—'];

// Deterministic RNG so every staged shot renders the same frame.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2d(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }
export function fmtClock(minutes) {
  const h = Math.floor(minutes / 60) % 24, m = Math.floor(minutes % 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
export function fmtCash(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
