// test-olla.js — pins La Olla's engine. Runs the REAL block extracted from index.html between its OLLA-ENGINE
// markers (and the seed between OLLA-SEED markers), so it tests exactly what ships. Every load-bearing pin is
// followed by a CONTROL that re-plants the defect and must FAIL — a green harness that has never gone red
// proves nothing. Deterministic: `today` is passed in, never read from the clock.
process.env.TZ = 'America/New_York';
const fs = require('fs'), vm = require('vm');
const HTML = fs.readFileSync(__dirname + '/index.html', 'utf8');
function block(a, b) { const i = HTML.indexOf(a), j = HTML.indexOf(b); if (i < 0 || j < 0) throw new Error('marker missing: ' + a); if (HTML.indexOf(a, i + 1) >= 0) throw new Error('marker twice: ' + a); return HTML.slice(i, j + b.length); }
const ENGINE = block('/* ═══ OLLA-ENGINE-BEGIN', 'OLLA-ENGINE-END ═══ */'), SEED = block('/* ═══ OLLA-SEED-BEGIN', 'OLLA-SEED-END ═══ */');
function fresh() { const ctx = { module: { exports: {} }, console }; vm.createContext(ctx); vm.runInContext(ENGINE, ctx); const O = ctx.module.exports; vm.runInContext(SEED + '\nmodule.exports = OLLA_SEED;', ctx); const seed = JSON.parse(JSON.stringify(ctx.module.exports)); return { O, seed }; }
const { O, seed } = fresh();
if (typeof O.buildWeek !== 'function') throw new Error('engine did not export buildWeek');
function mk() { const s = JSON.parse(JSON.stringify(seed)); s.plan = { via: 'fallback', days: {} }; s.log = {}; s.groceries = { checked: {} }; return s; }
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); } }
function control(name, fn) { let red = false, msg = ''; try { red = !fn(); } catch (e) { red = true; msg = e.message; } if (red) { pass++; console.log('  red  (control) ' + name); } else { fail++; console.log('  FAIL (control stayed green) ' + name + ' ' + msg); } }
const WED = '2026-09-30', THU = '2026-10-01', FRI = '2026-10-02', SAT = '2026-10-03', SUN = '2026-10-04', MON = '2026-10-05', TUE = '2026-10-06';
const dowName = d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][O.dow(d)];

console.log('\n1. The fallback week (model OFF) is a VALID week');
{
  const s = mk(); s.plan = O.buildWeek(s, WED);
  const days = Object.keys(s.plan.days).sort();
  ok('seven days from today', days.length === 7 && days[0] === WED && days[6] === TUE, days.join(','));
  ok('every slot has a kind', days.every(d => O.SLOTS.every(sl => s.plan.days[d][sl] && O.KINDS.indexOf(s.plan.days[d][sl].kind) >= 0)));
  const bad = O.validateWeek(s, s.plan, WED);
  ok('the gate accepts it', bad.length === 0, JSON.stringify(bad));
  ok('via says which path served', s.plan.via === 'fallback');
  ok('dinner is NEVER a swipe', days.every(d => s.plan.days[d].dinner.kind !== 'swipe'));
  ok('weekday breakfast + lunch are swipes', [WED, THU, FRI, MON, TUE].every(d => s.plan.days[d].bf.kind === 'swipe' && s.plan.days[d].lunch.kind === 'swipe'));
  ok('weekend breakfast is from the fridge', s.plan.days[SAT].bf.kind === 'home' && s.plan.days[SUN].bf.kind === 'home');
  ok('Sunday lunch is out (the Hilltop)', s.plan.days[SUN].lunch.kind === 'out');
  ok('Wed cooks in its window', s.plan.days[WED].cook && s.plan.days[WED].dinner.kind === 'cook' && s.plan.days[WED].cook.at === '13:00', JSON.stringify(s.plan.days[WED].cook));
  ok('Thu eats Wed\'s pot', s.plan.days[THU].dinner.kind === 'leftover' && s.plan.days[THU].dinner.of === s.plan.days[WED].cook.batch);
  ok('Mon and Tue (no window) eat Sat\'s pot', s.plan.days[MON].dinner.of === s.plan.days[SAT].cook.batch && s.plan.days[TUE].dinner.of === s.plan.days[SAT].cook.batch);
  ok('Sat cooks four (Sat, Sun, Mon, Tue)', s.plan.days[SAT].cook.servings === 4, String(s.plan.days[SAT].cook.servings));
  ok('every cook is at least a double', days.filter(d => s.plan.days[d].cook).every(d => s.plan.days[d].cook.servings >= 2));
  ok('train days carry the fourth-meal flag', s.plan.days[THU].train === true && s.plan.days[WED].train === false);
  const pot = O.potFrom(s, s.plan); ok('no pot is overdrawn', pot.every(b => b.left >= 0), JSON.stringify(pot.map(b => b.left)));
  ok('leftovers are inside fridge life', days.filter(d => s.plan.days[d].dinner.kind === 'leftover').every(d => { const b = pot.find(x => x.id === s.plan.days[d].dinner.of); return O.diffDays(b.date, d) <= b.fridgeDays; }));
}
control('a book with NO staple yields no cook and the gate still passes (home dinners), but a cook row with an unknown recipe is refused', () => {
  const s = mk(); s.plan = O.buildWeek(s, WED); s.plan.days[WED].cook.recipe = 'no-such-dish'; return O.validateWeek(s, s.plan, WED).length === 0;
});

