---
name: 1shot-wallet
description: >-
  Integrate the 1Shot embedded wallet (OWS Host Layer) with @1shotapi/ows-provider.
  Use when embedding wallet.1shotapi.com, wiring OWSProxy, EIP-1193, credentials,
  EIP-7715 wallet_requestExecutionPermissions (delegation creation, host rules[]
  stacking, LiFi / Chainlink price rules), or custom RPC such as configure /
  switchChain / focusWallet / addAsset / createAccount / onramp / bridge /
  getUpgraded / getBitcoinBalance / requestCancelDelegations for theming,
  host-driven focus mode, tracked assets, and first-party Safari create.
license: MIT
metadata:
  author: 1Shot-API
  version: "0.3.3"
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

// Optional: Solana Wallet Standard discovery (never auto-registered in create)
proxy.solana.registerSolanaWallet(); // optional { name?, icon? }
```

### Solana — Wallet Standard (`proxy.solana`)

Solana dapps discover wallets via **Wallet Standard** on the Host page (not a Phantom `window.solana` shim). Opt in explicitly after `OWSProxy.create`:

```ts
import { getWallets } from "@wallet-standard/app";

proxy.solana.registerSolanaWallet();
console.log(getWallets().get().map((w) => w.name)); // includes "1Shot Wallet"

// Cleanup (also runs from proxy.destroy()):
proxy.solana.unregisterSolanaWallet();
```

| Surface | Notes |
|---------|--------|
| Chains | `solana:mainnet`, `solana:devnet` |
| Features | `standard:connect` / `disconnect` / `events`, `solana:signMessage`, `solana:signIn`, `solana:signTransaction`, `solana:signAndSendTransaction` |
| Connect | Calls Branding `solana.getAccountAddress` (session → cache → signer) |
| `signMessage` | Branding consent (`SolanaSignModal`) → Ed25519; Standard returns `{ signedMessage: input.message, signature, signatureType: "ed25519" }` |
| `signIn` (SIWS) | Branding builds CAIP-122 message + `SiwsModal`; returns `{ account, signedMessage, signature }` — verifiers must use returned bytes |
| `signTransaction` | Branding consent → Ed25519 over message bytes; Host merges into wire. No Branding RPC submit. Cluster must match wallet Solana selection when provided. |
| `signAndSendTransaction` | Same consent + sign; **Branding submits via Alchemy** and returns a base58 tx signature. Hosts do not supply an RPC URL or API key. Fee payer must be the user. |

Wire methods also exist on `proxy.solana` for non-Standard hosts:

```ts
// Arbitrary message (UTF-8 → base64 on the wire)
const { signatures } = await proxy.solana.signMessage({
  messages: [ConversionUtils.bytesToBase64(new TextEncoder().encode("hello"))],
});

// Sign-In With Solana (wallet fills omitted defaults)
const { account, signedMessage, signature } = await proxy.solana.signIn({
  domain: DomainString(window.location.host),
  uri: UriString(window.location.origin),
  chainId: "solana:mainnet", // or omit → session Solana chain / mainnet
});

// Prefer Wallet Standard for txs (Host builds wire; Branding submits on signAndSend):
// wallet.features["solana:signAndSendTransaction"].signAndSendTransaction({ account, chain, transaction })
```

Switch the wallet to the target Solana cluster (`switchChain` / UI) before signing txs. Branding must `wallet.solana.register(provider)` or Host calls reject.

### Local / HTTPS notes

- Passkeys require a **secure-context ancestor chain**. The Host page must be HTTPS (or `localhost`) when the wallet iframe is HTTPS.
- Dev wallet URL: your ngrok or local Vite origin root (e.g. `https://….ngrok-free.app/`).
- Production wallet URL: **`https://wallet.1shotapi.com/`** (Signing Layer at `/signer/` on the same origin — do not embed `/signer/` from the host). Branding and Signing are same-origin only; `/signer/` is served with `frame-ancestors 'self'`.
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
| `features.allowedChains` | `string[]` (EVM `0x…`, `Bitcoin` / `BitcoinTestnet`, `solana:mainnet` / `solana:devnet`) | Restrict Network dropdown to these catalog chains; omit or `[]` ⇒ all enabled |
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

Switch the Branding Layer session chain. Accepts EVM hex ids, Bitcoin sentinels
(`"Bitcoin"` / `"BitcoinTestnet"`), and Solana CAIP ids (`"solana:mainnet"` /
`"solana:devnet"`). Prefer this over EIP-1193 `wallet_switchEthereumChain` when
the host catalog includes Bitcoin or Solana — EIP-1193 params are hex-only and
reject non-hex ids with `Invalid params`.

