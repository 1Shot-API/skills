---
name: erc20-agent-budget
description: >-
  Spend a periodic ERC-20 budget the agent already holds. Use when you are the
  delegate of an ERC20PeriodTransferEnforcer grant (periodic USDC allowance,
  agent budget, getAvailableAmount, redelegation to the 1Shot relayer), including
  a later period after this key is already a delegator. Redeem that grant around
  action calldata the caller supplies. The user account pays the relayer fee
  directly; the agent receives only the action amount, then calls the contracts
  itself. This skill does not build a swap or bridge route. Trigger on periodic
  transfer delegation, period allowance, ERC20PeriodTransferEnforcer, spending a
  user grant, or redeeming a budget through relayer_send7710Transaction. Do NOT
  use to embed wallet.1shotapi.com (1shot-wallet) or to build a general relayer
  client (public-relayer).
---

# ERC-20 agent budget

You are the delegate. A user already signed an `ERC20PeriodTransferEnforcer` grant to your EOA. That grant is a periodic transfer allowance for one ERC-20 (usually USDC). This skill spends it through the 1Shot relayer, including a later period when this key is already a delegator and may still hold tokens. You supply the action calldata. This skill does not build a swap or a bridge route. The user account pays the relayer fee, sends you the action amount, and your account performs that action in the same atomic transaction. An empty executions file means the transfer to you is the whole action.

There is no contract named `ERC20TransferEnforcer`. The one-shot sibling, `ERC20TransferAmountEnforcer`, has no period and no `getAvailableAmount`. If the grant's caveat is that enforcer, stop and use the **public-relayer** skill instead.

Run [scripts/spend-budget.ts](scripts/spend-budget.ts) rather than hand-rolling the bundle. The sections below are what the script is doing, so you can fix the action when it reverts.

## When to use this skill

- You hold the delegate private key and a signed user grant whose `delegate` is that key. A repeat spend in a new period is the same task.
- The grant's caveat is `ERC20PeriodTransferEnforcer`.
- You already have the action calldata, or you only want the allowance delivered to this key.
- The key has no native gas. It may already be an `EIP7702StatelessDeleGator`. The relayer submits the transaction. The user's tokens pay the fee.

## When not to use this skill

- Creating the user's grant. The embedded wallet already signed it. You cannot re-sign the user's delegation.
- Building swap or bridge calldata. Bring that calldata in the executions file.
- A grant that is not a periodic ERC-20 transfer. Streaming, native-token, and one-shot transfer-amount enforcers are a different shape.

Endpoints, error codes, and webhooks stay in the **public-relayer** skill. Terms and revert strings are in [references/enforcer.md](references/enforcer.md). A numeric field sketch is in [references/bundle.md](references/bundle.md).

## Preconditions

Stop before estimating if any of these fail.

- The grant file is one signed delegation. `delegate` is your address. `authority` is the DelegationManager root authority, `0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff`. A longer chain will not redeem as `[redelegation, grant]`.
- `eth_getCode` on the **user** (`delegator`) is `0xef0100` plus the MetaMask `EIP7702StatelessDeleGatorImpl` for this chain. The relayer accepts one `authorizationList` entry. That entry is yours, so the user has to already be upgraded.
- Your key has no code yet, or it is already that same delegator. Other code means stop.
- The granted token is one of the chain's relayer payment tokens from `relayer_getCapabilities`. The fee is a `transfer` of that same token to `feeCollector`.
- `getSmartAccountsEnvironment(chainId)` includes this chain. The script throws before the relayer when the installed kit has no deployment for it. Arc testnet is in the current kit table. Arc mainnet is not.
- `getAvailableAmount` on the **user-grant hash** is greater than the fee. The redelegation hash is a different counter. Pass the DelegationManager from `getSmartAccountsEnvironment(chainId)` and the caveat's original terms, unmodified.
- Action executions use `value` `0`. You have no native gas. A bridge is a source-chain call in your context, not `relayer_send7710TransactionMultichain`.

## Why the action runs as you

The period enforcer accepts a single default execution whose calldata is `IERC20.transfer` of the granted token (68 bytes). It does not check the recipient. Any other selector reverts with `ERC20PeriodTransferEnforcer:invalid-method`. USDC's `transfer` also has no hook, so a transfer to a router does not start a swap.

The 1Shot relayer turns each `executions[]` entry into its own single-default redemption that shares that entry's permission context. Two transfers in one `transactions[]` entry therefore both pass the enforcer and both debit the same period. One batch-mode redemption would revert with `CaveatEnforcer:invalid-call-type`. The whole `redeemDelegations` batch is atomic: if your call reverts, the transfers and the period counter revert with it.

Unused allowance does not roll over. Whatever you do not transfer this period is forfeited when the period ends.

## Bundle

One `relayer_send7710Transaction`. With action calldata, two `transactions[]` entries, in this order. With an empty executions file, only Context U. The relayer walks `transactions[]`, then `executions[]`.

### Context U — user grant, redelegated

