# Source provenance and export hygiene

Baseline: `fe80d3b377c2eeec196aa2adb63dae54ca6df2fa`, retrieved read-only from the existing Private Jev Site source repository on October 31, 2026. This matched the saved Site version 3 source and successful historical deployment receipt.

The GitHub export preserves implementation, tests, dependency lockfile, starter files, and vendored license notices. It does not contain the original Git history, dependency installation, runtime state, secrets, or generated deployment/build artifacts.

Changes from baseline:
- Replace the outdated initial README with an accurate project overview and explicit historical/current verification distinction.
- Add a workflow SVG, security guidance, this provenance record, and a names-only `.env.example`.
- Remove the original private Site project identifier from `.openai/hosting.json` to avoid accidental targeting of the live Site.
- Replace the original personal checkout path in `docs/verification.md` with a placeholder.
- Add a `.gitignore` exception for the empty environment example.

The core TypeScript implementation is unchanged. The GitHub repository is an export, not a migration of the Site's source authority, and has no automatic deployment wiring.

Current export validation: `npm test` on Node 24.22.1, October 31, 2026: 100 passed / 0 failed. All provider traffic is mocked. No live evaluation occurred during export. Historical verification documents retain their original stage-specific results; no fresh full build, lint, or Worker integration test result is claimed.
