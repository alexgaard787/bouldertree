#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const { test } = require("node:test");
const { rollup, SEGMENTS } = require("./metrics-rollup.js");

const ex = (months) => ({ schemaVersion: "1.0.0", kind: "ca-service-metrics", months });
test("labels are exactly the two Blueprint segments", () => {
  assert.deepEqual(SEGMENTS, ["People Seeking Recovery", "People Active in the C.A. Sphere"]);
});
test("sums region + group exports per month and segment", () => {
  const a = ex({ "2026-11": { region: { "People Seeking Recovery": { hotline_click: 2 }, "People Active in the C.A. Sphere": { flyer_download: 1 } } } });
  const b = ex({ "2026-11": { "group:bottom-line-club-101": { "People Seeking Recovery": { hotline_click: 1, area_view: 4 }, "People Active in the C.A. Sphere": {} } } });
  const { rows, rejected } = rollup([a, b]);
  assert.deepEqual(rejected, []);
  assert.deepEqual(rows[0], { month: "2026-11", segment: "People Seeking Recovery", total: 7, events: { area_view: 4, hotline_click: 3 } });
  assert.equal(rows[1].total, 1);
});
test("rejects identity-looking keys, values, and unknown segments", () => {
  const bad = ex({ "2026-11": { region: {
    "People Seeking Recovery": { "jordan@example.com": 1, ip_203_0_113_5: "x", hotline_click: 1.5 },
    "Visitors by IP": { a: 1 } } } });
  const { rows, rejected } = rollup([bad]);
  assert.equal(rejected.length, 4);
  assert.equal(rows.length, 0);
});
