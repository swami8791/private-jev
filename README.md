<div align="center">

# Private Jev

**Structured judgments. Explicit uncertainty. You stay in control.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3B82F6?style=for-the-badge)](src/domain.ts)
[![MCP](https://img.shields.io/badge/MCP-2_tools-8B5CF6?style=for-the-badge)](#tools)
[![TypeSafe Jev](https://img.shields.io/badge/TypeSafe-Jev-14B8A6?style=for-the-badge)](#attribution)
[![Owner only](https://img.shields.io/badge/access-owner_only-64748B?style=for-the-badge)](#security)

[![Offline tests](https://img.shields.io/badge/offline_tests-100_passed-success?style=flat-square)](#verification)
[![Retries](https://img.shields.io/badge/automatic_retries-0-success?style=flat-square)](#security)
[![Fact checking](https://img.shields.io/badge/fact_checking-not_claimed-amber?style=flat-square)](#limitations)

<br>

[Quick start](#quick-start) · [Tools](#tools) · [How it works](#how-it-works) · [Security](#security) · [Attribution](#attribution)

</div>

<br>

<img src="assets/workflow.svg" alt="Supplied text passes owner authorization and validation, then TypeSafe Jev returns a structured judgment with uncertainty for human review." width="100%">

---

## What it does

Private Jev is Nehal Swami's owner-private integration around **TypeSafe's Jev model**. It exposes a small MCP interface for scoring and classification, with native confidence kept separate from the answer. It is an integration project—not a newly trained model.

- **Score** text against an explicit rubric; preserve the raw score and normalize it to 0–100.
- **Classify** into supplied categories, including an explicit `uncertain` option.
- **Estimate yes/no probability** with `noul`; do not invent a confidence field.
- **Flag review** without triggering downstream actions.
- **Fail closed** when owner authorization, configuration, input, or provider output is invalid.

## Quick start

Node **22.13+** is required. Offline core tests need no API key and make no live requests:

```bash
git clone https://github.com/swami8791/private-jev.git
cd private-jev
npm test
```

For full application development:

```bash
npm ci
npm run typecheck
npm run build
npm run test:worker
```

`test:worker` requires the build output and local loopback sockets. The application retains its Sites/Vinext starter and Cloudflare Worker integration. Framework builds may require the supported Sites development environment; this is not a generic standalone MCP hosting recipe.

### Runtime configuration

[`.env.example`](.env.example) documents names only. Configure actual values in the hosting platform's native runtime/secret settings—never in Git, chat, the client bundle, or README:

| Name | Purpose |
| --- | --- |
| `TYPESAFE_API_KEY` | Server-only TypeSafe API secret |
| `JEV_OWNER_SITE_USER_ID` | Exact trusted Site-scoped owner identity |

The original private Site project identifier was intentionally removed from this export's `.openai/hosting.json`. Restore the correct authorized project association through the supported Sites workflow before any deployment. This repository does **not** automatically deploy or change the existing Site.

**Do not expose the Worker directly on an untrusted public origin.** Only the trusted Sites gateway may supply `oai-authenticated-user-id`; a locally supplied header is not proof of identity.

## Tools

| Tool | Behavior |
| --- | --- |
| `jev_status({})` | Reports configuration presence and the caller's own Site-scoped identity. Does not contact TypeSafe. |
| `jev_evaluate({ state, questions, sources? })` | Owner-only evaluation of supplied text. Makes one provider request; live use can consume TypeSafe credits. |

Supported MCP methods: `server/discover`, `tools/list`, and `tools/call`. The adapter declares protocol version `2026-07-28`; it is not a claim of universal client compatibility.

Example **input shape**, not a recorded result:

```json
{
  "state": "A fictional team makes software for routing customer support tickets.",
  "questions": {
    "relevance": {
      "type": "score",
      "instructions": "Rate relevance to customer support automation using only the text.",
      "criteria": ["Not relevant", "Somewhat relevant", "Directly relevant"]
    },
    "category": {
      "type": "choice",
      "instructions": "Choose the primary topic.",
      "criteria": {
        "support": "Customer support automation",
        "finance": "Financial reporting",
        "uncertain": "Insufficient information"
      }
    }
  }
}
```

## How it works

1. The trusted gateway provides caller identity.
2. The service verifies the caller matches the configured owner.
3. Strict schemas bound input size and reject unknown fields.
4. One fixed HTTPS request goes to `https://api.typesafe.ai/v1/systemone`, with pinned model `jev-1.14.0`.
5. The response is bounded and validated before normalization.
6. The caller receives answers, confidence where supported, review flags, usage, and an explicit `not_fact_checked` label.

| File | Responsibility |
| --- | --- |
| [`src/domain.ts`](src/domain.ts) | Input validation, question types, output validation and normalization |
| [`src/service.ts`](src/service.ts) | Owner checks, provider request, timeout and sanitized errors |
| [`src/mcp.ts`](src/mcp.ts) | MCP schemas and protocol adapter |
| [`worker/index.ts`](worker/index.ts) | Worker routing and server-side environment binding |
| [`tests/`](tests/) | Offline domain, service, MCP and Worker regression tests |

## Security

- Authorization precedes evaluation; missing identity or configuration fails closed.
- Fixed provider destination; redirects are returned and rejected, never followed.
- No automatic retries; a 20-second deadline covers headers and body.
- Request cap: 32 KiB. Provider response cap: 128 KiB. Up to eight questions.
- Runtime secrets stay server-side; errors do not echo provider payloads or credentials.
- Source URLs are unverified metadata: not fetched and not sent upstream.
- No application payload storage or logging is implemented. Provider data handling is a separate consideration.

See [`SECURITY.md`](SECURITY.md). Never send sensitive or regulated data without assessing the provider, contracts, and intended use.

## Verification

- **October 31, 2026:** `npm test` rerun against this sanitized export on Node 24.22.1: **100 passed, 0 failed**, with injected mocks and no provider calls.
- **October 25, 2026 historical evidence:** 100 core tests plus five offline Worker integration tests, full/core typechecks, lint, and builds were reported passing at the source commit.
- **October 25 historical live check:** exactly one approved synthetic end-to-end evaluation succeeded after the transport fix. This proves that flow worked then—not broad accuracy, calibrated confidence, or present-day provider availability.
- Full framework builds and Worker tests were **not rerun for this GitHub export**.

Source baseline: `fe80d3b377c2eeec196aa2adb63dae54ca6df2fa`. Core implementation is unchanged. Documentation, example configuration, and export hygiene are described in [`docs/source-provenance.md`](docs/source-provenance.md). Earlier files under `docs/` are historical development records; their “not deployed” statements describe earlier stages, not current status.

## Limitations

Model judgments are **not independent fact verification**. Confidence is model-reported, not measured accuracy. Review thresholds are provisional. The app does not browse sources, train a model, autonomously act, or establish suitability for clinical, legal, financial, or other high-stakes decisions. There is no automated live-test or deployment workflow in this repository.

## Attribution

- **Nehal Swami:** project direction, integration concept, and Private Jev application ownership.
- **AI-assisted implementation:** built with assistance from OpenAI ChatGPT/Codex; this is not a claim that every line was manually authored by Nehal.
- **TypeSafe:** creator/provider of the underlying Jev model and API. Private Jev does not claim authorship or training of that model.
- **Starter and dependencies:** Sites/Vinext, Cloudflare, React, shadcn and other upstream packages retain their respective rights and license terms. Vendored license notices are preserved.

No blanket open-source license is asserted for this private repository. Review component licenses and ownership before any redistribution.

---

<div align="center">

**A judgment is a signal—not a fact, and not permission to act.**

</div>
