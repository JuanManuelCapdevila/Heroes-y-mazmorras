/* Interfaz del prototipo: tablero y piezas compartidas. */
const { useState, useRef, useEffect, useMemo, useCallback } = React;
const E = Engine;
const S = 58; // escala del tablero

const HEX_FILL = { madera: '#3d6a3b', ladrillo: '#9b5034', lana: '#86ad57', trigo: '#cfa646', mineral: '#6c7385', desierto: '#b09670' };
const HEX_INK = { madera: '#a9d39a', ladrillo: '#f1b89c', lana: '#e3f3c9', trigo: '#fff0c2', mineral: '#d9dde8', desierto: '#f0e2c8' };
const RES_ICON = {
  madera: c => html`<g fill=${c}><path d="M-.5 .35 L-.28 -.25 L-.06 .35 Z"/><path d="M0 .35 L.26 -.4 L.52 .35 Z"/></g>`,
  ladrillo: c => html`<g fill=${c}><rect x="-.45" y="0" width=".42" height=".2"/><rect x=".03" y="0" width=".42" height=".2"/><rect x="-.21" y="-.26" width=".42" height=".2"/></g>`,
  lana: c => html`<g fill=${c}><circle cx="-.2" cy=".05" r=".2"/><circle cx=".05" cy="-.08" r=".24"/><circle cx=".28" cy=".06" r=".18"/></g>`,
  trigo: c => html`<g stroke=${c} stroke-width=".07" stroke-linecap="round" fill="none"><path d="M-.25 .35 Q-.3 0 -.2 -.35"/><path d="M0 .38 V-.42"/><path d="M.25 .35 Q.3 0 .2 -.35"/></g>`,
  mineral: c => html`<g fill=${c}><path d="M-.55 .3 L-.15 -.35 L.2 .3 Z"/><path d="M0 .3 L.3 -.15 L.55 .3 Z" opacity=".75"/></g>`,
  desierto: c => html`<path d="M-.5 .2 Q-.2 -.15 .1 .15 T.5 .05" fill="none" stroke=${c} stroke-width=".07"/>`,
};