console.log('\n2. Cook outside every window is REFUSED');
{
  const s = mk(); s.plan = O.buildWeek(s, WED);
  const r = O.setKind(s, MON, 'dinner', 'cook', WED);
  ok('Monday (no window) cook refused', !r.ok && /ventana/.test(r.why), r.why);
  ok('the plan was left valid', O.validateWeek(s, s.plan, WED).length === 0);
  s.settings.cookWindows['1'] = ['18:00-20:00'];
  const r2 = O.setKind(s, MON, 'dinner', 'cook', WED);
  ok('opening a Monday window admits it, at the window start', r2.ok && s.plan.days[MON].cook && s.plan.days[MON].cook.at === '18:00', JSON.stringify(r2));
  ok('the hand row is marked', s.plan.days[MON].dinner.hand === true && s.plan.days[MON].cook.hand === true);
}
control('re-plant: a cook row placed at 20:00 on a 13:00-17:30 day must be refused by the gate', () => {
  const s = mk(); s.plan = O.buildWeek(s, WED); s.plan.days[WED].cook.at = '20:00'; return O.validateWeek(s, s.plan, WED).length === 0;
});
control('re-plant: the gate must see a cook at the window\'s very END as outside it', () => {
  const s = mk(); s.plan = O.buildWeek(s, WED); s.plan.days[WED].cook.at = '17:30'; return O.validateWeek(s, s.plan, WED).length === 0;
});

console.log('\n3. A skipped meal NEVER rewrites the plan; the log refuses the future');
{
  const s = mk(); s.plan = O.buildWeek(s, WED);
  const before = JSON.stringify(s.plan);
  ok('logging today\'s lunch as skipped is accepted', O.logMeal(s, WED, 'lunch', 'skipped', WED).ok);
  ok('logging yesterday\'s dinner as ate is accepted', O.logMeal(s, '2026-09-29', 'dinner', 'ate', WED).ok);
  ok('the plan is byte-identical after', JSON.stringify(s.plan) === before);
  const f = O.logMeal(s, THU, 'dinner', 'ate', WED);
  ok('tomorrow\'s dinner is refused', !f.ok && !s.log[THU + ':dinner'], f.why);
  ok('an unknown state is refused', !O.logMeal(s, WED, 'bf', 'maybe', WED).ok);
  ok('rebuilding the week keeps the log', (s.plan = O.buildWeek(s, WED), s.log[WED + ':lunch'].s === 'skipped'));
}
control('re-plant: a log that reached into the plan would change it', () => {
  const s = mk(); s.plan = O.buildWeek(s, WED); const before = JSON.stringify(s.plan); s.plan.days[WED].lunch.kind = 'out'; return JSON.stringify(s.plan) === before;
});

console.log('\n4. Plan minutes come from the recipe, never from a number handed in');
{
  const s = mk(); s.plan = O.buildWeek(s, WED);
  const rec = O.recipeById(s, s.plan.days[WED].cook.recipe);
  ok('cook dinner costs the recipe\'s total', O.minutesFor(s, WED, 'dinner') === Math.max(10, rec.minutes.total), String(O.minutesFor(s, WED, 'dinner')));
  ok('a swipe costs the walk both ways plus the meal', O.minutesFor(s, WED, 'lunch') === 2 * s.settings.hall.walkMin + 20);
  ok('a leftover costs 15', O.minutesFor(s, THU, 'dinner') === 15);
  ok('no row → null, never 0', O.minutesFor(s, '2026-12-25', 'dinner') === null);
  rec.minutes.total = 400;
  ok('clamped to 180', O.minutesFor(s, WED, 'dinner') === 180);
  rec.minutes.total = 2;
  ok('clamped to 10 — a missing reading is not a 0-minute meal', O.minutesFor(s, WED, 'dinner') === 10);
}

