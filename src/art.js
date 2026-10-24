/* Arte: cartas y fichas en SVG (React + htm). */
const html = htm.bind(React.createElement);

const SPR = n => `art/${n}.webp`;
const TRAP_ART = { foso: 'trampa-foso', gas: 'trampa-gas', alarma: 'trampa-alarma', derrumbe: 'trampa-derrumbe', senuelo: 'trampa-senuelo' };
const CARD_ART = {
  trampa: TRAP_ART,
  dev: { leva: 'dev-leva', reliquia: 'dev-reliquia', veta: 'dev-veta' },
  titulo: { tunel: 'titulo-tunel', leyenda: 'titulo-leyenda', hueste: 'titulo-hueste' },
};
const FULL_ART = new Set(['dev-leva', 'dev-veta', 'titulo-tunel', 'titulo-leyenda']);
const HERO_ART = ['heroe-comun', 'heroe-raro', 'heroe-epico', 'heroe-legendario'];
const KIND = {
  trampa: { label: 'Trampa', a: '#2d1f45', b: '#170f26', frame: '#9d78d6', ink: '#efe7fb' },
  dev: { label: 'Desarrollo', a: '#3a2c12', b: '#1c140a', frame: '#d9a441', ink: '#f6ecd6' },
  titulo: { label: 'Título', a: '#2f2b26', b: '#171512', frame: '#d8cdb8', ink: '#f3eee4' },
};

// ---------- íconos (caja 0..100) ----------
const Ico = {
  foso: (c) => html`<g>
    <path d="M10 70 Q50 92 90 70 L90 78 Q50 100 10 78 Z" fill=${c} opacity=".35"/>
    ${[18, 30, 42, 54, 66, 78].map((x, i) => html`<path key=${i} d=${`M${x} 74 L${x + 5} ${36 + (i % 2) * 8} L${x + 10} 74 Z`} fill=${c}/>`)}
    <path d="M6 70 Q50 90 94 70" fill="none" stroke=${c} stroke-width="3"/></g>`,
  alarma: (c) => html`<g>
    <path d="M28 70 Q28 30 50 26 Q72 30 72 70 L80 78 L20 78 Z" fill=${c}/>
    <circle cx="50" cy="86" r="7" fill=${c}/><rect x="46" y="16" width="8" height="10" rx="3" fill=${c}/>
    <path d="M14 40 Q10 52 14 64 M86 40 Q90 52 86 64" fill="none" stroke=${c} stroke-width="4" stroke-linecap="round"/></g>`,
  gas: (c) => html`<g fill="none" stroke=${c} stroke-width="4" stroke-linecap="round">
    <path d="M14 34 Q26 24 38 34 T62 34 T86 34"/><path d="M8 54 Q20 44 32 54 T56 54 T80 54 T92 50"/><path d="M18 74 Q30 64 42 74 T66 74 T86 72"/></g>`,
  derrumbe: (c) => html`<g fill=${c}>
    <path d="M14 88 L30 64 L48 70 L56 88 Z" opacity=".9"/><path d="M50 88 L62 62 L84 66 L90 88 Z" opacity=".7"/>
    <path d="M40 40 L52 30 L62 38 L56 50 L44 50 Z"/><path d="M22 22 L32 16 L38 26 L30 32 Z" opacity=".8"/><path d="M66 14 L74 12 L78 22 L70 26 Z" opacity=".7"/></g>`,
  senuelo: (c) => html`<g>
    <rect x="18" y="44" width="64" height="40" rx="4" fill="none" stroke=${c} stroke-width="4"/>
    <path d="M18 52 Q18 28 50 28 Q82 28 82 52" fill="none" stroke=${c} stroke-width="4"/>
    <text x="50" y="76" text-anchor="middle" font-family="Grenze, serif" font-size="30" font-weight="700" fill=${c}>?</text></g>`,
  leva: (c) => html`<g>
    <path d="M24 54 Q24 20 50 20 Q76 20 76 54 L76 70 L60 70 L60 52 L40 52 L40 70 L24 70 Z" fill=${c}/>
    <rect x="46" y="10" width="8" height="14" fill=${c}/><path d="M18 80 L82 80 L76 90 L24 90 Z" fill=${c} opacity=".6"/></g>`,
  reliquia: (c) => html`<g fill=${c}>
    <path d="M26 18 L74 18 Q74 52 50 56 Q26 52 26 18 Z"/><rect x="46" y="56" width="8" height="18"/><path d="M32 86 Q50 72 68 86 Z"/>
    <circle cx="50" cy="32" r="6" fill="#1c140a"/></g>`,
  veta: (c) => html`<g>
    <path d="M30 80 L18 50 L34 26 L46 50 Z" fill=${c} opacity=".75"/><path d="M50 86 L36 46 L56 14 L72 46 Z" fill=${c}/>
    <path d="M70 84 L62 58 L76 40 L88 60 Z" fill=${c} opacity=".6"/></g>`,
  ascension: (c) => html`<g>
    <path d="M50 8 L58 30 L50 26 L42 30 Z" fill=${c}/><path d="M30 92 L50 40 L70 92" fill="none" stroke=${c} stroke-width="5" stroke-linejoin="round"/>
    <path d="M22 58 L50 44 L78 58" fill="none" stroke=${c} stroke-width="4" opacity=".7"/><path d="M14 76 L50 60 L86 76" fill="none" stroke=${c} stroke-width="4" opacity=".45"/>
    <circle cx="50" cy="40" r="6" fill=${c}/></g>`,
  tunel: (c) => html`<g fill="none" stroke=${c} stroke-width="5" stroke-linecap="round">
    <path d="M10 84 V58 Q10 38 28 38 Q46 38 46 58 V84"/><path d="M54 84 V48 Q54 22 72 22 Q90 22 90 48 V84"/><line x1="4" y1="86" x2="96" y2="86"/></g>`,
  leyenda: (c) => html`<g>
    <path d="M50 18 L58 40 L82 40 L63 54 L70 77 L50 63 L30 77 L37 54 L18 40 L42 40 Z" fill=${c}/>
    <path d="M14 60 Q16 86 44 92" fill="none" stroke=${c} stroke-width="3"/><path d="M86 60 Q84 86 56 92" fill="none" stroke=${c} stroke-width="3"/></g>`,
  hueste: (c) => html`<g>${[[22, 40], [50, 30], [78, 40]].map(([x, y], i) => html`<path key=${i} d=${`M${x - 14} ${y} L${x + 14} ${y} L${x + 14} ${y + 22} Q${x} ${y + 40} ${x - 14} ${y + 22} Z`} fill=${c} opacity=${i === 1 ? 1 : .7}/>`)}</g>`,
};

