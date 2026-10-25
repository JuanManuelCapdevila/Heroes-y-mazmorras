/* Partida: sesiones local y en línea, decisiones y panel. */
const BOT_NAMES = ['Morgrath', 'Ylsa la Gris', 'Barón Cieno'];
const LOCAL_PERSONAS = ['saqueador', 'mercader', 'defensor', 'oportunista', 'ascendente'];

function shuffled(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
function actorKey(s) { return s.winner !== null ? 'fin' : `${E.actor(s)}|${s.pending ? s.pending.kind : s.phase}`; }

// ----- sesión local contra bots -----
function makeLocalGame() {
  const per = shuffled(LOCAL_PERSONAS).slice(0, 3);
  return E.createGame({ seed: (Math.random() * 1e9) | 0, seats: [{ bot: false, name: 'Tu señorío' }, ...per.map((p, i) => ({ bot: true, persona: p, name: BOT_NAMES[i] }))] });
}
function useLocalSession() {
  const ref = useRef(null);
  const [, setTick] = useState(0);
  if (!ref.current) ref.current = makeLocalGame();
  const act = useCallback(fn => { const r = fn(ref.current); setTick(t => t + 1); return r || { ok: true }; }, []);
  const newGame = useCallback(() => { ref.current = makeLocalGame(); setTick(t => t + 1); }, []);
  try { window.__local = { get s() { return ref.current; }, refresh() { setTick(t => t + 1); } }; } catch (e) { }
  return { s: ref.current, me: 0, online: false, act, newGame, botDriver: true, deadline: null, nameOf: id => ref.current.players[id].name, gameKey: ref.current.board.hexes.map(h => h.num).join('') };
}

// ----- utilidades de la base compartida -----
let CAPS = null;
async function caps() {
  if (CAPS) return CAPS;
  const c = window.claude;
  if (!c || !c.use) return (CAPS = { db: null, room: null, user: null, uid: null });
  const [db, room, user] = await Promise.all([c.use('db'), c.use('room'), c.use('user')]);
  let uid = null; try { uid = user ? await user.id() : null; } catch (e) { uid = null; }
  return (CAPS = { db, room, user, uid });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function withLease(ref, uid, fn) {
  for (let i = 0; i < 8; i++) {
    let res; try { res = await ref.acquire({ holder: uid, ttlMs: 5000 }); } catch (e) { res = { acquired: true }; }
    if (res.acquired) return fn();
    await sleep(250 + Math.random() * 300);
  }
  throw new Error('busy');
}
function useProfiles(uids) {
  const [names, setNames] = useState({});
  const key = (uids || []).filter(Boolean).join(',');
  useEffect(() => {
    let alive = true;
    (async () => {
      const { user } = await caps();
      if (!user || !key) return;
      try { const ps = await user.profiles(key.split(',')); if (alive) setNames(Object.fromEntries(Object.entries(ps).map(([k, v]) => [k, (v && v.name) || '']))); } catch (e) { /* sin nombres */ }
    })();
    return () => { alive = false; };
  }, [key]);
  return names;
}

// ----- sesión en línea -----
function useOnlineSession(code) {
  const [doc, setDoc] = useState(null);
  const [err, setErr] = useState('');
  const [peers, setPeers] = useState([]);
  const [uid, setUid] = useState(null);
  const latest = useRef(null), refs = useRef({}), chain = useRef(Promise.resolve());
  const accept = d => {
    if (!d || typeof d.json !== 'string') return;
    if (latest.current && d.version < latest.current.version) return;
    if (latest.current && d.version === latest.current.version) return;
    latest.current = { state: JSON.parse(d.json), version: d.version, deadline: d.deadline || null };
    setDoc(latest.current);
  };
  useEffect(() => {
    let unsub = null, named = null, alive = true;
    (async () => {
      const c = await caps();
      if (!alive) return;
      setUid(c.uid);
      if (!c.db) { setErr('La partida en línea no está disponible en esta vista.'); return; }
      const ref = c.db.doc('partidas/' + code); refs.current.ref = ref; refs.current.uid = c.uid;
      unsub = ref.onSnapshot(snap => { if (snap.exists) accept(snap.data()); }, e => setErr('Se perdió la conexión con la partida. Recargá la página.'));
      if (c.room) {
        try {
          named = await c.room.join('sala-' + code);
          refs.current.room = named;
          named.on('tick', async m => { if (m.isMe) return; try { const snap = await ref.get(); if (snap.exists) accept(snap.data()); } catch (e) { } });
          named.onPeers(ch => setPeers(ch.peers.map(p => ({ uid: p.by, isMe: p.isMe, seat: p.presence && p.presence.seat }))));
          await named.presence({ code });
        } catch (e) { refs.current.room = null; }
      }
    })();
    return () => { alive = false; unsub && unsub(); named && named.leave().catch(() => { }); };
  }, [code]);

  const s = doc ? doc.state : null;
  const me = s && uid ? s.players.findIndex(p => p.uid === uid) : -1;
  const act = useCallback(fn => {
    const base = latest.current;
    if (!base) return { ok: false, error: 'La partida todavía no cargó.' };
    const s2 = JSON.parse(JSON.stringify(base.state));
    const r = fn(s2) || { ok: true };
    if (!r.ok) return r;
    const t = s2.P.timers || { turno: 90, decision: 30 };
    const deadline = actorKey(s2) !== actorKey(base.state) ? Date.now() + (s2.pending ? t.decision : t.turno) * 1000 : base.deadline;
    const next = { state: s2, version: base.version + 1, deadline };
    latest.current = next; setDoc(next);
    const baseVersion = base.version;
    chain.current = chain.current.then(async () => {
      const { ref, uid: u, room } = refs.current;
      if (!ref) return;
      try {
        await withLease(ref, u || 'anon', async () => {
          const cur = await ref.get();
          const v = cur.exists ? cur.data().version : 0;
          if (v !== baseVersion) { latest.current = null; accept(cur.data()); setErr('Otra acción llegó primero; la partida se actualizó.'); return; }
          await ref.set({ json: JSON.stringify(s2), version: baseVersion + 1, deadline, actualizada: Date.now() });
        });
        if (room) room.emit('tick', { v: baseVersion + 1 }).catch(() => { });
      } catch (e) {
        setErr(e && e.code === 'quota_exceeded' ? 'La base de la partida está llena.' : 'No se pudo guardar la jugada. Revisá tu conexión.');
        try { const cur = await ref.get(); latest.current = null; accept(cur.data()); } catch (e2) { }
      }
    });
    return r;
  }, []);
  const seatUids = s ? s.players.map(p => p.uid) : [];
  const names = useProfiles(seatUids);
  const present = new Set(peers.map(p => p.uid).filter(Boolean));
  if (uid) present.add(uid);
  // anfitrión: el primer asiento humano conectado; corre bots y vencimientos
  const hostSeat = s ? s.players.findIndex(p => !p.bot && p.uid && (refs.current.room ? present.has(p.uid) : true)) : -1;
  const isHost = !!s && me >= 0 && hostSeat === me;
  return {
    s, me, online: true, act, botDriver: isHost, deadline: doc ? doc.deadline : null, err, clearErr: () => setErr(''), present,
    nameOf: id => (s && s.players[id].uid && names[s.players[id].uid]) || (s ? s.players[id].name : ''), gameKey: code,
  };
}

// ----- decisiones -----
function LossPicker({ s, pd, onSubmit }) {
  const army = pd.army, n = pd.n;
  const [k, setK] = useState(() => E.defaultLosses(army, n));
  const max = r => r === 2 ? 2 * army[2] : army[r];
  const valid = E.lossesValid(army, n, k);
  const dead = k.map((x, r) => r === 2 ? Math.max(0, x - army[2]) : x);
  return html`<div>
    <p class="sub">Perdiste ${n} ${n === 1 ? 'comparación' : 'comparaciones'}. Elegí qué héroes reciben las derrotas. Un épico aguanta una derrota sin caer; con dos, cae.</p>
    ${[3, 2, 1, 0].filter(r => army[r] > 0).map(r => html`<div key=${r} class="stepper">
      <${HeroToken} color=${s.players[pd.pid].color} rarity=${r} size=${26}/><span class="sl">${E.RARITY[r].name} · tenés ${army[r]}</span>
      <button class="sb" aria-label=${'Menos derrotas a ' + E.RARITY[r].name} disabled=${k[r] <= 0} onClick=${() => setK(k.map((x, i) => i === r ? x - 1 : x))}>−</button>
      <b>${k[r]}</b><span class="muted small">/ ${max(r)}</span>
      <button class="sb" aria-label=${'Más derrotas a ' + E.RARITY[r].name} disabled=${k[r] >= max(r)} onClick=${() => setK(k.map((x, i) => i === r ? x + 1 : x))}>+</button>
    </div>`)}
    <p class=${'small ' + (valid ? 'muted' : 'lose')}>${valid ? `Caen: ${E.partyText(dead)}.` : `Asigná exactamente ${Math.min(n, E.capacity(army))} derrotas.`}</p>
    <div class="mrow"><button class="btn primary" disabled=${!valid} onClick=${() => onSubmit(k)}>Confirmar bajas</button></div>
  </div>`;
}
function DecisionModal({ session }) {
  const { s, me, act, nameOf } = session;
  const pd = s.pending;
  const q = s.players[me];
  const c = s.combat;
  if (pd.kind === 'fama') {
    const atk = s.players[c.attacker], b = s.buildings[c.vid];
    return html`<${Modal} title="¡Te atacan!">
      <p class="sub">${nameOf(atk.id)} ataca tu ${BLD_NAME[b.type]} con ${E.partyText(c.party)}.</p>
      <${PartyRow} party=${c.party} color=${atk.color} size=${40}/>
      ${c.steps.map((t, i) => html`<p key=${i} class="step">${t}</p>`)}
      <p>¿Invocás tu leyenda? Gastás ${pd.cost} de fama y tirás un dado más de defensa. Tenés ${q.fama} de fama${s.P.famaPV ? `, que hoy vale ${Math.floor(q.fama / s.P.famaPV)} PV` : ''}.</p>
      <div class="mrow"><button class="btn primary" onClick=${() => act(st => E.decide(st, me, 1))}>Gastar ${pd.cost} fama</button><button class="btn" onClick=${() => act(st => E.decide(st, me, 0))}>Defender sin gastar</button></div>
    </${Modal}>`;
  }
  if (pd.kind === 'bajas') {
    return html`<${Modal} title=${c && c.type === 'expulsion' ? 'Bajas en la expulsión' : pd.side === 'A' ? 'Bajas de tu grupo' : 'Bajas de tu guardia'}>
      ${c && c.dice ? html`<div class="dicecmp">
        <div><span class="lbl">${c.attacker === me ? 'Vos' : nameOf(c.attacker)}</span><div class="dice">${c.dice.A.map((d, i) => html`<${Die} key=${i} v=${d.v} sides=${d.n} size=${30}/>`)}</div></div>
        <div><span class="lbl">${c.defender === me ? 'Vos' : nameOf(c.defender)}</span><div class="dice">${c.dice.D.map((d, i) => html`<${Die} key=${i} v=${d.v} sides=${d.n} size=${30}/>`)}</div></div>
      </div>` : null}
      <${LossPicker} s=${s} pd=${pd} onSubmit=${k => act(st => E.decide(st, me, k))}/>
    </${Modal}>`;
  }
  if (pd.kind === 'oferta') {
    const lacks = Object.entries(pd.get).some(([r, n]) => q.hand[r] < n);
    return html`<${Modal} title="Oferta de comercio">
      <p>${nameOf(pd.from)} te ofrece <b>${bundleText(pd.give)}</b> a cambio de <b>${bundleText(pd.get)}</b>.</p>
      ${lacks ? html`<p class="small lose">No tenés lo que te piden.</p>` : null}
      <div class="mrow"><button class="btn primary" disabled=${lacks} onClick=${() => act(st => E.decide(st, me, true))}>Aceptar</button><button class="btn" onClick=${() => act(st => E.decide(st, me, false))}>Rechazar</button></div>
    </${Modal}>`;
  }
  return null;
}

function TradeDialog({ session, onClose }) {
  const { s, me, act, nameOf } = session;
  const p = s.players[me];
  const [tab, setTab] = useState('banca');
  const [give, setGive] = useState(E.RES.find(r => p.hand[r] >= E.rate(s, p, r)) || 'madera');
  const [get, setGet] = useState('mineral');
  const [to, setTo] = useState(s.players.find(q => q.id !== me && E.canTradeWith(s, p, q))?.id ?? -1);
  const [g, setG] = useState(Object.fromEntries(E.RES.map(r => [r, 0])));
  const [w, setW] = useState(Object.fromEntries(E.RES.map(r => [r, 0])));
  const [msg, setMsg] = useState('');
  const step = (o, set, r, d, max) => set({ ...o, [r]: Math.max(0, Math.min(max, o[r] + d)) });
  const clean = o => Object.fromEntries(Object.entries(o).filter(([, n]) => n > 0));
  return html`<${Modal} title="Comerciar" wide>
    <div class="tabs small" role="tablist">${[['banca', 'Banca y pasajes'], ['jugadores', 'Con otros señores']].map(([k, l]) => html`<button key=${k} role="tab" aria-selected=${tab === k} class=${tab === k ? 'on' : ''} onClick=${() => { setTab(k); setMsg(''); }}>${l}</button>`)}</div>
    ${tab === 'banca' ? html`<div>
      <div class="tradegrid">
        <div><p class="small muted">Das</p>${['lujo', ...E.RES].map(r => { const k = r === 'lujo' ? 2 : E.rate(s, p, r); return html`<button key=${r} class=${'opt' + (give === r ? ' on' : '')} onClick=${() => setGive(r)} disabled=${r === 'lujo' ? p.lujo < 2 : p.hand[r] < k}>${k} ${r === 'lujo' ? 'lujo' : E.RES_LABEL[r].toLowerCase()}${r !== 'lujo' && k < 4 ? ' · pasaje' : ''}</button>`; })}</div>
        <div><p class="small muted">Recibís</p>${E.RES.map(r => html`<button key=${r} class=${'opt' + (get === r ? ' on' : '')} onClick=${() => setGet(r)}>1 ${E.RES_LABEL[r].toLowerCase()}</button>`)}</div>
      </div>
      <div class="mrow"><button class="btn primary" onClick=${() => { const r = act(st => E.trade(st, give, get)); setMsg(r.ok ? 'Hecho.' : r.error); }}>Cambiar</button></div>
    </div>` : html`<div>
      <p class="small muted">Elegí con quién. No se comercia con quien ocupa tus pueblos ni con quien vos ocupás.</p>
      <div class="mrow">${s.players.filter(q => q.id !== me).map(q => html`<button key=${q.id} class=${'opt' + (to === q.id ? ' on' : '')} disabled=${!E.canTradeWith(s, p, q)} onClick=${() => setTo(q.id)}><i class="dot" style=${{ background: q.color }}></i> ${nameOf(q.id)}${q.bot ? ' · bot' : ''}</button>`)}</div>
      <div class="tradegrid">
        <div><p class="small muted">Ofrecés</p>${E.RES.map(r => html`<div key=${r} class="stepper slim"><span class="sl">${E.RES_LABEL[r]}</span><button class="sb" aria-label=${'Ofrecer menos ' + r} onClick=${() => step(g, setG, r, -1, p.hand[r])}>−</button><b>${g[r]}</b><span class="muted small">/ ${p.hand[r]}</span><button class="sb" aria-label=${'Ofrecer más ' + r} onClick=${() => step(g, setG, r, 1, p.hand[r])}>+</button></div>`)}</div>
        <div><p class="small muted">Pedís</p>${E.RES.map(r => html`<div key=${r} class="stepper slim"><span class="sl">${E.RES_LABEL[r]}</span><button class="sb" aria-label=${'Pedir menos ' + r} onClick=${() => step(w, setW, r, -1, 5)}>−</button><b>${w[r]}</b><span class="muted small"></span><button class="sb" aria-label=${'Pedir más ' + r} onClick=${() => step(w, setW, r, 1, 5)}>+</button></div>`)}</div>
      </div>
      <div class="mrow"><button class="btn primary" disabled=${to < 0 || !Object.keys(clean(g)).length || !Object.keys(clean(w)).length} onClick=${() => {
        const r = act(st => E.playerTrade(st, to, clean(g), clean(w)));
        if (!r.ok) setMsg(r.error);
        else if (r.waiting) { setMsg(`Oferta enviada a ${nameOf(to)}. Esperando respuesta…`); }
        else { setMsg(r.accepted ? `${nameOf(to)} aceptó el trato.` : `${nameOf(to)} rechazó el trato.`); if (r.accepted) { setG(Object.fromEntries(E.RES.map(x => [x, 0]))); setW(Object.fromEntries(E.RES.map(x => [x, 0]))); } }
      }}>Ofrecer</button></div>
    </div>`}
    ${msg ? html`<p class="small" role="status">${msg}</p>` : null}
    <div class="mrow"><button class="btn ghost" onClick=${onClose}>Cerrar</button></div>
  </${Modal}>`;
}

function Countdown({ deadline }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  if (!deadline) return null;
  const left = Math.max(0, Math.round((deadline - now) / 1000));
  return html`<span class=${'timer' + (left <= 10 ? ' urgent' : '')} aria-label=${`Quedan ${left} segundos`}>${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</span>`;
}

// ----- la partida -----
function Game({ session, onExit }) {
  const { s, me, act, nameOf, online } = session;
  const [mode, setMode] = useState(null);
  const [msg, setMsg] = useState('');
  const [queue, setQueue] = useState([]);
  const seen = useRef(null);
  const [party, setParty] = useState([0, 0, 0, 0]);
  const [dialog, setDialog] = useState(null);
  const [reveal, setReveal] = useState(null);
  const lastBot = useRef(0);
  const spectator = me < 0;
  const mine = spectator ? null : s.players[me];
  const actorId = E.actor(s);
  const myTurn = !spectator && s.current === me && s.winner === null && !s.pending;
  const myDecision = !spectator && s.pending && s.pending.pid === me;
  const pname = id => id === me ? 'Vos' : nameOf(id);
  const lname = id => id === me ? (online ? 'Vos' : 'Tu señorío') : nameOf(id);

  function run(fn) { const r = act(fn); setMsg(r && !r.ok ? r.error : ''); return r || { ok: true }; }

  // eventos nuevos que me involucran
  useEffect(() => { seen.current = s.evSeq || 0; setQueue([]); }, [session.gameKey]);
  useEffect(() => {
    if (seen.current === null) seen.current = s.evSeq || 0;
    const fresh = s.events.filter(ev => ev.id > seen.current);
    if (!fresh.length) return;
    seen.current = Math.max(...fresh.map(ev => ev.id));
    const mineEv = fresh.filter(ev => spectator ? ev.type !== 'permanencia' :
      (ev.type !== 'permanencia' && (ev.attacker === me || ev.defender === me)) ||
      (ev.type === 'permanencia' && ev.results.some(r => r.pid === me || r.owner === me)));
    if (mineEv.length) setQueue(q => q.concat(mineEv));
  });
  // bots y vencimientos
  const blocked = !online && (queue.length > 0 || !!dialog || !!reveal);
  useEffect(() => {
    if (!session.botDriver || s.winner !== null) return;
    const a = E.actor(s);
    if (s.players[a].bot && !blocked) {
      const wait = Math.max(0, (s.phase === 'setup' ? 380 : 800) - (Date.now() - lastBot.current));
      const t = setTimeout(() => { lastBot.current = Date.now(); act(E.botTurn); }, wait);
      return () => clearTimeout(t);
    }
    if (online && session.deadline) {
      const t = setTimeout(() => act(E.timeoutAct), Math.max(500, session.deadline - Date.now() + 1500));
      return () => clearTimeout(t);
    }
  });
  useEffect(() => { if (s.phase === 'raid' && myTurn) { const g = mine.guard.slice(); if (E.total(g) > 2 && g[0] > 0) g[0]--; setParty(g); } }, [s.phase, s.current]);
  useEffect(() => { if (!myTurn) setMode(null); }, [myTurn]);

  let targets = { kind: null, ids: [] };
  if (myTurn && !blocked) {
    if (s.phase === 'setup') targets = s.setupSub === 'cueva' ? { kind: 'v', ids: E.setupVertices(s) } : { kind: 'e', ids: E.setupEdges(s) };
    else if (s.phase === 'raid') {
      const ts = E.raidTargets(s, me); const info = {};
      ts.forEach(t => info[t.vid] = `dist ${t.dist}${t.spied ? ' · ' + E.TRAPS[t.spied].name.split(' ')[0] : ''}`);
      targets = { kind: 'v', ids: ts.map(t => t.vid), info };
    } else if (s.phase === 'main' && mode) {
      const own = E.ownBuildings(s, me);
      targets = {
        tunel: { kind: 'e', ids: E.tunelEdges(s, me) },
        cueva: { kind: 'v', ids: E.cuevaVertices(s, me) },
        cripta: { kind: 'v', ids: own.filter(v => s.buildings[v].type === 'cueva') },
        trampa: { kind: 'v', ids: own.filter(v => (mine.traps[v] || []).length < 2 && E.occupant(s, v) === null) },
        muralla: { kind: 'v', ids: own.filter(v => !s.buildings[v].muralla) },
        expel: { kind: 'v', ids: own.filter(v => E.occupant(s, v) !== null) },
      }[mode] || targets;
    }
  }
  function onPick(id) {
    if (s.phase === 'setup') return run(st => E.placeSetup(st, id));
    if (s.phase === 'raid') return run(st => E.launchRaid(st, id, party));
    if (mode === 'expel') { setMode(null); return run(st => E.expel(st, id)); }
    const kind = mode;
    const r = run(st => E.build(st, kind, id));
    if (r.ok && kind === 'trampa') setReveal({ kind: 'trampa', id: r.card });
    if (r.ok) setMode(null);
  }

  const occupiedMine = spectator ? [] : E.ownBuildings(s, me).filter(v => E.occupant(s, v) !== null);
  const canMain = myTurn && s.phase === 'main' && !blocked;
  const waitingFor = s.pending ? s.pending.pid : s.current;
  const hint = s.winner !== null ? `${pname(s.winner)} ${s.winner === me ? 'ganaste' : 'ganó'} la partida.`
    : myDecision ? 'Tenés una decisión pendiente.'
    : s.pending ? `Esperando la decisión de ${nameOf(waitingFor)}…`
    : spectator ? `Juega ${nameOf(s.current)}.`
    : !myTurn ? `Juega ${nameOf(s.current)}…`
    : s.phase === 'setup' ? (s.setupSub === 'cueva' ? 'Elegí un vértice libre para tu campamento.' : 'Elegí por dónde sale el túnel.')
    : s.phase === 'roll' ? 'Tirá los dados para producir.'
    : s.phase === 'raid' ? 'Armá tu grupo y elegí un pueblo para saquear, o pasá.'
    : s.phase === 'combate' ? 'Resolviendo el combate…'
    : mode ? { tunel: 'Elegí un borde para el túnel.', cueva: 'Elegí dónde levantar el campamento.', cripta: 'Elegí el campamento a convertir.', trampa: 'Elegí el pueblo donde esconder la trampa.', muralla: 'Elegí el pueblo a amurallar.', expel: 'Elegí el pueblo ocupado.' }[mode]
    : 'Construí, comerciá o terminá el turno.';

  const BUILD = [['tunel', 'Túnel'], ['cueva', 'Campamento'], ['cripta', 'Cripta'], ['trampa', 'Trampa'], ['muralla', 'Muralla']];
  const ev = queue[0];
  const myTraps = spectator ? [] : Object.entries(mine.traps).filter(([, a]) => a.length);
  const famaPV = n => s.P.famaPV ? Math.floor(n / s.P.famaPV) : 0;
  const goal = s.P.winPV;

  return html`<div class="game">
    <div class="boardwrap">
      <${Board} s=${s} targets=${targets} onPick=${onPick}/>
      <div class="legend"><span><i class="lg wall"></i>muralla</span><span><i class="lg port"></i>pasaje de contrabando</span><span>Medallón: grupo saqueador</span></div>
    </div>
    <aside class="side">
      <section class="turn">
        <div class="trow"><div><div class="eyebrow">${s.phase === 'setup' ? 'Preparación' : 'Ronda ' + s.round} · meta ${goal} PV</div>
          <div class="who"><i class="dot" style=${{ background: s.players[waitingFor].color }}></i>${waitingFor === me ? (s.pending ? 'Tu decisión' : 'Tu turno') : nameOf(waitingFor)}${online ? html` <${Countdown} deadline=${session.deadline}/>` : null}</div></div>
          <div class="dice">${s.dice ? s.dice.map((v, i) => html`<${Die} key=${i} v=${v}/>`) : null}</div></div>
        <p class="hint" aria-live="polite">${hint}</p>
        ${msg ? html`<p class="err" role="alert">${msg}</p>` : null}
        ${session.err ? html`<p class="err" role="alert">${session.err} <button class="linkbtn" onClick=${session.clearErr}>Cerrar</button></p>` : null}
        <div class="mrow">
          ${myTurn && s.phase === 'roll' ? html`<button class="btn primary" onClick=${() => run(E.roll)}>Tirar dados</button>` : null}
          ${myTurn && s.phase === 'raid' ? html`<div class="raidbox">
              <p class="small muted">Grupo de saqueo (el resto queda defendiendo):</p>
              ${[3, 2, 1, 0].filter(r => mine.guard[r] > 0).map(r => html`<div key=${r} class="stepper">
                <${HeroToken} color=${mine.color} rarity=${r} size=${22}/><span class="sl">${E.RARITY[r].name} · d${E.RARITY[r].die}</span>
                <button class="sb" aria-label=${'Quitar ' + E.RARITY[r].name} disabled=${party[r] <= 0} onClick=${() => setParty(party.map((n, i) => i === r ? n - 1 : n))}>−</button>
                <b>${party[r]}</b><span class="muted small">/ ${mine.guard[r]}</span>
                <button class="sb" aria-label=${'Sumar ' + E.RARITY[r].name} disabled=${party[r] >= mine.guard[r]} onClick=${() => setParty(party.map((n, i) => i === r ? n + 1 : n))}>+</button>
              </div>`)}
              ${mine.guard[1] > 0 ? html`<p class="small muted">Tu héroe raro espía la primera trampa de cada objetivo.</p>` : null}
              <button class="btn" onClick=${() => run(E.skipRaid)}>No saquear</button></div>` : null}
          ${canMain ? html`<button class="btn primary" onClick=${() => { setMode(null); run(E.endTurn); }}>Terminar turno</button>` : null}
          ${mode ? html`<button class="btn ghost" onClick=${() => setMode(null)}>Cancelar</button>` : null}
          ${onExit ? html`<button class="btn ghost" onClick=${onExit}>Salir de la sala</button>` : null}
        </div>
      </section>

      ${spectator ? html`<section><p class="muted">Estás mirando esta partida. Las manos y trampas de los jugadores no se muestran.</p></section>` : html`
      <section>
        <h4>Tus recursos</h4>
        <div class="hand">${E.RES.map(r => html`<${ResChip} key=${r} r=${r} n=${mine.hand[r]}/>`)}</div>
        <div class="stats">
          <span title="Fama: cada ${s.P.famaPV} vale 1 PV"><${Glyph} type="fama" size=${18}/> ${mine.fama} fama${s.P.famaPV ? ` · ${famaPV(mine.fama)} PV` : ''}</span>
          <span title="Lujo"><${Glyph} type="lujo" size=${18}/> ${mine.lujo} lujo</span>
          ${s.ports && s.ports.length ? html`<span class="muted small">Banca: ${E.RES.map(r => `${E.RES_LABEL[r].slice(0, 3).toLowerCase()} ${E.rate(s, mine, r)}:1`).join(' · ')}</span>` : null}
        </div>
      </section>

      <section>
        <h4>Tu hueste</h4>
        <div class="guard">${[0, 1, 2, 3].map(r => html`<div key=${r} class="gslot" title=${E.RARITY[r].text}>
          <${HeroToken} color=${mine.color} rarity=${r} size=${44} faded=${!mine.guard[r]}/>
          <b>${mine.guard[r]}</b><span>${E.RARITY[r].name}</span><small>d${E.RARITY[r].die} · ${E.freeTokens(mine, r)} libres</small>
        </div>`)}</div>
        ${mine.exp ? html`<p class="expnote">${mine.exp.pending ? `Tu grupo (${E.partyText(mine.exp.party)}) se perdió siguiendo un señuelo: ataca al comienzo de tu próximo turno.` : `Tu grupo (${E.partyText(mine.exp.party)}) ocupa un pueblo de ${nameOf(s.buildings[mine.exp.target].owner)} hace ${mine.exp.rounds} ronda(s). A las 3 lo arrasa.`}</p>` : null}
        <div class="fuse">${[0, 1, 2].map(r => { const why = E.fuseCheck(mine, r); return html`<button key=${r} class="act" disabled=${!canMain || !!why} title=${why || ''} onClick=${() => run(st => E.fuse(st, r))}>
          <b>2 ${E.RARITY[r].plural} → 1 ${E.RARITY[r + 1].name.toLowerCase()}</b><small>${E.RARITY[r + 1].fuse} lujo</small></button>`; })}</div>
      </section>

      <section>
        <h4>Acciones</h4>
        <div class="actions">
          ${BUILD.map(([k, l]) => html`<button key=${k} class=${'act' + (mode === k ? ' on' : '')} disabled=${!canMain || !E.canAfford(mine, s.COST[k])} onClick=${() => setMode(mode === k ? null : k)}><b>${l}</b><small>${costText(s.COST[k])}</small></button>`)}
          <button class="act" disabled=${!canMain || !E.canAfford(mine, s.COST.heroe) || E.freeTokens(mine, 0) < 1} onClick=${() => run(E.recruit)}><b>Reclutar común</b><small>${E.freeTokens(mine, 0) < 1 ? 'sin fichas comunes' : costText(s.COST.heroe)}</small></button>
          <button class="act" disabled=${!canMain || !E.canAfford(mine, s.COST.desarrollo)} onClick=${() => { const r = run(E.buyDev); if (r.ok && r.card) setReveal({ kind: 'dev', id: r.card }); }}><b>Desarrollo</b><small>${costText(s.COST.desarrollo)}</small></button>
          ${s.P.asalto ? html`<button class="act" disabled=${!canMain || !!s.turn.asalto || !E.canRaid(s, me) || !E.canAfford(mine, s.P.asalto)} onClick=${() => run(E.callRaid)}><b>Asalto</b><small>${costText(s.P.asalto)} · sin 7</small></button>` : null}
          <button class="act" disabled=${!canMain || !occupiedMine.length || s.turn.expelled || !E.total(mine.guard)} onClick=${() => setMode(mode === 'expel' ? null : 'expel')}><b>Expulsar</b><small>${occupiedMine.length ? 'tu guardia ataca' : 'sin invasores'}</small></button>
          <button class="act" disabled=${!canMain} onClick=${() => setDialog({ type: 'trade' })}><b>Comerciar</b><small>banca, pasajes y señores</small></button>
        </div>
      </section>

      ${mine.dev.length || mine.devNew.length || myTraps.length ? html`<section>
        <h4>Tus cartas</h4>
        <div class="cards">
          ${mine.dev.map((c, i) => html`<${Card} key=${'d' + i} kind="dev" id=${c} w=${92} onClick=${c === 'reliquia' || !(myTurn && (s.phase === 'main' || s.phase === 'roll')) || s.turn.devPlayed ? null : () => {
            if (c === 'veta') return setDialog({ type: 'veta', pick: [] });
            if (c === 'ascension' && mine.guard[1] && mine.guard[2]) return setDialog({ type: 'ascension' });
            run(st => E.playDev(st, c));
          }}/>`)}
          ${mine.devNew.map((c, i) => html`<div key=${'n' + i} class="newcard"><${Card} kind="dev" id=${c} w=${92} dim/><span>nueva</span></div>`)}
        </div>
        ${myTraps.length ? html`<p class="muted small">Trampas escondidas (solo vos las ves):</p>
          <div class="cards">${myTraps.flatMap(([v, arr]) => arr.map((t, i) => html`<div key=${v + '-' + i} class="trapcard"><${Card} kind="trampa" id=${t} w=${80}/><span>${s.buildings[v] ? BLD_NAME[s.buildings[v].type] : ''} ${v}</span></div>`))}</div>` : null}
      </section>` : null}`}

      <section>
        <h4>Señores</h4>
        <div class="players">${s.players.map(p => {
          const tit = Object.keys(s.titles).filter(k => s.titles[k] === p.id);
          const away = online && !p.bot && p.uid && session.present && !session.present.has(p.uid);
          return html`<div key=${p.id} class=${'pl' + (waitingFor === p.id ? ' cur' : '')}>
            <div class="pn"><i class="dot" style=${{ background: p.color }}></i><b>${pname(p.id)}</b>${p.bot ? html`<span class="tag ghosty">bot · ${E.PERSONAS[p.persona].name.toLowerCase()}</span>` : away ? html`<span class="tag ghosty">desconectado</span>` : null}<span class="pv">${p.id === me ? E.pv(s, p.id) : E.pvPublic(s, p.id)} PV</span></div>
            <div class="pd">
              <span>${E.handSize(p)} cartas</span><span>${p.dev.length + p.devNew.length} desarrollo</span><span>${E.total(p.guard)} en guardia</span><span>${p.fama} fama</span><span>${p.lujo} lujo</span>
            </div>
            <div class="pguard">${[3, 2, 1, 0].filter(r => p.guard[r]).map(r => html`<span key=${r}><${HeroToken} color=${p.color} rarity=${r} size=${16}/>×${p.guard[r]}</span>`)}</div>
            ${p.exp ? html`<div class="pexp"><${HeroToken} color=${p.color} n=${E.total(p.exp.party)} rarity=${[3, 2, 1, 0].find(r => p.exp.party[r]) || 0} size=${18} faded=${p.exp.pending}/> ${p.exp.pending ? 'demorado rumbo a' : 'saqueando a'} ${pname(s.buildings[p.exp.target].owner)}${p.exp.pending ? '' : ' · ronda ' + (p.exp.rounds + 1)}</div>` : null}
            ${tit.length ? html`<div class="ptit">${tit.map(k => html`<span key=${k} class="tag">${E.TITLES[k].name}</span>`)}</div>` : null}
          </div>`;
        })}</div>
      </section>

      <section>
        <h4>Crónica</h4>
        <ol class="log">${s.log.slice(-60).reverse().map((l, i) => html`<li key=${s.log.length - i}>${l.pid !== null ? html`<b style=${{ color: s.players[l.pid].color }}>${lname(l.pid)}</b> ` : null}${l.msg}</li>`)}</ol>
        ${session.newGame ? html`<button class="btn ghost" onClick=${() => { session.newGame(); setQueue([]); setMsg(''); setDialog(null); setReveal(null); }}>Nueva partida</button>` : null}
      </section>
    </aside>

    ${myDecision ? html`<${DecisionModal} session=${session}/>` : null}
    ${!myDecision && ev && (ev.type === 'combate' || ev.type === 'expulsion') ? html`<${Modal} title=${ev.type === 'expulsion' ? 'Expulsión' : ev.attacker === me ? 'Tu saqueo' : ev.defender === me ? '¡Te saquean!' : 'Saqueo'} onClose=${() => setQueue(q => q.slice(1))}><${CombatView} s=${s} ev=${ev} me=${me} nameOf=${nameOf}/></${Modal}>` : null}
    ${!myDecision && ev && ev.type === 'demora' ? html`<${Modal} title=${ev.attacker === me ? 'Tus héroes se pierden' : 'El señuelo funcionó'} onClose=${() => setQueue(q => q.slice(1))}>
      <div class="center"><div class="flip"><${Card} kind="trampa" id="senuelo" w=${150}/></div></div>
      <p class="sub center">${ev.attacker === me ? `Tu grupo (${E.partyText(ev.party)}) siguió pistas falsas. Atacará al comienzo de tu próximo turno; el defensor tiene una vuelta para prepararse.` : `${nameOf(ev.attacker)} mandó ${E.partyText(ev.party)} contra ${ev.defender === me ? 'tu pueblo' : 'un pueblo de ' + nameOf(ev.defender)}, pero se perdieron. Atacan al comienzo de su próximo turno.`}</p>
    </${Modal}>` : null}
    ${!myDecision && ev && ev.type === 'arrasar' ? html`<${Modal} title=${ev.attacker === me ? 'Arrasaste un pueblo' : ev.defender === me ? 'Arrasaron tu pueblo' : 'Pueblo arrasado'} onClose=${() => setQueue(q => q.slice(1))}>
      <div class="center"><img class="ruins" src=${SPR('ruinas')} alt="Ruinas de un pueblo"/></div>
      <p class="sub center">${ev.attacker === me ? 'Tu grupo sostuvo la ocupación tres rondas: la cripta baja a campamento y pierde sus defensas. Ganás 2 de fama y 2 de lujo.' : `Los héroes de ${nameOf(ev.attacker)} se quedaron tres rondas. La cripta baja a campamento y pierde muralla y trampas; los campamentos no se destruyen.`}</p>
    </${Modal}>` : null}
    ${!myDecision && ev && ev.type === 'permanencia' ? html`<${Modal} title=${'Fin de la ronda ' + ev.round} onClose=${() => setQueue(q => q.slice(1))}>
      <p class="sub">Cada grupo tira 1d20 + su permanencia (común 1, raro 2, épico 3, legendario 2 por héroe) contra 10 + distancia + muralla + 2 por ronda ocupada.</p>
      ${ev.results.filter(r => spectator || r.pid === me || r.owner === me).map((r, i) => html`<div key=${i} class="permrow"><${Die} d20 v=${r.roll} size=${40}/><div>${r.rerolled ? html`<span class="muted small">El legendario repitió un ${r.rerolled}. </span>` : null}<b style=${{ color: s.players[r.pid].color }}>${pname(r.pid)}</b> en ${r.owner === me ? 'tu pueblo' : 'el pueblo de ' + pname(r.owner)}: ${r.total} contra ${r.dc}. <span class=${r.stay ? 'win' : 'lose'}>${r.stay ? 'El grupo se queda.' : 'El grupo vuelve a casa.'}</span></div></div>`)}
    </${Modal}>` : null}
    ${reveal ? html`<${Modal} title=${reveal.kind === 'trampa' ? 'Trampa colocada' : 'Carta de desarrollo'} onClose=${() => setReveal(null)}>
      <div class="center"><div class="flip"><${Card} kind=${reveal.kind} id=${reveal.id} w=${170}/></div></div>
      <p class="sub center">${reveal.kind === 'trampa' ? 'Queda boca abajo. Los demás solo ven que hay una trampa.' : 'Podés jugarla desde el próximo turno.'}</p>
    </${Modal}>` : null}
    ${dialog && dialog.type === 'trade' ? html`<${TradeDialog} session=${session} onClose=${() => setDialog(null)}/>` : null}
    ${dialog && dialog.type === 'veta' ? html`<${Modal} title="Veta oculta: elegí 2 recursos">
      <div class="tradegrid one">${E.RES.map(r => html`<button key=${r} class="opt" onClick=${() => { const pick = dialog.pick.concat(r); if (pick.length === 2) { run(st => E.playDev(st, 'veta', pick)); setDialog(null); } else setDialog({ ...dialog, pick }); }}>${E.RES_LABEL[r]}</button>`)}</div>
      <p class="small muted">Elegidos: ${dialog.pick.map(r => E.RES_LABEL[r]).join(', ') || 'ninguno'}</p>
      <div class="mrow"><button class="btn ghost" onClick=${() => setDialog(null)}>Cancelar</button></div>
    </${Modal}>` : null}
    ${dialog && dialog.type === 'ascension' ? html`<${Modal} title="Ascensión: ¿qué héroe asciende?">
      <div class="mrow">${[2, 1].map(r => html`<button key=${r} class="btn" onClick=${() => { run(st => E.playDev(st, 'ascension', r)); setDialog(null); }}><${HeroToken} color=${mine.color} rarity=${r} size=${30}/> Tu ${E.RARITY[r].name.toLowerCase()}</button>`)}</div>
      <div class="mrow"><button class="btn ghost" onClick=${() => setDialog(null)}>Cancelar</button></div>
    </${Modal}>` : null}
    ${s.winner !== null && !queue.length && !myDecision ? html`<${Modal} title=${s.winner === me ? 'Ganaste' : nameOf(s.winner) + ' gana'} onClose=${session.newGame ? () => { session.newGame(); setQueue([]); } : onExit} closeLabel=${session.newGame ? 'Nueva partida' : 'Volver a las salas'}>
      <p class="sub">${pname(s.winner)} llegó a ${E.pv(s, s.winner)} PV en la ronda ${s.round}.</p>
      <div class="final">${s.players.map(p => html`<div key=${p.id}><i class="dot" style=${{ background: p.color }}></i>${pname(p.id)}: <b>${E.pv(s, p.id)} PV</b> · ${p.stats.exitos}/${p.stats.saqueos} saqueos · ${p.fama} fama</div>`)}</div>
    </${Modal}>` : null}
  </div>`;
}

function LocalGame() {
  const session = useLocalSession();
  return html`<${Game} session=${session}/>`;
}
