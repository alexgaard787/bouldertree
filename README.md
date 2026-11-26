# BoulderTree

BoulderTree is a monorepo for **Cocaine Anonymous World Service (CAWS)-aligned** regional website work, local group fork templates, and related service tools.

This repository exists so coding and research agents can work from a single layout without mixing fellowship domains. Live rosters, personal contact details, and private records stay out of this repository to protect anonymity (Traditions Eleven and Twelve). Public pages operate on attraction rather than promotion (Tradition Eleven), keep C.A. self-supporting and separate from outside enterprises (Traditions Six and Seven), and stay focused on recovery without outside controversy (Tradition Ten).

**Current work in this repository is limited to CA Regional Website & Service (Drive folder `02`).** Other domains from the planned layout are listed below so their paths stay reserved, but their content is not present and must not be added in a CA Regional change.

## Domain boundaries (never mix)

1. **Sponsorship & Sponsee Course** (Drive folder `01`) — reserved under `apps/perception-surrender-mirror/` and `curricula/walking-in-the-spirit/`. Not created in this commit.
2. **CA Regional Website & Service** (Drive folder `02`) — `platforms/ca-regional/` and `apps/group-bootstrapper/`. This is the only domain with files today.
3. **Plum Creek Recovery Ranch** (Drive folder `03`) — reserved under `platforms/plum-creek/`. Not created in this commit. Do not add treatment, admissions, or HIPAA/42 CFR Part 2 materials to CA Regional paths.

## Planned layout

From the Drive document *BoulderTree — GitHub Repository Architecture* (folder `02 - CA Regional Website & Service`). Paths marked **present** exist in this repository. Paths marked **planned, not created** are reserved only.

```
bouldertree/
├── README.md                                  # Repo overview, agent handover rules, & traditions/privacy boundaries
├── CONTRIBUTING.md                            # planned, not created — How group chairs, committee leads, & AI agents propose updates
│
├── apps/
│   ├── perception-surrender-mirror/           # planned, not created — Interactive app & universal/curriculum reflection tools
│   │   ├── index.html
│   │   ├── flows/
│   │   │   ├── surrender-directors-chair.md
│   │   │   ├── perception-lens.md
│   │   │   └── faith-trust-posture.md
│   │   └── prompts/
│   │       ├── three-pillar-mirror.md
│   │       └── universal-facebook-quiz.md
│   │
│   └── group-bootstrapper/                    # present — Conversational local-group site fork generator
│       ├── bootstrap-flow.md                  # planned, not created
│       ├── schema/
│       │   └── group-config.schema.json       # present — Validation schema for group.json forks
│       └── examples/
│           └── bottom-line-club-101.json      # present — Sample config only; unverified facts are "[VERIFY]"
│
├── platforms/
│   ├── ca-regional/                           # present — CA Regional Council website, flyers, group tools & outreach
│   │   ├── caws-compliance.md                 # planned, not created
│   │   ├── dual-section-architecture.md       # planned, not created
│   │   ├── flyers-and-group-ux.md             # planned, not created
│   │   └── world-conference-2027/
│   │       └── room-block-card.md             # planned, not created
│   │
│   └── plum-creek/                            # planned, not created — do not add in CA Regional work
│       ├── local-seo-and-schema.md
│       ├── crisis-and-webhook-bridge.md
│       └── family-experience-portal.md
│
├── curricula/
│   └── walking-in-the-spirit/                 # planned, not created — do not add in CA Regional work
│       ├── living-curriculum.md
│       └── curriculum-companion.md
│
├── ai-distillation/                           # planned, not created
│   ├── distillation-blueprint.md
│   └── prompts/
│       ├── plum-creek-assistant.md
│       └── ca-regional-assistant.md
│
└── docs/                                      # planned, not created
    ├── drive-sync-map.md
    └── anonymity-and-compliance-checklist.md
```

## Group fork configs

Local groups use a `group.json` configuration validated against `apps/group-bootstrapper/schema/group-config.schema.json`. The Architecture document describes this as a lightweight, config-driven fork (for example, a *Bottom Line at Club 101* sample).

Unverified meeting times, timezones, addresses, attendance/Zoom details, and URLs must use the literal placeholder `[VERIFY]`. Do not invent contact details, meeting times, or external URLs. Do not commit person names, personal phone numbers, or personal email addresses. The only allowed contact fields are an optional group service email and/or group service URL.

Validate every example:

```bash
cd apps/group-bootstrapper
npm ci
npm test
```

A GitHub Actions workflow at `.github/workflows/validate-group-configs.yml` runs the same check on `main`.

## Source documents (Drive folder `02`)

Planning docs live in Google Drive folder `02 - CA Regional Website & Service`. This first commit implements only the group-config schema, a marked sample, and the validation harness. Later CA Regional builds (flyer viewer, Group Struggles form, August 2027 conference card) belong under `platforms/ca-regional/`.