console.log('\n5. Leftovers ≤ fridge days and ≤ N−1 per batch');
{
  const s = mk(); s.plan = O.buildWeek(s, WED);
  const sat = s.plan.days[SAT].cook, rec = O.recipeById(s, sat.recipe);
  ok('Tue is day 3 of a 3-day pot: accepted', O.validateWeek(s, s.plan, WED).length === 0 && O.diffDays(SAT, TUE) === rec.fridgeDays);
  // shrink fridge life: Tue must fall off the pot
  rec.fridgeDays = 2; s.plan = O.buildWeek(s, WED);
  ok('with a 2-day pot, Tue no longer eats Sat\'s batch', s.plan.days[TUE].dinner.of !== s.plan.days[SAT].cook.batch && s.plan.days[TUE].dinner.kind === 'home', s.plan.days[TUE].dinner.kind);
  ok('and Sat cooks fewer', s.plan.days[SAT].cook.servings === 3, String(s.plan.days[SAT].cook.servings));
}
control('re-plant: a fourth eater on a 3-serving pot must be refused as stale/overdrawn', () => {
  const s = mk(); s.plan = O.buildWeek(s, WED); const b = s.plan.days[SAT].cook.batch; s.plan.days[SAT].cook.servings = 3; s.plan.days[SUN].lunch = { kind: 'leftover', of: b }; return O.validateWeek(s, s.plan, WED).length === 0;
});
control('re-plant: a leftover of a batch that expired must be refused', () => {
  const s = mk(); s.plan = O.buildWeek(s, WED); s.plan.days[TUE].dinner = { kind: 'leftover', of: s.plan.days[WED].cook.batch }; return O.validateWeek(s, s.plan, WED).length === 0;
});

console.log('\n5b. What is physically in the pot (potNow) vs what the planner may still commit (liveBatches)');
{
  const s = mk(); s.plan = O.buildWeek(s, WED);
  const wedNow = O.potNow(s, s.plan, WED), wedLive = O.liveBatches(s, s.plan, WED);
  ok('Wed evening: the pot holds both portions (tonight\'s and Thu\'s)', wedNow.length === 1 && wedNow[0].left === 2, JSON.stringify(wedNow.map(b => b.left)));
  ok('…while the planner has nothing left to commit', wedLive.length === 0);
  const thuNow = O.potNow(s, s.plan, THU);
  ok('Thu: one portion left, Wed\'s dinner is behind us', thuNow.length === 1 && thuNow[0].left === 1, JSON.stringify(thuNow.map(b => b.left)));
  ok('Sun: Sat\'s pot holds three (Sun, Mon, Tue), expiring Tue', (() => { const p = O.potNow(s, s.plan, SUN); return p.length === 1 && p[0].left === 3 && p[0].expires === TUE; })(), JSON.stringify(O.potNow(s, s.plan, SUN).map(b => [b.left, b.expires])));
  ok('a future batch is not in the pot yet', O.potNow(s, s.plan, THU).every(b => b.date <= THU));
  ok('an expired batch is not in the pot', O.potNow(s, s.plan, '2026-10-09').every(b => b.date >= '2026-10-06'));
}
control('re-plant: counting only uncommitted servings would report an EMPTY pot on the evening he cooked', () => { const s = mk(); s.plan = O.buildWeek(s, WED); return O.liveBatches(s, s.plan, WED).length > 0; });

