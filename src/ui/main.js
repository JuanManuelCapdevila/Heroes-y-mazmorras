/* Galería, reglas y aplicación. */
function Gallery() {
  const counts = Object.assign({}, E.TRAP_DECK, E.DEV_DECK, { leva: E.DEV_DECK.leva - 1, ascension: 1 });
  const C = E.COST;
  return html`<div class="gallery">
    <section><h2>Héroes</h2><p class="lead">Diez fichas por color: 4 comunes, 3 raros, 2 épicos y 1 legendario. Se recluta siempre en común; para subir de rareza se fusionan 2 héroes iguales de tu guardia pagando lujo, y las fichas usadas vuelven a tu reserva.</p>
      <div class="rarities">${E.RARITY.map((r, i) => html`<figure key=${i} class="rcard">
        <img class="sprite" src=${SPR(HERO_ART[i])} alt=${'Héroe ' + r.name.toLowerCase()} loading="lazy"/>
        <div class="row">${E.COLORS.map(c => html`<${HeroToken} key=${c} color=${c} rarity=${i} size=${38}/>`)}</div>
        <div class="rhead"><b>${r.name}</b><span>${r.tokens} ${r.tokens === 1 ? 'ficha' : 'fichas'}</span></div>
        <div class="rmeta"><${Die} sides=${r.die} v=${r.die} size=${30}/><span>Dado d${r.die}</span><span>Permanencia +${r.perm}</span>${r.fuse ? html`<span>Fusión: 2 ${E.RARITY[i - 1].plural} + ${r.fuse} lujo</span>` : html`<span>Reclutar: ${costText(C.heroe)}</span>`}</div>
        <figcaption>${i === 2 ? 'En cada combate puede absorber una derrota sin caer; con dos, cae.' : r.text}</figcaption>
      </figure>`)}</div>
      <p class="lead small">Al combatir, cada lado tira los dados de sus 3 mejores héroes. Cuando perdés comparaciones, elegís qué héroes caen.</p></section>
    <section><h2>El tablero</h2><p class="lead">Cada terreno produce el mismo recurso que en Catán, reinterpretado bajo tierra. El color de cada jugador se ve en la base y el banderín de sus edificios. En el borde hay 9 pasajes de contrabando: 4 que cambian 3 a 1 cualquier recurso y 5 que cambian 2 a 1 un recurso concreto.</p>
      <div class="tiles">${['madera', 'ladrillo', 'lana', 'trigo', 'mineral', 'desierto'].map(r => html`<figure key=${r}><img class="tile" src=${SPR('terreno-' + r)} alt=${'Terreno de ' + E.RES_LABEL[r].toLowerCase()} loading="lazy"/><figcaption><b>${E.RES_LABEL[r]}</b> · ${{ madera: 'bosque de hongos gigantes', ladrillo: 'cantera de arcilla roja', lana: 'pastizal de ovejas de las cavernas', trigo: 'cultivo de hongos dorados', mineral: 'mina de cristales y oro', desierto: 'cráter seco, no produce' }[r]}</figcaption></figure>`)}</div>
      <div class="tiles bld">${[['cueva', 'Cueva', `Reemplaza al poblado. 1 PV, produce 1. Cuesta ${costText(C.cueva)}.`], ['cripta', 'Cripta', `Reemplaza a la ciudad. 2 PV, produce 2 y suma un dado al defender. Cuesta ${costText(C.cripta)}.`], ['muralla', 'Muralla', `+3 a la dificultad de permanencia de quien ocupe ese pueblo. Cuesta ${costText(C.muralla)}.`], ['ruinas', 'Arrasar', 'Si un grupo ocupa una cripta 3 rondas seguidas, la baja a cueva y le quita muralla y trampas. Las cuevas no se destruyen.']].map(([k, n, t]) => html`<figure key=${k}><img class="tile" src=${SPR(k)} alt=${n} loading="lazy"/><figcaption><b>${n}</b> · ${t}</figcaption></figure>`)}</div>
      <img class="backdrop" src=${SPR('fondo-tablero')} alt="Fondo del tablero: un pozo de mina" loading="lazy"/></section>
    <section><h2>Cartas de trampa</h2><p class="lead">Mazo de 25. Todas cuestan lo mismo (${costText(C.trampa)}) y se roban boca abajo: nadie elige cuál le toca. Se revelan cuando un grupo ataca el pueblo y se descartan. Ninguna le da héroes ni daño al defensor.</p>
      <div class="grid">${['foso', 'gas', 'alarma', 'derrumbe', 'senuelo'].map(k => html`<figure key=${k}><${Card} kind="trampa" id=${k} w=${190}/><figcaption>${counts[k]} copias</figcaption></figure>`)}
        <figure><${CardBack} w=${190}/><figcaption>Dorso común</figcaption></figure></div></section>
    <section><h2>Cartas de desarrollo</h2><p class="lead">Reemplazan al mazo de Catán. El caballero se convierte en «Leva de héroes». La Ascensión es una sola carta en todo el mazo.</p>
      <div class="grid">${['leva', 'reliquia', 'veta', 'ascension'].map(k => html`<figure key=${k}><${Card} kind="dev" id=${k} w=${190}/><figcaption>${counts[k]} ${counts[k] === 1 ? 'copia' : 'copias'}${k === 'ascension' ? ' · ilustración pendiente' : ''}</figcaption></figure>`)}</div></section>
    <section><h2>Títulos</h2><p class="lead">Funcionan como el camino más largo de Catán: el primero que cumple el mínimo lo toma, y pasa a quien lo supere. Valen 2 PV.</p>
      <div class="grid">${['tunel', 'leyenda', 'hueste'].map(k => html`<figure key=${k}><${Card} kind="titulo" id=${k} w=${190}/><figcaption>1 carta</figcaption></figure>`)}</div></section>
    <section><h2>Otras fichas</h2><p class="lead">Sobre el mapa solo va lo que depende de la posición: edificios, túneles, pasajes y grupos de héroes. El resto vive en el tablero de cada jugador, a la vista.</p>
      <div class="tokens">
        <figure><div class="row"><${HeroToken} color=${E.COLORS[1]} n=${3} rarity=${2} size=${52}/><${HeroToken} color=${E.COLORS[1]} n=${2} size=${52} faded/></div><figcaption><b>Grupo en el mapa</b> · se apila sobre el pueblo ocupado con un contador. Semitransparente: grupo demorado por un señuelo.</figcaption></figure>
        <figure><div class="row"><${Glyph} type="trampa" size=${52}/></div><figcaption><b>Marcador de trampa</b> · indica cuántas trampas tiene un pueblo, nunca cuáles.</figcaption></figure>
        <figure><div class="row"><${Glyph} type="lujo" size=${52}/></div><figcaption><b>Lujo</b> · por ronda de ocupación y por cada héroe enemigo que cae en tus pueblos. Paga las fusiones.</figcaption></figure>
        <figure><div class="row"><${Glyph} type="fama" size=${52}/></div><figcaption><b>Fama</b> · por saquear, sostener ocupaciones, resistir y expulsar. Cada ${E.P.famaPV} de fama vale 1 PV, y 2 de fama compran un dado extra al defenderte.</figcaption></figure>
        <figure><div class="row"><${Die} v=${5} size=${40}/><${Die} sides=${8} v=${7} size=${40}/><${Die} sides=${10} v=${9} size=${40}/><${Die} sides=${12} v=${11} size=${40}/><${Die} d20 v=${17} size=${40}/></div><figcaption><b>Dados</b> · d6 a d12 según la rareza; d20 para la permanencia.</figcaption></figure>
      </div></section>
  </div>`;
}

