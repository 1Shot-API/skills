---
name: agent-wallet
description: >-
  Create and use a local agent EOA with encrypted JSON keystores (ethers/Node by
  default; Foundry cast optional) — sign personal_sign / typed data / tx hashes,
  send transactions, and build or sign EIP-7710 delegations (including
  redelegation and EIP-7702 auth) without printing private keys, mnemonics, or
  passwords into chat context. Use when an agent needs its own wallet, agent
  private key storage, non-interactive casting, or MetaMask Smart Accounts Kit
  delegations from a headless environment. Also use when an agent needs an
  address for a CoinOperated (or other product) funding/registration deeplink
  after create — product URL shape lives in the consuming skill (e.g.
  coinoperated). Also use when signing EIP-7702 auth or EIP-7710
  root/redelegations that will be submitted via the public-relayer skill
  (relayer_estimate7710Transaction / relayer_send7710Transaction, including
  batched executions and multichain).
license: MIT
metadata:
  author: 1Shot-API
  version: "0.4.0"
  repository: https://github.com/1Shot-API/skills
---

# Agent wallet (keystore CLI)

Product-agnostic skill for coding agents that need a **local EOA** and optional **EIP-7710** delegations. Keys live in encrypted JSON keystores under `~/.agent-wallet/` (or `AGENT_WALLET_HOME`). The CLI never prints private keys, mnemonics, or passwords — only JSON results on stdout.

> These scripts reduce **accidental** key leakage into model context. Anyone or any process with filesystem access to the keystore + password file can still use the key. **The sandbox / host filesystem is the trust boundary** — see [references/security.md](./references/security.md).

## Install this skill

**Cursor:**

```bash
npx skills add 1Shot-API/skills/agent-wallet -g -a cursor -y
cd ~/.cursor/skills/agent-wallet/scripts && npm install
```

**Any agent / cloud sandbox:**

```bash
git clone --depth 1 https://github.com/1Shot-API/skills.git
cd skills/agent-wallet/scripts && npm install
```

`npm install` pulls `@metamask/smart-accounts-kit` **^2.0.0**, `viem`, and `ethers` (~seconds). That is enough for **create**, **address**, **sign-personal**, **sign-hash**, **auth7702**, and **delegation-*/redelegate**.

**Foundry `cast` is optional** for the CoinOperated / public-relayer path. It is still required for `send`, `mktx`, and `sign-typed`. Avoid `foundryup` in tiny cloud snapshots when you only need EIP-7710 signing (~294 MB of forge/cast/anvil binaries).

## First run

```bash
node scripts/aw.mjs doctor
```

- If `depsOk` is false → `cd scripts && npm install` (path in `depsInstallHint`).
- If `cast` is null → fine for create/SIWE/auth7702/redelegate; `foundryHint` lists commands that still need cast.

Create a wallet (idempotent; show the user **address only**):

```bash
node scripts/aw.mjs create
# → {"ok":true,"address":"0x…","name":"agent",…}
```

Prefer `aw` over raw `cast wallet new` / `cast wallet private-key` (those leak keys to stdout).

## Command cheat sheet

Run from the skill root, or with an absolute path to `scripts/aw.mjs`.

| Command | Purpose | Success stdout | Needs cast? |
|---------|---------|----------------|-------------|
| `doctor` | cast / node / wallet / deps | status object | no |
| `create [--name] [--force]` | encrypted keystore + password file | `{ address, name, keystorePath, storageTier }` | no (ethers) |
| `address [--name]` | resolve address | `{ address }` | no |
| `sign-personal --message …` | EIP-191 | `{ signature }` | no (viem fallback) |
| `sign-hash --hash 0x…` | raw 32-byte hash | `{ signature }` | no (viem fallback) |
| `sign-typed --file typed.json` | EIP-712 | `{ signature }` | **yes** |
| `send --rpc … --to …` | broadcast | `{ txHash }` | **yes** |
| `mktx …` | signed raw tx, no broadcast | `{ rawTransaction }` | **yes** |
| `auth7702 --rpc … --chain-id N` | EIP-7702 Stateless7702 auth | `{ authorization, … }` | no |
| `delegation-create --file input.json` | unsigned delegation | `{ delegation, chainId }` | no |
| `delegation-sign --file input.json` | sign delegation in-process | `{ signedDelegation, chainId }` | no |
| `redelegate --parent parent.json --file input.json` | child delegation + sign | `{ signedDelegation, chainId }` | no |