console.log('\n6. Rung-up only from meals EATEN across two weeks; never asserted');
{
  const s = mk(); s.ladder.rung = 2; s.plan = O.buildWeek(s, WED);
  // eat six rung-2 cook meals across two ISO weeks by logging them as the days pass
  const eatAll = (from, to) => { for (let d = from; d <= to; d = O.addDays(d, 1)) { const day = s.plan.days[d]; if (!day) continue; if (day.dinner.kind === 'cook' || day.dinner.kind === 'leftover') O.logMeal(s, d, 'dinner', 'ate', to); if (day.lunch.kind === 'leftover') O.logMeal(s, d, 'lunch', 'ate', to); } };
  eatAll(WED, TUE);
  let c = O.rungCheck(s, TUE);
  ok('one week of eating is not enough (' + c.n + ' meals over ' + c.span + ' days)', !c.pass && c.n >= 6, JSON.stringify(c));
  // next week: the walk keeps the past, builds the new week
  const WED2 = '2026-10-07', TUE2 = '2026-10-13';
  s.plan = O.buildWeek(s, WED2); eatAll(WED2, TUE2);
  c = O.rungCheck(s, TUE2);
  ok('two weeks of eating passes the rung', c.pass && c.n >= 6 && c.weeks >= 2, JSON.stringify(c));
  const up = O.rungUp(s, TUE2);
  ok('rungUp moves the ladder and records it', s.ladder.rung === 3 && s.ladder.passed.length === 1 && s.ladder.passed[0].rung === 2);
  ok('the new week cooks the rung-3 staple', (s.plan = O.buildWeek(s, '2026-10-14'), O.recipeById(s, s.plan.days['2026-10-14'].cook.recipe).rung === 3));
}
{
  const s = mk(); s.ladder.rung = 2; s.plan = O.buildWeek(s, WED); for (let i = 0; i < 6; i++) O.logMeal(s, WED, O.SLOTS[i % 3], 'ate', WED);
  ok('six ates on ONE day do not pass', !O.rungCheck(s, WED).pass);
  const t = mk(); t.ladder.rung = 1; t.plan = O.buildWeek(t, SAT);
  ['2026-10-03', '2026-10-04', '2026-10-10', '2026-10-11', '2026-10-17', '2026-10-18'].forEach(d => { t.plan.days[d] = t.plan.days[d] || { bf: { kind: 'home', recipe: 'yogur-bowl' }, lunch: { kind: 'out' }, dinner: { kind: 'out' } }; O.logMeal(t, d, 'bf', 'ate', '2026-10-18'); });
  ok('fridge-default (home) rows never count toward a rung, even across three weekends', !O.rungCheck(t, '2026-10-18').pass, JSON.stringify(O.rungCheck(t, '2026-10-18')));
}
control('re-plant: the same six meals as POT rows (cook of the rung-1 staple) DO pass — proves the instrument can see a pass', () => {
  const t = mk(); t.ladder.rung = 1; t.plan = O.buildWeek(t, SAT);
  ['2026-10-03', '2026-10-04', '2026-10-10', '2026-10-11', '2026-10-17', '2026-10-18'].forEach(d => { t.plan.days[d] = { bf: { kind: 'out' }, lunch: { kind: 'out' }, dinner: { kind: 'cook' }, cook: { recipe: 'pollo-rostizado-bowl', at: '11:00', servings: 2, batch: 'x' + d } }; O.logMeal(t, d, 'dinner', 'ate', '2026-10-18'); });
  return !O.rungCheck(t, '2026-10-18').pass;   // passes → returns false → red
});

console.log('\n7. looksLikeMyState rejects the siblings\' gists; migrate merges over defaults');
{
  // the real shapes of the other two apps' gist files
  const cuaderno = { settings: { theme: 'forge' }, exercises: [], sessions: [], bodyweight: [], plan: null, schema: 2 };
  const lampara = { settings: {}, reading: { bookId: 'john', ch: 1 }, notes: [], read: {} };
  const looks = new Function('s', HTML.slice(HTML.indexOf('function looksLikeMyState(s) {') + 'function looksLikeMyState(s) {'.length, HTML.indexOf('}', HTML.indexOf('function looksLikeMyState(s) {'))));
  ok('cuaderno.json is refused', !looks(cuaderno));
  ok('lampara.json is refused', !looks(lampara));
  ok('our own state is accepted', !!looks(mk()));
  ok('a schema-0 legacy snapshot missing the book is refused (it is not ours until migrate has run on OUR shape)', !looks({ settings: {}, plan: { days: {} } }));
}
control('re-plant: the OLD shell validator (settings only) would have adopted cuaderno.json', () => {
  const old = s => !!(s && typeof s === 'object' && s.settings); return !old({ settings: { theme: 'forge' }, sessions: [] });
});
{
  // appMigrate: a legacy snapshot missing newer fields comes back with them, and his own values survive
  const src = HTML.slice(HTML.indexOf('const OLLA_SCHEMA = '), HTML.indexOf('function looksLikeMyState'));
  const ctx = { OLLA_SEED: seed, console }; vm.createContext(ctx); vm.runInContext(src + '\nthis.appMigrate = appMigrate;', ctx);
  const legacy = { settings: { hall: { swipesPerWeek: 10 }, cookWindows: { '3': ['14:00-16:00'] } }, plan: { days: {} } };
  const m = ctx.appMigrate(JSON.parse(JSON.stringify(legacy)));
  ok('his swipes value survives', m.settings.hall.swipesPerWeek === 10);
  ok('missing hall fields are filled from the seed', m.settings.hall.name === 'The Local' && Array.isArray(m.settings.hall.days));
  ok('his Wed window survives, the other days are filled', m.settings.cookWindows['3'][0] === '14:00-16:00' && Array.isArray(m.settings.cookWindows['5']));
  ok('ladder, recipes, log, groceries exist', m.ladder.rung === 1 && m.recipes.length === seed.recipes.length && m.log && m.groceries.checked);
  ok('running it twice changes nothing', JSON.stringify(ctx.appMigrate(JSON.parse(JSON.stringify(m)))) === JSON.stringify(m));
  ok('a recipe he edited by id is not overwritten by the seed', (() => { const s2 = ctx.appMigrate({ settings: {}, recipes: [{ id: 'chili', name: 'MI chili', rung: 3 }] }); return s2.recipes.find(r => r.id === 'chili').name === 'MI chili' && s2.recipes.length === seed.recipes.length; })());
}

