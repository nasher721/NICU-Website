---
title: Neuro ICU Wiki Enhancement and Campus Expansion
date: 2026-07-24
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
origin: Existing dual-campus Cleveland Clinic Neurocritical Care Faculty Wiki; prior validated design in .specs/plans/hospital-wikis-layered-search.design.md
---

# Neuro ICU Wiki Enhancement and Campus Expansion

## Goal Capsule

Prepare the Cleveland Clinic Neurocritical Care Faculty Wiki to grow from orientation-handbook publication into a durable, campus-aware neuro ICU knowledge base for Main Campus and Akron General—without inventing clinical answers, splitting into two sites, or losing source provenance.

Authority hierarchy:

1. Named human clinical/operational review for any pathway, contact, policy, or Epic-facing language
2. Validated product decisions in `.specs/plans/hospital-wikis-layered-search.design.md`
3. Existing release gates in `docs/release-quality-gates.md` and `npm test`
4. This plan

Stop conditions:

- Do not add AI-generated clinical guidance
- Do not create a second independently maintained site
- Do not silently overwrite campus-specific pathways with shared text
- Do not treat automated tests as clinical approval
- Do not expand until Main Campus source contamination is remediated or explicitly quarantined

Execution profile: phased platform work first (trust, content model, IA), then content growth waves; clinical copy arrives only through reviewed sources.

Tail ownership: platform/content engineering owns schema, routing, search, and contribution tooling; named faculty reviewers own campus truth and topic approval.

## Product Contract

### Summary

The site already publishes 2026 faculty orientation handbooks for Main Campus (`/main-campus`) and Akron General (`/akron`) with layered search, Wikipedia-style campus homes, and strong release gates. The next product step is to make that dual-campus shell **expansion-ready**: trustworthy campus separation, a topic taxonomy beyond Parts 1–9 orientation chapters, a contribution path for new neuro ICU material, and UX that scales as the catalog grows.

### Problem Frame

Faculty can already browse orientation content, but the wiki is still handbook-shaped rather than knowledge-base-shaped. Three constraints block safe expansion:

1. **Trust debt:** Main Campus source content is flagged as containing Akron General labels and pathways (`src/data/wiki-metadata.json` `sourceWarnings.main-campus`). Expanding on contaminated campus truth multiplies risk.
2. **Ingestion bottleneck:** Content enters through Word DOCX extraction (`tools/extract_handbooks.py` → `src/data/handbooks.json`). That is excellent for handbook fidelity and weak for incremental topic addition, campus overrides, and shared clinical primers with campus-specific procedures.
3. **Orientation IA ceiling:** The shared Parts 1–9 + appendix skeleton covers admissions, workflow, stroke alerts, ECMO, documentation, transitions, EOL/DNC, and neurotrauma—but not a general neuro ICU topic map (for example seizure/status, SAH vasospasm protocols, ICP crisis algorithms, EVD troubleshooting, targeted temperature management, or campus-specific order sets) as first-class, discoverable articles.

### Requirements

- R1. Preserve one product with two campus namespaces (`main-campus`, `akron`) and campus-first navigation/search defaults.
- R2. Make campus provenance visible and actionable on every article: campus badge, verification date, review status, and source warning when present.
- R3. Remediate or quarantine Main Campus content that incorrectly carries Akron pathways before treating Main Campus as authoritative for campus-specific operations.
- R4. Introduce a stable topic taxonomy that can hold orientation chapters plus future neuro ICU domains without abandoning existing Part/Appendix slugs.
- R5. Support three content origins with equal rendering fidelity: handbook-extracted, curated campus article, and shared primer with campus overlays.
- R6. Keep editorial metadata (`aliases`, `shortcuts`, `rankingPriorities`, `redirects`, `verification`, `sourceWarnings`) separate from body content so handbook refresh does not erase navigation/search decisions.
- R7. Expand search aliases and ranking for neuro ICU acronyms and synonyms while continuing to return source content only (no synthesized answers).
- R8. Add cross-campus discoverability: when an equivalent article exists, offer a one-click jump; when only one campus has a topic, say so clearly.
- R9. Provide a contribution/review workflow that records author, campus scope, review status, and authoritative source for every new or changed clinical article.
- R10. Keep `npm test` as the technical release gate and require named human review for clinical/operational correctness per `docs/release-quality-gates.md`.
- R11. Scale campus home pages so growing topic counts remain scannable (taxonomy hubs, shortcuts, and contents—not an infinite flat list).
- R12. Do not introduce accounts, usage-learned ranking, offline-first search, or AI chat in this expansion phase.