Exit codes: `0` ok, `2` missing cast/deps, `3` no wallet, `4` bad args, `5` runtime failure.

Every command supports `--help`. Unknown flags fail loudly. Optional `--home` / `AGENT_WALLET_HOME` and `--name` (default `agent`).

### Examples

```bash
node scripts/aw.mjs sign-personal --message "hello"
# Arc first redeem — Stateless7702 auth for the relayer (pending nonce)
node scripts/aw.mjs auth7702 --rpc https://rpc.mainnet.arc.io --chain-id 5042
node scripts/aw.mjs redelegate --parent ./parent.json --file ./child-input.json
```

Delegation input schema, scopes, amounts, and 7702: [references/eip7710.md](./references/eip7710.md).

**Arc mainnet:** kit env for `5042` is registered via Arc Testnet template (`overrideDeployedEnvironment`). Kit must be **^2.0.0**. See [references/eip7710.md](./references/eip7710.md#arc-mainnet-5042-environment).

## After create — product deeplinks

This skill only supplies the **address**. For CoinOperated owner linking (additional signer + spending delegation), follow skill **coinoperated**: build `https://coinoperated.finance/agent/link?accountAddress=…&name=…`, ask the user to open it, then SIWE with `sign-personal` for a Bearer token.

## Redeeming via the public relayer

`aw` **signs** (7702 auth, root delegation, redelegation). It does **not** call `relayer_*`. Follow skill **public-relayer** (Path **D**, [Example 0d](https://github.com/1Shot-API/skills/blob/main/public-relayer/references/examples.md)) for capabilities → estimate → send.

| Goal | `aw` commands | Then (public-relayer) |
|------|---------------|------------------------|
| First-time smart account on a chain | `auth7702 --rpc … --chain-id N` | Pass **`authorizationList: [authorization]`** on **estimate and send** |
| Agent pays fee + work itself | `delegation-sign --file …` with `to: targetAddress` | `permissionContext: [signedDelegation]` |
| Spend a **user grant** to this agent (CoinOperated) | `redelegate --parent parent.json --file child.json` (`to: targetAddress`, narrower scope) | `permissionContext: **[child, parent]**` (leaf → root) |

**First tx on a chain:** always run `auth7702` and include `authorizationList` until the EOA has Stateless7702 code. `aw` signs the **current pending** nonce (relayer is the outer sender — never viem `executor: "self"`).

**Batching (same chain):** one `permissionContext` + multiple `executions[]` (e.g. fee `transfer` + pull-to-agent). Do not run separate `aw send` calls for gas-abstracted redeem.

**Multichain:** run `auth7702` / `redelegate` (or `delegation-sign`) **per chain** as needed, then `relayer_estimate7710TransactionMultichain` / `relayer_send7710TransactionMultichain` with per-chain `context` from `contextByChainId`.

```bash
# Example — Arc D2 (CoinOperated)
node scripts/aw.mjs auth7702 --rpc https://rpc.mainnet.arc.io --chain-id 5042
node scripts/aw.mjs redelegate --parent ./parent.json --file ./child-input.json
# → authorizationList + permissionContext [child, parent] on estimate/send (Example 0d)
```

## Agent rules

1. Run `doctor` before first use; fix `npm install` from its hints. Install Foundry only if you need `send` / `mktx` / `sign-typed`.
2. After `create`, tell the user the **address** only — never open or dump the password file or keystore JSON into chat.
3. Do not run `cast wallet private-key`, `cast wallet new` without `--unsafe-password`, or interactive password prompts.
4. For EIP-7710 **submit/redeem**, use skill **public-relayer** (`relayer_*`) — not `aw send`.
5. Treat stdout as the only success channel; parse JSON (`ok: true`). BigInts in auth are stringified safely.

## Storage layout

See [references/storage.md](./references/storage.md). Tier B only in v1: encrypted keystore + `0600` password file. OS keyring deferred.

## See also

- [references/casting.md](./references/casting.md) — cast flag mapping (optional path)
- [references/security.md](./references/security.md) — threat model
- [references/eip7710.md](./references/eip7710.md) — delegation JSON + 7702
- Skill **public-relayer** — submit signed EIP-7710 contexts (`relayer_send7710Transaction`)
- Skill **coinoperated** — CoinOperated agent link deeplink + SIWE Bearer + OpenAPI
- Skill **smart-accounts-kit** (MetaMask) — broader kit workflows
