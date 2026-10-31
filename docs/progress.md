# SDD ledger — plan: docs/plan.md
Pre-flight: Task 1 parsed input/answers consumed by Task 2; Task 2 service consumed by Task 3. Consistent.
Ruling: request_id is a local correlation UUID, not an undocumented provider header — official API docs have no request ID contract — cost: cannot correlate with provider support directly.
Ruling: use existing isolated new repository, not a worktree of unrelated code — user requires new project — cost: no upstream merge target.
Task 1: complete (commits eafad01..fa69d10, tests: npm test → # duration_ms 83.963042)
Task 2: complete (commits fa69d10..5ba6da9, tests: npm test → # duration_ms 93.676417)
Task 3: checks passed: npm run typecheck, npm run typecheck:core, npm run build:core, npm run lint, npm run build.
Ruling: disable starter mockAuth for this private integration — synthetic local identities must not appear authenticated — cost: preview cannot simulate login automatically.
Task 3: complete (commits 5ba6da9..df47c1e, tests: npm test → # duration_ms 90.432042)
Final review: independent read-only reviewer inspected eafad01..df47c1e and independently ran 86 tests; no Critical or Important findings.
Final: minor (deferred): source URL JSON Schema pattern ^https: rejects uppercase HTTPS schemes accepted by new URL() in the parser; align schema/parser in a later change. No security impact because source URLs are never fetched.
Final: Ruling: hosted gateway enforcement/access/native discovery remain unverified — deployment is explicitly outside this turn — cost: must verify before claiming secure hosted connection.
Final: Ruling: live TypeSafe compatibility/credentials remain unverified — all provider traffic is mocked per authorization — cost: successful mocks do not prove live compatibility or connectivity.
Ruling: preserve local feat/private-jev branch without merge/push menu — user explicitly scoped work to isolated local source, tests and review — cost: integration remains a later action.

Follow-up: user explicitly requested closing the deferred URL schema finding. Case-insensitive HTTPS is now accepted by both schema and parser, with source text preserved and no fetching. Six regression cases added; uppercase/mixed-case failed before fix (18/20 affected tests passed). No deferred findings remain.
Follow-up verification: affected tests 20/20; full tests 92/92; full/core typechecks, core/Vinext builds, lint, coverage and compiled-core mock fixture passed. Client artifact scan found no endpoint or runtime binding names.
MCP compatibility follow-up: parent observed actual jev_status INVALID_PARAMS (-32602). Official 2026-07-28 CallToolRequestParams includes protocol _meta and optional arguments. Existing adapter rejected both cases. Added eight tests; five failed before the fix, affected suite 28/28 after, full suite 100/100. Metadata remains opaque, is not echoed/forwarded, and cannot supply identity; unknown tool fields and nonowner calls still fail. Full/core typechecks, both builds and lint passed.
Transport follow-up: reproduced PROVIDER_UNAVAILABLE in actual local Worker runtime with zero intercepted outbound requests; invalid redirect:error TypeError established. Ruling: replace unsupported redirect:error with manual plus rejection of all non-OK statuses — preserves no-follow security requirement on Workers — cost: redirects return sanitized PROVIDER_ERROR rather than fetch rejection. Five Worker tests RED 0/5 → GREEN 5/5; 100 existing tests, full/core typechecks, builds and lint pass. No additional live provider calls.
