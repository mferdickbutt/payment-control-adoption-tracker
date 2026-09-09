#!/usr/bin/env bash
# Payment control adoption tracker — static first-paint + math assertions.
set +e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

passed=0
failed=0

pass() {
  echo "PASS: $1"
  passed=$((passed + 1))
}

fail() {
  echo "FAIL: $1"
  failed=$((failed + 1))
}

assert_true() {
  local name="$1"
  shift
  if "$@"; then
    pass "$name"
  else
    fail "$name"
  fi
}

# 1. Source files exist
assert_true "data/controls.json exists" test -f data/controls.json
assert_true "js/adoption.js exists" test -f js/adoption.js
assert_true "index.html exists" test -f index.html
assert_true "scripts/render-static.js exists" test -f scripts/render-static.js
assert_true ".nojekyll exists" test -f .nojekyll
assert_true "css/styles.css exists" test -f css/styles.css

# 2. JSON parses and meets size floor
node << 'NODE'
const fs = require("fs");
const data = JSON.parse(fs.readFileSync("data/controls.json", "utf8"));
if (!Array.isArray(data.controls) || data.controls.length < 5) {
  console.error("need ≥5 controls");
  process.exit(1);
}
process.exit(0);
NODE
if [ $? -eq 0 ]; then pass "controls.json has ≥5 controls"; else fail "controls.json has ≥5 controls"; fi

node << 'NODE'
const fs = require("fs");
const data = JSON.parse(fs.readFileSync("data/controls.json", "utf8"));
for (const c of data.controls) {
  if (!c.id || !c.name) process.exit(1);
  if (!Array.isArray(c.months) || c.months.length < 12) process.exit(1);
}
process.exit(0);
NODE
if [ $? -eq 0 ]; then pass "each control has a name and ≥12 months"; else fail "each control has a name and ≥12 months"; fi

node << 'NODE'
const fs = require("fs");
const data = JSON.parse(fs.readFileSync("data/controls.json", "utf8"));
for (const c of data.controls) {
  for (const m of c.months) {
    if (!m.period || typeof m.exceptions !== "number") process.exit(1);
    if (typeof m.eligible !== "number" || typeof m.adopted !== "number") process.exit(1);
    if (typeof m.rate !== "number" || m.rate < 0 || m.rate > 1) process.exit(1);
  }
}
process.exit(0);
NODE
if [ $? -eq 0 ]; then pass "months include period, rate 0–1, adopted/eligible, exceptions"; else fail "months include period, rate 0–1, adopted/eligible, exceptions"; fi

# 3. Pure math in adoption.js (Node)
node << 'NODE'
const A = require("./js/adoption.js");
if (A.adoptionRate(80, 100) !== 0.8) process.exit(1);
if (A.adoptionRate(0, 0) !== null) process.exit(1);
process.exit(0);
NODE
if [ $? -eq 0 ]; then pass "adoptionRate(80,100) === 0.8 and ineligible is null"; else fail "adoptionRate(80,100) === 0.8 and ineligible is null"; fi

node << 'NODE'
const A = require("./js/adoption.js");
if (A.formatPercent(0.941) !== "94.1%") process.exit(1);
if (A.formatPercent(null) !== "—") process.exit(1);
process.exit(0);
NODE
if [ $? -eq 0 ]; then pass "formatPercent renders 94.1% and em-dash for null"; else fail "formatPercent renders 94.1% and em-dash for null"; fi

node << 'NODE'
const A = require("./js/adoption.js");
const up = A.popDelta(0.90, 0.85);
const down = A.popDelta(0.80, 0.82);
const flat = A.popDelta(0.50, 0.5002);
if (A.popDirection(up) !== "up") process.exit(1);
if (A.popDirection(down) !== "down") process.exit(1);
if (A.popDirection(flat) !== "flat") process.exit(1);
if (A.popLabel(up).indexOf("▲") === -1) process.exit(1);
process.exit(0);
NODE
if [ $? -eq 0 ]; then pass "PoP direction up/down/flat and ▲ label"; else fail "PoP direction up/down/flat and ▲ label"; fi

