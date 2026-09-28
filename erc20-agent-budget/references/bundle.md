# Worked bundle

Chain `84532` (Base Sepolia). Relayer URL `https://relayer.1shotapi.dev/relayers`. Token is the grant's ERC-20, 6 decimals. Atoms below are illustrative.

## Readings

- `getAvailableAmount` on the **user-grant hash**: `availableAmount = 10000000` (10 tokens).
- `relayer_getCapabilities` for `"84532"`: `targetAddress = 0x2222…`, `feeCollector = 0x3333…`, and the granted token is in `tokens`.
- `relayer_getFeeData` for that token: `minFee = 10000` (0.01 token).
- Requested `--spend 5` → `5000000` atoms.
- `5000000 + 10000 <= 10000000`, so the estimate can use the requested spend and a mock fee of `10000`.

The user (`delegator`) already has `0xef0100` plus `EIP7702StatelessDeleGatorImpl`. The agent EOA has no code, so the estimate and the send both carry one authorization: the agent, nonce 0, `contractAddress` = that implementation.

## Context U

Leaf first. Caveats on the redelegation are empty. `authority` of the redelegation is `hashDelegation(userGrant)`. The user grant's `authority` is the root:

`0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff`

Executions from the user, mock fee:

1. `token.transfer(agent, 5000000)`
2. `token.transfer(feeCollector, 10000)`

Field sketch only. Do not submit this JSON. Addresses below are labels, not hex. The only submit path is `scripts/spend-budget.ts`.

```json
{
  "chainId": "84532",
  "authorizationList": [
    {
      "address": "0xEIP7702StatelessDeleGatorImpl",
      "chainId": 84532,
      "nonce": 0,
      "r": "0x…",
      "s": "0x…",
      "yParity": 0
    }
  ],
  "transactions": [
    {
      "permissionContext": [
        { "delegate": "0xTarget", "delegator": "0xAgent", "authority": "0xUserGrantHash", "caveats": [], "salt": "0x…", "signature": "0x…" },
        { "delegate": "0xAgent", "delegator": "0xUser", "authority": "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", "caveats": [{ "enforcer": "0xPeriodEnforcer", "terms": "0x…116bytes", "args": "0x" }], "salt": "0x…", "signature": "0x…" }
      ],
      "executions": [
        { "target": "0xToken", "value": "0", "data": "0xa9059cbb…agent…5000000" },
        { "target": "0xToken", "value": "0", "data": "0xa9059cbb…feeCollector…10000" }
      ]
    },
    {
      "permissionContext": [
        { "delegate": "0xTarget", "delegator": "0xAgent", "authority": "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", "caveats": [{ "enforcer": "0xLimitedCalls", "terms": "0x…limit=2", "args": "0x00" }], "salt": "0x…", "signature": "0x…" }
      ],
      "executions": [
        { "target": "0xToken", "value": "0", "data": "0x095ea7b3…router…5000000" },
        { "target": "0xRouter", "value": "0", "data": "0x…swap" }
      ]
    }
  ]
}
```

Context A has two executions, so `LimitedCalls` limit is 2. The user grant is not in that permission context.

The relayer prepends pool-wallet hops onto each `permissionContext[0]`. Those links are not in the JSON above.

## Quote, then send

`relayer_estimate7710Transaction` with the body above (no `context`) returns `success: true`, `requiredPaymentAmount: "25000"`, and a signed `context`.

`5000000 + 25000 = 5025000`, which is still within `10000000`. The call shape is unchanged: two user transfers, then approve, then swap. Patch only the fee integer to `25000`. Do not re-sign. Send the same body plus `context` from the estimate immediately.

The agent is funded with `5000000`. The fee of `25000` goes to `feeCollector` from the user. Both debits hit the user-grant period counter. If the swap reverts, both transfers and the counter revert.

## When the quote does not fit

Available `5010000`, requested spend `5000000`, `requiredPaymentAmount` `25000`.

`5000000 + 25000 > 5010000`. The script prints `maxSpend` `4985000` and does not send (`feeBasis` `requiredPaymentAmount`). Rebuild the approve and the swap for `4985000` atoms, pass the matching decimal as `--spend`, and estimate again. That is a new call shape, so the previous `context` is not reused.

If `spend + minFee` already exceeds the available amount, the script exits the same way before estimating, with `feeBasis` `minFee`. The simulated fee can still come out higher on the next run.
