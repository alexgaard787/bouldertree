# Group bootstrapper

Config-driven local-group site forks for the CA Regional template.

- `schema/group-config.schema.json` — JSON Schema (Draft 2020-12) for a group fork config
- `examples/bottom-line-club-101.json` — **sample only**; schedule, timezone, hybrid/Zoom, address, and links are `[VERIFY]`
- `scripts/validate.mjs` — validates every `examples/*.json` file against the schema and exits nonzero on failure

```bash
npm ci
npm test
```

Anonymity rules enforced by the schema:

- `additionalProperties` is false
- No fields for person names, personal phone numbers, or personal email addresses
- The only optional contact fields are `groupServiceEmail` and `groupServiceUrl` (a group service address or page, not an individual)
- Public string fields reject embedded personal emails and phone-number patterns
- Link fields accept only `http(s)` URLs or the literal `[VERIFY]` placeholder (`tel:`, `sms:`, and `mailto:` are not allowed)

## Harness V1: `scripts/validate-group-config.js` (added 2026-11-26)

Validates one `group.json` against the schema, then runs Traditions guardrails and emits Organization + Event JSON-LD.

```bash
npm ci
node scripts/validate-group-config.js examples/bottom-line-club-101.v2.json            # report on stderr, JSON-LD on stdout
node scripts/validate-group-config.js examples/bottom-line-club-101.v2.json --out group.jsonld.json
node scripts/validate-group-config.js examples/bottom-line-club-101.v2.json \
  --inject ../../platforms/ca-regional/southwest/bottom-line-club-101/index.html      # rewrite the <head> JSON-LD block
node scripts/validate-group-config.js <file> --strict-verify                         # treat [VERIFY] as errors (launch gate)
npm run test:harness                                                                 # examples must pass, fixtures/bad-*.json must fail
```

- **Exit codes:** `0` valid (warnings allowed), `1` schema or guardrail errors (no JSON-LD emitted), `2` usage or I/O error.
- **Anonymity (Traditions Eleven & Twelve):** blocks denylisted field names (`lastName`, `phone`, `personalEmail`, `contactName`, ...), capitalized two-word person-name patterns in name/contact/label fields (warnings elsewhere), phone numbers, and emails outside `groupServiceEmail`.
- **Commercial links (Traditions Six & Seven):** blocks denylisted domains (shops, payment links, URL shorteners, treatment/rehab/detox hosts) and affiliate, `utm_`, `ref=`, and `/shop` style URLs. Allows `zoom.us`, `ca.org`, and the group's own site; any other host is a warning (`--allow-host` to approve, for example the official conference hotel once confirmed).
- **`[VERIFY]`:** every unconfirmed value is a warning; `--strict-verify` makes them errors. `[VERIFY]` values are never written into JSON-LD.
- **JSON-LD mapping:** `hybrid` → `MixedEventAttendanceMode`, `in-person` → `OfflineEventAttendanceMode`, `online` → `OnlineEventAttendanceMode`; `isAccessibleForFree: true` on every Event (Tradition Seven, no dues or fees).

Schema v1.1.0 is additive and backward compatible: `examples/bottom-line-club-101.json` (1.0.0) still validates unchanged. New optional fields: `fellowship`, `region`, `area`, `areaSlug`, `venueLocality`, `traditionsCompliance`, `worldConference2027`, `meetings[].durationMinutes`, `links.areaHub`.

`examples/bottom-line-club-101.v2.json` carries the details the group confirmed (Tuesdays 7:30 p.m., hybrid In-Person + Zoom, open format, no pressure to speak, 7th Tradition self-supporting). Timezone, street address, Zoom link, and all URLs stay `[VERIFY]`.