// ---------- tablero ----------
const TW = Math.sqrt(3) * S * 1.06, TH = 2 * S * 1.06;
function Port({ s, pt }) {
  const { vertices } = s.board;
  const A = vertices[pt.a], B = vertices[pt.b];
  const mx = (A.x + B.x) / 2 * S, my = (A.y + B.y) / 2 * S;
  const len = Math.hypot(mx, my) || 1, ox = mx + mx / len * 26, oy = my + my / len * 26;
  const generic = pt.type === '3:1';
  const col = generic ? '#d9a441' : HEX_FILL[pt.type];
  return html`<g aria-label=${generic ? 'Pasaje 3 a 1' : 'Pasaje 2 a 1 de ' + E.RES_LABEL[pt.type].toLowerCase()}>
    <line x1=${A.x * S} y1=${A.y * S} x2=${ox} y2=${oy} stroke=${col} stroke-width="2.5" stroke-dasharray="3 3" opacity=".85"/>
    <line x1=${B.x * S} y1=${B.y * S} x2=${ox} y2=${oy} stroke=${col} stroke-width="2.5" stroke-dasharray="3 3" opacity=".85"/>
    <circle cx=${ox} cy=${oy} r="14" fill="#17141f" stroke=${col} stroke-width="2.5"/>
    ${generic ? null : html`<g transform=${`translate(${ox} ${oy - 4}) scale(11)`}>${RES_ICON[pt.type](HEX_INK[pt.type])}</g>`}
    <text x=${ox} y=${oy + (generic ? 4 : 10)} text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size=${generic ? 10.5 : 8.5} font-weight="500" fill="#ece6dc">${generic ? '3:1' : '2:1'}</text>
  </g>`;
}
function Board({ s, targets, onPick }) {
  const { hexes, vertices, edges } = s.board;
  const vt = new Set(targets.kind === 'v' ? targets.ids : []);
  const et = new Set(targets.kind === 'e' ? targets.ids : []);
  const info = targets.info || {};
  return html`<svg class="board" viewBox="-320 -285 640 570" role="img" aria-label="Tablero">
    <defs>
      <radialGradient id="fade" cx="50%" cy="50%" r="52%"><stop offset=".72" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient>
      <mask id="bgmask" maskUnits="userSpaceOnUse" x="-320" y="-285" width="640" height="570"><rect x="-320" y="-285" width="640" height="570" fill="url(#fade)"/></mask>
      <filter id="tshadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity=".55"/></filter>
    </defs>
    <g mask="url(#bgmask)"><image href=${SPR('fondo-tablero')} x="-650" y="-386" width="1348" height="792" preserveAspectRatio="none" opacity=".95"/></g>
    ${(s.ports || []).map((pt, i) => html`<${Port} key=${'p' + i} s=${s} pt=${pt}/>`)}
    ${hexes.map(h => {
      const pts = h.v.map(id => `${vertices[id].x * S},${vertices[id].y * S}`).join(' ');
      const hot = h.num && s.dice && s.dice[0] + s.dice[1] === h.num;
      return html`<g key=${'h' + h.id}>
        <polygon points=${pts} fill=${HEX_FILL[h.res]} opacity=".5"/>
        <image href=${SPR('terreno-' + h.res)} x=${h.x * S - TW / 2} y=${h.y * S - TH / 2} width=${TW} height=${TH} preserveAspectRatio="xMidYMid meet"/>
        ${hot ? html`<polygon points=${pts} fill="#f1d27a" fill-opacity=".12" stroke="#f1d27a" stroke-width="4" opacity=".95"/>` : null}
        <g transform=${`translate(${h.x * S} ${h.y * S - 27})`}><circle r="10" fill=${HEX_FILL[h.res]} stroke="#120d1c" stroke-width="2"/><g transform=${`scale(${S * 0.23})`}>${RES_ICON[h.res](HEX_INK[h.res])}</g></g>
        ${h.num ? html`<g transform=${`translate(${h.x * S} ${h.y * S + 8})`}>
          <circle r="16" fill="#ece6dc" stroke="#17141f" stroke-width="2"/>
          <text y="5" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="15" font-weight="500" fill=${h.num === 6 || h.num === 8 ? '#a8322b' : '#17141f'}>${h.num}</text>
          <g>${Array.from({ length: E.pips(h.num) }, (_, i) => html`<circle key=${i} cx=${(i - (E.pips(h.num) - 1) / 2) * 4} cy="10" r="1.3" fill=${h.num === 6 || h.num === 8 ? '#a8322b' : '#17141f'}/>`)}</g>
        </g>` : null}
      </g>`;
    })}
    ${edges.filter(e => s.roads[e.id] !== undefined).map(e => {
      const a = vertices[e.a], b = vertices[e.b];
      const c = s.players[s.roads[e.id]].color;
      const x1 = a.x * S + (b.x - a.x) * S * .14, y1 = a.y * S + (b.y - a.y) * S * .14, x2 = b.x * S - (b.x - a.x) * S * .14, y2 = b.y * S - (b.y - a.y) * S * .14;
      return html`<g key=${'r' + e.id}><line x1=${x1} y1=${y1} x2=${x2} y2=${y2} stroke="#120d1c" stroke-width="11" stroke-linecap="round"/><line x1=${x1} y1=${y1} x2=${x2} y2=${y2} stroke=${c} stroke-width="6.5" stroke-linecap="round"/></g>`;
    })}
    ${edges.filter(e => et.has(e.id)).map(e => {
      const a = vertices[e.a], b = vertices[e.b];
      return html`<g key=${'te' + e.id} class="pick" onClick=${() => onPick(e.id)} tabindex="0" role="button" aria-label="Elegir este borde" onKeyDown=${ev => (ev.key === 'Enter' || ev.key === ' ') && onPick(e.id)}>
        <line x1=${a.x * S} y1=${a.y * S} x2=${b.x * S} y2=${b.y * S} stroke="transparent" stroke-width="18"/>
        <line class="pulse" x1=${a.x * S} y1=${a.y * S} x2=${b.x * S} y2=${b.y * S} stroke="#f1d27a" stroke-width="5" stroke-dasharray="6 5" stroke-linecap="round"/>
      </g>`;
    })}
    ${Object.keys(s.buildings).map(Number).map(vid => {
      const b = s.buildings[vid], v = vertices[vid], owner = s.players[b.owner];
      const nt = (owner.traps[vid] || []).length;
      const thr = E.threatOf(s, vid);
      const tp = thr !== null ? s.players[thr] : null;
      const best = tp ? [3, 2, 1, 0].find(r => tp.exp.party[r] > 0) : 0;
      const sz = (b.type === 'cripta' ? 50 : 42) * (b.muralla ? .82 : 1);
      return html`<g key=${'b' + vid} transform=${`translate(${v.x * S} ${v.y * S})`}>
        <ellipse cx="0" cy=${sz * .3} rx=${sz * .5} ry=${sz * .2} fill=${owner.color} stroke="#120d1c" stroke-width="2"/>
        ${b.muralla ? html`<image href=${SPR('muralla')} x="-33" y="-26" width="66" height="56" preserveAspectRatio="xMidYMid meet" filter="url(#tshadow)"/>` : null}
        <image href=${SPR(b.type)} x=${-sz / 2} y=${-sz * .62} width=${sz} height=${sz} preserveAspectRatio="xMidYMid meet" filter="url(#tshadow)"/>
        <g transform=${`translate(${-sz * .42} ${-sz * .58})`}><line x1="0" y1="0" x2="0" y2="16" stroke="#120d1c" stroke-width="2"/><path d="M1 0 L13 4 L1 8 Z" fill=${owner.color} stroke="#120d1c" stroke-width="1.3"/></g>
        ${nt ? html`<g transform=${`translate(${sz * .5} ${-sz * .55})`}>${Array.from({ length: nt }, (_, i) => html`<path key=${i} d=${`M${i * 9} -5 L${i * 9 + 5} 0 L${i * 9} 5 L${i * 9 - 5} 0 Z`} fill="#2d1f45" stroke="#cbb5ee" stroke-width="1.5"/>`)}</g>` : null}
        ${tp ? html`<g transform=${`translate(${-4} ${-6})`} class=${tp.exp.pending ? 'pulse' : ''}>${HeroToken({ color: tp.color, n: E.total(tp.exp.party), size: 30, rarity: best || 0, faded: tp.exp.pending })}</g>` : null}
      </g>`;
    })}
    ${vertices.filter(v => vt.has(v.id)).map(v => html`<g key=${'tv' + v.id} class="pick" transform=${`translate(${v.x * S} ${v.y * S})`} onClick=${() => onPick(v.id)} tabindex="0" role="button" aria-label=${info[v.id] ? 'Objetivo: ' + info[v.id] : 'Elegir este vértice'} onKeyDown=${ev => (ev.key === 'Enter' || ev.key === ' ') && onPick(v.id)}>
      <circle r="17" fill="transparent"/>
      <circle class="pulse" r="11" fill="#f1d27a" fill-opacity=".25" stroke="#f1d27a" stroke-width="2.5"/>
      ${info[v.id] ? html`<g transform="translate(0 -26)"><rect x=${-(info[v.id].length * 3.3 + 6)} y="-11" width=${info[v.id].length * 6.6 + 12} height="18" rx="4" fill="#120d1c" opacity=".9"/><text y="2.5" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="10.5" fill="#f1d27a">${info[v.id]}</text></g>` : null}
    </g>`)}
  </svg>`;
}