Permission context is **leaf first**: `[yourRedelegation, userGrant]`.

- Redelegation: `delegate` = `targetAddress` from `relayer_getCapabilities`, `delegator` = you, `authority` = `hashDelegation(userGrant)`, **caveats empty**. Run the script; it leaves those caveats empty. The parent period enforcer is the only budget counter. Amounts live in the executions, so changing the fee does not require a new signature. A second period enforcer on the redelegation would open a second counter.
- The relayer prepends a hop from `targetAddress` to a pool wallet onto `permissionContext[0]`. You do not sign that hop. `permissionContext[0]` must already be the redelegation whose delegate is `targetAddress`.

Executions, both from the user, in this order:

1. `token.transfer(you, spend)`
2. `token.transfer(feeCollector, fee)`

`spend + fee` is at most `availableAmount`. The fee moves once, from the user to `feeCollector`. Your balance after the batch is `spend`, not `spend + fee`.

### Context A — your account

A separate `transactions[]` entry. One root delegation: `authority` is the root authority, `delegator` is you, `delegate` is `targetAddress`. The user grant is absent. If it were included, the period enforcer would try to decode your approve or swap as `transfer` and revert.

Caveat: `LimitedCalls` with `limit` equal to **the number of action executions**, not 1. The relayer increments that counter once per execution. The limit stops a later replay of this signature. Only a redeemer that can act as `targetAddress` can submit those calls. The caveat does not pin the calldata. Omit Context A when the executions file is empty.

Executions are the action, in order, each with `value` `0`: approve, then the router, pool, or bridge call. Each becomes its own single-call redemption, so a multicall belongs inside one contract call, not as a batch-mode mode on the delegation.

## Fee loop

1. Read `minFee` from `relayer_getFeeData` for the granted token. The mock fee is that minimum.
2. If `spend + minFee` is already over `availableAmount`, lower `spend` and rebuild the action before estimating.
3. Estimate with `relayer_estimate7710Transaction`. Include your EIP-7702 authorization when your account has no delegator code yet. Use the current nonce. Do not send any other transaction from this key until the send lands.
4. Set `fee` to `requiredPaymentAmount`. If `spend + fee` exceeds `availableAmount`, the script exits without sending and prints `maxSpend`. Rebuild the action calldata for that smaller amount. The script does not rewrite your calldata.
5. If the quote fits and only the fee integer changed, patch that integer and send immediately with the estimate's `context` (about 45 seconds). The two user calls and the action calls stay the same shape, so you do not re-estimate and you do not re-sign.
6. Re-estimate when you add, remove, or rewrite a call. That includes rebuilding the action after a shrink.

## Run the script

Install `viem` and `@metamask/smart-accounts-kit` (1.3 or newer) in the project you are working in. The skills repo has no package of its own. Run with `npx tsx`.

The private key comes from the environment. Do not pass it as an argument and do not print it.

```bash
export AGENT_PRIVATE_KEY=0x...
export RPC_URL=https://...

npx tsx path/to/erc20-agent-budget/scripts/spend-budget.ts \
  --grant ./user-grant.json \
  --executions ./action.json \
  --chain-id 84532 \
  --spend 5 \
  --rpc-url "$RPC_URL"
```

`--spend` is a decimal in token units (`5` means 5 USDC), not atoms. `action.json` is an array of `{ "target", "data", "value" }`, or `[]` to receive the allowance and stop. `value` must be `"0"`. An empty file submits only Context U and does not sign a `LimitedCalls` delegation. Optional `--memo` and `--destination-url` are forwarded on send. `RELAYER_URL` overrides the default (dev relayer for chain ids `11155111` and `84532`, otherwise `https://relayer.1shotapi.com/relayers`).

`user-grant.json` is the signed delegation:

```json
{
  "delegate": "0xYourAgent",
  "delegator": "0xTheUser",
  "authority": "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  "caveats": [{ "enforcer": "0xPeriodEnforcer", "terms": "0x...", "args": "0x" }],
  "salt": "0x...",
  "signature": "0x..."
}
```

Stdout is one JSON object.

Submitted:

```json
{ "status": "submitted", "taskId": "0x...", "chainId": "84532", "spend": "5000000", "fee": "25000" }
```

`spend` and `fee` are token atoms. Poll `relayer_getStatus` or consume the webhook as in **public-relayer**. Exit code 0.

Budget too small (exit code 2):

```json
{
  "status": "spend-exceeds-budget",
  "availableAmount": "5010000",
  "fee": "25000",
  "feeBasis": "requiredPaymentAmount",
  "maxSpend": "4985000",
  "requestedSpend": "5000000"
}
```

`feeBasis` is `minFee` when the chain minimum already does not fit, and `requiredPaymentAmount` after a successful estimate. Rebuild `action.json` so it succeeds with `maxSpend` atoms, pass the matching decimal to `--spend`, and run again.

Other failures exit 1 with the message on stderr. Estimate failures come back as `result.success: false` and an `error` string (missing payment, simulation revert, invalid delegation). Those are not always JSON-RPC errors.
