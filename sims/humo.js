const E = require('../src/engine.js');
const N = +process.argv[2] || 300, P = JSON.parse(process.argv[3] || '{}');
let rounds = [], wins = [0,0,0,0], stuck = 0, raids = 0, ok = 0, stays = 0, leaves = 0, expels = 0, expA = 0, delays = 0, neg = 0;
const titles = {tunel:0,leyenda:0,hueste:0}, traps = {}, fus = [0,0,0,0], legGames = { any: 0 }, peak = [];
let resist = 0, famaRes = 0;
for (let g = 0; g < N; g++) {
  const s = E.createGame({ seed: g + 1, human: -1, P });
  let steps = 0; const pk = [0,0,0,0]; let leg = false;
  while (s.winner === null && steps < 3000) {
    E.botTurn(s); steps++;
    for (const p of s.players) {
      for (const r of E.RES) if (p.hand[r] < 0) neg++;
      const ip = E.inPlay(p); ip.forEach((n, r) => { if (n < 0 || n > E.RARITY[r].tokens) neg++; });
      pk[p.id] = Math.max(pk[p.id], E.total(ip)); if (ip[3]) leg = true;
    }
  }
  if (s.winner === null) { stuck++; continue; }
  peak.push(...pk); if (leg) legGames.any++;
  rounds.push(s.round); wins[s.winner]++;
  for (const k in s.titles) if (s.titles[k] !== null) titles[k]++;
  s.players.forEach(p => { p.stats.fusiones.forEach((n, r) => fus[r] += n); resist += p.stats.resistidos; });
  for (const ev of s.events) {
    if (ev.type === 'combate') { raids++; if (ev.success) ok++; if (ev.delayed) delays++; ev.traps.forEach(t => traps[t] = (traps[t]||0)+1); }
    if (ev.type === 'permanencia') ev.results.forEach(r => r.stay ? stays++ : leaves++);
    if (ev.type === 'expulsion') { expA++; if (ev.success) expels++; }
  }
}
rounds.sort((a,b)=>a-b); peak.sort((a,b)=>a-b);
const n = rounds.length;
console.log(JSON.stringify({ partidas: n, trabadas: stuck, invariantes_rotas: neg,
  rondas_media: +(rounds.reduce((a,b)=>a+b,0)/n).toFixed(1), rondas_p10: rounds[Math.floor(n*.1)], rondas_p90: rounds[Math.floor(n*.9)],
  victorias_por_asiento: wins.map(w => +(100*w/n).toFixed(1)),
  saqueos_partida: +(raids/n).toFixed(1), exito: +(100*ok/raids).toFixed(1), demorados: delays,
  permanece: +(100*stays/(stays+leaves)).toFixed(1), resistidos_partida: +(resist/n).toFixed(1),
  expulsiones: `${expels}/${expA}`, fusiones_por_partida: { raro: +(fus[1]/n).toFixed(2), epico: +(fus[2]/n).toFixed(2), legendario: +(fus[3]/n).toFixed(2) },
  partidas_con_legendario_pct: +(100*legGames.any/n).toFixed(1), heroes_pico_p50: peak[Math.floor(peak.length*.5)], heroes_pico_p90: peak[Math.floor(peak.length*.9)],
  titulos_pct: Object.fromEntries(Object.entries(titles).map(([k,v])=>[k,+(100*v/n).toFixed(0)])), trampas_reveladas: traps }));