### Actors

- A1. On-service faculty / advanced practice providers using the wiki during shift setup and bedside lookup
- A2. Rotating clinicians needing first-shift orientation at either campus
- A3. Content stewards updating handbooks, aliases, shortcuts, and topic articles
- A4. Named clinical reviewers approving campus-specific pathways before release
- A5. Platform maintainers owning extraction, routing, search, and quality gates

### Key Flows

- F1. Campus-first lookup
  - **Trigger:** Clinician opens `/` or a campus home
  - **Actors:** A1, A2
  - **Steps:** Choose campus → search or browse taxonomy/contents → open article → see campus badge and verification → optionally switch to equivalent article on the other campus
  - **Covered by:** R1, R2, R8, R11
- F2. Trust remediation of Main Campus
  - **Trigger:** Steward prepares Main Campus for expansion
  - **Actors:** A3, A4, A5
  - **Steps:** Inventory contaminated sections → replace or annotate with verified Main Campus language → update verification metadata → release only after named review
  - **Covered by:** R2, R3, R9, R10
- F3. Add a new neuro ICU topic
  - **Trigger:** Steward has approved content for one or both campuses
  - **Actors:** A3, A4, A5
  - **Steps:** Choose taxonomy slot and campus scope → author shared primer and/or campus article → attach aliases/shortcuts → run generate + integrity tests → named review → publish
  - **Covered by:** R4, R5, R6, R7, R9, R10
- F4. Handbook refresh without editorial loss
  - **Trigger:** New Word handbook arrives
  - **Actors:** A3, A5
  - **Steps:** Extract into campus records → preserve stable IDs/redirects → merge with curated overlays → validate inventory and metadata → publish with updated verification dates
  - **Covered by:** R5, R6, R10

### Acceptance Examples

- AE1. Covers R3, R2
  - **Given:** Main Campus ECMO section still contains Akron-specific labels
  - **When:** A clinician opens the Main Campus article
  - **Then:** The page shows an explicit source warning and review status that blocks treating it as verified Main Campus operational truth, or the contaminated content has been replaced and `verifiedOn` / `reviewStatus` reflect named review
- AE2. Covers R4, R5, R11
  - **Given:** A new topic "Status epilepticus" exists for Akron only under a Clinical Domains hub
  - **When:** Users browse Akron home and Main Campus home
  - **Then:** Akron surfaces the topic under the taxonomy hub and search; Main Campus shows no false equivalent and does not inherit Akron pathway text
- AE3. Covers R7, R8
  - **Given:** Alias `SE` → status epilepticus and both campuses have articles
  - **When:** User searches `SE` scoped to preferred campus, then toggles Both campuses
  - **Then:** Preferred campus ranks first; both results are labeled; each article offers a jump to the other campus equivalent
- AE4. Covers R6, R9, R10
  - **Given:** A handbook re-extract changes body text but not aliases
  - **When:** `npm run generate:data` and `npm test` run
  - **Then:** Aliases/shortcuts survive; inventory/integrity checks catch unexpected section loss; clinical approval still requires named reviewer sign-off

### Success Criteria

- Main Campus no longer silently presents unverified Akron pathways as campus truth
- New neuro ICU topics can be added without rewriting the Part 1–9 skeleton
- Campus homes remain usable as topic count grows beyond ~80 sections per campus
- Cross-campus search and equivalence links reduce wrong-campus misses
- Contribution metadata makes review status auditable

### Scope Boundaries

In scope:

