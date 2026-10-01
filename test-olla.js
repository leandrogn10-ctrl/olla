// test-olla.js — pins La Olla's engine (v2, LA-OLLA-V2-SPEC.md §2.9). Runs the REAL blocks extracted from index.html by
// their markers (OLLA-ENGINE, OLLA-SEED, and the app hooks between «app hooks» and appBuildClaudeSystem), so it tests
// exactly what ships. Every load-bearing pin is followed by a CONTROL that re-plants the defect into a scratch copy of the
// source and must go RED — a green harness that has never gone red proves nothing. Every re-plant asserts its anchor
// exists exactly once and that the source CHANGED (a re-plant that silently matched nothing is a blind control).
// Deterministic: `today`, `now` and `at` are passed in, never read from the clock.
process.env.TZ = 'America/New_York';
const fs = require('fs'), vm = require('vm');
const HTML = fs.readFileSync(__dirname + '/index.html', 'utf8');
function once(src, s, what) { const i = src.indexOf(s); if (i < 0) throw new Error((what || 'marker') + ' missing: ' + s.slice(0, 70)); if (src.indexOf(s, i + 1) >= 0) throw new Error((what || 'marker') + ' twice: ' + s.slice(0, 70)); return i; }
function block(a, b, incl) { const i = once(HTML, a), j = once(HTML, b); return HTML.slice(i, incl === false ? j : j + b.length); }
const ENGINE = block('/* ═══ OLLA-ENGINE-BEGIN', 'OLLA-ENGINE-END ═══ */');
const SEED = block('/* ═══ OLLA-SEED-BEGIN', 'OLLA-SEED-END ═══ */');
const HOOKS = block('/* ── app hooks (SLOT:APP-LOGIC) — La Olla ── */', 'function appBuildClaudeSystem()', false);
const SYNC = block('function cleanStateForSync() {', 'function setSyncPipState(s) {', false);   // the shell's sync, run against a fake gist in §20

function fakeStorage() { const m = {}; let sets = 0; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); sets++; }, removeItem: k => { delete m[k]; }, _m: m, sets: () => sets }; }
function load(src) {
  src = src || {};
  const ls = fakeStorage();
  const ctx = { module: { exports: {} }, console, localStorage: ls }; vm.createContext(ctx);
  vm.runInContext(src.engine || ENGINE, ctx); const O = ctx.module.exports;
  vm.runInContext((src.seed || SEED) + '\nmodule.exports = OLLA_SEED;', ctx); const seed = JSON.parse(JSON.stringify(ctx.module.exports));
  vm.runInContext((src.hooks || HOOKS) + '\nmodule.exports = { appMigrate, appDefaultState, looksLikeMyState, OLLA_SCHEMA, ingredients: INGREDIENTS };', ctx);
  return { O, seed, H: ctx.module.exports, ls, ctx };
}
function replant(which, find, repl) {   // → a loaded engine with ONE defect planted
  const src = { engine: ENGINE, seed: SEED, hooks: HOOKS, sync: SYNC }[which];
  once(src, find, 're-plant anchor');
  const broken = src.replace(find, repl);
  if (broken === src) throw new Error('re-plant changed nothing: ' + find.slice(0, 60));
  return which === 'sync' ? { SYNC: broken } : load({ [which]: broken });
}
const BASE = load(), { O, seed, H } = BASE;
if (typeof O.buildWeek !== 'function') throw new Error('engine did not export buildWeek');
function mkWith(seedObj) { const s = JSON.parse(JSON.stringify(seedObj)); s.plan = { via: 'fallback', days: {} }; s.log = {}; s.cooks = {}; s.extra = {}; s.likes = {}; s.groceries = { checked: {} }; s.cookSession = null; s.schema = 2; return s; }
const mk = () => mkWith(seed);
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? ' — ' + extra : '')); } }
function control(name, fn) { let red = false, msg = ''; try { red = !fn(); } catch (e) { red = true; msg = ' (threw: ' + e.message + ')'; } if (red) { pass++; console.log('  red  (control) ' + name + msg); } else { fail++; console.log('  FAIL (control stayed green) ' + name); } }
const SAT0 = '2026-09-26', WED = '2026-09-30', THU = '2026-10-01', FRI = '2026-10-02', SAT = '2026-10-03', SUN = '2026-10-04', MON = '2026-10-05', TUE = '2026-10-06', TUE0 = '2026-09-29';
const hm = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const AT = (d, t) => { const [y, mo, da] = d.split('-').map(Number); const [h, mi] = (t || '12:00').split(':').map(Number); return new Date(y, mo - 1, da, h, mi).getTime(); };
const hash = o => JSON.stringify(o);
const pastHash = (s, today) => hash(Object.keys(s.plan.days).filter(d => d < today).sort().map(d => [d, s.plan.days[d]]));
const week = (s, today, now) => { s.plan = O.buildWeek(s, today, now); return s; };
const batchOf = (s, d) => s.plan.days[d] && s.plan.days[d].cook && s.plan.days[d].cook.batch;
const eatersOf = (s, bid) => { let n = 0; Object.keys(s.plan.days).forEach(d => O.SLOTS.forEach(sl => { const r = s.plan.days[d][sl]; if (!r) return; if ((r.kind === 'leftover' && r.of === bid) || (r.kind === 'cook' && sl === 'dinner' && batchOf(s, d) === bid)) n++; })); return n; };
const madeAll = (s, upto, now) => Object.keys(s.plan.days).sort().forEach(d => { if (d > upto || !s.plan.days[d].cook) return; if (!O.effCook(s, s.plan.days[d].cook.batch)) O.logCook(s, s.plan.days[d].cook.batch, { s: 'made' }, upto, now == null ? 1439 : now, AT(d, '18:00')); });

