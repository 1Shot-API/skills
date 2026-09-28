# ERC20PeriodTransferEnforcer

The grant caveat is this contract. It is not `ERC20TransferAmountEnforcer` (one cumulative cap, no period, no `getAvailableAmount`) and there is no `ERC20TransferEnforcer.sol`.

Source: `delegation-framework/src/enforcers/ERC20PeriodTransferEnforcer.sol`.

## Terms (116 bytes)

Packed, in order:

| Offset | Size | Field |
| --- | --- | --- |
| 0 | 20 | ERC-20 token address |
| 20 | 32 | `periodAmount` (atoms) |
| 52 | 32 | `periodDuration` (seconds) |
| 84 | 32 | `startDate` (unix timestamp of the first period) |

The recipient is not in the terms. Any `transfer` of this token counts, up to the remaining amount. `getTermsInfo` reverts with `invalid-terms-length` when the blob is not 116 bytes.

## getAvailableAmount

```solidity
function getAvailableAmount(
  bytes32 delegationHash,
  address delegationManager,
  bytes calldata terms
) external view returns (
  uint256 availableAmount,
  bool isNewPeriod,
  uint256 currentPeriod
);
```

Call it on the enforcer address stored in the grant, not on a hardcoded copy.

- `delegationHash` is `hashDelegation` of the **user grant**. The redelegation has a different hash and a different counter. The on-chain hash covers delegate, delegator, authority, caveats, and salt. It does not include the signature.
- `delegationManager` is the DelegationManager that will call `beforeHook` (`msg.sender` inside the enforcer). Use `getSmartAccountsEnvironment(chainId).DelegationManager`.
- `terms` are the caveat's original bytes.

Before the first redemption the mapping is empty. The view simulates a fresh allowance from `terms`. After the first redemption it uses stored state and ignores a mismatched terms blob for the amounts, so still pass the original terms.

`currentPeriod` is `(block.timestamp - startDate) / periodDuration + 1`. The first period is index 1. Before `startDate`, `availableAmount` is 0 and `currentPeriod` is 0.

On a new period, `isNewPeriod` is true and the amount already transferred resets to 0. Tokens not transferred in a period are forfeited. They do not roll into the next period.

`availableAmount` is the ceiling for this redemption: `spend + fee`.

## What beforeHook allows

One single default execution. Calldata is exactly 68 bytes: `transfer(address,uint256)`. The token in the execution target must equal the token in the terms.

The 1Shot relayer emits one single-default redemption per `executions[]` entry, reusing the same permission context. Two transfers in one `transactions[]` entry are two debits of this counter in one transaction. A client that encodes both transfers as one batch-mode execution reverts in the enforcer before the token moves.

The counter key is `periodicAllowances[delegationManager][delegationHash]`. Both user transfers share the user-grant hash, so they share one remaining amount. A copy of this enforcer on the redelegation would key a second counter by the redelegation hash. Leave the redelegation's caveats empty.

## Revert strings

| Revert | Cause |
| --- | --- |
| `CaveatEnforcer:invalid-call-type` | Mode is not a single call. Batch mode hits this. |
| `CaveatEnforcer:invalid-execution-type` | Mode is not the default execution type (`try` does not count). |
| `ERC20PeriodTransferEnforcer:invalid-terms-length` | Terms are not 116 bytes. |
| `ERC20PeriodTransferEnforcer:invalid-execution-length` | Calldata is not 68 bytes. |
| `ERC20PeriodTransferEnforcer:invalid-contract` | Execution target is not the token in the terms. |
| `ERC20PeriodTransferEnforcer:invalid-method` | Selector is not `IERC20.transfer`. `approve`, `transferFrom`, and router calls hit this. |
| `ERC20PeriodTransferEnforcer:invalid-zero-start-date` | First use with a zero `startDate`. |
| `ERC20PeriodTransferEnforcer:invalid-zero-period-amount` | First use with a zero `periodAmount`. |
| `ERC20PeriodTransferEnforcer:invalid-zero-period-duration` | First use with a zero `periodDuration`. |
| `ERC20PeriodTransferEnforcer:transfer-not-started` | `block.timestamp` is before `startDate`. `getAvailableAmount` returns 0 in this window. |
| `ERC20PeriodTransferEnforcer:transfer-amount-exceeded` | This transfer is larger than the amount still available in the period. |

`LimitedCallsEnforcer:limit-exceeded` is the agent delegation, not this enforcer. It fires when Context A is redeemed more times than its `limit`. Set `limit` to the number of action executions. The relayer counts one call per execution.