function Rules() {
  const C = E.COST, P = E.P;
  return html`<article class="rules">
    <h2>Reglas del prototipo (v0.5)</h2>
    <p>Todo lo que no se menciona funciona como Catán base. Simplificación del prototipo: el descarte por 7 es automático.</p>
    <h3>El mapa</h3>
    <p>Poblados, ciudades y caminos pasan a ser cuevas, criptas y túneles. No hay ladrón neutral: cada jugador tiene su propio grupo de héroes. En la costa hay 9 pasajes de contrabando: 4 de 3:1 y 5 de 2:1, uno por recurso.</p>
    <h3>Costos</h3>
    <ul>${[['Túnel', C.tunel], ['Cueva', C.cueva], ['Cripta', C.cripta], ['Héroe común', C.heroe], ['Trampa', C.trampa], ['Muralla', C.muralla], ['Desarrollo', C.desarrollo], ['Asalto', P.asalto]].map(([n, c]) => html`<li key=${n}><b>${n}:</b> ${costText(c)}</li>`)}</ul>
    <h3>Héroes</h3>
    <ul><li>10 fichas por jugador: 4 comunes (d6), 3 raros (d8), 2 épicos (d10), 1 legendario (d12).</li>
    <li>Sumás un común al sacar 7, al reclutar o con «Leva de héroes». Fusión: 2 iguales + lujo (1, 2 o 3) = 1 de la rareza siguiente.</li>
    <li>Habilidades: el raro te deja espiar la primera trampa de cada objetivo; el épico absorbe una derrota por combate; el legendario repite una tirada de permanencia fallida.</li>
    <li>La carta «Ascensión» (única en el mazo) vuelve legendario a un raro o épico de tu guardia, si tu ficha legendaria está libre.</li></ul>
    <h3>El saqueo</h3>
    <ol><li>Saqueás al sacar 7, o con un <b>asalto</b> en tu turno pagando ${costText(P.asalto)} (uno por turno). Armás un grupo con parte de tu guardia y elegís un pueblo ajeno libre. No podés atacar a quien tenga 3 PV menos que vos. Solo un grupo afuera a la vez.</li>
    <li>Se revelan las trampas. Si hay un señuelo, el grupo se demora hasta el comienzo de tu próximo turno.</li>
    <li>El defensor puede gastar 2 de fama para tirar un dado más.</li>
    <li>Combate al estilo TEG: el atacante tira los dados de sus 3 mejores héroes; el defensor tira 1 d6, +1 d6 si es cripta, +1 dado de su mejor héroe en guardia, más Alarma y fama. Los empates ganan los defensores. Cada lado elige qué héroes caen por cada comparación perdida.</li>
    <li>Si el atacante gana al menos una comparación y no pierde más de las que gana, el saqueo triunfa: +2 fama, roba 1 carta y el grupo ocupa el pueblo.</li></ol>
    <h3>Ocupación y arrasar</h3>
    <p>Mientras el grupo ocupa el pueblo, lo que ese pueblo produce va al saqueador. El dueño puede intentar expulsarlo una vez por turno. Al final de cada ronda el grupo tira 1d20 + permanencia (común 1, raro 2, épico 3, legendario 2) contra 10 + distancia + 3 si hay muralla + 2 por ronda ya ocupada: si lo supera se queda (+1 fama, +1 lujo), si no vuelve a casa. A las 3 rondas seguidas arrasa: una cripta baja a cueva y pierde muralla y trampas, y el grupo vuelve con +2 fama y +2 lujo. Las cuevas no se destruyen.</p>
    <h3>Comercio</h3>
    <p>Con la banca 4:1, o 3:1 y 2:1 en los pasajes; 2 lujo = 1 recurso. Entre jugadores, cualquier trato que acepten ambos, salvo con quien ocupa tus pueblos o a quien vos ocupás.</p>
    <h3>Victoria</h3>
    <p>Gana quien llega a ${P.winPV} PV en su turno. Fuentes: cuevas (1), criptas (2), reliquias (1, ocultas), 1 PV por cada ${P.famaPV} de fama y los títulos (2 cada uno): Túnel más largo (${P.titleMin.tunel} túneles), Leyenda del Reino (${P.titleMin.leyenda} de fama) y Mayor hueste (${P.titleMin.hueste} héroes).</p>
    <h3>En línea</h3>
    <p>Cada turno y cada decisión tienen tiempo límite. Si se acaba, el juego decide por vos: pasa el turno, no gasta fama, reparte las bajas en los héroes más baratos y rechaza ofertas. El primer jugador conectado de la mesa mueve a los bots.</p>
    <h3>Pruebas con bots</h3>
    <p>En 3000 partidas con seis estilos de juego mezclados, todos ganan entre el 16% y el 33% de las veces: el que combina construir y saquear es el más fuerte, el que defiende y el saqueador puro quedan cerca del 25%, y el que solo busca el legendario es el más débil.</p>
  </article>`;
}

function App() {
  const TABS = [['partida', 'Contra bots'], ['enlinea', 'En línea'], ['cartas', 'Cartas y fichas'], ['reglas', 'Reglas']];
  const [tab, setTab] = useState(() => { const h = (location.hash || '').slice(1); return TABS.some(t => t[0] === h) ? h : 'partida'; });
  return html`<div class="app">
    <header class="top">
      <div class="brand"><span class="mark">Señores de las Profundidades</span><span class="ver">prototipo v0.5 · expansión no oficial para Catán</span></div>
      <nav class="tabs" role="tablist">${TABS.map(([k, l]) => html`<button key=${k} role="tab" aria-selected=${tab === k} class=${tab === k ? 'on' : ''} onClick=${() => setTab(k)}>${l}</button>`)}</nav>
    </header>
    <div hidden=${tab !== 'partida'}><${LocalGame}/></div>
    ${tab === 'enlinea' ? html`<${Online}/>` : null}
    ${tab === 'cartas' ? html`<${Gallery}/>` : null}
    ${tab === 'reglas' ? html`<${Rules}/>` : null}
  </div>`;
}

window.__ok = true;
ReactDOM.createRoot(document.getElementById('app')).render(html`<${App}/>`);
