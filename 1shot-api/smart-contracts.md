# Smart Contracts

Use this guide when the user asks for Smart Contract implementation with the 1Shot Node SDK.

This section is aligned to the SDK README Smart Contracts methods and naming.

## Topics Covered

From the repository outline:

- search smart contracts
- assure methods associated with a smart contract
- imported function management
- read function execution
- write simulation
- imported event management
- event querying with indexed arguments

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

Assume you have:

- `businessId`: your 1Shot business UUID
- `walletId`: server wallet UUID to associate with imported methods when needed
- `chainId`: target chain (for example, `8453` for Base mainnet)

## 1) Search Smart Contracts

Search contracts using natural language or known identifiers.

```ts
const prompts = await client.contractMethods.search("USDC on Base", {
  chainId: 8453,
});
// prompts[].promptId, prompts[].name, etc.
```

## 2) Assure Methods Associated With Smart Contract

Ensure methods are imported/available for a contract and business.

```ts
const methods = await client.contractMethods.assureContractMethodsFromPrompt(
  businessId,
  {
    chainId: 8453,
    contractAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    walletId,
    promptId: "optional_prompt_uuid", // optional; omit to use highest-ranked prompt
  }
);
```

## 3) Functions

### List Imported Functions

```ts
const { response, page, pageSize, totalResults } =
  await client.contractMethods.list(businessId, {
    chainId: 8453,
    contractAddress: "0x...",
    page: 1,
    pageSize: 20,
    status: "live",
  });
```

### Update Imported Function Details

```ts
const updated = await client.contractMethods.update("your_contract_method_id", {
  name: "Transfer USDC",
  description: "Sends USDC to a recipient",
  walletId: "another_wallet_id",
});
```

### Read From Read Functions

```ts
const balance = await client.contractMethods.read(
  "your_contract_method_id", // e.g. balanceOf
  {
    owner: "0x1234567890123456789012345678901234567890",
  }
);
```

### Simulate Write Functions

```ts
const result = await client.contractMethods.test(
  "your_contract_method_id",
  { amount: "1000000", recipient: "0x..." },
  { value: "0" }
);
// result.success, result.data, etc.
```

## 4) Events

### List Imported Events

```ts
const { response, page, pageSize, totalResults } =
  await client.contractEvents.list(businessId, {
    chainId: 8453,
    contractAddress: "0x...",
    page: 1,
    pageSize: 20,
  });
```

### Update Imported Event Details

```ts
const updated = await client.contractEvents.update("your_contract_event_id", {
  name: "Transfer events",
  description: "ERC20 Transfer(indexed from, indexed to, value)",
});
```

### Query Events With Indexed Arguments

```ts
const { logs } = await client.contractEvents.searchLogs(
  "your_contract_event_id",
  {
    startBlock: 12_000_000,
    endBlock: 12_100_000,
    topics: {
      from: "0x1234567890123456789012345678901234567890",
      to: "0xabcdef0123456789abcdef0123456789abcdef01",
    },
  }
);
// logs[].eventName, logs[].blockNumber, logs[].topics, etc.
```

## Validation And Safety Checks

- Validate `chainId` and `contractAddress` before assure/list/read/test/log queries.
- Keep wallet-to-method assignment explicit when updating method metadata.
- Use read/test methods before execute flows to reduce runtime failures.
- For log queries, constrain `startBlock` and `endBlock` to avoid oversized scans.
