#!/usr/bin/env node
// Generator self-test: v2 example must produce a complete fork that inherits regional news + flyers;
// every bad config must produce NO output; hand-made folders must never be overwritten.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(root, "..", "..");
const gen = join(root, "scripts", "bootstrap-group.js");
const out = mkdtempSync(join(tmpdir(), "bt-forks-"));
const run = (file, extra = []) => spawnSync(process.execPath, [gen, file, "--out-root", out, ...extra], { encoding: "utf8" });
let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? "ok  " : "FAIL"} ${msg}`); if (!ok) failures++; };

// Good config
const good = run(join(root, "examples", "bottom-line-club-101.v2.json"));
check(good.status === 0, `v2 example generates a fork (exit ${good.status})`);
const dir = join(out, "bottom-line-club-101");
for (const f of ["index.html", "group.json", "group.jsonld.json", "fork.manifest.json"]) check(existsSync(join(dir, f)), `fork has ${f}`);
const html = existsSync(join(dir, "index.html")) ? readFileSync(join(dir, "index.html"), "utf8") : "";
const ldText = (html.match(/<script type="application\/ld\+json" id="group-jsonld">([\s\S]*?)<\/script>/) || [])[1];
let ld = null; try { ld = JSON.parse(ldText); } catch {}
check(ld && ld["@graph"]?.[0]?.["@type"] === "Organization" && ld["@graph"].slice(1).every((n) => n["@type"] === "Event") && ld["@graph"].length >= 2, "fork <head> JSON-LD parses: Organization + Event");
check(ld && !JSON.stringify(ld).includes("[VERIFY]"), "fork JSON-LD has no [VERIFY] values");
const news = JSON.parse(readFileSync(join(repo, "platforms", "ca-regional", "data", "news.json"), "utf8"));
const flyers = JSON.parse(readFileSync(join(repo, "platforms", "ca-regional", "data", "flyers.json"), "utf8"));
check(news.items.every((n) => html.includes(n.title.replace(/&/g, "&amp;").replace(/:/g, ":"))), `fork inherits all ${news.items.length} regional/world news items`);
check(flyers.items.every((f) => html.includes(`data-title="${f.title}"`)), `fork inherits all ${flyers.items.length} regional/world flyers`);
check(/Every Tuesday, 7:30 p\.m\./.test(html) && /In-Person \+ Zoom|on Zoom/.test(html), "fork shows the group's own meeting (Tuesday 7:30 p.m., hybrid)");
check(html.includes('id="conference"'), "fork includes the inherited Aug 2027 conference card");
// Determinism
const again = run(join(root, "examples", "bottom-line-club-101.v2.json"), ["--check"]);
check(again.status === 0, "regeneration is deterministic (--check passes)");

// Bad configs: no output at all
const bad = [
  join(root, "examples", "bottom-line-club-101.json"),
  ...readdirSync(join(root, "fixtures")).filter((f) => /bad.*\.json$/.test(f)).map((f) => join(root, "fixtures", f)),
];
for (const file of bad) {
  const before = readdirSync(out).sort().join(",");
  const r = run(file);
  check(r.status === 1, `${file.split("/").slice(-2).join("/")} is rejected (exit ${r.status})`);
  check(readdirSync(out).sort().join(",") === before, `${file.split("/").slice(-2).join("/")} wrote nothing`);
}

// Never overwrite a hand-made folder
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir); writeFileSync(join(dir, "index.html"), "hand-made");
const clobber = run(join(root, "examples", "bottom-line-club-101.v2.json"));
check(clobber.status !== 0 && readFileSync(join(dir, "index.html"), "utf8") === "hand-made", "refuses to overwrite a folder without fork.manifest.json");

rmSync(out, { recursive: true, force: true });
if (failures) { console.error(`${failures} generator check(s) failed`); process.exit(1); }
console.log("All generator checks passed.");
