# Content contribution workflow

Use this workflow to expand the Neurocritical Care Faculty Wiki for Main Campus and Akron without inventing clinical guidance or losing provenance.

## Sources of truth

| Layer | Path | Owns |
| --- | --- | --- |
| Handbook extract | `src/data/handbooks.json` | Orientation body text from Word sources |
| Curated articles | `src/data/curated/articles.json` | Expansion hubs and reviewed topic drafts |
| Editorial metadata | `src/data/wiki-metadata.json` | Aliases, shortcuts, ranking, taxonomy, equivalents, verification, quarantine |
| Inventory lock | `src/data/handbook-inventory.json` | Reviewed section/table/figure baseline |
| Generated assets | `src/data/generated/` | Runtime navigation, search, routes |

Handbook refresh can replace extracted body text. It must not erase editorial metadata.

## Add a curated article

1. Draft the article in `src/data/curated/articles.json`.
2. Set `campuses` explicitly (`main-campus`, `akron`, or both).
3. Set `contentOrigin` to `curated` (or `shared-overlay` for shared primer + campus overlay work).
4. Assign one or more `taxonomyIds` from `wiki-metadata.json`.
5. Include content `blocks` (`paragraph`, `list-item`, `table`, `image`). Empty leaves are rejected.
6. Fill `review`:
   - `approvalState`: `draft` while navigating/index-only, `approved` only after named clinical review
   - `reviewedBy`, `reviewedOn`, and `reviewStatus` are required when `approvalState` is `approved`
7. If both campuses should deep-link, add a reviewed `equivalents` entry in `wiki-metadata.json`.
8. Add aliases/shortcuts/ranking only when they help lookup; do not auto-generate clinical answers.

## Regenerate and validate

```bash
npm run generate:data
```

If section counts intentionally changed after reviewed expansion:

```bash
npm run generate:data:update-inventory
```

Then run the release gate:

```bash
npm test
```

## Main Campus quarantine

Main Campus remains quarantined while its source warning still reports Akron General labels/pathways. The generator rejects `approvalState: approved` for Main Campus in that state unless quarantine is cleared after remediation.

Do not mark Main Campus operational pathways approved until a named reviewer replaces or verifies the contaminated language.

## Release checklist

- [ ] Campus scope is correct on every new article
- [ ] Review metadata matches the intended approval state
- [ ] Equivalents are explicit and reviewed when claimed
- [ ] Aliases do not invent unsupported clinical meanings
- [ ] `npm run generate:data` succeeds
- [ ] Inventory update is intentional and reviewed when counts change
- [ ] `npm test` passes
- [ ] Named human reviewer approved clinical/operational wording when `approvalState` is `approved`

Automated tests detect inventory, route, warning, and metadata changes. They do not certify clinical correctness. See `docs/release-quality-gates.md`.
