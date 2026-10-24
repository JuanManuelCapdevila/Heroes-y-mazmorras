/* Multijugador: salas, asientos y arranque de partidas. */
const ONLINE_BOT_NAMES = ['Morgrath', 'Ylsa la Gris', 'Barón Cieno', 'Vesna Ceniza'];
const TURN_OPTS = [60, 90, 120, 180], DEC_OPTS = [20, 30, 45];
const newCode = () => Array.from({ length: 5 }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 31)]).join('');
const seatLabel = (x, names, uid) => x.bot ? `Bot · ${E.PERSONAS[x.persona].name.toLowerCase()}` : x.uid ? (x.uid === uid ? 'Vos' : names[x.uid] || 'Jugador') : 'Libre';

function OnlineGame({ code, onExit }) {
  const session = useOnlineSession(code);
  const [c, setC] = useState(null);
  useEffect(() => { caps().then(setC); }, []);
  // el anfitrión marca la sala como terminada
  useEffect(() => {
    if (!c || !c.db || !session.s || session.s.winner === null || !session.botDriver) return;
    c.db.doc('salas/' + code).update({ estado: 'terminada' }).catch(() => { });
  }, [c, session.s && session.s.winner, session.botDriver]);
  if (!session.s) return html`<p class="loading">${session.err || 'Cargando la partida…'}</p>`;
  return html`<${Game} session=${session} onExit=${onExit}/>`;
}

