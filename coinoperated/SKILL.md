---
name: coinoperated
description: >-
  High-level coordinator for CoinOperated (coinoperated.finance) agent setup:
  create a local agent EOA via agent-wallet, emit a user deeplink to register
  an additional signer and spending delegation, wait for the user, SIWE for a
  Bearer JWT and call the REST API using OpenAPI, then spend via public-relayer
  (agent-wallet redelegate + relayer_estimate/send7710Transaction, including
  batched executions and multichain). Use when linking an agent wallet to
  CoinOperated, CoinOperated agent onboarding, SIWE verify/token for additional
  signers, GET /api/agent/delegations, generating coinoperated.finance/agent/link
  URLs, or redeeming a CoinOperated agent grant through the 1Shot relayer. Pair
  with agent-wallet for keys and public-relayer for JSON-RPC; do not use for
  Host RPC wallet embeds (1shot-wallet).
license: MIT
metadata:
  author: 1Shot-API
  version: "0.2.0"
  repository: https://github.com/1Shot-API/skills
---

# CoinOperated (agent coordinator)

Orchestrate **linking a coding-agent wallet** to [CoinOperated](https://coinoperated.finance), authenticating to the REST API, and **spending** under the owner’s grant via the 1Shot public relayer. CoinOperated never holds agent private keys. The human owner confirms the agent address and signs a limited Arc USDC spending permission in the browser.

Humans usually paste a prompt that points here (or at the product mirror):

```text
Follow https://coinoperated.finance/agents/skill.md to set up a CoinOperated agent wallet and link it to my account.
```

Optional Cursor install (you may run these yourself — do not require the user to):

```bash
npx skills add 1Shot-API/skills/coinoperated -g -a cursor -y
npx skills add 1Shot-API/skills/agent-wallet -g -a cursor -y
npx skills add 1Shot-API/skills/public-relayer -g -a cursor -y
```

Also follow **agent-wallet** for the local EOA and **public-relayer** for `relayer_*` redeem. Human overview: [https://coinoperated.finance/guides/agents](https://coinoperated.finance/guides/agents).

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

First useful check after linking: `GET /api/agent/delegations` (Bearer-only; lists stored grants for the JWT signer). Persist `delegation` / `permissionContext` from that response for Phase 4.

## Phase 4 — Spend via public-relayer (Path D2)

The owner grant is **to the agent address**, not to the relayer. To execute work gas-abstracted:

1. Follow skill **public-relayer** Path **D2** and [Example 0d](../public-relayer/references/examples.md) (agent-wallet + redelegate).
2. `relayer_getCapabilities` for the work chain (Arc USDC for CoinOperated grants) → note **`targetAddress`** and **`feeCollector`**.
3. Write `parent.json` from the stored signed parent delegation.
4. First use on that chain: `node scripts/aw.mjs auth7702 --rpc … --chain-id …` and keep `authorization` for send.
5. Child input: `to: targetAddress`, `erc20TransferAmount` capped to **this** fee + work, fresh `salt`. Then:

   ```bash
   node scripts/aw.mjs redelegate --parent ./parent.json --file ./child-input.json
   ```

6. Build `permissionContext` as `[parent, child]` (`encodeDelegations` / `toRelayerJson`). Bundle fee `transfer` to `feeCollector` + work in `executions[]` (**batch** on one chain).
7. `relayer_estimate7710Transaction` → adjust fee/re-sign if needed → `relayer_send7710Transaction` with estimate `context`, optional `memo`, and a reused app **`delegationSecret`**.
8. **Multichain** (fee on one chain, work on another, or multi-leg): repeat redelegate/`auth7702` per chain as needed; use `relayer_estimate7710TransactionMultichain` / `relayer_send7710TransactionMultichain` and `contextByChainId` (see public-relayer).

Do **not** use `aw send` for this path — that broadcasts a raw EOA tx and is not the CoinOperated grant redeem flow.

## Non-goals

- Full DCA / triggered-plan tutorials — use OpenAPI after auth; execution still goes through **public-relayer** when on-chain work is required.
- Embedding `wallet.1shotapi.com` Host RPC — skill **1shot-wallet** (owner UI, not the agent EOA).

## See also

- [references/deeplinks.md](./references/deeplinks.md)
- [references/siwe-agent.md](./references/siwe-agent.md)
- Skill **agent-wallet** — local EOA create / `sign-personal` / `auth7702` / `redelegate`
- Skill **public-relayer** — `relayer_*` estimate/send, Path D, Example 0d
- Skill **1shot-wallet** — embedded wallet Host Layer (owner UI, not agent EOA)
