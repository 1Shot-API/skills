# OWS Branding Layer architecture notes

## Three layers

| Layer | Runs where | Trust / UX |
|-------|------------|------------|
| Host | Integrator dapp | EIP-1193 / credentials proxy; must be secure context if it embeds HTTPS wallet |
| Branding | Wallet origin (your product) | Branding, consent, app-owned UI + SDK helpers |
| Signing | Nested iframe (prefer same origin as branding) | Passkeys / PRF; minimal attack surface |

## Origins and `rpId`

- Signing Layer `rpId` is always `window.location.hostname` of the signer document.
- Prefer **same origin** for branding + signer (shared passkey namespace).
- Reference layout: branding UI may live under a path (`/wallet/`) while signer document is at `/signer/` on the **same origin**.
- Canonical CDN / on-chain gateway is an alternative shared `rpId` for all integrators.

## Secure contexts

Browsers require the **entire iframe ancestor chain** to be secure for WebAuthn. Therefore:

- Production hosts: HTTPS
- Local custom hosts (`ows-host.com`): HTTPS via mkcert (see `examples/host` in open-wallet)
- `http://localhost` remains a special-case secure context
- Branding demos often use ngrok HTTPS (`examples/general-wallet/scripts/dev.mjs`)

## Display protocol

Branding:

1. `const display = await wallet.requestDisplay()`
2. Run WebAuthn / approval UI inside the branding iframe
3. Prefer `display.release()` for helper-owned sessions (`SignHelper`, `CredentialsHelper`) so host `showWallet` / in-flight RPC can keep the panel open; use `display.hide()` / `wallet.requestHide()` for intentional dismiss

Host `OWSProxy` presents the panel using host-configured `walletSizeX` / `walletSizeY`: lower-right flyout when the viewport is wide enough for the panel width plus a 16px margin on each side; otherwise a full-screen drawer with a bottom wipe open / wipe-down close. No modal backdrop. Branding must scale to the iframe — it does not pass width/height. Protocol events include `ows:requestDisplay`, `ows:requestHide`, and `ows:releaseDisplay` (session `release()` / hide). Apps should not invent parallel display protocols.

## Analytics protocol

Branding may push product analytics to the host with `wallet.analytics.emit(event)` → Postmate `ows:analytics` → `proxy.analytics.on(...)`.

Branding may push EIP-1193 provider notifications with `wallet.providerEvents.emit(event, ...params)` → Postmate `ows:eip1193` → `proxy.ethereum.on(event, listener)`. Use this for `chainChanged` and `accountsChanged` so hosts stay in sync when the user switches chain or connects in the Branding UI (not only when the host calls `wallet_switchEthereumChain` / `eth_requestAccounts`).

OWS defines only the required base on `IOWSAnalyticsEvent` / `OWSAnalyticsEvent`: `eventId`, `timestamp`, `hostDomain`, `name` (string). Branding extends `OWSAnalyticsEvent` and adds fields; those extras are forwarded untyped at the OWS layer. Hosts receive the full payload and may narrow on `name`. There is no OWS event catalog enum and no Google Analytics in OWS packages.

Display **queuing** (serializing concurrent modals) is app-owned — see `WalletProvider` modal queue in general-wallet.

## Host handshake vs nested signer

Stock Postmate child handshake windows are short. Host-side `OWSProxy` extends the handshake timeout for slow tunnels, but branding must still **`wallet.start()` before awaiting the nested Signing Layer** so the parent finds a Model. Deferred signer proxies keep handlers registerable immediately.

## Host-only: Local Network Access

When a public branding origin (e.g. ngrok) fetches private/loopback OID4 endpoints, Chrome may require the host iframe `allow` attribute. That is configured on **`OWSProxy.create(..., { allowLocalAccess: true })`**, not on branding wallet APIs.

## Integrity (future)

Signed-manifest / verify-before-execute for `ows-signer` is planned (see `packages/ows-signer/docs/trusted-loader-plan.md`). Not required for a first branding scaffold.

## Reference demo

`examples/general-wallet` + `examples/host` (and credential issuer/verifier hosts) in the open-wallet monorepo demonstrate Host → Branding → Signing with HTTPS passkeys.
