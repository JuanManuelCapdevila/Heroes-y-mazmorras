const E = require('../src/engine.js');
const N = +process.argv[2] || 1000;
const mode = process.argv[3] || 'vs';
const P = JSON.parse(process.argv[4] || '{}');
const names = Object.keys(E.PERSONAS);
function play(personas, seed) {
  const s = E.createGame({ seed, human: -1, personas, P });
  let k = 0, bad = 0;
  while (s.winner === null && k++ < 6000) { const r = E.botTurn(s); if (r && r.waiting) { bad++; break; } }
  return s;
}
const agg = Object.create(null);
let stuck = 0, rounds = 0, games = 0, titleHeld = { tunel: 0, leyenda: 0, hueste: 0 }, neg = 0;
function rec(name, won, s, p) {
  const a = agg[name] = agg[name] || { n: 0, w: 0, pv: 0, raids: 0, ok: 0, fama: 0, lost: 0, leg: 0 };
  a.n++; if (won) a.w++; a.pv += E.pv(s, p.id); a.raids += p.stats.saqueos; a.ok += p.stats.exitos; a.lost += s.stats.lost[p.id]; if (E.inPlay(p)[3]) a.leg++;
}
for (let g = 0; g < N; g++) {
  let personas;
  if (mode === 'vs') { const x = names[g % names.length]; personas = [x, 'constructor', 'constructor', 'constructor']; const sh = g % 4; personas = personas.map((_, i) => personas[(i - sh + 4) % 4]); }
  else { const L = names.length; const pick = []; let j = g; const pool = names.slice(); for (let i = 0; i < 4; i++) { pick.push(pool.splice((j * 7 + i * 3) % pool.length, 1)[0]); j = Math.floor(j / 2) + 1; } personas = pick; }
  const s = play(personas, g + 1);
  if (s.winner === null) { stuck++; continue; }
  games++; rounds += s.round;
  for (const k in s.titles) if (s.titles[k] !== null) titleHeld[k]++;
  s.players.forEach(p => {
    for (const r of E.RES) if (p.hand[r] < 0) neg++;
    const label = mode === 'vs' ? (p.persona === 'constructor' && personas.filter(x => x === 'constructor').length === 4 ? 'constructor(espejo)' : p.persona === 'constructor' ? 'rival constructor' : p.persona) : p.persona;
    rec(label, s.winner === p.id, s, p);
  });
}
const out = {};
for (const [k, a] of Object.entries(agg)) out[k] = { gana_pct: +(100 * a.w / a.n).toFixed(1), pv: +(a.pv / a.n).toFixed(1), saqueos: +(a.raids / a.n).toFixed(1), exito: a.raids ? +(100 * a.ok / a.raids).toFixed(0) : 0, recursos_perdidos: +(a.lost / a.n).toFixed(1), legendario_pct: +(100 * a.leg / a.n).toFixed(0), muestras: a.n };
console.log(JSON.stringify({ modo: mode, partidas: games, trabadas: stuck, invariantes: neg, rondas: +(rounds / games).toFixed(1), titulos_con_dueno_pct: Object.fromEntries(Object.entries(titleHeld).map(([k, v]) => [k, +(100 * v / games).toFixed(0)])) }));
for (const [k, v] of Object.entries(out)) console.log(k.padEnd(20), JSON.stringify(v));
