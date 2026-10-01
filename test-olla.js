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
const BLIND = /^re-plant /;   // the re-plant itself failed: the control never ran the defect, so a throw here is not a red
function control(name, fn) { let red = false, msg = ''; try { red = !fn(); } catch (e) { if (BLIND.test(e.message)) { fail++; console.log('  FAIL (control is BLIND — ' + e.message.slice(0, 90) + ') ' + name); return; } red = true; msg = ' (threw: ' + e.message + ')'; } if (red) { pass++; console.log('  red  (control) ' + name + msg); } else { fail++; console.log('  FAIL (control stayed green) ' + name); } }
function plant(src, find, repl) { once(src, find, 're-plant anchor'); const b = src.replace(find, repl); if (b === src) throw new Error('re-plant changed nothing: ' + find.slice(0, 60)); return b; }
const SAT0 = '2026-09-26', WED = '2026-09-30', THU = '2026-10-01', FRI = '2026-10-02', SAT = '2026-10-03', SUN = '2026-10-04', MON = '2026-10-05', TUE = '2026-10-06', TUE0 = '2026-09-29';
const hm = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
const OLLA_hm = s => (s == null ? NaN : hm(String(s)));
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
  control('re-plant: a Date.now() in the engine is SEEN by the purity check', () => !clock(plant(ENGINE, "const numNow = now =>", "const _t = Date.now(); const numNow = now =>")));
  const API = ['ymd', 'parse', 'addDays', 'dow', 'diffDays', 'weekStart', 'isoWeek', 'hm', 'fmtHM', 'slotsFor', 'eatAt', 'recipeById', 'ingredient', 'eligible', 'maxServings', 'verbFor',
    'reality', 'potNow', 'expired', 'cookState', 'questions', 'buildWeek', 'validateWeek', 'setKind', 'nextKind', 'setCookRecipe', 'backToRule', 'logMeal', 'logCook', 'freeze', 'like',
    'effLog', 'effCook', 'pickRecipe', 'scaleIngredients', 'stepTimer', 'remateFor', 'shopping', 'check', 'listText', 'rescue', 'nextAction', 'weekRegister', 'minutesFor', 'slotLabel',
    'project', 'mergeReality', 'rungCheck', 'rungUp', 'addBatch'];
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
  ok('training nights get the fourth meal (batido-post), and only training nights', s.plan.days[THU].post && s.plan.days[THU].post.recipe === 'batido-post' && !s.plan.days[WED].post && !s.plan.days[SAT].post);
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
ok('a cook row with an unknown recipe is refused by the gate', (() => { const s = week(mk(), WED, 0); s.plan.days[WED].cook.recipe = 'no-such-dish'; return O.validateWeek(s, s.plan, WED, 0).some(x => x.code === 'unknown-recipe'); })());
control('re-plant: a gate without its unknown-recipe check lets a dish that is not in the book through', () => {
  const B = replant('engine', "if (!rec) push(d, 'cook', 'unknown-recipe', 'receta desconocida: ' + day.cook.recipe);", 'if (!rec) {}');
  const s = mkWith(B.seed); s.plan = B.O.buildWeek(s, WED, 0); s.plan.days[WED].cook.recipe = 'no-such-dish'; return B.O.validateWeek(s, s.plan, WED, 0).some(x => x.code === 'unknown-recipe');
});

