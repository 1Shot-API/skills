# Branding Layer tasks

Task-oriented guidance aligned with `examples/general-wallet`. Specialize freely; production branding apps may lead with **custom host RPC** and skip MetaMask-shaped EIP-1193. The reference wallet is **EIP-1193-first**.

Paths below are under `examples/general-wallet/` unless noted.

## 1. Scaffold

1. Install packages (see [packages.md](packages.md)).
2. Serve `@1shotapi/ows-signer` as static **`/signer/` on the same origin** as branding (`rpId === location.hostname`). Set CSP `frame-ancestors 'self'` on `/signer/`. Cross-origin CDN signer embeds are not supported.
   - Dev: Vite middleware maps `/signer/` → `signer-static/index.html` and `/signer/src/` → package `src/` (**outside** Vite `base`, e.g. `/wallet/`). See `vite.config.ts`.
   - Prod: `scripts/copy-signer.mjs` into `dist/signer/`.
3. Signer URL: `new URL("/signer/", window.location.origin).href` (origin root, not under app `base`).
4. Create a hidden signer host (`src/components/SignerHost.tsx`), then **start Postmate before awaiting nested signer load**:

```typescript
const wallet = OWSWallet.prepare();
const signerPromise = OWSSigner.create(container, signerUrl, {
  hidden: true,
  credentialId: loadCredentialId(),
});
const signer = createDeferredSigner(() => signerPromise); // WalletProvider.tsx
// …register handlers (ensureReady awaits signerPromise + unlock)…
void wallet.start(); // registers Model immediately
void signerPromise; // background — do not block UI/paint on this
```

Also see `scripts/dev.mjs` (ngrok HTTPS for passkeys). Do not run leftover `--no-tunnel` processes on the same port while hosts expect a tunnel URL.

## 2. Unlock (`awaitSignerReady` vs `ensureReady`)

App-owned passkey create / login. Split readiness:

| Helper | Waits for |
|--------|-----------|
| `awaitSignerReady()` | Signing Layer iframe + `OWSSigner` instance |
| `ensureReady()` | Signer ready **plus** unlocked / wallet created |

- Persist credential id + cached addresses in app storage (`src/storage.ts`).
- Gate signing and account-connect behind `ensureReady()`.
- Embedded first-run UI when `window.parent !== window.top` is optional — `OnboardingPanel.tsx` / `WalletProvider.tsx` `runSetupFlow`.
- Host-driven setup: wrap with `requestDisplay` + setup modals (`SetupModals.tsx`).

No published SDK for setup dialogs; keep UI local.

## 3. Display shell

Before WebAuthn or consent UI in a cross-origin host embed:

```typescript
const display = await wallet.requestDisplay();
try {
  // dialogs / passkey / overlay
} finally {
  await display.hide();
}
```

Also available: `wallet.requestHide()`. Host wire event `ows:releaseDisplay` is reached via `DisplaySession.release()` / hide paths — branding apps should prefer `display.hide()`.

Host `OWSProxy` shows a lower-right opaque flyout (no modal backdrop).

**App concerns (not SDK):**

- **Modal queue** — serialize concurrent dialogs (`WalletProvider` `pushModal` / `ModalHost.tsx`).
- Nested `requestDisplay` may reuse an active session (depth). Helpers (`SignHelper`, `CredentialsHelper`) already call `requestDisplay` — **do not double-wrap** those handler paths with another outer display.

## 4. Host RPC (primary for specialized wallets) + EIP-1193

**Specialized wallets:** register custom methods the host calls via `proxy.rpc` / your protocol (`wallet.registerRpc`).

**Reference wallet path (EIP-1193):**

1. `src/ows/registerAccountConnect.ts` — `eth_accounts` / `eth_requestAccounts` (cached addresses; connect consent + `ensureReady`). Emit `wallet.providerEvents.emit("accountsChanged", [evm])` after a new connect.
2. `RpcHelper` for JSON-RPC reads / `wallet_switchEthereumChain` (`src/ows/demoChains.ts`, construct in `WalletProvider.tsx`). Forward `rpc.events.on("chainChanged", …)` to `wallet.providerEvents.emit("chainChanged", next)` so hosts listening on `proxy.ethereum.on("chainChanged", …)` stay in sync.
3. `SignHelper` for `personal_sign` / typed data (task 5).

```typescript
new RpcHelper(
  new Map([[chainId, rpcUrl] /* … */]),
  wallet,
  signer, // optional; unused for reads today
  { defaultChainId },
);
```

Call after `prepare()`, before `start()`. Zod EIP-1193 / credential wire schemas live in `ows-wallet-utils` (transitive).

### EIP-7715 execution permissions (optional)

`RpcHelper` can register the four EIP-7715 draft methods when you pass `executionPermissions` hooks. **OWS does not ship grant/revoke UI** — implement consent, MetaMask Delegation Framework signing, and storage in your branding app. Reference: the **1Shot embedded-wallet** repo (`DelegationService`, grant modal, Delegations tab).

