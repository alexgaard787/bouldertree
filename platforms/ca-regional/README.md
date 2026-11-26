# platforms/ca-regional

Placeholder for the **CA Regional Website & Service** (Drive folder `02 - CA Regional Website & Service`) site, flyer tools, and World Service materials.

This directory is the home for CAWS-aligned regional website work:

- Two-section layout: Seekers/Newcomers/Aftercare vs. Group Empowerment/Unity/World Service
- Flyer upload, full-page viewer, download, and print flow
- Group Struggles & Website Ideas form
- August 2027 World Conference room-block card (facts still `[VERIFY]` until official details are confirmed)

Planned files from the BoulderTree Architecture document (not created yet):

- `caws-compliance.md`
- `dual-section-architecture.md`
- `flyers-and-group-ux.md`
- `world-conference-2027/room-block-card.md`

Do not add Sponsorship Course (`01`) or Plum Creek Recovery Ranch (`03`) content here. Local group forks are configured under `apps/group-bootstrapper/`, not in this folder.

## Southwest Region prototype (added 2026-11-26)

- `southwest/bottom-line-club-101/index.html`: Prototype V1, a single self-contained page (no build step, no network requests, `noindex` until launch). It has a sticky Need Help Now / Happening Next bar, Section A (meeting details, First Meeting? What to Expect, Southwest area quick-links, aftercare and family pointers), and Section B (full-page flyer lightbox with Download and a print-ready sheet, chair upload preview, Group Struggles & Website Ideas form, Aug 2027 conference card with an anonymous Booked / Planning toggle and .ics reminder, Group Bootstrapper preview, and privacy-first segmented metrics stubs).
- Its `<head>` JSON-LD is generated from `apps/group-bootstrapper/examples/bottom-line-club-101.v2.json` with `validate-group-config.js --inject`, and the page regenerates it in the browser from the embedded group.json.
- All hotline, address, timezone, Zoom, booking, and area-hub values are `[VERIFY]` placeholders.
