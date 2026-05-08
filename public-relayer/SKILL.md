---
name: public-relayer
description: Integrate a client app with the 1Shot public relayer JSON-RPC API to submit gas-abstracted EIP-7710 delegated transactions on EVM chains. Use this skill whenever a developer mentions the 1Shot relayer, gasless or gas-abstracted EVM transactions, ERC-7710 delegations, `relayer_send7710Transaction`, `relayer_send7710TransactionMultichain`, `relayer_getCapabilities`, `relayer_getFeeData`, or `relayer_getStatus`; wants to upgrade an EOA to a `7702StatelessDelegator` smart account; sign delegations with `@metamask/smart-accounts-kit`; pay relayer fees in ERC-20 tokens; lock in a gas-price quote; build a webhook receiver for relayer status events; or verify Ed25519 webhook signatures from `/.well-known/jwks.json`. Trigger this skill even when the user does not name the relayer explicitly but is clearly trying to send a gas-abstracted EVM transaction through a third-party relay using EIP-7710 / EIP-7702.
---

# 1Shot Public Relayer (EIP-7710) Integration

This skill teaches a client-side coding agent how to integrate with the **1Shot public relayer** JSON-RPC API to submit gas-abstracted ERC-7710 delegated transactions.

The relayer accepts a signed MetaMask delegation from a `7702StatelessDelegator` smart account, redeems it on-chain through a target wallet, and accepts payment in an ERC-20 token on the same chain (single-chain) or a different chain (multichain).

## When to use this skill

- Building a client app/SDK/wallet/agent that submits transactions through the 1Shot relayer
- Upgrading an EOA to a MetaMask `7702StatelessDelegator` smart account via EIP-7702
- Creating, signing, and submitting ERC-7710 delegations
- Locking in a relayer gas price for a quote window
- Receiving and verifying signed webhook events from the relayer

## Endpoints and packages

- **Relayer JSON-RPC URL**: `POST` JSON-RPC 2.0 to one of:
  - Production: `https://relayer.1shotapi.com/relayers`
  - Dev: `https://relayer.1shotapi.dev/relayers`
- **JWKS for webhook verification**: `GET https://relayer.1shotapi.com/.well-known/jwks.json` (Ed25519, `kty: "OKP"`, `crv: "Ed25519"`).
- **Client packages**:
  - `@metamask/smart-accounts-kit` for `toMetaMaskSmartAccount`, `createDelegation`, `ScopeType`, `Implementation.Stateless7702`.
  - `viem` for `createPublicClient`, `encodeFunctionData`, `signAuthorization`, `privateKeyToAccount`.
  - `@noble/ed25519` (or any Ed25519 verifier) for webhook signature verification.

## Order of operations

Follow these four steps **in order** for any new integration. Each step has a dedicated JSON-RPC method.

### Step 1 — `relayer_getCapabilities`: discover the chain, accepted tokens, and `targetAddress`

Call once per chain you want to support. The response tells you:

- Which `chainId`s are supported.
- The list of **accepted ERC-20 payment tokens** (`address`, `symbol`, `decimals`) per chain.
- The `feeCollector` address (where the fee transfer must go).
- The `targetAddress` — **this is the address the client must sign the delegation `to`**. It is the relayer's redemption account on that chain. Without delegating to this exact address, the relayer cannot redeem.

Cache the result for the session; it changes rarely.

```jsonc
// Request
{ "jsonrpc": "2.0", "id": 1, "method": "relayer_getCapabilities", "params": ["8453", "84532"] }

// Response (excerpt)
{ "result": {
  "8453": {
    "feeCollector": "0x1111...",
    "targetAddress": "0x2222...",     // ← delegate `to` this address
    "tokens": [{ "address": "0x036C...", "symbol": "USDC", "decimals": "6" }]
  }
}}
```

### Step 2 — `relayer_getFeeData`: quote a gas price and lock it for 45 seconds

Call once per `(chainId, paymentToken)` immediately before submitting. The response contains:

- `gasPrice` (hex wei) — current relayer gas price in native gas units.
- `rate` (number) — exchange rate to convert native gas cost into the payment token amount.
- `minFee` (string, in token atoms) — **the floor fee, equivalent to $0.01 in the payment token**.
- `expiry` (unix seconds) — quote validity (~45 seconds; treat anything past `expiry` as stale).
- `feeCollector`, `targetAddress` — same as `getCapabilities`; re-confirm here.
- `context` (string) — **signed price-lock context**. Pass this verbatim to the next step's `context` field to lock in this quote.

**Compute the fee amount the user must pay**:

1. Estimate `gasUsed` for the work transaction(s) (use `eth_estimateGas` or a known upper bound for the inner calls).
2. `nativeFee = gasPrice * gasUsed` (wei).
3. Convert to payment-token atoms using `rate` and the token's `decimals`.
4. **Floor**: if the converted amount is less than `minFee` (which represents $0.01), use `minFee`. Always `feeAmount = max(converted, minFee)`.

The delegation's caveat scope must allow at least `feeAmount` to be transferred to `feeCollector`. Be conservative — under-paying causes `InsufficientPayment` (4200) and the relayer will reject.

### Step 3 — `relayer_send7710Transaction` (or `_Multichain`): submit the bundle

Build the bundle on the client using `@metamask/smart-accounts-kit`:

1. **Initialize the smart account** with `toMetaMaskSmartAccount({ implementation: Implementation.Stateless7702, address: <delegator EOA address>, signer })`.
2. **(If first use)** sign an EIP-7702 `authorizationList` entry with `account.signAuthorization({ chainId, contractAddress: <statelessDelegatorImplementation>, nonce })` and include it in the request — the relayer will upgrade the EOA in-flight before redeeming.
3. **Create the delegation** with `createDelegation({ to: targetAddress (from Step 1), from: smartAccount.address, environment: smartAccount.environment, salt, scope: { type: ScopeType.Erc20TransferAmount | ScopeType.FunctionCall, ... maxAmount: feeAmount + workAmount } })`.
4. **Sign the delegation** with `smartAccount.signDelegation({ delegation })` and inline the signature.
5. **Encode each execution's calldata** (`encodeFunctionData` for the fee `transfer` to `feeCollector` and for the user's primary work).
6. **POST** the JSON-RPC body. The `params.context` field must be the **price-lock `context` string** returned from `relayer_getFeeData`, not a free-form string.

Choose the right method:

| You need …                                                                               | Use this method                              |
| ---------------------------------------------------------------------------------------- | -------------------------------------------- |
| Pay fee and execute work on the **same** chain                                           | `relayer_send7710Transaction`                |
| Pay fee on chain A and execute work on chain B (or batch multiple chains atomically)     | `relayer_send7710TransactionMultichain`      |

Both methods accept an optional **`destinationUrl`** (≤256 chars). When set, the relayer POSTs **signed Ed25519 webhook events** to that URL on every status change. **Encourage `destinationUrl` over polling** — it scales better and gives sub-second updates.

The result is a `TaskId` (single) or `TaskId[]` (multichain, in submitted order).

### Step 4 — `relayer_getStatus`: check status (or use webhooks)

If `destinationUrl` is set, **prefer the webhook** — the relayer will deliver `TransactionExecutionSubmitted` and then `TransactionExecutionSuccess` or `TransactionExecutionFailure` events. To verify each event:

1. Fetch and cache `GET https://relayer.1shotapi.com/.well-known/jwks.json` (rotates infrequently).
2. Look up the public key by `kid` from the webhook body's `keyId`.
3. Reconstruct the signed payload by removing the `signature` field, then serialize with **stable, sorted-key JSON** (use `safe-stable-stringify` or equivalent — the relayer signs the canonical form).
4. Verify with Ed25519 over UTF-8 bytes; treat the base64 `signature` as the 64-byte detached signature.

If polling is unavoidable, call `relayer_getStatus` with `{ id: <TaskId>, logs: true|false }` every 2–3 seconds and stop on a terminal status. Status codes:

| Code | Label     | Terminal? |
| ---- | --------- | --------- |
| 100  | Pending   | no        |
| 110  | Submitted | no (has `hash`) |
| 200  | Confirmed | yes (has `receipt`) |
| 400  | Rejected  | yes (has `message`) |
| 500  | Reverted  | yes (has `data`) |

## Decisions cheat sheet

- **Self-sponsored vs. sponsored**: if the same account pays the fee and executes the work, sign **one delegation** that scopes `feeAmount + workAmount` and bundle two `executions` (fee transfer + work). If a separate sponsor pays the fee, sign **two delegations** (one each from sponsor and delegator) and submit two `transactions[]` entries with their own `permissionContext`. The relayer merges them into a single `redeemDelegations` batch.
- **`ScopeType` choice**: `ScopeType.Erc20TransferAmount` is simplest and works for fee + work transfers. Use `ScopeType.FunctionCall` (token + selector) when you need broader function coverage in one batch — the `Erc20TransferAmount` enforcer can revert with `CaveatEnforcer:invalid-call-type` for some batched call patterns.
- **EIP-7702 authorization**: only one `authorizationList` entry is allowed per request. If both delegator and sponsor need an upgrade, do them in two separate calls (or upgrade one out-of-band first).
- **Salt**: always pass a fresh random 32-byte hex `salt` to `createDelegation` to avoid replay collisions.
- **BigInts to JSON**: relayer JSON-RPC requires plain JSON. Convert `bigint` values in the signed delegation struct to `0x`-prefixed hex strings before sending. Convert `Uint8Array` with `bytesToHex` from `viem/utils`.