```typescript
new RpcHelper(providers, wallet, signer, {
  defaultChainId,
  executionPermissions: {
    requestExecutionPermissions: async (requests) => { /* grant UI + sign + store */ },
    revokeExecutionPermission: async ({ permissionContext }) => { /* cancel UI + on-chain disable */ },
    getSupportedExecutionPermissions: async () => ({
      "erc20-token-periodic": {
        chainIds: [...rpcHelper.getConfiguredChainIds()],
        ruleTypes: [],
      },
    }),
    getGrantedExecutionPermissions: async () => { /* map stored grants */ },
  },
});
```

Methods (strict EIP-7715 names only — no `wallet_grantPermissions` alias):

| Method | Role |
|--------|------|
| `wallet_requestExecutionPermissions` | Host requests permissions; branding returns attenuated responses + `context` / `delegationManager` |
| `wallet_revokeExecutionPermission` | Host asks user to revoke via `{ permissionContext }` |
| `wallet_getSupportedExecutionPermissions` | Supported permission types + chain ids |
| `wallet_getGrantedExecutionPermissions` | Previously granted (non-revoked) permissions |

Omit `executionPermissions` to leave these methods unimplemented (`OwsUnimplementedError`).

## 5. Signing consent

Thin EIP-1193 adapter in `SignHelper` (`@1shotapi/ows-signer-utils`):

```
requestDisplay → branding approveAndSign* (ensureReady + consent + OWSSigner + onAuthenticated) → hide
```

Registers: `personal_sign`, `eth_signTypedData`, `eth_signTypedData_v3`, `eth_signTypedData_v4`, `eth_sendTransaction`. Reject with `OwsUserRejectedError`.

Create `RpcHelper` before `SignHelper`. Pass `getChainId` from RpcHelper. Branding implements `approveAndSign*` (consent + Signing Layer; use exported `prepareEvmTransaction` for sends). Call **setup-only** `ensureReady` and `onAuthenticated` inside those branding callbacks (or in `registerApprovalSigning` wrappers) — not on `SignHelper` options.

```typescript
const signHelper = new SignHelper(signer, wallet, {
  getChainId: () => rpcHelper.getChainId(),
  approveAndSignPersonalMessage, // ensureReady → consent + sign → onAuthenticated → signature
  approveAndSignTypedData,
  approveAndSignTransaction, // SendTransactionApprovalRequest → EVMTransactionHash
});
for (const [method, handler] of Object.entries(signHelper.handlers)) {
  wallet.registerEip1193(method, handler);
}
```

Reference: `src/ows/registerApprovalSigning.ts`, `src/components/modals/SignModals.tsx`, `src/wallet/withWalletReady.ts` (embedded-wallet).

## 6. Recovery (create / restore backup)

Create / restore encrypted backup — **never reparent** the signer iframe.

Reference: `src/components/modals/BackupModals.tsx`, called from `WalletProvider` `openCreateBackup` / `openRestoreBackup`.

1. Outer `wallet.requestDisplay` for the dialog shell (WalletProvider wrappers).
2. Call recovery APIs directly — `OWSSigner` shows a centered ceremony panel for passphrase + passkey Confirm automatically.
3. Create: `ensureReady()` then `signer.createRecoveryData(passwordText, buttonText, minPasswordLength, { explanationHeader, explanationText })`.
4. Restore: **`awaitSignerReady()` only** (not `ensureReady`) then `signer.recoverKey(encrypted, passwordText, buttonText, ceremonyUi?)`.
5. Cancel on the Signing Confirm UI rejects with `OwsSignDeniedError` (`SignDenied`).

Passkey Confirm lives in Signing (required for mobile WebAuthn focus). Branding-native WebAuthn (e.g. Relayer assertion) may still use a Branding explanation overlay.

## 7. Credentials (optional)

Prefer `CredentialsHelper` from `@1shotapi/ows-oid4` (not exported from `ows-wallet-utils`). Like `SignHelper`, it is a **thin adapter**: resolve offer/request, trust/match, `requestDisplay`, call branding `approveAnd*`, then **`release()`** (not `hide()`).

```typescript
import {
  CredentialsHelper,
  createCredentialsHolderSigner,
  issueCredentialAfterApproval,
  presentCredentialAfterApproval,
} from "@1shotapi/ows-oid4";

const resolveHolderSigner = createCredentialsHolderSigner(signer);

new CredentialsHelper(wallet, {
  repository,
  oid4vci,
  oid4vp,
  trust,
  approveAndAcceptOffer: async (request) => {
    await ensureOnboarded(); // setup-only; PoP authenticates
    if (!(await requestCredentialOfferApproval(request))) {
      throw new OwsUserRejectedError("User rejected credential offer");
    }
    const receipt = await issueCredentialAfterApproval({
      offer: request.offer,
      metadata: request.metadata,
      oid4vci,
      repository,
      resolveHolderSigner,
      getProofNonce,
      attestationProvider,
    });
    await onAuthenticated();
    return receipt;
  },
  approveAndPresent: async (request) => {
    if (!(await requestCredentialPresentationApproval(request))) {
      throw new OwsUserRejectedError("User rejected credential presentation");
    }
    const result = await presentCredentialAfterApproval({
      definition: request.definition,
      credential: request.credential,
      oid4vp,
      resolveHolderSigner,
      attestationProvider,
    });
    await onAuthenticated();
    return result;
  },
}).register();
```