- Trust remediation and provenance UX
- Content-model extension for curated/shared/campus-overlay articles
- Taxonomy hubs and campus-home information architecture for expansion
- Alias/shortcut/ranking growth for neuro ICU vocabulary
- Cross-campus equivalence mapping
- Contribution/review metadata and steward docs
- Tests and release-gate updates for the new model

Out of scope for this phase:

- AI clinical Q&A or summarization
- Separate Akron-only or Main-only deployments
- Auth/accounts/personalization
- Usage-based ranking or analytics-driven navigation
- Urgent-action card hub as primary IA (already a non-goal in the validated design)
- Replacing Word handbooks as an allowed source (they remain one origin, not the only origin)
- Authoring a full clinical corpus in this engineering phase (platform readiness first; content waves follow)

### Dependencies

- Existing dual-campus routes and layered search implementation
- `tools/extract_handbooks.py` normalization pipeline
- `src/data/wiki-metadata.json` editorial layer
- `docs/release-quality-gates.md` clinical governance boundary
- Named faculty reviewers for Main Campus remediation and any new clinical topics

### Outstanding Questions

- Q1. Deferred: Which named reviewers own Main Campus vs Akron clinical sign-off, and what is the minimum review checklist?
- Q2. Deferred: Should shared primers live under a third URL namespace (for example `/shared/...`) or only as campus-scoped pages generated from shared source?
- Q3. Deferred: Priority order for the first content wave after platform readiness (seizure/SE, SAH/vasospasm, ICP crisis, EVD, TTM, anticoagulation reversal, etc.)
- Q4. Deferred: Are future campuses expected, or should the model stay hard-coded to Main Campus + Akron for now?

### Sources

- `.specs/plans/hospital-wikis-layered-search.design.md` — validated dual-hospital IA and layered search (2026-07-16)
- `docs/release-quality-gates.md` — technical vs clinical approval boundary
- `src/data/wiki-metadata.json` — aliases, shortcuts, verification, source warnings
- `src/data/handbooks.json` — current extracted campus content
- `tools/extract_handbooks.py` — extraction and normalization boundary
- In-app product framing in `src/App.jsx` and campus chooser/home components under `src/components/wiki/`

## Planning Contract

### Key Technical Decisions

- KTD1. Extend the existing campus-scoped JSON content model; do not migrate to MDX/CMS in this phase.
  - **Rationale:** The DOCX → normalized JSON → generated assets pipeline already powers integrity tests, search indexes, and SSR routes. A CMS migration would delay trust remediation and taxonomy work without improving clinical safety.
- KTD2. Keep body content and editorial metadata separate; add a third layer for curated overlays and shared primers.
  - **Rationale:** Handbook refresh must replace extracted text without erasing aliases, redirects, taxonomy membership, or equivalence maps.
- KTD3. Represent expansion topics as first-class sections with `contentOrigin`, `taxonomy`, `review`, and optional `equivalentSlug` fields rather than nesting deep arrays inside chapters.
  - **Rationale:** Matches the current flat relational section list (`id`, `slug`, `parentId`, `campus`) and preserves pagination/search assumptions.
- KTD4. Generate campus pages from shared primers plus campus overlays at build time; do not serve a live merge in the browser.
  - **Rationale:** Keeps SSR/output deterministic, preserves inventory hashing, and avoids client-side clinical assembly.
- KTD5. Prefer hard-coded two-campus support with metadata-driven labels; defer multi-campus generalization until a third site is real (Q4).
  - **Rationale:** Current `CAMPUSES` map, routes, and tests are dual-campus; premature abstraction adds risk.
- KTD6. Cross-campus equivalence is an explicit reviewed map, not fuzzy title matching.
  - **Rationale:** Shared titles already diverge (`hemorrhagic-stroke` vs `hemorrhagic-strokes`); automatic matching would create false confidence.
- KTD7. Taxonomy hubs are navigation/grouping records that may be empty parents; clinical articles remain the units of review.
  - **Rationale:** Reuses current empty-parent rules for chapter grouping while giving campus homes a scalable browse surface.

