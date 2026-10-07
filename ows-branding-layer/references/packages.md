# OWS packages for a Branding Layer

## Install

Aligned with `examples/general-wallet/package.json`:

```bash
npm install \
  @1shotapi/ows-types \
  @1shotapi/ows-wallet-utils \
  @1shotapi/ows-signer-utils \
  @1shotapi/ows-oid4 \
  viem
```

Notes:

- `viem` is a peer of `ows-signer-utils` (EVM helpers).
- `postmate` and `zod` are **transitive** via `ows-wallet-utils` — do not vendor Postmate; add a direct `zod` dep only if you author custom `registerRpc` schemas.
- `@1shotapi/ows-signer` is plain JS sources. Prefer **copy or static-serve** into your app (no build step). Same origin as branding so `rpId === location.hostname`. Consuming it solely as an npm import of TS modules is not the reference pattern.
- `@1shotapi/ows-provider` is for **host** apps only — omit from a branding-only package unless the same origin also serves a demo host.

Until packages are on npm, depend via workspace, `file:`, or git:

```bash
# example — sibling clone
npm install ../open-wallet/packages/ows-types
```

## Package roles

| Package | Import surface | Branding uses it for |
|---------|----------------|----------------------|
| `ows-types` | primitives, errors, credentials, EIP-1193 / EIP-7715 tables, `CredentialCryptoUtils`, `PresentationUtils`, `ProofUtils` | Branded values, holder signer bridge, shared errors |
| `ows-wallet-utils` | `OWSWallet`, `RpcHelper` (+ optional `executionPermissions` hooks), display child client, `wallet.analytics.emit`, `wallet.providerEvents.emit` | Postmate child, EIP-1193 / custom RPC registration, reads/chain, `requestDisplay`, Branding→Host analytics + EIP-1193 events |

| `ows-signer-utils` | `OWSSigner`, `SignHelper`, `showSignerCeremonyPanel`, `evm.*` | Nested signer iframe, consent→sign wiring, digests → signatures |
| `ows-oid4` | `CredentialsHelper`, `issueCredentialAfterApproval`, `presentCredentialAfterApproval`, HTTP OID4 clients | Thin accept/present adapter + branding `approveAnd*` ownership |
| `ows-signer` | static files | Custody kernel under `/signer/` |

There is **no** branding-core / registry package. App-local UI and wiring live in your repo (see `examples/general-wallet/src/ows/`).

### Constructor arg order (easy to swap)

| Helper | Order |
|--------|-------|
| `SignHelper` | `(signer, wallet, options)` |
| `CredentialsHelper` | `(wallet, options)` — holder signer via `createCredentialsHolderSigner(signer)` in branding hooks |

## Serving the Signing Layer

Mirror `examples/general-wallet`:

- Branding app may use Vite `base: "/wallet/"` for the UI.
- Signer is served at **`/signer/` outside that base** via middleware so WebAuthn + nest stay same-origin (`vite.config.ts` `serveSignerPlugin`).
- HTML shell: `signer-static/index.html`; JS from package `src/`.
- Prod: `scripts/copy-signer.mjs` → `dist/signer/`.

```typescript
const signerUrl = new URL("/signer/", window.location.origin).href;
```

## Credentials stack (optional)

Prefer `CredentialsHelper` + HTTP clients from **`@1shotapi/ows-oid4`**. Demo-only stores / trust / keys live under `examples/shared` in open-wallet (not published) — product apps supply their own `ICredentialRepository`, trust registry, and OID4 clients.

Holder signing: omit `holderSigner` to use the default OWS Ed25519 bridge (`CredentialCryptoUtils.createOwsEd25519HolderSigner` in `ows-types`), or pass your own `IHolderSigner`.

## Host apps (not branding)

Hosts use `@1shotapi/ows-provider` (`OWSProxy`) only. Host-only options include `allowLocalAccess` (iframe permissions for Local Network Access when branding on a public origin fetches `127.0.0.1` / private LAN OID4 endpoints).
