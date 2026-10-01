/* ── La Olla UI v2 — «Peltre negro» ──────────────────────────────────────────────────────────────────────
   Consumes ONLY the engine API (LA-OLLA-V2-SPEC.md §2.6). The UI owns the clock: it reads the local day and
   the minute, and hands them to the engine, which never reads one. Four views (Hoy · Semana · Libro · Lista),
   one bottom sheet for everything that slides up, and the cook-along runner (La Forja's pattern: one thing per
   screen, timers stored as absolute endsAt so a reload never loses them, the screen kept awake). */
const OLLAUI = (function () {
  const DOWS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const DOW1 = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  const DOWS3 = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const SLOT_ES = { bf: 'desayuno', lunch: 'almuerzo', dinner: 'cena', post: 'después del gym' };
  const KIND_ES = { swipe: 'swipe', leftover: 'sobra', cook: 'cocinar', home: 'nevera', out: 'fuera' };
  const RUNG_ES = { 1: 'armar, sin cuchillo', 2: 'una sartén', 3: 'arroz y un guiso', 4: 'el saltado, fuego alto', 5: 'el plato de verdad' };
  const ROLE_ES = { main: '', side: 'acompañamiento', condiment: 'para encima', bf: 'desayuno', snack: 'entre comidas' };
  const GEAR_ES = { pot: 'olla', pan: 'sartén', oven: 'horno', microwave: 'microondas', riceCooker: 'arrocera', blender: 'licuadora', thermometer: 'termómetro', sheetPan: 'bandeja de horno' };
  const LIKE_ES = { again: 'otra vez', meh: 'meh', never: 'nunca' };
  let view = 'hoy', lid = false, minuteTimer = null, runnerTimer = null, wake = null, actx = null, sheetCtx = null;

  /* ── the clock lives HERE, never in the engine ── */
  const T = () => OLLA.ymd(new Date());
  const N = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const esc = s => escapeHtml(s == null ? '' : String(s));
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  const hmOf = min => OLLA.fmtHM(Math.max(0, Math.min(1439, Math.round(min))));
  const hmShort = s => { const m = OLLA.hm(String(s || '')); return m == null ? String(s || '') : (m % 60 ? hmOf(m) : Math.floor(m / 60) + 'h'); };
  const fmtDate = d => { const p = OLLA.parse(d); return DOWS[p.getDay()] + ' ' + p.getDate() + ' de ' + MONTHS[p.getMonth()]; };
  const dayWord = d => { const t = T(); if (d === t) return 'hoy'; if (d === OLLA.addDays(t, 1)) return 'mañana'; if (d === OLLA.addDays(t, -1)) return 'ayer'; const p = OLLA.parse(d); return 'el ' + DOWS[p.getDay()] + ' ' + p.getDate(); };
  const dayShort = d => { const p = OLLA.parse(d); return DOWS3[p.getDay()] + ' ' + p.getDate(); };
  const slotOf = (sl, d) => SLOT_ES[sl] + (d === T() ? '' : ' del ' + DOWS[OLLA.dow(d)]);
  const porc = n => n + (n === 1 ? ' porción' : ' porciones');
  const rec = id => OLLA.recipeById(state, id);
  const verb = r => r ? OLLA.verbFor(r) : 'cocinar';
  const saveTap = () => save();                                            // his edit: modified, pushed
  const saveQuiet = () => save({ markModified: false, push: false });    // a re-derivation: never wins a sync

  /* ── the week is a RULE: rebuilt from (today, now) on every boot, wake and tap ── */
  function ensureWeek() {
    const before = JSON.stringify(state.plan);
    state.plan = OLLA.buildWeek(state, T(), N());
    const changed = JSON.stringify(state.plan) !== before;
    if (changed) saveQuiet();
    return changed;
  }

  /* ── theme: auto follows the clock (Loza 7–19h), unless he picked one ── */
  function themePref() { const p = state.settings.theme; return state.settings.themeChosen ? (p || 'auto') : 'auto'; }
  function applyOllaTheme() {
    const pref = themePref(), h = new Date().getHours();
    const t = (pref === 'tokyo' || pref === 'loza') ? 'tokyo' : (pref === 'macchiato' || pref === 'esmalte') ? 'macchiato' : (h >= 7 && h < 19 ? 'tokyo' : 'macchiato');
    document.documentElement.setAttribute('data-theme', t);
    const meta = document.querySelector('meta[name="theme-color"]'); if (meta) meta.setAttribute('content', t === 'tokyo' ? '#f3ecdc' : '#10140d');
    document.querySelectorAll('[data-theme-pick]').forEach(b => b.classList.toggle('active', b.dataset.themePick === pref));
  }

  /* ── the pot, drawn: an enamel graniteware pot whose fill is what is really in it ── */
  const SPK = [[34, 64], [48, 90], [70, 72], [88, 96], [96, 62], [58, 104], [40, 80], [80, 58], [100, 84], [64, 88], [30, 96], [76, 104]];
  function potSvg(level, o) {
    o = o || {};
    const lv = Math.max(0, Math.min(1, level || 0)), top = 108 - lv * 58;
    const cls = 'pot-svg' + (o.closing ? ' closing' : '') + (o.closed ? ' closed' : '') + (o.cold ? ' cold' : '');
    return `<svg class="${cls}" viewBox="0 0 128 120" aria-hidden="true">
      <defs><clipPath id="pc${o.id || 0}"><path d="M20 47 L108 47 L103 102 Q101 111 92 111 L36 111 Q27 111 25 102 Z"/></clipPath></defs>
      <path class="wisp" d="M46 30 q-7 -8 0 -15 q7 -7 0 -14"/><path class="wisp" d="M64 26 q-7 -8 0 -15 q7 -7 0 -14"/><path class="wisp" d="M82 30 q-7 -8 0 -15 q7 -7 0 -14"/>
      <path class="handle" d="M20 57 q-13 0 -13 10 q0 10 13 10"/><path class="handle" d="M108 57 q13 0 13 10 q0 10 -13 10"/>
      <path class="body" d="M20 47 L108 47 L103 102 Q101 111 92 111 L36 111 Q27 111 25 102 Z"/>
      <rect class="fill" clip-path="url(#pc${o.id || 0})" x="14" y="${top.toFixed(1)}" width="100" height="${(lv * 58 + 6).toFixed(1)}"/>
      ${SPK.map(p => `<circle class="spk" cx="${p[0]}" cy="${p[1]}" r="1.1"/>`).join('')}
      <rect class="rim" x="14" y="41" width="100" height="9" rx="4.5"/>
      <g class="lid-g"><path class="lid" d="M18 40 Q64 16 110 40 Z"/><rect class="knob" x="57" y="17" width="14" height="8" rx="4"/></g>
      <path class="curl" d="M64 14 q-8 -9 0 -17 q8 -8 0 -16"/>
    </svg>`;
  }
  function jarSvg(fill) {
    const f = Math.max(0, Math.min(1, fill || 0)), h = 18 * f;
    return `<svg class="jar" viewBox="0 0 22 28" aria-hidden="true"><rect class="f" x="4" y="${(25 - h).toFixed(1)}" width="14" height="${h.toFixed(1)}" rx="2"/><path class="g" d="M6 3 h10 v3 q3 1 3 4 v14 q0 3 -3 3 h-10 q-3 0 -3 -3 v-14 q0 -3 3 -4 z"/></svg>`;
  }
  const CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const SHARE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3M7.5 7.5L12 3l4.5 4.5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';

  function setSteam(v) { document.documentElement.style.setProperty('--steam', String(Math.max(0, Math.min(1, v)).toFixed(3))); }

  /* ═══════════════════════════════ HOY ═══════════════════════════════ */
  function potPanel(t, n) {
    const pot = OLLA.potNow(state, t, n).filter(b => b.left > 0 && !b.frozen);
    const fz = OLLA.reality(state, t, n).batches.filter(b => b.frozen && b.left > 0);
    const closing = lid; lid = false;
    if (!pot.length) {
      setSteam(0.06);
      const next = nextCook(t, n);
      const line = next ? 'se llena ' + dayWord(next.date) + ' · ' + esc(next.name) : 'nada planeado esta semana';
      return `<button class="card speckle pot-panel rise" style="--i:1" data-act="pot" aria-label="La olla">
        <div><div class="kicker">En la olla</div><div class="pot-num word">Vacía</div><div class="pot-meta">${line}</div>${fz.length ? `<div class="pot-more">en el congelador: ${fz.map(b => esc(b.name) + ' (' + b.left + ')').join(', ')}</div>` : ''}</div>
        ${potSvg(0, { closed: true, cold: true, closing })}</button>`;
    }
    const p = pot[0], total = pot.reduce((a, b) => a + b.left, 0);
    const fd = Math.max(1, p.fridgeDays || 3), steam = Math.max(0.08, (p.daysLeft + 0.5) / (fd + 0.5));
    setSteam(steam);
    const lvl = Math.min(1, total / Math.max(p.servings || total, total, 1));
    const warn = p.daysLeft <= 0 ? '<span class="warn">se come hoy</span>' : 'hasta ' + dayWord(p.expires);
    const more = pot.slice(1).map(b => esc(b.name) + ' (' + b.left + ')').join(', ');
    return `<button class="card speckle pot-panel rise" style="--i:1" data-act="pot" aria-label="La olla">
      <div><div class="kicker">En la olla</div>
        <div class="pot-num${closing ? ' pop' : ''}">${total}</div>
        <div class="pot-name">${esc(p.name)} <span class="unit">· ${total === 1 ? 'porción' : 'porciones'}</span></div>
        <div class="pot-meta">${p.src === 'bought' ? 'comprado' : 'hecho'} ${dayWord(p.date)} · ${warn}</div>
        ${more ? `<div class="pot-more">y ${more}</div>` : ''}
        ${fz.length ? `<div class="pot-more">en el congelador: ${fz.map(b => esc(b.name) + ' (' + b.left + ')').join(', ')}</div>` : ''}</div>
      ${potSvg(lvl, { closing, cold: steam < 0.2 })}</button>`;
  }
  function nextCook(t, n) {
    const days = Object.keys(state.plan.days || {}).filter(d => d >= t).sort();
    for (const d of days) { const c = state.plan.days[d].cook; if (!c) continue;
      const st = OLLA.cookState(state, d, t, n); if (st !== 'planned' && st !== 'due' && st !== 'cooking') continue;
      const r = rec(c.recipe); return { date: d, at: c.at, name: r ? r.name : c.recipe, recipe: c.recipe, batch: c.batch, servings: c.servings, verb: verb(r) }; }
    return null;
  }

  function actionBlock(act, t, n) {
    if (state.cookSession) {
      const r = rec(state.cookSession.recipe);
      return `<button class="strike rise" style="--i:2" data-act="runner-resume">Seguir <small>${esc(r ? r.name : '')}${state.cookSession.timers && state.cookSession.timers.some(x => !x.done) ? ' · hay un temporizador' : ''}</small></button>`;
    }
    if (!act) return '';
    if (act.kind === 'cook-now' || act.kind === 'cook-soon') {
      const day = state.plan.days[act.date] || {}, c = day.cook || {}, r = rec(act.recipe || c.recipe);
      if (!r) return '';
      const v = verb(r), at = act.at || c.at;
      return `<button class="strike rise" style="--i:2" data-act="cook" data-date="${act.date}">${cap(v)} <small>${act.kind === 'cook-soon' ? 'a las ' : ''}${esc(at)} · ${esc(r.name)}<br>${r.minutes.total} min · ${porc(c.servings || r.servings)}</small></button>
        <div class="under rise" style="--i:3"><button class="link" data-act="recipe" data-id="${esc(r.id)}" data-date="${act.date}">ver la receta</button><button class="link" data-act="skip-cook" data-date="${act.date}">hoy no ${v === 'armar' ? 'armo' : 'cocino'}</button></div>`;
    }
    if (act.kind === 'eat') {
      const lab = OLLA.slotLabel(state, act.date, act.slot);
      return `<button class="strike rise" style="--i:2" data-act="ate" data-date="${act.date}" data-slot="${act.slot}">Comí <small>${esc(SLOT_ES[act.slot])}<br>${esc(lab)}</small></button>
        <div class="under rise" style="--i:3"><button class="link" data-act="log" data-date="${act.date}" data-slot="${act.slot}">otra cosa</button><button class="link" data-act="skip-meal" data-date="${act.date}" data-slot="${act.slot}">no comí</button></div>`;
    }
    if (act.kind === 'rescue') return rescueCard(t, n);
    if (act.kind === 'shop') {
      const sh = OLLA.shopping(state, t, n), trip = (sh.trips || []).find(x => x.date === act.date) || sh.next;
      if (!trip) return '';
      return `<button class="strike rise" style="--i:2" data-act="go" data-view="lista">${esc(state.settings.store.name || 'Safeway')} <small>${trip.left} ${trip.left === 1 ? 'cosa' : 'cosas'} · ${dayWord(trip.date)}${trip.at ? ' ' + esc(trip.at) : ''}<br>para ${esc(tripFor(trip))}</small></button>`;
    }
    if (act.kind === 'tomorrow') return tomorrowCard(OLLA.addDays(t, 1));
    return '';
  }
  const tripFor = trip => { const s = new Set(); (trip.items || []).forEach(i => (i.for || []).forEach(f => s.add(f))); return Array.from(s).slice(0, 2).join(' y ') || 'la semana'; };

  function tomorrowCard(d) {
    const day = state.plan.days[d]; if (!day) return '';
    const c = day.cook, r = c && rec(c.recipe);
    const din = OLLA.slotLabel(state, d, 'dinner');
    return `<div class="card speckle q-card rise" style="--i:2"><h3>Mañana</h3>
      <div class="meta">${r ? cap(verb(r)) + ' ' + esc(r.name) + ' a las ' + esc(c.at) + ' · ' : ''}cena: ${esc(din)}${day.train ? ' · gym' : ''}</div></div>`;
  }

  function rescueCard(t, n) {
    const opts = OLLA.rescue(state, t, n);
    const store = state.settings.store || {};
    const row = (o, i) => {
      let tt = '', m = '', act = '';
      if (o.kind === 'pot') { tt = 'De la olla: ' + esc(o.batch.name); m = porc(o.batch.left); act = `data-act="rescue-eat" data-of="${esc(o.batch.id)}"`; }
      else if (o.kind === 'freezer') { tt = 'Del congelador: ' + esc(o.batch.name); m = 'descongela en el micro'; act = `data-act="rescue-eat" data-of="${esc(o.batch.id)}"`; }
      else if (o.kind === 'home') { const r = rec(o.recipe); tt = esc(r ? r.name : 'algo de la nevera'); m = r ? r.minutes.total + ' min' : ''; act = `data-act="rescue-home" data-id="${esc(o.recipe || '')}"`; }
      else if (o.kind === 'store') { tt = esc(store.name || 'Safeway') + ' hasta las ' + esc(o.until || store.close || '22:00'); m = esc(o.pick || 'un pollo rostizado'); act = `data-act="rescue-store" data-what="${esc(o.pick || 'pollo rostizado')}"`; }
      else if (o.kind === 'order') { tt = 'Pedir: ' + esc(o.what); m = ''; act = `data-act="rescue-order" data-what="${esc(o.what)}"`; }
      return `<button class="rescue-item" ${act}><span class="n">${i + 1}</span><span class="t">${tt}</span><span class="m">${m}</span></button>`;
    };
    return `<div class="card speckle q-card rise" style="--i:2"><h3>Para cenar ahora</h3><div class="meta">Son las ${hmOf(n)} y la cena no está resuelta. En orden:</div>${opts.map(row).join('')}</div>`;
  }

  function questionCards(t, n, skipBatch) {
    return OLLA.questions(state, t, n).filter(q => q.batch !== skipBatch).map((q, i) => {
      const v = q.verb || verb(rec(q.recipe));
      const what = v === 'armar' ? '¿Armaste ' : '¿Se hizo ';
      return `<div class="card speckle q-card rise" style="--i:${2 + i}"><h3>${what}${esc(q.name)}?</h3>
        <div class="meta">${dayWord(q.date)} · era para la cena${v === 'armar' ? ' (comprar el pollo y porcionarlo cuenta)' : ''}</div>
        <div class="q-row"><button class="chip-btn go" data-act="q-yes" data-batch="${esc(q.batch)}" data-date="${q.date}">Sí</button>
        <button class="chip-btn" data-act="q-other" data-batch="${esc(q.batch)}" data-date="${q.date}">Otra cosa</button>
        <button class="chip-btn" data-act="q-no" data-batch="${esc(q.batch)}" data-date="${q.date}">No</button></div></div>`;
    }).join('');
  }

  function rowHtml(d, sl, n, i) {
    const day = state.plan.days[d], r = day && day[sl]; if (!r) return '';
    const t = T(), eat = OLLA.eatAt(state, d, sl), past = d < t || (d === t && eat <= n);
    const eff = OLLA.effLog(state, d, sl);
    let dish = OLLA.slotLabel(state, d, sl), sub = [];
    if (r.kind === 'swipe') sub.push('swipe · ' + hmOf(eat), '<span class="acc">+ leche o yogur con el swipe</span>');
    else if (r.kind === 'leftover') { sub.push('sobra · ' + hmOf(eat)); const b = r.of && OLLA.reality(state, t, n).byId[r.of]; const rm = b && OLLA.remateFor(state, b, d); if (rm) sub.push('<span class="acc">+ ' + esc(rm) + '</span>'); if (b && b.state === 'unconfirmed') sub.push('si se hizo'); }
    else if (r.kind === 'cook') { const c = day.cook, rr = c && rec(c.recipe); sub.push((rr ? verb(rr) : 'cocinar') + (c ? ' a las ' + c.at : '') + ' · se come ' + hmOf(eat)); }
    else if (r.kind === 'home') { const rr = r.recipe && rec(r.recipe); sub.push('de la nevera' + (rr ? ' · ' + rr.minutes.total + ' min' : '')); if (rr && rr.addon) sub.push('<span class="acc">' + esc(rr.addon) + '</span>'); }
    else if (r.kind === 'out') sub.push('fuera · ' + hmOf(eat));
    let ring = '', rcls = 'ring';
    if (eff && eff.s !== 'void') {
      if (eff.s === 'ate') { rcls += ' ate'; ring = CHECK; }
      else if (eff.s === 'skipped') { rcls += ' skipped'; ring = '×'; dish = dish; sub = ['no comiste']; }
      else { rcls += ' other'; ring = '↗'; sub = [(eff.s === 'out' ? 'fuera' : 'otra cosa') + (eff.left ? ' · sobró ' + eff.left : '')]; dish = eff.what || (eff.s === 'out' ? 'Fuera' : 'Otra cosa'); }
    }
    return `<div class="row${past ? ' past' : ''}${eff && eff.s !== 'void' ? ' done' : ''}">
      <div><div class="slot">${cap(SLOT_ES[sl])}</div><div class="dish">${esc(dish)}</div><div class="sub">${sub.join(' · ')}</div></div>
      <button class="${rcls}" data-act="log" data-date="${d}" data-slot="${sl}" aria-label="Anotar ${esc(SLOT_ES[sl])}">${ring}</button></div>`;
  }

  function bowlsHtml(t, n) {
    const out = [];
    for (let i = 0; i < 7; i++) {
      const d = OLLA.addDays(t, i), day = state.plan.days[d]; if (!day) continue;
      const k = day.dinner && day.dinner.kind;
      let fill = '';
      if (day.cook && k === 'cook') fill = '<path class="b-fill" d="M3 9 L43 9 Q41 27 23 27 Q5 27 3 9 Z"/>';
      else if (k === 'leftover') fill = '<path class="b-half" d="M6 18 L40 18 Q37 27 23 27 Q9 27 6 18 Z"/>';
      else if (k === 'home') fill = '<path class="b-home" d="M12 24 L34 24 Q30 27 23 27 Q16 27 12 24 Z"/>';
      const outline = k === 'out' ? '<path class="b-out" stroke-dasharray="3 3" d="M3 9 L43 9 Q41 27 23 27 Q5 27 3 9 Z"/>' : '<path class="b-out" d="M3 9 L43 9 Q41 27 23 27 Q5 27 3 9 Z"/>';
      const tag = day.cook ? hmShort(day.cook.at) : (day.train ? 'gym' : '');
      out.push(`<button class="bowl${d === t ? ' today' : ''}" data-act="go" data-view="semana" aria-label="${esc(fmtDate(d))}"><svg viewBox="0 0 46 30">${fill}${outline}</svg><span class="d">${DOW1[OLLA.dow(d)]} ${OLLA.parse(d).getDate()}</span><span class="tag">${esc(tag)}</span></button>`);
    }
    return out.join('');
  }
  function registerLine(t, n) {
    const ws = OLLA.weekStart(t), reg = OLLA.weekRegister(state, ws, t, n);
    const missed = [];
    for (let i = 0; i < 7; i++) { const d = OLLA.addDays(ws, i); if (d > t) break;
      OLLA.slotsFor(state, d).forEach(sl => { const e = OLLA.effLog(state, d, sl); if (e && e.s === 'skipped') missed.push(SLOT_ES[sl] + ' del ' + DOWS[OLLA.dow(d)]); }); }
    const seated = Object.keys(reg || {}).reduce((a, k) => a + ((reg[k] && reg[k].seated) || 0), 0);
    if (!seated) return '';
    if (!missed.length) return '<div class="register">Esta semana no se ha saltado ninguna comida.</div>';
    return `<div class="register">Esta semana se saltó: ${esc(missed.slice(0, 3).join(', '))}${missed.length > 3 ? '…' : ''}.</div>`;
  }
  function expiredCard(t, n) {
    return OLLA.expired(state, t, n).map(b => `<div class="card speckle q-card rise" style="--i:4"><h3>${esc(b.name)} ya pasó su día</h3>
      <div class="meta">${porc(b.left)} · hecho ${dayWord(b.date)}. La regla de la casa: 3–4 días en la nevera.</div>
      <div class="q-row" style="grid-template-columns:1fr 1fr"><button class="chip-btn go" data-act="toss" data-batch="${esc(b.id)}">Tirado</button><button class="chip-btn" data-act="toss-keep" data-batch="${esc(b.id)}">Ya no está</button></div></div>`).join('');
  }
  function gearCard() {
    if (state.settings.gearAsked) return '';
    const g = state.settings.gear || {};
    return `<div class="card speckle q-card rise" style="--i:5"><h3>¿Qué hay en tu cocina?</h3>
      <div class="meta">Una vez. Así el libro nunca te pide algo que no tienes.</div>
      <div class="seg" style="margin-top:10px">${Object.keys(GEAR_ES).map(k => `<button class="chip-btn${g[k] !== false ? ' on' : ''}" data-act="gear" data-k="${k}">${GEAR_ES[k]}</button>`).join('')}</div>
      <div class="field"><span>¿Cuántos tápers tienes?</span><div class="stepper"><button data-act="cont" data-d="-1" aria-label="menos">−</button><b>${state.settings.containers || 0}</b><button data-act="cont" data-d="1" aria-label="más">+</button></div></div>
      <button class="strike sm" data-act="gear-done">Listo</button></div>`;
  }

  function viewHoy() {
    const t = T(), n = N();
    if (!state.plan.days[t]) ensureWeek();
    const act = OLLA.nextAction(state, t, n);
    const qBatch = act && act.kind === 'confirm-cook' ? null : undefined;
    const slots = OLLA.slotsFor(state, t);
    return `<div class="date-line rise" style="--i:0">${esc(cap(fmtDate(t)))}</div>
      ${potPanel(t, n)}
      ${actionBlock(act, t, n)}
      ${questionCards(t, n, qBatch)}
      <div class="sec rise" style="--i:4">Hoy</div>
      <div class="card rows rise" style="--i:4">${slots.map((sl, i) => rowHtml(t, sl, n, i)).join('')}</div>
      ${expiredCard(t, n)}
      ${gearCard()}
      <div class="sec rise" style="--i:6">La semana <button class="link" style="font-size:15px" data-act="go" data-view="semana">ver</button></div>
      <div class="card rise" style="--i:6;padding:0"><div class="bowls">${bowlsHtml(t, n)}</div>${registerLine(t, n)}</div>`;
  }

  /* ═══════════════════════════════ SEMANA ═══════════════════════════════ */
  function viewSemana() {
    const t = T(), n = N(), days = Object.keys(state.plan.days).filter(d => d >= t).sort().slice(0, 7);
    const ws = OLLA.weekStart(t), used = OLLA.swipesUsed ? OLLA.swipesUsed(state.plan, ws) : null, budget = state.settings.hall.swipesPerWeek;
    const sh = OLLA.shopping(state, t, n), trips = {}; (sh.trips || []).forEach(x => { trips[x.date] = x; });
    const bad = OLLA.validateWeek(state, state.plan, t, n);
    return `<div class="page-title rise" style="--i:0">La semana</div>
      <div class="page-sub rise" style="--i:0">${used != null ? used + ' de ' + budget + ' swipes · ' : ''}${state.plan.via === 'coach' ? 'plan del coach' : 'la regla de la casa'} · toca una fila para cambiarla</div>
      ${bad.length ? `<div class="refusals"><h4>La semana no cuadra</h4>${bad.slice(0, 6).map(b => '<div>' + esc(b.date) + ' · ' + esc(b.msg) + '</div>').join('')}</div>` : ''}
      ${days.map((d, i) => dayCard(d, i, t, n, trips[d])).join('')}`;
  }
  function dayCard(d, i, t, n, trip) {
    const day = state.plan.days[d];
    const rows = OLLA.slotsFor(state, d).map(sl => {
      const r = day[sl]; if (!r) return '';
      const eff = OLLA.effLog(state, d, sl);
      let dish = OLLA.slotLabel(state, d, sl), small = '';
      if (eff && eff.s !== 'void') small = eff.s === 'ate' ? 'comido' : eff.s === 'skipped' ? 'no comiste' : 'comiste: ' + (eff.what || 'otra cosa');
      else if (r.kind === 'leftover') { const b = r.of && OLLA.reality(state, t, n).byId[r.of]; const rm = b && OLLA.remateFor(state, b, d); if (rm) small = '+ ' + rm; }
      else if (r.kind === 'swipe') small = '+ leche o yogur';
      const hand = r.hand ? `<button class="back-rule" data-act="rule" data-date="${d}" data-slot="${sl}">a mano · volver a la regla</button>` : '';
      return `<div class="srow${r.hand ? ' hand' : ''}"><span class="slot">${cap(SLOT_ES[sl])}</span>
        <div class="dish">${esc(dish)}${small ? `<small>${esc(small)}</small>` : ''}${hand}</div>
        <button class="kind k-${r.kind}" data-act="cycle" data-date="${d}" data-slot="${sl}">${KIND_ES[r.kind]}</button></div>`;
    }).join('');
    let cook = '';
    if (day.cook) { const r = rec(day.cook.recipe), st = OLLA.cookState(state, d, t, n);
      const stw = { made: ' · hecho', notmade: ' · no se hizo', unconfirmed: ' · ¿se hizo?' }[st] || '';
      cook = `<div class="crow"><span class="at">${esc(day.cook.at)}</span>
        <button class="dish" data-act="recipe" data-id="${esc(r ? r.id : '')}" data-date="${d}">${esc(cap(verb(r)))} ${esc(r ? r.name : day.cook.recipe)}<small>${r ? r.minutes.total + ' min · ' : ''}${porc(day.cook.servings)}${stw}</small></button>
        ${d >= t && st !== 'made' ? `<button class="swap" data-act="pick" data-date="${d}" aria-label="Otra receta">⇄</button>` : '<span></span>'}</div>`; }
    const shop = trip && trip.left ? `<div class="crow"><span class="at">${esc(trip.at || '')}</span><button class="dish" data-act="go" data-view="lista">${esc(state.settings.store.name || 'Safeway')}<small>${trip.left} cosas · para ${esc(tripFor(trip))}</small></button><span></span></div>` : '';
    const p = OLLA.parse(d);
    return `<section class="card speckle day rise" style="--i:${i + 1}"><div class="day-h"><h3>${cap(DOWS[p.getDay()])} ${p.getDate()}</h3>${d === t ? '<span class="today-w">hoy</span>' : ''}${day.train ? '<span class="tag-g">gym</span>' : ''}</div>
      ${rows}${cook}${shop}</section>`;
  }

  /* ═══════════════════════════════ LIBRO ═══════════════════════════════ */
  function viewLibro() {
    const t = T(), n = N(), rung = state.ladder.rung || 1, by = {};
    state.recipes.forEach(r => { (by[r.rung] = by[r.rung] || []).push(r); });
    const chk = OLLA.rungCheck ? OLLA.rungCheck(state, t) : { n: 0 };
    const roleOrder = { main: 0, side: 1, condiment: 2, bf: 3, snack: 4 };
    return `<div class="page-title rise" style="--i:0">El libro</div>
      <div class="lead rise" style="--i:0">Tres platos hasta aburrirte, luego uno más. Se sube de peldaño comiendo, no leyendo.</div>
      ${Object.keys(by).map(Number).sort((a, b) => a - b).map((k, i) => {
        const passed = (state.ladder.passed || []).some(p => p.rung === k) || k < rung;
        const fill = passed ? 1 : k === rung ? Math.min(1, (chk.n || 0) / 6) : 0;
        const list = by[k].slice().sort((a, b) => (roleOrder[a.role] || 0) - (roleOrder[b.role] || 0) || a.name.localeCompare(b.name));
        return `<section class="shelf rise${k > rung + 1 ? ' far' : ''}" style="--i:${i + 1}">
          <div class="shelf-h">${jarSvg(fill)}<h3>Peldaño ${k}</h3><span class="what">${esc(RUNG_ES[k] || '')}</span>${k === rung ? '<span class="here mono">vas aquí</span>' : ''}</div>
          <div class="card speckle" style="padding:4px 10px">${list.map(r => {
            const lk = state.likes && state.likes[r.id] && state.likes[r.id].v;
            const role = ROLE_ES[r.role] || '';
            return `<button class="rec" data-act="recipe" data-id="${esc(r.id)}"><span class="tile${r.cuisine === 'PE' ? ' pe' : ''}">${esc((r.name || '?').charAt(0))}</span>
              <span><span class="nm">${esc(r.name)}</span><span class="mt">${esc(verb(r))} · ${r.minutes.total} min · ${porc(r.servings)}${role ? ' · ' + role : ''}</span></span>
              <span class="lk${lk ? ' ' + lk : ''}">${lk ? LIKE_ES[lk] : ''}</span></button>`; }).join('')}</div></section>`; }).join('')}`;
  }

  /* ═══════════════════════════════ LISTA ═══════════════════════════════ */
  function viewLista() {
    const t = T(), n = N(), sh = OLLA.shopping(state, t, n), trips = (sh.trips || []).filter(x => (x.items || []).length);
    const store = state.settings.store || {};
    if (!trips.length) return `<div class="page-title rise">La lista</div><div class="empty rise" style="--i:1">${potSvg(0, { closed: true, cold: true, id: 9 }).replace('class="pot-svg', 'class="art pot-svg')}<h3>Nada que comprar</h3><p>La lista sale de la semana: cuando un día cocine, sus ingredientes aparecen aquí, en el orden del ${esc(store.name || 'Safeway')}.</p></div>`;
    return `<div class="page-title rise" style="--i:0">La lista</div>
      <div class="page-sub rise" style="--i:0">${esc(store.name || 'Safeway')} · ${store.mode === 'delivery' ? 'a domicilio' : 'a pie'} · abre ${esc(store.open || '06:00')}–${esc(store.close || '22:00')}</div>
      ${trips.map((trip, i) => {
        const groups = {}; trip.items.forEach(it => { (groups[it.section || 'sin sección'] = groups[it.section || 'sin sección'] || []).push(it); });
        return `<section class="card speckle rise" style="--i:${i + 1}"><div class="trip-h"><div><h3>${cap(dayWord(trip.date))}${trip.at ? ' · ' + esc(trip.at) : ''}</h3>
          <div class="meta">${trip.left ? trip.left + ' por comprar' : 'todo comprado'} · para ${esc(tripFor(trip))}${trip.by && trip.by !== trip.date ? ' · antes del ' + dayShort(trip.by) : ''}</div></div>
          <button class="icon-btn" data-act="share" data-date="${trip.date}" aria-label="Compartir la lista">${SHARE}</button></div>
          ${Object.keys(groups).map(sec => `<div class="aisle">${esc(sec)}</div>${groups[sec].map(it => `<button class="item${it.checked ? ' on' : ''}" data-act="check" data-key="${esc(it.key)}" data-v="${it.checked ? 0 : 1}">
            <span class="box">${CHECK}</span><span><span class="nm">${esc(it.n)}</span><span class="fr">${esc((it.for || []).join(', '))}${it.buyBy && it.buyBy === trip.date && trip.date !== trip.by ? '' : ''}${it.buyBy === trip.date ? ' · <span class="soon">compra el mismo día</span>' : ''}</span></span>
            <span class="q mono">${esc(it.display || '')}</span></button>`).join('')}`).join('')}</section>`; }).join('')}`;
  }

  /* ═══════════════════════════════ RENDER ═══════════════════════════════ */
  function render() {
    applyOllaTheme();
    const root = document.getElementById('app-root'); if (!root) return;
    if (view !== 'hoy') setSteam(0.25);
    root.innerHTML = view === 'semana' ? viewSemana() : view === 'libro' ? viewLibro() : view === 'lista' ? viewLista() : viewHoy();
    document.querySelectorAll('#bottom-tabs .tab[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    const cv = document.getElementById('current-view'); if (cv) cv.textContent = { hoy: 'Hoy', semana: 'La semana', libro: 'El libro', lista: 'La lista' }[view];
  }
  function go(v) { view = v === 'olla' ? 'hoy' : v; render(); window.scrollTo(0, 0); }
  function done(msg, withLid) { ensureWeek(); saveTap(); if (withLid) lid = true; closeSheet(); render(); if (msg) toast(msg); }

  /* ═══════════════════════════════ SHEETS ═══════════════════════════════ */
  function openSheet(html, ctx) {
    sheetCtx = ctx || null;
    const dlg = document.getElementById('olla-sheet');
    document.getElementById('olla-sheet-body').innerHTML = html;
    if (!dlg.open) dlg.showModal();
  }
  function closeSheet() { const dlg = document.getElementById('olla-sheet'); if (dlg && dlg.open) dlg.close(); sheetCtx = null; }

  function stepper(name, v, min, max) { return `<div class="stepper" data-stepper="${name}" data-min="${min}" data-max="${max}"><button data-act="step" data-d="-1" aria-label="menos">−</button><b data-val>${v}</b><button data-act="step" data-d="1" aria-label="más">+</button></div>`; }
  const stepVal = name => { const el = document.querySelector(`[data-stepper="${name}"] [data-val]`); return el ? parseInt(el.textContent, 10) || 0 : 0; };

  function openRecipe(id, ctx) {
    const r = rec(id); if (!r) return;
    ctx = ctx || {};
    const day = ctx.date && state.plan.days[ctx.date];
    const sv = ctx.servings || (day && day.cook && day.cook.recipe === id ? day.cook.servings : r.servings);
    sheetCtx = { kind: 'recipe', id, date: ctx.date || null, servings: sv };
    openSheet(recipeHtml(r, sv), sheetCtx);
  }
  function recipeHtml(r, sv) {
    const ings = OLLA.scaleIngredients(state, r, sv);
    const dbl = r.doubles === true ? 'se dobla' : r.doubles === 'two-rounds' ? 'para más, en dos rondas' : 'no se dobla';
    const lk = state.likes && state.likes[r.id] && state.likes[r.id].v;
    const missing = (r.gear || []).filter(k => (state.settings.gear || {})[k] === false);
    return `<h2>${esc(r.name)}</h2>
      <div class="rx-meta">peldaño ${r.rung} · ${esc(verb(r))} · ${r.minutes.active} min activos, ${r.minutes.total} en total · ${dbl} · nevera ${r.fridgeDays} días${r.freezesMonths ? ' · se congela' : ''}${r.proteinG ? ' · ~' + r.proteinG + ' g de proteína por porción (estimado)' : ''}</div>
      ${missing.length ? `<div class="refusals" style="margin:0 0 8px">Necesita ${esc(missing.map(k => GEAR_ES[k] || k).join(', '))}, que marcaste que no tienes.</div>` : ''}
      <div class="rx-h">Ingredientes ${stepper('rx', sv, 1, 12)}</div>
      <ul class="ings">${ings.map(g => `<li><span class="q">${esc(g.display)}</span><span>${esc(g.n)}</span></li>`).join('')}</ul>
      <div class="rx-h">Pasos</div>
      <ol class="steps">${(r.steps || []).map(s => { const tm = OLLA.stepTimer(s); return `<li><span>${esc(typeof s === 'string' ? s : s.t)}${tm ? `<span class="t-chip">${tm} min</span>` : ''}</span></li>`; }).join('')}</ol>
      ${(r.remates && r.remates.length) || r.addon || r.reheat ? `<div class="rx-h">Para que no aburra</div><div class="notes">${(r.remates || []).length ? `<p>Encima, un día cada uno: ${esc(r.remates.join(' · '))}.</p>` : ''}${r.addon ? `<p>${esc(r.addon)}.</p>` : ''}${r.reheat ? `<p>Recalentar: ${esc(r.reheat)}.</p>` : ''}</div>` : ''}
      ${(r.sources || []).length ? `<div class="notes" style="margin-top:8px">${r.sources.map(u => `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(String(u).replace(/^https?:\/\/(www\.)?/, '').slice(0, 48))}</a>`).join(' · ')}</div>` : ''}
      <div class="rx-h">¿Otra vez?</div>
      <div class="seg">${['again', 'meh', 'never'].map(v => `<button class="chip-btn${lk === v ? ' on' : ''}" data-act="like" data-id="${esc(r.id)}" data-v="${v}">${LIKE_ES[v]}</button>`).join('')}</div>
      <button class="strike" data-act="runner-start" data-id="${esc(r.id)}">${cap(verb(r))} ahora <small>paso a paso · con temporizadores</small></button>`;
  }

  function openLog(d, sl, preset) {
    const r = state.plan.days[d] && state.plan.days[d][sl];
    const eff = OLLA.effLog(state, d, sl);
    const lab = OLLA.slotLabel(state, d, sl);
    const p = preset || {};
    sheetCtx = { kind: 'log', date: d, slot: sl, mode: p.mode || null };
    const sug = ['pollo rostizado'].concat(state.settings.orders || []).concat(state.recipes.filter(x => x.role === 'main').slice(0, 6).map(x => x.name));
    openSheet(`<h2>${cap(slotOf(sl, d))}</h2>
      <div class="rx-meta">el plan: ${esc(lab)}${r ? ' · ' + KIND_ES[r.kind] : ''}</div>
      ${eff && eff.s !== 'void' ? `<div class="notes"><p>Anotado: ${eff.s === 'ate' ? 'lo del plan' : eff.s === 'skipped' ? 'no comiste' : esc(eff.what || 'otra cosa') + (eff.left ? ', sobró ' + eff.left : '')}.</p></div><div class="under" style="justify-content:flex-start"><button class="link danger" data-act="log-void">Deshacer</button></div>` : ''}
      <button class="strike" data-act="log-ate">Sí, lo del plan <small>${esc(lab)}</small></button>
      <div class="rx-h">Otra cosa</div>
      <div class="seg" data-seg="mode">${[['bought', 'Compré'], ['out', 'Pedí · fuera'], ['cooked', 'Cociné otra cosa']].map(m => `<button class="chip-btn${p.mode === m[0] ? ' on' : ''}" data-act="mode" data-v="${m[0]}">${m[1]}</button>`).join('')}</div>
      <label class="field"><span>¿Qué?</span><input type="text" id="log-what" list="log-sug" value="${esc(p.what || '')}" autocomplete="off" placeholder="pollo rostizado, tallarines…"><datalist id="log-sug">${sug.map(s => `<option value="${esc(s)}">`).join('')}</datalist></label>
      <div class="field" data-left-field${p.mode === 'out' ? ' hidden' : ''}><span>¿Sobró algo para otro día?</span>${stepper('left', p.left || 0, 0, 8)}</div>
      <button class="strike ghost sm" data-act="log-other">Guardar</button>
      <div class="under"><button class="link" data-act="log-skip">No comí</button></div>`, sheetCtx);
  }

  function openCookQ(batch, d, mode) {
    const b = OLLA.reality(state, T(), N()).byId[batch];
    const c = state.plan.days[d] && state.plan.days[d].cook, r = rec((c && c.recipe) || (b && b.recipe));
    const sv = (c && c.servings) || (r && r.servings) || 2;
    sheetCtx = { kind: 'cookq', batch, date: d, recipe: r && r.id };
    if (mode === 'yes') openSheet(`<h2>${esc(r ? r.name : 'La olla')}</h2><div class="rx-meta">¿Cuántos tápers salieron? Así la olla sabe lo que hay.</div>
      <div class="field">${stepper('yield', sv, 1, 12)}</div><button class="strike" data-act="cookq-save">A la olla</button>`, sheetCtx);
    else openLog(d, 'dinner', { mode: 'bought', what: r && r.assembly ? 'pollo rostizado' : '', left: 0, fromCook: batch });
    if (mode !== 'yes') sheetCtx.fromCook = batch;
  }

  function openPicker(d) {
    const day = state.plan.days[d]; if (!day || !day.cook) return;
    const list = state.recipes.filter(r => r.role === 'main' && OLLA.eligible(state, r)).sort((a, b) => a.rung - b.rung || a.name.localeCompare(b.name));
    sheetCtx = { kind: 'pick', date: d };
    openSheet(`<h2>¿Qué se ${verb(rec(day.cook.recipe)) === 'armar' ? 'arma' : 'cocina'} ${esc(dayWord(d))}?</h2><div class="rx-meta">hasta el peldaño ${(state.ladder.rung || 1) + 1}, con lo que tienes en la cocina</div>
      <div class="card" style="padding:4px 10px;margin-top:8px">${list.map(r => `<button class="rec" data-act="choose" data-id="${esc(r.id)}"><span class="tile${r.cuisine === 'PE' ? ' pe' : ''}">${esc(r.name.charAt(0))}</span><span><span class="nm">${esc(r.name)}${day.cook.recipe === r.id ? ' ·' : ''}</span><span class="mt">${esc(verb(r))} · ${r.minutes.total} min · rinde ${OLLA.maxServings(r)}</span></span><span></span></button>`).join('')}</div>`, sheetCtx);
  }

  function openPot() {
    const t = T(), n = N();
    const pot = OLLA.potNow(state, t, n).filter(b => b.left > 0 && !b.frozen);
    const fz = OLLA.reality(state, t, n).batches.filter(b => b.frozen && b.left > 0);
    sheetCtx = { kind: 'pot' };
    const line = b => { const r = b.recipe && rec(b.recipe); const canFreeze = !b.frozen && r && r.freezesMonths && b.left >= 1;
      return `<div class="card speckle" style="margin-top:10px"><div class="pot-name" style="margin:0">${esc(b.name)}</div>
        <div class="pot-meta">${porc(b.left)} · ${b.frozen ? 'congelado ' + dayWord(b.date) : 'hasta ' + dayWord(b.expires)}</div>
        <div class="q-row" style="grid-template-columns:${canFreeze ? '1fr 1fr 1fr' : '1fr 1fr'}">
          <button class="chip-btn go" data-act="pot-eat" data-of="${esc(b.id)}">Comer una</button>
          ${canFreeze ? `<button class="chip-btn" data-act="pot-freeze" data-of="${esc(b.id)}" data-n="${Math.min(2, b.left)}">Congelar ${Math.min(2, b.left)}</button>` : ''}
          <button class="chip-btn" data-act="toss" data-batch="${esc(b.id)}">Tirar</button></div></div>`; };
    openSheet(`<h2>En la olla</h2><div class="rx-meta">Lo que hay de verdad: lo que se cocinó o se compró, menos lo que ya se comió.</div>
      ${pot.length ? pot.map(line).join('') : '<div class="notes"><p>Nada en la nevera.</p></div>'}
      ${fz.length ? '<div class="rx-h">El congelador</div>' + fz.map(line).join('') : ''}
      <div class="rx-h">¿Compraste algo que rinde?</div>
      <button class="strike ghost sm" data-act="pot-bought">Compré algo · pollo rostizado, etc.</button>`, sheetCtx);
  }

  /* ═══════════════════════════════ THE COOK-ALONG ═══════════════════════════════ */
  function openRunner(o) {
    const r = rec(o.recipe); if (!r) return;
    closeSheet();
    if (!state.cookSession || state.cookSession.recipe !== r.id) {
      state.cookSession = { date: o.date || T(), batch: o.batch || null, recipe: r.id, servings: o.servings || r.servings, step: -1, timers: [], got: {}, startedAt: Date.now() };
      saveQuiet();
    }
    const el = document.getElementById('runner'); el.hidden = false; document.body.style.overflow = 'hidden';
    acquireWake(); renderRunner();
    clearInterval(runnerTimer); runnerTimer = setInterval(tickRunner, 250);
  }
  function closeRunner(keep) {
    const el = document.getElementById('runner'); el.hidden = true; el.innerHTML = ''; document.body.style.overflow = '';
    clearInterval(runnerTimer); runnerTimer = null; releaseWake();
    if (!keep) { state.cookSession = null; saveQuiet(); }
    render();
  }
  function stepsOf(r) { return (r.steps || []).map(s => typeof s === 'string' ? { t: s } : s); }
  function renderRunner() {
    const s = state.cookSession; if (!s) return closeRunner(true);
    const r = rec(s.recipe), steps = stepsOf(r), total = steps.length, i = s.step;
    const ings = OLLA.scaleIngredients(state, r, s.servings);
    const el = document.getElementById('runner');
    const ingots = [-1].concat(steps.map((_, k) => k)).concat([total]).map(k => `<i class="${k < i ? 'done' : k === i ? 'now' : ''}"></i>`).join('');
    let body = '', next = 'Siguiente', back = i > -1;
    if (i === -1) {
      body = `<div class="r-step-n">Antes de empezar</div><div class="r-done-h">${esc(r.name)}</div>
        <div class="rx-meta" style="margin-top:10px">${r.minutes.active} min activos · ${r.minutes.total} en total${(r.gear || []).length ? ' · ' + esc(r.gear.map(k => GEAR_ES[k] || k).join(', ')) : ''}</div>
        <div class="field"><span>¿Para cuántas porciones?</span>${stepper('rsv', s.servings, 1, 12)}</div>
        <div class="rx-h">Saca esto · toca lo que ya tienes en la mesa</div>
        <ul class="r-ings">${ings.map((g, k) => `<li class="${s.got[k] ? 'got' : ''}" data-act="got" data-k="${k}"><span class="q">${esc(g.display)}</span><span>${esc(g.n)}</span></li>`).join('')}</ul>`;
      next = 'Empezar';
    } else if (i < total) {
      const st = steps[i], tm = OLLA.stepTimer(st), tmr = (s.timers || []).find(x => x.step === i && !x.done);
      const sub = (st.ing || []).map(k => ings[k]).filter(Boolean);
      body = `<div class="r-step-n">Paso ${i + 1} de ${total}</div><div class="r-text">${esc(st.t)}</div>
        ${sub.length ? `<ul class="r-ings">${sub.map(g => `<li><span class="q">${esc(g.display)}</span><span>${esc(g.n)}</span></li>`).join('')}</ul>` : ''}
        ${tmr ? `<div class="r-big" data-tbig="${tmr.id}">--:--</div><div class="r-cap">${esc(tmr.label)}</div>`
              : tm ? `<button class="strike ghost" data-act="timer" data-min="${tm}">Temporizador <small>${tm} min</small></button>` : ''}`;
      if (i === total - 1) next = 'Terminar';
    } else {
      body = `<div class="r-step-n">Listo</div><div class="r-done-h">¿Cuántos tápers salieron?</div>
        <div class="rx-meta" style="margin-top:10px">Así la olla sabe lo que hay de verdad. ${r.fridgeDays ? 'Aguanta ' + r.fridgeDays + ' días en la nevera.' : ''}${r.freezesMonths ? ' Lo que no vayas a comer en 3 días, al congelador.' : ''}</div>
        <div class="field">${stepper('ryield', s.servings, 1, 12)}</div>
        ${r.reheat ? `<div class="notes"><p>Para recalentar: ${esc(r.reheat)}.</p></div>` : ''}`;
      next = 'A la olla';
    }
    el.innerHTML = `<div class="r-head"><button class="icon-btn" data-act="runner-close" aria-label="Salir">×</button><span class="ttl">${esc(r.name)}</span><button class="link" style="font-size:15px" data-act="runner-recipe" data-id="${esc(r.id)}">receta</button></div>
      <div class="ingots">${ingots}</div>
      <div class="timers" data-timers></div>
      <div class="r-body">${body}</div>
      <div class="r-nav">${back ? '<button class="back" data-act="r-back">Atrás</button>' : '<span></span>'}<button class="strike" data-act="r-next">${next}</button></div>`;
    tickRunner();
  }
  function fmtLeft(ms) { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function tickRunner() {
    const s = state.cookSession, el = document.getElementById('runner'); if (!s || !el || el.hidden) return;
    const now = Date.now(), box = el.querySelector('[data-timers]');
    let fired = false;
    (s.timers || []).forEach(x => { if (!x.done && !x.rang && now >= x.endsAt) { x.rang = true; fired = true; } });
    if (box) box.innerHTML = (s.timers || []).filter(x => !x.done).map(x => `<button class="timer-chip${now >= x.endsAt ? ' ring-now' : ''}" data-act="timer-done" data-id="${x.id}">${esc(x.label)} · ${now >= x.endsAt ? '¡ya!' : fmtLeft(x.endsAt - now)}</button>`).join('');
    el.querySelectorAll('[data-tbig]').forEach(b => { const x = (s.timers || []).find(y => String(y.id) === b.dataset.tbig); if (!x) return;
      const left = x.endsAt - now; b.textContent = left > 0 ? fmtLeft(left) : '¡Ya!'; b.classList.toggle('over', left <= 0);
      b.style.setProperty('--t-left', String(Math.max(0, Math.min(1, left / (x.ms || 1))))); });
    if (fired) { beep(); saveQuiet(); toast('¡Temporizador!'); }
  }
  function addTimer(min) {
    const s = state.cookSession, r = rec(s.recipe), st = stepsOf(r)[s.step] || {};
    const label = (st.t || '').split(/[,.;:]/)[0].slice(0, 28) || 'paso ' + (s.step + 1);
    s.timers = (s.timers || []).concat([{ id: Date.now(), step: s.step, label, ms: min * 60000, endsAt: Date.now() + min * 60000 }]);
    saveQuiet(); unlockAudio(); renderRunner();
  }
  function finishRunner() {
    const s = state.cookSession, r = rec(s.recipe), y = stepVal('ryield') || s.servings, t = T(), n = N(), at = Date.now();
    let res;
    if (s.batch) res = OLLA.logCook(state, s.batch, { s: 'made', recipe: r.id, yield: y }, t, n, at);
    else res = OLLA.logMeal(state, s.date && s.date <= t ? s.date : t, 'dinner', { s: 'other', what: r.name, recipe: r.id, left: Math.max(0, y - 1) }, t, n, at);
    if (res && res.ok === false) { toast(res.why || 'no se pudo anotar', true); return; }
    state.cookSession = null;
    closeRunner(true); view = 'hoy'; done('A la olla: ' + porc(y) + '.', true);
  }
  async function acquireWake() { try { if ('wakeLock' in navigator && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener && wake.addEventListener('release', () => { wake = null; }); } } catch (e) { wake = null; } }
  function releaseWake() { try { wake && wake.release(); } catch (e) {} wake = null; }
  function unlockAudio() { try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) { actx = null; } }
  function beep() {
    try { if (!actx) return; const t0 = actx.currentTime;
      for (let k = 0; k < 3; k++) { const o = actx.createOscillator(), g = actx.createGain(); o.type = 'sine'; o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, t0 + k * 0.32); g.gain.exponentialRampToValueAtTime(0.35, t0 + k * 0.32 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + k * 0.32 + 0.22);
        o.connect(g); g.connect(actx.destination); o.start(t0 + k * 0.32); o.stop(t0 + k * 0.32 + 0.25); } } catch (e) {}
  }

  /* ═══════════════════════════════ SETTINGS: LA COCINA ═══════════════════════════════ */
  function allIngredientIds() { const s = new Set(); state.recipes.forEach(r => (r.ingredients || []).forEach(g => g.id && s.add(g.id))); (state.settings.pantry || []).forEach(x => s.add(x)); (state.settings.weekly || []).forEach(x => s.add(x)); return Array.from(s); }
  function ingName(id) { const g = OLLA.ingredient(id); return g ? g.n : id; }
  function renderKitchenSettings() {
    const S = state.settings, el = document.getElementById('kitchen-settings'); if (!el) return;
    const dows = (name, arr) => `<div class="k-grid">${DOWS3.map((d, i) => `<button type="button" class="chip-btn${(arr || []).indexOf(i) >= 0 ? ' on' : ''}" data-kact="dow" data-k="${name}" data-i="${i}">${d}</button>`).join('')}</div>`;
    const ids = allIngredientIds().filter(id => { const g = OLLA.ingredient(id); return g && (g.pantry || g.section === 'Especias y aceites'); }).sort((a, b) => ingName(a).localeCompare(ingName(b)));
    const weeklyIds = ['leche', 'yogur-griego', 'mantequilla-mani', 'huevos', 'platanos', 'pan-integral', 'avena'].filter(id => OLLA.ingredient(id));
    el.innerHTML = `
      <div class="field"><span>Swipes por semana · minutos a pie al comedor</span><div style="display:flex;gap:10px">${stepper('k-swipes', S.hall.swipesPerWeek, 0, 30)}${stepper('k-walk', S.hall.walkMin, 0, 60)}</div></div>
      <div class="field"><span>Días con swipe (desayuno y almuerzo — la cena, nunca)</span>${dows('hall', S.hall.days)}</div>
      <div class="field"><span>El desayuno también es swipe</span><div class="seg"><button type="button" class="chip-btn${S.hall.breakfastSwipe ? ' on' : ''}" data-kact="bfswipe" data-v="1">sí</button><button type="button" class="chip-btn${!S.hall.breakfastSwipe ? ' on' : ''}" data-kact="bfswipe" data-v="0">no</button></div></div>
      <div class="field"><span>Días que almuerzas fuera (campus principal)</span>${dows('out', S.outDays)}</div>
      <div class="field"><span>Días de gym (la cuarta comida, después)</span>${dows('train', S.trainDays)}</div>
      <div class="field"><span>Ventanas para cocinar · y a qué hora prefieres empezar (vacío = al abrir la ventana)</span><div class="wins">${DOWS3.map((d, i) => `<div class="win"><span class="d">${d}</span><input type="text" inputmode="numeric" data-kact="win" data-i="${i}" value="${esc((S.cookWindows[String(i)] || []).join(', '))}" placeholder="—"><input type="text" inputmode="numeric" data-kact="cookat" data-i="${i}" value="${esc((S.cookAt || {})[String(i)] || '')}" placeholder="empezar"></div>`).join('')}</div></div>
      <div class="field"><span>Horas de comer · desayuno, almuerzo, cena, después del gym</span><div class="wins"><div class="win" style="grid-template-columns:1fr 1fr 1fr 1fr">${['bf', 'lunch', 'dinner', 'post'].map(k => `<input type="text" inputmode="numeric" data-kact="eat" data-k="${k}" value="${esc((S.eatAt || {})[k] || '')}" aria-label="${SLOT_ES[k]}">`).join('')}</div></div></div>
      <div class="field"><span>Lo que hay en la cocina</span><div class="seg">${Object.keys(GEAR_ES).map(k => `<button type="button" class="chip-btn${S.gear[k] !== false ? ' on' : ''}" data-kact="gear" data-k="${k}">${GEAR_ES[k]}</button>`).join('')}</div></div>
      <div class="field"><span>Tápers</span>${stepper('k-cont', S.containers || 0, 0, 40)}</div>
      <div class="field"><span>El súper · nombre · cierra · minutos dentro de la tienda (estimado)</span><div class="win" style="grid-template-columns:2fr 1fr 1fr"><input type="text" data-kact="store" data-k="name" value="${esc(S.store.name || '')}"><input type="text" data-kact="store" data-k="close" value="${esc(S.store.close || '')}"><input type="text" inputmode="numeric" data-kact="store" data-k="inStoreMin" value="${esc(S.store.inStoreMin || '')}"></div>
        <div class="seg" style="margin-top:8px"><button type="button" class="chip-btn${S.store.mode !== 'delivery' ? ' on' : ''}" data-kact="mode" data-v="walk">voy a pie</button><button type="button" class="chip-btn${S.store.mode === 'delivery' ? ' on' : ''}" data-kact="mode" data-v="delivery">a domicilio</button></div></div>
      <div class="field"><span>Lo que pides cuando pides (uno por línea)</span><textarea data-kact="orders" rows="3">${esc((S.orders || []).join('\n'))}</textarea></div>
      <div class="field"><span>Siempre en casa — nunca va a la lista</span><div class="seg">${ids.map(id => `<button type="button" class="chip-btn${(S.pantry || []).indexOf(id) >= 0 ? ' on' : ''}" data-kact="pantry" data-k="${esc(id)}" style="font-size:15px">${esc(ingName(id))}</button>`).join('')}</div></div>
      <div class="field"><span>Siempre en la lista</span><div class="seg">${weeklyIds.map(id => `<button type="button" class="chip-btn${(S.weekly || []).indexOf(id) >= 0 ? ' on' : ''}" data-kact="weekly" data-k="${esc(id)}" style="font-size:15px">${esc(ingName(id))}</button>`).join('')}</div></div>`;
  }
  function onKitchen(e) {
    const el = e.target.closest('[data-kact]'); if (!el) return;
    const S = state.settings, k = el.dataset.kact;
    const toggleIn = (arr, v) => { const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); arr.sort((a, b) => a - b); };
    if (e.type === 'click') {
      if (k === 'dow') { const i = +el.dataset.i, which = el.dataset.k; if (which === 'hall') toggleIn(S.hall.days, i); else if (which === 'out') toggleIn(S.outDays, i); else toggleIn(S.trainDays, i); }
      else if (k === 'bfswipe') S.hall.breakfastSwipe = el.dataset.v === '1';
      else if (k === 'gear') S.gear[el.dataset.k] = S.gear[el.dataset.k] === false;
      else if (k === 'mode') S.store.mode = el.dataset.v;
      else if (k === 'pantry' || k === 'weekly') { const arr = S[k] = S[k] || []; const i = arr.indexOf(el.dataset.k); if (i >= 0) arr.splice(i, 1); else arr.push(el.dataset.k); }
      else return;
    } else if (e.type === 'change') {
      const v = el.value.trim();
      if (k === 'win') { const list = v ? v.split(',').map(x => x.trim()).filter(Boolean) : []; if (!list.every(w => /^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}$/.test(w))) { toast('formato: 13:00-17:30', true); return; } S.cookWindows[el.dataset.i] = list.map(w => w.replace(/\s+/g, '')); }
      else if (k === 'cookat') { S.cookAt = S.cookAt || {}; if (!v) delete S.cookAt[el.dataset.i]; else if (OLLA.hm(v) == null) { toast('formato: 15:30', true); return; } else S.cookAt[el.dataset.i] = v; }
      else if (k === 'eat') { if (OLLA.hm(v) == null) { toast('formato: 19:00', true); return; } S.eatAt = S.eatAt || {}; S.eatAt[el.dataset.k] = v; }
      else if (k === 'store') { const kk = el.dataset.k; if (kk === 'inStoreMin') { const n = parseInt(v, 10); if (!(n >= 5 && n <= 120)) { toast('entre 5 y 120 minutos', true); return; } S.store.inStoreMin = n; } else if (kk === 'close') { if (OLLA.hm(v) == null) { toast('formato: 22:00', true); return; } S.store.close = v; } else S.store.name = v || 'Safeway'; }
      else if (k === 'orders') S.orders = v.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 8);
      else return;
    } else return;
    ensureWeek(); saveTap(); renderKitchenSettings();
  }
  function onKitchenStep(name, v) {
    const S = state.settings;
    if (name === 'k-swipes') S.hall.swipesPerWeek = v; else if (name === 'k-walk') S.hall.walkMin = v; else if (name === 'k-cont') S.containers = v; else return false;
    ensureWeek(); saveTap(); return true;
  }

  /* ═══════════════════════════════ EVENTS ═══════════════════════════════ */
  function onClick(e) {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act, t = T(), n = N(), at = Date.now(), d = b.dataset.date, sl = b.dataset.slot;
    const res = x => { if (x && x.ok === false) { toast(x.why || 'no se pudo', true); return false; } return true; };
    switch (a) {
      case 'go': go(b.dataset.view); return;
      case 'pot': openPot(); return;
      case 'recipe': if (b.dataset.id) openRecipe(b.dataset.id, { date: d }); return;
      case 'cook': { const c = state.plan.days[d] && state.plan.days[d].cook; if (c) openRunner({ date: d, batch: c.batch, recipe: c.recipe, servings: c.servings }); return; }
      case 'skip-cook': if (res(OLLA.setKind(state, d, 'dinner', 'home', t, n))) done('Hoy no. La semana se reacomoda.'); return;
      case 'ate': if (res(OLLA.logMeal(state, d, sl, { s: 'ate' }, t, n, at))) done('', true); return;
      case 'skip-meal': if (res(OLLA.logMeal(state, d, sl, { s: 'skipped' }, t, n, at))) done('Anotado.'); return;
      case 'log': openLog(d, sl); return;
      case 'q-yes': openCookQ(b.dataset.batch, d, 'yes'); return;
      case 'q-other': openCookQ(b.dataset.batch, d, 'other'); return;
      case 'q-no': if (res(OLLA.logCook(state, b.dataset.batch, { s: 'notmade' }, t, n, at))) done('Anotado. La semana se reacomoda.'); return;
      case 'cookq-save': { const c = sheetCtx; if (res(OLLA.logCook(state, c.batch, { s: 'made', recipe: c.recipe, yield: stepVal('yield') }, t, n, at))) done('A la olla.', true); return; }
      case 'rescue-eat': if (res(OLLA.logMeal(state, t, 'dinner', { s: 'ate', of: b.dataset.of }, t, n, at))) done('', true); return;
      case 'rescue-home': { const r = rec(b.dataset.id); if (r && res(OLLA.logMeal(state, t, 'dinner', { s: 'other', what: r.name, recipe: r.id }, t, n, at))) { done('Anotado: ' + r.name + '.', true); openRecipe(r.id); } return; }
      case 'rescue-store': toast('Cuando vuelvas: «compré», y cuántas porciones sobraron.'); openLog(t, 'dinner', { mode: 'bought', what: b.dataset.what }); return;
      case 'rescue-order': if (res(OLLA.logMeal(state, t, 'dinner', { s: 'out', what: b.dataset.what }, t, n, at))) done('Anotado: ' + b.dataset.what + '.'); return;
      case 'toss': if (res(OLLA.logCook(state, b.dataset.batch, { s: 'tossed' }, t, n, at))) done('Fuera.'); return;
      case 'toss-keep': if (res(OLLA.logCook(state, b.dataset.batch, { s: 'tossed' }, t, n, at))) done(''); return;
      case 'pot-eat': if (res(OLLA.logMeal(state, t, slotNow(n), { s: 'ate', of: b.dataset.of }, t, n, at))) done('', true); return;
      case 'pot-freeze': if (res(OLLA.freeze(state, b.dataset.of, +b.dataset.n, t, n, at))) done('Al congelador.'); return;
      case 'pot-bought': openLog(t, slotNow(n), { mode: 'bought', what: 'pollo rostizado', left: 3 }); return;
      case 'gear': { const g = state.settings.gear; g[b.dataset.k] = g[b.dataset.k] === false; saveTap(); render(); return; }
      case 'cont': state.settings.containers = Math.max(0, (state.settings.containers || 0) + (+b.dataset.d)); saveTap(); render(); return;
      case 'gear-done': state.settings.gearAsked = true; done('Anotado.'); return;
      case 'cycle': { if (d < t) { toast('Ese día ya pasó.'); return; } const k = OLLA.nextKind(state, d, sl, t, n); if (k && res(OLLA.setKind(state, d, sl, k, t, n))) { saveTap(); render(); } return; }
      case 'rule': OLLA.backToRule(state, d, sl, t, n); ensureWeek(); saveTap(); render(); return;
      case 'pick': openPicker(d); return;
      case 'choose': if (res(OLLA.setCookRecipe(state, sheetCtx.date, b.dataset.id, t, n))) done('Cambiado.'); return;
      case 'check': OLLA.check(state, b.dataset.key, b.dataset.v === '1', at); saveTap(); render(); return;
      case 'share': shareTrip(d); return;
      case 'like': OLLA.like(state, b.dataset.id, b.dataset.v, at); saveTap(); openRecipe(b.dataset.id, sheetCtx || {}); render(); return;
      case 'step': { const box = b.closest('[data-stepper]'), val = box.querySelector('[data-val]'), name = box.dataset.stepper;
        const v = Math.max(+box.dataset.min, Math.min(+box.dataset.max, (parseInt(val.textContent, 10) || 0) + (+b.dataset.d)));
        val.textContent = v;
        if (name === 'rx' && sheetCtx && sheetCtx.kind === 'recipe') { sheetCtx.servings = v; const r = rec(sheetCtx.id); const ul = document.querySelector('#olla-sheet .ings'); if (ul) ul.innerHTML = OLLA.scaleIngredients(state, r, v).map(g => `<li><span class="q">${esc(g.display)}</span><span>${esc(g.n)}</span></li>`).join(''); }
        if (name === 'rsv' && state.cookSession) { state.cookSession.servings = v; saveQuiet(); renderRunner(); }
        if (onKitchenStep(name, v)) { /* saved */ }
        return; }
      case 'mode': { const seg = b.closest('[data-seg]'); seg.querySelectorAll('.chip-btn').forEach(x => x.classList.toggle('on', x === b)); sheetCtx.mode = b.dataset.v; const lf = document.querySelector('[data-left-field]'); if (lf) lf.hidden = b.dataset.v === 'out'; return; }
      case 'log-ate': { const c = sheetCtx; if (res(OLLA.logMeal(state, c.date, c.slot, { s: 'ate' }, t, n, at))) done('', true); return; }
      case 'log-skip': { const c = sheetCtx; if (c.fromCook) OLLA.logCook(state, c.fromCook, { s: 'notmade' }, t, n, at); if (res(OLLA.logMeal(state, c.date, c.slot, { s: 'skipped' }, t, n, at))) done('Anotado.'); return; }
      case 'log-void': { const c = sheetCtx; if (res(OLLA.logMeal(state, c.date, c.slot, { s: 'void' }, t, n, at))) done('Deshecho.'); return; }
      case 'log-other': {
        const c = sheetCtx, what = (document.getElementById('log-what') || {}).value || '', mode = c.mode || 'bought', left = stepVal('left');
        if (!mode) { toast('¿Compraste, pediste o cocinaste?'); return; }
        if (c.fromCook) OLLA.logCook(state, c.fromCook, { s: 'notmade' }, t, n, at);
        let entry;
        if (mode === 'out') { entry = { s: 'out', what: what.trim() }; const o = state.settings.orders = state.settings.orders || []; if (what.trim() && o.indexOf(what.trim()) < 0) { o.unshift(what.trim()); o.length = Math.min(o.length, 6); } }
        else { const r = state.recipes.find(x => x.name.toLowerCase() === what.trim().toLowerCase()); entry = { s: 'other', what: what.trim() || (mode === 'bought' ? 'algo comprado' : 'algo cocinado'), left }; if (r) entry.recipe = r.id; }
        if (res(OLLA.logMeal(state, c.date, c.slot, entry, t, n, at))) done(left ? 'Anotado: sobró ' + porc(left) + ' para la olla.' : 'Anotado.', !!left);
        return; }
      case 'runner-start': { const c = sheetCtx || {}; const day = c.date && state.plan.days[c.date]; const cook = day && day.cook && day.cook.recipe === b.dataset.id ? day.cook : null;
        openRunner({ date: c.date || t, batch: cook ? cook.batch : null, recipe: b.dataset.id, servings: c.servings }); return; }
      case 'runner-resume': { const s = state.cookSession; openRunner({ date: s.date, batch: s.batch, recipe: s.recipe, servings: s.servings }); return; }
      case 'runner-close': closeRunner(true); return;
      case 'runner-recipe': openRecipe(b.dataset.id, { date: state.cookSession && state.cookSession.date }); return;
      case 'r-back': state.cookSession.step = Math.max(-1, state.cookSession.step - 1); saveQuiet(); renderRunner(); return;
      case 'r-next': { const s = state.cookSession, r = rec(s.recipe), total = stepsOf(r).length; unlockAudio(); if (s.step >= total) { finishRunner(); return; } s.step++; saveQuiet(); renderRunner(); document.querySelector('#runner .r-body') && (document.querySelector('#runner .r-body').scrollTop = 0); return; }
      case 'got': { const s = state.cookSession; s.got[b.dataset.k] = !s.got[b.dataset.k]; saveQuiet(); b.classList.toggle('got', !!s.got[b.dataset.k]); return; }
      case 'timer': addTimer(+b.dataset.min); return;
      case 'timer-done': { const s = state.cookSession, x = (s.timers || []).find(y => String(y.id) === b.dataset.id); if (x) { x.done = true; saveQuiet(); renderRunner(); } return; }
    }
  }
  function slotNow(n) { const e = k => OLLA.eatAt(state, T(), k); return n < e('lunch') - 60 ? 'bf' : n < e('dinner') - 90 ? 'lunch' : 'dinner'; }
  async function shareTrip(d) {
    const sh = OLLA.shopping(state, T(), N()), trip = (sh.trips || []).find(x => x.date === d); if (!trip) return;
    const text = OLLA.listText(state, trip), title = (state.settings.store.name || 'Safeway') + ' · ' + dayWord(trip.date);
    try { if (navigator.share) { await navigator.share({ title, text }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(text); toast('Lista copiada.'); } catch (e) { toast('No se pudo copiar.', true); }
  }

  function boot() {
    const bn = document.getElementById('brand-name'); if (bn) bn.innerHTML = 'La <b>Olla</b>';
    ensureWeek(); applyOllaTheme();
    document.addEventListener('click', e => { if (e.target.closest('#app-root, #olla-sheet, #runner')) onClick(e); });
    document.getElementById('olla-sheet').addEventListener('click', e => { if (e.target === e.currentTarget) closeSheet(); });
    document.getElementById('olla-sheet').addEventListener('close', () => { sheetCtx = null; });
    document.getElementById('bottom-tabs').addEventListener('click', e => { const b = e.target.closest('.tab[data-view]'); if (b) go(b.dataset.view); });
    const ks = document.getElementById('kitchen-settings');
    ks.addEventListener('click', e => { if (e.target.closest('[data-act="step"]')) { onClick(e); return; } onKitchen(e); });
    ks.addEventListener('change', onKitchen);
    // openSettings is a shell function declaration the shell already bound; the kitchen section renders on every door in (capture phase)
    ['settings-btn', 'sync-pip'].forEach(id => document.getElementById(id).addEventListener('click', renderKitchenSettings, true));
    document.querySelectorAll('[data-theme-pick]').forEach(b => b.addEventListener('click', () => { state.settings.themeChosen = true; state.settings.theme = b.dataset.themePick; save(); applyOllaTheme(); }));
    settingsModal.addEventListener('close', () => render());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      ensureWeek(); render();
      if (state.cookSession && !document.getElementById('runner').hidden) acquireWake();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !document.getElementById('runner').hidden) closeRunner(true); });
    clearInterval(minuteTimer);
    minuteTimer = setInterval(() => { if (document.hidden) return; const dlg = document.getElementById('olla-sheet'); if (dlg.open || settingsModal.open || !document.getElementById('runner').hidden) return; ensureWeek(); render(); }, 60000);
    if (state.cookSession && (Date.now() - (state.cookSession.startedAt || 0)) < 8 * 3600000) { /* a cook in progress survives a reload: Hoy shows «Seguir» */ }
    else if (state.cookSession) { state.cookSession = null; saveQuiet(); }
  }
  return { render, go, boot, openRecipe, todayYmd: T, nowMin: N, ensureWeek };
})();
