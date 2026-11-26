# After-hours hotline callback bridge: SPEC + STUB ONLY

> **Not live. No telephony provider is connected, and none is chosen.** Every phone number, provider, hour, and URL is `[VERIFY]`.
> **Never commit a real phone number or credential to this repo.** Real values go only in the hosting platform's secret store, after the Southwest Region's Hotline committee and Regional Council approve them `[VERIFY]`.

Source: *CA Regional Website — Webhooks, Automations & Service Workflows Blueprint* (folder 02), Webhook #1 (after-hours callback) and Workflow #2 (3-tier fallback ladder). The Blueprint puts this work in **Phase 2**, after Phase 1 (#5–#8: flyer intake, archival, triage, conference).

## What it does

Someone who reaches the site after hours can ask for a callback instead of waiting. A volunteer's phone is bridged to them, so neither side sees the other's number. The caller's number is deleted when the call connects, when the caller cancels, or when the TTL runs out.

| When (from the POST) | Step |
|---|---|
| T+0–2 s | Website POSTs `{pathType, alias?, areaSlug, callbackNumber, consent}` ([schema](callback-request.schema.json)). The handler answers `202` and holds the number in an expiring store. |
| T+5 s | SMS to the caller: "A volunteer will call you back shortly. Reply STOP to cancel." |
| T+15–30 s | Voice bridge starts the ladder (stub fires at T+15 s, so it lands inside the < 30 s target). |
| Ladder 0–45 s | **Tier 1**: primary hotline / volunteer rotation `[VERIFY]` |
| Ladder 45–90 s | **Tier 2**: secondary area volunteer `[VERIFY]`, plus a masked SMS to that volunteer with the caller's first name/alias and city only. |
| Ladder 90 s+ | **Tier 3**: 24/7 backup `[VERIFY]`, plus an SMS to the caller with the nearest Happening Next meeting and the First Meeting guide link `[VERIFY]`. |
| Connected / STOP / TTL | The caller number is purged right away; the TTL (example 1 h, `[VERIFY]`) is the backstop. |

## Data minimization (Traditions 11 & 12, CAWS anonymity)

- Request fields are an allowlist. Extra fields (last name, email, notes, IP, device ID) are rejected with a `400`, and nothing is stored.
- `alias` must be one word, so a last name can't be sent.
- The caller's number lives only in the transient store. It is never written to logs: `redactingLogger` masks every number to `[redacted …NN]`.
- Volunteer numbers are passed to the telephony adapter as bridge targets and are never shown to the caller.
- The website stays non-commercial and self-supporting (Traditions 6 & 7): no CRM, ad, or analytics SDK. The telephony/SMS vendor is a utility under a paid account `[VERIFY]` and is not named or endorsed on the public site.

## Files

| Path | Purpose |
|---|---|
| `config.example.json` | Shape of the real config. Every value that matters is `[VERIFY]`; `"live": false`. |
| `callback-request.schema.json` | JSON Schema for the POST body. |
| `src/handler.js` | `createCallbackBridge({config, telephony, sms, scheduler, clock, newId, logger, areaName, happeningNext})` → `{handle, onCallConnected, onCancel, sweep}`. All side effects go through injected adapters. |
| `src/transient-store.js` | Expiring in-memory store, with purge and sweep. |
| `src/config.js` | `assertLiveReady(config)`: throws while any `[VERIFY]` remains or the tier count isn't 3. The handler calls it whenever `live: true`. |
| `src/redact.js` | Number masking for logs. |
| `src/validate-request.js` | Dependency-free validator that mirrors the schema. |
| `test/bridge.test.js` | `node:test` with a fake clock, scheduler, telephony, and SMS. Covers ack time, the 5 s SMS, the 15 s bridge, the 45/90 s ladder, masked SMS, purge on connect, TTL, and STOP; redaction, validation, and the live-ready guard; and a scan proving this folder has only fictional 555-01xx numbers and no credentials. |

Run: `npm test` (from this folder) or `npm run test:bridge` (from `apps/group-bootstrapper`). CI runs it on every push.

## Before going live (all `[VERIFY]`)

1. The Hotline committee and Regional Council approve the service, the after-hours window, and the volunteer rotation.
2. Choose a telephony/SMS provider that supports number masking (proxy) and a 10DLC/toll-free registration; write the adapters.
3. Use an expiring server-side store (TTL ≤ the value above) with no backups of caller numbers.
4. Put the tier targets in secrets, never in the repo, then set `live: true`. `assertLiveReady` must pass.
5. Add the callback button to the help card (right now it shows "planned, not live yet").
