# Server Wallets

Use this guide when the user asks for Server Wallet implementation with the 1Shot Node SDK.

This section is aligned to the SDK README Server Wallets methods and naming.

## Topics Covered

From the repository outline:

- list available EVM networks
- create server wallet
- list server wallets
- update wallet metadata
- generate signatures (EIP-3009, Permit2)
- work with delegations (MetaMask Smart Accounts Kit, create, list, redelegate)

## SDK Setup

```bash
npm install @1shotapi/client-sdk
```

Create the client:

```ts
import { OneShotClient } from "@1shotapi/client-sdk";

const client = new OneShotClient({
  apiKey: process.env.ONESHOT_API_KEY!,
  apiSecret: process.env.ONESHOT_API_SECRET!,
  // baseUrl: "https://api.staging.1shotapi.com/v0", // optional
});
```

Assume you have:

- `businessId`: your 1Shot business UUID
- `walletId`: a server wallet UUID when operating on an existing wallet

## 1) List Supported Chains

```ts
const { response, page, pageSize, totalResults } = await client.chains.list({
  page: 1,
  pageSize: 20,
});

for (const chain of response) {
  console.log(chain.chainId, chain.name, chain.type, chain.nativeCurrency.symbol);
}
```

Use this when selecting valid `chainId` values for wallet creation and transaction flows.

## 2) Fetch Current Gas Fees

```ts
const fees = await client.chains.getFees(8453); // Base mainnet

// EIP-1559 chains:
// fees.maxFeePerGas, fees.maxPriorityFeePerGas
// non-EIP-1559 chains:
// fees.gasPrice
```

Gas fee shape from your validation model:

```ts
type GasFees = {
  gasPrice: string | null;
  maxFeePerGas: string | null;
  maxPriorityFeePerGas: string | null;
};
```

## 3) Create Server Wallet

```ts
const wallet = await client.wallets.create(businessId, {
  chainId: 8453, // Base mainnet
  name: "Payments wallet",
  description: "Used for consumer payouts",
});
// wallet.id, wallet.address, wallet.chainId, etc.
```

## 4) List Server Wallets

```ts
const { response, page, pageSize, totalResults } = await client.wallets.list(
  businessId,
  {
    chainId: 8453,
    page: 1,
    pageSize: 20,
  }
);
```

## 5) Update Server Wallet Metadata

```ts
const updated = await client.wallets.update(walletId, {
  name: "Updated name",
  description: "Updated description",
});
```

## 6) Get Signatures From Server Wallets

### EIP-3009

```ts
const sig = await client.wallets.getSignature(walletId, "erc3009", {
  contractAddress: "0x...", // EIP-3009 compliant token contract
  destinationAddress: "0x...", // Address that will receive the tokens
  amount: "1000000000000000000",
});
// sig.signature, sig.deadline, etc.
```

### Permit2

```ts
const sig = await client.wallets.getSignature(walletId, "permit2", {
  contractAddress: "0x...",
  destinationAddress: "0x...",
  amount: "1000000",
  validUntil: Math.floor(Date.now() / 1000) + 3600,
  validAfter: 0,
});
```

### Authorize Permit2

If your SDK version does not expose an `authorizePermit2` helper, use the request fallback:

```ts
await client.request("PUT", `/wallets/${walletId}/authorizePermit2`, {
  contractAddress: "0x...",
});
```

## 7) Delegations

Delegations are the part that maps to MetaMask Smart Accounts Kit workflows: you create/store delegation payloads, list them, and redelegate with respect to a specific 1Shot API server wallet.

### Create Delegation (store in 1Shot API)

```ts
const delegation = await client.wallets.createDelegation(walletId, {
  delegationData: "<signed delegation payload from your signer>",
  startTime: Math.floor(Date.now() / 1000),
  endTime: Math.floor(Date.now() / 1000) + 86400 * 7, // 7 days
  contractAddresses: ["0x..."],
  methods: ["transfer", "approve"],
});
```

### List Stored Delegations

```ts
const { response, page, pageSize, totalResults } =
  await client.wallets.listDelegations(walletId, {
    page: 1,
    pageSize: 10,
  });
```

### Redelegate From Stored Delegation

```ts
const { parent, redelegation } = await client.wallets.redelegate(
  "existing_delegation_id",
  { delegateAddress: "0xNewDelegate..." }
);
// Use parent and redelegation in delegationData when executing as delegator.
```

### Redelegate From Provided Delegation

```ts
const { parent, redelegation } =
  await client.wallets.redelegateWithDelegationData(
    "escrow_wallet_id_that_is_current_delegate",
    {
      delegationData: "<parent delegation JSON string>",
      delegateAddress: "0xNewDelegate...",
    }
  );
```

## Chain Models (From Your SDK Types)

```ts
type ListChains = {
  pageSize?: number | null;
  page?: number | null;
};

type ChainInfo = {
  name: string;
  chainId: number;
  averageBlockMiningTime: number;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  type: "Mainnet" | "Testnet" | "Hardhat";
};
```

Your implementation validates params and responses with:

- `listChainsSchema`
- `chainListSchema`
- `getFeesSchema`
- `gasFeesSchema`

Keep this Zod-first validation pattern for all wallet- and chain-adjacent calls.

## Safety Checks

- Always fetch supported chains and reject unknown `chainId` values before wallet creation.
- Resolve gas fees from `client.chains.getFees(chainId)` right before execution/simulation if gas price is a concern.
- Validate chain ID and address formatting before create/sign/delegation operations.
- Do not log API secrets, delegation payloads, or raw signatures.
- Persist returned delegation IDs for future `redelegate` and delegated execution flows.
- Add expiry checks (`endTime`) before using old delegation records.