Constructor: **`(wallet, options)`** — signer is only needed for `createCredentialsHolderSigner` / PoP inside branding hooks.

Do **not** put full `ensureReady` / unlock on helper options. Warm vault + known credential → **one** passkey for PoP. Empty vault before `present` → unlock/recover in a registration gate (see `ensureCredentialsReadable` in embedded-wallet), then consent + PoP.

Reference stack:

- Wiring: `src/ows/registerCredentialsProvider.ts`
- Consent UI: `src/components/modals/CredentialModals.tsx`
- Demo repositories / trust / HTTP clients fixtures: `examples/shared` (alias `@ows-shared` in the monorepo — not published)
- Wire methods: `credentials.acceptOffer` / `present` / `list` / `delete`

Do **not** call `PresentationUtils` / low-level SD-JWT helpers unless you bypass `CredentialsHelper`. Holder KB JWT lives in `createCredentialsHolderSigner` / `CredentialCryptoUtils` (`@1shotapi/ows-types`).

Host demos: `examples/credential-issuer`, `examples/credential-verifier` (use `ows-provider`; `allowLocalAccess` is host-only). Do not call `proxy.showWallet()` before issue/present — `CredentialsHelper` `requestDisplay` opens the host panel.

## 9. Clear signing (ERC-7730, optional)

Show known contract calls and EIP-712 messages as an intent plus labeled fields instead of raw calldata. The 1Shot relayer resolves descriptors from the official registry (`ethereum/clear-signing-erc7730-registry`); `@1shotapi/ows-clear-signing` decodes and formats them locally.

```
approveAndSign* → ClearSigningUtils.calldataLookupKey / eip712LookupKey
  → GET {relayer}/clear-signing/calldata | /clear-signing/eip712   (parse: ClearSigningLookupResultSchema)
  → ClearSigningFormatter.formatCalldata / formatTypedData
  → clear-sign consent UI        (null key, miss, error, timeout, ClearSigningError → generic UI)
```

Relayer routes (public, rate-limited, cacheable for 1 h; production `https://relayer.1shotapi.com`, dev `https://relayer.1shotapi.dev`):

- `GET /clear-signing/calldata?chainId=<hex|dec>&address=<0x…>&selector=<0x + 8 hex>`
- `GET /clear-signing/eip712?chainId=<hex|dec>&verifyingContract=<0x…>&primaryType=<name>&encodeTypeHash=<0x + 64 hex>`

Both answer `{ found: true, registrySha, path, descriptor }` or `{ found: false }`. Pass the lookup key fields straight through as query params.

Rules:

- **Never block consent.** Time-box the lookup (about 2 s), treat every failure as a miss, and keep the generic consent UI as the fallback. Cache answers for the session.
- **Never trust the descriptor.** Parse with `ClearSigningLookupResultSchema` and render only through `ClearSigningFormatter`. It re-checks the deployment binding, selector / `encodeType`, and EIP-712 domain, and decodes values itself, so a bad resolver can at worst mislabel. Its `ClearSigningError` means "fall back", not "reject the request".
- **Keep classification order.** SIWE and any dedicated ERC-20 transfer UI run first; clear signing replaces only the generic transaction / typed-data view.
- **Show attached native value** when no descriptor field has kind `NativeAmount`, and keep the raw view reachable (collapsed).
- **`IClearSigningEnvironment` is yours to implement:** token metadata (local registry, then on-chain `symbol` / `decimals`, cached and time-boxed), native currency, chain name, address names. Return `null` when unknown; the formatter shows raw values with a warning.

```typescript
import { ClearSigningFormatter, ClearSigningUtils } from "@1shotapi/ows-clear-signing";

const formatter = new ClearSigningFormatter(environment);
const key = ClearSigningUtils.calldataLookupKey(chainId, to, data); // null → no selector
const found = key ? await lookupCalldata(key) : null; // fetch + timeout + schema parse; null on any failure
const display = found
  ? await formatter
      .formatCalldata(found.descriptor, { chainId, from, to, data, value })
      .catch(() => null)
  : null;
// display ? clear-sign modal (title = display.intent, rows = display.fields) : generic modal
```

Reference (embedded-wallet): `src/lib/implementations/business/ClearSigningService.ts`, `src/lib/implementations/data/RelayerClearSigningRepository.ts`, `src/lib/implementations/utils/ClearSigningEnvironment.ts`, `src/components/modals/ClearSigningDetails.tsx`, and the `describeTransaction` / `describeTypedData` branches in `src/wallet/useWalletBoot.ts`.
