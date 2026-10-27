---
name: coinoperated
description: >-
  High-level coordinator for CoinOperated (coinoperated.finance) agent setup:
  create a local agent EOA via agent-wallet, emit a user deeplink to register
  an additional signer and spending delegation, wait for the user, then SIWE
  for a Bearer JWT and call the REST API using OpenAPI. Use when linking an
  agent wallet to CoinOperated, CoinOperated agent onboarding, SIWE
  verify/token for additional signers, GET /api/agent/delegations, or
  generating coinoperated.finance/agent/link URLs. Pair with agent-wallet for
  keys; do not use for Host RPC wallet embeds (1shot-wallet) or relayer
  redeem yet (public-relayer follow-up).
license: MIT
metadata:
  author: 1Shot-API
  version: "0.1.0"
  repository: https://github.com/1Shot-API/skills
---

# CoinOperated (agent coordinator)

Orchestrate **linking a coding-agent wallet** to [CoinOperated](https://coinoperated.finance) and authenticating to the REST API. CoinOperated never holds agent private keys. The human owner confirms the agent address and signs a limited Arc USDC spending permission in the browser.

Install:

```bash
npx skills add 1Shot-API/skills/coinoperated -g -a cursor -y
```

Also install **agent-wallet** (local EOA + `personal_sign`):

```bash
npx skills add 1Shot-API/skills/agent-wallet -g -a cursor -y
```

Product overview for humans: [https://coinoperated.finance/agents](https://coinoperated.finance/agents).

## Phase 1 — Local wallet (agent-wallet)

1. Follow skill **agent-wallet**: `doctor`, then `create` (or `address` if a wallet already exists).
2. Show the user the **address only** from JSON stdout. Never open keystore or password files.
3. Pick a short display `name` for the deeplink (agent or product name, max 64 chars). Omit if none.

## Phase 2 — User grant via deeplink

1. Build the URL (URL-encode `name` when present):

   ```text
   https://coinoperated.finance/agent/link?accountAddress={address}&name={name}
   ```

   Omit `&name=…` when there is no label. Full contract: [references/deeplinks.md](./references/deeplinks.md).

2. Ask the user to open the link while signed into CoinOperated, **confirm** adding the address as an additional signer, and **approve** a spending delegation in their wallet UI.

3. **Stop and wait** until the user says they are ready. Do not poll CoinOperated for completion in this skill version.

## Phase 3 — SIWE → Bearer → API

After the user confirms they finished the link flow:

1. `GET https://coinoperated.finance/api/auth/siwe/nonce` → `{ nonce, chainId, domain }`.
2. Build a SIWE message for the **agent** address using those fields (`statement`: `Sign in to CoinOperated`, `uri`: `https://coinoperated.finance`, `version`: `1`). Details: [references/siwe-agent.md](./references/siwe-agent.md).
3. Sign with **agent-wallet** `sign-personal --message …` (the prepared SIWE string). Never dump private keys.
4. `POST https://coinoperated.finance/api/auth/siwe/verify/token` with `{ "message", "signature" }` → `{ accessToken, tokenType, expiresIn, user }`. Fails if the address is not yet a primary or registered additional signer.
5. Call authenticated routes with `Authorization: Bearer <accessToken>`.

**Source of truth for paths and schemas:** [https://coinoperated.finance/openapi.yaml](https://coinoperated.finance/openapi.yaml) (human UI: [/docs/api](https://coinoperated.finance/docs/api)). Prefer OpenAPI over inventing endpoints.

First useful check after linking: `GET /api/agent/delegations` (Bearer-only; lists stored grants for the JWT signer).

## Non-goals (v1)

- Relayer submit / redeem / spend execution — deferred; use **public-relayer** when that path is documented for CoinOperated.
- Full DCA / triggered-plan tutorials — use OpenAPI after auth.
- Embedding `wallet.1shotapi.com` Host RPC — skill **1shot-wallet**.

## See also

- [references/deeplinks.md](./references/deeplinks.md)
- [references/siwe-agent.md](./references/siwe-agent.md)
- Skill **agent-wallet** — local EOA create / `personal_sign`
- Skill **public-relayer** — EIP-7710 submit (later CoinOperated spend path)
- Skill **1shot-wallet** — embedded wallet Host Layer (owner UI, not agent EOA)
