# La Olla — project guide

**«¿Qué hay en la olla?» — the meal-stock organ of the estate.** Single-file PWA forked from the
**app-shell template (C3)**, its own private gist (`olla.json`), GitHub Pages. Phone-first: the two
places it is used are the kitchen and the dining-hall line. The design record (plan, v2 spec, research)
lives in the private `leandro-os-prototype` repo: `LA-OLLA-PLAN.md`, `LA-OLLA-V2-SPEC.md`. This file is the build.

## What this is (don't drift from this)
- **A dinner-STOCK organ, not a planner and not a recipe app.** Its one job: tomorrow's dinner exists before
  tonight's is eaten. The problem it exists for is EATING: dinner that exists before he needs it.
- **Plan = intent, log = reality.** `plan.days` is what the rule (or his hand) intended; `log`, `cooks`,
  `extra`, `likes` are what happened. Nothing ever writes a past `plan.days[d]`. The pot, the leftovers, the
  register and the ladder derive from reality first. **When unsure, the pot holds LESS**: a past cook nobody
  confirmed is NOT in the pot (it is asked about, today and yesterday only — never a guilt list). Today's cook is
  asked about only once its cook WINDOW has closed (the city may seat it later inside that window) and never later
  than the moment its dinner can be logged (`cookDueAt`); until then it reads «cooking».
- **The week is a RULE, not a document.** `OLLA.buildWeek(state, today, now)` runs on every boot, wake and tap;
  he only overrides a row (tap → `setKind`, `hand:true`; «volver a la regla» → `backToRule`). Cooks are seated
  FIRST, by coverage (who must eat from this pot until the next day that can cook), then leftovers. Rotation:
  three dishes per rung until boring (`pickRecipe`), gear-aware, liking-aware, never back-to-back. Once today's
  trip has left (its departure, cook − trip, is behind `now` and the list is still unticked) the cook stays at its
  hour and the trip at its departure — silence means he went; back from it, nothing nudges him to shop for it.
- **«Comprado» is success.** Rung-1 dishes are assembly: their verb is «armar». Buying a rotisserie chicken is the
  plan; buying something off-plan that leaves portions creates a real batch the planner uses like a cook. A batch
  with no meal behind it (answered before its dinner can be logged, the pot sheet's «compré», an off-plan
  cook-along) is `addBatch` — an `extra` tied to no log entry, taken back with `logCook(id, {s:'tossed'})`.
- **Dinner is never a swipe** (the hall's last station closes at 6pm; weekends nothing is open on that campus).
- **No calories, no macros, no streaks, no counters of failure.** Protein per recipe is an ESTIMATE and says so;
  a protein ADD-ON line («+ leche con el swipe») is allowed. The weekly register names a skipped slot, never a score.
- **Gear is asked once** (Hoy shows «¿Qué hay en tu cocina?» until he confirms), never assumed; the book never
  proposes a dish whose gear he marked missing.

## Identity — «Peltre negro» (don't drift from this)
- Graniteware at night (`--bg #10140d`), cream enamel by day (Loza `#f3ecdc`); the theme follows the clock by
  default (Loza 7–19h). ONE accent, culantro `#a3d15c`, meaning ALIVE / NEXT. Steam is the heat: `--steam`
  (freshness of what is in the pot) drives the top glow and the big number's colour, as La Forja's `--heat`
  drives its fire. Instrument Serif speaks (hierarchy by size and italics, weight 400); Azeret Mono counts
  (tabular). Sentence case, nothing under 11px, faint ink ≥ 5:1. Not Bitácora's gold, not La Forja's ember.
- The bold moment: «Comí» / «A la olla» → the lid shuts on the drawn pot, one curl of steam escapes, the
  number pops. The cook-along is La Forja's runner: one step per screen, timers as absolute `endsAt`, the
  screen kept awake.

## The code
- `index.html` is the whole app. Shell plumbing is app-shell's, backported by hand. La Olla's code sits in
  marked blocks inside `SLOT:APP-LOGIC`: **`OLLA-ENGINE`** (pure: no DOM, no clock — every function takes
  `today`, and `now` in minutes where the hour matters), **`OLLA-SEED`** (the book, the `INGREDIENTS` table
  with Safeway sections and buy-within days), the app hooks, and `OLLAUI`. `test-olla.js` extracts blocks BY
  MARKER, so keep the markers and never declare a symbol twice.
- **The only clocks are `ollaClock()` (shell layer) and `OLLAUI`'s `T()`/`N()`**; the engine never reads one.
  The shell's own `today()` is UTC — never use it.
- **Sync (app-specific, keep it):** every gist request is `cache:'no-store'`; pull adopts the newer copy's
  plan/settings and MERGES reality (`mergeReality`) both ways; push GETs, merges, then PATCHes `olla.json` only;
  a re-derivation saves `{markModified:false, push:false}` (it must never win a sync against his tap).
  `cookSession` is device-local: never pushed, and kept when a pull adopts a newer copy.
  `cleanStateForSync` adds **`pub`**, the projection the city (the Heraldo's cook and Safeway blocks) and the
  Worker (Pushover reminders) read — its shape is a FROZEN contract (`LA-OLLA-V2-SPEC.md` §2.7): integers only,
  seven days, a day the engine can't project is omitted. `appMigrate` deletes `pub` on load.
- `appMigrate` merges over the seed field by field, idempotent on load AND every pull; the first schema-2
  migration on a device writes `olla.v1.pre-schema2` once. Seed recipes upgrade only when he never edited them.
- `sw.js` deletes ONLY `olla-*` caches: every sibling app shares the `leandrogn10-ctrl.github.io` origin.

## The load-bearing rules
- **Deploy gate = `bash gate.sh`**: `test-olla.js` (engine pins; every control must go RED) then the
  headless-Chrome `test-harness.html` (boot, log, RELOAD persistence, hand rows, recipe scaling, the cook-along
  surviving a reload, list checks, settings, sibling-gist refusal, hit-testing; and, at pinned hours, a cook
  question answered «Sí» with a yield and «otra cosa» before dinner, planned and off-plan cook-alongs finished, the
  pot's «Comer una», the runner closed before «Empezar» and as a modal dialog, kitchen values refused, escaping,
  44px targets at 375px), whose CONTROL lines must all read FAIL. Run it headless; don't eyeball. `gate.sh` runs
  under `pipefail`. A UI fix gets a harness line AND a run with the original defect re-planted in a scratch copy.
- **Shipping `index.html` means bumping `CACHE_NAME` in `sw.js`, same commit**, then `curl` the Pages URL and
  grep the SERVED bytes for the string you added. A green gate on localhost is a fact about your server.
- **Persistence discipline**: a schema change is invisible to a returning user unless it migrates — bump
  `OLLA_SCHEMA`, extend `appMigrate`, plant the legacy snapshot in `test-olla.js`.
- **Estimates stay labelled.** Minutes, servings, fridge days, protein and in-store minutes are estimates;
  food-safety numbers (3–4 days, 165°F, rice chilled fast) come from USDA FSIS and cite it.
- **This repo is PUBLIC.** Personal details (address, schedule specifics, health) live in the private
  prototype repo's docs, never here.

## Dev loop
```bash
python3 -m http.server 8731   # http://localhost:8731/  — never file://; bump the port to dodge a stale SW
```
Sync: Ajustes → Sincronización → token with gist scope → Activar → copy the Gist ID into LeandroOS Setup →
«La Olla · Gist ID». Until then the city and the reminders have nothing to read.
