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
  version: "0.3.0"
  repository: https://github.com/1Shot-API/skills
---

# CoinOperated (agent coordinator)

Orchestrate **linking a coding-agent wallet** to [CoinOperated](https://coinoperated.finance), authenticating to the REST API, and **pulling owner USDC into the agent wallet** via the 1Shot public relayer. CoinOperated never holds agent private keys. The human owner confirms the agent address and signs a limited Arc USDC spending permission in the browser.

Humans usually paste a prompt that points here (or at the product mirror):

```text
Follow https://coinoperated.finance/agents/skill.md to set up a CoinOperated agent wallet and link it to my account.
```

## Install companion skills

**Cursor (global):**

```bash
npx skills add 1Shot-API/skills/coinoperated -g -a cursor -y
npx skills add 1Shot-API/skills/agent-wallet -g -a cursor -y
npx skills add 1Shot-API/skills/public-relayer -g -a cursor -y
```

**Any agent / cloud sandbox (no Cursor):**

```bash
git clone --depth 1 https://github.com/1Shot-API/skills.git
cd skills/agent-wallet/scripts && npm install
# Foundry cast is OPTIONAL for the CoinOperated path (create / SIWE sign / auth7702 / redelegate).
# Only send/mktx/sign-typed still need cast: https://getfoundry.sh
```

Skill roots after clone: `skills/coinoperated`, `skills/agent-wallet`, `skills/public-relayer`. Human overview: [https://coinoperated.finance/guides/agents](https://coinoperated.finance/guides/agents).

## Architecture: pull funds, then trade with the agent wallet

The owner grant is an ERC-20 spending permission **to the agent address**. Treat it as a **funding faucet**, not as the vehicle for complex work:

1. **Redeem the grant** through the relayer to move Arc USDC from the owner → **the agent’s own address** (plus the relayer fee leg).
2. **Trade / route / LiFi / multi-hop logic runs from the agent wallet** with those funds — outside the owner’s caveat scope.

Do **not** try to encode LiFi routes, bridges, or multi-call trading under the owner delegation. Redelegations may only **narrow** the parent; putting complex calldata in the redeem usually fails caveat checks. Pull USDC to yourself first, then operate as a normal self-custodied agent EOA.

## Phase 1 — Local wallet (agent-wallet)

1. Follow skill **agent-wallet**: `doctor`, then `create` (or `address` if a wallet already exists). After `npm install` under `scripts/`, create/sign work **without Foundry**.
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
2. Build a SIWE message for the **agent** address — use the exact EIP-4361 template in [references/siwe-agent.md](./references/siwe-agent.md) (includes **Issued At**). Prefer that template over guessing `siwe` package fields (`siwe` is **not** a dependency of agent-wallet).
3. Sign with **agent-wallet** `sign-personal --message …` (the full prepared string). Never dump private keys.
4. `POST https://coinoperated.finance/api/auth/siwe/verify/token` with `{ "message", "signature" }` → `{ accessToken, tokenType, expiresIn, user, signerNonce }`.
   - Fails if the address is not yet a primary or registered additional signer.
   - **`signerNonce`**: hex correlation nonce for Agent Activity webhooks (see Phase 4). Persist it with the token.
5. Call authenticated routes with `Authorization: Bearer <accessToken>`.

**Source of truth for paths and schemas:** [https://coinoperated.finance/openapi.yaml](https://coinoperated.finance/openapi.yaml) (human UI: [/docs/api](https://coinoperated.finance/docs/api)). Prefer OpenAPI over inventing endpoints.

First useful check after linking: `GET /api/agent/delegations` (Bearer-only; lists stored grants for the JWT signer).

### Persisting `parent.json` (avoid double-encoding)

Each row’s **`delegation` field is already a JSON string** (serialized MetaMask Delegation), not a nested object.

```bash
# Correct — write the string body once
node -e "const r=JSON.parse(require('fs').readFileSync(0,'utf8')); const d=r.result?.[0]??r[0]; const raw=typeof d.delegation==='string'?d.delegation:JSON.stringify(d.delegation); require('fs').writeFileSync('parent.json', raw);"
```

- If you `JSON.stringify(row.delegation)` when it is already a string, `aw redelegate` rejects the double-encoded parent.
- `permissionContext` (when present) is typically hex / encoded chain data — prefer the `delegation` string for `parent.json`.

## Phase 4 — Pull USDC via public-relayer (Path D2), then act

Follow skill **public-relayer** Path **D2** and [Example 0d](../public-relayer/references/examples.md). Summary for CoinOperated:

### Chain / RPC constants (Arc mainnet)

| Item | Value |
|------|--------|
| Chain id (decimal) | `5042` |
| Chain id (hex) | `0x13b2` |
| Public RPC | `https://rpc.mainnet.arc.io` |
| Relayer JSON-RPC | `https://relayer.1shotapi.com/relayers` |
| Agent Activity webhook | `https://coinoperated.finance/api/webhooks/relayer` |

`GET /api/chains` may not list the RPC URL — use the table above for Arc.

### First redeem on a chain: EIP-7702 upgrade (required)

The agent EOA must become a MetaMask **Stateless7702** smart account on Arc before (or as part of) the first redeem. Sign auth with agent-wallet, then pass it on **both** estimate and send:

```bash
node scripts/aw.mjs auth7702 --rpc https://rpc.mainnet.arc.io --chain-id 5042
# → { authorization: { address, chainId, nonce, r, s, yParity }, contractAddress, … }
```

```ts
const sendParams = {
  chainId: "5042",
  authorizationList: [authorization], // from aw auth7702 — omit on later txs once upgraded
  transactions: [{ permissionContext, executions }],
  // …
};
```

`aw auth7702` uses the account’s **current pending nonce** (relayer sends the outer tx). Do **not** use viem `executor: "self"` — that signs nonce+1 and breaks relayer redemption. Details: **agent-wallet** / **public-relayer**.

### Spend steps (funding pull)

1. `relayer_getCapabilities` for `"5042"` → **`targetAddress`**, **`feeCollector`**, USDC token.
2. Write `parent.json` from `GET /api/agent/delegations` as above (raw delegation string).
3. **First use on Arc:** `auth7702` (see above) and keep `authorization` for `authorizationList`.
4. Child input: `to: targetAddress`, `erc20TransferAmount` ≥ **this** fee + pull amount, fresh `salt`. Then:

   ```bash
   node scripts/aw.mjs redelegate --parent ./parent.json --file ./child-input.json
   ```

5. Build `permissionContext` in **leaf-to-root** order: **`[child, parent]`** (first entry’s `delegate` must be the relayer `targetAddress`). Root-first `[parent, child]` fails with *First delegation's delegate must be the relayer Target wallet*.
6. `executions[]` for this redeem should be:
   - ERC-20 `transfer` of the **fee** → `feeCollector`
   - ERC-20 `transfer` of the **pull amount** → **agent address** (your funding)
7. Estimate → send with price-lock `context`, app **`delegationSecret`**, and Agent Activity fields below.
8. After USDC lands in the agent wallet, run LiFi / swaps / other logic **from the agent wallet** (separate txs; not under the owner grant).

### Agent Activity: `destinationUrl` + `memo` JSON

So spends appear under the owner’s **Agent Activity** tab, every `relayer_send7710Transaction*` must include:

```ts
destinationUrl: "https://coinoperated.finance/api/webhooks/relayer",
memo: JSON.stringify({
  source: "coinoperated",           // required literal
  signerAddress: agentAddress,      // 0x… agent EOA (additional signer)
  nonce: signerNonce,               // from SIWE verify/token (0x + 32 hex)
  justification: "Pull 5 USDC for LiFi route", // optional; shown in UI
}),
```

Constraints: `memo` ≤ 256 characters total; omit keys and the row will not ingest (`GET /api/user/agent-activity` stays empty). `signerNonce` is **not** the SIWE login nonce — it is the dedicated field on the token response.

Do **not** use `aw send` for the grant redeem — that broadcasts a raw EOA tx and is not the CoinOperated funding flow.

## Non-goals

- Full DCA / triggered-plan tutorials — use OpenAPI after auth; on-chain work still goes through **public-relayer** when required.
- Embedding `wallet.1shotapi.com` Host RPC — skill **1shot-wallet** (owner UI, not the agent EOA).

## See also

- [references/deeplinks.md](./references/deeplinks.md)
- [references/siwe-agent.md](./references/siwe-agent.md)
- Skill **agent-wallet** — local EOA create / `sign-personal` / `auth7702` / `redelegate`
- Skill **public-relayer** — `relayer_*` estimate/send, Path D, Example 0d (leaf-to-root chains + `authorizationList`)
- Skill **1shot-wallet** — embedded wallet Host Layer (owner UI, not agent EOA)
