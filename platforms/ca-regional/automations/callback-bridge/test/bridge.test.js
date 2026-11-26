// Unit tests with mocks + a fake clock. Every number here is a fictional 555-01xx number.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createCallbackBridge } from "../src/handler.js";
import { TransientStore } from "../src/transient-store.js";
import { assertLiveReady, findVerify } from "../src/config.js";
import { redact, maskNumber, redactingLogger } from "../src/redact.js";
import { validateRequest } from "../src/validate-request.js";

const CALLER = "+15555550142";            // fictional
const exampleConfig = JSON.parse(readFileSync(new URL("../config.example.json", import.meta.url)));
const testConfig = {
  ...exampleConfig,
  tiers: exampleConfig.tiers.map((t, i) => ({ ...t, target: `+1555555010${i + 1}` })),   // fictional
  firstMeetingGuideUrl: "https://example.org/first-meeting"
};

function harness(cfg = testConfig) {
  let now = 0; let seq = 0;
  const jobs = [];
  const clock = { now: () => now };
  const scheduler = { schedule: (ms, fn) => jobs.push({ at: now + ms, fn }) };
  const advance = (ms) => {
    const end = now + ms;
    for (;;) {
      jobs.sort((a, b) => a.at - b.at);
      const j = jobs[0];
      if (!j || j.at > end) break;
      jobs.shift(); now = j.at; j.fn();
    }
    now = end;
  };
  const calls = [], texts = [], logs = [];
  const bridge = createCallbackBridge({
    config: cfg, clock, scheduler, newId: () => `req-${++seq}`,
    telephony: { bridge: (x) => calls.push({ ...x, at: now }) },
    sms: { send: (x) => texts.push({ ...x, at: now }) },
    logger: redactingLogger((e, d) => logs.push({ e, d })),
    areaName: (s) => (s === "austin-central-texas" ? "Austin" : s),
    happeningNext: () => "Tue 7:30 p.m. Bottom Line"
  });
  return { bridge, advance, calls, texts, logs, clock };
}
const req = { pathType: "seeking-recovery", alias: "Sam", areaSlug: "austin-central-texas", callbackNumber: CALLER, consent: true };

test("acknowledges immediately (well under 2s / 30s target) with 202", async () => {
  const h = harness();
  const r = await h.bridge.handle(req);
  assert.equal(r.status, 202);
  assert.ok(r.body.ackMs < 2000);
  assert.equal(h.bridge.store.size, 1);
});

test("SMS at T+5s, tier-1 voice bridge at T+15s (inside the 15-30s window)", async () => {
  const h = harness();
  await h.bridge.handle(req);
  h.advance(4999); assert.equal(h.texts.length, 0);
  h.advance(1); assert.equal(h.texts.length, 1); assert.equal(h.texts[0].to, CALLER);
  h.advance(10000);
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].tier, 1); assert.equal(h.calls[0].at, 15000);
  assert.ok(h.calls[0].at <= testConfig.timing.voiceBridgeDeadlineMs);
});

test("ladder: tier 2 at +45s with masked volunteer SMS, tier 3 at +90s with Happening Next + First Meeting guide", async () => {
  const h = harness();
  await h.bridge.handle(req);
  h.advance(15000 + 45000);
  assert.deepEqual(h.calls.map((c) => c.tier), [1, 2]);
  const vol = h.texts.find((t) => t.to === testConfig.tiers[1].target);
  assert.match(vol.body, /Sam in Austin/);
  assert.ok(!vol.body.includes("555"), "volunteer SMS must not contain the caller number");
  h.advance(45000);
  assert.deepEqual(h.calls.map((c) => c.tier), [1, 2, 3]);
  const last = h.texts.at(-1);
  assert.equal(last.to, CALLER);
  assert.match(last.body, /Bottom Line/); assert.match(last.body, /first-meeting/);
});

test("connect purges the caller number at once and stops the ladder", async () => {
  const h = harness();
  const { body } = await h.bridge.handle(req);
  h.advance(20000);
  assert.ok(h.bridge.onCallConnected(body.requestId));
  assert.equal(h.bridge.store.get(body.requestId), null);
  assert.equal(h.bridge.store.size, 0);
  h.advance(200000);
  assert.deepEqual(h.calls.map((c) => c.tier), [1]);
});

test("TTL purge when nobody connects", async () => {
  const h = harness();
  const { body } = await h.bridge.handle(req);
  h.advance(testConfig.transientTtlMs);
  assert.equal(h.bridge.store.get(body.requestId), null);
  assert.ok(h.logs.some((l) => l.e === "purge.ttl"));
});

test("TransientStore sweep removes expired entries", () => {
  let now = 0; const s = new TransientStore({ clock: { now: () => now }, ttlMs: 1000 });
  s.put("a", CALLER); now = 999; assert.equal(s.get("a"), CALLER);
  now = 1000; assert.equal(s.sweep(), 1); assert.equal(s.size, 0);
});

test("STOP cancels and purges", async () => {
  const h = harness();
  const { body } = await h.bridge.handle(req);
  h.bridge.onCancel(body.requestId);
  h.advance(200000);
  assert.equal(h.calls.length, 0); assert.equal(h.texts.length, 0);
});

test("logs never contain the full caller number", async () => {
  const h = harness();
  const { body } = await h.bridge.handle(req);
  h.advance(100000); h.bridge.onCallConnected(body.requestId);
  const all = JSON.stringify(h.logs);
  assert.ok(!all.includes("5555550142"));
  assert.equal(maskNumber(CALLER), "[redacted …42]");
  assert.equal(redact("call +1 555-555-0142 now"), "call [redacted …42] now");
});

test("request validation: no last names, no extra identity fields, consent required", () => {
  assert.deepEqual(validateRequest(req), []);
  assert.ok(validateRequest({ ...req, alias: "Sam Whitfield" }).length);
  assert.ok(validateRequest({ ...req, email: "a@example.com" }).length);
  assert.ok(validateRequest({ ...req, consent: false }).length);
  assert.ok(validateRequest({ ...req, callbackNumber: "555-0142" }).length);
});

test("400 on invalid request, nothing stored", async () => {
  const h = harness();
  const r = await h.bridge.handle({ ...req, lastName: "Whitfield" });
  assert.equal(r.status, 400); assert.equal(h.bridge.store.size, 0);
});

test("example config is all [VERIFY] and cannot go live", () => {
  assert.ok(findVerify(exampleConfig).length >= 7);
  assert.throws(() => assertLiveReady(exampleConfig), /not live-ready/);
  assert.throws(() => harness({ ...exampleConfig, live: true }), /not live-ready/);
});

test("no real-looking phone numbers or credentials in this folder", () => {
  const files = ["../README.md", "../config.example.json", "../src/handler.js", "./bridge.test.js"];
  for (const f of files) {
    const txt = readFileSync(new URL(f, import.meta.url), "utf8");
    for (const m of txt.match(/\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g) || []) {
      assert.match(m.replace(/\D/g, ""), /555\d{4}$|^1?555555/, `non-fictional number in ${f}: ${m}`);
    }
    assert.ok(!/(AC[0-9a-f]{32}|SK[0-9a-f]{32}|auth[_-]?token\s*[:=]\s*["'][^"'[]+["'])/i.test(txt), `credential-like string in ${f}`);
  }
});