console.log('\n2. Windows: start AND end, and today\'s window closes at `now`');
{
  const s = week(mk(), WED, 0);
  const r = O.setKind(s, MON, 'dinner', 'cook', WED, 0);
  ok('Monday (no window) cook refused', !r.ok && /ventana/.test(r.why), r.why);
  const t = week(mk(), WED, 0), tot = O.recipeById(t, t.plan.days[WED].cook.recipe).minutes.total, late = O.fmtHM(hm('17:30') - tot + 10);
  t.plan.days[WED].cook.at = late;
  ok('a cook starting at ' + late + ' that runs ' + tot + ' min (ends 10 min after the window) is refused on a 13:00–17:30 window', O.validateWeek(t, t.plan, WED, 0).some(x => x.code === 'no-window'));
  const u = mk(); u.settings.cookAt = { '3': '17:00' };
  const c = O.cookSlot(u, WED, O.recipeById(u, 'pasta-bolognesa-rapida'), WED, 0);
  ok('cookAt is clamped into the window, and a dish that would end after it does not fit', c === null && O.cookSlot(u, WED, O.recipeById(u, 'bowl-frijoles-huevo'), WED, 0).at === hm('17:00'));
  week(u, WED, 0);
  ok('the planner seats Wednesday only with a dish that ends by 17:30', !u.plan.days[WED].cook || hm(u.plan.days[WED].cook.at) + O.recipeById(u, u.plan.days[WED].cook.recipe).minutes.total <= hm('17:30'), JSON.stringify(u.plan.days[WED].cook));
}
control('re-plant v1\'s start-only window check: a cook that runs past 17:30 must still be refused', () => {
  const B = replant('engine', 'if (at == null || !windowsFor(S, d).some(w => at >= w.s && at + tot <= w.e))', 'if (at == null || !windowsFor(S, d).some(w => at >= w.s && at + 1 <= w.e))');
  const t = B.O.buildWeek(mkWith(B.seed), WED, 0); const s = mkWith(B.seed); s.plan = t; s.plan.days[WED].cook.at = B.O.fmtHM(hm('17:30') - B.O.recipeById(s, t.days[WED].cook.recipe).minutes.total + 10);
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
  ok('cookState walks planned → due → cooking (through the end of its window) → unconfirmed → made', (() => { const t = week(mk(), WED, 0), at = hm(t.plan.days[WED].cook.at), tot = O.recipeById(t, t.plan.days[WED].cook.recipe).minutes.total;
    const a = [O.cookState(t, WED, WED, at - 30), O.cookState(t, WED, WED, at - 10), O.cookState(t, WED, WED, at + 1), O.cookState(t, WED, WED, at + tot), O.cookState(t, WED, WED, hm('17:30'))];
    O.logCook(t, batchOf(t, WED), { s: 'made' }, WED, hm('17:30'), AT(WED, '17:30')); a.push(O.cookState(t, WED, WED, hm('17:30'))); return a.join(',') === 'planned,due,cooking,cooking,unconfirmed,made'; })(), 'at ' + (week(mk(), WED, 0).plan.days[WED].cook || {}).at);
  const t = week(mk(), WED, hm('10:00'));
  const r = O.logMeal(t, THU, 'dinner', { s: 'ate' }, THU, hm('19:30'), AT(THU, '19:30'));
  ok('eating a portion of an unconfirmed pot confirms it (the pot existed)', r.ok && O.cookState(t, WED, THU, hm('19:30')) === 'made', JSON.stringify(r));
}
{
  const s = week(mk(), WED, hm('09:00')); s.plan = O.buildWeek(s, WED, hm('17:45'));
  ok('Wed 17:45, today\'s cook done but unconfirmed: tonight stays THE COOK (it reads «¿se hizo?»), not the fridge', s.plan.days[WED].dinner.kind === 'cook' && O.cookState(s, WED, WED, hm('17:45')) === 'unconfirmed' && O.potNow(s, WED, hm('17:45')).length === 0, JSON.stringify(s.plan.days[WED].dinner));
  O.logCook(s, batchOf(s, WED), { s: 'made', yield: 3 }, THU, hm('08:00'), AT(THU, '08:00')); s.plan = O.buildWeek(s, THU, hm('08:00'));
  ok('…answered the next morning (made, 3): Wednesday\'s dinner counts as eaten, so the pot holds 2 — never a phantom third', O.potNow(s, THU, hm('08:00'))[0].left === 2);
}
control('re-plant: re-seating tonight on the fridge while the cook is unconfirmed makes the next-morning answer a phantom portion', () => {
  const B = replant('engine', "cookB = b || (rb && rb.state === 'unconfirmed' ? { id: rb.id, left: 0, pending: true } : null);", 'cookB = b || null;');
  const s = mkWith(B.seed); s.plan = B.O.buildWeek(s, WED, hm('09:00')); s.plan = B.O.buildWeek(s, WED, hm('17:45'));
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
ok('more swipes than the week\'s allotment are refused by the gate', (() => { const s = mk(); s.settings.hall.days = [0, 1, 2, 3, 4, 5, 6]; week(s, MON, 0); s.settings.hall.swipesPerWeek = 5; return O.validateWeek(s, s.plan, MON, 0).some(x => x.code === 'swipes'); })());
control('re-plant: a gate without its allotment check lets 15 swipes into a 14-swipe week', () => {
  const B = replant('engine', "Object.keys(weeks).forEach(w => { const n = swipesUsed(plan, w);", 'Object.keys({}).forEach(w => { const n = swipesUsed(plan, w);');
  const s = mkWith(B.seed); s.settings.hall.days = [0, 1, 2, 3, 4, 5, 6]; s.plan = B.O.buildWeek(s, MON, 0); s.settings.hall.swipesPerWeek = 5; return B.O.validateWeek(s, s.plan, MON, 0).some(x => x.code === 'swipes');
});
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
  ok('a v1-shaped recipe {n,q,u} still scales, and a NAME the table knows resolves to its id and section', (() => { const x = O.scaleIngredients(s, { servings: 2, ingredients: [{ q: 1, u: 'lata', n: 'atún' }] }, 4); return x[0].id === 'atun' && x[0].q === 2 && x[0].section === 'Latas y salsas'; })());
  ok('…and a name it does not know stays visible «sin sección», never a quiet default', (() => { const x = O.scaleIngredients(s, { servings: 2, ingredients: [{ q: 1, u: 'u', n: 'MI salsa secreta' }] }, 2); return x[0].id === null && x[0].n === 'MI salsa secreta' && x[0].section === 'sin sección'; })());
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
  const B = replant('engine', 'lo0 = addDays(d, -bw), seen', 'lo0 = addDays(d, -30), seen');
  const s = mkWith(B.seed); s.plan = B.O.buildWeek(s, WED, 0); const ch = [];
  B.O.shopping(s, WED, 0).trips.forEach(t => t.items.forEach(it => { if (it.id === 'pollo-rostizado') ch.push(t.date === it.buyBy); })); return ch.length >= 2 && ch.every(Boolean);
});
control('re-plant v1\'s per-NAME checks: ticking Wednesday\'s chicken ticks every chicken', () => {
  const B = replant('engine', "shopLine(items[id], id + '@' + T, checked)", 'shopLine(items[id], id, checked)');
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
const fracInts = O2 => {   // walkMin 7.25, inStoreMin '25', cookAt '13:07': every number in pub must still be an integer
  const s = mkWith(seed); s.settings.hall.walkMin = 7.25; s.settings.store.inStoreMin = '25'; s.settings.cookAt = { '3': '13:07', '5': '11:07', '6': '11:07' };
  s.plan = O2.buildWeek(s, WED, hm('10:00')); const p = O2.project(s, WED, hm('10:00'), AT(WED, '10:00')), bad = [];
  (function walk(o, k) { if (typeof o === 'number') { if (!Number.isInteger(o)) bad.push(k + '=' + o); } else if (o && typeof o === 'object') Object.keys(o).forEach(j => walk(o[j], k + '.' + j)); })(p, 'pub');
  return bad;
};
ok('every number in pub is an integer even when settings are fractional (walkMin 7.25, inStoreMin "25", cookAt 13:07)', fracInts(O).length === 0, fracInts(O).join(' '));
control('re-plant: minutesFor without its rounding leaks 34.5 into pub (invisible on the seed\'s whole numbers)', () => fracInts(replant('engine', 'return clamp(Math.round(m), 10, 180);', 'return clamp(m, 10, 180);').O).length === 0);
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
  ok('schema 3 (2 = the v2 shape, 3 = the pantry is salt and pepper only)', m.schema === 3 && L.H.OLLA_SCHEMA === 3);
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
const swFilter = file => swFilterSrc(fs.readFileSync(file, 'utf8'));
const swFilterSrc = src => { const m = /keys\.filter\((k => .*?)\)\.map\(/.exec(src); const name = /const CACHE_NAME = '([^']+)'/.exec(src)[1]; const pre = /const CACHE_PREFIX = ([^;]+);/.exec(src); const CACHE_PREFIX = pre ? new Function('CACHE_NAME', 'return ' + pre[1])(name) : undefined; return { f: new Function('CACHE_NAME', 'CACHE_PREFIX', 'return ' + m[1])(name, CACHE_PREFIX), name }; };
const SIBS = ['cuaderno-v7', 'cuaderno-media-v1', 'lampara-v12', 'bitacora-v4', 'olla-v1', 'olla-v2'];
{
  const { f, name } = swFilter(__dirname + '/sw.js'), del = SIBS.concat([name]).filter(f);
  ok('olla\'s sw deletes its own old caches and nobody else\'s', del.join(',') === 'olla-v1,olla-v2' && /^olla-v\d+$/.test(name), del.join(',') + ' (CACHE_NAME ' + name + ')');
  const shell = __dirname + '/../app-shell/sw.js';
  if (fs.existsSync(shell)) { const s = swFilter(shell), d2 = SIBS.concat(['app-shell-v1', s.name]).filter(s.f); ok('app-shell\'s template derives its prefix from CACHE_NAME the same way', d2.join(',') === 'app-shell-v1', d2.join(',')); }
}
control('re-plant v1\'s activate filter INTO sw.js: La Forja\'s caches die on every olla deploy', () => {
  const src = fs.readFileSync(__dirname + '/sw.js', 'utf8'), { f, name } = swFilterSrc(plant(src, 'keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME)', 'keys.filter(k => k !== CACHE_NAME)'));
  return SIBS.concat([name]).filter(f).join(',') === 'olla-v1,olla-v2';
});

console.log('\n21. A past trip is remembered: what Wednesday bought never comes back on Thursday (review 1-oct #1)');
const pastTrip = B => {   // rung 2: tick every item of Wednesday's trip, make Wednesday's pot, wake up Thursday 08:00
  const s = mkWith(B.seed); s.ladder.rung = 2; s.plan = B.O.buildWeek(s, WED, hm('08:00'));
  const sh0 = B.O.shopping(s, WED, hm('08:00')), t0 = sh0.trips[0], friName = B.O.recipeById(s, s.plan.days[FRI].cook.recipe).name, satName = B.O.recipeById(s, s.plan.days[SAT].cook.recipe).name;
  const later = (sh0.trips.find(t => t.date === FRI) || { items: [] }).items.filter(i => i.for.indexOf(satName) >= 0 && t0.items.some(x => x.id === i.id)).map(i => i.id);
  t0.items.forEach(i => B.O.check(s, i.key, true, AT(WED, '12:00')));
  s.plan = B.O.buildWeek(s, WED, hm('18:00')); B.O.logCook(s, batchOf(s, WED), { s: 'made' }, WED, hm('18:00'), AT(WED, '18:00'));
  s.plan = B.O.buildWeek(s, THU, hm('08:00'));
  const sh = B.O.shopping(s, THU, hm('08:00')), all = [].concat(...sh.trips.map(t => t.items));
  return { t0, friName, satName, later, sh, all,
    friBack: all.filter(i => i.for.indexOf(friName) >= 0).map(i => i.id),
    satKept: later.filter(id => all.some(i => i.id === id && i.for.indexOf(satName) >= 0 && !i.checked)) };
};
{
  const r = pastTrip(BASE);
  ok('precondition: Wednesday\'s trip carried Friday\'s cook (' + r.friName + ') and shared ingredients with Saturday\'s', r.t0.items.some(i => i.for.indexOf(r.friName) >= 0) && r.later.length > 0, r.later.join(','));
  ok('Thursday\'s list re-buys NOTHING Wednesday\'s trip bought for Friday', r.friBack.length === 0, r.friBack.join(','));
  ok('…but an ingredient Wednesday bought for Friday is still listed for SATURDAY when Saturday\'s share was on the Friday trip', r.satKept.length === r.later.length, r.satKept.join(',') + ' of ' + r.later.join(','));
  ok('a trip\'s `by` is never before its date and never after any of its items is due', r.sh.trips.every(t => t.by >= t.date && t.items.every(i => i.buyBy >= t.by || i.for.indexOf('cada semana') >= 0)));
}
control('re-plant the checkpoint\'s list (no memory of a past trip): Thursday re-buys Friday\'s groceries', () => pastTrip(replant('engine', '    if (pd.length) {', '    if (false) {')).friBack.length === 0);
control('re-plant the naive memory (ANY past check inside the window counts): Saturday\'s onion vanishes with Friday\'s', () => {
  const r = pastTrip(replant('engine', 'if (P[T] && P[T][x.id]) needs.splice(i, 1);', 'if (past.some(T2 => P[T2][x.id])) needs.splice(i, 1);')); return r.satKept.length === r.later.length;
});

console.log('\n22. Extras die with the entry that made them; a frozen portion eaten stays eaten past the plan\'s 21 days (#2, #3)');
const extraCorrected = B => {   // «otra cosa, sobró 2» corrected to «comí» without a void; then the same on two devices
  const s = mkWith(B.seed); s.plan = B.O.buildWeek(s, WED, hm('10:00')); B.O.logCook(s, batchOf(s, WED), { s: 'made' }, WED, hm('17:00'), AT(WED, '17:00'));
  const two = JSON.parse(JSON.stringify(s));
  B.O.logMeal(s, WED, 'dinner', { s: 'other', what: 'pizza', left: 2 }, WED, hm('20:00'), AT(WED, '20:00'));
  B.O.logMeal(s, WED, 'dinner', { s: 'ate' }, WED, hm('20:01'), AT(WED, '20:01'));
  B.O.logMeal(two, WED, 'dinner', { s: 'ate' }, WED, hm('20:30'), AT(WED, '20:30'));
  const other = JSON.parse(JSON.stringify(s)); other.log = {}; B.O.logMeal(other, WED, 'dinner', { s: 'other', what: 'pizza', left: 2 }, WED, hm('20:00'), AT(WED, '20:00'));
  B.O.mergeReality(two, other);
  const pizza = st => B.O.potNow(st, WED, hm('21:00')).filter(b => b.name === 'pizza').length;
  s.plan = B.O.buildWeek(s, THU, hm('08:00'));
  return { one: pizza(s), two: pizza(two), friCooks: !!s.plan.days[FRI].cook };
};
{
  const r = extraCorrected(BASE);
  ok('a correction («comí» after «otra cosa, sobró 2») takes the extra batch with it', r.one === 0);
  ok('…the same across two devices whose entries merge (the later «comí» wins)', r.two === 0);
  ok('…so Friday still cooks (no phantom pizza feeds it)', r.friCooks);
}
control('re-plant: an extra kept alive by ANY live entry of its slot feeds Friday with a pizza he corrected away', () => extraCorrected(replant('engine', 'if (x.log) { const l = liveEntries((state.log || {})[x.log]); return !!l.length && l[l.length - 1].batch === id; }', 'if (x.log) return liveEntries((state.log || {})[x.log]).some(e => e.batch === id);')).one === 0);
const frozenLongRun = B => {
  const s = mkWith(B.seed); s.ladder.rung = 3; s.plan = B.O.buildWeek(s, SAT, hm('09:00'));
  const b = batchOf(s, SAT); B.O.logCook(s, b, { s: 'made', yield: 6 }, SAT, hm('13:00'), AT(SAT, '13:00'));
  const f = B.O.freeze(s, b, 2, SAT, hm('13:05'), AT(SAT, '13:05'));
  s.plan = B.O.buildWeek(s, MON, hm('08:00')); B.O.logMeal(s, MON, 'dinner', { s: 'ate', of: f.id }, MON, hm('19:30'), AT(MON, '19:30'));
  const left = d => (B.O.freezer(s, d, hm('20:00')).find(x => x.id === f.id) || { left: 0 }).left;
  const mon = left(MON); let d = MON; for (let i = 1; i <= 24; i++) { d = B.O.addDays(MON, i); s.plan = B.O.buildWeek(s, d, hm('08:00')); }
  return { mon, later: left(d), pruned: !s.plan.days[MON] };
};
{
  const r = frozenLongRun(BASE);
  ok('a frozen portion eaten on Monday is still eaten 24 days later, after the plan pruned Monday', r.pruned && r.mon === 1 && r.later === 1, JSON.stringify(r));
}
control('re-plant: a reality that walks only the plan\'s days resurrects the eaten frozen portion once Monday is pruned', () => frozenLongRun(replant('engine', 'Object.keys(walk).sort().forEach(d => {', 'Object.keys(days).sort().forEach(d => {')).later === 1);

console.log('\n23. The cook\'s hour leaves room for the trip; a cook whose hour came keeps its list (#4)');
const tripRoom = B => {
  const out = {};
  { const s = mkWith(B.seed); s.plan = B.O.buildWeek(s, WED, hm('08:00'));   // the first morning: nothing bought yet
    const c = s.plan.days[WED].cook, t = B.O.shopping(s, WED, hm('08:00')).trips.find(x => x.date === WED);
    out.firstDay = !!(c && t) && hm(t.at) >= hm('13:00') && hm(t.at) + B.O.tripMinutes(s.settings) <= hm(c.at); out.firstDayTxt = (c && c.at) + ' / trip ' + (t && t.at); }
  { const s = mkWith(B.seed); s.plan = B.O.buildWeek(s, WED, hm('10:00'));   // the rotisserie Wednesday, nothing left: Thursday 14:00
    B.O.logCook(s, batchOf(s, WED), { s: 'notmade' }, WED, hm('21:00'), AT(WED, '21:00'));
    B.O.logMeal(s, WED, 'dinner', { s: 'other', what: 'pollo rostizado comprado', left: 0 }, WED, hm('21:00'), AT(WED, '21:01'));
    s.plan = B.O.buildWeek(s, THU, hm('14:00')); const c = s.plan.days[THU].cook, name = c && B.O.recipeById(s, c.recipe).name;
    const t = B.O.shopping(s, THU, hm('14:00')).trips.find(x => x.date === THU);
    out.thu = !!(c && t) && hm(c.at) >= hm('14:00') + B.O.tripMinutes(s.settings) && t.items.some(i => i.for.indexOf(name) >= 0) && hm(t.at) + B.O.tripMinutes(s.settings) <= hm(c.at);
    out.pubShop = !!(B.O.project(s, THU, hm('14:00'), 1).days[THU].shop);
    // he ticks the whole list at the store: the cook may start once he has walked home, not a whole trip later
    t.items.forEach(i => B.O.check(s, i.key, true, AT(THU, '14:20'))); s.plan = B.O.buildWeek(s, THU, hm('14:20'));
    const c2 = s.plan.days[THU].cook; out.bought = !!c2 && hm(c2.at) < hm('14:20') + B.O.tripMinutes(s.settings) && hm(c2.at) >= hm('14:20') + 10; out.boughtTxt = c2 && c2.at;
    // past its hour with nothing ticked: still «cooking», and its groceries stay on today's list
    const z = mkWith(B.seed); z.plan = B.O.buildWeek(z, FRI, hm('09:00')); const fc = z.plan.days[FRI].cook, fat = hm(fc.at);
    out.cooking = B.O.cookState(z, FRI, FRI, fat + 5) === 'cooking' && B.O.shopping(z, FRI, fat + 5).trips.some(x => x.date === FRI && x.items.some(i => i.for.indexOf(B.O.recipeById(z, fc.recipe).name) >= 0)); }
  return out;
};
{
  const r = tripRoom(BASE);
  ok('the first morning: the trip happens inside the cook window and before the cook (never over the 12:30 swipe lunch)', r.firstDay, r.firstDayTxt);
  ok('Thursday 14:00 after the rotisserie night: the cook leaves a trip\'s room, and the trip lists the cook\'s groceries', r.thu);
  ok('…and pub carries that Safeway trip (the city and the Worker see it)', r.pubShop);
  ok('…once he ticks everything at the store, the cook only waits for the walk home', r.bought, r.boughtTxt);
  ok('a cook whose hour came with nothing ticked keeps its items on today\'s list', r.cooking);
}
control('re-plant the deli-only lead: an unbought cook TODAY gets no time to shop', () => tripRoom(replant('engine', 'if (!(bw === 0 || sameDayOnly)) return;', 'if (bw !== 0) return;')).firstDay);
control('re-plant: a cook in «cooking» loses its list while nothing is ticked', () => tripRoom(replant('engine', "if (cs !== 'planned' && cs !== 'due' && cs !== 'cooking') return;", "if (cs !== 'planned' && cs !== 'due') return;")).cooking);

console.log('\n24. After «no se hizo», a re-cook is a NEW pot; the gate never accepts a dinner on a pot that was not made (#5)');
const recook = B => {
  const s = mkWith(B.seed); s.ladder.rung = 3; s.plan = B.O.buildWeek(s, WED, hm('08:00'));
  [WED, FRI].forEach(d => B.O.logCook(s, batchOf(s, d), { s: 'made' }, FRI, hm('20:00'), AT(d, '20:00')));
  s.plan = B.O.buildWeek(s, SAT, hm('09:00')); const old = batchOf(s, SAT);
  s.plan = B.O.buildWeek(s, SAT, hm('12:45')); B.O.logCook(s, old, { s: 'notmade' }, SAT, hm('12:45'), AT(SAT, '12:45')); s.plan = B.O.buildWeek(s, SAT, hm('12:45'));
  const a = JSON.parse(JSON.stringify(s)), ra = B.O.setCookRecipe(a, SAT, 'chili', SAT, hm('12:45'));
  const b = JSON.parse(JSON.stringify(s)), rb = B.O.setKind(b, SAT, 'dinner', 'cook', SAT, hm('12:45'));
  const fed = st => [SUN, MON, TUE].every(d => st.plan.days[d].dinner.kind === 'leftover' && st.plan.days[d].dinner.of === batchOf(st, SAT));
  return { old, ra, rb, aNew: batchOf(a, SAT) !== old && B.O.cookState(a, SAT, SAT, hm('12:45')) === 'planned' && fed(a) && B.O.effCook(a, old).s === 'notmade',
           bNew: rb.ok && batchOf(b, SAT) !== old && B.O.cookState(b, SAT, SAT, hm('12:45')) === 'planned' && fed(b), s };
};
{
  const r = recook(BASE);
  ok('setCookRecipe on a not-made Saturday (window still open) seats a NEW pot that feeds Sun–Tue; the «no» stays recorded', r.ra.ok && r.aNew, JSON.stringify(r.ra));
  ok('setKind(dinner, cook) on that day does the same — never an ok for a cook that cannot happen', r.bNew, JSON.stringify(r.rb));
  const g = JSON.parse(JSON.stringify(r.s)); g.plan.days[SAT].dinner = { kind: 'cook', hand: true };
  ok('the gate refuses a «cook» dinner on a pot that was not made', O.validateWeek(g, g.plan, SAT, hm('12:45')).some(x => x.slot === 'dinner' && x.code === 'no-batch'));
}
control('re-plant the checkpoint\'s setKind (reuse the not-made batch): it reports ok and nothing can be cooked', () => recook(replant('engine', "day.cook = eff && eff.s === 'notmade' ? { recipe: cur.recipe, hand: true, batch: freshBatchId(s2, date) } : Object.assign({}, cur || {}, { hand: true });", 'day.cook = Object.assign({}, cur || {}, { hand: true });')).bNew);
control('re-plant: setCookRecipe that reuses the not-made batch id leaves the day not-made behind an ok', () => recook(replant('engine', "batch: cs === 'notmade' ? freshBatchId(s2, date) : batchIdFor(date)", 'batch: batchIdFor(date)')).aNew);
control('re-plant: a gate without the not-made check accepts a «cook» dinner on a pot that does not exist', () => {
  const B = replant('engine', "        else if (r.kind === 'cook' && R.byId[day.cook.batch] && R.byId[day.cook.batch].state === 'notmade') push(d, sl, 'no-batch', 'esa olla no se hizo');\n", '');
  const r = recook(B), g = JSON.parse(JSON.stringify(r.s)); g.plan.days[SAT].dinner = { kind: 'cook', hand: true }; return B.O.validateWeek(g, g.plan, SAT, hm('12:45')).some(x => x.slot === 'dinner' && x.code === 'no-batch');
});

console.log('\n25. What he MADE names the pot everywhere, not what was planned (#6)');
const madeOther = B => {
  const s = mkWith(B.seed); s.plan = B.O.buildWeek(s, SAT, hm('09:00')); const planned = s.plan.days[SAT].cook.recipe, other = planned === 'chili' ? 'lentejas' : 'chili';
  B.O.logCook(s, batchOf(s, SAT), { s: 'made', recipe: other, yield: 4 }, SAT, hm('13:00'), AT(SAT, '13:00')); s.plan = B.O.buildWeek(s, SAT, hm('13:00'));
  const name = B.O.recipeById(s, other).name, pub = B.O.project(s, SAT, hm('13:00'), AT(SAT, '13:00')), na = B.O.nextAction(s, SAT, hm('19:00'));
  return { other, name, planned, ok: B.O.slotLabel(s, SAT, 'dinner') === name && pub.days[SAT].dinner.sub === name && pub.days[SAT].cook.name === name && pub.days[SAT].cook.recipe === other && na.kind === 'eat' && na.recipe === other };
};
{
  const r = madeOther(BASE);
  ok('made ' + r.other + ' instead of ' + r.planned + ': tonight\'s label, pub\'s dinner and cook, and the «eat» card all say ' + r.name, r.ok);
}
control('re-plant: labels read the PLANNED recipe — tonight says one dish and tomorrow\'s sobra another', () => madeOther(replant('engine', "return (e && e.s === 'made' && e.recipe) || (c && c.recipe) || null; }", 'return (c && c.recipe) || null; }')).ok);

console.log('\n26. A pot that keeps 2 days never «covers» four: no fridge-default Tuesday at rungs 3–4 (#7)');
const fourWeeksHome = (B, rung) => {
  const s = mkWith(B.seed); s.ladder.rung = rung; const homes = [], recs = [];
  for (let i = 0; i < 28; i++) { const d = B.O.addDays(WED, i); s.plan = B.O.buildWeek(s, d, hm('08:00')); if (s.plan.days[d].dinner.kind === 'home') homes.push(d); const c = s.plan.days[d].cook; if (c) { B.O.logCook(s, c.batch, { s: 'made' }, d, 1439, AT(d, '20:00')); recs.push(c.recipe); } }
  return { homes, distinct: new Set(recs).size, b2b: recs.filter((r, i) => i && r === recs[i - 1]).length };
};
{
  const r3 = fourWeeksHome(BASE, 3), r4 = fourWeeksHome(BASE, 4);
  ok('rung 3, four weeks: no dinner falls to the fridge, ≥3 mains, no back-to-back', !r3.homes.length && r3.distinct >= 3 && !r3.b2b, JSON.stringify(r3));
  ok('rung 4, four weeks: the same', !r4.homes.length && r4.distinct >= 3 && !r4.b2b, JSON.stringify(r4));
}
control('re-plant the checkpoint\'s «big» test (each dish against its OWN fridge-cut need): Tuesdays fall to the fridge', () => {
  const B = replant('engine', 'const big = c.filter(r => cov(r) >= best);', 'const big = c.filter(r => maxServings(r) >= needOf(r));');
  return !fourWeeksHome(B, 3).homes.length && !fourWeeksHome(B, 4).homes.length;
});

console.log('\n27. «Fuera» is a resolved dinner: no rescue card, and the night ends on «mañana» (#9)');
const outNight = B => {
  const s = mkWith(B.seed); s.plan = B.O.buildWeek(s, SAT, hm('09:00')); B.O.logCook(s, batchOf(s, SAT), { s: 'made' }, SAT, hm('13:00'), AT(SAT, '13:00'));
  B.O.setKind(s, SUN, 'dinner', 'out', SAT, hm('13:00')); s.plan = B.O.buildWeek(s, SUN, hm('09:00'));
  return { k2031: B.O.nextAction(s, SUN, hm('20:31')).kind, k2230: B.O.nextAction(s, SUN, hm('22:30')).kind };
};
{
  const r = outNight(BASE);
  ok('Sunday dinner set to «fuera», silent: no rescue at 20:31, «tomorrow» at 22:30', r.k2031 !== 'rescue' && r.k2230 === 'tomorrow', JSON.stringify(r));
}
control('re-plant: a rescue that ignores «fuera» nags him all night and «mañana» never comes', () => { const r = outNight(replant('engine', "if (day.dinner && day.dinner.kind !== 'out' && !effLog(state, today, 'dinner')) {", "if (day.dinner && !effLog(state, today, 'dinner')) {")); return r.k2031 !== 'rescue' && r.k2230 === 'tomorrow'; });

console.log('\n28. List lines: every unit keeps its quantity; a jar is a name; ride-alongs are due on their trip; v1 names reach the list (#10, #15, #18)');
const listLines = B => {
  const out = {};
  { const s = mkWith(B.seed); s.plan = B.O.buildWeek(s, WED, hm('08:00')); s.settings.pantry = s.settings.pantry.filter(x => x !== 'ajo');
    const r1 = B.O.recipeById(s, s.plan.days[WED].cook.recipe), r2 = B.O.recipeById(s, s.plan.days[FRI].cook.recipe);
    r1.ingredients = r1.ingredients.filter(g => g.id !== 'ajo').concat([{ id: 'ajo', q: 2, u: 'diente' }]); r2.ingredients = r2.ingredients.filter(g => g.id !== 'ajo').concat([{ id: 'ajo', q: 1, u: 'cda' }]);
    const lines = [].concat(...B.O.shopping(s, WED, hm('08:00')).trips.map(t => t.items)).filter(i => i.id === 'ajo');
    out.units = lines.length === 1 && /diente/.test(lines[0].display) && /cda/.test(lines[0].display); out.unitsTxt = lines.map(i => i.display).join(' | '); }
  { const s = mkWith(B.seed); s.ladder.rung = 2; s.plan = B.O.buildWeek(s, WED, hm('08:00'));
    const sp = [].concat(...B.O.shopping(s, WED, hm('08:00')).trips.map(t => t.items)).filter(i => /^(cda|cdta)$/.test(i.u));
    out.jar = sp.length > 0 && sp.every(i => i.display === '' && i.text === i.n); out.jarTxt = sp.map(i => i.text).join(' | '); }
  { const s = mkWith(B.seed); s.plan = B.O.buildWeek(s, WED, hm('10:00'));   // the rotisserie Wednesday, «sobró 2», no answer about the cook: the first trip is Saturday
    B.O.logMeal(s, WED, 'dinner', { s: 'other', what: 'pollo rostizado comprado', left: 2, src: 'bought' }, WED, hm('21:00'), AT(WED, '21:01')); s.plan = B.O.buildWeek(s, THU, hm('08:00'));
    const t = B.O.shopping(s, THU, hm('08:00')).trips[0], ride = t.items.filter(i => i.for.indexOf('cada semana') >= 0 || /Batido|yogur/i.test(i.for.join(' ')));
    out.ride = t.date > THU && ride.length > 0 && ride.every(i => i.buyBy >= t.date); out.rideTxt = t.date + ' ' + ride.map(i => i.id + ':' + i.buyBy).join(' '); }
  { const s = mkWith(B.seed); s.recipes.push({ id: 'mi-guiso', name: 'Mi guiso', rung: 1, role: 'main', servings: 4, doubles: true, fridgeDays: 3, minutes: { active: 20, total: 40 }, gear: [],
      ingredients: [{ n: 'cebolla roja', q: 1, u: 'u' }, { n: 'sillao', q: 2, u: 'cda' }, { n: 'MI salsa secreta', q: 1, u: 'frasco' }], steps: ['Todo a la olla.'] });
    s.plan = B.O.buildWeek(s, WED, hm('08:00')); const r = B.O.setCookRecipe(s, FRI, 'mi-guiso', WED, hm('08:00'));
    const all = [].concat(...B.O.shopping(s, WED, hm('08:00')).trips.map(t => t.items)).filter(i => i.for.indexOf('Mi guiso') >= 0);
    out.v1 = r.ok && all.some(i => i.id === 'cebolla-roja' && i.section === 'Frutas y verduras') && all.some(i => i.n === 'MI salsa secreta' && i.section === 'sin sección') && all.some(i => i.id === 'sillao'); out.v1Txt = JSON.stringify(r) + ' ' + all.map(i => i.id + ':' + i.section).join(' '); }
  return out;
};
{
  const r = listLines(BASE);
  ok('one ingredient in two units is ONE line carrying both quantities (2 dientes + 1 cda), never a dropped one', r.units, r.unitsTxt);
  ok('a spoonful of a jar is listed as the jar (its name), not «¾ cdta»', r.jar, r.jarTxt);
  ok('a weekly ride-along is due no earlier than the trip it rides', r.ride, r.rideTxt);
  ok('a hand-edited v1 recipe {n,q,u}: known names land in their aisle (sillao is NOT assumed at home: it is bought), an unknown one shows «sin sección»', r.v1, r.v1Txt);
}
control('re-plant v1\'s unit merge (`if (it.u === u) it.q += q`): the tablespoon of garlic is silently dropped', () => listLines(replant('engine', 'Object.keys(parts).forEach(u => { it.parts[u] = (it.parts[u] || 0) + parts[u]; });', 'Object.keys(parts).forEach(u => { if (!Object.keys(it.parts).length || it.parts[u] != null) it.parts[u] = (it.parts[u] || 0) + parts[u]; });')).units);
control('re-plant: spoon quantities printed for a jar («¾ cdta aceite de ajonjolí»)', () => listLines(replant('engine', "const bare = !qs.length || qs.every(p => SPOON[p.u] || (info.pantry && p.u === 'taza'));", 'const bare = !qs.length;')).jar);
control('re-plant: a ride-along keeps the day its default was first eaten as its due date (before the trip)', () => listLines(replant('engine', 'add(id, ingredient(id), r.parts, r.need < T ? T : r.need, r.for)', 'add(id, ingredient(id), r.parts, r.need, r.for)')).ride);
control('re-plant: id-less v1 ingredients dropped from the list (the checkpoint\'s `if (!it.id) return`)', () => listLines(replant('engine', "const id = it.id || ('~' + slugOf(it.n));", "if (!it.id) return; const id = it.id;")).v1);

console.log('\n29. Merges converge on ties; migration edges a hand-edited gist reaches (#15, #16, #17)');
const ties = B => {
  const f = mkWith(B.seed), g = mkWith(B.seed); B.O.like(f, 'chili', 'never', 5); B.O.like(g, 'chili', 'again', 5); B.O.check(f, 'leche@' + WED, true, 5); B.O.check(g, 'leche@' + WED, false, 5);
  f.log = { [WED + ':bf']: [{ s: 'ate', at: 5 }, { s: 'skipped', at: 5 }] }; g.log = { [WED + ':bf']: [{ s: 'skipped', at: 5 }, { s: 'ate', at: 5 }] };
  B.O.mergeReality(f, g); B.O.mergeReality(g, f);
  return f.likes.chili.v === g.likes.chili.v && f.groceries.checked['leche@' + WED].v === g.groceries.checked['leche@' + WED].v && B.O.effLog(f, WED, 'bf').s === B.O.effLog(g, WED, 'bf').s;
};
ok('two devices with same-`at` likes, checks and log entries end on the SAME answers after merging both ways', ties(BASE));
control('re-plant the checkpoint\'s tie rule (local wins, arrays sorted only when something was added): the devices diverge', () => {
  const B = load({ engine: plant(plant(ENGINE, '((+b.at || 0) === (+a.at || 0) && canon(b) > canon(a))', 'false'), "        al.sort((x, y) => (+x.at || 0) - (+y.at || 0) || cmpStr(canon(x), canon(y))); n += added;", "        if (added) { al.sort((x, y) => (+x.at || 0) - (+y.at || 0) || cmpStr(canon(x), canon(y))); n += added; }") });
  return ties(B);
});
{
  const L = load(), m = L.H.appMigrate(Object.assign(v1Snapshot(), { recipes: v1Snapshot().recipes.concat([{ id: 'mi-sopa', name: 'Mi sopa', rung: 1, servings: 4, fridgeDays: 3, minutes: { active: 20, total: 40 }, ingredients: [{ n: 'zanahoria', q: 2, u: 'u' }], steps: ['Todo a la olla.'] }]) }));
  ok('a recipe the seed does not know that keeps ≥1 day migrates as a main (else nothing can ever seat it)', m.recipes.find(r => r.id === 'mi-sopa').role === 'main');
  const raw = JSON.stringify(Object.assign(v1Snapshot(), { _bytes: 'exact' })), R = load(); R.ctx.STORAGE_KEY = 'olla.v1'; R.ls.setItem('olla.v1', raw);
  const shellMigrated = JSON.parse(raw); shellMigrated.settings.claude = { model: 'rewritten-by-the-shell', mode: 'auto' }; shellMigrated.lastModified = 999;
  R.H.appMigrate(shellMigrated);
  ok('the pre-schema-2 snapshot is the RAW stored string, not the copy the shell\'s migrate() already rewrote', R.ls.getItem('olla.v1.pre-schema2') === raw);
}
control('re-plant: a roleless recipe of his left without a role is never plannable', () => load({ hooks: plant(HOOKS, "if (!nr) return (!r.role && (+r.fridgeDays || 0) >= 1) ? Object.assign({}, r, { role: 'main' }) : r;", 'if (!nr) return r;') }).H.appMigrate(Object.assign(v1Snapshot(), { recipes: v1Snapshot().recipes.concat([{ id: 'mi-sopa', name: 'Mi sopa', rung: 1, servings: 4, fridgeDays: 3, ingredients: [], steps: [] }]) })).recipes.find(r => r.id === 'mi-sopa').role === 'main');
control('re-plant the checkpoint\'s snapshot (JSON of the shell-migrated object): the bytes differ from what he had', () => {
  const R = load({ hooks: plant(HOOKS, 'localStorage.setItem(OLLA_PRE_SCHEMA2_KEY, raw || JSON.stringify(s));', 'localStorage.setItem(OLLA_PRE_SCHEMA2_KEY, JSON.stringify(s));') });
  const raw = JSON.stringify(v1Snapshot()); R.ctx.STORAGE_KEY = 'olla.v1'; R.ls.setItem('olla.v1', raw); const sm = JSON.parse(raw); sm.lastModified = 999; R.H.appMigrate(sm);
  return R.ls.getItem('olla.v1.pre-schema2') === raw;
});

console.log('\n30. The book\'s safety rules hold for every recipe (content review 1-oct #2, #4; a later edit must not drop them)');
const bookRules = recipes => {
  const out = [], txt = r => r.steps.map(s => (typeof s === 'string' ? s : s.t)).join(' ');
  recipes.forEach(r => {
    const used = new Set([].concat(...r.steps.map(s => s.ing || [])));
    r.ingredients.forEach((g, i) => { if (!used.has(i)) out.push(r.id + ': ' + g.id + ' is in no step'); });
    if (r.role === 'main' && r.fridgeDays >= 1 && !/2 horas/.test(txt(r))) out.push(r.id + ': never says «a la nevera antes de 2 horas»');
    if (r.ingredients.some(g => /hueso|presas/.test(g.id || '')) && !(/165°F/.test(txt(r)) && /color no prueba/.test(txt(r)))) out.push(r.id + ': bone-in chicken judged by colour');
  });
  return out;
};
{
  const p = bookRules(seed.recipes);
  ok('every ingredient is named by a step; every keeping main says to fridge it within 2 hours; bone-in chicken is judged at 165°F, never by colour', p.length === 0, p.join('; '));
}
control('re-plant: a big pot with no cooling step is CAUGHT', () => { const b = JSON.parse(JSON.stringify(seed.recipes)), r = b.find(x => x.id === 'lentejas'); r.steps = r.steps.filter(s => !/2 horas/.test(s.t)); return bookRules(b).length === 0; });
control('re-plant the checkpoint\'s pollo a la bandeja («listo cuando los jugos salen claros») is CAUGHT', () => { const b = JSON.parse(JSON.stringify(seed.recipes)), r = b.find(x => x.id === 'pollo-bandeja'); r.steps.forEach(s => { s.t = s.t.replace(/color no prueba/g, 'jugos claros'); }); return bookRules(b).length === 0; });
control('re-plant: an ingredient no step uses is CAUGHT (it would be bought and never cooked)', () => { const b = JSON.parse(JSON.stringify(seed.recipes)); b.find(x => x.id === 'chili').ingredients.push({ id: 'comino', q: 1, u: 'cdta' }); return bookRules(b).length === 0; });

console.log('\n31. A cook is asked about only once its WINDOW is over — and never later than its dinner (final e2e review #2)');
const dueCase = B => {
  const out = {};
  { const s = mkWith(B.seed); s.plan = B.O.buildWeek(s, THU, hm('09:00')); const c = s.plan.days[THU].cook;   // window 13:00–17:30, the city may seat it at 15:00
    out.thuAt = c && c.at;
    out.thu1430 = B.O.cookState(s, THU, THU, hm('14:30')); out.thuQ1430 = B.O.questions(s, THU, hm('14:30')).length; out.thuNext1430 = B.O.nextAction(s, THU, hm('14:30')).kind;
    out.thuPub1430 = (B.O.project(s, THU, hm('14:30'), 1).days[THU].cook || {}).state;
    out.thu1730 = B.O.cookState(s, THU, THU, hm('17:30')); out.thuQ1730 = B.O.questions(s, THU, hm('17:30')).length;
    out.thuPot1430 = B.O.potNow(s, THU, hm('14:30')).length; }
  { const s = mkWith(B.seed); s.plan = B.O.buildWeek(s, SAT, hm('08:00'));                                      // window 11:00–21:00, dinner 19:00
    out.sat1500 = B.O.cookState(s, SAT, SAT, hm('15:00')); out.sat1730 = B.O.cookState(s, SAT, SAT, hm('17:30')); out.satNext2000 = B.O.nextAction(s, SAT, hm('20:00')).kind; }
  return out;
};
{
  const r = dueCase(BASE);
  ok('Thursday 14:30, its hour + total behind but the window open: still «cooking», nothing asked, Hoy does not confirm', r.thu1430 === 'cooking' && r.thuQ1430 === 0 && r.thuNext1430 !== 'confirm-cook', JSON.stringify(r));
  ok('…pub still says «planned» (the Worker keeps its 15:00 notice for a cook the paper moved there)', r.thuPub1430 === 'planned', r.thuPub1430);
  ok('…and the pot still holds nothing for it (unsure = less)', r.thuPot1430 === 0);
  ok('Thursday 17:30, the window shut: unconfirmed, and asked once', r.thu1730 === 'unconfirmed' && r.thuQ1730 === 1, r.thu1730 + ' q=' + r.thuQ1730);
  ok('Saturday 15:00 inside its 11–21 window: still «cooking»', r.sat1500 === 'cooking', r.sat1500);
  ok('Saturday 17:30, when its 19:00 dinner can be logged: asked — not at 21:00', r.sat1730 === 'unconfirmed', r.sat1730);
  ok('…so at 20:00 Hoy confirms the cook instead of rescuing a dinner he may have cooked at noon', r.satNext2000 === 'confirm-cook', r.satNext2000);
}
control('re-plant the hour + total rule: Thursday 14:30 asks «¿se hizo?» about a cook the paper has at 15:00', () => dueCase(replant('engine',
  "return w ? Math.max(at + tot, Math.min(w.e, eatAt(state, date, 'dinner') - EARLY)) : at + tot;", 'return at + tot;')).thu1430 === 'cooking');
control('re-plant the bare window end (no dinner bound): Saturday is not asked until 21:00 and 20:00 shows the rescue card', () => { const r = dueCase(replant('engine',
  "Math.min(w.e, eatAt(state, date, 'dinner') - EARLY)", 'w.e')); return r.sat1730 === 'unconfirmed' && r.satNext2000 === 'confirm-cook'; });

console.log('\n32. A trip that has left is not re-timed: the cook stays at its hour, the trip at its departure (final e2e review #7)');
const recedeCase = B => {
  const out = { at: [], trip: [], pubShop: [] };
  const s = mkWith(B.seed); s.plan = B.O.buildWeek(s, WED, hm('08:00'));   // nothing ticked, ever: he shops and cooks without touching the list
  out.at0 = s.plan.days[WED].cook.at;
  ['13:05', '13:20', '13:35', '13:45'].forEach(t => {
    s.plan = B.O.buildWeek(s, WED, hm(t)); out.at.push(s.plan.days[WED].cook.at);
    const tr = B.O.shopping(s, WED, hm(t)).trips.find(x => x.date === WED); out.trip.push(tr && tr.at);
    const p = B.O.project(s, WED, hm(t), 1).days[WED]; out.pubShop.push(p.shop && p.shop.at);
  });
  s.plan = B.O.buildWeek(s, WED, hm('15:00'));
  const tr = B.O.shopping(s, WED, hm('15:00')).trips.find(x => x.date === WED);
  out.after = { next: B.O.nextAction(s, WED, hm('15:00')).kind, pubShop: B.O.project(s, WED, hm('15:00'), 1).days[WED].shop, listKept: !!(tr && tr.items.length && tr.left > 0) };
  { const z = mkWith(B.seed); z.plan = B.O.buildWeek(z, WED, hm('08:00'));   // he ticks the whole list in the store at 13:20: the cook only waits for the walk home
    B.O.shopping(z, WED, hm('13:20')).trips.filter(x => x.date === WED).forEach(t => t.items.forEach(i => B.O.check(z, i.key, true, AT(WED, '13:20'))));
    z.plan = B.O.buildWeek(z, WED, hm('13:20')); out.ticked = z.plan.days[WED].cook.at; }
  return out;
};
{
  const r = recedeCase(BASE);
  ok('Wednesday, nothing ticked: the cook stays at its hour on every rebuild after the trip left (13:05 → 13:45)', r.at.every(a => a === r.at0), r.at0 + ' → ' + r.at.join(','));
  ok('…and the trip keeps its departure, never the publish minute', r.trip.every(t => t === r.trip[0]) && OLLA_hm(r.trip[0]) + O.tripMinutes(mk().settings) === OLLA_hm(r.at0), r.trip.join(','));
  ok('…in pub too (the Worker\'s [at − 90, at) window means what it says)', r.pubShop.every(a => a === OLLA_hm(r.trip[0])), r.pubShop.join(','));
  ok('back from the trip: nothing nudges him to shop for it — no «shop» action, no pub.shop', r.after.next !== 'shop' && r.after.pubShop === null, JSON.stringify(r.after));
  ok('…but the list keeps its lines to tick (a cook whose hour came keeps its list — #4)', r.after.listKept);
  ok('ticking the whole list in the store still frees the cook to the walk home', OLLA_hm(r.ticked) < OLLA_hm(r.at0) && OLLA_hm(r.ticked) >= hm('13:20') + 10, r.ticked);
}
control('re-plant the re-seat: an unticked cook recedes behind the clock on every rebuild', () => { const r = recedeCase(replant('engine',
  'if (started || (d === today && departed(o.cook, oat))) {', 'if (started) {')); return r.at.every(a => a === r.at0); });
control('re-plant the clamp to now: the trip\'s departure becomes the publish minute', () => { const r = recedeCase(replant('engine',
  'if (T === today && !same.length) at = Math.max(at, ceil5(N));', 'if (T === today) at = Math.max(at, ceil5(N));')); return r.trip.every(t => t === r.trip[0]); });
control('re-plant a trip that never ends: at 15:00 Hoy still sends him to Safeway for the cook he did', () => { const r = recedeCase(replant('engine',
  'const gone = T === today && same.length > 0 && N >= at + trip;', 'const gone = false;')); return r.after.next !== 'shop' && r.after.pubShop === null; });

console.log('\n33. addBatch: a batch without a meal — «compré, rinde N» before dinner, an off-plan cook (final UI review #1, #3, #5)');
const batchCase = B => {
  const out = {};
  const s = mkWith(B.seed); s.settings.eatAt.dinner = '21:00'; s.plan = B.O.buildWeek(s, THU, hm('09:00'));   // dinner can't be logged before 19:30
  const bt = batchOf(s, THU); out.hadCook = !!bt;
  out.mealRefused = B.O.logMeal(JSON.parse(JSON.stringify(s)), THU, 'dinner', { s: 'other', what: 'pollo rostizado', left: 2 }, THU, hm('17:45'), AT(THU, '17:45')).ok === false;   // the old path: refused, the purchase lost
  B.O.logCook(s, bt, { s: 'notmade' }, THU, hm('17:45'), AT(THU, '17:45'));
  const r = B.O.addBatch(s, { name: 'pollo rostizado', servings: 3, src: 'bought' }, THU, hm('17:45'), AT(THU, '17:45') + 1);
  s.plan = B.O.buildWeek(s, THU, hm('17:45'));
  out.res = r; out.noLogKey = !!(r.batch && s.extra[r.batch] && !('log' in s.extra[r.batch]));
  out.dinner = s.plan.days[THU].dinner; out.thuEats = !!(r.batch && out.dinner.kind === 'leftover' && out.dinner.of === r.batch);
  out.fri = [s.plan.days[FRI].lunch, s.plan.days[FRI].dinner].some(x => x.of === r.batch);
  out.pot = B.O.potNow(s, THU, hm('17:45')).map(b => b.id + ':' + b.left);
  out.potOk = B.O.potNow(s, THU, hm('17:45')).some(b => b.id === r.batch && b.left === 3 && b.src === 'bought');
  out.noDinnerLog = !B.O.effLog(s, THU, 'dinner'); out.gate = B.O.validateWeek(s, s.plan, THU, hm('17:45'));
  out.tossed = B.O.logCook(s, r.batch, { s: 'tossed' }, THU, hm('18:00'), AT(THU, '18:00')).ok; s.plan = B.O.buildWeek(s, THU, hm('18:00'));
  out.goneAfterToss = !B.O.potNow(s, THU, hm('18:00')).some(b => b.id === r.batch) && s.plan.days[THU].dinner.of !== r.batch;
  out.refusals = [B.O.addBatch(s, { name: 'x', servings: 2 }, THU, 0, 0).ok, B.O.addBatch(s, { name: 'x', servings: 0 }, THU, 0, 1).ok, B.O.addBatch(s, { date: FRI, name: 'x', servings: 2 }, THU, 0, 1).ok, B.O.addBatch(s, { recipe: 'no-such', servings: 2 }, THU, 0, 1).ok];
  const y = mkWith(B.seed); y.plan = B.O.buildWeek(y, SAT, hm('11:00'));
  const c = B.O.addBatch(y, { recipe: 'chaufa-express', servings: 3, src: 'cooked' }, SAT, hm('13:00'), AT(SAT, '13:00'));
  out.cooked = !!(c.ok && y.extra[c.batch].src === 'cooked' && y.extra[c.batch].name === B.O.recipeById(y, 'chaufa-express').name && B.O.potNow(y, SAT, hm('13:00')).some(b => b.id === c.batch && b.left === 3) && !B.O.effLog(y, SAT, 'dinner'));
  return out;
};
{
  const r = batchCase(BASE);
  ok('the setup: Thursday has a cook, and «otra cosa» as a MEAL is refused before its dinner can be logged (the purchase used to be lost)', r.hadCook && r.mealRefused);
  ok('«no se hizo» + addBatch(compré, 3): an extra with no log key', r.res.ok && r.noLogKey, JSON.stringify(r.res));
  ok('…tonight eats the bought batch (the rotisserie Thursday, before dinner)', r.thuEats, JSON.stringify(r.dinner));
  ok('…and Friday eats from it too', r.fri);
  ok('…it is in the pot with all 3 portions, as bought', r.potOk, r.pot.join(','));
  ok('…nothing was written to the dinner log, and the gate accepts the week', r.noDinnerLog && r.gate.length === 0, JSON.stringify(r.gate));
  ok('he takes it back with logCook tossed: out of the pot and off tonight', r.tossed && r.goneAfterToss);
  ok('addBatch refuses: no at, 0 servings, a future date, an unknown recipe', r.refusals.every(x => x === false), r.refusals.join(','));
  ok('an off-plan cook (chaufa, 3, cooked) is a cooked batch named by its recipe; the dinner log untouched', r.cooked);
  const z = mk(); z.ladder.rung = 1;   // why src matters: the rung counts an off-plan COOK, never a purchase
  const rid = z.recipes.find(x => x.role === 'main' && x.rung === 1 && x.assembly).id;
  const eat2 = src => { const s = mk(); s.plan = O.buildWeek(s, WED, hm('09:00')); const b = O.addBatch(s, { recipe: rid, servings: 2, src }, WED, hm('09:00'), AT(WED, '09:00')).batch;
    O.logMeal(s, WED, 'dinner', { s: 'ate', of: b }, WED, hm('19:30'), AT(WED, '19:30')); O.logMeal(s, THU, 'lunch', { s: 'ate', of: b }, THU, hm('13:00'), AT(THU, '13:00')); return O.rungCheck(s, THU, hm('14:00')).n; };
  ok('an off-plan cook counts toward the rung; the same food bought does not', eat2('cooked') === 2 && eat2('bought') === 0, eat2('cooked') + ' / ' + eat2('bought'));
}
control('re-plant a log key on addBatch: the batch dies with a meal that never existed, and tonight is not fed', () => batchCase(replant('engine',
  "x.src : 'other', from: null, at: +at };", "x.src : 'other', from: null, at: +at, log: date + ':dinner' };")).thuEats);


console.log('\n34. A ticked line STAYS, ticked — and the list carries everything a dish needs except salt and pepper (1-oct-2026: cumin and garlic never reached it)');
const ALLDAYS = []; for (let i = 0; i < 14; i++) ALLDAYS.push(O.addDays(THU, i));
const HOURS = ['08:00', '14:00', '16:40', '20:00', '23:00'];
const tickSweep = B => {   // every line of every trip, ticked one at a time, then the week re-derived exactly as the app does (ensureWeek → render)
  let n = 0, lost = [];
  ALLDAYS.slice(0, 7).forEach(d => HOURS.forEach(h => {
    const base = mkWith(B.seed); base.plan = B.O.buildWeek(base, d, hm(h));
    B.O.shopping(base, d, hm(h)).trips.forEach(t => t.items.forEach(it => {
      const s = JSON.parse(JSON.stringify(base)); B.O.check(s, it.key, true, AT(d, h)); s.plan = B.O.buildWeek(s, d, hm(h));
      const back = [].concat(...B.O.shopping(s, d, hm(h)).trips.map(x => x.items)).find(x => x.key === it.key); n++;
      if (!(back && back.checked)) lost.push(d + ' ' + h + ' ' + it.key);
    }));
  }));
  return { n, lost };
};
{
  const r = tickSweep(BASE);
  ok('ticking ANY line on ANY trip, at any hour of seven days, leaves that line in place and ticked', r.n > 400 && r.lost.length === 0, r.n + ' ticks; lost: ' + r.lost.slice(0, 6).join(', '));
  ok('…and the sweep really ticks ride-alongs (the fridge meals and the weekly staples): leche, yogur-griego, mantequilla-mani are among the lines', (() => { const s = mkWith(BASE.seed); s.plan = O.buildWeek(s, THU, hm('16:40')); const ids = [].concat(...O.shopping(s, THU, hm('16:40')).trips.map(t => t.items)).map(i => i.id); return ['leche', 'yogur-griego', 'mantequilla-mani'].every(x => ids.indexOf(x) >= 0); })());
  ok('a ride-along ticked on a trip that has PASSED is still not re-bought on the next trip this week', (() => {
    const s = mkWith(BASE.seed); s.plan = O.buildWeek(s, THU, hm('09:00')); const t0 = O.shopping(s, THU, hm('09:00')).trips[0], lech = t0.items.find(i => i.id === 'leche');
    O.check(s, lech.key, true, AT(THU, '10:00')); s.plan = O.buildWeek(s, FRI, hm('09:00'));
    return lech && ![].concat(...O.shopping(s, FRI, hm('09:00')).trips.map(t => t.items.filter(i => !i.checked))).some(i => i.id === 'leche' && /cada semana/.test(i.for.join(' ')));
  })());
}
const cumulative = B => {   // tick line after line (each tick re-derives the week, which may move a trip by a day); every line ticked so far must still read ticked
  const lost = []; let n = 0;
  ALLDAYS.slice(0, 4).forEach(d => ['08:00', '14:00', '16:40', '19:30', '23:00'].forEach(h => {
    const s = mkWith(B.seed); s.plan = B.O.buildWeek(s, d, hm(h)); const done = [];
    const lines = () => [].concat(...B.O.shopping(s, d, hm(h)).trips.filter(t => t.date <= O.addDays(d, 1)).map(t => t.items));   // the trip he is actually ON: today's (tomorrow's once the store has closed)
    for (let g = 0; g < 60; g++) {
      const nx = lines().find(i => !i.checked); if (!nx) break;
      B.O.check(s, nx.key, true, AT(d, h) + g); s.plan = B.O.buildWeek(s, d, hm(h)); done.push(nx.id); n++;
      const now = lines(); done.forEach(id => { if (!now.some(i => i.id === id && i.checked)) lost.push(d + ' ' + h + ' ' + id + ' after ' + nx.id); });
    }
  }));
  return { n, lost };
};
{
  const r = cumulative(BASE);
  ok('ticking line after line on the trip he is ON (each tick re-derives the week and can drop the dish a line was for), no TICKED line ever leaves', r.n > 200 && r.lost.length === 0, r.n + ' ticks; lost: ' + r.lost.slice(0, 4).join(' | '));
}
control('re-plant: a ticked line whose dish left the plan is dropped (he bought the tuna; the list forgets it)', () => cumulative(replant('engine', "if (!t || info.unknown ||", 'if (true ||')).lost.length === 0);
control('re-plant: «bought this week» counts today\'s own tick again (the line leaves the list the moment it is ticked)', () => tickSweep(replant('engine', "return k.slice(0, i) === id && T < today && weekStart(T) === wk", "return k.slice(0, i) === id && weekStart(T) === wk")).lost.length === 0);

const SALT = ['sal', 'pimienta'];
const needsOfWeek = (O_, s, d, h) => {   // what the week's dishes need, read from the RECIPES — never from the list under test
  const need = {}, N = hm(h); s.plan = O_.buildWeek(s, d, N);
  for (let i = 0; i < 7; i++) {
    const dd = O_.addDays(d, i), day = s.plan.days[dd]; if (!day) continue;
    if (day.cook) { const cs = O_.cookState(s, dd, d, N); if (cs === 'planned' || cs === 'due' || cs === 'cooking') { const rec = O_.recipeById(s, day.cook.recipe); O_.scaleIngredients(s, rec, day.cook.servings).forEach(g => { if (g.id && !g.opt && g.q > 0) (need[g.id] = need[g.id] || []).push(rec.id); }); } }
    O_.slotsFor(s, dd).forEach(sl => { const r = day[sl]; if (!r || r.kind !== 'home' || !r.recipe) return; const rec = O_.recipeById(s, r.recipe); if (rec) O_.scaleIngredients(s, rec, 1).forEach(g => { if (g.id && !g.opt && g.q > 0) (need[g.id] = need[g.id] || []).push(rec.id); }); });
  }
  return need;
};
const missingFromList = (B, mutate) => {
  let missing = [], seen = {}, cases = 0;
  ALLDAYS.forEach(d => HOURS.forEach(h => {
    const s = mkWith(B.seed); if (mutate) mutate(s);
    const need = needsOfWeek(B.O, s, d, h), listed = {}; [].concat(...B.O.shopping(s, d, hm(h)).trips.map(t => t.items)).forEach(i => { listed[i.id] = 1; }); cases++;
    Object.keys(need).forEach(id => { seen[id] = 1; if (SALT.indexOf(id) < 0 && !listed[id]) missing.push(d + ' ' + h + ' ' + id + ' (' + need[id][0] + ')'); });
  }));
  return { missing, seen, cases };
};
{
  const r = missingFromList(BASE);
  ok('every ingredient any dish of the next 7 days needs is on the list, 14 days × 5 hours — only salt and pepper are ever assumed', r.cases === 70 && r.missing.length === 0, r.missing.slice(0, 6).join(' | '));
  ok('…and the sweep really meets the ones he named: garlic and cumin are needed in it (a sweep that never needs them proves nothing)', !!r.seen.ajo && !!r.seen.comino, Object.keys(r.seen).length + ' ids; ajo ' + !!r.seen.ajo + ' comino ' + !!r.seen.comino);
  ok('the seed pantry is salt and pepper, nothing else', JSON.stringify(seed.settings.pantry) === JSON.stringify(SALT));
}
control('re-plant: the old ten-staple pantry (garlic, cumin, oil, soy… «always at home») hides ingredients from the list', () => missingFromList(BASE, s => { s.settings.pantry = ['sal', 'pimienta', 'aceite', 'aceite-oliva', 'ajo', 'sillao', 'vinagre', 'comino', 'oregano', 'azucar']; }).missing.length === 0);
{
  const OLD = ['sal', 'pimienta', 'aceite', 'aceite-oliva', 'ajo', 'sillao', 'vinagre', 'comino', 'oregano', 'azucar'];
  const legacy = () => { const s = mkWith(seed); s.schema = 2; s.settings.pantry = OLD.slice(); return s; };
  const L = load(), m = L.H.appMigrate(legacy());
  ok('a schema-2 copy (his phone, the gist) holding the old ten staples comes out salt + pepper', JSON.stringify(m.settings.pantry) === JSON.stringify(SALT) && m.schema === 3, JSON.stringify(m.settings.pantry));
  const mine = L.H.appMigrate(Object.assign(JSON.parse(JSON.stringify(m)), { settings: Object.assign({}, m.settings, { pantry: ['sal', 'pimienta', 'aceite'] }) }));
  ok('…and from schema 3 on, a pantry he sets himself is kept (the reset runs once, not on every pull)', JSON.stringify(mine.settings.pantry) === JSON.stringify(['sal', 'pimienta', 'aceite']), JSON.stringify(mine.settings.pantry));
  control('re-plant: the schema-3 pantry reset is gone — the legacy staples survive the migration', () => { const R = replant('hooks', "  if (!(s.schema >= 3)) S.pantry = D.pantry.slice();", ''); return JSON.stringify(R.H.appMigrate(legacy()).settings.pantry) === JSON.stringify(SALT); });
}

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
    local.cookSession = { date: WED, batch: null, recipe: 'bowl-coreano', servings: 3, step: 2, timers: [], got: {}, startedAt: 1 }; remote.cookSession = null;   // he is mid-cook on THIS device
    O.logMeal(remote, WED, 'bf', { s: 'ate' }, WED, hm('09:00'), AT(WED, '09:00')); remote.settings.hall.swipesPerWeek = 9; remote.lastModified = 200; remote.pub = { v: 2, stale: true };
    delete remote.settings.sync; remote.settings.claude = { model: 'm' };
    const R = syncRig(local, remote, syncSrc), need = await R.api.syncPull(), st = R.api.get();
    out.adopt = st.settings.hall.swipesPerWeek === 9 && st.settings.sync.gistId === 'g1';
    out.keepMine = !!(O.effLog(st, WED, 'lunch') && O.effLog(st, WED, 'bf'));
    out.needPush = need === true;
    out.noPub = !('pub' in st);
    out.quietSaves = R.saves.length > 0 && R.saves.every(o => o.markModified === false && o.push === false);
    out.noStore = R.calls.length > 0 && R.calls.every(c => c.cache === 'no-store');
    out.keepSession = !!(st.cookSession && st.cookSession.step === 2 && st.cookSession.recipe === 'bowl-coreano');
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
    local.cookSession = { date: WED, batch: null, recipe: 'bowl-coreano', servings: 3, step: 1, timers: [], got: {}, startedAt: 1 };
    const R = syncRig(local, remote, syncSrc); await R.api.syncPush();
    const methods = R.calls.map(c => c.method).join(','), patch = R.calls.find(c => c.method === 'PATCH');
    const content = patch && patch.body.files['olla.json'] && patch.body.files['olla.json'].content, pushed = content && JSON.parse(content);
    out.getFirst = methods === 'GET,PATCH';
    out.onlyOlla = !!patch && JSON.stringify(Object.keys(patch.body.files)) === JSON.stringify(['olla.json']);
    out.union = !!(pushed && O.effLog(pushed, WED, 'bf') && O.effLog(pushed, WED, 'lunch'));
    out.pub = !!(pushed && pushed.pub && pushed.pub.v === 2 && typeof pushed.pub.day === 'string');
    out.noSecrets = !!content && !/ghp_SECRET|sk-SECRET/.test(content);
    out.noSession = !!pushed && !('cookSession' in pushed);
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
  ok('push never carries the cook-along (device-local, UI review #11)', r.noSession);
  ok('pull, remote newer: this device\'s cook-along in progress survives the adopt', r.keepSession);
  redIf('re-plant v1\'s pull (adopt the remote wholesale): this device\'s entry is lost', (await syncCase(replant('sync', 'needPush = OLLA.mergeReality(remote, mine) > 0;', 'needPush = false;').SYNC)).keepMine);
  redIf('re-plant v1\'s blind push: the other device\'s entry is erased by the PATCH', (await syncCase(replant('sync', 'if (looksLikeMyState(remoteState) && OLLA.mergeReality(state, migrate(remoteState)) > 0) {', 'if (false) {').SYNC)).union);
  redIf('re-plant: a gistFetch without no-store is SEEN', (await syncCase(replant('sync', "    cache: 'no-store',", '').SYNC)).noStore);
  redIf('re-plant: the cook-along rides the gist again', (await syncCase(replant('sync', '  delete out.cookSession;', '').SYNC)).noSession);
  redIf('re-plant: adopting a newer gist takes ITS null session and ends the cook-along here', (await syncCase(replant('sync', "      remote.cookSession = mine.cookSession === undefined ? null : mine.cookSession;", '').SYNC)).keepSession);
  finish();
})().catch(e => { fail++; console.log('  FAIL sync rig crashed — ' + ((e && e.stack) || e)); finish(); });

function finish() {
console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) { console.log('test-olla: FAIL'); process.exit(1); }
console.log('test-olla: OK');
}
