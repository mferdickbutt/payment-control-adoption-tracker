# Payment Control Adoption Tracker

Public dashboard of **payment control adoption**: named controls, monthly adoption rates, exception counts, and period-over-period (PoP) trend.

**Hard requirement:** first paint is static HTML. `index.html` already contains the full metrics table. A `curl -sL` of the file (no JavaScript) shows control names, month labels, rates, exceptions, and PoP. JavaScript is optional filtering only.

## Files

| Path | Role |
| --- | --- |
| `data/controls.json` | Source metrics (≥5 controls × ≥12 months) |
| `js/adoption.js` | Pure adoption / PoP / summary functions (browser + Node) |
| `js/enhance.js` | Optional row filter; not required to see the table |
| `scripts/render-static.js` | Reads JSON + `adoption.js`, writes the table into `index.html` |
| `scripts/test.sh` | Assertions, including first-paint embedding |
| `css/styles.css` | Minimal layout |
| `.nojekyll` | Allow GitHub Pages to serve the site as-is |
| `index.html` | Committed, pre-rendered table |

## Data schema (`data/controls.json`)

```json
{
  "meta": {
    "title": "Payment Control Adoption Tracker",
    "asOf": "2026-08",
    "rateUnit": "0-1",
    "exceptionUnit": "count"
  },
  "controls": [
    {
      "id": "INV-3WM",
      "name": "Invoice three-way match",
      "owner": "AP Operations",
      "description": "…",
      "months": [
        {
          "period": "2025-06",
          "eligible": 1760,
          "adopted": 1373,
          "exceptions": 51,
          "rate": 0.7801
        }
      ]
    }
  ]
}
```

- **`period`**: calendar month `YYYY-MM`.
- **`eligible`**: items (invoices, payments, vendor-change requests, payment runs) that should have hit the control.
- **`adopted`**: items where the control actually executed as designed.
- **`exceptions`**: items that failed or bypassed the control (integer count).
- **`rate`**: stored adoption rate in **0–1**. Must equal `adopted / eligible` (tests allow 0.00015 rounding).

## Formulas

Let month \(t\) have adopted \(A_t\) and eligible \(E_t\).

**Adoption rate**

\[
r_t = A_t / E_t \quad (E_t > 0)
\]

Displayed as a percentage with one decimal place (`formatPercent`).

**Exception rate** (computed, not a table column)

\[
x_t = X_t / E_t
\]

**Period-over-period (PoP) trend** — latest month versus the immediately prior month:

\[
\Delta = r_t - r_{t-1}
\]

Direction uses epsilon \(0.0005\):

- \(\Delta > 0.0005\) → up (`▲`)
- \(\Delta < -0.0005\) → down (`▼`)
- otherwise → flat (`→ 0.0%`)

**Average adoption** (KPI): mean of each control’s **latest** \(r_t\).

**Open exceptions** (KPI): sum of each control’s latest exception count.

## Re-render static HTML

After editing `data/controls.json` or table markup in `js/adoption.js`:

```bash
node scripts/render-static.js
```

The script replaces the `<!--STATIC_KPIS-->` and `<!--STATIC_TABLE-->` blocks in `index.html`. Commit the regenerated HTML so GitHub Pages / static extractors see real cells without running JS.

Do not ship a “Loading…” shell as the only content.

## Tests

```bash
bash scripts/test.sh
```

Expect `PASS:` lines and `Summary: N passed, 0 failed` with exit code 0. Coverage includes JSON shape, adoption/PoP math, and a first-paint check that `index.html` contains a control name from the JSON plus a real `<table>` (not a loading placeholder). `curl -sL` of the file is also asserted.

## Suggested next improvements

- Wire the JSON to a live control-testing or GRC export instead of a committed snapshot.
- Add owner-level targets and a “below threshold” flag column.
- Publish a monthly CSV artifact alongside the HTML table.
- Optional chart enhancement (still keep the static table as the source of truth).
- Split exception types (bypass vs. true fail) once source systems distinguish them.