// ---------- piezas del panel ----------
function ResChip({ r, n }) {
  return html`<div class="res" title=${E.RES_LABEL[r]}><span class="sw" style=${{ background: HEX_FILL[r] }}><svg viewBox="-.7 -.6 1.4 1.2" width="20" height="18">${RES_ICON[r](HEX_INK[r])}</svg></span><span class="rl">${E.RES_LABEL[r]}</span><b>${n}</b></div>`;
}
function costText(c) { return Object.entries(c).map(([r, n]) => (n > 1 ? n + ' ' : '') + E.RES_LABEL[r].toLowerCase()).join(' · '); }
function bundleText(o) { return Object.entries(o).filter(([, n]) => n > 0).map(([r, n]) => `${n} ${E.RES_LABEL[r].toLowerCase()}`).join(' y ') || 'nada'; }

function Modal({ title, children, onClose, closeLabel = 'Continuar', wide }) {
  const ref = useRef(null);
  useEffect(() => { ref.current && ref.current.focus(); }, []);
  return html`<div class="scrim" role="dialog" aria-modal="true" aria-label=${title}>
    <div class=${'modal' + (wide ? ' wide' : '')}><h3>${title}</h3>${children}
      ${onClose ? html`<div class="mrow"><button ref=${ref} class="btn primary" onClick=${onClose}>${closeLabel}</button></div>` : null}
    </div></div>`;
}

