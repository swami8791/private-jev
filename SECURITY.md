# Security boundaries

Never commit API keys, runtime environment files, credentials, access tokens, owner identifiers, or deployment archives. `.env.example` contains empty placeholders only.

The MCP service trusts identity supplied by the Sites gateway. Do not run it as an unauthenticated public Worker or treat caller-supplied local headers as proof of identity. Runtime secret values belong in the hosting platform's native secret settings.

Report suspected vulnerabilities privately to the repository owner. Do not place secrets, private payloads, or exploit details in public issues. If a secret is exposed, revoke/rotate it at the provider; deleting a Git file does not remove it from history.

This integration does not independently verify facts or authorize consequential actions. Review provider data-handling policies before supplying confidential or regulated data. No new deployment, credentials, or live provider calls are authorized by cloning or testing this repository.