### High-Level Design

```text
Sources
  Word handbooks (per campus)
  Curated campus articles (JSON)
  Shared primers + campus overlays (JSON)
        |
        v
normalize + validate (extract_handbooks + overlay merge)
        |
        v
src/data/handbooks.json          # body + structural section records
src/data/wiki-metadata.json      # aliases, shortcuts, ranking, redirects,
                                 # verification, warnings, taxonomy, equivalents
        |
        v
generated campus content / nav / search / figures / route-manifest
        |
        v
Next.js campus homes, articles, search, sources, figures
```

Proposed taxonomy hubs (initial, both campuses):

1. Orientation & First Shift (existing preface + Part 1)
2. Admissions & Scope (Part 2)
3. Daily Workflow & Response (Part 3)
4. Stroke & Consultation (Part 4)
5. Transfers & Rescue Pathways (Part 5)
6. Documentation & Quality (Part 6)
7. Transitions of Care (Part 7)
8. End of Life, Donation & DNC (Part 8)
9. Neurotrauma & Neuromonitoring (Part 9)
10. Clinical Domains (new expansion home for disease/protocol topics)
11. Procedures & Devices (new; EVD, ICP, airway adjuncts, etc.)
12. Epic & SmartPhrases (Appendix A and related)
13. Campus Operations (contacts, directories, QGenda, maintenance)

Existing Part/Appendix slugs remain canonical; taxonomy is additive metadata and hub pages.

### Assumptions

- Faculty reviewers can supply corrected Main Campus language or approve quarantined warnings as an interim control
- First expansion content will arrive as curated JSON or updated DOCX, not free-form CMS drafts
- Two campuses remain the only live namespaces through this phase
- Visual language stays within the current Cleveland Clinic faculty-wiki shell; this plan does not redesign the decorative landing eye

### Implementation Constraints

- Repo-relative paths only in tooling docs and plans
- All public behavior covered by existing release suite patterns under `tests/`
- No floating unverified clinical edits in Main Campus once quarantine rules tighten
- `npm run generate:data` must remain the single normalization entrypoint
- Clinical correctness remains a human gate even when tests pass

### Sequencing

1. Trust & provenance hardening (U1, U2)
2. Content-model and taxonomy scaffolding (U3, U4)
3. Cross-campus equivalence + search growth (U5)
4. Campus-home IA for scale (U6)
5. Contribution/review workflow docs + metadata validation (U7)
6. First content-wave enablement checklist (U8; content itself may follow after reviewer input)

### Research Notes

Current corpus scale: Main Campus 79 sections / 49 tables / 11 figures; Akron 82 / 62 / 12; 74 shared slugs; block types limited to paragraph, list-item, table, image. Alias map is small (ICH, SAH, DNC, EVD, TCD). Landing secondary links still hard-code several Akron paths, which is fine for demos but should become campus-aware or preference-aware during expansion UX work.

## Implementation Units

### U1. Main Campus trust remediation and quarantine controls

- Goal: Stop unverified Akron pathways from being treated as Main Campus operational truth.
- Requirements: R2, R3, R10
- Files:
  - `src/data/handbooks.json`
  - `src/data/wiki-metadata.json`
  - `src/data/handbook-inventory.json`
  - `src/components/wiki/SourceStatus.jsx`
  - `src/components/wiki/ArticlePage.jsx`
  - `tests/content-integrity.test.mjs`
- Approach:
  - Inventory Main Campus sections with Akron-specific labels (ECMO pathway titles, SmartPhrase names, contacts, transfer language).
  - For each contaminated section, either replace with verified Main Campus copy or mark `reviewStatus` / warning severity so UI shows a persistent campus-trust banner.
  - Add integrity assertions that Main Campus verification cannot be `approved` while the known contamination warning remains unchanged unless an explicit quarantine flag is set.
- Test scenarios:
  - Contaminated Main Campus article renders visible warning and non-approved review status.
  - Approved Main Campus verification fails validation if contamination warning is still active without quarantine metadata.
  - Akron pages are unchanged by Main Campus quarantine banners.
