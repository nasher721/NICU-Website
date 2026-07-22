# Faculty wiki release quality gates

`npm test` is the release gate. It builds the production application first, removes
AppleDouble metadata from test and build artifacts, and then runs content integrity,
ranking, routing, rendered-page, browser interaction, accessibility, resilience, link,
asset, and loading-boundary checks.

The production-browser suite records deterministic viewport evidence under
`.tmp/release-evidence/` for 390 px, 768 px, and desktop layouts. It also checks
hydration and console cleanliness, keyboard and touch search, focus restoration,
history, direct routes, redirects, missing figures, reduced motion, and browser API
fallbacks.

## Clinical governance boundary

These automated gates detect source inventory, pathway, contact, route, warning, and
metadata changes. They do not approve clinical or operational correctness. A named
human reviewer must verify clinical pathways, operational wording, contact details,
policy versions, and live Epic behavior before those changes are considered approved.
