# Private Jev implementation plan

Spec: docs/design.md. Global constraints: isolated local project; all provider traffic mocked;
no credentials, remote creation, deployment, installation of plugins, or live calls.
Use installed Sites 1.1.2 Vinext starter, retaining sites() integration. Node 22.23.1.

## Task 1: Validated domain core
Interfaces: parseInput(unknown) -> EvaluationInput; validateAnswers(unknown, input) -> typed answers.
Write tests for strict limits, identifiers, upstream contracts, normalization, uncertainty.
Run npm test (Expected: failing assertions against stubs), implement, run npm test (Expected: pass).
Commit tested domain source and tests.

## Task 2: Transport and private tools
Interfaces: consumes Task 1 validators; createJev(config, trustedCaller, dependencies) exposes status/evaluate.
Write mocked tests for fail-closed ownership, safe status, fixed destination, one attempt,
20-second deadline, response cap, redaction and synthetic three-question fixture.
Run npm test (Expected: new failing assertions), implement, run npm test (Expected: pass).
Commit tested service source and tests.

## Task 3: Sites adapter and verification
Interfaces: consumes Task 2 service; worker /mcp handler maps documented identity and runtime bindings.
Write tests for discover/list/call, errors, request cap, no-store, missing visitor identity.
Run npm test (Expected: new failing assertions), implement minimal status page and adapter.
Run npm test, npm run typecheck, npm run build (Expected: pass if dependencies/runtime available).
Record precise build limitations otherwise. Independent read-only final review; TDD fixes.
Commit source and handoff documentation. Do not publish or connect.

## Review Focus
Inspect streaming deadlines and cancellation, malformed JSON/prototype identifiers, status redaction,
identity trust boundary and bypass rejection, probability completeness, input schema alignment,
no unintended provider traffic and preservation of Sites build integration. Native hosted access
and discovery cannot be verified locally; never claim a connected plugin.
