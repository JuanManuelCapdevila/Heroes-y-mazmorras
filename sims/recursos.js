const E = require('../src/engine.js');
const N = +process.argv[2] || 1000;
const NEWC = { heroe: { trigo: 1, lana: 1 }, trampa: { madera: 1, lana: 1, ladrillo: 1 }, muralla: { ladrillo: 2, madera: 1 } };
const CONF = {
  'A · actual (v0.4)': {},
  'B · costos nuevos': { costs: NEWC },
  'C · costos + puertos': { costs: NEWC, ports: true },
  'D · costos + puertos + comercio': { costs: NEWC, ports: true, playerTrade: true },
};
const R = E.RES;
const out = {};
for (const [name, P] of Object.entries(CONF)) {
  const m = { rounds: [], seat: [0, 0, 0, 0], stuck: 0, prod: {}, spent: {}, bank: {}, pgot: {}, ptrades: 0, raids: 0, ok: 0, leg: 0, winPV: [], spread: [] };
  for (const r of R) { m.prod[r] = 0; m.spent[r] = 0; m.bank[r] = 0; m.pgot[r] = 0; }
  for (let g = 0; g < N; g++) {
    const s = E.createGame({ seed: g + 1, human: -1, P });
    let k = 0, leg = false;
    while (s.winner === null && k++ < 4000) { E.botTurn(s); if (!leg && s.players.some(p => E.inPlay(p)[3])) leg = true; }
    if (s.winner === null) { m.stuck++; continue; }
    if (leg) m.leg++;
    m.rounds.push(s.round); m.seat[s.winner]++;
    const pvs = s.players.map(p => E.pv(s, p.id)).sort((a, b) => b - a); m.spread.push(pvs[0] - pvs[3]);
    for (const l of s.log) { const mm = l.msg.match(/^recibe (.*)\.$/); if (mm) mm[1].split(', ').forEach(x => { const [n, r] = x.split(' '); m.prod[r] += +n; }); }
    for (const p of s.players) for (const r of R) m.spent[r] += p.spent[r];
    for (const r of R) { m.bank[r] += s.stats.bank[r] || 0; m.pgot[r] += s.stats.pgot[r] || 0; }
    m.ptrades += s.stats.ptrades;
    for (const ev of s.events) if (ev.type === 'combate') { m.raids++; if (ev.success) m.ok++; }
  }
  const n = m.rounds.length, f = x => +(x / n).toFixed(1);
  const ratio = {}; for (const r of R) ratio[r] = +(m.spent[r] / m.prod[r]).toFixed(2);
  const rv = Object.values(ratio), mean = rv.reduce((a, b) => a + b) / rv.length;
  const cv = Math.sqrt(rv.reduce((a, b) => a + (b - mean) ** 2, 0) / rv.length) / mean;
  const seat = m.seat.map(w => +(100 * w / n).toFixed(1));
  m.rounds.sort((a, b) => a - b);
  out[name] = {
    partidas: n, trabadas: m.stuck,
    rondas: f(m.rounds.reduce((a, b) => a + b, 0)), rondas_p10_p90: [m.rounds[Math.floor(n * .1)], m.rounds[Math.floor(n * .9)]],
    victorias_por_asiento: seat, max_menos_min_asiento: +(Math.max(...seat) - Math.min(...seat)).toFixed(1),
    gastado_sobre_producido: ratio, desbalance_cv: +cv.toFixed(3),
    banca_por_partida: Object.fromEntries(R.map(r => [r, f(m.bank[r])])), banca_total: f(Object.values(m.bank).reduce((a, b) => a + b)),
    comercios_entre_jugadores: f(m.ptrades), recibido_en_comercio: Object.fromEntries(R.map(r => [r, f(m.pgot[r])])),
    saqueos: f(m.raids), exito_saqueo: +(100 * m.ok / m.raids).toFixed(1), con_legendario_pct: +(100 * m.leg / n).toFixed(1),
    distancia_1ro_ultimo_pv: f(m.spread.reduce((a, b) => a + b, 0)),
  };
  console.error('listo', name);
}
require('fs').writeFileSync(require('path').join(__dirname, 'resultados', 'balance.json'), JSON.stringify(out, null, 1));
for (const [k, v] of Object.entries(out)) console.log(k, JSON.stringify(v));
