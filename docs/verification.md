# Verification and handoff — 2026-10-25

Project: `<original private checkout>`
Branch: `feat/private-jev` (new isolated Git repository, no remote).
Starter: installed official Sites 1.1.2 Vinext starter, portable profile.
Runtime: Node 22.23.1; TypeScript 5.9.3; Vinext 1.0.0-beta.5.

| Check | Result |
|---|---|
| Task 1 TDD | 51 assertions failed against stubs, then 51 passed |
| Task 2 TDD | 21 new tests failed, then all 72 passed |
| Task 3 TDD | 14 new tests failed, then all 86 passed |
| `npm test` | 92 passed, 0 failed; provider requests mocked |
| Independent reviewer `npm test` | 86 passed |
| `npm run typecheck` | Passed |
| `npm run typecheck:core` | Passed |
| `npm run build:core` | Passed; dist-core JS/declarations |
| `npm run lint` | Passed |
| `npm run build` | Passed; dist/client and dist/server |
| Compiled-core synthetic fixture | Passed; 1 mock request, 0 live requests |
| Client artifact scan | No TypeSafe endpoint or runtime secret/owner binding names |
| Independent review | No blockers; sole minor subsequently resolved with regression tests, see review.md |

Node experimental coverage: source line coverage 100%; branch coverage domain 96.61%,
MCP 93.94%, service 91.94%. Function coverage service 87.50%, domain/MCP 100%.
No formatting script was supplied by the starter. Build prints an informational Vinext
route-classification notice; no build errors. The custom MCP path is dispatched by the
Worker entrypoint and is present in the server artifact.

Initial dependency installation failed due to home-cache writes and sandbox DNS ENOTFOUND.
After project-local cache configuration and approved escalation, the unchanged official
starter dependency lockfile installed from registry.npmjs.org (688 packages). Two upstream
esbuild-kit deprecation warnings occurred. No unrecognized sources or plugin installation.

## Remaining gates

No browser visual QA, native hosted authentication/access check, plugin installation or
discovery, model availability API query, or live TypeSafe smoke test was performed.
Neither config flags nor build success prove connectivity. No Site was created or published.
No credentials were read/configured; no persistent access, bypass token or remote Git was set.
Only this new project was written. Founder Signal, REA and existing integrations were untouched.

Next blocker: verify a supported user-operated secret entry surface for TYPESAFE_API_KEY
outside chat/files/visible tool arguments. No such surface has been verified. See README
for the later authorized owner-ID setup and one-request smoke-test conditions.

Supporting local command output is retained in `outputs/verification/` (ignored by Git).
The execution ledger is preserved in `docs/progress.md`.

## Follow-up verification

Explicitly authorized HTTPS schema alignment: six regression cases added. Affected suite
failed 2/20 before the fix, then passed 20/20. Full suite now passes 92/92. Both typechecks,
both builds, lint, experimental coverage, compiled-core synthetic fixture (including uppercase
HTTPS preservation), and client artifact scan were rerun successfully. No deferred findings
remain. No credentials, live provider calls, publication or unrelated modifications.

## Hosted MCP compatibility correction

The first canonical-plugin status call returned INVALID_PARAMS (-32602). The adapter
incorrectly treated standard protocol `_meta` as an unknown parameter and required
`arguments` for a zero-argument tool. Official reference:
https://modelcontextprotocol.io/specification/2026-07-28/schema#calltoolrequestparams

The raw platform request was not captured; regressions use the official documented envelope,
which deterministically reproduced rejection. Accept object-valued `_meta` as opaque request
metadata and default omitted arguments to `{}`. Metadata never supplies authorization and
is never echoed or forwarded upstream. Unsupported continuation parameters remain rejected:
this integration does not implement multi-round-trip tools. Tool inputs stay strict.

Eight tests added: affected suite RED 23/28, GREEN 28/28; full suite 100/100. Full/core
TypeScript checks, lint, core build and Vinext production build pass. Hosted read-only status
verification follows deployment; no TypeSafe evaluation call is authorized or performed.

## Worker transport compatibility correction

See transport-diagnosis.md: unsupported redirect:error threw before dispatch in workerd.
Changed to manual with explicit rejection via the existing non-OK response branch.
105 tests now pass across npm test (100) and npm run test:worker (5). Full/core typechecks,
core/Vinext builds and lint pass. No additional live provider calls; live connectivity
is still unverified after this fix and requires renewed approval.
