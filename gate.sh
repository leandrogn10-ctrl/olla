#!/usr/bin/env bash
# gate.sh — La Olla's deploy gate. Green means: the engine pins pass with every control red (node), AND the app boots,
# taps, and survives a reload on a real layout (headless Chrome). Run before every push; bump CACHE_NAME in sw.js in
# the same commit as any index.html change.
set -u
set -o pipefail   # without it `node test-olla.js | tail` exits with TAIL's status and a red engine reads green
cd "$(dirname "$0")"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
PORT=$((8700 + RANDOM % 200))
# Google Fonts are mapped to localhost so the page's load event does not wait on a network the sandbox may not have; type is not under test here.   # a fresh port every run: a reused one can serve a stale service-worker copy of the app
echo "── test-olla.js (engine) ──"
if ! node test-olla.js | tail -3; then echo "gate: FAIL (engine)"; exit 1; fi
echo "── test-harness.html (headless Chrome on :$PORT) ──"
python3 -m http.server "$PORT" >/dev/null 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
for _ in $(seq 1 40); do curl -s -o /dev/null "http://localhost:$PORT/" && break; sleep 0.25; done   # poll, never a fixed sleep: python can take >1s to bind
SERVED=$(mktemp); curl -sf "http://localhost:$PORT/index.html" -o "$SERVED" || true   # to a FILE: under pipefail, curl | grep -q dies of SIGPIPE on the first match and reads as a failure
if ! LC_ALL=C grep -q 'OLLA-ENGINE-BEGIN' "$SERVED"; then echo "gate: FAIL — the server on :$PORT is not serving THIS index.html"; exit 1; fi
# --dump-dom writes the DOM within a second and then Chrome LINGERS (it wakes the Google Updater on exit and never
# returns under this sandbox), so the gate polls the dump for </html> and kills Chrome itself, never waits on it.
OUT=$(mktemp)
"$CHROME" --headless=new --disable-gpu --no-first-run --disable-background-networking --disable-component-update --user-data-dir="$(mktemp -d)" --host-resolver-rules="MAP fonts.googleapis.com 127.0.0.1, MAP fonts.gstatic.com 127.0.0.1" --virtual-time-budget=8000 --dump-dom "http://localhost:$PORT/test-harness.html" > "$OUT" 2>/dev/null &
CPID=$!
for _ in $(seq 1 60); do grep -q "</html>" "$OUT" 2>/dev/null && break; sleep 1; done
pkill -P "$CPID" 2>/dev/null; kill "$CPID" 2>/dev/null
DOM=$(cat "$OUT")
LINES=$(printf '%s\n' "$DOM" | grep -o 'HARNESS: [^<]*' | sed 's/&gt;/>/g; s/&amp;/\&/g')
printf '%s\n' "$LINES"
TOTAL=$(printf '%s\n' "$LINES" | grep -c 'HARNESS: \(PASS\|FAIL\)')
FAILS=$(printf '%s\n' "$LINES" | grep 'HARNESS: FAIL' | grep -vc 'CONTROL (must read FAIL)')
CTRL=$(printf '%s\n' "$LINES" | grep -c 'HARNESS: FAIL >> CONTROL (must read FAIL)')
CTRL_ALL=$(printf '%s\n' "$LINES" | grep -c 'CONTROL (must read FAIL)')
DONE=$(printf '%s\n' "$LINES" | grep -xc 'HARNESS: DONE')   # -x: the harness SOURCE also contains the string, and --dump-dom prints the source
if [ "$TOTAL" -lt 20 ] || [ "$DONE" -ne 1 ]; then echo "gate: FAIL — harness did not run to the end ($TOTAL lines, done=$DONE)"; exit 1; fi
if [ "$CTRL_ALL" -lt 2 ] || [ "$CTRL" -ne "$CTRL_ALL" ]; then echo "gate: FAIL — $CTRL of $CTRL_ALL CONTROL lines read FAIL (need all, and at least 2): this harness cannot go red"; exit 1; fi
if [ "$FAILS" -ne 0 ]; then echo "gate: FAIL — $FAILS harness line(s) failed"; exit 1; fi
echo "gate: OK — engine pins green, $TOTAL harness lines, control red"
