---
name: 1shot-wallet
description: >-
  Integrate the 1Shot embedded wallet (OWS Host Layer) with @1shotapi/ows-provider.
  Use when embedding wallet.1shotapi.com, wiring OWSProxy, EIP-1193, credentials,
  or custom RPC such as configure / switchChain / focusWallet / addAsset / createAccount / onramp / bridge / getUpgraded / getBitcoinBalance / requestCancelDelegations for
  theming, host-driven focus mode, tracked assets, and first-party Safari create.
license: MIT
metadata:
  author: 1Shot-API
  version: "0.2.0"
  repository: https://github.com/1Shot-API/skills
---

# 1Shot Embedded Wallet (Host integration)

Teach an agent how to embed the **1Shot Wallet** Branding Layer from a Host Layer app using `@1shotapi/ows-provider`.

> Use of 1Shot-hosted public infrastructure is subject to the [Public Infrastructure Terms](https://1shotapi.com/legal/public-infrastructure-terms) and [Acceptable Use Policy](https://1shotapi.com/legal/acceptable-use-policy). By accessing or using those hosted services, you agree to those terms.

## Install this skill (consumer / global)

```bash
npx skills add 1Shot-API/skills/1shot-wallet -g -a cursor -y
```

```
Host (your dapp)          @1shotapi/ows-provider → OWSProxy
  └── Branding iframe     https://wallet.1shotapi.com/
        └── Signing       https://wallet.1shotapi.com/signer/  (same origin)

Safari create (first-party tab):
  Branding iframe ──window.open──► https://wallet.1shotapi.com/create/
                                     └── Branding iframe + createAccount RPC
```

## Install

```bash
npm install @1shotapi/ows-provider @1shotapi/ows-types
```

## Minimal setup

```typescript
import { OWSProxy } from "@1shotapi/ows-provider";

const WALLET_URL = "https://wallet.1shotapi.com/";

const container = document.getElementById("wallet-container")!;
const proxy = await OWSProxy.create(container, WALLET_URL);

// Optional: theme / copy before showing the flyout
await proxy.rpc("configure", {
  copy: { productName: "Acme Wallet", tagline: "Powered by 1Shot" },
  theme: { primary: "oklch(0.45 0.18 250)" },
});

proxy.showWallet();

// EIP-1193
const accounts = await proxy.ethereum.request({ method: "eth_requestAccounts" });
```

### Local / HTTPS notes

- Passkeys require a **secure-context ancestor chain**. The Host page must be HTTPS (or `localhost`) when the wallet iframe is HTTPS.
- Dev wallet URL: your ngrok or local Vite origin root (e.g. `https://….ngrok-free.app/`).
- Production wallet URL: **`https://wallet.1shotapi.com/`** (Signing Layer at `/signer/` on the same origin — do not embed `/signer/` from the host).
- Safari / iOS WebKit cannot create passkeys inside a **cross-origin** wallet iframe. The branding layer detects this and opens **`https://wallet.1shotapi.com/create/`** in a new tab (same origin as the wallet). Allow pop-ups from the embedding page so that handoff can complete; no host code changes are required.

## Custom RPC — `configure`

1Shot-specific method registered on the Branding Layer. Call via:

```typescript
await proxy.rpc("configure", options);
```

`options` is a partial merge (safe to call repeatedly):

| Field | Type | Purpose |
|-------|------|---------|
| `theme.primary` | string (CSS color) | `--primary` |
| `theme.primaryForeground` | string | `--primary-foreground` |
| `theme.background` / `foreground` | string | page colors |
| `theme.muted` / `mutedForeground` | string | secondary text |
| `theme.border` / `accent` / `accentForeground` | string | chrome |
| `theme.radius` | string | `--radius` (e.g. `"0.625rem"`) |
| `theme.fontSans` | string | `--font-sans` |
| `features.hideCloseBox` | boolean | Hide chrome Close (X); default `false`. Use in Inline hosts (e.g. extension) |
| `features.disableCredentials` | boolean | Hide Credentials tab; default `false`. Host credential flows still work |
| `features.disableDelegations` | boolean | Hide Delegations tab; default `false`. Host delegation flows still work |
| `features.allowedChains` | `string[]` (hex `0x…` chain ids) | Restrict Network dropdown to these catalog chains; omit or `[]` ⇒ all enabled |
| `destinationUrl` | string \| null | URL to receive transaction status update webhooks from the [1Shot Relayer](https://1shotapi.com/docs/embedded-wallet/webhooks) (≤256 chars). `null` or `""` clears |
| `copy.productName` | string | titles / chrome |
| `copy.tagline` | string | supporting line |
| `copy.connect.title` | string | connect modal title |
| `copy.connect.body` | string | connect modal body |
| `copy.connect.rejectLabel` | string | Reject button |
| `copy.connect.continueLabel` | string | Continue button |
| `copy.walletSetup.title` | string | setup modal title |
| `copy.walletSetup.body` | string | setup modal body |
| `copy.walletSetup.cancelLabel` | string | Cancel button |
| `copy.walletSetup.loginLabel` | string | Login with passkey |
| `copy.walletSetup.createLabel` | string | Create account |
| `copy.passkeyName.title` | string | passkey name modal title |
| `copy.passkeyName.body` | string | passkey name modal body |
| `copy.passkeyName.fieldLabel` | string | input label |
| `copy.passkeyName.placeholder` | string | input placeholder |
| `copy.passkeyName.emptyError` | string | empty-name validation error |
| `copy.passkeyName.cancelLabel` | string | Cancel button |
| `copy.passkeyName.continueLabel` | string | Continue button |
| `copy.personalSign.title` | string | personal_sign modal title |
| `copy.personalSign.accountLabel` | string | Account field label |
| `copy.personalSign.messageLabel` | string | Message field label |
| `copy.personalSign.rejectLabel` | string | Reject button |
| `copy.personalSign.signLabel` | string | Sign button |
| `copy.typedData.title` | string | EIP-712 modal title |
| `copy.typedData.body` | string | Intro paragraph |
| `copy.typedData.networkLabel` | string | Network summary row label |
| `copy.typedData.requestFromLabel` | string | Requesting domain row label |
| `copy.typedData.accountLabel` | string | Signing account row label |
| `copy.typedData.interactingWithLabel` | string | Verifying contract row label |
| `copy.typedData.primaryTypeLabel` | string | Primary type label |
| `copy.typedData.messageSectionLabel` | string | Message card heading |
| `copy.typedData.signingHint` | string | Hint shown while signing |
| `copy.typedData.rejectLabel` | string | Reject button |
| `copy.typedData.signLabel` | string | Sign button |
| `copy.grantExecutionPermission.title` | string | ERC-20 periodic grant modal title |
| `copy.grantExecutionPermission.permissionKindLabel` | string | Summary card eyebrow |
| `copy.grantExecutionPermission.amountLabel` | string | Summary amount row |
| `copy.grantExecutionPermission.transferWindowLabel` | string | Summary cadence row |
| `copy.grantExecutionPermission.toLabel` | string | Delegate summary row |
| `copy.grantExecutionPermission.viewOnExplorerLabel` | string | Delegate explorer link a11y |
| `copy.grantExecutionPermission.justificationLabel` | string | Host justification in terms card |
| `copy.grantExecutionPermission.advancedLabel` | string | Toggle for Unix start field |
| `copy.grantExecutionPermission.grantLabel` | string | Grant button |
| `copy.grantExecutionPermission.rejectLabel` | string | Reject button |
| `copy.credentialOffer.title` | string | offer modal title |
| `copy.credentialOffer.body` | string | supports `{issuerName}` `{issuerId}` |
| `copy.credentialOffer.offeredHeading` | string | offered list heading |
| `copy.credentialOffer.passkeyNote` | string | passkey hint |
| `copy.credentialOffer.rejectLabel` | string | Reject button |
| `copy.credentialOffer.acceptLabel` | string | Accept button |
| `copy.credentialPresentation.title` | string | presentation modal title |
| `copy.credentialPresentation.body` | string | supports `{verifierName}` `{verifierId}` |
| `copy.credentialPresentation.credentialDetail` | string | supports `{credentialType}` `{credentialIssuer}` |
| `copy.credentialPresentation.claimsHeading` | string | claims list heading |
| `copy.credentialPresentation.passkeyNote` | string | passkey hint |
| `copy.credentialPresentation.rejectLabel` | string | Reject button |
| `copy.credentialPresentation.shareLabel` | string | Share button |
| `copy.credentials.tabLabel` | string | Credentials tab label |
| `copy.credentials.emptyCountLabel` | string | zero-count summary |
| `copy.credentials.countLabel` | string | supports `{count}` |
| `copy.credentials.refreshLabel` | string | Refresh button |
| `copy.credentials.loadingBody` | string | loading state |
| `copy.credentials.emptyBody` | string | empty-state text |
| `copy.credentials.loadFailedError` | string | list load failure |
| `copy.credentials.refreshFailedError` | string | relayer refresh failure |
| `copy.credentials.notFoundError` | string | detail not in cache |
| `copy.credentials.openFailedError` | string | detail open failure |
| `copy.credentials.typeColumn` | string | Type column header |
| `copy.credentials.issuerColumn` | string | Issuer column header |
| `copy.credentials.issuedColumn` | string | Issued column header |
| `copy.credentials.viewLabel` | string | View button |
| `copy.credentials.detailFallbackTitle` | string | detail title fallback |
| `copy.credentials.detailDescription` | string | detail dialog description |
| `copy.credentials.issuerLabel` | string | Issuer field label |
| `copy.credentials.formatLabel` | string | Format field label |
| `copy.credentials.issuedLabel` | string | Issued field label |
| `copy.credentials.validUntilLabel` | string | Valid until label |
| `copy.credentials.idLabel` | string | Id field label |
| `copy.credentials.claimsHeading` | string | Claims section heading |
| `copy.credentials.claimsLoading` | string | claims loading text |
| `copy.credentials.claimsEmpty` | string | no claims text |
| `copy.credentials.closeLabel` | string | Close button |
| `copy.exportPrivateKey.title` | string | export private key modal title |
| `copy.exportPrivateKey.body` | string | risk warning body |
| `copy.exportPrivateKey.continueLabel` | string | confirm export button |
| `copy.exportPrivateKey.cancelLabel` | string | Cancel button |
| `copy.exportPrivateKey.closeLabel` | string | Close button |
| `copy.exportPrivateKey.revealingBody` | string | shown while passkey / key UI is open |
| `copy.exportPrivateKey.cancelledError` | string | passkey cancelled |
| `copy.exportPrivateKey.failedError` | string | generic failure |
| `copy.importPrivateKey.title` | string | import private key modal title |
| `copy.importPrivateKey.body` | string | risk / session warning body |
| `copy.importPrivateKey.continueLabel` | string | confirm import button |
| `copy.importPrivateKey.cancelLabel` | string | Cancel button |
| `copy.importPrivateKey.closeLabel` | string | Close button |
| `copy.importPrivateKey.importingBody` | string | shown while signer paste UI is open |
| `copy.importPrivateKey.cancelledError` | string | import cancelled |
| `copy.importPrivateKey.invalidKeyError` | string | invalid hex key |
| `copy.importPrivateKey.failedError` | string | generic failure |
| `copy.advancedOptions.title` | string | advanced options modal title |
| `copy.advancedOptions.menuLabel` | string | wallet menu item label |
| `copy.advancedOptions.onboardingLabel` | string | onboarding advanced link |
| `copy.advancedOptions.body` | string | advanced options description |
| `copy.advancedOptions.exportLabel` | string | export action label |
| `copy.advancedOptions.importLabel` | string | import action label |
| `copy.advancedOptions.changeAccountLabel` | string | clear passkey cache / switch account |
| `copy.advancedOptions.closeLabel` | string | Close button |
| `copy.passkeyPrompt.exportPrivateKey.title` | string | Signing Layer Confirm header for export |
| `copy.passkeyPrompt.exportPrivateKey.body` | string | Signing Layer Confirm body for export |
| `dark` | boolean | toggles `html.dark` |

Returns `{ ok: true, productName: string }` with the resolved product name after merge.

Unknown keys are rejected (Zod `.strict()`).

See also the [embedded-wallet README](https://github.com/1Shot-API/embedded-wallet/blob/main/README.md).

## Custom RPC — `switchChain`

Switch the Branding Layer session chain. Accepts EVM hex ids **and** Bitcoin
sentinels (`"Bitcoin"` mainnet, `"BitcoinTestnet"` testnet). Prefer this over
EIP-1193 `wallet_switchEthereumChain` when the host catalog includes Bitcoin —
EIP-1193 params are hex-only and reject non-hex ids with `Invalid params`.

```ts
await proxy.rpc("switchChain", { chainId: "Bitcoin" });
await proxy.rpc("switchChain", { chainId: "0x2105" });
```

| Method | Params | Behavior |
|--------|--------|----------|
| `switchChain` | `{ chainId: \`0x…\` \| \`"Bitcoin"\` \| \`"BitcoinTestnet"\` }` | Bitcoin: session-only. EVM: same as `wallet_switchEthereumChain` via RpcHelper |

Returns `{ ok: true, chainId }`. Bitcoin switches also emit EIP-1193
`chainChanged` with the Bitcoin sentinel so hosts stay in sync.

## Custom RPC — `getChainId`

Read the Branding Layer **session** chain id (EVM hex or Bitcoin sentinel).
Prefer this over EIP-1193 `eth_chainId` when the host catalog includes Bitcoin —
`eth_chainId` only reflects the last EVM RpcHelper chain.

```ts
const { chainId } = await proxy.rpc("getChainId");
// "0x2105" | "Bitcoin" | "BitcoinTestnet" | …
```

| Method | Params | Behavior |
|--------|--------|----------|
| `getChainId` | none | Returns `{ chainId }` from the wallet session store |

## EVM balances (EIP-1193)

Native and ERC-20 balances use the standard provider — no custom RPC. Branding
proxies read methods (`eth_getBalance`, `eth_call`, …) to the active EVM chain
JSON-RPC URL via `RpcHelper`.

```ts
// Native (wei hex string)
const wei = await proxy.ethereum.request({
  method: "eth_getBalance",
  params: [address, "latest"],
});

// ERC-20 — encode balanceOf(address) calldata yourself (viem `encodeFunctionData`, etc.)
const data = await proxy.ethereum.request({
  method: "eth_call",
  params: [{ to: tokenAddress, data: balanceOfCalldata }, "latest"],
});
```

Notes:

- Reads do **not** require unlock or `eth_requestAccounts`.
- They use `RpcHelper`'s current **EVM** chain. If the session is on Bitcoin
  (`getChainId` / `switchChain`), call `switchChain` to an EVM id first when you
  care which chain is queried. Prefer custom `getChainId` for the session chain.
- JSON-RPC `fetch` runs from the Branding origin (`wallet.1shotapi.com`); the
  chain RPC must allow CORS from that origin.

## Custom RPC — `getBitcoinBalance`

There is no EIP-1193 equivalent for Bitcoin. Read confirmed + pending (mempool)
satoshi balances for the unlocked wallet on Bitcoin mainnet or testnet.

```ts
const { chainId, address, confirmed, unconfirmed } = await proxy.rpc(
  "getBitcoinBalance",
  {}, // or omit; defaults to "Bitcoin"
);
// or: await proxy.rpc("getBitcoinBalance", { chainId: "BitcoinTestnet" });
```

| Method | Params | Behavior |
|--------|--------|----------|
| `getBitcoinBalance` | `{ chainId?: "Bitcoin" \| "BitcoinTestnet" }` (default `"Bitcoin"`) | Resolves the wallet SegWit address (session → cache → signer), returns satoshi balances |

Returns `{ chainId, address, confirmed, unconfirmed }`:

- `confirmed` — known on-chain balance (satoshi decimal string)
- `unconfirmed` — pending mempool delta (satoshi decimal string; may be negative)

Requires unlock/setup (`ensureReady`). Address is always the wallet’s — hosts
cannot query arbitrary addresses.

## Custom RPC — `focusWallet` / `unfocusWallet`

Host-controlled shell modes. Callers (not end users) switch between **General** (multi-chain tabs) and **Focused** (single chain + asset detail view).

```typescript
// Lock to one chain + ERC-20 (or native) asset
await proxy.rpc("focusWallet", {
  chainId: "0x13b2", // Arc
  assetAddress: "0x3600000000000000000000000000000000000000", // USDC
});
proxy.showWallet();

// Bitcoin — only one asset on the chain; assetAddress optional / ignored
await proxy.rpc("focusWallet", {
  chainId: "Bitcoin", // or "BitcoinTestnet"
});
proxy.showWallet();

// Restore general mode (keeps the current chain)
await proxy.rpc("unfocusWallet");
```

| Method | Params | Effect |
|--------|--------|--------|
| `focusWallet` | `{ chainId: \`0x…\` \| \`"Bitcoin"\` \| \`"BitcoinTestnet"\`, assetAddress?: \`0x…\` }` | Switches active chain, focuses shell. EVM requires `assetAddress`; Bitcoin ignores it and shows native BTC. |
| `unfocusWallet` | none | Clears focus; returns to network selector + tabs |

`focusWallet` returns `{ ok: true, mode: "focused", chainId, assetAddress }` (`assetAddress` is `null` for Bitcoin).  
`unfocusWallet` returns `{ ok: true, mode: "general" }`.

Unlike `addAsset`, **`focusWallet` does not ask the user for confirmation** — hosts may temporarily lock the shell to any asset.

## Custom RPC — `addAsset`

Propose a tracked **ERC-20** for the Balances tab. The wallet resolves the token (known catalog, or on-chain `getCode` + `name`/`symbol`/`decimals`) **before** showing the confirm modal. Non-ERC-20 addresses are rejected. **Always requires user confirmation** (Reject / Add). On approval the asset is persisted; on rejection the RPC throws a user-rejected error.

```typescript
await proxy.rpc("addAsset", {
  chainId: "0x13b2", // Arc
  assetAddress: "0x3600000000000000000000000000000000000000", // USDC
  // Optional HTTPS icon (shown in confirm + Balances). `http:` / `data:` rejected.
  iconUrl: "https://example.com/token-icon.png",
});
proxy.showWallet();
```

| Method | Params | Effect |
|--------|--------|--------|
| `addAsset` | `{ chainId: \`0x…\`, assetAddress: \`0x…\`, iconUrl?: \`https://…\` }` | Probes ERC-20, shows confirm modal; on accept, adds to tracked assets (persists optional host icon) |

Returns `{ ok: true, chainId, assetAddress }` when the user accepts.

Users can also add assets from the Balances tab without a host RPC. The Balances list shows tracked assets for the currently selected network only (USDC is always tracked where listed; USDG on Robinhood).

## Custom RPC — `createAccount`

Used by the first-party **`/create/`** host page (Safari passkey create). Hosts embedding the wallet normally do **not** call this — the branding layer opens `/create/` itself when needed. Not exposed as a playground button.

```typescript
const result = await proxy.rpc("createAccount");
// { ok: true, credentialId: string, accounts: EVMAccountAddress[] }

// Optional pre-chosen passkey name (skips the name modal):
await proxy.rpc("createAccount", { accountName: "My Wallet" });
```

| Method | Params | Effect |
|--------|--------|--------|
| `createAccount` | `{ accountName?: string }` optional | Runs setup create (passkey + relayer register); returns credential id |

## Custom RPC — `onramp`

Opens Circle fiat onramp fullscreen inside the Branding Layer for the unlocked EVM address.

```typescript
await proxy.rpc("onramp", {
  chainId: 8453, // optional — decimal chain id for catalog scoping
  amount: "50", // optional — amount hint when supported by the kit
});
// or: await proxy.rpc("onramp", {});
```

| Method | Params | Behavior |
|--------|--------|----------|
| `onramp` | `{ chainId?: number, amount?: string }` | Shows wallet, mounts Circle AppKit onramp; session minted via Relayer `POST /wallet/onramp` |

Returns `{ ok: true }` when the user closes the onramp view. The Relayer holds the Circle kit key; the browser only receives a single-use session. When Branding is nested in a Host iframe, Buy prefers AppKit `openWindow`; top-level Branding uses `mountIframe`. Override with `localStorage.setItem("circlePopup", "true"|"false")`.

## Custom RPC — `getUpgraded`

Read-only EIP-7702 upgrade check for the unlocked EOA on one chain. Hosts can call this before `wallet_requestExecutionPermissions` to prepare the user (onramp for USDC, expect an activation fee, etc.). No flyout.

```typescript
const status = await proxy.rpc("getUpgraded", {
  chainId: "0x2105", // Base — or "0x1", "Bitcoin", …
});
// { upgraded: true, codeAddress: "0x…" }
// { upgraded: false }
// { upgraded: false, error: "Chain Bitcoin is not an EVM chain" }
```

| Method | Params | Behavior |
|--------|--------|----------|
| `getUpgraded` | `{ chainId: string }` OWS id (`0x…` / `Bitcoin` / `BitcoinTestnet`) | On-chain `getCode` for the unlocked EOA; `upgraded` when delegated to the StatelessDelegator impl |

Returns `{ upgraded: boolean, codeAddress?: EVMContractAddress, error?: string }`. Non-EVM chain ids and getCode failures soft-fail via `error` (do not throw). Locked wallet throws `"Wallet is locked — unlock before getUpgraded"`.

## Custom RPC — `bridge`

Opens the gasless CCTP USDC bridge (native TokenMessengerV2 + Circle Forwarding Service, submitted through the 1Shot relayer). Locked wallet → error. Cancel before success → `OwsUserRejectedError`. Execute failure → thrown error. Flyout closes when the RPC settles (`requestDisplay` / `hide`). Omit `sourceChainId` to use the session chain.

When `amount`, `destinationChainId`, and `speed` are all provided, the wallet skips the setup form, auto-quotes, and shows the confirmation screen only (secondary action is **Cancel**). Partial params open setup with those values as defaults.

```typescript
await proxy.rpc("bridge", {
  amount: "10.50",           // optional human USDC
  sourceChainId: 8453,       // optional decimal; omit → session chain
  destinationChainId: 1,     // optional; omit → user picks
  speed: "fast",             // optional "fast" | "slow"; required with amount+dest to skip setup
  tokenAddress: "0x…",       // optional; must be native CCTP USDC on source (default)
});
// or: await proxy.rpc("bridge", {});
```

| Method | Params | Behavior |
|--------|--------|----------|
| `bridge` | `{ amount?: string, sourceChainId?: number, destinationChainId?: number, speed?: "fast" \| "slow", tokenAddress?: string }` | Shows wallet, opens CCTP bridge for native USDC on a relayer CCTP source. Dest must be a same-network CCTP chain. Full params → confirm-only. |

Returns `{ ok: true, burnTxHash, forwardTxHash? }` when the bridge succeeds (destination mint if Iris has completed). The user pays the relayer USDC fee (same path as Send); destination mint is Circle’s Forwarding Service — no dest-chain signature and no native gas.

Product analytics: `BridgeOpened`, `BridgeCompleted`, `BridgeFailed`, `BridgeCancelled` (burn submit still also emits `TransactionSubmitted*`).

## Custom RPC — `requestCancelDelegations`

Batch on-chain revoke for permissions this host previously received from `wallet_requestExecutionPermissions`. Pass the grant response `context` values as `permissionContexts`. Opens the cancel confirm modal (same UI as the Delegations tab). Same-chain contexts are disabled in one relayer transaction; multi-chain selections submit one batched send per chain.

Only vault rows whose `hostDomain` matches the calling host are accepted. If a `permissionContext` is missing locally (e.g. granted on another device), the wallet recovers credentials/delegations from the relayer once and retries the lookup before failing. Still-unknown contexts or permissions granted to another host throw `OwsInvalidParamsError` before the flyout opens. Unlock and interactive `eth_requestAccounts` also warm the vault from the relayer so cross-device grants are usually already present.

```typescript
// After wallet_requestExecutionPermissions → responses[].context
const result = await proxy.rpc("requestCancelDelegations", {
  permissionContexts: [
    responses[0].context,
    responses[1].context, // same or different chain — one modal
  ],
});
// { transactionHashes: ["0x…", …] }  // one hash per unique chain
// { transactionHashes: null }         // user skipped on-chain (vault delete only)
```

| Method | Params | Behavior |
|--------|--------|----------|
| `requestCancelDelegations` | `{ permissionContexts: HexString[] }` (min 1) | Domain-scoped batch cancel; flyout until grant/reject |

User reject → `OwsUserRejectedError`. Prefer this over `wallet_revokeExecutionPermission` when canceling multiple grants or when the host should not touch permissions it did not receive.

## Other Host APIs

| API | Use |
|-----|-----|
| `proxy.ethereum.request(...)` | EIP-1193 (accounts, sign, chain, …) |
| `proxy.ethereum.on` / `removeListener` | Branding→Host EIP-1193 notifications (`chainChanged`, `accountsChanged` via `ows:eip1193`) |
| `proxy.credentials.*` | OID4 offer / present (when enabled in wallet) |
| `proxy.showWallet()` / `hideWallet()` | Host-driven flyout without an EIP-1193 call |
| `proxy.rpc(method, params)` | Custom Branding RPC (`configure`, `switchChain`, `getChainId`, `focusWallet`, `unfocusWallet`, `addAsset`, `createAccount`, `onramp`, `getUpgraded`, `bridge`, `requestCancelDelegations`, …) |
| `proxy.analytics.on(listener)` / `.on(name, listener)` / `.off(listener)` | Branding→Host product analytics (`ows:analytics`) |

Subscribe so in-wallet chain/account changes update host UI without polling:

```typescript
proxy.ethereum.on("chainChanged", (chainId) => {
  // EVM hex (`0x…`) or Bitcoin sentinel (`Bitcoin` / `BitcoinTestnet`)
});
proxy.ethereum.on("accountsChanged", (accounts) => {
  // EVM address array
});
```

## Analytics (`proxy.analytics`)

Branding publishes product events over Postmate. OWS types only `eventId`, `timestamp`, `hostDomain`, and `name`; this wallet attaches rich fields. Narrow on `name`:

```typescript
proxy.analytics.on((event) => {
  console.info(event.name, event);
});

proxy.analytics.on("PersonalSign", (event) => {
  // event.durationMs, event.accountAddress, …
});
```

| `name` | When | Notable fields |
|--------|------|----------------|
| `AccountCreated` / `AccountCreateFailed` / `AccountCreateCancelled` | Passkey create | `accountAddress`, `errorCode` |
| `PersonalSign` / `PersonalSignFailed` / `PersonalSignCancelled` | EIP-191 | `accountAddress`, `messageLength`, `durationMs` |
| `TypedSign` / `TypedSignFailed` / `TypedSignCancelled` | EIP-712 | `accountAddress`, `primaryType`, `durationMs` |
| `TransactionSubmitted` / `TransactionSubmitFailed` / `TransactionSubmitCancelled` | Send | `accountAddress`, `chainId`, `to`, `txHash`, `methodId`, `durationMs` |
| `CredentialIssued` / `CredentialIssueFailed` / `CredentialIssueCancelled` | OID4VCI | `issuerOrigin`, `durationMs` |
| `CredentialPresented` / `CredentialPresentFailed` / `CredentialPresentCancelled` | OID4VP | `verifierOrigin`, `durationMs` |
| `DelegationCreated` / `DelegationCreateFailed` / `DelegationCreateCancelled` | EIP-7715 grant | `accountAddress`, `chainId`, `durationMs` |
| `DelegationCancelled` / `DelegationCancelFailed` / `DelegationCancelAborted` | EIP-7715 revoke | `accountAddress`, `chainId`, `txHash`, `durationMs` |

The same rich payload is POSTed fire-and-forget to `POST /wallet/product-events` on the
1Shot relayer. The local Host (`host/`) and marketing [wallet playground](https://www.1shotapi.com/playground)
include a live Analytics panel fed by `proxy.analytics.on` (filter by `name`).

EIP-7715 host RPCs: `wallet_requestExecutionPermissions`, `wallet_revokeExecutionPermission` (single `permissionContext`), `wallet_getSupportedExecutionPermissions`, `wallet_getGrantedExecutionPermissions`. For batch / domain-scoped cancel from a host, use custom RPC `requestCancelDelegations` with the grant `context` values.

## Relayer integration (when the host submits txs)

- **Default sends:** `eth_sendTransaction` through OWSProxy — the wallet signs delegations and calls `relayer_*` internally. The host does **not** implement a relayer JSON-RPC client.
- **Delegated execution (Path B):** when the host or backend will **redeem** a user grant via public relayer JSON-RPC, also install the **`public-relayer`** skill.
  - **B1 direct:** grant **`to: relayer targetAddress`** → Example 0b in **`public-relayer/references/examples.md`**.
  - **B2 session key (recommended):** grant **`to: host session account`**, redelegate **`to: targetAddress`**, submit delegation chain → Example 0c.
  - See **`public-relayer/SKILL.md`** (Integration paths with `1shot-wallet`).
- **Status webhooks:** optional `configure.destinationUrl` — the wallet forwards it to the relayer on send. Still no direct relayer client in the host.

### Supported permission types

| `permission.type` | Chains (v1) | Purpose |
|-------------------|-------------|---------|
| `erc20-token-periodic` | All relayer chains | Periodic ERC-20 `transfer` budget (`ScopeType.Erc20PeriodTransfer`) |
| `lifi-swap-approve` | Arc (`0x13b2`), Base (`0x2105`), Ethereum (`0x1`) | One-time `approve(inputToken → LiFi Diamond)` onboarding |
| `lifi-swap-periodic` | Arc, Base, Ethereum mainnet | Periodic LiFi swap via `LiFiSwapEnforcer` proxy (`0x29fcBBa852439616c4D614A2fa6411E42b760153`) |

**`erc20-token-periodic` / `lifi-swap-periodic` amounts:** Hosts should pass `periodAmount` (hex atoms) to prefill the grant form. Playground demos default to **10 USDC** (`0x989680`).

**`lifi-swap-approve` data:** `tokenAddress`, `spender` (LiFi Diamond). Amount is not pinned — the delegate may approve `maxUint256`.

**`lifi-swap-periodic` data:** `lifiDiamond`, `tokenAddress` (input ERC-20), `outputAssetId` (`bytes32` hex), `outputRecipient` (`bytes32` hex), `destinationChainId` (number or decimal string), `quoteSigner`, `periodAmount` (hex atoms), `periodDuration` (seconds). Optional: `startDate`, `slippageBps` (default `50`, must be `< 10000`). Grant response echoes attenuated fields plus `delegationHash` on `permission.data`.

Hosts that need both approve and swap should send **two** items in one `wallet_requestExecutionPermissions` batch. The wallet walks consent as a wizard (**Next** on intermediate forms, **Grant** on the last), then signs every delegation in **one** passkey ceremony and encrypts/uploads all vault rows in a **second** passkey ceremony. Each permission still gets its own vault row and `context`. **Do not** encode approve + swap as one `Delegation[]` chain (that would be treated as parent/child). Quote signing at redemption stays with the host/`quoteSigner` backend — the wallet only grants and signs the delegation.

## Hard rules

- Never embed the Signing Layer iframe from the Host — always Host → Branding → Signing.
- Prefer the published wallet URL in production; point at a local Branding origin only while developing this repo.
- Theme with `configure`; do not ask integrators to fork CSS for basic brand colors / product name.
- Use `focusWallet` / `unfocusWallet` for host-driven single-asset flows; do not expose mode switching in the wallet UI.
- Use `addAsset` when the host wants a lasting Balances entry; expect a confirm modal (contrast with `focusWallet`).
- Use `onramp` (or the in-wallet Buy button) for fiat → crypto; do not put the Circle kit key in the Host or Branding Layer.
- Use `bridge` (or the in-wallet Bridge button) for gasless CCTP USDC; do not require native gas or dest-chain `receiveMessage`.
