# Hospital Wikis and Layered Search

## Status

Validated on July 16, 2026.

## Objective

Make point-of-care information easy to find by giving Main Campus and Akron General distinct, clickable wiki homepages and replacing literal substring search with a fast, layered search experience.

Success means a user can choose a hospital, find a known topic, and open the correct article within ten seconds on desktop or mobile.

## Product decisions

- Keep the visual landing page, but make two hospital cards its primary choice.
- Give each hospital a dedicated Wikipedia-style homepage.
- Prioritize search, a clickable table of contents, and a few practical task links.
- Default search to the preferred hospital and provide a clear **Both campuses** option.
- Show instant suggestions and a complete results page.
- Rank exact headings first, then preferred-campus and clinically curated results.
- Preserve the animated eye as decoration and secondary navigation.
- Use real, bookmarkable routes instead of hash routes.

## Non-goals

- Do not create an urgent-pathway hub or compact urgent-action cards.
- Do not add AI-generated clinical answers.
- Do not split the product into two independently maintained sites.
- Do not rank results from user tracking in the first release.
- Do not introduce accounts or cross-device personalization.

## Information architecture

The landing page presents two large cards:

- **Main Campus** opens `/main-campus`.
- **Akron General** opens `/akron`.

Each hospital homepage uses the same template and displays only its hospital's content. The page includes:

1. Hospital name and campus badge.
2. Campus-scoped search with a **Both campuses** toggle.
3. A clickable table of contents.
4. Shortcuts to first-shift setup, workflow, documentation, transitions, and SmartPhrases.
5. A complete chapter and topic index.
6. Source, handbook year, and verification information.

Desktop pages keep the contents visible in a sidebar. Mobile pages place the same contents in an accessible drawer. Breadcrumbs and linked headings provide predictable movement through the hierarchy.

Articles use paths such as:

```text
/main-campus/documentation-and-quality
/akron/transitions-of-care
```

The URL determines the active hospital. A local preference affects the suggested hospital and default search scope, but never overrides a shared URL. Switching hospitals opens the other hospital's homepage unless the application has an explicitly mapped equivalent article.

## Layered search

The hospital homepage and every article show the same search control. Search starts within the active hospital. Users can expand it to both hospitals without losing their preferred scope.

After two characters, the control shows up to six suggestions. Each suggestion includes:

- Article or section title.
- Highlighted context.
- Hospital badge.
- Content type.
- Parent chapter.

Arrow keys move through suggestions. Enter opens the selected result or the complete results page. Escape closes the panel. Touch and screen-reader behavior follow the same model.

The full results page stores its query, scope, and filters in the URL. It supports hospital, chapter, and content-type filters. A no-results state offers spelling alternatives, nearby topics, and a one-click search across both hospitals.

Ranking follows this order:

1. Exact title.
2. Known acronym or synonym.
3. Heading.
4. Curated section priority.
5. Body-text relevance.

Preferred-campus results break otherwise equal scores. A small reviewed alias map connects terms such as `ICH` and `intracerebral hemorrhage`. Search returns source content; it does not synthesize clinical answers.

## Components

- `HospitalChooser`: renders the two landing cards.
- `HospitalWikiHome`: renders hospital identity, search, shortcuts, and contents.
- `WikiContents`: renders the desktop index and mobile drawer.
- `SearchBox`: owns the query and accessible combobox behavior.
- `SearchSuggestions`: renders the first six matches.
- `SearchResults`: renders filtered, shareable results.
- `ArticlePage`: renders a chapter or nested section.
- Content renderers: render prose, lists, tables, figures, and SmartPhrases.
- `SourceStatus`: renders provenance and verification information.

The hospital homepages share these components. Separate copies would create content and behavior drift.

## Content and data flow

The existing extractor remains the source-content boundary:

```text
Word handbooks
  -> extraction and validation
  -> normalized hospital records
  -> route manifest and redirects
  -> campus search indexes
  -> server-rendered wiki pages
```

Each normalized record contains a stable ID, hospital, title, slug, parent, content blocks, content type, source metadata, and search text. Editorial metadata stores aliases, shortcuts, and ranking priority separately from extracted content. A handbook refresh can then replace source text without erasing reviewed navigation and search decisions.

The build produces separate Main Campus and Akron content and index files. The landing page loads neither complete handbook. A hospital homepage loads its own navigation and search index; the application loads the other index only when the user selects **Both campuses**. Article and figure-library code loads on demand.

## Resilience and trust

- If search fails to load, the table of contents remains fully usable and search offers a retry.
- Invalid article paths show hospital-scoped search, contents, and likely replacement pages.
- Stable source IDs generate redirects for renamed sections when possible.
- Missing figures retain their caption and source location.
- Empty sections publish only when they group child topics; unexpected empty pages fail validation.
- Every page shows its hospital in the title, badge, breadcrumb, and URL.
- Operationally sensitive content can show a verification date and authoritative-source reminder when metadata exists.

Source information should remain compact. Warnings must stay visible without overwhelming every article.

## Accessibility

- Implement the search as a conforming combobox and listbox.
- Announce result counts and route changes.
- Support Arrow Up, Arrow Down, Enter, and Escape.
- Mark the current page with `aria-current`.
- Connect the mobile drawer trigger with its controlled region.
- Move and restore focus when the drawer opens and closes.
- Keep tables scrollable and printable.
- Preserve reduced-motion behavior.
- Render the decorative eye deterministically or on the client to eliminate its current hydration mismatch.

## Testing

### Unit and content tests

- Exact titles outrank body matches.
- Aliases and acronyms resolve to reviewed terms.
- Preferred-campus results win equal scores.
- Both-campus search labels every result.
- Extracted records have stable IDs, unique slugs, and valid parent relationships.
- Tables, figures, and source counts remain intact.
- Renamed stable records generate redirects.

### Browser tests

- Choose each hospital from the landing page.
- Open every major topic through the contents.
- Search the active hospital and both hospitals.
- Navigate suggestions with keyboard and touch.
- Filter and share a results URL.
- Open article links directly.
- Use browser Back and Forward without losing route state.
- Recover from invalid and renamed paths.

### Quality gates

- Run automated accessibility checks on both hospital homepages, search, representative articles, tables, and the mobile drawer.
- Test at 390px, 768px, and desktop widths.
- Keep visual snapshots for primary navigation surfaces.
- Prevent the landing page from loading handbook content.
- Require a named human reviewer for clinical and operational changes.

Automated tests can detect changed pathways or contact values. They cannot determine whether those changes are clinically correct.

## Considered approaches

| Approach | Fit | Decision |
| --- | ---: | --- |
| Layered clinical search | 0.94 | Selected; best balance of speed, safety, and complexity. |
| Faceted clinical search portal | 0.89 | Retain its filters inside the full results page. |
| Offline-first local search | 0.84 | Revisit after freshness and version controls exist. |
| Conversational AI search | 0.08 | Reject for hallucination, privacy, latency, and governance risk. |
| Knowledge-graph navigation | 0.05 | Reject as costly and slower for direct lookup. |
| Usage-learned ranking | 0.03 | Reject until privacy-safe analytics and enough usage data exist. |

## Implementation boundary

This design defines the product and acceptance criteria. Implementation planning must still map route migration, index generation, component extraction, redirect behavior, and test sequencing against the current codebase.
