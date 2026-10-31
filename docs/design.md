# Jev Judge MCP — approved local implementation

Two tools: jev_status({}) and jev_evaluate({state, questions, sources?}). No persistence,
telemetry, source fetching, automatic actions, retries or fallback keys/models.

The only provider destination is https://api.typesafe.ai/v1/systemone, POST bearer JSON
{model:'jev-1.14.0', state, questions}. Sources are excluded. HTTP fetch is injected for
all tests. Runtime secrets only: TYPESAFE_API_KEY and JEV_OWNER_SITE_USER_ID.
Evaluation requires nonempty visitor identity matching the configured Site-scoped owner.
Status exposes only configuration booleans, own caller ID, pinned model and disclaimer.

Inputs: body <=32768 UTF-8 bytes, nonempty state <=16384 bytes, 1–8 named questions;
IDs/choice labels match [A-Za-z][A-Za-z0-9_]{0,47}, rejecting prototype names.
Instructions <=1024 bytes, descriptions <=512 bytes, aggregate <=8192 bytes.
Scores: 2–10 ordered descriptions. Choices: 2–10 descriptions keyed by label including
uncertain. Noul: optional true/false descriptions. Sources: <=3 title/HTTPS URL pairs,
title <=120 characters, URL <=2048 characters. HTTPS scheme matching is case-insensitive
in both the tool schema and runtime URL parser. Preserve the original source URL text;
URLs remain unverified metadata and are never fetched. Reject unknown properties and empty values.

Official response: model, answers, usage:{input_tokens,output_tokens}. Score:
{type,score,confidence,legend,probabilities}; Choice:{type,choice,confidence,probabilities};
Noul:{type,noul}. Validate exact answer names/types, ranges, keys and distribution totals
(tolerance .02). Preserve values. Score normalized=score/(levels-1); score_100=normalized*100.
Noul exposes yes_probability and confidence:null. Review when confidence<.70,
choice=uncertain, or .20<noul<.80. Thresholds are provisional, not accuracy guarantees.
Return original criteria, TypeSafe provider, requested/returned models, UTC timestamp,
usage, locally generated request ID, sources marked unverified, overall/per-answer needs_review,
verification_status:not_fact_checked and exact disclaimer:
Model judgment on supplied content; not independent fact verification.

Transport: 20s overall provider deadline, 128KiB streamed response cap, redirect:manual with all non-OK responses (including redirects) rejected,
cache:no-store, one request. Errors expose codes only. No logs or raw provider error bodies.

Sites: official installed starter 1.1.2; stateless POST /mcp protocol 2026-07-28,
server/discover, tools/list, tools/call. Documented identity header:
oai-authenticated-user-id. Trust only behind Sites gateway which authenticates viewers;
local requests cannot prove identity. Missing visitor rejects even service bypass.
No project_id or publication. Native access/plugin discovery still requires later verification.

Secure setup blocker: no verified user-operated TypeSafe secret entry surface. Do not ask
for key in chat/files/tool arguments. Later verify a supported native entry surface and exact
destination; then user enters key outside chat; inspect configured/secret status only.
No live smoke test without separate approval of one synthetic request <=4096 bytes.

## Official evidence checked 2026-10-25
- https://docs.typesafe.ai/api/system-one — HTTP envelope and named typed answers.
- https://docs.typesafe.ai/primitives/score — fractional score, indexed legend/distribution.
- https://docs.typesafe.ai/primitives/choice — label, probability map, confidence.
- https://docs.typesafe.ai/primitives/noul — noul probability; no confidence field.
- https://docs.typesafe.ai/models — jev-1.14.0 listed; recheck before live smoke test.
- https://docs.typesafe.ai/confidence — confidence differs from probability.
- https://docs.typesafe.ai/api/errors — error status mapping.
- Installed Sites references/site-mcp-server.md and identity-and-secrets.md — MCP methods,
  identity header and gateway trust. No provider request-ID header documented: use local UUID.
