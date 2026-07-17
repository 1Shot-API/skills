---
name: oneshot-embedded-wallet
description: >-
  Integrate the 1Shot embedded wallet (OWS Host Layer) with @1shotapi/ows-provider.
  Use when embedding wallet.1shotapi.com, wiring OWSProxy, EIP-1193, credentials,
  or custom RPC such as setStyle for theming the 1Shot Branding Layer.
license: MIT
metadata:
  author: 1Shot-API
  version: "0.1.0"
  repository: https://github.com/1Shot-API/embedded-wallet
---

# 1Shot Embedded Wallet (Host integration)

Teach an agent how to embed the **1Shot Wallet** Branding Layer from a Host Layer app using `@1shotapi/ows-provider`.

```
Host (your dapp)          @1shotapi/ows-provider → OWSProxy
  └── Branding iframe     https://wallet.1shotapi.com/
        └── Signing       https://wallet.1shotapi.com/signer/  (same origin)
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
await proxy.rpc("setStyle", {
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

## Custom RPC — `setStyle`

1Shot-specific method registered on the Branding Layer. Call via:

```typescript
await proxy.rpc("setStyle", options);
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
| `copy.createBackup.title` | string | create backup modal title |
| `copy.createBackup.body` | string | supports `{minLength}` |
| `copy.createBackup.passphrasePrompt` | string | Signing Layer passphrase label (`{minLength}`) |
| `copy.createBackup.continueLabel` | string | Signing Layer continue |
| `copy.createBackup.cancelLabel` | string | Cancel button |
| `copy.createBackup.closeLabel` | string | Close button |
| `copy.createBackup.copyLabel` | string | Copy button |
| `copy.createBackup.copiedLabel` | string | after successful copy |
| `copy.createBackup.copyFailedLabel` | string | copy failure |
| `copy.createBackup.doneLabel` | string | Done button |
| `copy.createBackup.encryptedLabel` | string | result ciphertext label |
| `copy.createBackup.passwordTooShortError` | string | short passphrase error |
| `copy.createBackup.cancelledError` | string | passkey cancelled |
| `copy.createBackup.failedError` | string | generic failure |
| `copy.restoreBackup.title` | string | restore backup modal title |
| `copy.restoreBackup.body` | string | restore prompt body |
| `copy.restoreBackup.passphraseLabel` | string | Signing Layer passphrase label |
| `copy.restoreBackup.restoreLabel` | string | Signing Layer restore button |
| `copy.restoreBackup.cancelLabel` | string | Cancel button |
| `copy.restoreBackup.closeLabel` | string | Close button |
| `copy.restoreBackup.doneLabel` | string | Done button |
| `copy.restoreBackup.successBody` | string | success message |
| `copy.restoreBackup.decryptFailedError` | string | bad passphrase error |
| `copy.restoreBackup.cancelledError` | string | passkey cancelled |
| `copy.restoreBackup.failedError` | string | generic failure |
| `dark` | boolean | toggles `html.dark` |

Returns `{ ok: true, productName: string }` with the resolved product name after merge.

Unknown keys are rejected (Zod `.strict()`).

See also [README.md](../../README.md) in this repository.

## Other Host APIs

| API | Use |
|-----|-----|
| `proxy.ethereum.request(...)` | EIP-1193 (accounts, sign, chain, …) |
| `proxy.credentials.*` | OID4 offer / present (when enabled in wallet) |
| `proxy.showWallet()` / `hideWallet()` | Host-driven flyout without an EIP-1193 call |
| `proxy.rpc(method, params)` | Custom Branding RPC (`setStyle`, …) |

## Hard rules

- Never embed the Signing Layer iframe from the Host — always Host → Branding → Signing.
- Prefer the published wallet URL in production; point at a local Branding origin only while developing this repo.
- Theme with `setStyle`; do not ask integrators to fork CSS for basic brand colors / product name.