function PartyRow({ party, color, size = 40 }) {
  return html`<div class="party">${[3, 2, 1, 0].flatMap(r => Array.from({ length: party[r] || 0 }, (_, i) => html`<${HeroToken} key=${r + '-' + i} color=${color} rarity=${r} size=${size}/>`))}</div>`;
}

function CombatView({ s, ev, me, nameOf }) {
  const atk = s.players[ev.attacker], def = s.players[ev.defender];
  const isExp = ev.type === 'expulsion';
  const nm = id => id === me ? 'Vos' : nameOf(id);
  const b = s.buildings[ev.vid];
  return html`<div class="combat">
    <p class="sub">${isExp
      ? (atk.id === me ? `Intentás expulsar a los héroes de ${nameOf(def.id)}.` : def.id === me ? `${nameOf(atk.id)} intenta expulsar a tus héroes.` : `${nameOf(atk.id)} intenta expulsar a los héroes de ${nameOf(def.id)}.`)
      : `${atk.id === me ? 'Enviás' : nameOf(atk.id) + ' envía'} ${E.partyText(ev.sent)} contra ${def.id === me ? 'uno de tus pueblos' : 'un pueblo de ' + nameOf(def.id)}${b ? ' (' + b.type + ')' : ''}, a ${ev.dist} ${ev.dist === 1 ? 'hexágono' : 'hexágonos'}.`}</p>
    ${!isExp ? html`<${PartyRow} party=${ev.sent} color=${atk.color} size=${44}/>` : null}
    ${!isExp ? html`<div class="trapsrow">${ev.traps.length ? ev.traps.map((t, i) => html`<div key=${i} class="flip" style=${{ animationDelay: i * 0.35 + 's' }}><${Card} kind="trampa" id=${t} w=${118}/></div>`) : html`<p class="muted">El pueblo no tenía trampas.</p>`}</div>` : null}
    ${ev.steps.map((t, i) => html`<p key=${i} class="step">${t}</p>`)}
    ${ev.dice ? html`<div class="dicecmp">
      <div><span class="lbl" style=${{ color: atk.color }}>${nm(atk.id)}</span><div class="dice">${ev.dice.A.map((d, i) => html`<${Die} key=${i} v=${d.v} sides=${d.n} size=${34}/>`)}</div></div>
      <div><span class="lbl" style=${{ color: def.color }}>${nm(def.id)}</span><div class="dice">${ev.dice.D.map((d, i) => html`<${Die} key=${i} v=${d.v} sides=${d.n} size=${34}/>`)}</div></div>
    </div>` : null}
    <p class=${'verdict ' + (ev.success ? 'win' : 'lose')}>${isExp ? (ev.success ? 'Los invasores se retiran.' : 'Los invasores resisten.') : (ev.success ? `Saqueo exitoso: el grupo ocupa el pueblo${ev.stolenAll && ev.stolenAll.length ? ' y roba ' + ev.stolenAll.map(r => E.RES_LABEL[r].toLowerCase()).join(', ') : ''}.` : 'El saqueo fracasa.')}</p>
  </div>`;
}