console.log('\n0. The engine has no clock, every §2.6 name is exported, and no symbol is declared twice');
{
  const code = src => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"])\/\/.*$/gm, '$1');   // comments may NAME the forbidden calls
  const clock = src => /Date\.now\s*\(|new Date\(\s*\)/.test(code(src));
  ok('no Date.now() and no argument-less new Date() inside OLLA-ENGINE', !clock(ENGINE));
  control('re-plant: a Date.now() in the engine is SEEN by the purity check', () => !clock(ENGINE.replace("const numNow = now =>", "const _t = Date.now(); const numNow = now =>")));
  const API = ['ymd', 'parse', 'addDays', 'dow', 'diffDays', 'weekStart', 'isoWeek', 'hm', 'fmtHM', 'slotsFor', 'eatAt', 'recipeById', 'ingredient', 'eligible', 'maxServings', 'verbFor',
    'reality', 'potNow', 'expired', 'cookState', 'questions', 'buildWeek', 'validateWeek', 'setKind', 'nextKind', 'setCookRecipe', 'backToRule', 'logMeal', 'logCook', 'freeze', 'like',
    'effLog', 'effCook', 'pickRecipe', 'scaleIngredients', 'stepTimer', 'remateFor', 'shopping', 'check', 'listText', 'rescue', 'nextAction', 'weekRegister', 'minutesFor', 'slotLabel',
    'project', 'mergeReality', 'rungCheck', 'rungUp'];
  const missing = API.filter(n => typeof O[n] !== 'function');
  ok('every §2.6 function is on OLLA', !missing.length, missing.join(','));
  ok('SLOTS and KINDS are the spec\'s', hash(O.SLOTS) === hash(['bf', 'lunch', 'dinner', 'post']) && hash(O.KINDS) === hash(['swipe', 'leftover', 'cook', 'home', 'out']));
  const fnNames = (ENGINE.match(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g) || []).map(x => x.replace(/function\s+|\s*\(/g, ''));
  const dup = fnNames.filter((n, i) => fnNames.indexOf(n) !== i);
  ok('no function is declared twice inside the engine (the harness and the browser would run different copies)', !dup.length, dup.join(','));
  const tops = ['const OLLA =', 'const OLLA_SEED =', 'const INGREDIENTS =', 'const OLLA_SCHEMA =', 'function appMigrate(', 'function looksLikeMyState(', 'function syncPull(', 'function syncPush(', 'function cleanStateForSync(', 'function gistFetch('];
  const counts = tops.map(t => (HTML.split(t).length - 1));
  ok('each top-level symbol is declared exactly once in index.html', counts.every(c => c === 1), tops.map((t, i) => t + '×' + counts[i]).join(' '));
}

console.log('\n1. The fallback week (model OFF) is a VALID week');
{
  const s = week(mk(), WED, 0), days = Object.keys(s.plan.days).sort();
  ok('seven days from today', days.length === 7 && days[0] === WED && days[6] === TUE, days.join(','));
  ok('every slot of every day has a kind; post exists exactly on train days', days.every(d => O.slotsFor(s, d).every(sl => O.KINDS.indexOf((s.plan.days[d][sl] || {}).kind) >= 0) && (!!s.plan.days[d].post === O.trainDay(s.settings, d))));
  const bad = O.validateWeek(s, s.plan, WED, 0);
  ok('the gate accepts it', bad.length === 0, JSON.stringify(bad));
  ok('via says which path served', s.plan.via === 'fallback');
  ok('dinner is NEVER a swipe', days.every(d => s.plan.days[d].dinner.kind !== 'swipe'));
  ok('weekday breakfast + lunch are swipes', [WED, THU, FRI, MON, TUE].every(d => s.plan.days[d].bf.kind === 'swipe' && s.plan.days[d].lunch.kind === 'swipe'));
  ok('weekend breakfast is the fridge default; Sunday lunch is out', s.plan.days[SAT].bf.kind === 'home' && s.plan.days[SUN].bf.kind === 'home' && s.plan.days[SUN].lunch.kind === 'out');
  ok('lift nights get the fourth meal (batido-post), and only lift nights', s.plan.days[THU].post && s.plan.days[THU].post.recipe === 'batido-post' && !s.plan.days[WED].post && !s.plan.days[SAT].post);
  const wc = s.plan.days[WED].cook, wr = O.recipeById(s, wc.recipe);
  ok('Wed cooks inside its window, start AND end', wc && hm(wc.at) >= hm('13:00') && hm(wc.at) + wr.minutes.total <= hm('17:30') && s.plan.days[WED].dinner.kind === 'cook', JSON.stringify(wc));
  ok('Thu (its window not needed) eats Wed\'s pot', !s.plan.days[THU].cook && s.plan.days[THU].dinner.kind === 'leftover' && s.plan.days[THU].dinner.of === wc.batch);
  ok('Sat lunch eats Fri\'s double', s.plan.days[SAT].lunch.kind === 'leftover' && s.plan.days[SAT].lunch.of === batchOf(s, FRI));
  ok('Sun/Mon/Tue dinners eat Saturday\'s pot', [SUN, MON, TUE].every(d => s.plan.days[d].dinner.kind === 'leftover' && s.plan.days[d].dinner.of === batchOf(s, SAT)));
  ok('Saturday cooks exactly its eaters (Sat, Sun, Mon, Tue = 4)', s.plan.days[SAT].cook.servings === 4 && eatersOf(s, batchOf(s, SAT)) === 4, String(s.plan.days[SAT].cook.servings));
  const cooks = days.filter(d => s.plan.days[d].cook);
  ok('every cook is at least a double', cooks.every(d => s.plan.days[d].cook.servings >= 2));
  ok('no orphan portions: every batch is eaten to zero (or is the minimum double)', cooks.every(d => { const c = s.plan.days[d].cook, e = eatersOf(s, c.batch); return e === c.servings || (c.servings === 2 && e <= 2); }), cooks.map(d => s.plan.days[d].cook.servings + '/' + eatersOf(s, s.plan.days[d].cook.batch)).join(' '));
  const R = O.reality(s, WED, 0);
  ok('leftovers are inside fridge life', days.every(d => O.SLOTS.every(sl => { const r = s.plan.days[d][sl]; if (!r || r.kind !== 'leftover') return true; const b = R.byId[r.of]; return b && d >= b.date && d <= b.expires; })));
  ok('the planner is idempotent: building the week twice changes nothing', hash(O.buildWeek(s, WED, 0)) === hash(s.plan));
  ok('the planner never mixes days: three different mains this week, no back-to-back', (() => { const r = cooks.map(d => s.plan.days[d].cook.recipe); return new Set(r).size === r.length && r.length >= 3; })(), cooks.map(d => s.plan.days[d].cook.recipe).join(','));
}
{
  const book = JSON.parse(JSON.stringify(seed)); book.recipes = book.recipes.filter(r => r.role !== 'main' || r.id === 'atun-huevo-bowl');
  const s = week(mkWith(book), WED, 0);
  ok('a book with NO batchable main yields no cook; every pot slot falls to the fridge and the gate still passes', Object.keys(s.plan.days).every(d => !s.plan.days[d].cook && s.plan.days[d].dinner.kind === 'home') && O.validateWeek(s, s.plan, WED, 0).length === 0);
}
control('re-plant: a cook row with an unknown recipe must be refused by the gate', () => { const s = week(mk(), WED, 0); s.plan.days[WED].cook.recipe = 'no-such-dish'; return O.validateWeek(s, s.plan, WED, 0).length === 0; });

console.log('\n2. Windows: start AND end, and today\'s window closes at `now`');
{
  const s = week(mk(), WED, 0);
  const r = O.setKind(s, MON, 'dinner', 'cook', WED, 0);
  ok('Monday (no window) cook refused', !r.ok && /ventana/.test(r.why), r.why);
  const t = week(mk(), WED, 0); t.plan.days[WED].cook.at = '17:10';
  const tot = O.recipeById(t, t.plan.days[WED].cook.recipe).minutes.total;
  ok('a cook starting at 17:10 that runs ' + tot + ' min is refused on a 13:00–17:30 window', O.validateWeek(t, t.plan, WED, 0).some(x => x.code === 'no-window'));
  const u = mk(); u.settings.cookAt = { '3': '17:00' };
  const c = O.cookSlot(u, WED, O.recipeById(u, 'pasta-bolognesa-rapida'), WED, 0);
  ok('cookAt is clamped into the window, and a dish that would end after it does not fit', c === null && O.cookSlot(u, WED, O.recipeById(u, 'bowl-frijoles-huevo'), WED, 0).at === hm('17:00'));
  week(u, WED, 0);
  ok('the planner seats Wednesday only with a dish that ends by 17:30', !u.plan.days[WED].cook || hm(u.plan.days[WED].cook.at) + O.recipeById(u, u.plan.days[WED].cook.recipe).minutes.total <= hm('17:30'), JSON.stringify(u.plan.days[WED].cook));
}
control('re-plant v1\'s start-only window check: a cook that runs past 17:30 must still be refused', () => {
  const B = replant('engine', 'if (at == null || !windowsFor(S, d).some(w => at >= w.s && at + tot <= w.e))', 'if (at == null || !windowsFor(S, d).some(w => at >= w.s && at + 1 <= w.e))');
  const t = B.O.buildWeek(mkWith(B.seed), WED, 0); const s = mkWith(B.seed); s.plan = t; s.plan.days[WED].cook.at = '17:10';
  return B.O.validateWeek(s, s.plan, WED, 0).some(x => x.code === 'no-window');
});
{
  const a = week(mk(), WED, hm('14:00'));
  ok('Wed at 14:00: today still cooks, never before now', a.plan.days[WED].cook && hm(a.plan.days[WED].cook.at) >= hm('14:00'), JSON.stringify(a.plan.days[WED].cook));
  const b = week(mk(), WED, hm('17:45'));
  ok('Wed at 17:45: the window is closed for today — no cook seated, dinner from the fridge', !b.plan.days[WED].cook && b.plan.days[WED].dinner.kind === 'home', JSON.stringify(b.plan.days[WED]));
  ok('…and Thursday (which can cook) picks the week up', b.plan.days[THU].cook && b.plan.days[THU].dinner.kind === 'cook');
}
control('re-plant: a cookSlot that ignores `now` seats a cook in the past', () => {
  const B = replant('engine', '      if (date === today) s = Math.max(s, ceil5(numNow(now)) + lead);\n', '');
  const s = mkWith(B.seed); s.plan = B.O.buildWeek(s, WED, hm('14:00'));
  return s.plan.days[WED].cook && hm(s.plan.days[WED].cook.at) >= hm('14:00');
});

console.log('\n3. Hand edits are tried on a clone and applied ONCE; the past is never written');
{
  const s = week(mk(), WED, 0), before = hash(s);
  const k = O.nextKind(s, WED, 'lunch', WED, 0);
  ok('nextKind is PURE: the state is byte-identical after it', hash(s) === before, k);
  const r = O.setKind(s, WED, 'lunch', k, WED, 0);
  ok('the tap applies the kind once and marks it hand', r.ok && s.plan.days[WED].lunch.kind === k && s.plan.days[WED].lunch.hand === true, JSON.stringify(r));
  ok('the hand row survives a rebuild', (week(s, WED, 0), s.plan.days[WED].lunch.kind === k && s.plan.days[WED].lunch.hand));
  const back = O.backToRule(s, WED, 'lunch', WED, 0);
  ok('backToRule drops the hand row: the rule\'s swipe is back', back.ok && s.plan.days[WED].lunch.kind === 'swipe' && !s.plan.days[WED].lunch.hand);
  const p = week(mk(), WED, 0); p.plan.days[SAT0] = { train: false, bf: { kind: 'home', recipe: 'yogur-bowl' }, lunch: { kind: 'home', recipe: 'atun-huevo-bowl' }, dinner: { kind: 'home', recipe: 'atun-huevo-bowl' } };
  const ph = pastHash(p, WED);
  const sr = O.setCookRecipe(p, SAT0, 'bowl-coreano', WED, 0), sk = O.setKind(p, SAT0, 'dinner', 'out', WED, 0);
  ok('setCookRecipe and setKind refuse a past date and leave the past byte-identical', !sr.ok && !sk.ok && pastHash(p, WED) === ph, sr.why + ' / ' + sk.why);
  const q = week(mk(), WED, 0), cr = O.setCookRecipe(q, WED, 'bowl-coreano', WED, 0);
  ok('setCookRecipe keeps tonight\'s dinner a COOK (eaten fresh, billed 20 min), never a leftover of its own pot', cr.ok && q.plan.days[WED].cook.recipe === 'bowl-coreano' && q.plan.days[WED].dinner.kind === 'cook' && O.minutesFor(q, WED, 'dinner') === 20, JSON.stringify(q.plan.days[WED]));
  ok('setCookRecipe refuses a dish above the next rung, and a side', !O.setCookRecipe(q, FRI, 'seco-de-res', WED, 0).ok && !O.setCookRecipe(q, FRI, 'arroz-graneado', WED, 0).ok);
}
control('re-plant v1\'s double apply: a nextKind that tries kinds on the REAL state mutates it', () => {
  const B = replant('engine', 'if (setKind(clone(state), date, slot, cand, today, now).ok) return cand;', 'if (setKind(state, date, slot, cand, today, now).ok) return cand;');
  const s = mkWith(B.seed); s.plan = B.O.buildWeek(s, WED, 0); const before = hash(s); B.O.nextKind(s, WED, 'lunch', WED, 0); return hash(s) === before;
});
control('re-plant: setCookRecipe without its past-date refusal rewrites the record', () => {
  const B = replant('engine', "if (!parse(date) || date < today) return { ok: false, why: 'ese día ya pasó' };\n    const rec = recipeById(state, recipeId);", 'const rec = recipeById(state, recipeId);');
  const p = mkWith(B.seed); p.plan = B.O.buildWeek(p, WED, 0); p.plan.days[SAT0] = { train: false, bf: { kind: 'home', recipe: 'yogur-bowl' }, lunch: { kind: 'home', recipe: 'atun-huevo-bowl' }, dinner: { kind: 'home', recipe: 'atun-huevo-bowl' } };
  const ph = pastHash(p, WED); const r = B.O.setCookRecipe(p, SAT0, 'bowl-coreano', WED, 0); return !r.ok && pastHash(p, WED) === ph;
});
control('re-plant: a cook day whose dinner is not seated on its own pot turns tonight into «X (sobra)»', () => {
  const B = replant('engine', 'const E = eatersIn(from, to, true), own = cookB ? (E.find(e => isOwn(e, from)) || null) : null;', 'const E = eatersIn(from, to, true), own = null;');
  const q = mkWith(B.seed); q.plan = B.O.buildWeek(q, WED, 0); B.O.setCookRecipe(q, WED, 'bowl-coreano', WED, 0); return q.plan.days[WED].dinner.kind === 'cook';
});

console.log('\n4. Plan = intent, log = reality: the log never writes the plan, and refuses the future');
{
  const s = week(mk(), WED, hm('12:00')), planBefore = hash(s.plan.days);
  ok('today\'s lunch at 12:00 can be logged (its eat window has opened)', O.logMeal(s, WED, 'lunch', { s: 'skipped' }, WED, hm('12:00'), AT(WED, '12:00')).ok);
  ok('tonight\'s dinner at 12:00 is refused — it has not happened', !O.logMeal(s, WED, 'dinner', { s: 'ate' }, WED, hm('12:00'), AT(WED, '12:00')).ok);
  ok('tomorrow is refused', !O.logMeal(s, THU, 'bf', { s: 'ate' }, WED, hm('12:00'), AT(WED, '12:00')).ok);
  ok('a log without `at` is refused (the engine has no clock to invent one)', !O.logMeal(s, WED, 'bf', { s: 'ate' }, WED, hm('12:00')).ok);
  ok('an unknown state is refused', !O.logMeal(s, WED, 'bf', { s: 'maybe' }, WED, hm('12:00'), AT(WED, '12:01')).ok);
  O.logCook(s, batchOf(s, WED), { s: 'made', yield: 3 }, WED, hm('15:00'), AT(WED, '15:00'));
  O.logMeal(s, WED, 'dinner', { s: 'other', what: 'pizza', left: 1 }, WED, hm('19:30'), AT(WED, '19:30'));
  O.freeze(s, batchOf(s, WED), 1, WED, hm('20:00'), AT(WED, '20:00'));
  ok('logMeal, logCook and freeze leave plan.days byte-identical', hash(s.plan.days) === planBefore);
  ok('the log is an append-only array; void retracts the last entry', (() => { O.logMeal(s, WED, 'lunch', { s: 'ate' }, WED, hm('13:00'), AT(WED, '13:00')); const a = O.effLog(s, WED, 'lunch').s; O.logMeal(s, WED, 'lunch', { s: 'void' }, WED, hm('13:01'), AT(WED, '13:01')); return a === 'ate' && O.effLog(s, WED, 'lunch').s === 'skipped' && s.log[WED + ':lunch'].length === 3; })());
  ok('rebuilding the week keeps every log', (week(s, THU, 0), O.effLog(s, WED, 'dinner').s === 'other'));
}
control('re-plant: a logMeal that writes the plan row must break the byte-identical pin', () => {
  const B = replant('engine', "    (state.log[key] = Array.isArray(state.log[key]) ? state.log[key] : []).push(e);\n    return res;", "    (state.log[key] = Array.isArray(state.log[key]) ? state.log[key] : []).push(e);\n    { const dd = planDay(state, date); if (dd && dd[slot] && s !== 'ate') dd[slot].kind = 'out'; }\n    return res;");
  const s = mkWith(B.seed); s.plan = B.O.buildWeek(s, WED, hm('12:00')); const h0 = hash(s.plan.days);
  B.O.logMeal(s, WED, 'lunch', { s: 'skipped' }, WED, hm('12:00'), AT(WED, '12:00')); return hash(s.plan.days) === h0;
});

console.log('\n5. The rotisserie Wednesday: «comprado» is a first-class answer');
const rotisserie = (left, O2, seed2) => {
  O2 = O2 || O; const s = mkWith(seed2 || seed); s.plan = O2.buildWeek(s, WED, hm('10:00'));
  O2.logCook(s, s.plan.days[WED].cook.batch, { s: 'notmade' }, WED, hm('21:00'), AT(WED, '21:00'));
  O2.logMeal(s, WED, 'dinner', { s: 'other', what: 'pollo rostizado comprado', left, src: 'bought' }, WED, hm('21:00'), AT(WED, '21:01'));
  return s;
};
{
  const s = rotisserie(2); s.plan = O.buildWeek(s, THU, hm('08:00'));
  const ex = Object.keys(s.extra)[0];
  ok('«otra cosa, sobró 2» created a REAL batch (src bought, 2 portions, fridge 3 days)', ex && s.extra[ex].servings === 2 && s.extra[ex].src === 'bought', JSON.stringify(s.extra));
  ok('Thursday eats the bought batch and does not cook', s.plan.days[THU].dinner.kind === 'leftover' && s.plan.days[THU].dinner.of === ex && !s.plan.days[THU].cook, JSON.stringify(s.plan.days[THU]));
  ok('the planner uses it like a cook: Friday\'s dinner is its second portion, so Friday doesn\'t cook either', s.plan.days[FRI].dinner.of === ex && !s.plan.days[FRI].cook, JSON.stringify(s.plan.days[FRI]));
  ok('the pot on Thursday morning holds the 2 bought portions, named as bought', (() => { const p = O.potNow(s, THU, hm('08:00')); return p.length === 1 && p[0].left === 2 && /comprado/.test(p[0].name); })());
  ok('the not-made cook is not asked about (it was answered)', O.questions(s, THU, hm('08:00')).length === 0);
  const z = rotisserie(0); z.plan = O.buildWeek(z, THU, hm('14:00'));
  ok('left 0, Thursday 14:00: Thursday cooks — its window is still open', z.plan.days[THU].cook && z.plan.days[THU].dinner.kind === 'cook' && hm(z.plan.days[THU].cook.at) >= hm('14:00'), JSON.stringify(z.plan.days[THU]));
  const y = rotisserie(0); y.plan = O.buildWeek(y, THU, hm('17:45'));
  ok('left 0, Thursday 17:45: the window has closed — dinner is the fridge default', !y.plan.days[THU].cook && y.plan.days[THU].dinner.kind === 'home', JSON.stringify(y.plan.days[THU]));
  O.logMeal(s, WED, 'dinner', { s: 'void' }, THU, hm('09:00'), AT(THU, '09:00')); s.plan = O.buildWeek(s, THU, hm('09:00'));
  ok('voiding the «otra cosa» takes its batch with it (reality, not a stored copy)', !O.reality(s, THU, hm('09:00')).byId[ex] && s.plan.days[THU].dinner.of !== ex);
}
control('re-plant: a reality() that ignores the bought batch (v1 had nowhere to put it) leaves Thursday unfed', () => {
  const B = replant('engine', 'Object.keys(extra).sort().forEach(id => {', 'Object.keys({}).sort().forEach(id => {');
  const s = rotisserie(2, B.O, B.seed); s.plan = B.O.buildWeek(s, THU, hm('08:00'));
  return s.plan.days[THU].dinner.kind === 'leftover' && /^u/.test(s.plan.days[THU].dinner.of || '');
});

console.log('\n6. Silence about a past cook: NOT in the pot, and asked — only today and yesterday');
{
  const s = week(mk(), WED, hm('10:00'));
  ok('Thu 08:00, Wed\'s cook never confirmed: the pot holds nothing', O.potNow(s, THU, hm('08:00')).length === 0);
  ok('…and Hoy asks «¿se hizo?» about it', (() => { const q = O.questions(s, THU, hm('08:00')); return q.length === 1 && q[0].date === WED && q[0].batch === batchOf(s, WED) && q[0].verb === 'cocinar'; })());
  s.plan = O.buildWeek(s, THU, hm('08:00'));
  ok('the planner does not seat Thursday from a phantom: Thursday cooks for itself', s.plan.days[THU].dinner.kind === 'cook' && s.plan.days[THU].cook, JSON.stringify(s.plan.days[THU]));
  ok('two days later the question is dropped silently — never a guilt list', O.questions(s, FRI, hm('08:00')).every(q => q.date !== WED));
  ok('cookState walks planned → due → cooking → unconfirmed → made', (() => { const t = week(mk(), WED, 0), at = hm(t.plan.days[WED].cook.at), tot = O.recipeById(t, t.plan.days[WED].cook.recipe).minutes.total;
    const a = [O.cookState(t, WED, WED, at - 30), O.cookState(t, WED, WED, at - 10), O.cookState(t, WED, WED, at + 1), O.cookState(t, WED, WED, at + tot)];
    O.logCook(t, batchOf(t, WED), { s: 'made' }, WED, at + tot, AT(WED, '16:00')); a.push(O.cookState(t, WED, WED, at + tot)); return a.join(',') === 'planned,due,cooking,unconfirmed,made'; })());
  const t = week(mk(), WED, hm('10:00'));
  const r = O.logMeal(t, THU, 'dinner', { s: 'ate' }, THU, hm('19:30'), AT(THU, '19:30'));
  ok('eating a portion of an unconfirmed pot confirms it (the pot existed)', r.ok && O.cookState(t, WED, THU, hm('19:30')) === 'made', JSON.stringify(r));
}
{
  const s = week(mk(), WED, hm('09:00')); s.plan = O.buildWeek(s, WED, hm('15:00'));
  ok('Wed 15:00, today\'s cook done but unconfirmed: tonight stays THE COOK (it reads «¿se hizo?»), not the fridge', s.plan.days[WED].dinner.kind === 'cook' && O.cookState(s, WED, WED, hm('15:00')) === 'unconfirmed' && O.potNow(s, WED, hm('15:00')).length === 0, JSON.stringify(s.plan.days[WED].dinner));
  O.logCook(s, batchOf(s, WED), { s: 'made', yield: 3 }, THU, hm('08:00'), AT(THU, '08:00')); s.plan = O.buildWeek(s, THU, hm('08:00'));
  ok('…answered the next morning (made, 3): Wednesday\'s dinner counts as eaten, so the pot holds 2 — never a phantom third', O.potNow(s, THU, hm('08:00'))[0].left === 2);
}
control('re-plant: re-seating tonight on the fridge while the cook is unconfirmed makes the next-morning answer a phantom portion', () => {
  const B = replant('engine', "cookB = b || (rb && rb.state === 'unconfirmed' ? { id: rb.id, left: 0, pending: true } : null);", 'cookB = b || null;');
  const s = mkWith(B.seed); s.plan = B.O.buildWeek(s, WED, hm('09:00')); s.plan = B.O.buildWeek(s, WED, hm('15:00'));
  B.O.logCook(s, s.plan.days[WED].cook.batch, { s: 'made', yield: 3 }, THU, hm('08:00'), AT(THU, '08:00')); s.plan = B.O.buildWeek(s, THU, hm('08:00'));
  return B.O.potNow(s, THU, hm('08:00'))[0].left === 2;
});
control('re-plant v1\'s phantom: a past unlogged cook counted as made puts portions in Thursday\'s pot', () => {
  const B = replant('engine', "else if (cookPast(state, d, c, today, N)) { st = 'unconfirmed'; servings = 0; }", "else if (cookPast(state, d, c, today, N)) { st = 'made'; src = 'made'; }");
  const s = mkWith(B.seed); s.plan = B.O.buildWeek(s, WED, hm('10:00')); return B.O.potNow(s, THU, hm('08:00')).length === 0;
});
control('re-plant: questions that reach back three days become a guilt list', () => {
  const B = replant('engine', '[addDays(today, -1), today].forEach(d => {', '[addDays(today, -2), addDays(today, -1), today].forEach(d => {');
  const s = mkWith(B.seed); s.plan = B.O.buildWeek(s, WED, hm('10:00')); return B.O.questions(s, FRI, hm('08:00')).every(q => q.date !== WED);
});

console.log('\n7. The pot by the hour; a skipped portion comes back; the freezer is rescue-only; an expired batch surfaces');
{
  const s = week(mk(), WED, hm('10:00')), b = batchOf(s, WED);
  ok('Wed 10:00 — planned, not cooked: the pot is empty', O.potNow(s, WED, hm('10:00')).length === 0);
  O.logCook(s, b, { s: 'made' }, WED, hm('17:00'), AT(WED, '17:00'));
  ok('Wed 19:00, made: 2 portions (tonight\'s is still in the pot)', (() => { const p = O.potNow(s, WED, hm('19:00')); return p.length === 1 && p[0].left === 2; })(), JSON.stringify(O.potNow(s, WED, hm('19:00')).map(x => x.left)));
  ok('Wed 22:00, after dinner: 1', (() => { const p = O.potNow(s, WED, hm('22:00')); return p.length === 1 && p[0].left === 1 && p[0].daysLeft === 3; })());
  O.logMeal(s, WED, 'dinner', { s: 'skipped' }, WED, hm('22:00'), AT(WED, '22:00'));
  ok('…he skipped it: the portion stays — 2 at 22:00', O.potNow(s, WED, hm('22:00'))[0].left === 2);
  s.plan = O.buildWeek(s, THU, hm('08:00'));
  ok('and the planner finds it: Thu AND Fri dinners eat Wednesday\'s pot, so Friday doesn\'t cook', s.plan.days[THU].dinner.of === b && s.plan.days[FRI].dinner.of === b && !s.plan.days[FRI].cook, JSON.stringify([s.plan.days[THU].dinner, s.plan.days[FRI].dinner]));
}
control('re-plant: a reality where «skipped» still consumes loses the portion', () => {
  const B = replant('engine', "          if (e.s !== 'ate') return;\n", "          if (false) return;\n");
  const s = mkWith(B.seed); s.plan = B.O.buildWeek(s, WED, hm('10:00')); const b = s.plan.days[WED].cook.batch;
  B.O.logCook(s, b, { s: 'made' }, WED, hm('17:00'), AT(WED, '17:00')); B.O.logMeal(s, WED, 'dinner', { s: 'skipped' }, WED, hm('22:00'), AT(WED, '22:00'));
  return B.O.potNow(s, WED, hm('22:00'))[0].left === 2;
});
control('re-plant: a pot that reports what is COMMITTED instead of what is there shows an empty pot the evening he cooked', () => {
  const B = replant('engine', '.map(b => Object.assign({}, b, { left: b.leftNow, daysLeft: diffDays(today, b.expires) }))\n      .sort((a, b) => cmpStr(a.expires, b.expires) || cmpStr(a.id, b.id));\n  }\n  function freezer', '.map(b => Object.assign({}, b, { left: b.left, daysLeft: diffDays(today, b.expires) }))\n      .sort((a, b) => cmpStr(a.expires, b.expires) || cmpStr(a.id, b.id));\n  }\n  function freezer');
  const s = mkWith(B.seed); s.plan = B.O.buildWeek(s, WED, hm('10:00')); B.O.logCook(s, s.plan.days[WED].cook.batch, { s: 'made' }, WED, hm('17:00'), AT(WED, '17:00'));
  const p = B.O.potNow(s, WED, hm('19:00')); return p.length === 1 && p[0].left === 2;
});
{
  const s = week(mk(), SAT, hm('09:00')), b = batchOf(s, SAT);
  O.logCook(s, b, { s: 'made', yield: 4 }, SAT, hm('13:00'), AT(SAT, '13:00'));
  const before = O.potNow(s, SAT, hm('13:00'))[0].left;
  const f = O.freeze(s, b, 1, SAT, hm('13:05'), AT(SAT, '13:05'));
  ok('freeze subtracts from the pot and creates a freezer batch (90 days)', f.ok && O.potNow(s, SAT, hm('13:05'))[0].left === before - 1 && s.extra[f.id].fridgeDays === 90 && s.extra[f.id].src === 'frozen', JSON.stringify(f));
  s.plan = O.buildWeek(s, SUN, hm('08:00'));
  ok('the planner never seats a frozen portion on its own', Object.keys(s.plan.days).every(d => O.SLOTS.every(sl => !s.plan.days[d][sl] || s.plan.days[d][sl].of !== f.id)));
  ok('rescue offers it, after the pot, before the fridge default', (() => { const r = O.rescue(s, SUN, hm('20:00')).map(x => x.kind); return r.indexOf('freezer') > r.indexOf('pot') && r.indexOf('freezer') < r.indexOf('home'); })());
  ok('a dish that doesn\'t freeze is refused', (() => { const t = week(mk(), WED, hm('10:00')); const sc = O.setCookRecipe(t, FRI, 'pollo-bandeja', WED, hm('10:00')); if (!sc.ok) return false; O.logCook(t, batchOf(t, FRI), { s: 'made' }, FRI, hm('20:00'), AT(FRI, '20:00')); return !O.freeze(t, batchOf(t, FRI), 1, FRI, hm('20:00'), AT(FRI, '20:01')).ok; })());
}
control('re-plant: a planner that seats frozen portions empties the freezer behind his back', () => {
  const B = replant('engine', 'const pot = R0.batches.filter(b => !b.frozen && b.left > 0', 'const pot = R0.batches.filter(b => b.left > 0');
  const s = mkWith(B.seed); s.plan = B.O.buildWeek(s, SAT, hm('09:00')); const b = s.plan.days[SAT].cook.batch;
  B.O.logCook(s, b, { s: 'made', yield: 4 }, SAT, hm('13:00'), AT(SAT, '13:00')); const f = B.O.freeze(s, b, 1, SAT, hm('13:05'), AT(SAT, '13:05'));
  s.plan = B.O.buildWeek(s, SUN, hm('08:00'));
  return Object.keys(s.plan.days).every(d => B.O.SLOTS.every(sl => !s.plan.days[d][sl] || s.plan.days[d][sl].of !== f.id));
});
{
  const s = week(mk(), WED, hm('10:00')), b = batchOf(s, WED);
  O.logCook(s, b, { s: 'made', yield: 4 }, WED, hm('17:00'), AT(WED, '17:00'));
  const SUN2 = '2026-10-04';
  ok('a batch past its last good day with portions left is listed («tíralo»)', O.expired(s, SUN2, hm('09:00')).some(x => x.id === b && x.left > 0), JSON.stringify(O.expired(s, SUN2, hm('09:00')).map(x => [x.id, x.left])));
  ok('…not silently in the pot', O.potNow(s, SUN2, hm('09:00')).every(x => x.id !== b));
  ok('…and it stops surfacing a few days on (never a guilt list)', O.expired(s, '2026-10-08', hm('09:00')).every(x => x.id !== b));
  O.logCook(s, b, { s: 'tossed' }, SUN2, hm('09:05'), AT(SUN2, '09:05'));
  ok('…or once he tossed it', O.expired(s, SUN2, hm('09:10')).every(x => x.id !== b));
}
control('re-plant: an expired list with no horizon keeps a dead pot on screen for weeks', () => {
  const B = replant('engine', '.filter(b => realB(b) && b.expires < today && diffDays(b.expires, today) <= 3 && b.leftNow > 0)', '.filter(b => realB(b) && b.expires < today && b.leftNow > 0)');
  const s = mkWith(B.seed); s.plan = B.O.buildWeek(s, WED, hm('10:00')); const b = s.plan.days[WED].cook.batch;
  B.O.logCook(s, b, { s: 'made', yield: 4 }, WED, hm('17:00'), AT(WED, '17:00')); return B.O.expired(s, '2026-10-08', hm('09:00')).every(x => x.id !== b);
});

console.log('\n8. Cooks are seated by COVERAGE: the Saturday-lunch cascade is gone, a hand «out» leaves no orphan');
{
  const s = week(mk(), WED, 0), r = O.setKind(s, SAT, 'lunch', 'out', WED, 0);
  ok('Saturday lunch → out is accepted', r.ok, r.why);
  ok('…Saturday STILL cooks, and Sun/Mon/Tue are still fed from a pot (not the fridge)', s.plan.days[SAT].cook && [SUN, MON, TUE].every(d => s.plan.days[d].dinner.kind === 'leftover'), JSON.stringify([SAT, SUN, MON, TUE].map(d => s.plan.days[d].dinner.kind)));
  const t = week(mk(), WED, 0), r2 = O.setKind(t, SUN, 'dinner', 'out', WED, 0);
  ok('Sunday dinner → out: Saturday cooks 3, not 4 (no orphan portion, the list doesn\'t over-buy)', r2.ok && t.plan.days[SAT].cook.servings === 3 && eatersOf(t, batchOf(t, SAT)) === 3, t.plan.days[SAT].cook.servings + '/' + eatersOf(t, batchOf(t, SAT)));
  const u = week(mk(), WED, 0), r3 = O.setKind(u, SUN, 'lunch', 'leftover', WED, 0);
  ok('a hand leftover on a slot the rule leaves out is FED: Saturday grows to cover it', r3.ok && u.plan.days[SUN].lunch.kind === 'leftover' && u.plan.days[SAT].cook.servings === 5, JSON.stringify(r3) + ' ' + (u.plan.days[SAT].cook || {}).servings);
  ok('a hand leftover no pot can feed (Wed breakfast, before the first cook) is refused, and the plan is untouched', (() => { const v = week(mk(), WED, 0), h0 = hash(v.plan); const res = O.setKind(v, WED, 'bf', 'leftover', WED, 0); return !res.ok && /olla/.test(res.why) && hash(v.plan) === h0; })());
}
control('re-plant v1\'s leftover-before-cook: a cook day that only covers itself lets Saturday-lunch-out cancel the pot', () => {
  const B = replant('engine', 'const E = eatersIn(d, nextCapable(d), false), own', 'const E = eatersIn(d, addDays(d, 1), false), own');
  const s = mkWith(B.seed); s.plan = B.O.buildWeek(s, WED, 0); B.O.setKind(s, SAT, 'lunch', 'out', WED, 0);
  return s.plan.days[SAT].cook && [SUN, MON, TUE].every(d => s.plan.days[d].dinner.kind === 'leftover');
});
control('re-plant v1\'s coverAhead (reads the rule, not his rows): a hand «out» still gets a portion cooked for it', () => {
  const B = replant('engine', "const k = f.pot[sl]; if (!k) return; if (k === 'cook'", "const k = f.pot[sl] || (f.rows[sl] && f.rows[sl].hand && f.rows[sl].kind === 'out' && sl !== 'bf' && !ruleRow(S, d, sl) ? 'rule' : null); if (!k) return; if (k === 'cook'");
  const t = mkWith(B.seed); t.plan = B.O.buildWeek(t, WED, 0); B.O.setKind(t, SUN, 'dinner', 'out', WED, 0); return t.plan.days[SAT].cook.servings === 3;
});

console.log('\n8b. The swipe budget, hall days, and today\'s slots that already happened');
{
  const s = mk(); s.settings.hall.swipesPerWeek = 6; week(s, MON, 0);
  ok('a week never exceeds its swipe budget', O.swipesUsed(s.plan, O.weekStart(MON)) <= 6, String(O.swipesUsed(s.plan, O.weekStart(MON))));
  ok('trimmed rows say so and fall to the fridge (the LATEST ones go first)', (() => { const tr = []; Object.keys(s.plan.days).sort().forEach(d => O.MEALS.forEach(sl => { if (s.plan.days[d][sl].trimmed) tr.push(d); })); return tr.length > 0 && tr[0] > MON; })());
  ok('the gate agrees', O.validateWeek(s, s.plan, MON, 0).length === 0, JSON.stringify(O.validateWeek(s, s.plan, MON, 0)));
  ok('a swipe on a non-hall day, or for dinner, is refused', !O.setKind(s, SAT, 'lunch', 'swipe', MON, 0).ok && !O.setKind(s, MON, 'dinner', 'swipe', MON, 0).ok);
  const t = week(mk(), WED, hm('13:00')); t.settings.hall.days = [];
  const u = O.buildWeek(t, WED, hm('13:00'));
  ok('today\'s slots behind `now` are kept verbatim when the rule changes (the hall closed): Wed breakfast and lunch stay swipes', u.days[WED].bf.kind === 'swipe' && u.days[WED].lunch.kind === 'swipe' && u.days[THU].lunch.kind !== 'swipe');
}
control('re-plant: 15 swipes in a 14-swipe week must be refused by the gate', () => { const s = mk(); s.settings.hall.days = [0, 1, 2, 3, 4, 5, 6]; week(s, MON, 0); s.settings.hall.swipesPerWeek = 5; return O.validateWeek(s, s.plan, MON, 0).length === 0; });
control('re-plant: a rebuild that re-derives today\'s past slots rewrites what already happened', () => {
  const B = replant('engine', 'if (d === today && r && (effLog(state, d, sl) || slotPast(state, d, sl, today, N)))', 'if (false)');
  const t = mkWith(B.seed); t.plan = B.O.buildWeek(t, WED, hm('13:00')); t.settings.hall.days = []; const u = B.O.buildWeek(t, WED, hm('13:00'));
  return u.days[WED].bf.kind === 'swipe' && u.days[WED].lunch.kind === 'swipe';
});

console.log('\n9. Rotation: three mains until boring, never back-to-back; gear-aware');
const fourWeeks = (O2, seed2, rung, gearPatch) => {
  const s = mkWith(seed2); s.ladder.rung = rung; Object.assign(s.settings.gear, gearPatch || {});
  const cooked = [];
  for (let i = 0; i < 28; i++) {
    const d = O2.addDays(WED, i); s.plan = O2.buildWeek(s, d, 0);
    const c = s.plan.days[d].cook; if (c) { O2.logCook(s, c.batch, { s: 'made' }, d, 1439, AT(d, '20:00')); cooked.push(c.recipe); }
  }
  return cooked;
};
{
  const c2 = fourWeeks(O, seed, 2), distinct = new Set(c2);
  const backToBack = c2.filter((r, i) => i && r === c2[i - 1]).length;
  ok('four weeks at rung 2: ≥3 distinct mains', distinct.size >= 3, c2.join(','));
  ok('…never the same main on two consecutive cook days', backToBack === 0);
  const own = [...distinct].filter(id => O.recipeById({ recipes: seed.recipes }, id).rung === 2), up = c2.map((id, i) => [id, i]).filter(([id]) => O.recipeById({ recipes: seed.recipes }, id).rung === 3);
  ok('…a ROTATION of three at the rung (the 4th enters only on a meh/never), plus the step up at most once a week once 4 were made', own.length === 3 && up.length >= 1 && up.length <= 4, [...distinct].join(',') + ' up×' + up.length);
  const c3 = fourWeeks(O, seed, 3);
  ok('rung 3 without a blender: arroz con pollo (blender) is never planned, nor anything needing missing gear', c3.length > 0 && c3.every(id => id !== 'arroz-con-pollo' && O.gearOk(seed.settings, O.recipeById({ recipes: seed.recipes }, id))), c3.join(','));
  const s = mk(); s.ladder.rung = 2; O.like(s, 'bowl-coreano', 'meh', 1); O.like(s, 'tacos-carne', 'never', 2);
  const cm = (() => { const out = []; for (let i = 0; i < 14; i++) { const d = O.addDays(WED, i); s.plan = O.buildWeek(s, d, 0); const c = s.plan.days[d].cook; if (c) { O.logCook(s, c.batch, { s: 'made' }, d, 1439, AT(d, '20:00')); out.push(c.recipe); } } return out; })();
  ok('«never» leaves the rotation; «meh» lets a 4th main in', cm.indexOf('tacos-carne') < 0 && new Set(cm.filter(x => x !== 'bowl-coreano')).size >= 3, cm.join(','));
  const p = O.pickRecipe(mk(), WED, WED, { now: 0, need: 2 });
  ok('pickRecipe returns a batchable main of the rung', p && p.role === 'main' && p.rung === 1 && O.maxServings(p) >= 2);
}
control('re-plant v1\'s staple-only week: the rotation pin goes red', () => {
  const B = replant('engine', 'return choose(set) || choose(rest) || choose(set.concat(rest), true);', 'return pool.filter(r => r.staple && (r.rung || 1) <= rung).sort((a, b) => b.rung - a.rung)[0] || null;');
  const c2 = fourWeeks(B.O, B.seed, 2); return new Set(c2).size >= 3 && c2.filter((r, i) => i && r === c2[i - 1]).length === 0;
});
control('re-plant v1\'s gear-blind pick: arroz con pollo gets planned without a blender', () => {
  const B = replant('engine', 'const pool = (state.recipes || []).filter(r => batchable(r) && gearOk(S, r) &&', 'const pool = (state.recipes || []).filter(r => batchable(r) && true &&');
  return fourWeeks(B.O, B.seed, 3).every(id => id !== 'arroz-con-pollo');
});

console.log('\n10. The book: every ingredient is in INGREDIENTS with a section; quantities scale; timers and remates');
const bookProblems = (seedObj, table) => {
  const out = [];
  seedObj.recipes.forEach(r => (r.ingredients || []).forEach(g => { const t = table[g.id]; if (!t) out.push(r.id + ':' + g.id + ' missing'); else { if (O.SECTIONS.indexOf(t.section) < 0) out.push(g.id + ' bad section ' + t.section); if (t.unit !== g.u) out.push(r.id + ':' + g.id + ' unit ' + g.u + '≠' + t.unit); } }));
  ['pantry', 'weekly'].forEach(k => seedObj.settings[k].forEach(id => { if (!table[id]) out.push(k + ':' + id + ' missing'); }));
  Object.values(seedObj.settings.fridge).forEach(id => { if (!seedObj.recipes.some(r => r.id === id)) out.push('fridge ' + id + ' missing'); });
  return out;
};
{
  const probs = bookProblems(seed, H.ingredients);
  ok('every seed ingredient id exists in INGREDIENTS, with a Safeway section and the canonical unit', probs.length === 0, probs.join('; '));
  ok('an unknown id is VISIBLE: «sin sección», never a quiet default', O.ingredient('no-such-thing').section === 'sin sección');
  const R = seed.recipes, mains = r => R.filter(x => x.role === 'main' && x.rung === r && O.maxServings(x) >= 2 && x.fridgeDays >= 1).length;
  ok('the book has ≥3 batchable mains at rungs 1, 2, 3 and ≥2 at 4 and 5', mains(1) >= 3 && mains(2) >= 3 && mains(3) >= 3 && mains(4) >= 2 && mains(5) >= 2, [1, 2, 3, 4, 5].map(mains).join(','));
  const need = ['yogur-bowl', 'avena-nocturna', 'revuelto-3', 'tostadas-palta-huevo', 'batido-post', 'arroz-graneado', 'papas-al-horno', 'salsa-criolla', 'aji-verde', 'wrap-pollo-hummus', 'bowl-frijoles-huevo', 'chaufa-express', 'tacos-carne', 'pasta-bolognesa-rapida', 'lentejas', 'chili', 'pollo-guisado', 'pollo-saltado', 'pad-kra-pao', 'arroz-chaufa', 'seco-de-res', 'pollo-brasa-horno', 'salmon-bandeja', 'oyakodon', 'pollo-bandeja', 'arroz-con-pollo', 'tallarin-saltado', 'lomo-saltado', 'aji-de-gallina', 'atun-huevo-bowl', 'pollo-rostizado-bowl', 'bowl-coreano'];
  ok('every v1 id and every §2.5 dish is in the book', need.every(id => R.some(r => r.id === id)), need.filter(id => !R.some(r => r.id === id)).join(','));
  ok('rung-1 mains that are bought-and-assembled say «armar»', O.verbFor(O.recipeById({ recipes: R }, 'pollo-rostizado-bowl')) === 'armar' && O.verbFor(O.recipeById({ recipes: R }, 'bowl-coreano')) === 'cocinar');
  ok('every step is structured {t, min, ing} and every ing index points into the ingredient list', R.every(r => r.steps.every(s => typeof s.t === 'string' && typeof s.min === 'number' && (s.ing || []).every(i => i >= 0 && i < r.ingredients.length))), R.filter(r => !r.steps.every(s => (s.ing || []).every(i => i >= 0 && i < r.ingredients.length))).map(r => r.id).join(','));
  ok('a step that waits carries a timer (arroz con pollo simmers 25 min)', R.find(r => r.id === 'arroz-con-pollo').steps.some(s => s.min === 25) && R.filter(r => r.role === 'main').every(r => r.steps.some(s => s.min > 0) || r.assembly));
  ok('food-safety steps cite USDA FSIS', R.filter(r => r.role === 'main' && r.id !== 'atun-huevo-bowl').every(r => (r.sources || []).some(u => /^https:\/\/www\.fsis\.usda\.gov\//.test(u))), R.filter(r => r.role === 'main' && r.id !== 'atun-huevo-bowl' && !(r.sources || []).some(u => /fsis/.test(u))).map(r => r.id).join(','));
  ok('ají amarillo paste carries where to get it', H.ingredients['aji-amarillo-pasta'].note === "Goya/Inca's Food; tiendas latinas o en línea");
  const s = mk();
  const pr = O.scaleIngredients(s, 'pollo-rostizado-bowl', 2).find(x => x.id === 'pollo-rostizado');
  ok('indivisible rounds UP: half a recipe of rotisserie is still one chicken', pr.q === 1 && pr.text === '1 pollo rostizado', JSON.stringify(pr));
  const ch = O.scaleIngredients(s, 'chili', 12);
  ok('scaled to 12 (double): 1,8 kg of meat, 2 cans of tomato, 4 cans of beans', ch.find(x => x.id === 'carne-molida').display === '1,8 kg' && ch.find(x => x.id === 'tomate-triturado').display === '2 latas' && ch.find(x => x.id === 'frijoles-rojos').q === 4, JSON.stringify(ch.slice(0, 7).map(x => x.display)));
  ok('the display reads like a kitchen: «450 g», «2 latas», «3 dientes»', (() => { const c = O.scaleIngredients(s, 'bowl-coreano', 3); return c[0].display === '450 g' && c.find(x => x.id === 'ajo').display === '3 dientes'; })());
  ok('a v1-shaped recipe {n,q,u} still scales (his edit keeps working)', (() => { const x = O.scaleIngredients(s, { servings: 2, ingredients: [{ q: 1, u: 'lata', n: 'atún' }] }, 4); return x[0].n === 'atún' && x[0].q === 2 && x[0].section === 'sin sección'; })());
  ok('stepTimer: structured min wins; text «N min» / «90 s» / «30–45 min» parse; no number → null', O.stepTimer({ t: 'Hierve', min: 35 }) === 35 && O.stepTimer({ t: 'tapa 5 min', min: 0 }) === null && O.stepTimer('Hierve 10 min') === 10 && O.stepTimer('90 s al microondas') === 1.5 && O.stepTimer('30–45 min a fuego bajo') === 30 && O.stepTimer('sal al gusto') === null);
  const w = week(mk(), WED, 0), b = batchOf(w, SAT), rec = O.recipeById(w, w.plan.days[SAT].cook.recipe);
  const rem = [SAT, SUN, MON, TUE].map(d => O.remateFor(w, b, d));
  ok('remates rotate across the days a pot is eaten', rec.remates.length >= 3 && rem[0] === rec.remates[0] && rem[1] === rec.remates[1] && rem[2] === rec.remates[2], rem.join(' | '));
}
control('re-plant: a recipe using an ingredient missing from INGREDIENTS is CAUGHT by the coverage check', () => { const b = JSON.parse(JSON.stringify(seed)); b.recipes[0].ingredients.push({ id: 'unobtainium', q: 1, u: 'g' }); return bookProblems(b, H.ingredients).length === 0; });
control('re-plant: scaling without the indivisible ceil buys half a chicken', () => { const B = replant('engine', 'let q = (+g.q || 0) * f; q = info.indivisible ? Math.ceil(q - 1e-9) : roundQ(q, u);', 'let q = (+g.q || 0) * f; q = roundQ(q, u);'); const s = mkWith(B.seed); return B.O.scaleIngredients(s, 'pollo-rostizado-bowl', 2).find(x => x.id === 'pollo-rostizado').q === 1; });

console.log('\n11. Shopping trips: buy-by per item, one trip for several cooks, checks per item@trip');
{
  const s = week(mk(), WED, 0), sh = O.shopping(s, WED, 0), trips = sh.trips;
  const chick = [];
  trips.forEach(t => t.items.forEach(it => { if (it.id === 'pollo-rostizado') chick.push({ trip: t.date, at: t.at, buyBy: it.buyBy, q: it.q, key: it.key }); }));
  const deliCooks = Object.keys(s.plan.days).filter(d => s.plan.days[d].cook && O.recipeById(s, s.plan.days[d].cook.recipe).ingredients.some(g => g.id === 'pollo-rostizado'));
  ok('the deli chicken is bought ON its cook day, one trip per cook', deliCooks.length >= 2 && chick.length === deliCooks.length && chick.every(c => c.trip === c.buyBy && deliCooks.indexOf(c.trip) >= 0), JSON.stringify(chick) + ' cooks ' + deliCooks);
  ok('…and the same-day trip fits inside the window, before the cook', deliCooks.every(d => { const c = s.plan.days[d].cook, t = trips.find(x => x.date === d); return t && hm(t.at) + O.tripMinutes(s.settings) <= hm(c.at) && hm(t.at) >= O.windowsFor(s.settings, d)[0].s; }));
  ok('indivisible items round up per cook: a 2-serving rotisserie cook still buys a whole chicken', chick.every(c => c.q === 1));
  const k0 = chick[0].key; O.check(s, k0, true, AT(WED, '13:00'));
  const after = O.shopping(s, WED, 0);
  ok('checking one cook\'s chicken leaves the other cook\'s unchecked', after.trips.find(t => t.date === chick[0].trip).items.find(i => i.id === 'pollo-rostizado').checked && !after.trips.find(t => t.date === chick[1].trip).items.find(i => i.id === 'pollo-rostizado').checked);
  ok('no item is in his pantry, and no trip lists an ingredient twice (unit variants collapse)', trips.every(t => t.items.every(i => s.settings.pantry.indexOf(i.id) < 0) && new Set(t.items.map(i => i.id)).size === t.items.length));
  ok('the weekly staples ride the first trip', s.settings.weekly.every(id => trips[0].items.some(i => i.id === id)));
  ok('items are in Safeway walking order', trips.every(t => t.items.every((it, i) => !i || O.SECTIONS.indexOf(t.items[i - 1].section) <= O.SECTIONS.indexOf(it.section))));
  const r2 = mk(); r2.ladder.rung = 2; week(r2, WED, 0);
  const t2 = O.shopping(r2, WED, 0).trips, cooks2 = Object.keys(r2.plan.days).filter(d => r2.plan.days[d].cook);
  const meat = []; t2.forEach(t => t.items.forEach(i => { if (/carne|pollo|muslo|pechuga|presas|bistec/.test(i.id)) meat.push({ trip: t.date, buyBy: i.buyBy }); }));
  ok('raw meat is never bought more than 2 days before its cook', meat.length > 0 && meat.every(m => O.diffDays(m.trip, m.buyBy) <= 2 && m.trip <= m.buyBy), JSON.stringify(meat));
  ok('one trip covers several cooks inside the horizon (fewer trips than cooks)', t2.length < cooks2.length && t2.some(t => new Set([].concat(...t.items.map(i => i.for)).filter(n => n !== 'cada semana' && !/Batido|yogur|atún/i.test(n))).size >= 2), t2.length + ' trips / ' + cooks2.length + ' cooks');
  const txt = O.listText(s, trips[0]);
  ok('listText is aisle-grouped plain text for the share sheet', /^Safeway · /.test(txt) && txt.indexOf('Frutas y verduras') >= 0 && /\n- /.test(txt), txt.slice(0, 120));
  ok('sh.next is the first trip with something left', sh.next && sh.next.date === trips[0].date);
}
control('re-plant: ignoring buyWithin puts the Saturday chicken on Wednesday\'s trip', () => {
  const B = replant('engine', 'let hi = same ? d : addDays(d, -1), lo = addDays(d, -bw);', 'let hi = same ? d : addDays(d, -1), lo = addDays(d, -30);');
  const s = mkWith(B.seed); s.plan = B.O.buildWeek(s, WED, 0); const ch = [];
  B.O.shopping(s, WED, 0).trips.forEach(t => t.items.forEach(it => { if (it.id === 'pollo-rostizado') ch.push(t.date === it.buyBy); })); return ch.length >= 2 && ch.every(Boolean);
});
control('re-plant v1\'s per-NAME checks: ticking Wednesday\'s chicken ticks every chicken', () => {
  const B = replant('engine', "key = id + '@' + T,", 'key = id,');
  const s = mkWith(B.seed); s.plan = B.O.buildWeek(s, WED, 0); const t = B.O.shopping(s, WED, 0).trips.filter(x => x.items.some(i => i.id === 'pollo-rostizado'));
  B.O.check(s, t[0].items.find(i => i.id === 'pollo-rostizado').key, true, 1); const a = B.O.shopping(s, WED, 0).trips.filter(x => x.items.some(i => i.id === 'pollo-rostizado'));
  return a.length >= 2 && !a[1].items.find(i => i.id === 'pollo-rostizado').checked;
});

console.log('\n12. project() — the frozen `pub` contract the city and the Worker read');
{
  const s = week(mk(), WED, hm('10:00')), pub = O.project(s, WED, hm('10:00'), AT(WED, '10:00'));
  const nums = []; (function walk(o, p) { if (typeof o === 'number') nums.push([p, o]); else if (o && typeof o === 'object') Object.keys(o).forEach(k => walk(o[k], p + '.' + k)); })(pub, 'pub');
  ok('every number in pub is an INTEGER (Swift decodes Int)', nums.every(([, v]) => Number.isInteger(v)), nums.filter(([, v]) => !Number.isInteger(v)).map(x => x.join('=')).join(' '));
  ok('v 2, the publisher\'s local day, seven days present', pub.v === 2 && pub.day === WED && Object.keys(pub.days).length === 7);
  ok('every meal min is clamped [10,180]; a cook dinner bills eating only (20)', Object.values(pub.days).every(d => O.MEALS.every(sl => d[sl].min >= 10 && d[sl].min <= 180)) && pub.days[WED].dinner.min === 20);
  ok('sub ≤ 60 chars; store hours in minutes', Object.values(pub.days).every(d => O.MEALS.every(sl => d[sl].sub.length <= 60)) && pub.store.open === 360 && pub.store.close === 1320);
  ok('a leftover of a batch that is only PLANNED says real:false', pub.days[THU].dinner.kind === 'leftover' && pub.days[THU].dinner.real === false);
  ok('the cook carries its window, verb, minutes and state', pub.days[WED].cook && pub.days[WED].cook.win[0] === hm('13:00') && pub.days[WED].cook.win[1] === hm('17:30') && pub.days[WED].cook.state === 'planned' && /^(armar|cocinar)$/.test(pub.days[WED].cook.verb));
  ok('a shop day carries the in-store minutes, the count and the dishes', Object.values(pub.days).some(d => d.shop && d.shop.min === 30 && d.shop.n > 0 && d.shop.for.length > 0));
  ok('post is PWA-only: not in pub', Object.values(pub.days).every(d => !('post' in d)));
  O.logCook(s, batchOf(s, WED), { s: 'made' }, WED, hm('17:00'), AT(WED, '17:00'));
  ok('once made, the leftover is real:true and the pot lists it', (() => { const p = O.project(s, WED, hm('17:00'), AT(WED, '17:00')); return p.days[THU].dinner.real === true && p.pot.length === 1 && p.pot[0].left === 2; })());
  delete s.plan.days[FRI];
  ok('a day the engine cannot project is OMITTED, never emitted with defaults', !(FRI in O.project(s, WED, hm('17:00'), AT(WED, '17:00')).days));
}
control('re-plant: a projection that emits defaults for a missing day', () => {
  const B = replant('engine', 'if (!day || !MEALS.every(sl => day[sl] && day[sl].kind)) continue;', 'if (!day) { pub.days[d] = { train: false, bf: { kind: "home" }, lunch: { kind: "home" }, dinner: { kind: "home" }, cook: null, shop: null }; continue; }');
  const s = mkWith(B.seed); s.plan = B.O.buildWeek(s, WED, 0); delete s.plan.days[FRI]; return !(FRI in B.O.project(s, WED, 0, 1).days);
});

console.log('\n13. mergeReality — two devices, nothing lost, the later entry wins, the plan untouched');
{
  const a = week(mk(), WED, hm('21:00')), b = JSON.parse(JSON.stringify(a)), planA = hash(a.plan);
  O.logMeal(a, WED, 'lunch', { s: 'skipped' }, WED, hm('21:00'), AT(WED, '13:00'));
  O.logMeal(b, WED, 'dinner', { s: 'out', what: 'con Ana' }, WED, hm('21:00'), AT(WED, '20:00'));
  O.logMeal(a, WED, 'bf', { s: 'ate' }, WED, hm('21:00'), AT(WED, '09:00'));
  O.logMeal(b, WED, 'bf', { s: 'skipped' }, WED, hm('21:00'), AT(WED, '09:30'));
  O.check(a, 'leche@' + WED, true, AT(WED, '11:00')); O.like(b, 'chili', 'again', AT(WED, '12:00'));
  b.plan.days[THU].dinner = { kind: 'out', hand: true };
  const n = O.mergeReality(a, b), n2 = O.mergeReality(b, a);
  ok('both devices\' slots survive the merge, both ways', O.effLog(a, WED, 'lunch').s === 'skipped' && O.effLog(a, WED, 'dinner').s === 'out' && O.effLog(b, WED, 'lunch').s === 'skipped', n + '/' + n2);
  ok('on the same slot the later `at` wins, on both devices', O.effLog(a, WED, 'bf').s === 'skipped' && O.effLog(b, WED, 'bf').s === 'skipped');
  ok('checks and likes merge by key', a.groceries.checked['leche@' + WED].v === true && a.likes.chili.v === 'again' && b.groceries.checked['leche@' + WED].v === true);
  ok('mergeReality never touches the plan', hash(a.plan) === planA);
  ok('merging again adds nothing (idempotent)', O.mergeReality(a, b) === 0 && O.mergeReality(b, a) === 0);
}
control('re-plant v1\'s whole-file last-write-wins: the other device\'s slot is lost', () => {
  const B = replant('engine', "        A[k] = al;\n      });", "        A[k] = bl.length ? bl : al;\n      });");
  const a = mkWith(B.seed); a.plan = B.O.buildWeek(a, WED, hm('21:00')); const b = JSON.parse(JSON.stringify(a));
  B.O.logMeal(a, WED, 'bf', { s: 'ate' }, WED, hm('21:00'), AT(WED, '09:00')); B.O.logMeal(b, WED, 'bf', { s: 'skipped' }, WED, hm('21:00'), AT(WED, '09:30'));
  B.O.mergeReality(b, a); return a.log[WED + ':bf'].length === 1 && b.log[WED + ':bf'].length === 2;
});

console.log('\n14. Migration 1 → 2: on load AND every pull, idempotent; the v1 snapshot is written once');
const v1Snapshot = () => {
  const v1 = JSON.parse(fs.readFileSync(__dirname + '/test-fixtures/olla-v1-state.json', 'utf8'));
  return v1;
};
{
  const L = load(), raw = v1Snapshot();
  const m = L.H.appMigrate(JSON.parse(JSON.stringify(raw)));
  ok('schema 2', m.schema === 2 && L.H.OLLA_SCHEMA === 2);
  ok('log {s,ts} → [{s, at}] (ate/skipped keep their meaning)', Array.isArray(m.log['2026-09-29:dinner']) && m.log['2026-09-29:dinner'][0].s === 'ate' && m.log['2026-09-29:dinner'][0].at === raw.log['2026-09-29:dinner'].ts);
  ok('cooks, extra, likes exist; cookSession survives as null', m.cooks && m.extra && m.likes && m.cookSession === null);
  ok('v1\'s name-keyed checks are dropped without throwing', JSON.stringify(m.groceries) === '{"checked":{}}');
  ok('his settings survive; new fields arrive from the seed (merge, never assign)', m.settings.hall.swipesPerWeek === raw.settings.hall.swipesPerWeek && m.settings.hall.closes === '18:00' && m.settings.eatAt.dinner === '19:00' && m.settings.store.name === 'Safeway' && m.settings.fridge.post === 'batido-post' && !('feed' in m.settings));
  ok('pantry/weekly NAMES become ingredient ids', JSON.stringify(m.settings.pantry) === JSON.stringify(seed.settings.pantry) && m.settings.weekly.indexOf('yogur-griego') >= 0, JSON.stringify(m.settings.pantry));
  ok('v1 seed recipes he never edited become their v2 versions (structured steps)', m.recipes.find(r => r.id === 'chili').steps[0].t !== undefined && m.recipes.find(r => r.id === 'pollo-rostizado-bowl').role === 'main');
  ok('a recipe he EDITED keeps his words, and gains only the fields v1 never had', (() => { const r = m.recipes.find(x => x.id === 'lomo-saltado'); return typeof r.steps[0] === 'string' && /MI lomo/.test(r.steps[0]) && r.role === 'main'; })());
  ok('the new dishes are added', seed.recipes.every(r => m.recipes.some(x => x.id === r.id)));
  ok('pub is deleted on the way in', !('pub' in L.H.appMigrate(Object.assign(JSON.parse(JSON.stringify(raw)), { pub: { v: 2 } }))));
  ok('running it twice changes nothing', hash(L.H.appMigrate(JSON.parse(JSON.stringify(m)))) === hash(m));
  ok('the raw schema-1 state was written once to olla.v1.pre-schema2', JSON.parse(L.ls.getItem('olla.v1.pre-schema2')).schema === 1 && JSON.parse(L.ls.getItem('olla.v1.pre-schema2')).log['2026-09-29:dinner'].ts === raw.log['2026-09-29:dinner'].ts);
  const other = JSON.parse(JSON.stringify(raw)); other.settings.hall.swipesPerWeek = 3; L.H.appMigrate(other);
  ok('…and a second schema-1 migration (a pulled copy) does not overwrite it', JSON.parse(L.ls.getItem('olla.v1.pre-schema2')).settings.hall.swipesPerWeek === raw.settings.hall.swipesPerWeek);
  ok('a fresh install writes no snapshot', (() => { const F = load(); F.H.appMigrate(F.H.appDefaultState()); return F.ls.getItem('olla.v1.pre-schema2') === null; })());
  const p = O.buildWeek(m, WED, 0);
  ok('the migrated state plans a valid week', O.validateWeek(Object.assign({}, m, { plan: p }), p, WED, 0).length === 0, JSON.stringify(O.validateWeek(Object.assign({}, m, { plan: p }), p, WED, 0)));
  const cuaderno = { settings: { theme: 'forge' }, exercises: [], sessions: [], bodyweight: [], plan: null, schema: 2 };
  const lampara = { settings: {}, reading: { bookId: 'john', ch: 1 }, notes: [], read: {} };
  ok('looksLikeMyState refuses cuaderno.json and lampara.json, accepts ours', !L.H.looksLikeMyState(cuaderno) && !L.H.looksLikeMyState(lampara) && L.H.looksLikeMyState(m));
}
control('re-plant: a migration that treats every v1 recipe as edited never upgrades the book', () => {
  const B = replant('hooks', "if (v1Shape && OLLA_V1_SEED_HASH[r.id] === ollaHash(JSON.stringify([r.id, r.name, r.steps])))", 'if (false)');
  return B.H.appMigrate(v1Snapshot()).recipes.find(r => r.id === 'chili').steps[0].t !== undefined;
});
control('re-plant: a migration that treats every v1 recipe as unedited overwrites his lomo saltado', () => {
  const B = replant('hooks', "if (v1Shape && OLLA_V1_SEED_HASH[r.id] === ollaHash(JSON.stringify([r.id, r.name, r.steps])))", 'if (v1Shape)');
  return typeof B.H.appMigrate(v1Snapshot()).recipes.find(r => r.id === 'lomo-saltado').steps[0] === 'string';
});
control('re-plant: a snapshot written on every migration overwrites his only copy with a pulled one', () => {
  const B = replant('hooks', "if (typeof localStorage !== 'undefined' && !localStorage.getItem(OLLA_PRE_SCHEMA2_KEY))", "if (typeof localStorage !== 'undefined')");
  const raw = v1Snapshot(); B.H.appMigrate(JSON.parse(JSON.stringify(raw))); const other = JSON.parse(JSON.stringify(raw)); other.settings.hall.swipesPerWeek = 3; B.H.appMigrate(other);
  return JSON.parse(B.ls.getItem('olla.v1.pre-schema2')).settings.hall.swipesPerWeek === raw.settings.hall.swipesPerWeek;
});

console.log('\n15. nextAction — the precedence table, one pin per row');
const NA = (s, d, t) => O.nextAction(s, d, hm(t));
const precedence = O2 => {
  const res = {};
  const a = mkWith(seed); a.plan = O2.buildWeek(a, WED, hm('10:00')); a.plan = O2.buildWeek(a, THU, hm('08:00'));
  res.confirm = O2.nextAction(a, THU, hm('08:30')).kind;                                                  // Wed unconfirmed + Thu breakfast due
  const b = mkWith(seed); b.plan = O2.buildWeek(b, WED, hm('10:00')); const at = hm(b.plan.days[WED].cook.at);
  res.cookNow = O2.nextAction(b, WED, at - 10).kind;
  res.cookSoon = O2.nextAction(b, WED, hm('10:20')).kind;
  O2.logCook(b, b.plan.days[WED].cook.batch, { s: 'made' }, WED, hm('17:00'), AT(WED, '17:00'));
  res.eat = O2.nextAction(b, WED, hm('19:10')).kind;
  res.rescue = O2.nextAction(b, WED, hm('20:35')).kind;
  const c = mkWith(seed); c.plan = O2.buildWeek(c, WED, hm('10:00')); O2.logCook(c, c.plan.days[WED].cook.batch, { s: 'notmade' }, WED, hm('16:00'), AT(WED, '16:00'));
  res.rescueEmpty = O2.nextAction(c, WED, hm('18:00')).kind;
  const d = mkWith(seed); d.plan = O2.buildWeek(d, WED, hm('10:00')); O2.logCook(d, d.plan.days[WED].cook.batch, { s: 'made' }, WED, hm('17:00'), AT(WED, '17:00'));
  d.plan = O2.buildWeek(d, THU, hm('08:00')); O2.logMeal(d, THU, 'dinner', { s: 'ate' }, THU, hm('21:00'), AT(THU, '21:00'));
  res.shopTomorrow = O2.nextAction(d, THU, hm('21:00')).kind;
  const e = mkWith(seed); e.plan = O2.buildWeek(e, SUN, hm('10:00'));
  res.idle = O2.nextAction(e, SUN, hm('15:00')).kind;
  O2.logMeal(e, SUN, 'dinner', { s: 'ate' }, SUN, hm('23:00'), AT(SUN, '23:00'));
  res.tomorrow = O2.nextAction(e, SUN, hm('23:00')).kind;
  return res;
};
{
  const r = precedence(O);
  ok('a pending question beats everything (Thu 08:30, Wed unconfirmed, breakfast due)', r.confirm === 'confirm-cook', r.confirm);
  ok('cook-now from 15 min before the start', r.cookNow === 'cook-now', r.cookNow);
  ok('cook-soon when the cook is later today and nothing else is due', r.cookSoon === 'cook-soon', r.cookSoon);
  ok('eat at dinner time when food exists', r.eat === 'eat', r.eat);
  ok('rescue when dinner is unresolved an hour past its time', r.rescue === 'rescue', r.rescue);
  ok('rescue as soon as the dinner\'s pot is known empty (cook not made)', r.rescueEmpty === 'rescue', r.rescueEmpty);
  ok('shop: tomorrow\'s trip after 18:00', r.shopTomorrow === 'shop', r.shopTomorrow);
  ok('tomorrow after 22:00', r.tomorrow === 'tomorrow', r.tomorrow);
  ok('idle when nothing is due', r.idle === 'idle', r.idle);
  const s = week(mk(), FRI, hm('10:30')), cs = O.nextAction(s, FRI, hm('10:30'));
  ok('Fri 10:30, a cook later today whose groceries aren\'t bought: cook-soon, carrying the trip that has to happen first', cs.kind === 'cook-soon' && cs.trip && cs.trip.date === FRI && cs.trip.items.some(i => i.for.indexOf(O.recipeById(s, cs.recipe).name) >= 0), JSON.stringify(cs).slice(0, 160));
}
control('re-plant: «eat» checked before the pending question hides the «¿se hizo?»', () => {
  const B = replant('engine', '    const q = questions(state, today, N);\n    if (q.length) return Object.assign({ kind: \'confirm-cook\' }, q[q.length - 1]);\n', '');
  return precedence(B.O).confirm === 'confirm-cook';
});

console.log('\n16. rescue — ordered, the store only while it\'s open, never empty');
{
  const s = week(mk(), WED, hm('10:00')); O.logCook(s, batchOf(s, WED), { s: 'made' }, WED, hm('17:00'), AT(WED, '17:00'));
  s.settings.orders = ['Chipotle: bowl de pollo'];
  const r = O.rescue(s, WED, hm('20:00')).map(x => x.kind);
  ok('order: pot → home → store → order', r.join(',') === 'pot,home,store,order', r.join(','));
  ok('the store offer names the rotisserie and the closing hour', O.rescue(s, WED, hm('20:00')).find(x => x.kind === 'store').until === '22:00');
  ok('21:45 — closes at 22:00, 30 min margin: no store', O.rescue(s, WED, hm('21:45')).every(x => x.kind !== 'store'));
  ok('never empty: the fridge default is always there', O.rescue(mk(), WED, hm('23:30')).some(x => x.kind === 'home'));
}
control('re-plant: a store offer until the door closes sends him at 21:45', () => {
  const B = replant('engine', 'if (N >= open && N <= close - 30) out.push(', 'if (N >= open && N <= close) out.push(');
  const s = mkWith(B.seed); s.plan = B.O.buildWeek(s, WED, 0); return B.O.rescue(s, WED, hm('21:45')).every(x => x.kind !== 'store');
});

console.log('\n17. weekRegister counts only slots behind us; names the slot, never a score');
{
  const s = week(mk(), WED, hm('13:00'));
  O.logMeal(s, WED, 'lunch', { s: 'skipped' }, WED, hm('13:00'), AT(WED, '13:00'));
  const r = O.weekRegister(s, O.weekStart(WED), WED, hm('13:00'));
  ok('Wed 13:00: breakfast and lunch seated, dinner not yet', r.bf.seated === 1 && r.lunch.seated === 1 && r.dinner.seated === 0, JSON.stringify(r));
  ok('the skipped lunch is counted as skipped; silent breakfast as eaten (as planned)', r.lunch.skipped === 1 && r.bf.ate === 1);
  const t = week(mk(), WED, hm('10:00')); const r2 = O.weekRegister(t, O.weekStart(THU), THU, hm('23:59'));
  ok('a pot meal of a never-confirmed cook is UNKNOWN, not eaten', r2.dinner.unknown >= 1 && r2.dinner.ate === 0, JSON.stringify(r2.dinner));
}
control('re-plant: a register that counts the future seats tonight\'s dinner at 13:00', () => {
  const B = replant('engine', "const r = day[sl]; if (!r || !slotPast(state, d, sl, today, now)) return;\n        out[sl].seated++;", "const r = day[sl]; if (!r) return;\n        out[sl].seated++;");
  const s = mkWith(B.seed); s.plan = B.O.buildWeek(s, WED, hm('13:00')); return B.O.weekRegister(s, B.O.weekStart(WED), WED, hm('13:00')).dinner.seated === 0;
});

console.log('\n18. The rung is passed by CODE — and rung 1 (assembly) is passable');
const ladderRun = (O2, seed2, eatHow) => {
  const s = mkWith(seed2); s.ladder.rung = 1;
  for (let i = 0; i < 14; i++) {
    const d = O2.addDays(WED, i); s.plan = O2.buildWeek(s, d, 0); const c = s.plan.days[d].cook;
    if (c) O2.logCook(s, c.batch, eatHow === 'bought' ? { s: 'notmade' } : { s: 'made' }, d, 1439, AT(d, '20:00'));
    if (eatHow === 'bought' && c) O2.logMeal(s, d, 'dinner', { s: 'other', what: 'pollo rostizado comprado', left: 2, src: 'bought', recipe: 'pollo-rostizado-bowl' }, d, 1439, AT(d, '21:00'));
  }
  return O2.rungCheck(s, O2.addDays(WED, 13), 1439);
};
{
  const c = ladderRun(O, seed, 'made');
  ok('two weeks of rung-1 pots (assembly mains included) pass the rung', c.pass && c.n >= 6 && c.span >= 10, JSON.stringify(c));
  const b = ladderRun(O, seed, 'bought');
  ok('the same two weeks eaten as bought food / fridge defaults never pass', !b.pass && b.n === 0, JSON.stringify(b));
  const s = mk(); for (let i = 0; i < 6; i++) O.logMeal(s, WED, 'bf', { s: 'ate' }, WED, 1439, AT(WED, '09:0' + i));
  ok('rungUp refuses an un-passed rung (never asserted)', !O.rungUp(s, WED, 1439).pass && s.ladder.rung === 1);
}
control('re-plant: a rung check that counts bought food passes a rung he never cooked', () => {
  const B = replant('engine', "        if (b.src === 'bought' || b.src === 'other') return;\n", '');
  return !ladderRun(B.O, B.seed, 'bought').pass;
});

console.log('\n19. Service workers delete only their OWN caches (every sibling shares one origin)');
const swFilter = file => { const src = fs.readFileSync(file, 'utf8'); const m = /keys\.filter\((k => .*?)\)\.map\(/.exec(src); const name = /const CACHE_NAME = '([^']+)'/.exec(src)[1]; const pre = /const CACHE_PREFIX = ([^;]+);/.exec(src); const CACHE_PREFIX = pre ? new Function('CACHE_NAME', 'return ' + pre[1])(name) : undefined; return { f: new Function('CACHE_NAME', 'CACHE_PREFIX', 'return ' + m[1])(name, CACHE_PREFIX), name }; };
const SIBS = ['cuaderno-v7', 'cuaderno-media-v1', 'lampara-v12', 'bitacora-v4', 'olla-v1', 'olla-v2'];
{
  const { f, name } = swFilter(__dirname + '/sw.js'), del = SIBS.concat([name]).filter(f);
  ok('olla\'s sw deletes its own old caches and nobody else\'s', del.join(',') === 'olla-v1,olla-v2' && name === 'olla-v3', del.join(',') + ' (CACHE_NAME ' + name + ')');
  const shell = __dirname + '/../app-shell/sw.js';
  if (fs.existsSync(shell)) { const s = swFilter(shell), d2 = SIBS.concat(['app-shell-v1', s.name]).filter(s.f); ok('app-shell\'s template derives its prefix from CACHE_NAME the same way', d2.join(',') === 'app-shell-v1', d2.join(',')); }
}
control('re-plant v1\'s activate filter: La Forja\'s caches die on every olla deploy', () => { const f = new Function('CACHE_NAME', 'return k => k !== CACHE_NAME')('olla-v3'); return SIBS.filter(f).join(',') === 'olla-v1,olla-v2'; });

console.log('\n20. Sync (the shell): pull merges reality both ways and saves without a push; push GETs first, PATCHes olla.json only');
function syncRig(local, remote, syncSrc) {
  const L = load(), calls = [], saves = [];
  const gist = { files: remote ? { 'olla.json': { content: JSON.stringify(remote) } } : {} };
  L.ctx.__calls = calls; L.ctx.__saves = saves; L.ctx.__gist = gist; L.ctx.__local = local;
  const stubs = [
    "var GIST_FILENAME = 'olla.json';",
    'var suppressSync = false;',
    'function isSyncEnabled() { return true; }',
    'function setSyncPipState() {}',
    'function toast() {}',
    'function renderAll() {}',
    'function losErr() {}',
    "function migrate(s) { s.settings = s.settings || {}; s.settings.sync = s.settings.sync || { enabled: false }; s.settings.claude = s.settings.claude || { model: 'm' }; s.lastModified = s.lastModified || 1; return appMigrate(s); }",
    'function save(o) { __saves.push(o || {}); }',
    'var fetch = async function (url, opts) {',
    '  __calls.push({ url, method: opts.method, cache: opts.cache, body: opts.body ? JSON.parse(opts.body) : null });',
    "  if (opts.method === 'GET') { const g = JSON.parse(JSON.stringify(__gist)); return { ok: true, json: async () => g }; }",
    '  const b = JSON.parse(opts.body); Object.keys(b.files).forEach(k => { __gist.files[k] = { content: b.files[k].content }; }); return { ok: true, json: async () => ({}) };',
    '};',
    'let state = __local;',
  ].join('\n');
  vm.runInContext(stubs + '\n' + (syncSrc || SYNC) + '\nthis.api = { syncPull, syncPush, cleanStateForSync, get: () => state };', L.ctx);
  return { api: L.ctx.api, calls, saves, gist };
}
const syncState = () => { const s = week(mk(), WED, hm('09:00')); s.settings.sync = { enabled: true, githubPat: 'ghp_SECRET', gistId: 'g1', lastSyncedAt: 0 }; s.settings.claude = { model: 'm', apiKey: 'sk-SECRET' }; return s; };
const syncCase = async (syncSrc) => {
  const out = {};
  { // A — the remote is NEWER: adopt its settings, keep this device's log entry
    const local = syncState(), remote = JSON.parse(JSON.stringify(local));
    O.logMeal(local, WED, 'lunch', { s: 'skipped' }, WED, hm('13:00'), AT(WED, '13:00')); local.lastModified = 100;
    O.logMeal(remote, WED, 'bf', { s: 'ate' }, WED, hm('09:00'), AT(WED, '09:00')); remote.settings.hall.swipesPerWeek = 9; remote.lastModified = 200; remote.pub = { v: 2, stale: true };
    delete remote.settings.sync; remote.settings.claude = { model: 'm' };
    const R = syncRig(local, remote, syncSrc), need = await R.api.syncPull(), st = R.api.get();
    out.adopt = st.settings.hall.swipesPerWeek === 9 && st.settings.sync.gistId === 'g1';
    out.keepMine = !!(O.effLog(st, WED, 'lunch') && O.effLog(st, WED, 'bf'));
    out.needPush = need === true;
    out.noPub = !('pub' in st);
    out.quietSaves = R.saves.length > 0 && R.saves.every(o => o.markModified === false && o.push === false);
    out.noStore = R.calls.length > 0 && R.calls.every(c => c.cache === 'no-store');
  }
  { // B — the local copy is NEWER: keep its settings, take the remote's log entry
    const local = syncState(), remote = JSON.parse(JSON.stringify(local));
    O.logMeal(remote, WED, 'bf', { s: 'ate' }, WED, hm('09:00'), AT(WED, '09:00')); remote.settings.hall.swipesPerWeek = 9; remote.lastModified = 100; local.lastModified = 200;
    const R = syncRig(local, remote, syncSrc), need = await R.api.syncPull(), st = R.api.get();
    out.localWins = st.settings.hall.swipesPerWeek === 14 && !!O.effLog(st, WED, 'bf') && need === true;
  }
  { // C — push: GET first, union what another device wrote since, PATCH olla.json only, with pub and without secrets
    const local = syncState(), remote = JSON.parse(JSON.stringify(local)); local.lastModified = 200; remote.lastModified = 100;
    O.logMeal(local, WED, 'lunch', { s: 'skipped' }, WED, hm('13:00'), AT(WED, '13:00'));
    O.logMeal(remote, WED, 'bf', { s: 'ate' }, WED, hm('09:00'), AT(WED, '09:00'));
    const R = syncRig(local, remote, syncSrc); await R.api.syncPush();
    const methods = R.calls.map(c => c.method).join(','), patch = R.calls.find(c => c.method === 'PATCH');
    const content = patch && patch.body.files['olla.json'] && patch.body.files['olla.json'].content, pushed = content && JSON.parse(content);
    out.getFirst = methods === 'GET,PATCH';
    out.onlyOlla = !!patch && JSON.stringify(Object.keys(patch.body.files)) === JSON.stringify(['olla.json']);
    out.union = !!(pushed && O.effLog(pushed, WED, 'bf') && O.effLog(pushed, WED, 'lunch'));
    out.pub = !!(pushed && pushed.pub && pushed.pub.v === 2 && typeof pushed.pub.day === 'string');
    out.noSecrets = !!content && !/ghp_SECRET|sk-SECRET/.test(content);
  }
  return out;
};
const redIf = (name, stayedGreen) => { if (!stayedGreen) { pass++; console.log('  red  (control) ' + name); } else { fail++; console.log('  FAIL (control stayed green) ' + name); } };
(async () => {
  const r = await syncCase();
  ok('pull, remote newer: adopts its settings and keeps this device\'s sync credentials', r.adopt);
  ok('…and keeps this device\'s log entry (reality is merged, never overwritten)', r.keepMine);
  ok('…and says a push is needed (the gist lacks that entry)', r.needPush);
  ok('…the remote\'s pub is deleted on the way in', r.noPub);
  ok('…the re-derived week is saved WITHOUT a push and without marking it modified', r.quietSaves);
  ok('every gist request is cache:no-store (GitHub serves gist GETs max-age=60)', r.noStore);
  ok('pull, local newer: keeps its settings, takes the remote\'s entry, asks to push', r.localWins);
  ok('push GETs first, then PATCHes', r.getFirst);
  ok('push PATCHes olla.json ONLY', r.onlyOlla);
  ok('push carries the union of both devices\' entries', r.union);
  ok('push carries pub (v2, the local day)', r.pub);
  ok('push never carries the PAT or the API key', r.noSecrets);
  redIf('re-plant v1\'s pull (adopt the remote wholesale): this device\'s entry is lost', (await syncCase(replant('sync', 'needPush = OLLA.mergeReality(remote, mine) > 0;', 'needPush = false;').SYNC)).keepMine);
  redIf('re-plant v1\'s blind push: the other device\'s entry is erased by the PATCH', (await syncCase(replant('sync', 'if (looksLikeMyState(remoteState) && OLLA.mergeReality(state, migrate(remoteState)) > 0) {', 'if (false) {').SYNC)).union);
  redIf('re-plant: a gistFetch without no-store is SEEN', (await syncCase(replant('sync', "    cache: 'no-store',", '').SYNC)).noStore);
  finish();
})().catch(e => { fail++; console.log('  FAIL sync rig crashed — ' + ((e && e.stack) || e)); finish(); });

function finish() {
console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) { console.log('test-olla: FAIL'); process.exit(1); }
console.log('test-olla: OK');
}