```ts
await proxy.rpc("switchChain", { chainId: "Bitcoin" });
await proxy.rpc("switchChain", { chainId: "solana:mainnet" });
await proxy.rpc("switchChain", { chainId: "0x2105" });
```

| Method | Params | Behavior |
|--------|--------|----------|
| `switchChain` | `{ chainId: \`0x…\` \| \`"Bitcoin"\` \| \`"BitcoinTestnet"\` \| \`"solana:mainnet"\` \| \`"solana:devnet"\` }` | Bitcoin/Solana: session-only. EVM: same as `wallet_switchEthereumChain` via RpcHelper |

Returns `{ ok: true, chainId }`. Bitcoin and Solana switches also emit EIP-1193
`chainChanged` with the matching sentinel so hosts stay in sync.

## Custom RPC — `getChainId`

Read the Branding Layer **session** chain id (EVM hex, Bitcoin sentinel, or
Solana CAIP id). Prefer this over EIP-1193 `eth_chainId` when the host catalog
includes Bitcoin or Solana — `eth_chainId` only reflects the last EVM RpcHelper
chain.

```ts
const { chainId } = await proxy.rpc("getChainId");
// "0x2105" | "Bitcoin" | "BitcoinTestnet" | "solana:mainnet" | "solana:devnet" | …
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

Propose a tracked asset for the Balances tab (or Solana shell). **Always requires user confirmation** (Reject / Add). On rejection the RPC throws a user-rejected error.

**EVM:** Resolves the token (known catalog, or on-chain `getCode` + `name`/`symbol`/`decimals`) **before** the confirm modal. Non-ERC-20 addresses are rejected. On approval the asset is persisted (optional host `iconUrl`).

**Solana:** Catalog mint only (mainnet/Devnet USDC today — not arbitrary mint paste). Confirm shows estimated ATA rent; on accept Branding runs `CreateIdempotent` (user pays rent + fees), then tracks with ATA fields. **USDC is not default-tracked** on Solana (rent). Primary UI never shows the ATA address — Receive uses the wallet pubkey.

```typescript
// EVM
await proxy.rpc("addAsset", {
  chainId: "0x13b2", // Arc
  assetAddress: "0x3600000000000000000000000000000000000000", // USDC
  iconUrl: "https://example.com/token-icon.png", // optional https
});

