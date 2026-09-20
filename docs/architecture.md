# Architecture and review semantics

The application is a static browser client. The parser, pointer resolver and comparator have no DOM or network dependency. Only strings originating from the bounded parser are supported as fixture inputs to the public comparator. The UI manages transient state, validates files before replacing editor contents, and invalidates exported results after edits.

## Parser

A small recursive-descent parser follows JSON grammar, tracking bytes, values and depth before comparison. Each object is created with a null prototype; duplicate decoded keys are rejected. Strings are decoded using native JSON parsing. Numeric tokens become JavaScript numbers; nonfinite or unsafe integer results fail. Decimal rounding follows JavaScript; arbitrary-precision decimal support is outside this release.

## Comparison

The walker distinguishes missing values from null. Objects visit the sorted union of their own keys. Arrays compare indices unless the configured array pointer resolves to valid record arrays on both sides. Matching builds maps keyed by ID type and serialized value. The iteration order is baseline IDs followed by new candidate IDs. Duplicate IDs cannot overwrite one another silently. Inputs are not mutated.

Every change stores a kind, nullable before/after JSON Pointers and two typed value summaries. A missing pointer is null; a root pointer is the empty string. When a matched record changes index, both pointers retain the physical source locations. The report is not RFC 6902 JSON Patch and must not be applied as a patch.

An added/removed container or container replacement emits one summary; it does not enumerate descendants. This keeps additions focused but means exclusions below the parent are not traversed. Report `unmatchedIgnores` names these exclusions and nonexistent or shadowed paths. Primitive summaries retain full changed values; container summaries retain only type and immediate size. Exclusion rules are not a guarantee of sanitization.

## Complexity and limits

Parsing is linear in input length aside from native string decoding. Comparison visits object keys and array elements, sorting each object's union of keys. Record identity maps use memory proportional to the matched arrays. The bounded inputs run on the main browser thread. A Web Worker is a potential extension if larger limits can be justified with responsiveness testing.

## UI and security boundaries

All fixture content is written through text nodes. No application fetch, analytics, localStorage or cookies are used. File validation errors preserve the prior editor value, invalidate the old report, and identify the side that failed. Concurrent input changes invalidate in-flight reads; a stale read cannot overwrite newer edits. A review download is a user-controlled Blob and contains data, not executable HTML.

Automated tests inspect app network requests during file import, unsafe HTML-like values, stale report invalidation, physical pointers, output completeness, and mobile layout. Hosting and browser extensions are separate trust boundaries. This application is not a secret scanner or API compatibility checker.