const CARD_TEXT = () => ({
  trampa: Engine.TRAPS, dev: Engine.DEV, titulo: Engine.TITLES,
});

function CardBack({ w = 120 }) {
  return html`<svg viewBox="0 0 250 350" width=${w} class="card" role="img" aria-label="Carta boca abajo">
    <defs><linearGradient id="bk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2140"/><stop offset="1" stop-color="#120d1c"/></linearGradient>
    <pattern id="bkp" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M12 2 L22 12 L12 22 L2 12 Z" fill="none" stroke="#9d78d6" stroke-opacity=".18" stroke-width="1.5"/></pattern></defs>
    <rect width="250" height="350" rx="16" fill="url(#bk)"/><rect width="250" height="350" rx="16" fill="url(#bkp)"/>
    <rect x="10" y="10" width="230" height="330" rx="10" fill="none" stroke="#9d78d6" stroke-width="2"/>
    <g transform="translate(125 175)">
      <circle r="52" fill="#170f26" stroke="#9d78d6" stroke-width="2"/>
      <path d="M-26 22 L-26 -4 Q-26 -30 0 -30 Q26 -30 26 -4 L26 22" fill="none" stroke="#d9a441" stroke-width="5"/>
      <path d="M-34 26 H34" stroke="#d9a441" stroke-width="5" stroke-linecap="round"/>
      <circle cy="-4" r="7" fill="#9d78d6"/>
    </g>
    <text x="125" y="300" text-anchor="middle" font-family="Grenze, serif" font-size="20" letter-spacing="3" fill="#b9a6dc">PROFUNDIDADES</text>
  </svg>`;
}