function Online() {
  const [c, setC] = useState(null);
  const [salas, setSalas] = useState([]);
  const [code, setCode] = useState(null);
  const [sala, setSala] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [msg, setMsg] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { caps().then(setC); }, []);
  useEffect(() => {
    if (!c || !c.db) return;
    const unsub = c.db.collection('salas').orderBy('creada', 'desc').limit(40).onSnapshot(
      snap => setSalas(snap.docs.map(d => d.data()).filter(x => x && x.estado !== 'cerrada')),
      () => setMsg('No se pudo leer la lista de salas.'));
    return unsub;
  }, [c]);
  useEffect(() => {
    if (!c || !c.db || !code) { setSala(null); return; }
    const unsub = c.db.doc('salas/' + code).onSnapshot(snap => setSala(snap.exists ? snap.data() : null), () => setMsg('Se perdió la conexión con la sala.'));
    return unsub;
  }, [c, code]);
  const allUids = [...new Set(salas.concat(sala ? [sala] : []).flatMap(x => (x.seats || []).map(y => y.uid)).concat(salas.map(x => x.host)).filter(Boolean))];
  const names = useProfiles(allUids);

  if (!c) return html`<p class="loading">Conectando…</p>`;
  if (!c.db || !c.uid) return html`<section class="lobby"><h2>Jugar en línea</h2>
    <p class="lead">El juego en línea necesita la base compartida de esta página y saber quién sos, y esta vista no los ofrece. Abrí la página desde claude.ai con tu cuenta.</p>
    <p class="lead">Para que otras personas jueguen, compartila con ellas como <b>Colaborador</b> (Contributor) desde el menú Compartir: con permiso de solo lectura pueden mirar, pero no jugar.</p></section>`;

  const uid = c.uid;
  const salaRef = cd => c.db.doc('salas/' + cd);
  async function mutate(cd, fn) {
    setBusy(true); setMsg('');
    try {
      await withLease(salaRef(cd), uid, async () => {
        const snap = await salaRef(cd).get();
        if (!snap.exists) throw new Error('La sala ya no existe.');
        const d = JSON.parse(JSON.stringify(snap.data()));
        const res = fn(d);
        if (res === false) return;
        await salaRef(cd).set(d);
      });
    } catch (e) { setMsg(e && e.code === 'invalid_argument' ? 'No tenés permiso para cambiar salas. Pedí acceso de Colaborador.' : (e && e.message) || 'No se pudo actualizar la sala.'); }
    setBusy(false);
  }
  async function create() {
    setBusy(true); setMsg('');
    const cd = newCode();
    const d = { code: cd, host: uid, estado: 'espera', creada: Date.now(), timers: { turno: 90, decision: 30 },
      seats: [{ uid, bot: false }, { bot: true, persona: 'saqueador' }, { uid: null, bot: false }, { uid: null, bot: false }] };
    try { await salaRef(cd).set(d); setCode(cd); } catch (e) { setMsg(e && e.code === 'invalid_argument' ? 'No tenés permiso para crear salas. Pedí acceso de Colaborador.' : e && e.code === 'quota_exceeded' ? 'Hay demasiadas salas guardadas.' : 'No se pudo crear la sala.'); }
    setBusy(false);
  }
  async function start() {
    const d = sala;
    if (d.seats.some(x => !x.bot && !x.uid)) return setMsg('Completá los asientos libres con jugadores o bots.');
    setBusy(true); setMsg('');
    try {
      const seats = d.seats.map((x, i) => x.bot ? { bot: true, persona: x.persona, name: ONLINE_BOT_NAMES[i] } : { bot: false, uid: x.uid });
      const s = E.createGame({ seed: (Math.random() * 1e9) | 0, seats, P: { online: true, timers: d.timers } });
      await c.db.doc('partidas/' + d.code).set({ json: JSON.stringify(s), version: 1, deadline: Date.now() + d.timers.turno * 1000, actualizada: Date.now() });
      await mutate(d.code, x => { x.estado = 'jugando'; x.inicio = Date.now(); });
      setPlaying(true);
    } catch (e) { setMsg('No se pudo empezar la partida.'); }
    setBusy(false);
  }

  if (code && sala && playing) return html`<${OnlineGame} code=${code} onExit=${() => setPlaying(false)}/>`;

  if (code && sala) {
    const isHost = sala.host === uid;
    const mySeat = sala.seats.findIndex(x => x.uid === uid);
    return html`<section class="lobby">
      <div class="trow"><div><div class="eyebrow">Sala</div><h2 class="code">${sala.code}</h2></div><button class="btn ghost" onClick=${() => { setCode(null); setPlaying(false); }}>Volver a la lista</button></div>
      <p class="lead">Pasales este código a tus amigos. Necesitan tener la página compartida como Colaborador para sentarse.</p>
      <div class="seats">${sala.seats.map((x, i) => html`<div key=${i} class="seat">
        <i class="dot big" style=${{ background: E.COLORS[i] }}></i>
        <div class="seatname"><b>${seatLabel(x, names, uid)}</b>${x.uid && x.uid === sala.host ? html`<span class="tag">anfitrión</span>` : null}</div>
        <div class="seatbtns">
          ${sala.estado === 'espera' && !x.bot && !x.uid && mySeat < 0 ? html`<button class="btn" disabled=${busy} onClick=${() => mutate(sala.code, d => { if (d.seats[i].uid || d.seats[i].bot || d.seats.some(y => y.uid === uid)) { setMsg('Ese asiento ya se ocupó.'); return false; } d.seats[i] = { uid, bot: false }; })}>Sentarme</button>` : null}
          ${sala.estado === 'espera' && x.uid === uid && !isHost ? html`<button class="btn ghost" disabled=${busy} onClick=${() => mutate(sala.code, d => { d.seats[i] = { uid: null, bot: false }; })}>Levantarme</button>` : null}
          ${sala.estado === 'espera' && isHost && x.uid !== uid ? html`<select aria-label=${'Asiento ' + (i + 1)} disabled=${busy} value=${x.bot ? x.persona : x.uid ? 'humano' : 'libre'} onChange=${e => { const v = e.target.value; mutate(sala.code, d => { d.seats[i] = v === 'libre' ? { uid: null, bot: false } : { bot: true, persona: v }; }); }}>
            ${x.uid ? html`<option value="humano">${names[x.uid] || 'Jugador'}</option>` : null}
            <option value="libre">Libre</option>
            ${Object.keys(E.PERSONAS).map(k => html`<option key=${k} value=${k}>Bot · ${E.PERSONAS[k].name.toLowerCase()}</option>`)}
          </select>` : null}
        </div>
      </div>`)}</div>
      ${isHost && sala.estado === 'espera' ? html`<div class="timers">
        <label>Tiempo por turno <select value=${sala.timers.turno} onChange=${e => { const v = +e.target.value; mutate(sala.code, d => { d.timers.turno = v; }); }}>${TURN_OPTS.map(t => html`<option key=${t} value=${t}>${t} s</option>`)}</select></label>
        <label>Tiempo por decisión <select value=${sala.timers.decision} onChange=${e => { const v = +e.target.value; mutate(sala.code, d => { d.timers.decision = v; }); }}>${DEC_OPTS.map(t => html`<option key=${t} value=${t}>${t} s</option>`)}</select></label>
      </div>` : html`<p class="muted small">Turno: ${sala.timers.turno} s · Decisiones: ${sala.timers.decision} s. Si se acaba el tiempo, el juego decide por vos: pasa el turno, no gasta fama, reparte las bajas en los héroes más baratos y rechaza ofertas.</p>`}
      ${msg ? html`<p class="err" role="alert">${msg}</p>` : null}
      <div class="mrow">
        ${isHost && sala.estado === 'espera' ? html`<button class="btn primary" disabled=${busy} onClick=${start}>Empezar partida</button>` : null}
        ${sala.estado === 'jugando' || sala.estado === 'terminada' ? html`<button class="btn primary" onClick=${() => setPlaying(true)}>${mySeat >= 0 ? 'Entrar a la partida' : 'Mirar la partida'}</button>` : null}
        ${isHost ? html`<button class="btn ghost" disabled=${busy} onClick=${() => mutate(sala.code, d => { d.estado = 'cerrada'; }).then(() => setCode(null))}>Cerrar sala</button>` : null}
        ${sala.estado === 'espera' && !isHost ? html`<span class="muted small">Esperando a que el anfitrión empiece.</span>` : null}
      </div>
    </section>`;
  }

  return html`<section class="lobby">
    <h2>Jugar en línea</h2>
    <p class="lead">Creá una sala, invitá a tus amigos con el código y completá los asientos vacíos con bots. Cada turno tiene un tiempo límite; si alguien se desconecta, la partida sigue.</p>
    <div class="mrow">
      <button class="btn primary" disabled=${busy} onClick=${create}>Crear sala</button>
      <form class="joinform" onSubmit=${e => { e.preventDefault(); const cd = joinCode.trim().toLowerCase(); if (cd) { setCode(cd); setPlaying(false); } }}>
        <label for="joincode" class="small muted">Código</label>
        <input id="joincode" value=${joinCode} onInput=${e => setJoinCode(e.target.value)} placeholder="abc12" maxlength="8" autocomplete="off"/>
        <button class="btn" type="submit">Entrar</button>
      </form>
    </div>
    ${code && !sala ? html`<p class="err">No encontré la sala «${code}».</p>` : null}
    ${msg ? html`<p class="err" role="alert">${msg}</p>` : null}
    <h4 class="listhead">Salas recientes</h4>
    ${salas.length ? html`<ul class="salalist">${salas.map(x => html`<li key=${x.code}>
      <button class="salarow" onClick=${() => { setCode(x.code); setPlaying(false); }}>
        <b class="code">${x.code}</b>
        <span class="muted">${x.estado === 'espera' ? 'esperando jugadores' : x.estado === 'jugando' ? 'en juego' : 'terminada'}</span>
        <span class="seatdots">${x.seats.map((y, i) => html`<i key=${i} class=${'dot' + (y.bot || y.uid ? '' : ' empty')} style=${{ background: y.bot || y.uid ? E.COLORS[i] : 'transparent', borderColor: E.COLORS[i] }}></i>`)}</span>
        <span class="small muted">${names[x.host] ? 'de ' + names[x.host] : ''}</span>
      </button></li>`)}</ul>` : html`<p class="muted">Todavía no hay salas. Creá la primera.</p>`}
  </section>`;
}
