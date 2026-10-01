# La Olla — project guide

**«¿Qué hay en la olla?» — the meal-stock organ of the estate.** Single-file PWA forked from the
**app-shell template (C3)**, its own private gist (`olla.json`), GitHub Pages. Phone-first: the two
places it is used are the kitchen and the dining-hall line.
**The plan is `LA-OLLA-PLAN.md` in `~/Downloads/leandro-os-prototype`** (with the city-side hooks); read it
before changing what a week IS. This file is the build.

## What this is (don't drift from this)
- **A dinner-STOCK organ, not a planner and not a recipe app.** Its one job: tomorrow's dinner exists before
  tonight's is eaten. The problem it exists for is EATING (he skips, mostly on weekends and on the nights that
  end late), never cooking for its own sake.
- **The week is a RULE, not a document.** `OLLA.buildWeek` is the default planner and runs on every boot;
  he only ever overrides a row (tap → `setKind`, marked `hand:true`), never writes a plan. There is no
  Saturday ritual, because a skipper skips planning too. The coach (step 4) is ADDITIVE and gated by the
  same `validateWeek`; the fallback week is what ships when the model is off — `plan.via` says which served.
- **Dinner is never a swipe.** The Local's last station closes at 6pm and Urban Kitchen at 3pm (read
  as of 29-sep-2026). **Weekends the hall is closed** (30-sep):
  Sat/Sun are never swipe days. Swipes are weekday
  breakfasts and lunches; every dinner is `cook`, `leftover`, `home` (a fridge default) or `out`.
- **Every cook is a double** (`coverAhead`, clamped [2, maxServings]): Wed cooks two, Thu eats it; Fri cooks
  two, Sat lunch finishes it; Sat cooks the pot for Sun/Mon/Tue. Leftovers live ≤ `fridgeDays` (USDA 3–4).
- **No calories, no macros, ever.** Protein per recipe is an ESTIMATE and the UI says so. The only truth for
  progress is a weekly reading in La Forja, which this app does not read until four exist.
- **The register is append-only and never touches the plan** (`logMeal`); it refuses the future. No
  ate/skipped tap ships until its weekly read path (`weekRegister`) is on a screen — a write-only register
  is landfill. **A rung is passed by CODE** (`rungCheck`: ≥6 pot meals eaten at the rung spanning ≥10 days),
  never asserted; fridge defaults (`home` rows) never count. The ladder is a LIST in the book, not a screen.
- **Gear is asked, never seeded** (Settings → La cocina). Check which outlet a 1500W appliance uses before
  assuming it can run alongside everything else.

## Identity — enamel and chalk (don't drift from this)
- Esmalte (night, default): enamel black `--bg #15190f`, chalk ink `#f1eadb`, the one green in the estate
  `--accent #a3d15c` (cilantro / ají verde) meaning ALIVE: a live pot, a hand-set row, the next thing to do.
  Loza (day): the same pot on a cream counter. Not Bitácora's terracotta, not La Forja's ember, not La
  Lámpara's amber. Type: **Instrument Serif** speaks (the estate's shared voice), **Azeret Mono** counts
  (minutes, portions, quantities, hours). Not JetBrains (La Forja), not Departure (the city).
- The one motion: steam curling off a live pot (CSS, honours reduced-motion). Step 2's bold moment is
  tap *ate* → the lid slides shut. A rung-up fills a jar — a shape, never a number.

## The code
- `index.html` is the whole app. Shell plumbing is app-shell's, structurally identical, backported by hand.
  La Olla's code sits in three marked blocks inside `SLOT:APP-LOGIC`: **`OLLA-ENGINE`** (pure; no DOM, no
  clock — every function takes `today`), **`OLLA-SEED`** (the book + defaults; ONE `staple:true` per rung),
  and `OLLAUI`. `test-olla.js` extracts the engine and seed BY MARKER, so keep the markers and never
  duplicate a symbol (the harness asserts declared-once).
- **The app never reads the shell's `today()`** — it is UTC, the exact bug that filed La Forja's late
  sessions under tomorrow. `OLLAUI.todayYmd()` (local) is the only clock, and `ensureWeek` re-runs on
  visibility so a phone that slept across midnight wakes on the right day.
- `appMigrate` MERGES over the seed's defaults, field by field, idempotent on load AND on every gist pull;
  seed recipes are added by id when missing, his edits to an existing id win. `looksLikeMyState` requires
  settings + ladder + plan.days + a recipe array and is pinned to REFUSE `cuaderno.json` and `lampara.json`.
- A re-derivation of the week saves with `markModified:false`: the rule re-running is not his edit and
  must not win a last-write-wins sync against a device where he actually tapped.

## The load-bearing rules
- **Deploy gate = `bash gate.sh`**: `test-olla.js` (74 pins, every control must go RED) then the
  headless-Chrome `test-harness.html` (boot, tap, RELOAD persistence, theme, settings, sibling-gist refusal,
  and one CONTROL line that must read FAIL). Run it headless; don't eyeball.
- **Shipping `index.html` means bumping `CACHE_NAME` in `sw.js`, same commit.** An installed copy keeps
  serving the old shell otherwise and a correct fix reads as NOT APPLIED. A green gate on localhost is a
  fact about your server: after a push, `curl` the Pages URL and grep the SERVED bytes for the string you added.
- **Persistence discipline**: a schema change is invisible to a returning user unless it migrates — bump
  `OLLA_SCHEMA`, extend `appMigrate`, plant the legacy snapshot in `test-olla.js` §7.
- **Estimates stay labelled.** Minutes, servings, fridge days and protein in the seed are the 29-sep brief's
  estimates; the recipe sheet prints "(estimado)" on protein. Don't tune a number to make a week come out.

## Dev loop
```bash
python3 -m http.server 8731   # http://localhost:8731/  — never file://; bump the port to dodge a stale SW
```
Sync round-trip: Settings → gist-scoped PAT → Gist ID blank → Enable & sync → `gh gist list` shows a new
private gist with `olla.json` → toggle theme, reload → both survive.

## Build order (from the plan; ✓ = shipped)
1. ✓ Shell + schema + `looksLikeMyState` + the seeded book + the fallback week + La semana (tap-cycles) +
   La lista (derived) + the recipe sheet + Settings → La cocina + sync + gate.
2. Hoy with a timer; `weekRegister` on a screen, and only then the *ate / skipped* tap and the lid.
3. City hooks (see the plan): `_ollaSync`, meal-anchor `sub` + minutes, the cook anchor, Portero `nocook`.
4. Coach + rung gate + book additions; bodyweight coupling once La Forja has ≥4 weekly readings.