// Solana (catalog USDC — creates ATA then tracks)
await proxy.rpc("addAsset", {
  chainId: "solana:mainnet",
  assetAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
});
proxy.showWallet();
```

| Method | Params | Effect |
|--------|--------|--------|
| `addAsset` | `{ chainId: \`0x…\` \| \`solana:…\`, assetAddress: \`0x…\` \| base58 mint, iconUrl?: \`https://…\` }` | EVM: probe ERC-20 + confirm. Solana: catalog mint + ATA create + confirm. Persists optional host icon |

Returns `{ ok: true, chainId, assetAddress }` when the user accepts.

Users can also add assets from the Balances / Solana shell without a host RPC. EVM Balances show tracked assets for the selected network (pinned USDC/USDG defaults); Solana lists native SOL plus user-added SPL after ATA setup.

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

Opens the CCTP USDC bridge (Circle Forwarding Service). **EVM source** burns via TokenMessengerV2 + the 1Shot relayer (gasless USDC fee). **Solana source** burns via Kit/Alchemy (user pays SOL; no relayer fee UI). Locked wallet → error. Cancel before success → `OwsUserRejectedError`. Execute failure → thrown error. Flyout closes when the RPC settles (`requestDisplay` / `hide`). Omit `sourceChainId` to use the session chain.

When `amount`, `destinationChainId`, and `speed` are all provided, the wallet skips the setup form, auto-quotes, and shows the confirmation screen only (secondary action is **Cancel**). Partial params open setup with those values as defaults.

Same-network only: mainnet↔mainnet, testnet/Devnet↔testnet/Devnet.

```typescript
// EVM → EVM or EVM → Solana
await proxy.rpc("bridge", {
  amount: "10.50",                      // optional human USDC
  sourceChainId: 8453,                  // optional decimal; omit → session chain
  destinationChainId: "solana:mainnet", // optional decimal EVM or Solana CAIP-2
  speed: "fast",                        // optional "fast" | "slow"; required with amount+dest to skip setup
  tokenAddress: "0x…",                  // optional; EVM native CCTP USDC on source
  solanaRecipient: "…base58…",          // optional; Solana wallet when dest is Solana (defaults to session)
});

// Solana → EVM (requires tracked USDC ATA)
await proxy.rpc("bridge", {
  amount: "10.50",
  sourceChainId: "solana:mainnet",
  destinationChainId: 8453,
  speed: "fast",
  evmRecipient: "0x…",                  // optional; defaults to session EVM address
});
// or: await proxy.rpc("bridge", {});
```

| Method | Params | Behavior |
|--------|--------|----------|
| `bridge` | `{ amount?: string, sourceChainId?: number \| string, destinationChainId?: number \| string, speed?: "fast" \| "slow", tokenAddress?: string, solanaRecipient?: string, evmRecipient?: string }` | Shows wallet, opens CCTP bridge. EVM source → relayer burn; Solana source → Alchemy burn. Dest must be a same-network CCTP chain. Full params → confirm-only. |

Returns `{ ok: true, burnTxHash, forwardTxHash? }` when the bridge succeeds (destination mint if Iris has completed). EVM source: user pays the relayer USDC fee (same path as Send). Solana source: user pays SOL for the burn tx. Destination mint is Circle’s Forwarding Service — no dest-chain signature.

Product analytics (EVM source): `BridgeOpened`, `BridgeCompleted`, `BridgeFailed`, `BridgeCancelled` (burn submit still also emits `TransactionSubmitted*`).

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
  // EVM hex (`0x…`), Bitcoin (`Bitcoin` / `BitcoinTestnet`), or Solana CAIP
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

On `*Failed` events, `errorCode` is `Name: message` (up to 255 chars — e.g.
`OwsInvalidRequestError: Passkey does not support PRF or PRF output missing`), not a bare
error class name.

The same rich payload is POSTed fire-and-forget to `POST /wallet/product-events` on the
1Shot relayer (relayer copy also carries `platform` / `os` / `browser` / `isMobile` /
`userAgent` props). The local Host (`host/`) and marketing [wallet playground](https://www.1shotapi.com/playground)
include a live Analytics panel fed by `proxy.analytics.on` (filter by `name`).

EIP-7715 host RPCs: `wallet_requestExecutionPermissions`, `wallet_revokeExecutionPermission` (single `permissionContext`), `wallet_getSupportedExecutionPermissions`, `wallet_getGrantedExecutionPermissions`. For batch / domain-scoped cancel from a host, use custom RPC `requestCancelDelegations` with the grant `context` values. See **EIP-7715 delegation creation** below.

## Relayer integration (when the host submits txs)

- **Default sends:** `eth_sendTransaction` through OWSProxy — the wallet signs delegations and calls `relayer_*` internally. The host does **not** implement a relayer JSON-RPC client.
- **Delegated execution (Path B):** when the host or backend will **redeem** a user grant via public relayer JSON-RPC, also install the **`public-relayer`** skill.
  - **B1 direct:** grant **`to: relayer targetAddress`** → Example 0b in **`public-relayer/references/examples.md`**.
  - **B2 session key (recommended):** grant **`to: host session account`**, redelegate **`to: targetAddress`**, submit delegation chain → Example 0c.
  - See **`public-relayer/SKILL.md`** (Integration paths with `1shot-wallet`).
- **Status webhooks:** optional `configure.destinationUrl` — the wallet forwards it to the relayer on send. Still no direct relayer client in the host.

## EIP-7715 delegation creation

Hosts request grants with EIP-1193 `wallet_requestExecutionPermissions`. The wallet builds MetaMask Smart Accounts Kit **Delegations**, shows consent UI, EIP-712-signs with the user’s DeleGator, encrypts vault rows, and returns one response per param entry (`context`, `delegationManager`, attenuated `permission`, …).

### Request shape (mental model)

```ts
// params: IExecutionPermissionRequest[]  → one entry = one root Delegation
{
  chainId,           // hex EVM chain id
  from?,             // optional; wallet uses unlocked account when omitted
  to,                // delegate (bot / session / relayer target)
  permission: {      // SINGULAR scope / product type — correct EIP-7715
    type,            // e.g. "lifi-swap-periodic" | "erc20-token-periodic" | …
    isAdjustmentAllowed,
    data,            // type-specific fields only (never nest extra enforcers here)
  },
  rules?: [          // OPTIONAL host-stacked enforcers — sibling of permission
    { type: string, data: Record<string, unknown> },
  ],
}
```

| Concept | Rule |
|---------|------|
| `params[]` entries | **Multiple Delegations** (approve, fee, swap, hop-2, …). Batch = wizard consent, then **one** passkey sign for all, then vault upload. |
| `permission` | **One** product/scope type per Delegation. Do **not** put multiple enforcers inside `permission`. |
| `rules[]` | Host-stacked enforcers (EIP-7715). Wallet maps each to kit `addCaveat` / DF `caveats` at sign time; unknown `type` → reject before sign. |
| Parent/child chains | **Do not** encode approve+swap as one `Delegation[]` authority chain. Separate `params` entries → separate `context`s. |

Discover support: `wallet_getSupportedExecutionPermissions`. Every permission type advertises the same `ruleTypes` — the full host `rules[]` allowlist (kit types + `chainlink-price-rule`). Host rules are validated identically for all permission types at grant time.

### What the wallet builds per `permission.type`

| `permission.type` | Chains (v1) | Built DF caveats (before host `rules[]`) |
|-------------------|-------------|----------------------------------------|
| `erc20-token-periodic` | All relayer chains | Kit `ScopeType.Erc20PeriodTransfer` (+ host rules merged via `createDelegation`) |
| Kit scopes (`erc20-transfer-amount`, `erc20-streaming`, `native-transfer-amount`, `native-streaming`, `native-period-transfer`, `erc721-transfer`, `ownership-transfer`, `function-call`) | Relayer chains | Matching kit scope (+ host rules) |
| `lifi-swap-approve` | Arc `0x13b2`, Base `0x2105`, Ethereum `0x1` | `allowedTargets(token)` → `allowedMethods(approve)` → `allowedCalldata(spender)` → `valueLte(0)` → **then** host `rules[]` |
| `lifi-swap-periodic` | Arc, Base, Ethereum | `allowedTargets(lifiDiamond)` → `valueLte(0)` → `LiFiSwapEnforcer` (284-byte terms, `args: "0x"`) → **then** host `rules[]` |

**`lifi-swap-approve` data:** `tokenAddress`, `spender` (LiFi Diamond). Amount is not pinned — delegate may approve `maxUint256`.

**`lifi-swap-periodic` data:** `lifiDiamond`, `tokenAddress`, `outputAssetId` (`bytes32`), `outputRecipient` (`bytes32`), `destinationChainId` (number or decimal string), `quoteSigner`, `periodAmount` (hex atoms), `periodDuration` (seconds). Optional: `startDate`, `slippageBps` (default `50`, `< 10000`). Do **not** put price rules in `data` — use `rules[]`.

**Amounts:** pass `periodAmount` as hex atoms. Playground demos often use **10 USDC** (`0x989680`).

Grant response echoes attenuated fields plus `delegationHash` on `permission.data`. Host-stacked rules are echoed under `permission.data.caveats` when present (DF naming on the attenuated permission). Quote signing at redemption stays with the host/`quoteSigner` backend.

Typical LiFi product batch: approve + fee (`erc20-token-periodic`) + swap (+ optional second-hop trio). Each item gets its own vault row and `context`.

### Host-led rule stacking (`rules[]`)

After the wallet’s fixed stack (scope or LiFi convenience caveats), validated host `rules` are **mapped to DF caveats and appended**. All caveats on a Delegation must pass (**AND**). Host rules are appended after the wallet stack; for LiFi+Chainlink that yields AllowedTargets → ValueLte → LiFiSwap → Chainlink (or additional kit types). Grant UI validates `rules[]` the same way for every permission type (periodic, kit scopes, LiFi).

**Allowlisted `rules[].type` values:**

| `type` | Packing | Notes |
|--------|---------|-------|
| `allowedCalldata` | Kit | `{ startIndex, value }` |
| `allowedTargets` | Kit | `{ targets: address[] }` |
| `allowedMethods` | Kit | `{ selectors: \`0x…\`[] }` |
| `valueLte` | Kit | `{ maxValue }` (bigint / number / decimal string) |
| `timestamp` | Kit | `{ afterThreshold, beforeThreshold }` Unix seconds |
| `redeemer` | Kit | `{ redeemers: address[] }` |
| `limitedCalls` | Kit | `{ limit }` |
| `nonce` | Kit | `{ nonce }` hex |
| `id` | Kit | `{ id }` |
| `chainlink-price-rule` | Custom 68-byte terms | Enforcer `0x4dAEbF9C5813EFF2606acD41BA25e57841e7cb75`; grant-time `args: "0x"` |

Any other `type` is rejected. Kit config shape is validated at `addCaveat` time; `chainlink-price-rule` is fully validated up front (trusted feed + field rules). Consent UI shows each host rule as its own terms card; Grant stays disabled until every rule is valid.

#### `chainlink-price-rule` data

Wallet hard-verifies `priceFeed` against a curated trusted list (ETH/BTC/PAXG on Ethereum + Arc; ETH/BTC on Base). Malicious feeds never reach signing. `expectedDecimals` must match the feed (8 for these USD pairs). For Arc hop-1 redemptions, pin Arc feed proxies — Ethereum mainnet feed addresses have no code on Arc and cause empty `estimateGas` reverts. Official per-network proxy lists: Chainlink RDD JSONs linked from `smartcontractkit/documentation` `chains.ts` (`rddUrl`), e.g. `feeds-arc-mainnet.json` / `feeds-mainnet.json` / `feeds-ethereum-mainnet-base-1.json`.

| Field | Relative (Dip=0 / Rise=1) | Absolute (Gte=2 / Lte=3) |
|-------|---------------------------|--------------------------|
| `windowSeconds` / `thresholdBps` | required (`thresholdBps` 1–9999) | set `0` |
| `triggerPrice` | `"0"` | feed units as decimal string (`> 0`) |
| `maxStaleSeconds` | `> 0` | `> 0` |
| `minGapSeconds` | `≥ 0` | `≥ 0` |

Terms packing matches [ChainlinkPriceRuleLib](https://github.com/1Shot-API/delegation-framework/blob/main/src/libraries/ChainlinkPriceRuleLib.sol) (68 bytes). Redeemer fills `args` with `abi.encode(uint80 referenceRoundId)` at execution — not part of the grant signature. See the [wallet integration guide](https://github.com/1Shot-API/delegation-framework/blob/main/ChainlinkPriceRuleEnforcer-Wallet-Integration.md).

#### Example — LiFi swap + Chainlink dip (Pattern A)

```ts
const responses = await proxy.ethereum.request({
  method: "wallet_requestExecutionPermissions",
  params: [
    {
      chainId: "0x13b2",
      from: userAddress,
      to: quoteSigner, // or session account / relayer target
      permission: {
        type: "lifi-swap-approve",
        isAdjustmentAllowed: true,
        data: { tokenAddress: usdc, spender: lifiDiamond },
      },
    },
    {
      chainId: "0x13b2",
      from: userAddress,
      to: quoteSigner,
      permission: {
        type: "lifi-swap-periodic",
        isAdjustmentAllowed: true,
        data: {
          lifiDiamond,
          tokenAddress: usdc,
          outputAssetId,      // bytes32
          outputRecipient,    // bytes32
          destinationChainId: "1",
          quoteSigner,
          periodAmount: "0x989680", // 10 USDC
          periodDuration: 86400,
          slippageBps: 50,
        },
      },
      // Host stacking — NOT nested under permission.data
      rules: [
        {
          type: "chainlink-price-rule",
          data: {
            priceFeed: "0x50FCDD99D6762D1C170DC6A9111db944AEE6D364", // ETH/USD (Arc)
            ruleKind: 0,           // Dip
            expectedDecimals: 8,
            windowSeconds: 86400,
            thresholdBps: 1000,    // 10%
            maxStaleSeconds: 3600,
            minGapSeconds: 60,
            triggerPrice: "0",
          },
        },
      ],
    },
  ],
});
// Decode each responses[i].context with decodeDelegations for redeem / storage
```

Signed swap DF `Caveat[]` includes AllowedTargets, ValueLte, LiFiSwapEnforcer, and ChainlinkPriceRuleEnforcer. Host/backend patches Chainlink (and LiFi quote) **args** at redeem time via the relayer path (`public-relayer` skill).

## Hard rules

- Never embed the Signing Layer iframe from the Host — always Host → Branding → Signing.
- Prefer the published wallet URL in production; point at a local Branding origin only while developing this repo.
- Theme with `configure`; do not ask integrators to fork CSS for basic brand colors / product name.
- Use `focusWallet` / `unfocusWallet` for host-driven single-asset flows; do not expose mode switching in the wallet UI.
- Use `addAsset` when the host wants a lasting Balances entry; expect a confirm modal (contrast with `focusWallet`).
- Use `onramp` (or the in-wallet Buy button) for fiat → crypto; do not put the Circle kit key in the Host or Branding Layer.
- Use `bridge` (or the in-wallet Bridge button) for CCTP USDC (EVM↔Solana); EVM source is gasless via the relayer, Solana source pays SOL for the burn — never require dest-chain `receiveMessage`.
- Stack extra enforcers via sibling `rules[]` on `wallet_requestExecutionPermissions` — never nest them in `permission.data`, and never invent unlisted rule `type`s. (DF “caveats” exist only after the wallet maps `rules` at sign time.)
- Keep approve / fee / swap as separate `params` entries (separate Delegations), not one authority chain.
