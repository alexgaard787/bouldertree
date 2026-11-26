#!/usr/bin/env node
// Blueprint Automation #10: roll up exported "ca-service-metrics" files (from the
// site's "Download monthly counts" button) into Monthly Snapshot rows for the
// Regional Council. Two segments only. Rejects anything that isn't a plain
// event-name -> integer count, so no names, IPs, IDs, or timestamps get through.
// The Monthly Snapshot sheet/endpoint is [VERIFY]; this prints rows only.
"use strict";
const fs = require("node:fs");

const SEGMENTS = ["People Seeking Recovery", "People Active in the C.A. Sphere"];
const EVENT = /^[a-z][a-z0-9_-]{0,40}$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const SCOPE = /^(region|group:[a-z0-9]+(-[a-z0-9]+)*)$/;

function rollup(exportsList) {
  const totals = {};   // month -> segment -> event -> n
  const rejected = [];
  for (const ex of exportsList) {
    if (!ex || ex.kind !== "ca-service-metrics" || typeof ex.months !== "object") { rejected.push("not a ca-service-metrics export"); continue; }
    for (const [month, scopes] of Object.entries(ex.months)) {
      if (!MONTH.test(month)) { rejected.push(`bad month ${month}`); continue; }
      for (const [scope, segs] of Object.entries(scopes || {})) {
        if (!SCOPE.test(scope)) { rejected.push(`bad scope`); continue; }
        for (const [seg, events] of Object.entries(segs || {})) {
          if (!SEGMENTS.includes(seg)) { rejected.push(`unknown segment`); continue; }
          for (const [ev, n] of Object.entries(events || {})) {
            if (!EVENT.test(ev) || !Number.isInteger(n) || n < 0) { rejected.push(`rejected entry in ${month}/${seg}`); continue; }
            ((totals[month] ??= {})[seg] ??= {})[ev] = (totals[month][seg][ev] || 0) + n;
          }
        }
      }
    }
  }
  const rows = [];
  for (const month of Object.keys(totals).sort()) {
    for (const seg of SEGMENTS) {
      const ev = totals[month][seg] || {};
      rows.push({ month, segment: seg, total: Object.values(ev).reduce((a, b) => a + b, 0), events: Object.fromEntries(Object.entries(ev).sort()) });
    }
  }
  return { rows, rejected };
}

module.exports = { rollup, SEGMENTS };

if (require.main === module) {
  const files = process.argv.slice(2);
  if (!files.length) { console.error("usage: metrics-rollup.js <export.json> [...]"); process.exit(2); }
  const out = rollup(files.map((f) => JSON.parse(fs.readFileSync(f, "utf8"))));
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.rejected.length ? 1 : 0);
}
