/**
 * Payment control adoption math.
 * Loadable from Node (`require`) and browsers (`<script>` → global Adoption).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (typeof root === "object" && root !== null) {
    root.Adoption = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const POP_EPSILON = 0.0005;

  function adoptionRate(adopted, eligible) {
    const a = Number(adopted);
    const e = Number(eligible);
    if (!Number.isFinite(a) || !Number.isFinite(e) || e <= 0) return null;
    return a / e;
  }

  function exceptionRate(exceptions, eligible) {
    const x = Number(exceptions);
    const e = Number(eligible);
    if (!Number.isFinite(x) || !Number.isFinite(e) || e <= 0) return null;
    return x / e;
  }

  function formatPercent(rate, digits) {
    const d = digits == null ? 1 : digits;
    if (rate == null || !Number.isFinite(rate)) return "—";
    return (rate * 100).toFixed(d) + "%";
  }

  function popDelta(currentRate, previousRate) {
    if (currentRate == null || previousRate == null) return null;
    if (!Number.isFinite(currentRate) || !Number.isFinite(previousRate)) return null;
    return currentRate - previousRate;
  }

  function popDirection(delta) {
    if (delta == null || !Number.isFinite(delta)) return "unknown";
    if (delta > POP_EPSILON) return "up";
    if (delta < -POP_EPSILON) return "down";
    return "flat";
  }

  function popLabel(delta) {
    const dir = popDirection(delta);
    if (dir === "unknown") return "n/a";
    const mag = formatPercent(Math.abs(delta));
    if (dir === "up") return "▲ " + mag;
    if (dir === "down") return "▼ " + mag;
    return "→ 0.0%";
  }

  function comparePeriod(a, b) {
    return String(a).localeCompare(String(b));
  }

  function sortedMonths(months) {
    return (months || []).slice().sort(function (a, b) {
      return comparePeriod(a.period, b.period);
    });
  }

  function monthRate(month) {
    if (!month) return null;
    const computed = adoptionRate(month.adopted, month.eligible);
    if (computed != null) return computed;
    if (month.rate != null && Number.isFinite(Number(month.rate))) {
      return Number(month.rate);
    }
    return null;
  }

  function controlSeries(control) {
    return sortedMonths(control.months).map(function (m) {
      return {
        period: m.period,
        eligible: m.eligible,
        adopted: m.adopted,
        exceptions: m.exceptions,
        rate: monthRate(m)
      };
    });
  }

  function uniquePeriods(data) {
    const set = {};
    (data.controls || []).forEach(function (c) {
      (c.months || []).forEach(function (m) {
        set[m.period] = true;
      });
    });
    return Object.keys(set).sort(comparePeriod);
  }

  function latestSnapshot(control) {
    const series = controlSeries(control);
    const last = series[series.length - 1] || null;
    const prev = series.length > 1 ? series[series.length - 2] : null;
    const delta = last && prev ? popDelta(last.rate, prev.rate) : null;
    return {
      id: control.id,
      name: control.name,
      owner: control.owner || "",
      description: control.description || "",
      period: last ? last.period : null,
      rate: last ? last.rate : null,
      exceptions: last ? last.exceptions : null,
      eligible: last ? last.eligible : null,
      adopted: last ? last.adopted : null,
      popDelta: delta,
      popDirection: popDirection(delta),
      popLabel: popLabel(delta),
      monthCount: series.length,
      series: series
    };
  }

  function datasetSummary(data) {
    const snapshots = (data.controls || []).map(latestSnapshot);
    const rates = snapshots.map(function (s) { return s.rate; }).filter(function (r) {
      return r != null && Number.isFinite(r);
    });
    const avgRate = rates.length
      ? rates.reduce(function (a, b) { return a + b; }, 0) / rates.length
      : null;
    const totalExceptions = snapshots.reduce(function (a, s) {
      return a + (Number(s.exceptions) || 0);
    }, 0);
    const periods = uniquePeriods(data);
    return {
      title: (data.meta && data.meta.title) || "Payment Control Adoption Tracker",
      asOf: (data.meta && data.meta.asOf) || (periods[periods.length - 1] || null),
      controlCount: snapshots.length,
      monthCount: periods.length,
      periods: periods,
      averageAdoption: avgRate,
      totalExceptions: totalExceptions,
      improving: snapshots.filter(function (s) { return s.popDirection === "up"; }).length,
      declining: snapshots.filter(function (s) { return s.popDirection === "down"; }).length,
      flat: snapshots.filter(function (s) { return s.popDirection === "flat"; }).length,
      snapshots: snapshots
    };
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildKpiHtml(summary) {
    const cards = [
      ["Controls tracked", String(summary.controlCount)],
      ["Months in series", String(summary.monthCount)],
      ["Latest period", summary.asOf || "—"],
      ["Average adoption", formatPercent(summary.averageAdoption)],
      ["Open exceptions", String(summary.totalExceptions)],
      ["MoM improving", String(summary.improving)]
    ];
    const inner = cards.map(function (card) {
      return (
        '<div class="kpi">' +
          "<dt>" + escapeHtml(card[0]) + "</dt>" +
          "<dd>" + escapeHtml(card[1]) + "</dd>" +
        "</div>"
      );
    }).join("\n");
    return "<dl class=\"kpis\">\n" + inner + "\n</dl>";
  }

  function monthCell(point) {
    if (!point) {
      return '<td class="empty">—</td>';
    }
    return (
      "<td>" +
        '<span class="rate">' + escapeHtml(formatPercent(point.rate)) + "</span>" +
        '<span class="exc">' + escapeHtml(String(point.exceptions)) + " exc</span>" +
      "</td>"
    );
  }

  function buildTableHtml(data) {
    const summary = datasetSummary(data);
    const periods = summary.periods;
    const head =
      "<thead><tr>" +
      "<th scope=\"col\">ID</th>" +
      "<th scope=\"col\">Control</th>" +
      "<th scope=\"col\">Owner</th>" +
      periods.map(function (p) {
        return "<th scope=\"col\">" + escapeHtml(p) + "</th>";
      }).join("") +
      "<th scope=\"col\">PoP trend</th>" +
      "</tr></thead>";

    const body = summary.snapshots.map(function (snap) {
      const byPeriod = {};
      snap.series.forEach(function (m) {
        byPeriod[m.period] = m;
      });
      const cells = periods.map(function (p) {
        return monthCell(byPeriod[p]);
      }).join("");
      const popClass = "pop pop-" + snap.popDirection;
      return (
        "<tr>" +
          '<th scope="row" class="id">' + escapeHtml(snap.id) + "</th>" +
          "<td class=\"name\">" + escapeHtml(snap.name) + "</td>" +
          "<td class=\"owner\">" + escapeHtml(snap.owner) + "</td>" +
          cells +
          '<td class="' + popClass + '">' + escapeHtml(snap.popLabel) + "</td>" +
        "</tr>"
      );
    }).join("\n");

    const caption =
      "<caption>Payment control adoption rates and exception counts by month" +
      (summary.asOf ? " (as of " + escapeHtml(summary.asOf) + ")" : "") +
      ". PoP is latest month versus prior month.</caption>";

    return (
      '<table id="adoption-table" class="metrics">\n' +
        caption + "\n" +
        head + "\n" +
        "<tbody>\n" + body + "\n</tbody>\n" +
      "</table>"
    );
  }

  function filterSnapshots(snapshots, query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return snapshots.slice();
    return snapshots.filter(function (s) {
      return (
        String(s.id).toLowerCase().indexOf(q) !== -1 ||
        String(s.name).toLowerCase().indexOf(q) !== -1 ||
        String(s.owner).toLowerCase().indexOf(q) !== -1
      );
    });
  }

  function sortSnapshots(snapshots, key, dir) {
    const sign = dir === "desc" ? -1 : 1;
    return snapshots.slice().sort(function (a, b) {
      let av = a[key];
      let bv = b[key];
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return -1 * sign;
      if (av > bv) return 1 * sign;
      return 0;
    });
  }

  return {
    POP_EPSILON: POP_EPSILON,
    adoptionRate: adoptionRate,
    exceptionRate: exceptionRate,
    formatPercent: formatPercent,
    popDelta: popDelta,
    popDirection: popDirection,
    popLabel: popLabel,
    sortedMonths: sortedMonths,
    monthRate: monthRate,
    controlSeries: controlSeries,
    uniquePeriods: uniquePeriods,
    latestSnapshot: latestSnapshot,
    datasetSummary: datasetSummary,
    buildKpiHtml: buildKpiHtml,
    buildTableHtml: buildTableHtml,
    filterSnapshots: filterSnapshots,
    sortSnapshots: sortSnapshots,
    escapeHtml: escapeHtml
  };
});
