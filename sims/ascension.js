const E = require('../src/engine.js');
const N = +process.argv[2] || 3000;
const ALT = { heroe: { lana: 1, madera: 1 }, trampa: { madera: 1, lana: 1, ladrillo: 1 }, muralla: { ladrillo: 2, madera: 1 } };
const base = { costs: ALT, ports: true, playerTrade: true, winPV: 13, raze: 'suave' };
for (const [name, P] of [['sin Ascensión', base], ['con Ascensión', Object.assign({}, base, { ascension: true })]]) {
  let games = 0, rounds = 0, legGames = 0; const T = { leg: [0, 0], epic: [0, 0], none: [0, 0] };
  const card = { drawn: 0, played: 0, holderWin: 0, playedWin: 0, playRound: [], fromRare: 0, drawnRound: [] };
  let legRaids = [0, 0];
  for (let g = 0; g < N; g++) {
    const s = E.createGame({ seed: g + 1, human: -1, P });
    const maxR = [0, 0, 0, 0]; let k = 0, holder = null, player = null, leg = false;
    while (s.winner === null && k++ < 5000) {
      E.botTurn(s);
      s.players.forEach(p => { const ip = E.inPlay(p); const mr = ip[3] ? 3 : ip[2] ? 2 : ip[1] ? 1 : 0; maxR[p.id] = Math.max(maxR[p.id], mr); if (ip[3]) leg = true;
        if (holder === null && [...p.dev, ...p.devNew].includes('ascension')) { holder = p.id; card.drawnRound.push(s.round); } });
    }
    if (s.winner === null) continue;
    games++; rounds += s.round; if (leg) legGames++;
    s.players.forEach(p => { const key = maxR[p.id] === 3 ? 'leg' : maxR[p.id] === 2 ? 'epic' : 'none'; T[key][0]++; if (s.winner === p.id) T[key][1]++; });
    const pl = s.log.find(l => l.msg.startsWith('juega «Ascensión»'));
    if (holder !== null || pl) { card.drawn++; if ((pl ? pl.pid : holder) === s.winner) card.holderWin++; }
    if (pl) { card.played++; card.playRound.push(pl.round); if (pl.msg.includes('raro')) card.fromRare++; if (pl.pid === s.winner) card.playedWin++; }
    for (const ev of s.events) if (ev.type === 'combate' && ev.sent[3]) { legRaids[0]++; if (ev.success) legRaids[1]++; }
  }
  const pct = (n, w) => n ? +(100 * w / n).toFixed(1) : null, avg = a => a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : null;
  console.log(name, JSON.stringify({ rondas: +(rounds / games).toFixed(1), partidas_con_legendario_pct: pct(games, legGames),
    gana_segun_mejor_heroe: { legendario: pct(...T.leg), epico: pct(...T.epic), sin_epico: pct(...T.none) },
    carta_robada_en_pct_partidas: pct(games, card.drawn), carta_jugada_en_pct_partidas: pct(games, card.played),
    quien_la_tiene_gana_pct: pct(card.drawn, card.holderWin), quien_la_juega_gana_pct: pct(card.played, card.playedWin),
    ronda_robada: avg(card.drawnRound), ronda_jugada: avg(card.playRound), jugada_sobre_raro_pct: pct(card.played, card.fromRare),
    saqueos_con_legendario_por_partida: +(legRaids[0] / games).toFixed(2), exito_legendario: pct(...legRaids) }));
}