function Card({ kind, id, w = 150, cost, onClick, dim }) {
  const k = KIND[kind];
  const raw = CARD_TEXT()[kind][id];
  const data = { name: raw.name, text: typeof raw.text === 'function' ? raw.text(raw.min) : raw.text };
  const gid = `g-${kind}-${id}`;
  const art = (CARD_ART[kind] || {})[id];
  const foot = kind === 'titulo' ? '2 PV' : kind === 'trampa' ? 'madera · lana · ladrillo' : (id === 'reliquia' ? '1 PV oculto' : id === 'ascension' ? 'carta única' : 'lana · trigo · mineral');
  const svg = html`<svg viewBox="0 0 250 350" width=${w} class=${'card' + (dim ? ' dim' : '')} role="img" aria-label=${`${k.label}: ${data.name}`}>
    <defs><linearGradient id=${gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color=${k.a}/><stop offset="1" stop-color=${k.b}/></linearGradient></defs>
    <rect width="250" height="350" rx="16" fill=${`url(#${gid})`}/>
    <rect x="10" y="10" width="230" height="330" rx="10" fill="none" stroke=${k.frame} stroke-width="2"/>
    <rect x="10" y="10" width="230" height="34" rx="10" fill=${k.frame} opacity=".16"/>
    <text x="125" y="34" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="13" letter-spacing="3" fill=${k.frame}>${k.label.toUpperCase()}</text>
    ${art ? html`<g>
      ${FULL_ART.has(art) ? html`<g>
        <defs><clipPath id=${'cw-' + art}><rect x="20" y="46" width="210" height="160" rx="8"/></clipPath></defs>
        <image href=${SPR(art)} x="20" y="46" width="210" height="160" preserveAspectRatio="xMidYMid slice" clip-path=${`url(#cw-${art})`}/>
        <rect x="20" y="46" width="210" height="160" rx="8" fill="none" stroke=${k.frame} stroke-opacity=".7" stroke-width="1.5"/></g>`
      : html`<g><ellipse cx="125" cy="196" rx="86" ry="14" fill="#000" opacity=".35"/>
        <image href=${SPR(art)} x="22" y="42" width="206" height="166" preserveAspectRatio="xMidYMid meet"/></g>`}
      <text x="125" y="232" text-anchor="middle" font-family="Grenze, serif" font-weight="600" font-size="25" fill=${k.ink}>${data.name}</text>
      <foreignObject x="20" y="240" width="210" height="72">
        <div xmlns="http://www.w3.org/1999/xhtml" style=${{ font: '13.5px/1.25 "Alegreya Sans", sans-serif', color: k.ink, opacity: .88, textAlign: 'center' }}>${data.text}</div>
      </foreignObject></g>` : html`<g>
    <circle cx="125" cy="118" r="62" fill="#000" opacity=".22"/><circle cx="125" cy="118" r="62" fill="none" stroke=${k.frame} stroke-opacity=".5" stroke-width="1.5"/>
    <g transform="translate(83 76) scale(.84)">${Ico[id](k.frame)}</g>
    <text x="125" y="214" text-anchor="middle" font-family="Grenze, serif" font-weight="600" font-size="27" fill=${k.ink}>${data.name}</text>
    <foreignObject x="24" y="226" width="202" height="86">
      <div xmlns="http://www.w3.org/1999/xhtml" style=${{ font: '15px/1.3 "Alegreya Sans", sans-serif', color: k.ink, opacity: .86, textAlign: 'center' }}>${data.text}</div>
    </foreignObject></g>`}
    <line x1="40" y1="314" x2="210" y2="314" stroke=${k.frame} stroke-opacity=".35"/>
    <text x="125" y="331" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="11.5" fill=${k.frame}>${cost || foot}</text>
  </svg>`;
  return onClick ? html`<button class="cardbtn" onClick=${onClick} aria-label=${`Jugar ${data.name}`}>${svg}</button>` : svg;
}

// ---------- fichas ----------
const RCOL = ['#cfc8bb', '#6fb0e8', '#b48ae8', '#f1c24e'];
function HeroPortrait({ color = '#d8584e', n, size = 48, rarity = 0, faded }) {
  const t = RCOL[rarity];
  const label = (Engine.RARITY[rarity] || {}).name || '';
  return html`<svg viewBox="0 0 60 60" width=${size} height=${size} class="token" role="img" aria-label=${`Héroe ${label}${n !== undefined ? ': ' + n : ''}`} opacity=${faded ? .55 : 1}>
    <defs><clipPath id="hp-clip" clipPathUnits="userSpaceOnUse"><circle cx="30" cy="31" r="24"/></clipPath>
      <radialGradient id=${'hp-bg' + rarity} cx="50%" cy="40%" r="60%"><stop offset="0" stop-color=${t} stop-opacity=".55"/><stop offset="1" stop-color="#17141f"/></radialGradient></defs>
    <circle cx="30" cy="31" r="27" fill=${color} stroke="#120d1c" stroke-width="2"/>
    <circle cx="30" cy="31" r="24" fill=${`url(#hp-bg${rarity})`}/>
    <image href=${SPR(HERO_ART[rarity])} x="-6" y="5" width="72" height="79" clip-path="url(#hp-clip)" preserveAspectRatio="xMidYMin meet"/>
    <circle cx="30" cy="31" r="24" fill="none" stroke=${t} stroke-width=${rarity ? 2.2 : 1.2}/>
    ${rarity === 3 ? html`<path d="M18 7 L20 -1 L25 4 L30 -3 L35 4 L40 -1 L42 7 Z" fill=${t} stroke="#120d1c" stroke-width="1.3"/>` : null}
    ${n !== undefined ? html`<g><circle cx="50" cy="11" r="10" fill="#120d1c" stroke=${t} stroke-width="1.5"/><text x="50" y="15.5" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="13" font-weight="500" fill="#fff">${n}</text></g>` : null}
  </svg>`;
}
function HeroToken(props) {
  if ((props.size || 48) >= 26) return HeroPortrait(props);
  return HeroShield(props);
}
function HeroShield({ color = '#d8584e', n, size = 48, rarity = 0, faded }) {
  const t = RCOL[rarity];
  const label = (Engine.RARITY[rarity] || {}).name || '';
  return html`<svg viewBox="0 0 60 66" width=${size} height=${size * 66 / 60} class="token" role="img" aria-label=${`Héroe ${label}${n !== undefined ? ': ' + n : ''}`} opacity=${faded ? .5 : 1}>
    ${rarity === 2 ? html`<g fill=${t}><path d="M8 16 L-2 8 L2 26 Z"/><path d="M52 16 L62 8 L58 26 Z"/></g>` : null}
    <path d="M8 10 H52 V33 Q52 55 30 63 Q8 55 8 33 Z" fill=${color} stroke=${rarity ? t : '#120d1c'} stroke-width=${rarity ? 3.5 : 3}/>
    ${rarity ? html`<path d="M12.5 14 H47.5 V33 Q47.5 51 30 58" fill="none" stroke="#120d1c" stroke-width="1.2" opacity=".55"/>` : null}
    <path d="M30 18 V46 M22 26 H38" stroke="#120d1c" stroke-width="4" stroke-linecap="round"/>
    ${rarity === 1 ? html`<path d="M30 2 L36 9 L30 15 L24 9 Z" fill=${t} stroke="#120d1c" stroke-width="1.5"/>` : null}
    ${rarity === 3 ? html`<path d="M16 11 L18 -1 L24 6 L30 -3 L36 6 L42 -1 L44 11 Z" fill=${t} stroke="#120d1c" stroke-width="1.5"/>` : null}
    <g>${Array.from({ length: rarity + 1 }, (_, i) => html`<circle key=${i} cx=${30 + (i - rarity / 2) * 6} cy="52" r="1.9" fill="#120d1c"/>`)}</g>
    ${n !== undefined ? html`<g><circle cx="52" cy="14" r="10" fill="#120d1c" stroke=${t} stroke-width="1.5"/><text x="52" y="18.5" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="13" font-weight="500" fill="#fff">${n}</text></g>` : null}
  </svg>`;
}
function Glyph({ type, color = '#e9e3d5', size = 40 }) {
  const g = {
    cueva: html`<g><path d="M6 54 V30 Q6 8 30 8 Q54 8 54 30 V54 Z" fill=${color} stroke="#120d1c" stroke-width="3"/><path d="M18 54 V34 Q18 22 30 22 Q42 22 42 34 V54 Z" fill="#120d1c"/></g>`,
    cripta: html`<g><path d="M4 56 V28 L30 4 L56 28 V56 Z" fill=${color} stroke="#120d1c" stroke-width="3"/><path d="M19 56 V36 Q19 24 30 20 Q41 24 41 36 V56 Z" fill="#120d1c"/><path d="M30 8 V18 M25 12 H35" stroke="#120d1c" stroke-width="3"/></g>`,
    muralla: html`<g fill=${color} stroke="#120d1c" stroke-width="2.5"><path d="M4 56 V22 H14 V30 H22 V22 H38 V30 H46 V22 H56 V56 Z"/><path d="M4 42 H56 M18 42 V56 M42 42 V56 M30 30 V42" fill="none"/></g>`,
    lujo: html`<g><path d="M30 6 L52 24 L30 56 L8 24 Z" fill="#d9a441" stroke="#120d1c" stroke-width="3"/><path d="M8 24 H52 M30 6 L22 24 L30 56 L38 24 Z" fill="none" stroke="#120d1c" stroke-width="2"/></g>`,
    fama: html`<g><path d="M30 4 L37 22 L56 22 L41 34 L47 54 L30 42 L13 54 L19 34 L4 22 L23 22 Z" fill="#f1d27a" stroke="#120d1c" stroke-width="3"/></g>`,
    nivel: html`<g fill="none" stroke=${color} stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 50 L30 36 L50 50"/><path d="M10 34 L30 20 L50 34"/><path d="M10 18 L30 4 L50 18" opacity=".45"/></g>`,
    trampa: html`<g><path d="M30 4 L56 30 L30 56 L4 30 Z" fill="#2d1f45" stroke="#9d78d6" stroke-width="3"/><text x="30" y="38" text-anchor="middle" font-family="Grenze, serif" font-size="24" font-weight="700" fill="#cbb5ee">?</text></g>`,
  }[type];
  return html`<svg viewBox="0 0 60 60" width=${size} height=${size} class="token" aria-hidden="true">${g}</svg>`;
}
const DIE_SHAPE = {
  8: { d: 'M20 2 L38 20 L20 38 L2 20 Z', c: RCOL[1] },
  10: { d: 'M20 2 L37 16 L30 37 L10 37 L3 16 Z', c: RCOL[2] },
  12: { d: 'M20 2 L33 7 L38 20 L33 33 L20 38 L7 33 L2 20 L7 7 Z', c: RCOL[3] },
  20: { d: 'M20 2 L37 12 V28 L20 38 L3 28 V12 Z', c: '#9d78d6' },
};
function Die({ v, size = 38, d20, sides = 6 }) {
  if (d20) sides = 20;
  const pts = { 1: [[2, 2]], 2: [[1, 1], [3, 3]], 3: [[1, 1], [2, 2], [3, 3]], 4: [[1, 1], [3, 1], [1, 3], [3, 3]], 5: [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]], 6: [[1, 1], [3, 1], [1, 2], [3, 2], [1, 3], [3, 3]] };
  if (sides !== 6) {
    const sh = DIE_SHAPE[sides];
    return html`<svg viewBox="0 0 40 40" width=${size} height=${size} role="img" aria-label=${`d${sides}: ${v}`}><path d=${sh.d} fill=${sh.c} stroke="#120d1c" stroke-width="2"/><text x="20" y="24.5" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="13" font-weight="500" fill="#120d1c">${v}</text></svg>`;
  }
  return html`<svg viewBox="0 0 40 40" width=${size} height=${size} role="img" aria-label=${`d6: ${v}`}><rect x="2" y="2" width="36" height="36" rx="8" fill="#ece6dc" stroke="#120d1c" stroke-width="2"/>${(pts[v] || []).map(([x, y], i) => html`<circle key=${i} cx=${x * 9 + 2} cy=${y * 9 + 2} r="3.4" fill="#17141f"/>`)}</svg>`;
}

window.Art = { Card, CardBack, HeroToken, HeroPortrait, Glyph, Die, Ico, KIND, RCOL, SPR, HERO_ART, TRAP_ART, html };
