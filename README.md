# La Olla

«¿Qué hay en la olla?» — the meal-stock organ of Leandro's estate. Single-file PWA (`index.html`),
offline-first, GitHub Pages, forked from the app-shell template. State syncs to a private gist (`olla.json`).

- **Dev loop**: `python3 -m http.server 8731` → http://localhost:8731/ (never `file://`)
- **Deploy gate**: `bash gate.sh` — engine pins (node) + headless-Chrome boot harness; every control must go red.
- **Design**: `LA-OLLA-PLAN.md` in `leandro-os-prototype`; build notes in `CLAUDE.md`.
