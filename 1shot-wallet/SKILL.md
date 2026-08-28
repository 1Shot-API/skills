---
name: 1shot-wallet
description: >-
  Integrate the 1Shot embedded wallet (OWS Host Layer) with @1shotapi/ows-provider.
  Use when embedding wallet.1shotapi.com, wiring OWSProxy, EIP-1193, credentials,
  or custom RPC such as configure / focusWallet / addAsset / createAccount for
  theming, host-driven focus mode, tracked assets, and first-party Safari create.
license: MIT
metadata:
  author: 1Shot-API
  version: "0.2.0"
  repository: https://github.com/1Shot-API/embedded-wallet
---

# 1Shot Embedded Wallet (Host integration)

Teach an agent how to embed the **1Shot Wallet** Branding Layer from a Host Layer app using `@1shotapi/ows-provider`.

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
| `copy.typedData.accountLabel` | string | Account field label |
| `copy.typedData.primaryTypeLabel` | string | Primary type label |
| `copy.typedData.domainLabel` | string | Domain label |
| `copy.typedData.messageLabel` | string | Message label |
| `copy.typedData.rejectLabel` | string | Reject button |
| `copy.typedData.signLabel` | string | Sign button |
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

See also [embedded-wallet README](https://github.com/1Shot-API/embedded-wallet/blob/main/README.md).

## Custom RPC — `focusWallet` / `unfocusWallet`

Host-controlled shell modes. Callers (not end users) switch between **General** (multi-chain tabs) and **Focused** (single chain + asset detail view).

```typescript
// Lock to one chain + ERC-20 (or other) asset
await proxy.rpc("focusWallet", {
  chainId: "0x4cef52", // Arc Testnet
  assetAddress: "0x3600000000000000000000000000000000000000", // USDC
});
proxy.showWallet();

// Restore general mode (keeps the current chain)
await proxy.rpc("unfocusWallet");
```

| Method | Params | Effect |
|--------|--------|--------|
| `focusWallet` | `{ chainId: \`0x…\`, assetAddress: \`0x…\` }` | Switches active chain, sets focused asset, shows Asset Details shell |
| `unfocusWallet` | none | Clears focus; returns to network selector + tabs |

`focusWallet` returns `{ ok: true, mode: "focused", chainId, assetAddress }`.  
`unfocusWallet` returns `{ ok: true, mode: "general" }`.

Unlike `addAsset`, **`focusWallet` does not ask the user for confirmation** — hosts may temporarily lock the shell to any asset.

## Custom RPC — `addAsset`

Propose a tracked **ERC-20** for the Balances tab. The wallet resolves the token (known catalog, or on-chain `getCode` + `name`/`symbol`/`decimals`) **before** showing the confirm modal. Non-ERC-20 addresses are rejected. **Always requires user confirmation** (Reject / Add). On approval the asset is persisted; on rejection the RPC throws a user-rejected error.

```typescript
await proxy.rpc("addAsset", {
  chainId: "0x4cef52", // Arc Testnet
  assetAddress: "0x3600000000000000000000000000000000000000", // USDC
});
proxy.showWallet();
```

| Method | Params | Effect |
|--------|--------|--------|
| `addAsset` | `{ chainId: \`0x…\`, assetAddress: \`0x…\` }` | Probes ERC-20, shows confirm modal; on accept, adds to tracked assets |

Returns `{ ok: true, chainId, assetAddress }` when the user accepts.

Users can also add assets from the Balances tab without a host RPC. The Balances list shows tracked assets for the currently selected network only (USDC is always tracked where listed; USDG on Robinhood).

## Custom RPC — `createAccount`

Used by the first-party **`/create/`** host page (Safari passkey create). Hosts embedding the wallet normally do **not** call this — the branding layer opens `/create/` itself when needed.

```typescript
const result = await proxy.rpc("createAccount");
// { ok: true, credentialId: string, accounts: EVMAccountAddress[] }

// Optional pre-chosen passkey name (skips the name modal):
await proxy.rpc("createAccount", { accountName: "My Wallet" });
```

| Method | Params | Effect |
|--------|--------|--------|
| `createAccount` | `{ accountName?: string }` optional | Runs setup create (passkey + relayer register); returns credential id |

## Other Host APIs

| API | Use |
|-----|-----|
| `proxy.ethereum.request(...)` | EIP-1193 (accounts, sign, chain, …) |
| `proxy.ethereum.on` / `removeListener` | Branding→Host EIP-1193 notifications (`chainChanged`, `accountsChanged` via `ows:eip1193`) |
| `proxy.credentials.*` | OID4 offer / present (when enabled in wallet) |
| `proxy.analytics.on(listener)` / `.on(name, listener)` / `.off(listener)` | Branding→Host product analytics (`ows:analytics`) |
| `proxy.showWallet()` / `hideWallet()` | Host-driven flyout without an EIP-1193 call |
| `proxy.rpc(method, params)` | Custom Branding RPC (`configure`, `focusWallet`, `unfocusWallet`, `addAsset`, `createAccount`, …) |

Subscribe so in-wallet chain/account changes update host UI without polling:

```typescript
proxy.ethereum.on("chainChanged", (chainId) => {
  // hex chain id string
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

## Relayer integration (when the host submits txs)

- **Default sends:** `eth_sendTransaction` through OWSProxy — the wallet signs delegations and calls `relayer_*` internally. The host does **not** implement a relayer JSON-RPC client.
- **Delegated execution (Path B):** when the host or backend will **redeem** a user grant via public relayer JSON-RPC, also install the **`public-relayer`** skill.
  - **B1 direct:** grant **`to: relayer targetAddress`** → Example 0b in **`public-relayer/references/examples.md`**.
  - **B2 session key (recommended):** grant **`to: host session account`**, redelegate **`to: targetAddress`**, submit delegation chain → Example 0c.
  - See **`public-relayer/SKILL.md`** (Integration paths with `1shot-wallet`).
- **Status webhooks:** optional `configure.destinationUrl` — the wallet forwards it to the relayer on send. Still no direct relayer client in the host.

EIP-7715 host RPCs: `wallet_requestExecutionPermissions`, `wallet_revokeExecutionPermission` (grant consent and on-chain revoke are wallet-driven).

## Hard rules

- Never embed the Signing Layer iframe from the Host — always Host → Branding → Signing.
- Prefer the published wallet URL in production; point at a local Branding origin only while developing this repo.
- Theme with `configure`; do not ask integrators to fork CSS for basic brand colors / product name.
- Use `focusWallet` / `unfocusWallet` for host-driven single-asset flows; do not expose mode switching in the wallet UI.
- Use `addAsset` when the host wants a lasting Balances entry; expect a confirm modal (contrast with `focusWallet`).
