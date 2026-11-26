#!/usr/bin/env node
/**
 * archive-flyers.js — Blueprint Automation #6 (post-event automatic flyer archival).
 * Moves flyers whose eventEndDate is a real date before --today from items[] to archive[]
 * (newest first, with archivedOn). Flyers with eventEndDate "[VERIFY]" stay active.
 * Idempotent. Pure JSON in/out; no network.
 *
 * Usage: node platforms/ca-regional/scripts/archive-flyers.js [--file data/flyers.json] [--today YYYY-MM-DD] [--dry-run]
 * Default --today: today's date in America/Chicago [VERIFY regional timezone].
 * After a real run, rebuild the site and forks (npm run build in apps/group-bootstrapper).
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function todayIn(tz) {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function archiveFlyers(feed, today) {
  if (!DATE.test(today)) throw new Error(`--today must be YYYY-MM-DD, got ${today}`);
  const keep = [], moved = [];
  for (const f of feed.items || []) {
    if (typeof f.eventEndDate === "string" && DATE.test(f.eventEndDate) && f.eventEndDate < today) moved.push({ ...f, archivedOn: today });
    else keep.push(f);
  }
  const archive = [...moved, ...(feed.archive || [])].sort((a, b) => (b.eventEndDate || "").localeCompare(a.eventEndDate || ""));
  return { feed: { ...feed, items: keep, archive }, moved: moved.map((f) => f.id) };
}

function main(argv) {
  const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const file = path.resolve(arg("--file", path.join(__dirname, "..", "data", "flyers.json")));
  const today = arg("--today", todayIn("America/Chicago"));
  const check = argv.includes("--check");   // CI: fail (exit 1) if any flyer is due, write nothing
  const dry = argv.includes("--dry-run") || check;
  const feed = JSON.parse(fs.readFileSync(file, "utf8"));
  const { feed: out, moved } = archiveFlyers(feed, today);
  if (!dry && moved.length) fs.writeFileSync(file, `${JSON.stringify(out, null, 2)}\n`);
  console.log(JSON.stringify({ file: path.relative(process.cwd(), file), today, moved, active: out.items.length, archived: out.archive.length, dryRun: dry }));
  if (check && moved.length) { console.error("archive-flyers: past-event flyers are due. Run `npm run archive:flyers && npm run build` and commit."); return 1; }
  return 0;
}

module.exports = { archiveFlyers, todayIn };
if (require.main === module) process.exit(main(process.argv.slice(2)));
