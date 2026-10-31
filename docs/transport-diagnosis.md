# Transport diagnosis — 2026-10-25

Parent's single approved synthetic evaluation returned PROVIDER_UNAVAILABLE. No further
live provider request was made in diagnosis or verification.

## Established defect

The shipped fetch used `redirect: 'error'`. Cloudflare Workers supports only `follow`
and `manual`; it throws a TypeError during request construction for `error`, before
sending a request. Official documentation:
https://developers.cloudflare.com/workers/runtime-apis/request/#properties

Reproduced against the exact built Worker in the local workerd/Miniflare runtime with
every outbound fetch intercepted. Synthetic credentials only; no environment files loaded.
Result: PROVIDER_UNAVAILABLE, intercepted requests = 0. Local-only instrumented bundle
reported the invalid redirect TypeError. No diagnostic logging was added to production.

The correction uses `manual`, with the existing non-OK status branch rejecting every
3xx response. It never follows Location, never changes destination, and never retries.

## Evidence boundaries

- Known HTTP status: no upstream status is available. Existing Sites invocation metadata
  records /mcp HTTP 200 and outcome ok at 2026-10-25T22:55:48.159Z, wall time 1ms,
  request ID 4a3082f4573b0bc0d0852e59eb13f3f3. HTTP 200 is the MCP transport envelope,
  not a TypeSafe HTTP response. Error-only logs were empty; no raw exception was recorded.
- Exception mapping: service catches non-JevError exceptions as PROVIDER_UNAVAILABLE.
  The deterministic Worker request-construction TypeError matches the reported failure.
- Provider HTTP errors map separately (PROVIDER_AUTH / PROVIDER_INVALID_REQUEST /
  PROVIDER_BUSY / PROVIDER_ERROR); schema failures map to MALFORMED_RESPONSE.
- The connector's INVALID_ARGUMENT label wraps the MCP tool error; it does not establish
  provider request rejection. No evidence supports blaming an outage, bad key or schema.
- Live connectivity after correction remains unverified and requires new approval.

## Regression and validation

Added five tests against the deployed artifact using installed Miniflare/workerd:
one mocked successful evaluation and HTTP 301/302/307/308 rejection with exactly one
intercepted request each. All five failed before the fix and passed afterward.
`npm run test:worker` runs them after `npm run build`; it requires local loopback sockets.
All outbound requests are intercepted, including unexpected redirect destinations.

100 existing tests pass. Full/core typechecks, core/Vinext builds and lint pass.
Source changes preserve owner authorization, secret handling, deadline, response cap,
fixed destination, cache:no-store, zero retries and no-payload-log policy.
