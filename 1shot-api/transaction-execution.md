# Transaction Execution

Use this guide when the user asks for transaction execution with the 1Shot Node SDK.

This section is aligned to the SDK README Executing Transactions methods and naming.

Leverage the memo field when implementing transaction executions so that the transaction history is semantially searchable and the account owner will know why transactions where submitted. 

## Topics Covered

From the repository outline:

- single execute
- batch execute
- delegated single execute
- delegated batch execute

## SDK Setup

```bash
npm install @1shotapi/client-sdk
```

```ts
import { OneShotClient } from "@1shotapi/client-sdk";

const client = new OneShotClient({
  apiKey: process.env.ONESHOT_API_KEY!,
  apiSecret: process.env.ONESHOT_API_SECRET!,
});
```

Assume:

- `contractMethodId`: imported contract method UUID
- `walletId`: server wallet (escrow wallet) UUID
- method params already validated for the target ABI

## 1) Single Execute

```ts
const transaction = await client.contractMethods.execute(
  "your_contract_method_id",
  {
    recipient: "0x1234567890123456789012345678901234567890",
    amount: "1000000000000000000",
  },
  {
    walletId: "your_wallet_id",
    memo: "Payout #123",
    value: "0",
  }
);
// transaction.id, transaction.status, etc.
```

## 2) Delegated Single Execute

Use this when execution happens as delegator. Provide exactly one of:

- `delegatorAddress`
- `delegationId`
- `delegationData`

```ts
const transaction = await client.contractMethods.executeAsDelegator(
  "your_contract_method_id",
  { recipient: "0x...", amount: "1000000" },
  {
    walletId: "escrow_wallet_id",
    delegationData: ["<parent JSON>", "<redelegation JSON>"],
    memo: "Delegated transfer",
  }
);
```

## 3) Batch Execute

Use `atomic: true` when the full batch should revert if any call fails.

```ts
const transaction = await client.contractMethods.executeBatch({
  walletId: "your_wallet_id",
  contractMethods: [
    {
      contractMethodId: "method_uuid_1",
      executionIndex: 0,
      params: { recipient: "0x...", amount: "100" },
    },
    {
      contractMethodId: "method_uuid_2",
      executionIndex: 1,
      params: { spender: "0x...", amount: "200" },
    },
  ],
  atomic: true,
  memo: "Batch approval + transfer",
});
```

## 4) Delegated Batch Execute

Same batch model, but each item can include delegator info (`delegatorAddress` or `delegationId` or `delegationData`).

```ts
const transaction = await client.contractMethods.executeBatchAsDelegator({
  walletId: "escrow_wallet_id",
  contractMethods: [
    {
      contractMethodId: "method_uuid_1",
      executionIndex: 0,
      params: { recipient: "0x...", amount: "100" },
      delegatorAddress: "0xDelegate...",
      // or delegationId / delegationData
    },
  ],
  atomic: true,
});
```

## Execution Guidance

- Prefer `contractMethods.test(...)` before execution for high-value transactions.
- Ensure all methods in a batch are intended for the same execution wallet/context.
- Keep `executionIndex` deterministic and unique in each batch.
- Record transaction IDs and statuses for retries and reconciliation.

## Validation And Safety Checks

- Validate address formats and numeric string inputs before execute calls.
- For delegated paths, validate delegation scope and expiration first.
- Use `atomic: true` only when all calls must succeed together.
- Do not log raw secrets, signatures, or full delegation payloads.