- Verification: `node --test tests/content-integrity.test.mjs` (or suite slice used by release runner) plus article render checks in the release suite.
- Dependencies: none

### U2. Provenance surface on campus homes and articles

- Goal: Make campus, year, verification date, and warnings impossible to miss without overwhelming body content.
- Requirements: R2, R11
- Files:
  - `src/components/wiki/SourceStatus.jsx`
  - `src/components/wiki/HospitalWikiHome.jsx`
  - `src/components/wiki/ArticlePage.jsx`
  - `src/styles.css`
  - `tests/` browser/a11y coverage for wiki chrome
- Approach:
  - Standardize a compact provenance strip: campus badge, handbook year, `verifiedOn`, review status, optional warning.
  - Keep warnings visually persistent but secondary to clinical content.
  - Ensure sources page remains the deep provenance view.
- Test scenarios:
  - Campus home and representative articles expose campus + verification fields.
  - Warning text from metadata appears for Main Campus until remediated.
  - Accessibility: status text is readable by screen readers and not color-only.
- Verification: release browser/a11y gates covering campus homes and sample articles.
- Dependencies: U1 for accurate warning/review values

### U3. Expand content schema for origins, taxonomy, and review metadata

- Goal: Make the data model ready for non-handbook neuro ICU articles without breaking extraction.
- Requirements: R4, R5, R6, R9
- Files:
  - `tools/extract_handbooks.py`
  - `src/data/wiki-metadata.json`
  - `src/data/handbooks.json` (schema only / passthrough fields)
  - `src/data/generated/*` consumers as needed
  - `tests/content-integrity.test.mjs`
- Approach:
  - Add validated metadata collections: `taxonomy`, `equivalents`, optional `curatedArticles` / `sharedPrimers` references.
  - Extend section records with optional `contentOrigin` (`handbook` | `curated` | `shared-overlay`), `taxonomyIds`, and `review` object.
  - Merge curated/shared sources during `generate:data` into campus section lists with stable IDs and inventory updates.
  - Keep DOCX extraction path intact for handbook origin content.
- Test scenarios:
  - Unknown `contentOrigin` or missing campus on curated article fails validation.
  - Handbook refresh preserves curated sections and editorial metadata.
  - Generated route manifest includes curated slugs and rejects collisions.
- Verification: generate:data + content integrity tests.
- Dependencies: none (can land schema before Main Campus body cleanup, but do not mark curated Main Campus ops topics approved until U1)

### U4. Taxonomy hubs and stable slug strategy

- Goal: Provide expansion slots for Clinical Domains, Procedures & Devices, and Campus Operations while preserving Part/Appendix URLs.
- Requirements: R4, R11
- Files:
  - `src/data/wiki-metadata.json`
  - `tools/extract_handbooks.py`
  - `src/components/wiki/HospitalWikiHome.jsx`
  - `src/components/wiki/WikiContents.jsx`
  - `src/routing/routes.js` (only if hub routes need explicit handling)
  - `tests/routing.test.mjs`
- Approach:
  - Define taxonomy hub records with ids, labels, order, and member slugs/patterns per campus.
  - Map existing Parts 1–9 and appendices into hubs.
  - Create empty or stub hub landing sections where needed so `/akron/...` and `/main-campus/...` can host future children.
  - Preserve redirects for any renamed hub titles.
- Test scenarios:
  - Every existing major part remains reachable at its current slug.
  - Hub pages render as parents with child links.
  - Unknown taxonomy membership fails validation for curated articles.
- Verification: routing + content integrity tests.
- Dependencies: U3

### U5. Cross-campus equivalence map and search vocabulary growth

- Goal: Help users land on the correct campus article and discover clinical synonyms.
- Requirements: R7, R8, R12
- Files:
  - `src/data/wiki-metadata.json`
  - `src/search/rank-results.js`
  - `src/search/search-index.js`
  - `src/components/wiki/ArticlePage.jsx`
  - `src/components/search/*`
  - `tests/search-ranking.test.mjs`