node << 'NODE'
const fs = require("fs");
const A = require("./js/adoption.js");
const data = JSON.parse(fs.readFileSync("data/controls.json", "utf8"));
const summary = A.datasetSummary(data);
if (summary.controlCount !== data.controls.length) process.exit(1);
if (summary.monthCount < 12) process.exit(1);
if (summary.snapshots.some((s) => s.series.length < 12)) process.exit(1);
const first = data.controls[0];
const last = first.months.slice().sort((a, b) => a.period.localeCompare(b.period)).pop();
const snap = summary.snapshots[0];
const expected = A.adoptionRate(last.adopted, last.eligible);
if (Math.abs(snap.rate - expected) > 1e-9) process.exit(1);
process.exit(0);
NODE
if [ $? -eq 0 ]; then pass "datasetSummary matches JSON control/month counts and latest rate"; else fail "datasetSummary matches JSON control/month counts and latest rate"; fi

node << 'NODE'
const fs = require("fs");
const A = require("./js/adoption.js");
const data = JSON.parse(fs.readFileSync("data/controls.json", "utf8"));
for (const c of data.controls) {
  for (const m of c.months) {
    const computed = A.adoptionRate(m.adopted, m.eligible);
    if (Math.abs(computed - m.rate) > 0.00015) process.exit(1);
  }
}
process.exit(0);
NODE
if [ $? -eq 0 ]; then pass "stored rates match adopted/eligible within 0.00015"; else fail "stored rates match adopted/eligible within 0.00015"; fi

# 4. First-paint HTML: table is in the file without executing JS
html="$(cat index.html)"

node << 'NODE'
const fs = require("fs");
const html = fs.readFileSync("index.html", "utf8");
const data = JSON.parse(fs.readFileSync("data/controls.json", "utf8"));
const name = data.controls[0].name;
const id = data.controls[0].id;
if (html.indexOf(name) === -1) process.exit(1);
if (html.indexOf(id) === -1) process.exit(1);
process.exit(0);
NODE
if [ $? -eq 0 ]; then pass "index.html contains a control name and id from JSON"; else fail "index.html contains a control name and id from JSON"; fi

echo "$html" | grep -qiE 'loading[…]|loading\.\.\.|Loading' 
loading=$?
echo "$html" | grep -q '<table'
hastable=$?
if [ $hastable -eq 0 ]; then
  pass "index.html contains a <table> (not a JS-only shell)"
else
  fail "index.html contains a <table> (not a JS-only shell)"
fi

if [ $loading -eq 0 ] && [ $hastable -ne 0 ]; then
  fail "index.html is not merely a Loading placeholder"
else
  pass "index.html is not merely a Loading placeholder"
fi

assert_true "index.html includes month labels (2025- or 2026-)" grep -qE '2025-|2026-' index.html
assert_true "index.html includes percent rates" grep -q '%' index.html
assert_true "index.html includes exception counts (exc)" grep -q 'exc' index.html
assert_true "index.html includes PoP trend cells" grep -qE 'PoP|▲|▼|→' index.html
assert_true "index.html includes INV control id" grep -q 'INV-3WM' index.html

# 5. curl of the file (no JS) still shows metrics
if command -v curl >/dev/null 2>&1; then
  curled="$(curl -sL "file://${ROOT}/index.html")"
  echo "$curled" | grep -q 'INV-3WM' && echo "$curled" | grep -q '%' && echo "$curled" | grep -q '<table'
  if [ $? -eq 0 ]; then
    pass "curl -sL of index.html (no JS) shows INV-3WM, %, and table markup"
  else
    fail "curl -sL of index.html (no JS) shows INV-3WM, %, and table markup"
  fi
else
  fail "curl is available for first-paint check"
fi

echo "Summary: ${passed} passed, ${failed} failed"
if [ "$failed" -ne 0 ]; then
  exit 1
fi
exit 0
