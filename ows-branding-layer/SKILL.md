---
name: ows-branding-layer
description: >-
  Build an Open Wallet Standard (OWS) Branding Layer with @1shotapi/ows-wallet-utils,
  ows-signer-utils, ows-types, and optional ows-oid4. Use when scaffolding a branding
  wallet, wiring OWSWallet/OWSSigner, RpcHelper/SignHelper/CredentialsHelper, passkey
  unlock, custom host RPC, signing consent, recovery overlay, credentials, or display
  shell in a separate repo.
license: MIT
metadata:
  author: 1Shot-API
  version: "0.3.0"
  repository: https://github.com/1Shot-API/skills
---

# OWS Branding Layer

Teach an agent how to scaffold and extend an **OWS Branding Layer** in any repository.

UI, flow ownership, and display queuing stay **app-owned**. Published packages provide thin protocol helpers (`RpcHelper`, `SignHelper`, `CredentialsHelper`, `showSignerCeremonyPanel`) — not a module/registry runtime.

When a local clone of [open-wallet](https://github.com/1Shot-API/open-wallet) is available (multi-root workspace), prefer grepping `examples/general-wallet` over guessing from this skill alone.

## Install this skill (consumer / global)

```bash
npx skills add 1Shot-API/skills/ows-branding-layer -g -a cursor -y
# or: npx skills add https://github.com/1Shot-API/skills --skill ows-branding-layer -g -a cursor -y
# or from a sibling clone: npx skills add ../skills --skill ows-branding-layer -g -a cursor -y
```

Then invoke `/ows-branding-layer` or ask to build a branding wallet.

## Architecture (non-negotiable)

```
Host Layer          @1shotapi/ows-provider     EIP-1193 / credentials proxy
  └── Branding      THIS APP                   UX + Postmate child + helpers
        └── Signing @1shotapi/ows-signer       WebAuthn PRF custody (nested iframe)
```

- Host **never** embeds the Signing Layer. Always Host → Branding → Signing.
- Signing Layer accepts `postMessage` only from `window.parent` when `window.parent !== window.top`.
- Passkeys require a **secure context on the entire ancestor chain** — Host and Branding/Signer must be HTTPS (or `localhost` / `*.localhost`).
- `allowLocalAccess` is a **host** `OWSProxy` option (LAN OID4 from a public branding origin). Do not put it on branding APIs.

Details: [references/architecture.md](references/architecture.md)

## Packages

| Package | Role |
|---------|------|
| `@1shotapi/ows-types` | Branded primitives, errors, credential types, EIP-1193 tables, `CredentialCryptoUtils` / `PresentationUtils` / `ProofUtils` |
| `@1shotapi/ows-wallet-utils` | Branding ↔ Host (`OWSWallet`, `RpcHelper`, `requestDisplay`) |
| `@1shotapi/ows-signer-utils` | Branding ↔ Signing (`OWSSigner`, `SignHelper`, `showSignerCeremonyPanel`) |
| `@1shotapi/ows-oid4` | Optional credentials (`CredentialsHelper`, HTTP OID4VCI/OID4VP clients) |
| `@1shotapi/ows-signer` | Plain JS Signing Layer sources (serve as static `/signer/`) |

```bash
npm install \
  @1shotapi/ows-types \
  @1shotapi/ows-wallet-utils \
  @1shotapi/ows-signer-utils \
  @1shotapi/ows-oid4 \
  viem
# zod is transitive via ows-wallet-utils — add a direct dep only for custom registerRpc schemas
# Required: serve ows-signer HTML+JS on the same origin as branding (/signer/; CSP frame-ancestors 'self')
```

Details: [references/packages.md](references/packages.md)

## Task checklist

Copy and track progress. Order matches a typical first branding app; specialized wallets may skip EIP-1193 and lead with custom host RPC. The reference wallet (`examples/general-wallet`) is **EIP-1193-first**.

```
Branding Layer Progress:
- [ ] 1. Scaffold — packages + serve Signing Layer on same origin at /signer/
- [ ] 2. Unlock — passkey create/login (`awaitSignerReady` vs `ensureReady`)
- [ ] 3. Display shell — requestDisplay / hide + app-owned modal queue
- [ ] 4. Host RPC — EIP-1193 (RpcHelper + account connect) and/or custom registerRpc (optional `wallet.solana.register` / `wallet.bitcoin.register`)
- [ ] 5. Signing consent — SignHelper + app approval UI
- [ ] 6. Recovery — create/restore via `OWSSigner` auto ceremony panel (no iframe reparent)
- [ ] 7. Credentials — CredentialsHelper + branding `approveAndAcceptOffer` / `approveAndPresent` (optional)
- [ ] 8. EIP-7715 permissions — optional RpcHelper `executionPermissions` hooks (UI in your app; see embedded-wallet)
```

Task details + exact example paths: [references/tasks.md](references/tasks.md)

### Minimal boot sequence

Stock Postmate parents only retry the handshake briefly after branding iframe `load`. **Register `Postmate.Model` via `wallet.start()` before the nested Signing Layer finishes loading.** Use a deferred signer proxy so helpers can register with an `OWSSigner`-shaped object immediately.

Canonical implementation: `examples/general-wallet/src/wallet/WalletProvider.tsx` (`createDeferredSigner` + `boot`).

```typescript
import { OWSSigner, SignHelper } from "@1shotapi/ows-signer-utils";
import { OWSWallet, RpcHelper } from "@1shotapi/ows-wallet-utils";
// Optional credentials:
// import { CredentialsHelper } from "@1shotapi/ows-oid4";

const wallet = OWSWallet.prepare({ debug: false });

const signerPromise = OWSSigner.create(signerContainer, signerUrl, {
  hidden: true,
  credentialId: loadCredentialId(),
});
// Proxy that throws until signerPromise resolves — do NOT await signer before start().
const signer = createDeferredSigner(() => signerPromise); // copy pattern from WalletProvider

// Register before start (order in general-wallet):
// account connect → RpcHelper → SignHelper handlers → CredentialsHelper.register()
const rpcHelper = new RpcHelper(providers, wallet, signer, { defaultChainId });

const signHelper = new SignHelper(signer, wallet, {
  getChainId: () => rpcHelper.getChainId(),
  // Branding wrappers: ensureReady → consent + OWSSigner → onAuthenticated
  approveAndSignPersonalMessage,
  approveAndSignTypedData,
  approveAndSignTransaction, // branding: consent + prepare + sign + broadcast
});
for (const [method, handler] of Object.entries(signHelper.handlers)) {
  wallet.registerEip1193(method, handler);
}

// Optional:
// new CredentialsHelper(wallet, { approveAndAcceptOffer, approveAndPresent, … }).register();
// Note: CredentialsHelper(wallet, options); SignHelper(signer, wallet, options)

void wallet.start(); // registers Model immediately — do not await nested signer first
void signerPromise; // background load; UI can paint
```

Prefer **`OWSWallet.prepare()` → register handlers → `start()`**. Do not use a module install runtime.

Split readiness in your app:

| API | Meaning |
|-----|---------|
| `awaitSignerReady()` | Nested Signing Layer iframe + `OWSSigner` loaded |
| `ensureReady()` | Signer loaded **and** unlocked / onboarded (passkey) — for connect, credentials, recovery create |
| `ensureOnboardedForSigning()` | Setup/login **only if no credential id**; otherwise no-op — for branding signed-action gates |
| `onAuthenticated` | After successful sign / send (inside branding `approveAndSign*`): set unlocked + refresh addresses |

For custom RPCs such as `eth_sendTransaction` or future ERC-7710 sends, use the same **centralized signed-action gate**: setup-only before consent when the credential is missing; one passkey ceremony for the sign itself when the credential is known.

Restore-backup must use **`awaitSignerReady` only** — calling `ensureReady` first can force setup/login before recovery.

### Solana Host wire (`wallet.solana.register`)

Hosts that call `proxy.solana.registerSolanaWallet()` (Wallet Standard) or `proxy.solana.*` need Branding handlers. Register the full `IOpenWalletSolanaProvider`:

```ts
wallet.solana.register({
  async getAccountAddress() {
    await ensureReady();
    // session → storage → signer.solana.getAccountAddress()
    return address;
  },
  async signMessage(params) {
    // requestDisplay → SolanaSignModal consent → signer.solana.signMessage
    // return { signatures: SolanaSignature[] }
  },
  async signIn(params) {
    // Resolve SIWS defaults → SiwsModal → signer.solana.signMessage([utf8])
    // return { account, signedMessage: base64, signature }
  },
  async signTransaction(params) {
    // Cluster bind → decode/summary + simulate (warn) → SolanaSignAndSendModal
    // → signer.solana.signTransaction → { signatures }
  },
  async signAndSendTransaction(params) {
    // Same consent → sign → attach wire → Alchemy sendRawTransaction
    // → { signature: SolanaTransactionHash }
  },
});
```

**Tx ownership:** Branding owns Alchemy simulate/submit for `signAndSendTransaction`. Fee payer must be the user; reject extra required signers. Hosts never pass an Alchemy key.

Mirror pattern: embedded-wallet `registerSolanaProvider` + `SolanaSignModals` (and `registerBitcoinProvider` for Bitcoin). Configure copy keys: `copy.solanaSign`, `copy.siws`, `copy.solanaSignAndSend`, `copy.solana` (shell + SPL Add Asset / rent warnings).

### Solana SPL / tracked assets

Unify EVM + Solana under one `KnownAsset` / `TrackedAsset` model with `EAssetType.Spl` (do not overload `Erc20`). Refined aliases: `SolanaKnownAsset` / `SolanaTrackedAsset`. Persist `ataAddress` (`SolanaATAAddress` from ows-types) + `ataRentPaid` on tracked rows only — never put ATA on catalog `KnownAsset`. TrackedAssetId for Solana is case-preserving base58 (`${chainId}:${mint}`).

Host `addAsset` accepts Solana CAIP + mint; Branding should resolve **catalog mints only** for MVP, `ensureAta` (CreateIdempotent; user pays rent), then `trackedAssetRepository.add` with ATA fields. Primary UI never shows ATA; Receive = wallet pubkey + short “senders create token accounts” copy. SPL send may include dest CreateIdempotent + rent line on the confirm sheet.

## Hard rules (from OWS)

1. **Branded types** from `@1shotapi/ows-types` — use constructors (`EVMAccountAddress(...)`), never `as` casts.
2. **No deprecations** during pre-1.0 — rename and update all call sites.
3. Prefer **methods on objects** over free helpers when logic belongs to one class.
4. Set iframe `allow` for WebAuthn/clipboard **before** navigation (`OWSSigner` / host `OWSProxy` already do this).
5. Do not vendor Postmate — use the `postmate` package (transitive).
6. Do **not** reparent the signer iframe. Passphrase / Confirm UI is shown by `OWSSigner` via `showSignerCeremonyPanel` (bottom ceremony strip). Prefer that over manual `overlaySignerIframe`.
7. Prefer Vite `/signer/` at **origin root** even if the branding app uses a subpath `base` (e.g. `/wallet/`).

## Reference implementation

Canonical React + Vite + Tailwind demo: `examples/general-wallet` in [1Shot-API/open-wallet](https://github.com/1Shot-API/open-wallet).

| Concern | Start here |
|---------|------------|
| Boot / deferred signer | `src/wallet/WalletProvider.tsx` |
| Account connect | `src/ows/registerAccountConnect.ts` |
| Sign consent | `src/ows/registerApprovalSigning.ts`, `src/components/modals/SignModals.tsx` |
| Credentials | `src/ows/registerCredentialsProvider.ts`, `src/components/modals/CredentialModals.tsx` |
| Recovery | `src/components/modals/BackupModals.tsx` |
| Serve signer | `vite.config.ts`, `scripts/copy-signer.mjs`, `signer-static/index.html` |

## Out of scope for this skill

- Host Layer apps (`ows-provider`) — separate concern (`allowLocalAccess`, flyout chrome)
- Implementing or modifying `ows-signer` internals
- Publishing npm packages / changesets
- Shared React/Tailwind UI kits (apps own their UI)
- Calling `PresentationUtils` / SD-JWT low-level APIs unless you bypass `CredentialsHelper`
