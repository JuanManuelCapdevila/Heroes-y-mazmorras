const E = require('../src/engine.js');
const N = +process.argv[2] || 500;
const ROUNDS = JSON.parse(process.argv[3] || '[null,3,6,10]');
const EXTRA = JSON.parse(process.argv[4] || '{}');
const names = Object.keys(E.PERSONAS);
function table(g) { // mesa mezclada reproducible: 4 de los 6 estilos
  const pool = names.slice(), pick = []; let j = g;
  for (let i = 0; i < 4; i++) { pick.push(pool.splice((j * 7 + i * 3) % pool.length, 1)[0]); j = Math.floor(j / 2) + 1; }
  return pick;
}
function play(g, giftRound) {
  const personas = table(g), who = g % 4;
  const P = {}; for (const [k, v] of Object.entries(EXTRA)) P[k] = v === 'WHO' ? [who] : v;
  const s = E.createGame({ seed: 1000 + g, human: -1, personas, P });
  let gifted = false, giftedAt = null, lostAt = null, k = 0;
  const pre = { raids: 0 };
  let occRoundsBy = 0, legRaids = 0, legRaidsOk = 0, legOcc = 0;
  let lastEv = 0, inRaids = 0, inOk = 0;
  while (s.winner === null && k++ < 6000) {
    if (giftRound && !gifted && s.round >= giftRound && s.phase === 'roll' && s.current === who) {
      const p = s.players[who];
      if (E.freeTokens(p, 3) > 0) { p.guard[3]++; gifted = true; giftedAt = s.round; }
      else { gifted = true; giftedAt = -1; } // ya tenía uno
    }
    E.botTurn(s);
    const p = s.players[who];
    if (gifted && giftedAt > 0 && lostAt === null && E.inPlay(p)[3] === 0) lostAt = s.round;
    for (const ev of s.events) if (ev.id > lastEv) {
      lastEv = ev.id;
      if (ev.type === 'combate' && ev.attacker === who && ev.sent[3]) { legRaids++; if (ev.success) legRaidsOk++; }
      if (ev.type === 'combate' && ev.defender === who) { inRaids++; if (ev.success) inOk++; }
      if (ev.type === 'permanencia') ev.results.forEach(r => { if (r.pid === who && r.stay) occRoundsBy++; });
    }
  }
  const p = s.players[who];
  const pvs = s.players.map(q => E.pv(s, q.id));
  const others = [0, 1, 2, 3].filter(i => i !== who);
  return {
    done: s.winner !== null, win: s.winner === who, persona: personas[who], rounds: s.round,
    pv: pvs[who], othersPV: others.reduce((a, i) => a + pvs[i], 0) / 3, rank: 1 + pvs.filter((x, i) => i !== who && x > pvs[who]).length,
    raids: p.stats.saqueos, ok: p.stats.exitos, fama: p.fama, stolen: p.stats.robadas, lostByOthers: others.reduce((a, i) => a + s.stats.lost[i], 0),
    razes: s.stats.razed.reduce((a, x, i) => a + (i !== who ? x : 0), 0) && s.events.filter(e => e.type === 'arrasar' && e.attacker === who).length,
    razedOthers: s.stats.razes, legRaids, legRaidsOk, occRoundsBy, giftedAt, lostAt, ownedLeg: gifted && giftedAt === -1,
    inRaids, inOk, lostSelf: s.stats.lost[who], leyenda: s.titles.leyenda === who, hueste: s.titles.hueste === who, famaPV: Math.floor(p.fama / s.P.famaPV),
  };
}
const res = {};
for (const R of ROUNDS) {
  const key = R ? `legendario en ronda ${R}` : 'sin regalo (control)';
  const rows = []; for (let g = 0; g < N; g++) rows.push(play(g, R));
  res[key] = rows;
}
const avg = (rows, f) => rows.reduce((a, r) => a + f(r), 0) / rows.length;
const pct = (rows, f) => +(100 * rows.filter(f).length / rows.length).toFixed(1);
const out = {};
for (const [k, rows0] of Object.entries(res)) {
  const rows = rows0.filter(r => r.done);
  const g = rows.filter(r => r.giftedAt > 0);
  out[k] = {
    partidas: rows.length, gana_pct: pct(rows, r => r.win), podio_1ro_o_2do_pct: pct(rows, r => r.rank <= 2),
    pv: +avg(rows, r => r.pv).toFixed(1), pv_rivales: +avg(rows, r => r.othersPV).toFixed(1), rondas: +avg(rows, r => r.rounds).toFixed(1),
    saqueos: +avg(rows, r => r.raids).toFixed(1), exito_pct: +(100 * avg(rows, r => r.ok) / Math.max(0.01, avg(rows, r => r.raids))).toFixed(0),
    rondas_ocupando: +avg(rows, r => r.occRoundsBy).toFixed(1), cartas_robadas: +avg(rows, r => r.stolen).toFixed(1),
    recursos_perdidos_rivales: +avg(rows, r => r.lostByOthers).toFixed(1), arrasa: +avg(rows, r => r.razes).toFixed(2),
    fama: +avg(rows, r => r.fama).toFixed(1), pv_por_fama: +avg(rows, r => r.famaPV).toFixed(1), leyenda_pct: pct(rows, r => r.leyenda), hueste_pct: pct(rows, r => r.hueste),
    saqueos_con_legendario: +avg(rows, r => r.legRaids).toFixed(1), exito_con_legendario_pct: +(100 * avg(rows, r => r.legRaidsOk) / Math.max(0.01, avg(rows, r => r.legRaids))).toFixed(0),
    legendario_muere_pct: g.length ? +(100 * g.filter(r => r.lostAt !== null).length / g.length).toFixed(1) : null,
    rondas_hasta_morir: g.filter(r => r.lostAt).length ? +avg(g.filter(r => r.lostAt), r => r.lostAt - r.giftedAt).toFixed(1) : null,
    saqueos_recibidos: +avg(rows, r => r.inRaids).toFixed(1), exito_rivales_contra_el_pct: +(100 * avg(rows, r => r.inOk) / Math.max(0.01, avg(rows, r => r.inRaids))).toFixed(0), recursos_que_pierde: +avg(rows, r => r.lostSelf).toFixed(1),
    ya_tenia_legendario: rows.filter(r => r.ownedLeg).length,
  };
  // por estilo
  const per = {};
  for (const n of names) { const rr = rows.filter(r => r.persona === n); if (rr.length) per[n] = { n: rr.length, gana: pct(rr, r => r.win) }; }
  out[k].por_estilo = per;
}
require('fs').writeFileSync(require('path').join(__dirname, 'resultados', 'legendario-temprano.json'), JSON.stringify(out, null, 1));
for (const [k, v] of Object.entries(out)) { const { por_estilo, ...rest } = v; console.log('\n== ' + k); console.log(JSON.stringify(rest)); console.log('por estilo', JSON.stringify(por_estilo)); }
