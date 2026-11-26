#!/usr/bin/env node
// Tests for archive-flyers.js: past events move to archive[], future and [VERIFY] stay, idempotent,
// output still validates against data/schema/flyers.schema.json, and the CLI writes nothing on --dry-run.
"use strict";
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { archiveFlyers } = require("./archive-flyers.js");

const dataDir = path.join(__dirname, "..", "data");
const nm = path.join(__dirname, "..", "..", "..", "apps", "group-bootstrapper", "node_modules");
const Ajv2020 = require(path.join(nm, "ajv", "dist", "2020.js")).default;
const addFormats = require(path.join(nm, "ajv-formats")).default;
const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
addFormats(ajv);
ajv.addSchema(JSON.parse(fs.readFileSync(path.join(dataDir, "schema", "common.defs.json"), "utf8")));
const validate = ajv.compile(JSON.parse(fs.readFileSync(path.join(dataDir, "schema", "flyers.schema.json"), "utf8")));

const base = (id, end) => ({ id, source: "regional-council", title: `Flyer ${id}`, category: "Other", eventDate: "[VERIFY]", eventEndDate: end, alt: "Placeholder", placeholder: { heading: "X", subheading: "Y", color: "#00594F" } });
const feed = { schemaVersion: "1.0.0", isSample: true, items: [base("past-a", "2026-11-01"), base("past-b", "2026-11-20"), base("today", "2026-11-26"), base("future", "2027-08-31"), base("unknown", "[VERIFY]")], archive: [] };

test("moves only real past dates, newest first", () => {
  const { feed: out, moved } = archiveFlyers(feed, "2026-11-26");
  assert.deepEqual(moved.sort(), ["past-a", "past-b"]);
  assert.deepEqual(out.items.map((f) => f.id), ["today", "future", "unknown"]);
  assert.deepEqual(out.archive.map((f) => f.id), ["past-b", "past-a"]);
  assert.ok(out.archive.every((f) => f.archivedOn === "2026-11-26"));
  assert.ok(validate(out), JSON.stringify(validate.errors));
});

test("is idempotent", () => {
  const once = archiveFlyers(feed, "2026-11-26").feed;
  const twice = archiveFlyers(once, "2026-11-26");
  assert.deepEqual(twice.moved, []);
  assert.deepEqual(twice.feed, once);
});

test("rejects a malformed --today", () => {
  assert.throws(() => archiveFlyers(feed, "11/26/2026"));
});

test("committed data/flyers.json validates and has an eventEndDate on every flyer", () => {
  const real = JSON.parse(fs.readFileSync(path.join(dataDir, "flyers.json"), "utf8"));
  assert.ok(validate(real), JSON.stringify(validate.errors));
  assert.ok(real.items.every((f) => "eventEndDate" in f));
});

test("CLI --dry-run writes nothing; real run writes the archive", () => {
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "flyers-")), "flyers.json");
  fs.writeFileSync(tmp, JSON.stringify(feed));
  const cli = path.join(__dirname, "archive-flyers.js");
  const dry = spawnSync(process.execPath, [cli, "--file", tmp, "--today", "2026-11-26", "--dry-run"], { encoding: "utf8" });
  assert.equal(dry.status, 0);
  assert.equal(JSON.parse(fs.readFileSync(tmp, "utf8")).archive.length, 0);
  const real = spawnSync(process.execPath, [cli, "--file", tmp, "--today", "2026-11-26"], { encoding: "utf8" });
  assert.equal(real.status, 0);
  assert.equal(JSON.parse(real.stdout).moved.length, 2);
  assert.equal(JSON.parse(fs.readFileSync(tmp, "utf8")).archive.length, 2);
});