- Approach:
  - Add reviewed `equivalents` entries (`main-campus` slug ↔ `akron` slug).
  - Render an equivalent-campus link on articles when mapped; render an explicit “no equivalent on other campus” note when scoped comparison is requested and mapping is absent.
  - Expand aliases for high-value neuro ICU terms (seed list in Appendix) without auto-generating clinical text.
  - Keep ranking policy: exact title → alias → heading → curated priority → body; preferred campus breaks ties.
- Test scenarios:
  - Mapped equivalents link both directions.
  - Unmapped topic does not invent a link.
  - New aliases resolve before body matches.
  - Both-campus search labels hospital on every result.
- Verification: search-ranking tests + article render checks.
- Dependencies: U3; content-complete mappings can grow over time

### U6. Campus-home IA for a growing catalog

- Goal: Keep hospital homepages scannable as Clinical Domains and Procedures fill in.
- Requirements: R1, R11
- Files:
  - `src/components/wiki/HospitalWikiHome.jsx`
  - `src/components/wiki/WikiContents.jsx`
  - `src/components/LandingPage.jsx`
  - `src/data/wiki-metadata.json` (shortcuts)
  - `src/styles.css`
  - browser evidence tests under `tests/`
- Approach:
  - Present taxonomy hubs as the primary browse layer; keep full contents available in sidebar/drawer.
  - Extend shortcuts beyond orientation (for example Neuromonitoring, Stroke alert, SmartPhrases) with campus-aware targets.
  - Make landing secondary orbit links preference-aware or campus-neutral so they do not hard-wire Akron for every user.
- Test scenarios:
  - Campus home shows hubs + shortcuts without loading the other campus handbook.
  - Mobile drawer still exposes full contents.
  - Landing links respect stored campus preference when pointing at first-shift / urgent pathway targets.
- Verification: browser interaction + loading-boundary checks in `npm test`.
- Dependencies: U4

### U7. Contribution and review workflow tooling

- Goal: Give stewards a repeatable path to add neuro ICU topics safely.
- Requirements: R9, R10
- Files:
  - `docs/content-contribution.md` (new)
  - `docs/release-quality-gates.md` (cross-links)
  - `tools/extract_handbooks.py` validation messages
  - `src/data/wiki-metadata.json` review fields
  - optional fixture under `tests/` for curated article merge
- Approach:
  - Document how to add a curated article or shared primer, required review fields, alias updates, equivalence mapping, and release checklist.
  - Validate that curated/shared clinical articles include `reviewedBy` / `reviewedOn` / `reviewStatus` before they can be marked approved.
  - Keep `npm test` technical gate language aligned with human clinical approval.
- Test scenarios:
  - Curated article missing review metadata fails validation when `reviewStatus` is approved.
  - Draft curated articles can generate into preview/dev inventories without claiming approval.
  - Contribution doc paths and commands match package scripts.
- Verification: content integrity validation tests; doc reviewed in PR.
- Dependencies: U3

### U8. First content-wave enablement (platform complete; corpus optional)

- Goal: Prove the expansion path end-to-end with at least one dual-campus or single-campus clinical domain stub under governance.
- Requirements: R4, R5, R7, R8, R9
- Files:
  - curated data location introduced in U3 (for example `src/data/curated/` or metadata-referenced JSON)
  - `src/data/wiki-metadata.json`
  - generated assets via `npm run generate:data`
  - tests covering the seeded topic
- Approach:
  - Seed one non-operational primer topic agreed with reviewers (placeholder title until Q3 resolves—default candidate: neuromonitoring deep-dive linking existing Part 9 content, or a clearly draft `Clinical Domains` index article).
  - If clinical reviewers are unavailable, ship hub stubs + contribution docs only and keep article bodies limited to navigational indexes that point at existing handbook sections.
  - Do not fabricate protocols.
- Test scenarios:
  - Seeded hub/topic appears in campus nav/search with correct origin and review status.
  - No unverified protocol text is marked approved.
  - Equivalent links behave correctly for the seeded example.