console.log('\n8. Swipe budget, hall days and the trim');
{
  const s = mk(); s.settings.hall.swipesPerWeek = 6; s.plan = O.buildWeek(s, MON);   // Mon..Sun: 10 weekday swipes wanted, 6 allowed
  const wk = O.weekStart(MON);
  ok('the week never exceeds the budget', O.swipesUsed(s.plan, wk) <= 6, String(O.swipesUsed(s.plan, wk)));
  ok('trimmed rows say so and fall to the fridge', Object.keys(s.plan.days).some(d => O.SLOTS.some(sl => s.plan.days[d][sl].trimmed && s.plan.days[d][sl].kind === 'home')));
  ok('the gate agrees', O.validateWeek(s, s.plan, MON).length === 0, JSON.stringify(O.validateWeek(s, s.plan, MON)));
  ok('a swipe on a non-hall day is refused', !O.setKind(s, '2026-10-10', 'lunch', 'swipe', MON).ok);
  ok('a dinner swipe is refused', !O.setKind(s, MON, 'dinner', 'swipe', MON).ok);
}
control('re-plant: 15 swipes in a 14-week must be refused', () => { const s = mk(); s.plan = O.buildWeek(s, MON); s.settings.hall.days = [0, 1, 2, 3, 4, 5, 6]; s.plan = O.buildWeek(s, MON); s.settings.hall.swipesPerWeek = 5; return O.validateWeek(s, s.plan, MON).length === 0; });

console.log('\n9. Groceries derive from the week, minus the pantry, plus the staples — once each');
{
  const s = mk(); s.plan = O.buildWeek(s, WED);
  const g = O.groceries(s, WED), names = g.map(i => i.n.toLowerCase());
  ok('rotisserie chicken is on the list', names.some(n => /pollo rostizado/.test(n)));
  ok('the pantry (sal, aceite) is not', !names.includes('sal') && !names.includes('aceite'));
  ok('weekly staples are on it', names.includes('leche') && names.includes('mantequilla de maní'));
  ok('yogur griego appears ONCE (weekend breakfasts + the staple)', names.filter(n => n === 'yogur griego').length === 1, names.filter(n => n === 'yogur griego').length);
  ok('quantities scale with servings (2 + 2 + 4 portions = 2 chickens)', g.find(i => /pollo rostizado/.test(i.n)).q === 2, String(g.find(i => /pollo rostizado/.test(i.n)).q));
}

console.log('\n10. Time is local and the walk is DST-safe');
{
  ok('ymd is the LOCAL day', O.ymd(new Date(2026, 8, 28, 23, 30)) === '2026-09-28');
  ok('addDays across the Nov 1 DST fall-back', O.addDays('2026-10-31', 2) === '2026-11-02' && O.diffDays('2026-10-31', '2026-11-02') === 2);
  ok('weekStart is Sunday', O.weekStart(WED) === '2026-09-27' && O.dow(O.weekStart(WED)) === 0);
  ok('isoWeek', O.isoWeek('2026-01-01') === '2026-W01' && O.isoWeek('2026-12-31') === '2026-W53');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) { console.log('test-olla: FAIL'); process.exit(1); }
console.log('test-olla: OK');
