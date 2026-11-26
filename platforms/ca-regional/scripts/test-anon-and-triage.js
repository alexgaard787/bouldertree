#!/usr/bin/env node
// Unit tests for the shared flyer anonymity scanner and the Group Struggles triage router.
// Fixture files are synthesized in memory; names/emails/numbers are fictional (example.com, 555-01xx).
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const { test } = require("node:test");
const scan = require("../templates/shared/anon-scan.js");
const triage = require("../templates/shared/triage.js");

const enc = (s) => Uint8Array.from(Buffer.from(s, "latin1"));
const pdf = (info) => enc(`%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\n2 0 obj << ${info} >> endobj\ntrailer << /Info 2 0 R >>\n%%EOF`);
function jpegWithApp1(text) {
  const payload = Buffer.concat([Buffer.from("Exif\0\0MM\0*", "latin1"), Buffer.from(text, "latin1")]);
  const len = payload.length + 2;
  return Uint8Array.from(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe1, len >> 8, len & 255]), payload, Buffer.from([0xff, 0xda, 0, 2, 0xff, 0xd9])]));
}
function pngWithText(key, val) {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const t = Buffer.from(type, "latin1"); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 0;
  return Uint8Array.from(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("tEXt", Buffer.from(`${key}\0${val}`, "latin1")), chunk("IDAT", zlib.deflateSync(Buffer.from([0, 0]))), chunk("IEND", Buffer.alloc(0))]));
}

test("clean flyer passes with no block/warn", () => {
  const r = scan.scanFlyer({ name: "unity-day-2027.pdf", type: "application/pdf", bytes: pdf("/Title (Unity Day) /Producer (Canva)"), typedText: "Unity Day Austin / Central Texas" });
  assert.deepEqual(r.block, []); assert.deepEqual(r.warn, []);
});
test("phone number in file name blocks", () => {
  const r = scan.scanFlyer({ name: "call-512-555-0142.png", type: "image/png", typedText: "" });
  assert.equal(r.block.length, 1);
});
test("name in typed title blocks", () => {
  const r = scan.scanFlyer({ name: "flyer.png", type: "image/png", typedText: "Speaker Jordan Whitfield" });
  assert.match(r.block.join(" "), /full name/);
});
test("PDF /Author with a full name warns; with an email blocks", () => {
  const w = scan.scanFlyer({ name: "f.pdf", type: "application/pdf", bytes: pdf("/Author (Jordan Whitfield)"), typedText: "" });
  assert.match(w.warn.join(" "), /pdf:Author/);
  const b = scan.scanFlyer({ name: "f.pdf", type: "application/pdf", bytes: pdf("/Author (chair.person@example.com)"), typedText: "" });
  assert.match(b.block.join(" "), /pdf:Author/);
});
test("JPEG EXIF strings with an email block", () => {
  const r = scan.scanFlyer({ name: "photo.jpg", type: "image/jpeg", bytes: jpegWithApp1("\0\0Artist\0chair.person@example.com\0"), typedText: "" });
  assert.match(r.block.join(" "), /jpeg:strings/);
});
test("PNG tEXt Author with a full name warns", () => {
  const r = scan.scanFlyer({ name: "f.png", type: "image/png", bytes: pngWithText("Author", "Jordan Whitfield"), typedText: "" });
  assert.match(r.warn.join(" "), /png:text/);
});
test("SVG visible text with a phone number blocks", () => {
  const r = scan.scanFlyer({ name: "f.svg", type: "image/svg+xml", bytes: enc('<svg xmlns="http://www.w3.org/2000/svg"><text>Call 512-555-0142</text></svg>'), typedText: "" });
  assert.match(r.block.join(" "), /svg:text/);
});

// ---- triage + payload schema
const nm = path.join(__dirname, "..", "..", "..", "apps", "group-bootstrapper", "node_modules");
const Ajv2020 = require(path.join(nm, "ajv", "dist", "2020.js")).default;
const addFormats = require(path.join(nm, "ajv-formats")).default;
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const sdir = path.join(__dirname, "..", "data", "schema");
ajv.addSchema(JSON.parse(fs.readFileSync(path.join(sdir, "common.defs.json"), "utf8")));
const validate = ajv.compile(JSON.parse(fs.readFileSync(path.join(sdir, "struggles-payload.schema.json"), "utf8")));

test("flyer topic routes to the Internet Chair; urgency kept; payload validates", () => {
  const p = triage.triage({ scope: "group:bottom-line-club-101", groupOrArea: "Bottom Line (Austin / Central Texas)", topics: ["flyers"], details: "Flyers are hard to print from phones.", urgency: "soon", followUp: "internet-chair", month: "2026-11" });
  assert.equal(p.routing.primary, "internet-chair");
  assert.equal(p.urgency, "soon");
  assert.ok(validate(p), JSON.stringify(validate.errors));
});
test("multi-topic fan-out and council log fallback", () => {
  const p = triage.triage({ topics: ["directory", "unity"], details: "", urgency: "urgent", followUp: "no-reply", month: "2026-11" });
  assert.deepEqual(p.routing.all, ["internet-chair", "hotline-hi-pi", "unity-area-liaisons"]);
  assert.equal(p.routing.replyRequested, false);
  const q = triage.triage({ topics: [], details: "Just flagging.", followUp: "no-reply", month: "2026-11" });
  assert.deepEqual(q.routing.all, ["council-service-log"]);
  assert.ok(validate(p) && validate(q));
});
test("payload schema rejects identity fields and contact details", () => {
  const p = triage.triage({ topics: ["other"], details: "ok", followUp: "no-reply", month: "2026-11" });
  assert.equal(validate({ ...p, name: "Jordan" }), false);
  assert.equal(validate({ ...p, email: "a@example.com" }), false);
  assert.equal(validate({ ...p, details: "call 512-555-0142" }), false);
  assert.equal(validate({ ...p, ip: "203.0.113.5" }), false);
});
test("unknown urgency/follow-up/topics are normalized, not passed through", () => {
  const p = triage.triage({ topics: ["hack", "flyers"], urgency: "panic", followUp: "ceo", details: "x", month: "2026-11" });
  assert.deepEqual(p.topics, ["flyers"]); assert.equal(p.urgency, "routine"); assert.equal(p.followUp, "no-reply");
  assert.ok(validate(p));
});
