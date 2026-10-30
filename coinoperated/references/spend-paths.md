# Spend paths after linking

Two redeem patterns share the same setup (`auth7702`, redelegate to relayer `targetAddress`, leaf→root `[child, parent]`, estimate→send). Pick by **user intent**.

## Path A — Direct payment to a recipient (one redeem)

Use when the user asks to **send / pay / transfer $X to `0x…`** and the owner grant’s ERC-20 caveats allow a simple `transfer` to that address.

`executions[]` in **one** `relayer_send7710Transaction`:

1. ERC-20 `transfer(feeCollector, feeAtoms)` — relayer fee (`requiredPaymentAmount` from estimate)
2. ERC-20 `transfer(recipient, amountAtoms)` — the user’s payment

Child `maxAmount` ≥ `feeAtoms + amountAtoms`. No intermediate pull to the agent.

Runnable walkthrough: [../scripts/arc-usdc-transfer.mjs](../scripts/arc-usdc-transfer.mjs) with `--to 0xRecipient`.

## Path B — Pull to agent, then trade (default for complex work)

Use when the user wants the agent to **hold funds** and later run LiFi, multi-hop, or anything beyond a single ERC-20 transfer under the owner grant.

`executions[]`:

1. Fee → `feeCollector`
2. Pull → **agent address**

Then, in a **separate** flow, spend from the agent wallet (own balance). Do not put LiFi calldata under the owner redelegation.

Same script: `--to` omitted or `--to` = agent address.

## Shared mechanics (both paths)

| Step | Detail |
|------|--------|
| Chain | Arc `5042`, RPC `https://rpc.mainnet.arc.io` |
| Relayer | `https://relayer.1shotapi.com/relayers` |
| First use | `aw auth7702` → `authorizationList` on estimate **and** send |
| Order | `permissionContext = [child, parent]` |
| Fee units | Prefer `estimate.requiredPaymentAmount` (**atoms**). `getFeeData.minFee` is a **decimal** (`"0.01"`) — `parseUnits`, never `BigInt(minFee)` |
| Quote TTL | ~30s; if expired under a user fee cap, re-estimate and send only if still ≤ cap |
| Retries | Retry estimate on `ECONNRESET` / fetch failures. After a possible send, poll `relayer_getStatus` — do not double-submit |
| cwd | From **agent-wallet** skill root: `node scripts/aw.mjs …` |

## Prepare during linking (no funds moved)

While waiting for the user to finish the deeplink (or right after SIWE), **read-only** prep is encouraged:

1. `cd …/agent-wallet/scripts && npm install` if `doctor.depsOk` is false
2. `relayer_getCapabilities(["5042"])` — cache `targetAddress`, `feeCollector`, USDC
3. After SIWE: `GET /api/agent/delegations` — write `parent.json` (raw `delegation` string)
4. Optional: check agent bytecode on Arc; if empty, plan to attach `authorizationList` on first redeem
5. Do **not** estimate/send or move USDC until the user asks for a spend
