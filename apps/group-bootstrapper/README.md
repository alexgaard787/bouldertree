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
