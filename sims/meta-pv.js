const E = require('../src/engine.js');
const N = +process.argv[2] || 1000;
const ALT = { heroe: { lana: 1, madera: 1 }, trampa: { madera: 1, lana: 1, ladrillo: 1 }, muralla: { ladrillo: 2, madera: 1 } };
const base = { costs: ALT, ports: true, playerTrade: true };
const CONF = [];
const only = process.argv[3];
if (only) { for (const pv of [12, 13]) CONF.push([`${pv} PV + arrasar suave`, Object.assign({}, base, { winPV: pv, raze: 'suave' })]); }
else for (const pv of [10, 12, 13, 14]) for (const raze of [false, true]) CONF.push([`${pv} PV${raze ? ' + arrasar' : ''}`, Object.assign({}, base, { winPV: pv, raze })]);
for (const [name, P] of CONF) {
  const m = { n: 0, rounds: 0, comp: { cuevas: 0, criptas: 0, bastion: 0, titulos: 0, reliquias: 0 }, victimWin: 0, victimPV: 0, othersPV: 0, raidedWin: 0, raidedN: 0, razes: 0, razedWin: 0, razedN: 0, lostMax: 0, raids: 0, leg: 0, seat: [0, 0, 0, 0], lastPV: 0, spread: 0 };
  for (let g = 0; g < N; g++) {
    const s = E.createGame({ seed: g + 1, human: -1, P });
    let k = 0, leg = false;
    while (s.winner === null && k++ < 5000) { E.botTurn(s); if (!leg && s.players.some(p => E.inPlay(p)[3])) leg = true; }
    if (s.winner === null) continue;
    m.n++; m.rounds += s.round; if (leg) m.leg++; m.seat[s.winner]++;
    const w = s.winner, own = E.ownBuildings(s, w);
    m.comp.cuevas += own.filter(v => s.buildings[v].type === 'cueva').length;
    m.comp.criptas += 2 * own.filter(v => s.buildings[v].type === 'cripta').length;
    m.comp.bastion += own.filter(v => E.isBastion(s, v)).length;
    m.comp.titulos += 2 * Object.values(s.titles).filter(x => x === w).length;
    m.comp.reliquias += [...s.players[w].dev, ...s.players[w].devNew].filter(c => c === 'reliquia').length;
    const lost = s.stats.lost, vic = lost.indexOf(Math.max(...lost));
    m.lostMax += lost[vic];
    if (vic === w) m.victimWin++;
    const pvs = s.players.map(p => E.pv(s, p.id));
    m.victimPV += pvs[vic]; m.othersPV += (pvs.reduce((a, b) => a + b) - pvs[vic]) / 3;
    const srt = pvs.slice().sort((a, b) => b - a); m.spread += srt[0] - srt[3]; m.lastPV += srt[3];
    s.stats.razed.forEach((r, i) => { if (r > 0) { m.razedN++; if (i === w) m.razedWin++; } });
    m.razes += s.stats.razes;
    for (const ev of s.events) if (ev.type === 'combate') m.raids++;
  }
  const n = m.n, f = x => +(x / n).toFixed(1);
  console.log(name.padEnd(20), JSON.stringify({ rondas: f(m.rounds), saqueos: f(m.raids), legendario_pct: +(100 * m.leg / n).toFixed(0),
    pv_del_ganador: Object.fromEntries(Object.entries(m.comp).map(([k, v]) => [k, f(v)])),
    recursos_perdidos_por_la_mayor_victima: f(m.lostMax), victima_gana_pct: +(100 * m.victimWin / n).toFixed(1),
    pv_victima_vs_resto: [f(m.victimPV), f(m.othersPV)], pv_del_ultimo: f(m.lastPV), brecha: f(m.spread),
    arrasados_por_partida: f(m.razes), arrasado_gana_pct: m.razedN ? +(100 * m.razedWin / m.razedN).toFixed(1) : null,
    asientos: m.seat.map(x => +(100 * x / n).toFixed(0)) }));
}
