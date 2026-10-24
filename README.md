# Señores de las Profundidades

Expansión **no oficial** para Catán. Los colonos ahora excavan: cada poblado es una *cueva*, cada ciudad una *cripta*, y cada jugador tiene su propia hueste de héroes "piadosos" para saquear a sus vecinos en nombre del reino.

Este repositorio contiene el prototipo web jugable, el motor de reglas, el simulador de balance y el manual preliminar.

> Proyecto hecho por fans, sin relación con los editores de Catán ni de Dungeon Lords. No incluye material de esos juegos.

## Qué hay

| Carpeta | Contenido |
|---|---|
| `src/engine.js` | Motor de reglas sin interfaz: tablero, producción, héroes, combate, ocupación, comercio, bots. Funciona en el navegador y en Node. |
| `src/art.js` | Cartas, fichas y dados dibujados en SVG. |
| `src/ui/` | Interfaz en React + [htm](https://github.com/developit/htm), sin paso de compilación: tablero, partida, salas en línea, galería y reglas. |
| `src/shell.html` | Estilos y carga de librerías. |
| `public/art/` | Ilustraciones del tablero, edificios, héroes y cartas (WebP). |
| `sims/` | Simulaciones de partidas entre bots y sus resultados. |
| `docs/manual.html` | Manual preliminar de reglas (v0.5). |
| `tools/` | Limpieza de ilustraciones y simulación de la base compartida para pruebas. |

## Cómo usarlo

Requiere Node 18 o superior. No hay dependencias que instalar.

```bash
npm run build          # arma dist/index.html y copia las ilustraciones
```

Abrí `dist/index.html` en el navegador para jugar contra tres bots. La página carga React y htm desde un CDN, así que necesita conexión.

El modo **en línea** (salas, asientos y temporizadores) usa la base de datos compartida y las salas en tiempo real de las páginas publicadas en claude.ai. Fuera de ese entorno, la pestaña "En línea" avisa que no está disponible. Para probarlo localmente, `tools/e2e/mock-claude.js` simula esas capacidades con `localStorage` y `BroadcastChannel` entre pestañas.

## Simulaciones

```bash
npm test                    # 200 partidas de humo: ninguna debe trabarse
npm run sim:personalidades  # 3000 partidas con seis estilos de bot mezclados
npm run sim:legendario      # impacto de conseguir un legendario temprano
npm run sim:recursos        # gasto contra producción de cada recurso
```

Estilos de bot: constructor, saqueador, defensor, mercader, oportunista y ascendente. Resultados de la versión actual (3000 partidas, mesas mezcladas):

| Estilo | Gana |
|---|---|
| Oportunista | 34% |
| Constructor | 30% |
| Saqueador | 26% |
| Defensor | 25% |
| Mercader | 20% |
| Ascendente | 16% |

## Reglas en una página

- **Héroes:** 10 fichas por color (4 comunes d6, 3 raros d8, 2 épicos d10, 1 legendario d12). Se recluta en común y se fusiona pagando lujo.
- **Saqueo:** al sacar 7 o con un asalto (2 trigo). Combate al estilo TEG; cada lado elige sus bajas.
- **Ocupación:** el grupo que gana se queda y cobra la producción del pueblo; tira d20 al final de cada ronda para quedarse. A las 3 rondas arrasa la cripta.
- **Trampas ocultas:** foso, niebla, alarma, derrumbe y señuelo.
- **Fama:** cada 5 vale 1 PV, y 2 compran un dado extra al defenderte.
- **Comercio:** banca, 9 pasajes de contrabando y entre jugadores.
- **Victoria:** 13 PV.

El detalle completo está en `docs/manual.html`.

## Estado

Prototipo v0.5.1, en prueba. Pendientes: ilustraciones de la Ascensión, los pasajes y los íconos chicos; reglas para 3 y 5–6 jugadores; diseño del tablero personal para la versión física.
