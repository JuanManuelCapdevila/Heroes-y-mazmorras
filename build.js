// Arma dist/index.html (una sola página) y copia las ilustraciones a dist/art.
// Uso: node build.js
const fs = require('fs'), path = require('path');
const R = p => fs.readFileSync(path.join(__dirname, p), 'utf8');
const ui = ['src/ui/board.js', 'src/ui/game.js', 'src/ui/lobby.js', 'src/ui/main.js'].map(R).join('\n');
const html = R('src/shell.html') + '\n<script>\n' + R('src/engine.js') + '\n</script><script>\n' + R('src/art.js') + '\n</script><script>\n' + ui + '\n</script>\n';
const dist = path.join(__dirname, 'dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'art'), { recursive: true });
fs.writeFileSync(path.join(dist, 'index.html'), html);
for (const f of fs.readdirSync(path.join(__dirname, 'public/art'))) fs.copyFileSync(path.join(__dirname, 'public/art', f), path.join(dist, 'art', f));
console.log(`dist/index.html (${(html.length / 1024).toFixed(0)} KB) y ${fs.readdirSync(path.join(dist, 'art')).length} ilustraciones`);
