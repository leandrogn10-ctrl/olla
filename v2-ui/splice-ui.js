// splice-ui.js — puts the v2 UI (ui.css, ui.html, ui.js) into ~/Projects/olla/index.html.
// Every replacement asserts its anchors exist exactly once, so template drift fails loudly.
const fs = require('fs'), path = require('path');
const FILE = path.join(process.env.HOME, 'Projects/olla/index.html'), SRC = __dirname;
let html = fs.readFileSync(FILE, 'utf8');
const read = f => fs.readFileSync(path.join(SRC, f), 'utf8');
function between(a, b, repl, label, keepEnd) {
  const i = html.indexOf(a); if (i < 0) throw new Error('missing start: ' + label);
  if (html.indexOf(a, i + 1) >= 0) throw new Error('start not unique: ' + label);
  const j = html.indexOf(b, i + a.length); if (j < 0) throw new Error('missing end: ' + label);
  html = html.slice(0, i) + repl + (keepEnd ? html.slice(j) : html.slice(j + b.length));
}
function once(a, b, label) { const c = html.split(a).length - 1; if (c !== 1) throw new Error(label + ': expected once, found ' + c); html = html.replace(a, b); }
// 1. the app's CSS (everything from the SLOT:APP-CSS marker to </style>)
between('/* ═══ SLOT:APP-CSS', '</style>', read('ui.css') + '\n', 'css', true);
// 2. the body markup (from <body> to the APP-LOGIC script)
between('<body>', "<script>\n'use strict';", read('ui.html'), 'body', true);
// 3. OLLAUI
const uiStart = html.indexOf('/* ── La Olla UI');
if (uiStart < 0) throw new Error('missing OLLAUI start');
const endMark = 'return { render, go, boot, openRecipe, todayYmd };\n})();';
const uiEnd = html.indexOf(endMark, uiStart); if (uiEnd < 0) throw new Error('missing OLLAUI end');
html = html.slice(0, uiStart) + read('ui.js').trimEnd() + html.slice(uiEnd + endMark.length);
// 4. config colours
once("iconBg: '#15190f', iconFg: '#a3d15c'", "iconBg: '#10140d', iconFg: '#a3d15c'", 'icon');
once("themeColors: { macchiato: '#15190f', tokyo: '#f4efe3' }", "themeColors: { macchiato: '#10140d', tokyo: '#f3ecdc' }", 'themeColors');
html = html.replace('<meta name="theme-color" content="#15190f">', '<meta name="theme-color" content="#10140d">');
html = html.replace('<html lang="en">', '<html lang="es">');
for (const m of ['OLLA-ENGINE-BEGIN', 'OLLA-SEED-BEGIN', 'const OLLAUI', 'id="olla-sheet"', 'id="runner"', 'id="settings-btn"', 'id="export-btn"', 'id="sync-pip"', 'id="bottom-tabs"', 'id="kitchen-settings"']) {
  const c = html.split(m).length - 1; if (c !== 1) throw new Error('after splice, ' + m + ' appears ' + c + ' times');
}
fs.writeFileSync(FILE, html);
console.log('splice-ui ok:', html.length, 'bytes');
