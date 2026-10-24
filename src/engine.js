/* Héroes y mazmorras v0.5 — motor de reglas (sin DOM). */
(function (root) {
  'use strict';
  const RES = ['madera', 'ladrillo', 'lana', 'trigo', 'mineral'];
  const RES_LABEL = { madera: 'Madera', ladrillo: 'Ladrillo', lana: 'Lana', trigo: 'Trigo', mineral: 'Mineral', desierto: 'Desierto' };
  const COST = {
    tunel: { madera: 1, ladrillo: 1 },
    cueva: { madera: 1, ladrillo: 1, lana: 1, trigo: 1 },
    cripta: { trigo: 2, mineral: 3 },
    trampa: { madera: 1, lana: 1, ladrillo: 1 },
    muralla: { ladrillo: 2, madera: 1 },
    heroe: { lana: 1, madera: 1 },
    desarrollo: { lana: 1, trigo: 1, mineral: 1 },
  };
  // Rarezas: 0 común, 1 raro, 2 épico, 3 legendario
  const RARITY = [
    { key: 'comun', name: 'Común', plural: 'comunes', tokens: 4, die: 6, perm: 1, fuse: null, text: 'Sin habilidad. Es la base de la hueste.' },
    { key: 'raro', name: 'Raro', plural: 'raros', tokens: 3, die: 8, perm: 2, fuse: 1, text: 'Mientras esté en tu guardia, espiás la primera trampa de cada pueblo antes de atacar.' },
    { key: 'epico', name: 'Épico', plural: 'épicos', tokens: 2, die: 10, perm: 3, fuse: 2, text: 'Aguanta 2 derrotas en un mismo combate antes de caer.' },
    { key: 'legendario', name: 'Legendario', plural: 'legendarios', tokens: 1, die: 12, perm: 2, fuse: 3, text: 'Si su grupo falla la tirada de permanencia, la repite una vez.' },
  ];
  const TRAPS = {
    foso: { name: 'Foso de estacas', text: 'El grupo atacante pierde su héroe más débil antes del combate.' },
    gas: { name: 'Niebla de azufre', text: 'El atacante tira un dado menos en este combate (mínimo 1).' },
    alarma: { name: 'Alarma', text: 'El defensor tira un dado más en este combate.' },
    derrumbe: { name: 'Derrumbe', text: 'Si el saqueo triunfa, el grupo tiene −5 en su primera tirada de permanencia.' },
    senuelo: { name: 'Señuelo', text: 'Pistas falsas: el grupo se demora y el combate se resuelve al comienzo de su próximo turno.' },
  };
  const TRAP_DECK = { foso: 6, gas: 5, alarma: 4, derrumbe: 4, senuelo: 6 };
  const DEV = {
    leva: { name: 'Leva de héroes', text: 'Sumá 2 héroes comunes a tu guardia, si quedan fichas.' },
    reliquia: { name: 'Reliquia', text: '1 punto de victoria. Se mantiene oculta hasta el final.' },
    veta: { name: 'Veta oculta', text: 'Tomá 2 recursos a elección de la banca.' },
    ascension: { name: 'Ascensión', text: 'Un héroe raro o épico de tu guardia se vuelve legendario, si tu ficha legendaria está libre.' },
  };
  const DEV_DECK = { leva: 12, reliquia: 5, veta: 3 };
  const TITLES = {
    tunel: { name: 'Túnel más largo', text: n => `Red de ${n} o más túneles seguidos.`, min: 5 },
    leyenda: { name: 'Leyenda del Reino', text: n => `${n} o más de fama, ganada atacando o resistiendo.`, min: 8 },
    hueste: { name: 'Mayor hueste', text: n => `${n} o más héroes entre guardia y expedición.`, min: 6 },
  };
  const P = {
    winPV: 13, ports: true, playerTrade: true, raze: 'suave', ascension: true, famaDefensa: true, famaDado: 2, elegirBajas: true,
    titleMin: { tunel: 5, leyenda: 8, hueste: 6 },
    asalto: { trigo: 2 }, famaPV: 5, robo: 1,
    permBase: 10, murallaBonus: 3, roundPenalty: 2, derrumbe: 5,
    famaSaqueo: 2, famaRonda: 1, lujoRonda: 1, famaResistir: 1, lujoPorCaido: 1, protection: 3,
  };
  const COLORS = ['#d8584e', '#4f8fd8', '#e39a3b', '#e9e3d5'];

  // ---------- azar con semilla ----------
  function rand(s) {
    let t = (s.rng = (s.rng + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const d = (s, n) => 1 + Math.floor(rand(s) * n);
  function shuffle(s, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand(s) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function deckFrom(s, spec) { const a = []; for (const k in spec) for (let i = 0; i < spec[k]; i++) a.push(k); return shuffle(s, a); }

  // ---------- héroes ----------
  const zero = () => [0, 0, 0, 0];
  const total = a => a[0] + a[1] + a[2] + a[3];
  const add = (a, b) => a.map((x, i) => x + b[i]);
  function inPlay(p) { return p.exp ? add(p.guard, p.exp.party) : p.guard.slice(); }
  function heroesTotal(p) { return total(inPlay(p)); }
  function freeTokens(p, r) { return RARITY[r].tokens - inPlay(p)[r]; }
  function partyText(a) {
    const parts = [];
    for (let r = 3; r >= 0; r--) if (a[r]) parts.push(`${a[r]} ${a[r] === 1 ? RARITY[r].name.toLowerCase() : RARITY[r].plural}`);
    return parts.join(', ') || 'nadie';
  }
  function lossText(who, k, plural) { return total(k) ? `${who} ${plural ? 'pierden' : 'pierde'} ${partyText(k)}` : `${who} no ${plural ? 'pierden' : 'pierde'} a nadie`; }
  function diceOf(a, max) { // dados de los mejores héroes
    const out = [];
    for (let r = 3; r >= 0 && out.length < max; r--) for (let i = 0; i < a[r] && out.length < max; i++) out.push(RARITY[r].die);
    return out;
  }
  function assignLosses(a, n) { // caen primero los más débiles; el épico aguanta 2
    const killed = zero();
    for (let r = 0; r < 4 && n > 0; r++) {
      while (n > 0 && a[r] > 0) {
        if (r === 2) { if (n >= 2) { a[2]--; killed[2]++; n -= 2; } else n = 0; }
        else { a[r]--; killed[r]++; n--; }
      }
    }
    return killed;
  }
  function gainCommons(s, p, n, why) {
    const k = Math.min(n, freeTokens(p, 0));
    p.guard[0] += k;
    if (k < n) log(s, p.id, `${why}, pero no le quedan fichas comunes${k ? ` (solo suma ${k})` : ''}.`);
    else log(s, p.id, `${why}: +${k} héroe${k > 1 ? 's' : ''} común${k > 1 ? 'es' : ''}.`);
    return k;
  }

  // ---------- tablero ----------
  function buildBoard(s) {
    const coords = [];
    for (let q = -2; q <= 2; q++) for (let r = Math.max(-2, -q - 2); r <= Math.min(2, -q + 2); r++) coords.push([q, r]);
    const res = shuffle(s, ['madera', 'madera', 'madera', 'madera', 'ladrillo', 'ladrillo', 'ladrillo', 'lana', 'lana', 'lana', 'lana',
      'trigo', 'trigo', 'trigo', 'trigo', 'mineral', 'mineral', 'mineral', 'desierto']);
    const hexes = coords.map(([q, r], i) => ({ id: i, q, r, x: Math.sqrt(3) * (q + r / 2), y: 1.5 * r, res: res[i], num: null, v: [] }));
    for (let tries = 0; tries < 500; tries++) {
      const nums = shuffle(s, [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12]);
      let k = 0; hexes.forEach(h => { h.num = h.res === 'desierto' ? null : nums[k++]; });
      const red = hexes.filter(h => h.num === 6 || h.num === 8);
      if (!red.some(a => red.some(b => a !== b && Math.hypot(a.x - b.x, a.y - b.y) < 1.8))) break;
    }
    const vmap = new Map(), vertices = [], edges = [], emap = new Map();
    const vkey = (x, y) => Math.round(x * 1000) + ',' + Math.round(y * 1000);
    hexes.forEach(h => {
      const ids = [];
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 180 * (60 * i - 30);
        const x = h.x + Math.cos(a), y = h.y + Math.sin(a), k = vkey(x, y);
        if (!vmap.has(k)) { vmap.set(k, vertices.length); vertices.push({ id: vertices.length, x, y, hexes: [], adj: [], edges: [] }); }
        const vid = vmap.get(k); ids.push(vid); vertices[vid].hexes.push(h.id);
      }
      h.v = ids;
      for (let i = 0; i < 6; i++) {
        const a = ids[i], b = ids[(i + 1) % 6], k = Math.min(a, b) + '-' + Math.max(a, b);
        if (!emap.has(k)) {
          emap.set(k, edges.length); edges.push({ id: edges.length, a, b });
          vertices[a].adj.push(b); vertices[b].adj.push(a);
          vertices[a].edges.push(edges.length - 1); vertices[b].edges.push(edges.length - 1);
        }
      }
    });
    return { hexes, vertices, edges };
  }
  const pips = n => (n ? 6 - Math.abs(7 - n) : 0);

  // ---------- partida ----------
  function createGame(opt = {}) {
    const s = { rng: (opt.seed >>> 0) || ((Math.random() * 2 ** 32) >>> 0), log: [], P: Object.assign({}, P, opt.P || {}) };
    s.board = buildBoard(s);
    s.COST = Object.assign({}, COST, s.P.costs || {});
    s.stats = { bank: {}, ptrades: 0, pgot: {}, lost: [0, 0, 0, 0], occRounds: [0, 0, 0, 0], razed: [0, 0, 0, 0], razes: 0 };
    s.ports = s.P.ports ? makePorts(s) : [];
    s.portAt = {}; s.ports.forEach(pt => { s.portAt[pt.a] = pt.type; s.portAt[pt.b] = pt.type; });
    const seats = opt.seats || null;
    const names = opt.names || (seats ? seats.map((x, i) => x.name || ['Señor Rojo', 'Señora Azul', 'Señor Ámbar', 'Señora Hueso'][i]) : ['Tu señorío', 'Morgrath', 'Ylsa la Gris', 'Barón Cieno']);
    const human = opt.human === undefined ? 0 : opt.human;
    s.players = names.map((n, i) => ({
      id: i, name: n, color: COLORS[i], bot: seats ? !!seats[i].bot : i !== human, uid: seats ? seats[i].uid || null : null,
      hand: Object.fromEntries(RES.map(r => [r, 0])), spent: Object.fromEntries(RES.map(r => [r, 0])), lujo: 0, fama: 0, guard: zero(),
      persona: (seats && seats[i].persona) || (opt.personas && opt.personas[i]) || 'constructor', exp: null, dev: [], devNew: [], traps: {}, stats: { saqueos: 0, exitos: 0, robadas: 0, expulsiones: 0, resistidos: 0, fusiones: [0, 0, 0, 0] },
    }));
    s.buildings = {}; s.roads = {};
    s.trapDeck = deckFrom(s, TRAP_DECK); s.trapDiscard = [];
    s.devDeck = deckFrom(s, s.P.ascension ? Object.assign({}, DEV_DECK, { leva: DEV_DECK.leva - 1, ascension: 1 }) : DEV_DECK);
    s.titles = { tunel: null, leyenda: null, hueste: null };
    s.setupOrder = [0, 1, 2, 3, 3, 2, 1, 0]; s.setupStep = 0; s.setupSub = 'cueva'; s.setupLast = null;
    s.phase = 'setup'; s.current = 0; s.round = 0; s.dice = null; s.winner = null;
    s.turn = { devPlayed: false, expelled: false };
    s.events = [];
    log(s, null, 'Comienza la partida. Cada señor coloca dos cuevas y dos túneles.');
    return s;
  }
  const pueblo = (s, id) => (s.P.online || s.players[id].bot) ? `el pueblo de ${s.players[id].name}` : 'tu pueblo';
  function pushEv(s, ev) { ev.id = (s.evSeq = (s.evSeq || 0) + 1); s.events.push(ev); if (s.events.length > 60) s.events.splice(0, s.events.length - 60); }
  function log(s, pid, msg) { s.log.push({ pid, msg, round: s.round }); if (s.log.length > 400) s.log.shift(); }
  const cur = s => s.players[s.current];
  const handSize = p => RES.reduce((a, r) => a + p.hand[r], 0);
  function canAfford(p, cost) { return Object.entries(cost).every(([r, n]) => p.hand[r] >= n); }
  function pay(p, cost) { for (const [r, n] of Object.entries(cost)) { p.hand[r] -= n; p.spent[r] += n; } }
  function makePorts(s) {
    const { hexes, vertices, edges } = s.board;
    const outer = edges.filter(e => vertices[e.a].hexes.filter(h => vertices[e.b].hexes.includes(h)).length === 1);
    const mid = e => [(vertices[e.a].x + vertices[e.b].x) / 2, (vertices[e.a].y + vertices[e.b].y) / 2];
    outer.sort((e1, e2) => Math.atan2(mid(e1)[1], mid(e1)[0]) - Math.atan2(mid(e2)[1], mid(e2)[0]));
    const types = shuffle(s, ['3:1', '3:1', '3:1', '3:1', ...RES]);
    const off = Math.floor(rand(s) * 3);
    return types.map((t, i) => { const e = outer[(off + Math.round(i * outer.length / 9)) % outer.length]; return { edge: e.id, a: e.a, b: e.b, type: t }; });
  }
  function rate(s, p, r) {
    let best = 4;
    for (const v of ownBuildings(s, p.id)) { const t = s.portAt[v]; if (t === r) best = Math.min(best, 2); else if (t === '3:1') best = Math.min(best, 3); }
    return best;
  }
  const ok = (x) => Object.assign({ ok: true }, x || {});
  const err = (m) => ({ ok: false, error: m });

  // ---------- geometría de reglas ----------
  function vertexFree(s, vid) { return !s.buildings[vid] && s.board.vertices[vid].adj.every(a => !s.buildings[a]); }
  function setupVertices(s) { return s.board.vertices.filter(v => vertexFree(s, v.id)).map(v => v.id); }
  function setupEdges(s) { return s.board.vertices[s.setupLast].edges.filter(e => s.roads[e] === undefined); }
  function playerTouches(s, pid, vid) {
    const b = s.buildings[vid];
    if (b) return b.owner === pid;
    return s.board.vertices[vid].edges.some(e => s.roads[e] === pid);
  }
  function tunelEdges(s, pid) { return s.board.edges.filter(e => s.roads[e.id] === undefined && (playerTouches(s, pid, e.a) || playerTouches(s, pid, e.b))).map(e => e.id); }
  function cuevaVertices(s, pid) { return s.board.vertices.filter(v => vertexFree(s, v.id) && v.edges.some(e => s.roads[e] === pid)).map(v => v.id); }
  const ownBuildings = (s, pid) => Object.keys(s.buildings).map(Number).filter(v => s.buildings[v].owner === pid);
  function vdist(s, a, b) { const A = s.board.vertices[a], B = s.board.vertices[b]; return Math.round(Math.hypot(A.x - B.x, A.y - B.y) / Math.sqrt(3)); }
  function raidDistance(s, pid, vid) { return Math.min(...ownBuildings(s, pid).map(v => vdist(s, v, vid))); }
  function occupant(s, vid) { const p = s.players.find(p => p.exp && !p.exp.pending && p.exp.target === vid); return p ? p.id : null; }
  function threatOf(s, vid) { const p = s.players.find(p => p.exp && p.exp.target === vid); return p ? p.id : null; }
  function vertexValue(s, vid) { return s.board.vertices[vid].hexes.reduce((a, h) => a + pips(s.board.hexes[h].num), 0); }
  function isBastion(s, vid) { const b = s.buildings[vid]; return !!b && b.type === 'cripta' && b.muralla && (s.players[b.owner].traps[vid] || []).length >= 2; }

  // ---------- puntos ----------
  function longestRoad(s, pid) {
    let best = 0;
    const blocked = v => s.buildings[v] && s.buildings[v].owner !== pid;
    function dfs(v, used, len) {
      best = Math.max(best, len);
      if (len > 0 && blocked(v)) return;
      for (const eid of s.board.vertices[v].edges) {
        if (used.has(eid) || s.roads[eid] !== pid) continue;
        const e = s.board.edges[eid]; used.add(eid);
        dfs(e.a === v ? e.b : e.a, used, len + 1); used.delete(eid);
      }
    }
    const starts = new Set(); s.board.edges.forEach(e => { if (s.roads[e.id] === pid) { starts.add(e.a); starts.add(e.b); } });
    starts.forEach(v => dfs(v, new Set(), 0));
    return best;
  }
  function titleValue(s, key, p) {
    if (key === 'tunel') return longestRoad(s, p.id);
    if (key === 'leyenda') return p.fama;
    return heroesTotal(p);
  }
  function tmin(s, key) { return (s.P.titleMin && s.P.titleMin[key]) || TITLES[key].min; }
  function updateTitles(s) {
    for (const key of Object.keys(TITLES)) {
      let holder = s.titles[key];
      let hv = holder === null ? -1 : titleValue(s, key, s.players[holder]);
      if (holder !== null && hv < tmin(s, key)) { log(s, holder, `pierde el título «${TITLES[key].name}».`); holder = null; hv = -1; s.titles[key] = null; }
      let best = null, bv = hv;
      for (const p of s.players) { const v = titleValue(s, key, p); if (p.id !== holder && v >= tmin(s, key) && v > bv) { best = p.id; bv = v; } }
      if (best !== null) { s.titles[key] = best; log(s, best, `obtiene el título «${TITLES[key].name}» (+2 PV).`); }
    }
  }
  function pvPublic(s, pid) {
    let pv = 0;
    for (const v of ownBuildings(s, pid)) pv += s.buildings[v].type === 'cripta' ? 2 : 1;
    for (const k in s.titles) if (s.titles[k] === pid) pv += 2;
    if (s.P.famaPV) pv += Math.floor(s.players[pid].fama / s.P.famaPV);
    return pv;
  }
  function pv(s, pid) { const p = s.players[pid]; return pvPublic(s, pid) + [...p.dev, ...p.devNew].filter(c => c === 'reliquia').length; }
  function checkWin(s) {
    const p = cur(s);
    if (s.winner === null && s.phase !== 'setup' && pv(s, p.id) >= s.P.winPV) {
      s.winner = p.id; s.phase = 'fin';
      log(s, p.id, `alcanza ${pv(s, p.id)} PV y gana la partida.`);
    }
  }

  // ---------- preparación ----------
  function placeSetup(s, target) {
    const p = cur(s);
    if (s.setupSub === 'cueva') {
      if (!setupVertices(s).includes(target)) return err('Ese vértice no está libre.');
      s.buildings[target] = { owner: p.id, type: 'cueva', muralla: false };
      s.setupLast = target; s.setupSub = 'tunel';
      if (s.setupStep >= 4) {
        const got = [];
        s.board.vertices[target].hexes.forEach(h => { const r = s.board.hexes[h].res; if (r !== 'desierto') { p.hand[r]++; got.push(RES_LABEL[r].toLowerCase()); } });
        log(s, p.id, `excava su segunda cueva y recibe ${got.join(', ') || 'nada'}.`);
      } else log(s, p.id, 'excava su primera cueva.');
      return ok();
    }
    if (!setupEdges(s).includes(target)) return err('El túnel tiene que salir de la cueva recién colocada.');
    s.roads[target] = p.id; s.setupSub = 'cueva'; s.setupStep++;
    if (s.setupStep >= s.setupOrder.length) { s.phase = 'roll'; s.current = 0; s.round = 1; log(s, null, 'Ronda 1. Los dados están listos.'); }
    else s.current = s.setupOrder[s.setupStep];
    return ok();
  }

  // ---------- dados y producción ----------
  function roll(s) {
    if (s.phase !== 'roll') return err('No es momento de tirar.');
    const p = cur(s);
    const a = d(s, 6), b = d(s, 6); s.dice = [a, b];
    const sum = a + b;
    log(s, p.id, `tira ${a} + ${b} = ${sum}.`);
    if (sum === 7) {
      for (const q of s.players) {
        const n = handSize(q);
        if (n > 7) {
          const k = Math.floor(n / 2);
          for (let i = 0; i < k; i++) { const r = RES.reduce((m, x) => q.hand[x] > q.hand[m] ? x : m, RES[0]); q.hand[r]--; }
          log(s, q.id, `descarta ${k} cartas por tener más de 7.`);
        }
      }
      gainCommons(s, p, 1, 'sacó 7');
      updateTitles(s);
      s.phase = canRaid(s, p.id) ? 'raid' : 'main';
      if (s.phase === 'main' && p.exp) log(s, p.id, 'ya tiene un grupo afuera y no puede enviar otro.');
    } else { produce(s, sum); s.phase = 'main'; }
    return ok({ sum });
  }
  function produce(s, sum) {
    const gains = s.players.map(() => ({}));
    for (const h of s.board.hexes) {
      if (h.num !== sum) continue;
      for (const vid of h.v) {
        const b = s.buildings[vid]; if (!b) continue;
        const n = b.type === 'cripta' ? 2 : 1;
        const occ = occupant(s, vid);
        const to = occ !== null ? occ : b.owner;
        s.players[to].hand[h.res] += n;
        gains[to][h.res] = (gains[to][h.res] || 0) + n;
        if (occ !== null) s.stats.lost[b.owner] += n;
        if (occ !== null) log(s, occ, `sus héroes se quedan con ${n} ${RES_LABEL[h.res].toLowerCase()} de ${pueblo(s, b.owner)}.`);
      }
    }
    gains.forEach((g, i) => { const t = Object.entries(g).map(([r, n]) => `${n} ${RES_LABEL[r].toLowerCase()}`).join(', '); if (t) log(s, i, `recibe ${t}.`); });
  }

  // ---------- saqueo ----------
  function raidTargets(s, pid) {
    const p = s.players[pid];
    const myPV = pvPublic(s, pid);
    const spy = p.guard[1] > 0;
    return Object.keys(s.buildings).map(Number).filter(v => {
      const b = s.buildings[v];
      if (b.owner === pid || threatOf(s, v) !== null) return false;
      return pvPublic(s, b.owner) > myPV - s.P.protection;
    }).map(v => {
      const q = s.players[s.buildings[v].owner], tr = q.traps[v] || [];
      return { vid: v, owner: q.id, dist: raidDistance(s, pid, v), traps: tr.length, spied: spy && tr.length ? tr[0] : null };
    });
  }
  function canRaid(s, pid) { const p = s.players[pid]; return !p.exp && total(p.guard) > 0 && raidTargets(s, pid).length > 0; }
  function callRaid(s) { // asalto pagado: saquear en tu turno sin haber sacado 7
    const p = cur(s);
    if (s.phase !== 'main') return err('Primero tirá los dados.');
    if (!s.P.asalto) return err('El asalto está desactivado.');
    if (s.turn.asalto) return err('Solo un asalto por turno.');
    if (!canRaid(s, p.id)) return err('No tenés héroes en casa, ya tenés un grupo afuera o no hay objetivos.');
    if (!canAfford(p, s.P.asalto)) return err('No te alcanza para las provisiones del asalto.');
    pay(p, s.P.asalto); s.turn.asalto = true; s.phase = 'raid';
    log(s, p.id, 'paga provisiones y prepara un asalto.');
    return ok();
  }
  function skipRaid(s) { if (s.phase === 'raid') { s.phase = 'main'; log(s, cur(s).id, 'decide no saquear.'); } return ok(); }

  function rollDice(s, sides) { return sides.map(n => ({ n, v: d(s, n) })).sort((a, b) => b.v - a.v); }
  function compare(A, D) { let aw = 0, dw = 0; for (let i = 0; i < Math.min(A.length, D.length); i++) { if (A[i].v > D[i].v) aw++; else dw++; } return { aw, dw }; }

  // ----- bajas elegidas -----
  const LOSS_COST = [1, 2.5, 6, 12];
  function capacity(a) { return a[0] + a[1] + 2 * a[2] + a[3]; }
  function rarities(a) { return a.filter(n => n > 0).length; }
  function defaultLosses(a, n) { // reparte n derrotas minimizando lo que se pierde
    const k = zero(); n = Math.min(n, capacity(a));
    for (let i = 0; i < n; i++) {
      let best = -1, bc = 1e9;
      for (let r = 0; r < 4; r++) {
        let c;
        if (r === 2) { if (k[2] >= 2 * a[2]) continue; c = k[2] < a[2] ? 0 : LOSS_COST[2]; }
        else { if (k[r] >= a[r]) continue; c = LOSS_COST[r]; }
        if (c < bc) { bc = c; best = r; }
      }
      if (best < 0) break; k[best]++;
    }
    return k;
  }
  function lossesValid(a, n, k) {
    if (!Array.isArray(k) || k.length !== 4 || k.some(x => !Number.isInteger(x) || x < 0)) return false;
    if (total(k) !== Math.min(n, capacity(a))) return false;
    return k.every((x, r) => r === 2 ? x <= 2 * a[2] : x <= a[r]);
  }
  function applyLosses(a, k) { // devuelve muertos por rareza
    const dead = zero();
    for (let r = 0; r < 4; r++) { const m = r === 2 ? Math.max(0, k[2] - a[2]) : k[r]; dead[r] = m; a[r] -= m; }
    return dead;
  }

  // ----- decisiones pendientes -----
  function actor(s) { return s.pending ? s.pending.pid : s.current; }
  function decide(s, pid, answer) {
    const pd = s.pending;
    if (!pd || pd.pid !== pid) return err('No hay ninguna decisión tuya pendiente.');
    if (pd.kind === 'fama') {
      const q = s.players[pid];
      const spend = answer ? 1 : 0;
      if (spend && q.fama < s.P.famaDado) return err('No te alcanza la fama.');
      s.pending = null;
      if (spend) { q.fama -= s.P.famaDado; s.combat.famaDice = 1; s.combat.steps.push(`${q.name} invoca su leyenda: −${s.P.famaDado} fama, +1 dado de defensa.`); log(s, q.id, `gasta ${s.P.famaDado} de fama para reforzar la defensa.`); updateTitles(s); }
      s.combat.stage = 'dados';
      return advanceCombat(s);
    }
    if (pd.kind === 'bajas') {
      const c = s.combat, side = pd.side, army = armyOf(s, c, side);
      if (!lossesValid(army, pd.n, answer)) return err('Repartí exactamente las derrotas entre tus héroes.');
      s.pending = null;
      c['k' + side] = answer.slice(); c.stage = side === 'A' ? 'bajasD' : 'fin';
      return advanceCombat(s);
    }
    if (pd.kind === 'oferta') {
      s.pending = null;
      return finishTrade(s, pd.from, pid, pd.give, pd.get, !!answer);
    }
    return err('Decisión desconocida.');
  }
  function botDecide(s) {
    const pd = s.pending, q = s.players[pd.pid];
    if (pd.kind === 'fama') {
      const c = s.combat, b = s.buildings[c.vid];
      const per = PERSONAS[q.persona] || PERSONAS.constructor;
      const best = [3, 2, 1, 0].find(r => q.guard[r] > 0);
      const want = per.fama === 'siempre' || (per.fama !== 'nunca' && (b.type === 'cripta' || best >= 2 || total(c.party) >= 3));
      const keep = s.titles.leyenda === q.id ? TITLES.leyenda.min : 0;
      return decide(s, q.id, want && q.fama - s.P.famaDado >= keep ? 1 : 0);
    }
    if (pd.kind === 'bajas') return decide(s, q.id, defaultLosses(armyOf(s, s.combat, pd.side), pd.n));
    if (pd.kind === 'oferta') return decide(s, q.id, botAccepts(s, q, s.players[pd.from], pd.give, pd.get));
  }
  function timeoutAct(s) { // lo que pasa cuando se agota el tiempo de quien debe actuar
    if (s.winner !== null) return ok();
    if (s.pending) {
      const pd = s.pending;
      if (pd.kind === 'fama') return decide(s, pd.pid, 0);
      if (pd.kind === 'bajas') return decide(s, pd.pid, defaultLosses(armyOf(s, s.combat, pd.side), pd.n));
      if (pd.kind === 'oferta') return decide(s, pd.pid, false);
    }
    if (s.phase === 'setup') return botSetup(s);
    if (s.phase === 'roll') return roll(s);
    if (s.phase === 'raid') { skipRaid(s); return endTurn(s); }
    if (s.phase === 'main') return endTurn(s);
    return ok();
  }
  function settle(s) { // resuelve decisiones de bots hasta que espere a una persona
    for (let i = 0; i < 20 && s.pending && s.players[s.pending.pid].bot; i++) botDecide(s);
    return ok();
  }

  // ----- combate por etapas -----
  function armyOf(s, c, side) {
    if (c.type === 'combate') return side === 'A' ? c.party : s.players[c.defender].guard;
    return side === 'A' ? s.players[c.attacker].guard : c.party; // expulsión: A = guardia del dueño, D = invasores
  }
  function launchRaid(s, vid, party) {
    const p = cur(s);
    if (s.phase !== 'raid') return err('Solo podés saquear después de sacar un 7.');
    const t = raidTargets(s, p.id).find(x => x.vid === vid);
    if (!t) return err('Ese pueblo no se puede saquear.');
    party = party.map((n, r) => Math.max(0, Math.min(n | 0, p.guard[r])));
    if (s.P.legNoAttack && s.P.legNoAttack.includes(p.id)) party[3] = 0;
    if (!total(party)) return err('Elegí al menos un héroe.');
    p.guard = p.guard.map((n, r) => n - party[r]);
    p.stats.saqueos++;
    const q = s.players[t.owner];
    const traps = q.traps[vid] || [];
    q.traps[vid] = [];
    if (traps.includes('senuelo')) {
      const rest = traps.filter((x, i) => i !== traps.indexOf('senuelo'));
      s.trapDiscard.push('senuelo');
      p.exp = { target: vid, party, pending: true, traps: rest, dist: t.dist, rounds: 0, penalty: 0 };
      s.phase = 'main';
      log(s, p.id, `envía ${partyText(party)} contra ${pueblo(s, q.id)}, pero un señuelo los desvía: atacarán en su próximo turno.`);
      pushEv(s, { type: 'demora', attacker: p.id, defender: q.id, vid, party: party.slice() });
      return ok();
    }
    return startRaid(s, p, q, vid, party, traps, t.dist, false, 'main');
  }
  function startRaid(s, p, q, vid, party, traps, dist, delayed, returnPhase) {
    const c = { type: 'combate', attacker: p.id, defender: q.id, vid, party, sent: party.slice(), dist, traps: traps.slice(), steps: [], delayed, returnPhase, gas: 0, alarma: 0, derr: 0, famaDice: 0, killedA: zero(), killedD: zero() };
    if (delayed) c.steps.push('Tras perderse siguiendo pistas falsas, el grupo llega por fin al pueblo.');
    for (const tr of traps) {
      if (tr === 'foso' && total(party)) { const k = defaultLosses(party, 1); const dd = applyLosses(party, k); for (let r = 0; r < 4; r++) c.killedA[r] += dd[r]; c.steps.push(total(dd) ? 'El foso de estacas se lleva al héroe más débil del grupo.' : 'El foso de estacas hiere al épico, que resiste.'); }
      else if (tr === 'gas') { c.gas++; c.steps.push('La niebla de azufre le quita un dado al atacante.'); }
      else if (tr === 'alarma') { c.alarma++; c.steps.push('Suena la alarma: el defensor tira un dado más.'); }
      else if (tr === 'derrumbe') { c.derr = s.P.derrumbe; c.steps.push('El derrumbe complicará la permanencia si el saqueo triunfa.'); }
    }
    s.trapDiscard.push(...traps);
    s.combat = c; s.phase = 'combate';
    c.stage = total(party) ? 'fama' : 'fin';
    return advanceCombat(s);
  }
  function advanceCombat(s) {
    for (let guard = 0; guard < 10; guard++) {
      const c = s.combat; if (!c) return ok();
      if (c.stage === 'fama') {
        const q = s.players[c.defender];
        if (c.type === 'combate' && s.P.famaDefensa && q.fama >= s.P.famaDado) { s.pending = { kind: 'fama', pid: q.id, cost: s.P.famaDado }; return settle(s); }
        c.stage = 'dados'; continue;
      }
      if (c.stage === 'dados') {
        let aSides, dSides;
        if (c.type === 'combate') {
          const q = s.players[c.defender], b = s.buildings[c.vid];
          aSides = diceOf(c.party, 3); let g = c.gas; while (g-- > 0 && aSides.length > 1) aSides.pop();
          const nd = Math.min(3, 1 + (b.type === 'cripta' ? 1 : 0) + (total(q.guard) ? 1 : 0)) + c.alarma + c.famaDice;
          const gd = (s.P.legNoDefend && s.P.legNoDefend.includes(q.id)) ? [q.guard[0], q.guard[1], q.guard[2], 0] : q.guard;
          dSides = total(gd) ? diceOf(gd, 1) : [];
          while (dSides.length < nd) dSides.push(6);
        } else {
          aSides = diceOf(s.players[c.attacker].guard, 3); dSides = diceOf(c.party, 3);
        }
        const A = rollDice(s, aSides), D = rollDice(s, dSides), cmp = compare(A, D);
        c.dice = { A, D }; c.aw = cmp.aw; c.dw = cmp.dw; c.nA = aSides.length; c.nD = dSides.length;
        c.stage = 'bajasA'; continue;
      }
      if (c.stage === 'bajasA' || c.stage === 'bajasD') {
        const side = c.stage === 'bajasA' ? 'A' : 'D', army = armyOf(s, c, side);
        const n = side === 'A' ? c.dw : c.aw, owner = side === 'A' ? c.attacker : c.defender;
        if (n > 0 && capacity(army) > 0) {
          if (rarities(army) > 1 && s.P.elegirBajas) { s.pending = { kind: 'bajas', pid: owner, side, n: Math.min(n, capacity(army)), army: army.slice() }; return settle(s); }
          c['k' + side] = defaultLosses(army, n);
        } else c['k' + side] = zero();
        c.stage = side === 'A' ? 'bajasD' : 'fin'; continue;
      }
      if (c.stage === 'fin') return finishCombat(s);
      return ok();
    }
    return ok();
  }
  function finishCombat(s) {
    const c = s.combat;
    const p = s.players[c.attacker], q = s.players[c.defender];
    const kA = c.kA || zero(), kD = c.kD || zero();
    const dA = applyLosses(armyOf(s, c, 'A'), kA), dD = applyLosses(armyOf(s, c, 'D'), kD);
    const absorbed = (kA[2] - dA[2]) + (kD[2] - dD[2]);
    if (absorbed > 0) c.steps.push(absorbed === 1 ? 'Un épico absorbe una derrota sin caer.' : `Los épicos absorben ${absorbed} derrotas sin caer.`);
    const ev = { type: c.type, attacker: c.attacker, defender: c.defender, vid: c.vid, sent: c.sent, dist: c.dist, traps: c.traps, steps: c.steps.slice(), delayed: c.delayed, dice: c.dice, famaDice: c.famaDice };
    s.combat = null; s.phase = c.returnPhase || 'main';
    if (c.type === 'combate') {
      for (let r = 0; r < 4; r++) c.killedA[r] += dA[r];
      if (c.dice) ev.steps.push(`Combate: ${c.nA} dado(s) contra ${c.nD}. ${lossText('El atacante', dA)}; ${lossText('la guardia', dD)}.`);
      else ev.steps.push('No queda ningún héroe en pie para combatir.');
      const party = c.party, nk = total(c.killedA);
      if (nk) { q.lujo += nk * s.P.lujoPorCaido; ev.steps.push(`${q.name} gana ${nk} de lujo por los héroes caídos.`); }
      const success = !!c.dice && c.aw >= 1 && c.aw >= c.dw && total(party) > 0;
      ev.success = success; ev.survivors = party.slice();
      if (success) {
        p.stats.exitos++;
        p.exp = { target: c.vid, party, pending: false, rounds: 0, dist: c.dist, penalty: c.derr };
        if (s.P.legNoOccupy && party[3] > 0) { p.exp = null; p.guard = add(p.guard, party); ev.steps.push('El legendario no se queda: el grupo saquea y vuelve a casa.'); }
        p.fama += s.P.famaSaqueo;
        ev.stolenAll = [];
        for (let i = 0; i < (s.P.robo || 1); i++) {
          const pool = RES.flatMap(r => Array(q.hand[r]).fill(r));
          if (pool.length) { const r = pool[Math.floor(rand(s) * pool.length)]; q.hand[r]--; p.hand[r]++; ev.stolenAll.push(r); p.stats.robadas++; s.stats.lost[q.id]++; }
        }
        ev.stolen = ev.stolenAll[0];
        log(s, p.id, `saquea ${pueblo(s, q.id)} con ${partyText(party)}: +${s.P.famaSaqueo} fama${ev.stolen ? ' y 1 ' + RES_LABEL[ev.stolen].toLowerCase() : ''}. El grupo se queda.`);
      } else {
        p.exp = null; p.guard = add(p.guard, party);
        q.fama += s.P.famaResistir; q.stats.resistidos++;
        log(s, p.id, `fracasa al saquear ${pueblo(s, q.id)}${total(party) ? `; vuelven ${partyText(party)}` : '; no vuelve nadie'}.`);
        log(s, q.id, `resiste el saqueo: +${s.P.famaResistir} fama.`);
      }
    } else {
      const e = q.exp;
      ev.steps.push(`${lossText('La guardia', dA)}; ${lossText('los invasores', dD, true)}.`);
      if (total(dD)) p.lujo += total(dD) * s.P.lujoPorCaido;
      const success = !total(c.party) || c.aw > c.dw;
      ev.success = success;
      if (success) { q.guard = add(q.guard, c.party); q.exp = null; p.stats.expulsiones++; p.fama += s.P.famaResistir; log(s, p.id, `expulsa a los héroes de ${q.name} (+${s.P.famaResistir} fama).`); }
      else log(s, p.id, `intenta expulsar a los héroes de ${q.name} y fracasa.`);
    }
    pushEv(s, ev);
    updateTitles(s); checkWin(s);
    return ok({ ev });
  }
  function resolvePending(s) {
    const p = cur(s);
    if (!p.exp || !p.exp.pending) return;
    const e = p.exp, q = s.players[s.buildings[e.target].owner];
    p.exp = null;
    const extra = q.traps[e.target] || []; q.traps[e.target] = [];
    startRaid(s, p, q, e.target, e.party, e.traps.concat(extra), e.dist, true, 'roll');
  }
  function expel(s, vid) {
    const p = cur(s);
    if (s.phase !== 'main') return err('Primero tirá los dados.');
    if (s.turn.expelled) return err('Ya intentaste expulsar este turno.');
    const b = s.buildings[vid]; const occ = occupant(s, vid);
    if (!b || b.owner !== p.id || occ === null) return err('Ese pueblo no está ocupado.');
    if (!total(p.guard)) return err('Necesitás al menos un héroe en tu guardia.');
    s.turn.expelled = true;
    const a = s.players[occ];
    s.combat = { type: 'expulsion', attacker: p.id, defender: a.id, vid, party: a.exp.party, sent: p.guard.slice(), steps: [], returnPhase: 'main', stage: 'dados', killedA: zero(), killedD: zero() };
    s.phase = 'combate';
    return advanceCombat(s);
  }
  function razeTown(s, p, vid) {
    const b = s.buildings[vid], q = s.players[b.owner];
    const party = p.exp.party; p.exp = null; p.guard = add(p.guard, party);
    s.trapDiscard.push(...(q.traps[vid] || [])); q.traps[vid] = [];
    b.muralla = false;
    if (b.type === 'cripta') { b.type = 'cueva'; log(s, p.id, `arrasa una cripta de ${q.name}: queda reducida a cueva.`); }
    else if (s.P.raze !== 'suave' && ownBuildings(s, q.id).length > 2) { delete s.buildings[vid]; log(s, p.id, `arrasa una cueva de ${q.name}: solo quedan ruinas.`); }
    else log(s, p.id, `saquea a fondo una cueva de ${q.name}, pero no puede arrasar sus últimos pueblos.`);
    p.fama += 2; p.lujo += 2; s.stats.razed[q.id]++; s.stats.razes++;
    pushEv(s, { type: 'arrasar', attacker: p.id, defender: q.id, vid });
  }
  function permanence(s) {
    const res = [];
    for (const p of s.players) {
      if (!p.exp || p.exp.pending) continue;
      const e = p.exp, b = s.buildings[e.target];
      const bonus = e.party.reduce((a, n, r) => a + n * (r === 3 && s.P.legPerm != null ? s.P.legPerm : RARITY[r].perm), 0);
      const dc = s.P.permBase + e.dist + (b.muralla ? s.P.murallaBonus : 0) + e.rounds * s.P.roundPenalty + e.penalty;
      let r = d(s, 20), rerolled = null;
      const pass = x => x === 20 || (x !== 1 && x + bonus >= dc);
      if (!pass(r) && e.party[3] > 0 && !s.P.legNoReroll) { rerolled = r; r = d(s, 20); }
      const stay = pass(r);
      e.penalty = 0;
      res.push({ pid: p.id, owner: b.owner, roll: r, rerolled, total: r + bonus, dc, stay });
      if (stay) {
        e.rounds++; p.fama += s.P.famaRonda; p.lujo += s.P.lujoRonda; s.stats.occRounds[b.owner]++;
        if (s.P.raze && e.rounds >= 3) { razeTown(s, p, e.target); continue; }
        log(s, p.id, `d20 ${rerolled ? rerolled + ', repite: ' : ''}${r} → ${r + bonus} contra ${dc}: el grupo se queda en ${pueblo(s, b.owner)} (+1 fama, +1 lujo).`);
      } else {
        p.guard = add(p.guard, e.party); p.exp = null;
        log(s, p.id, `d20 ${rerolled ? rerolled + ', repite: ' : ''}${r} → ${r + bonus} contra ${dc}: el grupo vuelve a casa.`);
      }
    }
    if (res.length) pushEv(s, { type: 'permanencia', results: res, round: s.round });
    updateTitles(s);
  }

  // ---------- construcción y acciones ----------
  function build(s, kind, target) {
    const p = cur(s);
    if (s.phase !== 'main') return err('Primero tirá los dados.');
    const cost = s.COST[kind];
    if (!canAfford(p, cost)) return err('No te alcanzan los recursos.');
    let extra = {};
    if (kind === 'tunel') {
      if (!tunelEdges(s, p.id).includes(target)) return err('El túnel tiene que conectar con tu red.');
      if (Object.values(s.roads).filter(x => x === p.id).length >= 15) return err('No te quedan túneles.');
      s.roads[target] = p.id; log(s, p.id, 'cava un túnel.');
    } else if (kind === 'cueva') {
      if (!cuevaVertices(s, p.id).includes(target)) return err('La cueva necesita un túnel propio y dos vértices de distancia.');
      if (ownBuildings(s, p.id).filter(v => s.buildings[v].type === 'cueva').length >= 5) return err('No te quedan cuevas.');
      s.buildings[target] = { owner: p.id, type: 'cueva', muralla: false }; log(s, p.id, 'excava una cueva nueva.');
    } else if (kind === 'cripta') {
      const b = s.buildings[target];
      if (!b || b.owner !== p.id || b.type !== 'cueva') return err('Solo podés convertir una cueva propia.');
      if (ownBuildings(s, p.id).filter(v => s.buildings[v].type === 'cripta').length >= 4) return err('No te quedan criptas.');
      b.type = 'cripta'; log(s, p.id, 'convierte una cueva en cripta.');
    } else if (kind === 'trampa') {
      const b = s.buildings[target];
      if (!b || b.owner !== p.id) return err('Las trampas van en tus propios pueblos.');
      if (occupant(s, target) !== null) return err('No podés poner trampas en un pueblo ocupado.');
      if ((p.traps[target] || []).length >= 2) return err('Ese pueblo ya tiene 2 trampas.');
      if (!s.trapDeck.length) { s.trapDeck = shuffle(s, s.trapDiscard); s.trapDiscard = []; }
      if (!s.trapDeck.length) return err('No quedan trampas en el mazo.');
      const card = s.trapDeck.pop();
      (p.traps[target] = p.traps[target] || []).push(card);
      log(s, p.id, 'coloca una trampa boca abajo.');
      extra = { card };
    } else if (kind === 'muralla') {
      const b = s.buildings[target];
      if (!b || b.owner !== p.id || b.muralla) return err('Elegí un pueblo propio sin muralla.');
      b.muralla = true; log(s, p.id, 'levanta una muralla.');
    } else return err('Construcción desconocida.');
    pay(p, cost); updateTitles(s); checkWin(s);
    return ok(extra);
  }
  function recruit(s) {
    const p = cur(s);
    if (s.phase !== 'main') return err('Primero tirá los dados.');
    if (!canAfford(p, s.COST.heroe)) return err('No te alcanza para reclutar.');
    if (freeTokens(p, 0) < 1) return err('No te quedan fichas comunes: fusioná o esperá a que vuelvan.');
    pay(p, s.COST.heroe); p.guard[0]++; log(s, p.id, 'recluta un héroe común.'); updateTitles(s); checkWin(s);
    return ok();
  }
  function fuseCheck(p, r) {
    if (r < 0 || r > 2) return 'No se puede fusionar esa rareza.';
    if (p.guard[r] < 2) return `Necesitás 2 ${RARITY[r].plural} en tu guardia.`;
    if (freeTokens(p, r + 1) < 1) return `No te quedan fichas de ${RARITY[r + 1].name.toLowerCase()}.`;
    if (p.lujo < RARITY[r + 1].fuse) return `Necesitás ${RARITY[r + 1].fuse} de lujo.`;
    return null;
  }
  function fuse(s, r) {
    const p = cur(s);
    if (s.phase !== 'main') return err('Primero tirá los dados.');
    const e = fuseCheck(p, r); if (e) return err(e);
    p.guard[r] -= 2; p.guard[r + 1]++; p.lujo -= RARITY[r + 1].fuse; p.stats.fusiones[r + 1]++;
    log(s, p.id, `fusiona 2 ${RARITY[r].plural} en un héroe ${RARITY[r + 1].name.toLowerCase()} (−${RARITY[r + 1].fuse} lujo).`);
    updateTitles(s);
    return ok();
  }
  function buyDev(s) {
    const p = cur(s);
    if (s.phase !== 'main') return err('Primero tirá los dados.');
    if (!canAfford(p, s.COST.desarrollo)) return err('Una carta cuesta lana, trigo y mineral.');
    if (!s.devDeck.length) return err('El mazo de desarrollo se agotó.');
    pay(p, s.COST.desarrollo); const c = s.devDeck.pop(); p.devNew.push(c);
    log(s, p.id, 'compra una carta de desarrollo.'); checkWin(s);
    return ok({ card: c });
  }
  function playDev(s, card, choice) {
    const p = cur(s);
    if (s.phase !== 'main' && s.phase !== 'roll') return err('Ahora no.');
    if (s.turn.devPlayed) return err('Solo una carta de desarrollo por turno.');
    const i = p.dev.indexOf(card);
    if (i < 0 || card === 'reliquia') return err('No podés jugar esa carta.');
    if (card === 'veta' && (!choice || choice.length !== 2)) return err('Elegí dos recursos.');
    p.dev.splice(i, 1); s.turn.devPlayed = true;
    if (card === 'ascension') {
      const r = choice === undefined ? [2, 1].find(x => p.guard[x] > 0) : choice;
      if (!(r === 1 || r === 2) || p.guard[r] < 1 || freeTokens(p, 3) < 1) { p.dev.push(card); s.turn.devPlayed = false; return err('Necesitás un héroe raro o épico en tu guardia y tu ficha legendaria libre.'); }
      p.guard[r]--; p.guard[3]++; s.stats.ascended = (s.stats.ascended || 0) + 1;
      log(s, p.id, `juega «Ascensión»: su héroe ${RARITY[r].name.toLowerCase()} se vuelve legendario.`);
    }
    if (card === 'leva') gainCommons(s, p, 2, 'juega «Leva de héroes»');
    if (card === 'veta') { choice.forEach(r => p.hand[r]++); log(s, p.id, `juega «Veta oculta»: ${choice.map(r => RES_LABEL[r].toLowerCase()).join(' y ')}.`); }
    updateTitles(s); checkWin(s);
    return ok();
  }
  function trade(s, give, get) {
    const p = cur(s);
    if (s.phase !== 'main') return err('Primero tirá los dados.');
    if (give === get) return err('Elegí recursos distintos.');
    if (give === 'lujo') {
      if (p.lujo < 2) return err('Necesitás 2 de lujo.');
      p.lujo -= 2; p.hand[get]++; s.stats.bank[get] = (s.stats.bank[get] || 0) + 1; log(s, p.id, `vende 2 de lujo por 1 ${RES_LABEL[get].toLowerCase()}.`); return ok();
    }
    const k = rate(s, p, give);
    if (p.hand[give] < k) return err(`Con la banca cambiás ${k} ${RES_LABEL[give].toLowerCase()} por 1.`);
    p.hand[give] -= k; p.hand[get]++;
    s.stats.bank[get] = (s.stats.bank[get] || 0) + 1;
    log(s, p.id, `cambia ${k} ${RES_LABEL[give].toLowerCase()} por 1 ${RES_LABEL[get].toLowerCase()}.`);
    return ok();
  }
  // ---------- comercio entre jugadores ----------
  function botGoal(s, q) {
    const own = ownBuildings(s, q.id), cuevas = own.filter(v => s.buildings[v].type === 'cueva');
    const goal = {};
    const addC = c => { for (const r in c) goal[r] = (goal[r] || 0) + c[r]; };
    if (cuevas.length && own.length - cuevas.length < 4) addC(s.COST.cripta);
    else if (cuevas.length < 5) addC(s.COST.cueva);
    else addC(s.COST.desarrollo);
    if (heroesTotal(q) < 3) addC(s.COST.heroe);
    return goal;
  }
  function tradeValue(s, q, r) { const g = botGoal(s, q); const def = (g[r] || 0) - q.hand[r]; return def > 0 ? 2 + def * 0.5 : (g[r] ? 0.8 : 0.35); }
  function canTradeWith(s, a, b) { // nadie comercia con quien ocupa uno de sus pueblos
    const occ = (x, y) => x.exp && !x.exp.pending && s.buildings[x.exp.target] && s.buildings[x.exp.target].owner === y.id;
    return !occ(a, b) && !occ(b, a);
  }
  function botAccepts(s, q, from, receive, give) {
    if (!canTradeWith(s, q, from)) return false;
    if (pv(s, from.id) >= s.P.winPV - 2) return false;
    for (const r in give) if (q.hand[r] < give[r]) return false;
    let gain = 0, loss = 0;
    for (const r in receive) gain += receive[r] * tradeValue(s, q, r);
    for (const r in give) loss += give[r] * tradeValue(s, q, r);
    return gain > loss + per(q).tradeBonus;
  }
  function playerTrade(s, toId, give, get) {
    const p = cur(s), q = s.players[toId];
    if (s.phase !== 'main') return err('Primero tirá los dados.');
    if (!s.P.playerTrade) return err('El comercio entre jugadores está desactivado.');
    if (q.id === p.id) return err('Elegí a otro jugador.');
    if (!canTradeWith(s, p, q)) return err('No se comercia con quien ocupa tus pueblos ni con quien vos ocupás.');
    for (const r in give) if (p.hand[r] < give[r]) return err('No tenés lo que ofrecés.');
    if (!Object.keys(give).length || !Object.keys(get).length) return err('La oferta tiene que dar y pedir algo.');
    if (q.bot) return finishTrade(s, p.id, q.id, give, get, botAccepts(s, q, p, give, get));
    if (s.pending) return err('Hay otra decisión en curso.');
    s.pending = { kind: 'oferta', pid: q.id, from: p.id, give, get };
    log(s, p.id, `le ofrece un trato a ${q.name}.`);
    return ok({ waiting: true });
  }
  function finishTrade(s, fromId, toId, give, get, accepted) {
    const p = s.players[fromId], q = s.players[toId];
    if (!accepted) { log(s, q.id, `rechaza la oferta de ${p.name}.`); s.lastTrade = { from: fromId, to: toId, accepted: false, give, get }; return ok({ accepted: false }); }
    for (const r in give) if (p.hand[r] < give[r]) return err(`${p.name} ya no tiene lo que ofrecía.`);
    for (const r in get) if (q.hand[r] < get[r]) { log(s, q.id, `no tiene lo que le piden a ${p.name}.`); s.lastTrade = { from: fromId, to: toId, accepted: false, give, get }; return ok({ accepted: false }); }
    for (const r in give) { p.hand[r] -= give[r]; q.hand[r] += give[r]; }
    for (const r in get) { q.hand[r] -= get[r]; p.hand[r] += get[r]; s.stats.pgot[r] = (s.stats.pgot[r] || 0) + get[r]; }
    s.stats.ptrades++; s.turn.ptrades = (s.turn.ptrades || 0) + 1;
    const txt = o => Object.entries(o).map(([r, n]) => `${n} ${RES_LABEL[r].toLowerCase()}`).join(' y ');
    log(s, p.id, `comercia con ${q.name}: da ${txt(give)} y recibe ${txt(get)}.`);
    s.lastTrade = { from: fromId, to: toId, accepted: true, give, get };
    return ok({ accepted: true });
  }
  function botPlayerTrade(s, p, cost) {
    if (!s.P.playerTrade || (s.turn.ptrades || 0) >= 3) return false;
    const need = RES.find(r => p.hand[r] < (cost[r] || 0));
    if (!need) return false;
    const spare = RES.filter(r => r !== need && p.hand[r] - (cost[r] || 0) >= 1).sort((a, b) => (p.hand[b] - (cost[b] || 0)) - (p.hand[a] - (cost[a] || 0)));
    for (const n of [1, 2]) for (const g of spare) {
      if (p.hand[g] - (cost[g] || 0) < n) continue;
      for (const q of s.players) {
        if (q.id === p.id || !q.bot || q.hand[need] < 1) continue;
        const r = playerTrade(s, q.id, { [g]: n }, { [need]: 1 });
        if (r.ok && r.accepted) return true;
      }
    }
    return false;
  }
  function endTurn(s) {
    if (s.phase === 'raid') skipRaid(s);
    if (s.phase !== 'main') return err('Primero tirá los dados.');
    const p = cur(s);
    p.dev.push(...p.devNew); p.devNew = [];
    checkWin(s); if (s.winner !== null) return ok();
    s.current = (s.current + 1) % s.players.length;
    if (s.current === 0) { permanence(s); s.round++; log(s, null, `Ronda ${s.round}.`); }
    s.turn = { devPlayed: false, expelled: false, ptrades: 0 };
    s.phase = 'roll'; s.dice = null;
    resolvePending(s); // un ataque demorado se resuelve al comienzo del turno del atacante
    if (s.phase === 'main') s.phase = 'roll';
    return ok();
  }

  // ---------- bots ----------
  function botSetup(s) {
    const p = cur(s);
    if (s.setupSub === 'cueva') {
      const have = new Set(ownBuildings(s, p.id).flatMap(v => s.board.vertices[v].hexes.map(h => s.board.hexes[h].res)));
      let best = null, bv = -1;
      for (const v of setupVertices(s)) {
        const hx = s.board.vertices[v].hexes.map(h => s.board.hexes[h]);
        const pt = s.portAt[v];
        const val = hx.reduce((a, h) => a + pips(h.num) + (have.has(h.res) ? 0 : 1.2), 0) + (pt ? (pt === '3:1' ? 1 : (have.has(pt) ? 1.8 : 0.8)) : 0) + rand(s) * 0.5;
        if (val > bv) { bv = val; best = v; }
      }
      return placeSetup(s, best);
    }
    const scored = setupEdges(s).map(eid => { const e = s.board.edges[eid]; const far = e.a === s.setupLast ? e.b : e.a; return [eid, Math.max(0, ...s.board.vertices[far].adj.filter(v => vertexFree(s, v)).map(v => vertexValue(s, v)))]; });
    scored.sort((a, b) => b[1] - a[1]);
    return placeSetup(s, scored[0][0]);
  }
  function botTradeFor(s, p, cost) {
    for (let guard = 0; guard < 4 && !canAfford(p, cost); guard++) {
      const need = RES.find(r => p.hand[r] < (cost[r] || 0));
      if (botPlayerTrade(s, p, cost)) continue;
      const give2 = RES.filter(r => p.hand[r] - (cost[r] || 0) >= rate(s, p, r)).sort((a, b) => p.hand[b] - p.hand[a])[0];
      if (give2 && need) trade(s, give2, need);
      else if (need && p.lujo >= 5) trade(s, 'lujo', need);
      else return false;
    }
    return canAfford(p, cost);
  }
  // Personalidades: pesos que cambian cómo juega cada bot
  const PERSONAS = {
    constructor: { name: 'Constructor', raid: 2, keepHome: 1, heroes: 4, heroes2: 7, trap: 0.55, wall: 0.35, dev: 0.7, fama: 'valioso', tradeBonus: 0.15, recruitFirst: false, fuseAll: true, builder: 1 },
    saqueador: { name: 'Saqueador', raid: -0.5, keepHome: 0, heroes: 6, heroes2: 9, trap: 0.25, wall: 0.1, dev: 0.5, fama: 'nunca', tradeBonus: 0.15, recruitFirst: true, fuseAll: true, builder: 0.8 },
    defensor: { name: 'Defensor', raid: 4, keepHome: 3, heroes: 5, heroes2: 7, trap: 0.95, wall: 0.85, dev: 0.5, fama: 'siempre', tradeBonus: 0.15, recruitFirst: false, fuseAll: true, builder: 1 },
    mercader: { name: 'Mercader', raid: 2.5, keepHome: 1, heroes: 3, heroes2: 5, trap: 0.45, wall: 0.25, dev: 0.9, fama: 'valioso', tradeBonus: -0.1, recruitFirst: false, fuseAll: true, builder: 1, trader: true },
    oportunista: { name: 'Oportunista', raid: 1, keepHome: 1, heroes: 4, heroes2: 7, trap: 0.4, wall: 0.2, dev: 0.7, fama: 'nunca', tradeBonus: 0.15, recruitFirst: false, fuseAll: true, builder: 1, raider: true },
    ascendente: { name: 'Ascendente', raid: 1.5, keepHome: 1, heroes: 7, heroes2: 9, trap: 0.35, wall: 0.2, dev: 0.85, fama: 'valioso', tradeBonus: 0.15, recruitFirst: true, fuseAll: true, builder: 0.8 },
  };
  const per = p => PERSONAS[p.persona] || PERSONAS.constructor;
  function botRaid(s) {
    const p = cur(s), pp = per(p);
    let best = null, bs = -1e9;
    for (const t of raidTargets(s, p.id)) {
      const b = s.buildings[t.vid];
      const spyPen = t.spied ? ({ foso: 2, gas: 1.5, alarma: 1.5, derrumbe: 1, senuelo: 0.5 })[t.spied] : 0;
      const sc = vertexValue(s, t.vid) * (b.type === 'cripta' ? 1.6 : 1) + pvPublic(s, t.owner) * 0.6 - t.dist * 1.1
        - (t.traps - (t.spied ? 1 : 0)) * 1.4 - spyPen - (total(s.players[t.owner].guard) ? 1.5 : 0) + b.muralla * -1 + rand(s);
      if (sc > bs) { bs = sc; best = t; }
    }
    if (!best || bs < pp.raid) return skipRaid(s);
    const party = p.guard.slice();
    for (let k = 0; k < pp.keepHome && total(party) > 1; k++) { const r = [0, 1, 2, 3].find(x => party[x] > 0); party[r]--; }
    return launchRaid(s, best.vid, party);
  }
  function botMain(s) {
    const p = cur(s), pp = per(p);
    for (let i = 0; i < 25 && s.winner === null && s.phase === 'main'; i++) {
      const occ = ownBuildings(s, p.id).find(v => occupant(s, v) !== null);
      if (occ !== undefined && !s.turn.expelled && total(p.guard) >= 1 && (total(p.guard) >= 2 || total(s.players[occupant(s, occ)].exp.party) <= 1)) { expel(s, occ); continue; }
      if (!s.turn.devPlayed && p.dev.includes('ascension') && freeTokens(p, 3) > 0 && (p.guard[1] || p.guard[2])) { playDev(s, 'ascension'); continue; }
      if (!s.turn.devPlayed && p.dev.includes('leva') && freeTokens(p, 0) > 0) { playDev(s, 'leva'); continue; }
      if (!s.turn.devPlayed && p.dev.includes('veta')) {
        const want = RES.filter(r => p.hand[r] < (s.COST.cripta[r] || 0) || p.hand[r] < (s.COST.cueva[r] || 0)).concat(['mineral', 'trigo']).slice(0, 2);
        playDev(s, 'veta', want); continue;
      }
      const fr = [2, 1, 0].find(r => !fuseCheck(p, r));
      if (fr !== undefined) { fuse(s, fr); continue; }
      if (s.P.asalto && !s.turn.asalto && canRaid(s, p.id) && total(p.guard) >= (pp.recruitFirst || pp.raider ? 2 : 3) && canAfford(p, s.P.asalto) && rand(s) < (pp.recruitFirst || pp.raider ? 0.9 : 0.35)) {
        callRaid(s); botRaid(s); if (s.phase === 'raid') skipRaid(s); if (s.phase !== 'main') return; continue;
      }
      if (pp.recruitFirst && heroesTotal(p) < pp.heroes && freeTokens(p, 0) > 0 && botTradeFor(s, p, s.COST.heroe)) { recruit(s); continue; }
      const cuevas = ownBuildings(s, p.id).filter(v => s.buildings[v].type === 'cueva');
      const nCrip = ownBuildings(s, p.id).length - cuevas.length;
      if (cuevas.length && nCrip < 4 && botTradeFor(s, p, s.COST.cripta)) { build(s, 'cripta', cuevas.sort((a, b) => vertexValue(s, b) - vertexValue(s, a))[0]); continue; }
      const spots = cuevaVertices(s, p.id);
      if (spots.length && cuevas.length < 5 && botTradeFor(s, p, s.COST.cueva)) { build(s, 'cueva', spots.sort((a, b) => vertexValue(s, b) - vertexValue(s, a))[0]); continue; }
      const nRoads = Object.values(s.roads).filter(x => x === p.id).length;
      if (!spots.length && nRoads < 15 && cuevas.length < 5 && canAfford(p, s.COST.tunel) && rand(s) < pp.builder) {
        const es = tunelEdges(s, p.id).map(eid => {
          const e = s.board.edges[eid];
          const far = playerTouches(s, p.id, e.a) ? e.b : e.a;
          const v1 = vertexFree(s, far) ? vertexValue(s, far) : 0;
          const v2 = Math.max(0, ...s.board.vertices[far].adj.filter(v => vertexFree(s, v)).map(v => vertexValue(s, v) * 0.7));
          return [eid, Math.max(v1, v2) + rand(s) * 0.3];
        }).sort((a, b) => b[1] - a[1]);
        if (es.length && es[0][1] > 0) { build(s, 'tunel', es[0][0]); continue; }
      }
      if (heroesTotal(p) < pp.heroes && freeTokens(p, 0) > 0 && canAfford(p, s.COST.heroe) && rand(s) < 0.8) { recruit(s); continue; }
      const own = ownBuildings(s, p.id).filter(v => (p.traps[v] || []).length < 2 && occupant(s, v) === null);
      if (own.length && canAfford(p, s.COST.trampa) && rand(s) < pp.trap) {
        const w = v => vertexValue(s, v) * (s.buildings[v].type === 'cripta' ? 2 : 1) + (threatOf(s, v) !== null ? 20 : 0);
        build(s, 'trampa', own.sort((a, b) => w(b) - w(a))[0]); continue;
      }
      if (canAfford(p, s.COST.desarrollo) && s.devDeck.length && rand(s) < pp.dev) { buyDev(s); continue; }
      const walls = ownBuildings(s, p.id).filter(v => !s.buildings[v].muralla && occupant(s, v) === null).sort((a, b) => (s.buildings[b].type === 'cripta') - (s.buildings[a].type === 'cripta'));
      if (walls.length && canAfford(p, s.COST.muralla) && rand(s) < pp.wall) { build(s, 'muralla', walls[0]); continue; }
      if (heroesTotal(p) < pp.heroes2 && freeTokens(p, 0) > 0 && canAfford(p, s.COST.heroe) && rand(s) < 0.4) { recruit(s); continue; }
      break;
    }
  }
  function botTurn(s) {
    if (s.winner !== null) return ok();
    if (s.pending) { if (s.players[s.pending.pid].bot) settle(s); if (s.pending) return ok({ waiting: true }); }
    if (s.phase === 'combate') return ok({ waiting: true });
    if (s.phase === 'setup') return botSetup(s);
    if (s.phase === 'roll') {
      const p = cur(s);
      if (!s.turn.devPlayed && p.dev.includes('leva') && !total(p.guard) && freeTokens(p, 0) > 0) playDev(s, 'leva');
      roll(s);
    }
    if (s.phase === 'raid') botRaid(s);
    if (s.phase === 'raid') skipRaid(s); // si el saqueo no pudo lanzarse, no trabar el turno
    if (s.phase === 'combate' || s.pending) return ok({ waiting: true });
    if (s.phase === 'main') botMain(s);
    if (s.phase === 'combate' || s.pending) return ok({ waiting: true });
    if (s.winner === null && s.phase === 'main') endTurn(s);
    return ok();
  }

  const api = {
    PERSONAS, actor, callRaid, decide, settle, timeoutAct, defaultLosses, lossesValid, capacity, finishTrade, tmin,
    RES, RES_LABEL, COST, RARITY, TRAPS, TRAP_DECK, DEV, DEV_DECK, TITLES, P, COLORS,
    createGame, placeSetup, setupVertices, setupEdges, roll, raidTargets, canRaid, skipRaid, launchRaid, expel,
    build, recruit, fuse, playerTrade, rate, canTradeWith, fuseCheck, buyDev, playDev, trade, endTurn, botTurn,
    tunelEdges, cuevaVertices, ownBuildings, occupant, threatOf, isBastion, pv, pvPublic, longestRoad, handSize, canAfford,
    raidDistance, vertexValue, pips, total, inPlay, heroesTotal, freeTokens, partyText, diceOf,
  };
  if (typeof module !== 'undefined') module.exports = api; else root.Engine = api;
})(typeof window !== 'undefined' ? window : globalThis);
