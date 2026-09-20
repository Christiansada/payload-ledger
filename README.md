# Payload Ledger

A browser-local JSON fixture review tool for API developers and testers who need to distinguish meaningful field changes from reordered records and volatile metadata.

**Release status:** v0.1.0 source is published at [Christiansada/payload-ledger](https://github.com/Christiansada/payload-ledger). A private [Sites deployment](https://payload-ledger.christiansada787.chatgpt.site) passed authenticated functional checks; it requires sign-in. Public static hosting is being configured.

## Purpose and capabilities

Text diffs become noisy when API objects change key order or record arrays arrive in a different order. Payload Ledger compares parsed values, optionally matches one array by a unique ID field, and produces a filterable ledger for human review.

- Paste or open two local JSON files; inputs stay in browser memory.
- Distinguish added, removed, type-changed and value-changed fields.
- Match one array by unique string or numeric IDs, preserving both source pointers when records move.
- Exclude explicit JSON Pointer subtrees and see which rules were actually visited.
- Filter changes by type or pointer, then download the complete review as JSON.
- Reject malformed JSON, duplicate object keys, ambiguous record IDs, and oversized inputs.
- Explore a clearly labeled synthetic parcel-status example.

This is a review aid. It does not decide whether an API change breaks a client, infer an API schema, call remote APIs, apply patches, or generate tests automatically.

## Stack and architecture

TypeScript, Vite, semantic HTML and CSS. No runtime package dependencies, backend, database, model, account, or application telemetry. Development tooling includes Vitest, ESLint, Prettier, Playwright, and axe-core.

`text / file → bounded parser → comparison rules → deterministic diff → review UI / JSON export`

The pure parser and comparator live in `src/engine.ts`. DOM orchestration lives in `src/main.ts`; untrusted values are inserted with `textContent`, never interpreted as HTML. See [architecture and comparison semantics](docs/architecture.md).

## Installation

Use Node.js 22.12 or newer and npm. In this project's directory:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. No environment configuration is required; `.env.example` documents this. Do not add credentials. For a production build:

```sh
npm run build
npm run preview
```

## Usage

1. Select **Load synthetic example**, or paste/open your baseline and candidate JSON.
2. Choose positional array comparison, or enable record matching with array pointer `/records` and ID field `id`. An empty array pointer selects a root array.
3. Optionally enter exclusion pointers, one per line. `/generatedAt` excludes that subtree. Keys containing `/` use `~1`; keys containing `~` use `~0`. A line `/` refers to an empty key. Pointer whitespace is significant; blank lines are skipped.
4. Select **Compare fixtures**. The synthetic example yields four changes, two records at changed indices, and one visited exclusion.
5. Filter the ledger. **Download review JSON** exports all changes regardless of current filters. Changing inputs or rules invalidates the previous review and disables export.

IDs are typed: numeric `1` differs from string `"1"`. Duplicate, missing, boolean, and null IDs fail explicitly. Reordering in the matched array is reported as information, not a value change. Numeric IDs should fit JavaScript's safe integer range; encode larger identifiers as strings.

## Tests and checks

```sh
npm run check
npx playwright install chromium
npm run test:e2e
npm audit
```

`check` runs formatting, lint, strict type checks, unit tests and a production build. On Windows, browser tests use installed Microsoft Edge; on other systems they use Playwright Chromium. Install Edge before browser tests on Windows. CI installs Chromium with system dependencies. Browser tests start a local production preview on port 4175; keep that port available.

Tests cover parser boundaries, comparison semantics, a deterministic flat-object oracle, identity matching, import behavior, safe text rendering, export, keyboard interaction, responsive widths and basic automated accessibility. Automated accessibility checks do not establish full accessibility conformance or replace manual screen-reader review.

## Deployment

Run `npm ci` and `npm run build`, then serve the contents of `dist/` on a static host. The Vite base is relative so a project subpath works. Only built static assets are needed; no environment secrets are involved. Do not open `dist/index.html` directly as a file; serve it over HTTP.

A manually dispatched GitHub Pages workflow is included. Select **GitHub Actions** as the Pages source in repository settings and run the **Deploy Pages** workflow from `main`. Read the workflow result's URL and verify the live example, import and export before announcing deployment. Check the repository's Actions page for current validation and deployment results.

## Limits and data handling

- Each document: at most 256 KiB, 60 nesting levels, 20,000 values. At most 5,000 changes per review and 100 exclusions. Exceeding a limit fails the comparison rather than silently returning a partial result.
- The UI displays the first 250 matching changes; filtering and export cover the full result.
- JSON numbers use JavaScript floating point. Unsafe integral values and nonfinite results are rejected; decimal precision is not preserved exactly. Lexical number differences such as `1.0` versus `1` and `-0` versus `0` compare equal.
- Added/removed containers and type replacements are summarized at their root with container size. Their descendants are not expanded. Exclusions inside such a parent are reported as not visited. Exclusions are comparison rules, not a data-redaction service.
- One matched array per comparison; no matching of nested arrays by separate keys. Exclusions cannot overlap the matched array. Arrays outside that path use position.
- Object property order is ignored. Array reorder counts describe changed indices and can include shifts caused by insertion; they are not a minimum count of move operations.
- Browser memory only: no autosave, recovery, history or cross-tab synchronization. Refresh loses input. The hosting provider may record ordinary page requests; the app makes no fixture uploads.
- Downloads contain changed primitive values and JSON paths. Review them before sharing. No confidential inputs are supplied with the product.

## Sources and licensing

All bundled parcel fixtures are invented and contain no real people, customers or organizations. No external dataset or model is used. Application source and sample data are MIT licensed; dependency licenses remain their own.

The implementation is independent. JSON Pointer syntax follows [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901). Product research considered [jsondiffpatch](https://github.com/benjamine/jsondiffpatch) for the importance of explicit array identity. Presentation research used [Carbon's data-table guidance](https://carbondesignsystem.com/components/data-table/usage/) and [empty-state guidance](https://carbondesignsystem.com/patterns/empty-states-pattern/) for clear filtering and actionable empty states. No source code, artwork, branding, or layouts were copied.

## Contributing and next opportunities

See [CONTRIBUTING.md](CONTRIBUTING.md) and the [code of conduct](CODE_OF_CONDUCT.md). Useful contributions include an independent randomized nested-data oracle, manual screen-reader review, multiple explicitly scoped matching rules, a command-line review exporter, and exact decimal support with clear semantics. Keep new behavior narrow and test assumptions before extending limits.

[Demo plan](docs/demo.md) · [Social drafts](docs/social-drafts.md) · [MIT license](LICENSE)
