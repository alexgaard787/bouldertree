#!/usr/bin/env node
// Harness self-test: the Bottom Line examples must PASS and emit valid Organization + Event JSON-LD;
// every fixture under fixtures/bad-*.json must FAIL with exit code 1.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const harness = join(root, "scripts", "validate-group-config.js");
const run = (file) => spawnSync(process.execPath, [harness, file, "--quiet"], { encoding: "utf8" });
let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? "ok  " : "FAIL"} ${msg}`); if (!ok) failures++; };

for (const ex of readdirSync(join(root, "examples")).filter((f) => f.endsWith(".json")).sort()) {
  const r = run(join(root, "examples", ex));
  check(r.status === 0, `examples/${ex} exits 0 (got ${r.status})`);
  let ld;
  try { ld = JSON.parse(r.stdout); } catch { ld = null; }
  check(ld && ld["@context"] === "https://schema.org", `examples/${ex} JSON-LD parses with schema.org @context`);
  const types = (ld?.["@graph"] ?? []).map((n) => n["@type"]);
  check(types[0] === "Organization", `examples/${ex} first node @type Organization`);
  check(types.slice(1).length >= 1 && types.slice(1).every((t) => t === "Event"), `examples/${ex} meeting node(s) @type Event`);
  check(!JSON.stringify(ld).includes("[VERIFY]"), `examples/${ex} JSON-LD contains no [VERIFY] placeholders`);
}
for (const fx of readdirSync(join(root, "fixtures")).filter((f) => /^bad-.*\.json$/.test(f)).sort()) {
  const r = run(join(root, "fixtures", fx));
  check(r.status === 1, `fixtures/${fx} exits 1 (got ${r.status})`);
  check(r.stdout.trim() === "", `fixtures/${fx} emits no JSON-LD`);
}
if (failures) { console.error(`${failures} harness check(s) failed`); process.exit(1); }
console.log("All harness checks passed.");