## Minimal end-to-end shape

```ts
// 1. capabilities
const caps = await rpc("relayer_getCapabilities", [chainId]);
const { targetAddress, feeCollector, tokens } = caps[chainId];
const paymentToken = tokens.find((t) => t.symbol === "USDC")!;

// 2. fee data + price lock
const fee = await rpc("relayer_getFeeData", { chainId, token: paymentToken.address });
const feeAmount = computeFeeAmount(fee, estimatedGasUsed); // floor at fee.minFee

// 3. build, sign, submit (see examples.md for full code)
const taskId = await rpc("relayer_send7710Transaction", {
  chainId,
  context: fee.context, // ← lock in the quote
  destinationUrl: "https://my-app.example.com/relayer-webhook", // optional, recommended
  transactions: [{ permissionContext: [signedDelegation], executions: [feeTransfer, workCall] }],
});

// 4. either consume webhooks or poll relayer_getStatus
```

## Common error codes

| Code | Meaning                       | Typical fix                                                                 |
| ---- | ----------------------------- | --------------------------------------------------------------------------- |
| 4200 | Insufficient Payment          | Increase `feeAmount` and re-sign the delegation; never go below `minFee`.   |
| 4201 | Invalid Signature             | Re-sign the delegation; ensure `salt` is fresh and `signer` matches `from`. |
| 4202 | Unsupported Payment Token     | Pick a token from `relayer_getCapabilities` for the chain.                  |
| 4204 | Quote Expired                 | Re-fetch `relayer_getFeeData` and resubmit within `expiry`.                 |
| 4206 | Unsupported Chain             | Confirm the `chainId` appears in `relayer_getCapabilities`.                 |
| 4209 | Unsupported Capability        | Adjust delegation scope/caveats; check the relayer supports the call type.  |
| 4210 | Invalid Authorization List    | At most one `authorizationList` entry; verify `nonce` is current.           |
| 4211 | Simulation Failed             | The relayer pre-simulates; inspect `data` for the revert reason.            |
| 4212 | Multichain Not Supported      | Fall back to `relayer_send7710Transaction` per chain.                       |
| 4214 | Duplicate Task ID             | Omit `taskId` and let the relayer assign one, or send a fresh random hex.   |

See [references/schemas.md](references/schemas.md) for the complete error catalog and full request/response schemas.

## Composing with `webauthn-prf-wallet` for a fully non-custodial app

The public relayer pairs naturally with the **`webauthn-prf-wallet`** skill (separately installed) to build a **fully non-custodial web3 application with no vendor lock-in and no business account required**:

- `webauthn-prf-wallet` derives an EVM private key from the user's passkey via the WebAuthn PRF extension and keeps it inside an isolated iframe — the key never reaches the parent page or any server.
- That passkey-derived account is the natural **delegator** in this skill's flow: have the iframe sign the EIP-7702 authorization, the `7702StatelessDelegator` upgrade, and each `createDelegation` payload.
- The public relayer is an open JSON-RPC service (no API key, no Bearer token) that the user pays per-transaction in stablecoins. There is no relationship to lock in — anyone can stand up an alternate relayer that speaks the same `relayer_*` methods, and the client can switch by changing `RELAYER_URL`.

End-to-end, the user owns their key (passkey), pays only the per-tx fee (ERC-20), and the application owns no custodial surface and no business credentials. Reach for this combo when a developer asks for a "passkey wallet that can transact without holding ETH" or "non-custodial app with no API keys to manage." Read `webauthn-prf-wallet/SKILL.md` for the client-side wallet pattern and use this skill for the relayer JSON-RPC flow.

## Additional resources

- [references/schemas.md](references/schemas.md) — full JSON-RPC method signatures, schemas, status/error codes, JWKS body shape. Read this when you need exact parameter shapes, the complete error catalog, or the on-the-wire webhook payload format.
- [references/examples.md](references/examples.md) — runnable TypeScript patterns: single-chain self-sponsored, sponsored, multichain, webhook receiver with Ed25519 verification. Read this when you're about to write client code or want to copy a known-good integration shape.
- `webauthn-prf-wallet` skill — companion skill for client-side passkey-derived EVM keys held in an isolated iframe. Use together with this skill for a fully non-custodial setup.
- MetaMask Smart Accounts Kit guide: <https://docs.metamask.io/smart-accounts-kit/guides/delegation/execute-on-smart-accounts-behalf/>.