- Verification: full `npm test` after generate.
- Dependencies: U3, U4, U5, U7; U1 before any Main Campus operational pathway seed

## Verification Contract

Primary gate:

```bash
npm test
```

Supporting checks during implementation:

```bash
npm run generate:data
npm run lint
npm run typecheck
```

Quality expectations:

- Content integrity continues to lock section/table/figure inventories unless intentionally updated
- Search ranking tests cover new aliases and preferred-campus behavior
- Routing tests cover hubs, redirects, and equivalence targets
- Browser/a11y suite still records 390px / 768px / desktop evidence for campus homes and representative articles
- Clinical approval remains outside automation: named reviewer required for pathway/contact/policy/Epic changes per `docs/release-quality-gates.md`

Behavioral evaluation focus:

- Wrong-campus miss rate for mapped topics (manual review checklist)
- Time-to-article for a known clinical domain after hubs ship (manual, target under 10 seconds aligned with prior design success metric)

## Definition of Done

Global:

- [ ] Main Campus contamination is remediated or explicitly quarantined with visible provenance
- [ ] Content schema accepts handbook, curated, and shared-overlay origins
- [ ] Taxonomy hubs exist for expansion domains without breaking Part/Appendix URLs
- [ ] Equivalence map + expanded aliases are validated in tests
- [ ] Campus homes browse by taxonomy and remain within release a11y/browser gates
- [ ] Contribution/review doc published and linked from release quality gates
- [ ] `npm test` passes
- [ ] No AI clinical answer features introduced

Per unit:

- [ ] U1 trust controls merged with integrity assertions
- [ ] U2 provenance strip live on homes/articles
- [ ] U3 schema/merge pipeline generating valid assets
- [ ] U4 hubs routable and linked from contents
- [ ] U5 equivalents/aliases covered by ranking tests
- [ ] U6 campus-home/landing IA updates covered by browser gates
- [ ] U7 contribution workflow documented and validated
- [ ] U8 seeded expansion proof without unverified protocol invention

## Appendix

### A. Current campus shape (2026-07-24)

| Campus | Route | Sections | Tables | Figures | Source warning |
| --- | --- | ---: | ---: | ---: | --- |
| Main Campus | `/main-campus` | 79 | 49 | 11 | Contains Akron labels/pathways; needs review |
| Akron General | `/akron` | 82 | 62 | 12 | Time-sensitive ops may change |

Shared orientation skeleton: Parts 1–9 + Appendix A SmartPhrases. Akron also has Appendix B maintenance. Main Campus has Action Card Index / Maintenance Notes in preface material.

### B. Seed alias candidates for neuro ICU search growth

Review before enabling; campus scope may be `*` or single-campus:

- SE / status epilepticus
- cEEG / continuous EEG
- ICP / intracranial pressure
- CPP / cerebral perfusion pressure
- EVD (already present)
- LD / lumbar drain
- TTM / targeted temperature management
- DCI / delayed cerebral ischemia
- aSAH / aneurysmal subarachnoid hemorrhage
- ICH / SAH / DNC / TCD (already present)
- EVT / endovascular thrombectomy
- LVO / large vessel occlusion
- VSP / vasospasm
- Brain death / DNC pairing
- LifeBanc

### C. Suggested first clinical domain wave (pending Q3)

Navigational indexes first, protocols only after named review:

1. Status epilepticus / cEEG workflow
2. SAH and vasospasm / DCI monitoring
3. ICP crisis and herniation response
4. EVD / lumbar drain troubleshooting
5. Anticoagulation reversal for ICH
6. Targeted temperature management
7. Post-thrombectomy ICU care
8. Campus-specific order-set and SmartPhrase deltas

### D. Relationship to prior design

This plan **extends** `.specs/plans/hospital-wikis-layered-search.design.md`. It does not reopen rejected options (AI conversational search, split sites, usage-learned ranking, urgent-action hub as primary IA). It does advance the deferred concern implied by that design: freshness, version controls, and a durable editorial layer so the dual-campus wiki can grow beyond the 2026 orientation handbooks.
