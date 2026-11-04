# skills

A collection of Agent Skills published by [1Shot API](https://1shotapi.com/) for coding agents (Claude Code, Cursor, etc.) to build onchain applications. Each skill lives in its own folder and can be installed independently.

**This repository is the canonical source** for first-party 1Shot skills. Product repos (oneshot, relayer, clients, embedded-wallet, etc.) do not publish or project-install these skills — developers install them globally.

## Installing skills

Install an individual skill with [`skills`](https://www.npmjs.com/package/skills) at user level. `-a claude-code` installs into `~/.claude/skills`, which both Claude Code and Cursor read, so one install serves both editors:

```bash
npx skills add 1Shot-API/skills/<skill-name> -g -a claude-code -y
```

From a local clone of this repo (picks up unpushed edits):

```bash
npm run skills:install
# or: npx skills add . --skill '*' -g -a claude-code -y
```

If you previously installed these into `~/.cursor/skills` (`-a cursor`), remove those copies so Cursor does not load each skill twice.

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
| [1shot-api](./1shot-api/) | `npx skills add 1Shot-API/skills/1shot-api -g -a claude-code -y` |
| [1shot-wallet](./1shot-wallet/) | `npx skills add 1Shot-API/skills/1shot-wallet -g -a claude-code -y` |
| [public-relayer](./public-relayer/) | `npx skills add 1Shot-API/skills/public-relayer -g -a claude-code -y` |
| [ows-branding-layer](./ows-branding-layer/) | `npx skills add 1Shot-API/skills/ows-branding-layer -g -a claude-code -y` |
| [webauthn-prf-wallet](./webauthn-prf-wallet/) | `npx skills add 1Shot-API/skills/webauthn-prf-wallet -g -a claude-code -y` |
| [agent-wallet](./agent-wallet/) | `npx skills add 1Shot-API/skills/agent-wallet -g -a claude-code -y` |
| [coinoperated](./coinoperated/) | `npx skills add 1Shot-API/skills/coinoperated -g -a claude-code -y` |
| [unit-tests](./unit-tests/) | `npx skills add 1Shot-API/skills/unit-tests -g -a claude-code -y` |

### `1shot-api`

Guides a coding agent in building a TypeScript project that leverages the [1Shot API Node SDK](https://github.com/1Shot-API/1Shot-API-SDK/tree/main/clients/node) for onchain reads, transaction management, delegations, and payments.

### `1shot-wallet`

Guides a coding agent in embedding the **1Shot Wallet** from a Host Layer app using `@1shotapi/ows-provider`. The hosted Branding Layer at `wallet.1shotapi.com` handles passkey onboarding, signing consent, and credentials — your app wires `OWSProxy`, EIP-1193, and optional `configure` theming without building a wallet from scratch.

### `public-relayer`

Integrate a client app with the 1Shot public relayer JSON-RPC API for gas-abstracted EIP-7710 delegated transactions. Use when the host or backend calls `relayer_*` methods directly (not for embed-only wallet sends — use `1shot-wallet` for that). Pair with **agent-wallet** for Path D (local EOA `aw redelegate` / `auth7702` + estimate/send).

### `ows-branding-layer`

Scaffold or extend an Open Wallet Standard (OWS) Branding Layer with `@1shotapi/ows-wallet-utils`, `ows-signer-utils`, `ows-types`, and optional `ows-oid4`.

### `webauthn-prf-wallet`

Build a passkey-derived EVM wallet using the WebAuthn PRF extension in an isolated iframe (companion to `public-relayer` for non-custodial, no-API-key apps).

### `agent-wallet`

Local agent EOA via Foundry encrypted keystores and a non-interactive `scripts/aw.mjs` CLI — create/sign/send without printing keys, plus EIP-7710 delegation helpers (`@metamask/smart-accounts-kit`). Pair with **public-relayer** to submit signed contexts. For CoinOperated linking, see **coinoperated**.

### `coinoperated`

High-level coordinator for [CoinOperated](https://coinoperated.finance): create an agent wallet via **agent-wallet**, emit an `/agent/link` deeplink for the owner to confirm an additional signer and spending delegation, SIWE for a Bearer JWT / OpenAPI, then spend with **public-relayer** Path D2 (`aw redelegate` + `relayer_send7710Transaction`).

### `unit-tests`

Authors Jest unit tests for TypeScript services in the oneshot monorepo using testdouble, neverthrow `ResultAsync`, and a structured mocks class (Arrange/Act/Assert, negative-only `td.verify`).

## Discovery (agentskills.io)

This repo is public and tagged for agent-skill indexers (`agent-skills`, `skill-md`, `claude-skills`, …). Installers that speak GitHub sources can list everything with:

```bash
npx skills add 1Shot-API/skills -l
```

**CoinOperated** also publishes a [well-known discovery index](https://agentskills.io/home) so agents can find the product skill from the site origin:

```bash
npx skills add https://coinoperated.finance --skill coinoperated -g -a claude-code -y
# index: https://coinoperated.finance/.well-known/agent-skills/index.json
```

After editing `coinoperated/SKILL.md`, sync the hosted discovery copy from the CoinOperated repo:

```bash
# in CoinOperated
yarn skills:sync-discovery   # reads ../skills/coinoperated/SKILL.md by default
```


## Maintaining skills

When product APIs change (Host RPC, relayer JSON-RPC, OWS packages, M2M/SDK surfaces, oneshot test conventions), update the matching skill in **this** repository in the same effort. Product-repo `AGENTS.md` files point maintainers here.
