# skills

A collection of Agent Skills published by [1Shot API](https://1shotapi.com/) for coding agents (Cursor, Claude, etc.) to build onchain applications. Each skill lives in its own folder and can be installed independently.

**This repository is the canonical source** for first-party 1Shot skills. Product repos (open-wallet, embedded-wallet, relayer) do not publish or project-install these skills — developers install them globally.

## Installing skills

Install an individual skill with [`skills`](https://www.npmjs.com/package/skills) (global Cursor scope recommended):

```bash
npx skills add 1Shot-API/skills/<skill-name> -g -a cursor -y
```

From a local clone of this repo (picks up unpushed edits):

```bash
npm run skills:install
# or: npx skills add . --skill '*' -g -a cursor -y
```

To update all globally installed skills after new releases:

```bash
npm run skills:update
# or: npx skills update -g -y
```

List skills in this repository without installing:

```bash
npx skills add 1Shot-API/skills -l
# from a clone: npx skills add . -l
```

## Skills in this repo

| Skill | Install |
|-------|---------|
| [1shot-api](./1shot-api/) | `npx skills add 1Shot-API/skills/1shot-api -g -a cursor -y` |
| [1shot-wallet](./1shot-wallet/) | `npx skills add 1Shot-API/skills/1shot-wallet -g -a cursor -y` |
| [public-relayer](./public-relayer/) | `npx skills add 1Shot-API/skills/public-relayer -g -a cursor -y` |
| [ows-branding-layer](./ows-branding-layer/) | `npx skills add 1Shot-API/skills/ows-branding-layer -g -a cursor -y` |
| [webauthn-prf-wallet](./webauthn-prf-wallet/) | `npx skills add 1Shot-API/skills/webauthn-prf-wallet -g -a cursor -y` |

### `1shot-api`

Guides a coding agent in building a TypeScript project that leverages the [1Shot API Node SDK](https://github.com/1Shot-API/1Shot-API-SDK/tree/main/clients/node) for onchain reads, transaction management, delegations, and payments.

### `1shot-wallet`

Guides a coding agent in embedding the **1Shot Wallet** from a Host Layer app using `@1shotapi/ows-provider`. The hosted Branding Layer at `wallet.1shotapi.com` handles passkey onboarding, signing consent, and credentials — your app wires `OWSProxy`, EIP-1193, and optional `configure` theming without building a wallet from scratch.

### `public-relayer`

Integrate a client app with the 1Shot public relayer JSON-RPC API for gas-abstracted EIP-7710 delegated transactions. Use when the host or backend calls `relayer_*` methods directly (not for embed-only wallet sends — use `1shot-wallet` for that).

### `ows-branding-layer`

Scaffold or extend an Open Wallet Standard (OWS) Branding Layer with `@1shotapi/ows-wallet-utils`, `ows-signer-utils`, `ows-types`, and optional `ows-oid4`.

### `webauthn-prf-wallet`

Build a passkey-derived EVM wallet using the WebAuthn PRF extension in an isolated iframe (companion to `public-relayer` for non-custodial, no-API-key apps).

## Maintaining skills

When product APIs change (Host RPC, relayer JSON-RPC, OWS packages), update the matching skill in **this** repository in the same effort. Product-repo `AGENTS.md` files point maintainers here.
