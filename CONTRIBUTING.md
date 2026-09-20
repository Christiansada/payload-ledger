# Contributing

Use synthetic, minimal fixtures in issues, tests and pull requests. Never submit credentials, personal records, private URLs, or employer/customer data. Explain the expected comparison semantics before expanding rules or input limits.

Use Node.js 22.12 or newer. Run `npm ci`, `npm run check`, and `npm run test:e2e` after installing the appropriate browser as described in the README. Format changes with `npm run format`.

Parser or comparison changes need tests that cover both intended behavior and relevant ambiguity. UI changes need a keyboard and narrow-screen check. Keep error states explicit and preserve existing input on file-validation failure. Document limitations and any data format changes. Submit a focused pull request with the checks actually run, and follow the [code of conduct](CODE_OF_CONDUCT.md).

Contributions are licensed under MIT. No generated activity, copied private material or cosmetic duplicate features, please.
