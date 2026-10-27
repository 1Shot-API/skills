---
name: agent-wallet
description: >-
  Create and use a local agent EOA with Foundry encrypted keystores — sign
  personal_sign / typed data / tx hashes, send transactions, and build or sign
  EIP-7710 delegations (including redelegation and EIP-7702 auth) without
  printing private keys, mnemonics, or passwords into chat context. Use when an
  agent needs its own wallet, agent private key storage, non-interactive casting,
  or MetaMask Smart Accounts Kit delegations from a headless environment. Also
  use when an agent needs an address for a CoinOperated (or other product)
  funding/registration deeplink after create — product URL shape lives in the
  consuming skill (e.g. coinoperated).
license: MIT
metadata:
  author: 1Shot-API
  version: "0.1.0"
  repository: https://github.com/1Shot-API/skills
---

# Agent wallet (Foundry keystore CLI)

Product-agnostic skill for coding agents that need a **local EOA** and optional **EIP-7710** delegations. Keys live in Foundry encrypted JSON keystores under `~/.agent-wallet/` (or `AGENT_WALLET_HOME`). The CLI never prints private keys, mnemonics, or passwords — only JSON results on stdout.

> These scripts reduce **accidental** key leakage into model context. Anyone or any process with filesystem access to the keystore + password file can still use the key. **The sandbox / host filesystem is the trust boundary** — see [references/security.md](./references/security.md).

## Install this skill

```bash
npx skills add 1Shot-API/skills/agent-wallet -g -a cursor -y
```

Then once per machine (Node deps for EIP-7710):

```bash
cd ~/.cursor/skills/agent-wallet/scripts   # or the installed skill path
npm install
```

Install [Foundry](https://getfoundry.sh) so `cast` is on `PATH` (`foundryup`).

## First run

```bash
node scripts/aw.mjs doctor
```

- If `cast` is null → install Foundry, then re-run `doctor`.
- If `depsOk` is false → `cd scripts && npm install` (exact path is in `depsInstallHint`).

Create a wallet (idempotent; show the user **address only**):

```bash
node scripts/aw.mjs create
# → {"ok":true,"address":"0x…","name":"agent",…}
```

Prefer `aw` over raw `cast wallet new` / `cast wallet private-key` (those leak keys to stdout).

## Command cheat sheet

Run from the skill root, or with an absolute path to `scripts/aw.mjs`.

| Command | Purpose | Success stdout |
|---------|---------|----------------|
| `doctor` | cast / node / wallet / deps | status object |
| `create [--name] [--force]` | encrypted keystore + password file | `{ address, name, keystorePath, storageTier }` |
| `address [--name]` | resolve address | `{ address }` |
| `sign-personal --message …` | EIP-191 | `{ signature }` |
| `sign-hash --hash 0x…` | raw 32-byte hash | `{ signature }` |
| `sign-typed --file typed.json` | EIP-712 | `{ signature }` |
| `send --rpc … --to … [--value] [--data] [--chain-id]` | broadcast | `{ txHash }` |
| `mktx …` | signed raw tx, no broadcast | `{ rawTransaction }` |
| `auth7702 --rpc … --chain-id N` | EIP-7702 auth for Stateless7702 | `{ authorization, … }` |
| `delegation-create --file input.json` | unsigned delegation | `{ delegation, chainId }` |
| `delegation-sign --file input.json` | sign delegation in-process | `{ signedDelegation, chainId }` |
| `redelegate --parent parent.json --file input.json` | child delegation + sign | `{ signedDelegation, chainId }` |

Exit codes: `0` ok, `2` missing cast/deps, `3` no wallet, `4` bad args, `5` runtime/cast failure.

Every command supports `--help`. Unknown flags fail loudly. Optional `--home` / `AGENT_WALLET_HOME` and `--name` (default `agent`).

### Examples

```bash
node scripts/aw.mjs sign-personal --message "hello"
node scripts/aw.mjs send --rpc https://… --to 0x… --value 0.01ether --chain-id 8453
node scripts/aw.mjs delegation-sign --file ./delegation-input.json
```

Delegation input schema, scopes, and redelegation: [references/eip7710.md](./references/eip7710.md).

## After create — product deeplinks

This skill only supplies the **address**. For CoinOperated owner linking (additional signer + spending delegation), follow skill **coinoperated**: build `https://coinoperated.finance/agent/link?accountAddress=…&name=…`, ask the user to open it, then SIWE with `sign-personal` for a Bearer token.

## Agent rules

1. Run `doctor` before first use; fix cast / `npm install` from its hints.
2. After `create`, tell the user the **address** only — never open or dump the password file or keystore JSON into chat.
3. Do not run `cast wallet private-key`, `cast wallet new` without `--unsafe-password`, or interactive password prompts.
4. For EIP-7710 submit/redeem, use a relayer or bundler separately (see **See also**).
5. Treat stdout as the only success channel; parse JSON (`ok: true`).

## Storage layout

See [references/storage.md](./references/storage.md). Tier B only in v1: encrypted keystore + `0600` password file. OS keyring deferred.

## See also

- [references/casting.md](./references/casting.md) — cast flag mapping
- [references/security.md](./references/security.md) — threat model
- [references/eip7710.md](./references/eip7710.md) — delegation JSON + 7702
- Skill **public-relayer** — submit signed EIP-7710 contexts (`relayer_send7710Transaction`)
- Skill **coinoperated** — CoinOperated agent link deeplink + SIWE Bearer + OpenAPI
- Skill **smart-accounts-kit** (MetaMask) — broader kit workflows
