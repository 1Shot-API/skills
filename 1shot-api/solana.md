# Solana

Use this guide when the user asks to build on Solana with the 1Shot Node SDK: Solana server wallets, SOL transfers, calling Solana programs (Anchor or native), SPL Token / Token-2022 mints, or reading Solana execution results and webhooks.

1Shot runs Solana next to EVM chains, but with its own definitions. Instead of Contract Methods, you register **programs** and call their **instructions**, and you operate on **mints** through built-in token operations. Wallets, executions (`client.transactions`), webhooks and quotas are shared with EVM.

## Topics Covered

- Solana chains, addresses and units
- Solana server wallets and SOL transfers
- programs: Anchor IDL import, manual programs and instructions, account reads
- instructions: simulate, estimate, encode, execute
- mints: register or create, transfer, mintTo, burn, createAta, freeze, thaw, info, balances
- execution results and the `solana` receipt
- webhooks for Solana executions
- what is EVM-only

## MCP Tool

The 1Shot API MCP server does not manage Solana programs, instructions or mints yet. Use the SDK (or the REST API) for them.

## SDK Setup

```bash
npm install @1shotapi/client-sdk
```

Solana support needs `@1shotapi/client-sdk` 1.2.0 or later. Older versions reject negative chain ids.

```ts
import { OneShotClient } from "@1shotapi/client-sdk";

const client = new OneShotClient({
  apiKey: process.env.ONESHOT_API_KEY!,
  apiSecret: process.env.ONESHOT_API_SECRET!,
});
```

Assume:

- `businessId`: your 1Shot business UUID
- `walletId`: a Solana server wallet UUID (created in section 2)

## 1) Chains, Addresses and Units

| Chain | `chainId` |
|-------|-----------|
| Solana mainnet | `-1` |
| Solana devnet | `-2` |

- `chainTechnology` is `1` on Solana chains, wallets' balance details and transactions (`0` on EVM).
- Addresses, program ids, mint addresses and transaction signatures are **base58** strings, never `0x` hex.
- SOL amounts are **lamports** (1 SOL = 1,000,000,000 lamports, 9 decimals). Token amounts are the mint's **base units** (`amount * 10^decimals`). Both are decimal strings.
- Instruction arguments of 64 bits or more (`u64`, `i64`, `u128`, ...) are decimal strings; public keys are base58 strings.

```ts
const { response } = await client.chains.list({ pageSize: 100 });
const solanaChains = response.filter((chain) => chain.chainTechnology === 1);
```

## 2) Solana Server Wallets and SOL Transfers

```ts
const wallet = await client.wallets.create(businessId, {
  chainId: -2, // Solana devnet
  name: "Solana payouts",
  description: "Pays for Solana executions",
});
// wallet.accountAddress is base58. Fund it with SOL before executing anything.

const withBalance = await client.wallets.get(wallet.id, true);
// withBalance.accountBalanceDetails?.balance is in lamports, ticker "SOL", decimals 9

const transfer = await client.wallets.transfer(wallet.id, {
  destinationAccountAddress: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
  transferAmount: "1000000", // 0.001 SOL in lamports; omit to send everything above the rent-exempt reserve
  memo: "Refund #881",
});
```

The wallet pays every transaction fee (a 5,000-lamport base fee per signature plus a priority fee) and any rent for accounts an instruction creates.

## 3) Programs

### Import from an Anchor IDL

Anchor IDLs in the 0.30+ format (from `anchor build`) create one instruction per IDL instruction, with account templates and argument encoding filled in. Legacy IDLs must be converted with `anchor idl convert` first.

```ts
import fs from "node:fs";

const idl = JSON.parse(fs.readFileSync("target/idl/my_program.json", "utf8"));

const { program, instructions, warnings } = await client.solanaPrograms.importIdl(businessId, {
  chainId: -2,
  walletId, // default wallet of every imported instruction
  idl,
  // name: "My program", // defaults to idl.metadata.name
});
// Omit `idl` and pass `programAddress` instead to fetch the program's on-chain IDL.
// Review `warnings`: they name instructions whose accounts could not be fully templated.
```

Lists return `hasIdl` only; `client.solanaPrograms.get(programId)` includes the stored IDL.

### Add a program and instruction by hand

For native programs, or to refine what an IDL produced, describe the accounts and arguments yourself. This is the System program's SOL transfer:

```ts
const system = await client.solanaPrograms.create(businessId, {
  chainId: -2,
  programAddress: "11111111111111111111111111111111",
  name: "System program",
});

const transferSol = await client.solanaPrograms.addInstruction(system.id, {
  walletId,
  name: "Transfer SOL",
  instructionName: "transfer",
  accounts: [
    { name: "funder", isSigner: true, isWritable: true, source: { kind: "FeePayer" } },
    {
      name: "recipient",
      isSigner: false,
      isWritable: true,
      source: { kind: "Param", paramName: "recipient" },
    },
  ],
  argLayout: {
    encoding: "RawBorsh", // "Anchor" requires a discriminator (usually 8 bytes); for "RawBorsh" it is an optional prefix
    discriminator: [2, 0, 0, 0],
    args: [{ name: "lamports", type: "u64" }],
  },
  // computeBudget: { computeUnitLimit: 10000 }, // optional; 1Shot sizes it from a simulation
  // callbackUrl: "https://your-app.com/webhooks/1shot", // optional, creates a webhook trigger
});
```

Account `source` kinds, in the order the program expects its accounts:

| `kind` | Address comes from |
|--------|--------------------|
| `FeePayer` | the executing wallet |
| `Static` | a fixed `address` |
| `Param` | the caller's `params[paramName]` (base58) |
| `Pda` | a program derived address: `programId` (`{ kind: "Self" }`, `Static`, `Param` or `Account`) plus up to 15 `seeds` (`Const`, `Param`, `Account`) |
| `Ata` | the associated token account of `owner` and `mint` under `tokenProgram` (`Token` or `Token2022`) |
| `Ephemeral` | a fresh keypair per execution, for accounts the instruction initializes; its address is in the receipt's `ephemeralAddresses` |

Only `FeePayer` and `Ephemeral` slots can sign. Update definitions with `client.solanaInstructions.update` (`computeBudget: null` clears the budget, `callbackUrl: null` removes the webhook).

### Read a program account

```ts
const account = await client.solanaPrograms.readAccount(program.id, "AccountAddressBase58...", {
  accountType: "Counter", // optional; detected from the discriminator
});
// account.data holds the decoded fields; needs a program with an IDL
```

## 4) Calling Instructions

`simulate`, `estimate`, `encode` and `execute` take the same body.

```ts
const call = {
  params: {
    recipient: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    lamports: "1000000",
  },
  memo: "Payout #42", // written on chain with the memo program, max 256 chars
  // walletId: "other_solana_wallet_id", // overrides the default wallet
  // extraAccounts: [{ address: "...", isWritable: false }], // remaining accounts
  // computeBudget: { computeUnitLimit: 50000, computeUnitPrice: "2000" }, // price in micro-lamports per CU
};

const simulation = await client.solanaInstructions.simulate(transferSol.id, call);
if (!simulation.success) {
  throw new Error(`Simulation failed: ${JSON.stringify(simulation.err)} ${simulation.logs.join("\n")}`);
}

const fee = await client.solanaInstructions.estimate(transferSol.id, call);
// fee.totalLamports = baseFeeLamports + priorityFeeLamports + rentLamports

const execution = await client.solanaInstructions.execute(transferSol.id, call);
// execution.id is a Transaction id; see section 6
```

`encode` returns the resolved, unsigned plan (accounts and base64 instruction data) without sending anything. Use it to debug account resolution.

## 5) Mints

```ts
// Register an existing mint; decimals and token program are read from the chain
const usdc = await client.solanaMints.register(businessId, {
  chainId: -1,
  mintAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  walletId,
  name: "USDC",
});

// Or create a new mint; the wallet pays and becomes the mint authority
const { mint, transaction } = await client.solanaMints.create(businessId, {
  chainId: -2,
  walletId,
  name: "Reward points",
  decimals: 6,
  tokenProgram: "Token", // or "Token2022"
  freezeAuthority: wallet.accountAddress, // optional; omit and tokens can never be frozen
});
// mint.mintAddress is null until `transaction` reaches Completed
```

Operations return a Transaction. Amounts are base units; recipients are wallet (owner) addresses, and 1Shot uses their associated token accounts.

```ts
await client.solanaMints.mintTo(mint.id, {
  params: { destinationOwner: wallet.accountAddress, amount: "5000000" }, // 5 tokens at 6 decimals
});
await client.solanaMints.transfer(mint.id, {
  params: { destinationOwner: "9WzD...", amount: "1000000" }, // creates the recipient's account if missing
  memo: "Reward",
});
await client.solanaMints.burn(mint.id, { params: { amount: "1000000" } });
await client.solanaMints.createAta(mint.id, { params: { owner: "9WzD..." } });
await client.solanaMints.freeze(mint.id, { params: { tokenAccountOwner: "9WzD..." } });
await client.solanaMints.thaw(mint.id, { params: { tokenAccountOwner: "9WzD..." } });

const info = await client.solanaMints.info(mint.id); // supply, decimals, mintAuthority, freezeAuthority
const { tokenAccount } = await client.solanaMints.balance(mint.id, "9WzD...");
// tokenAccount is null when the owner has no account for this mint; tokenAccount.amount is base units
```

`transfer` and `burn` move tokens from the wallet's own token account. `mintTo` needs the wallet to be the mint authority, and `freeze` / `thaw` need it to be the freeze authority.

## 6) Execution Results

Every execute, mint operation and SOL transfer is a Transaction in `client.transactions`.

```ts
const tx = await client.transactions.get(execution.id);
// tx.status: "Pending" | "Submitted" | "Completed" | "Failed" | "Retrying"
// tx.transactionHash: the base58 signature, once Submitted
// tx.contractMethodIds: [instructionId] or [mintId]; [] for SOL transfers
// tx.name / tx.functionName: instruction name and instructionName, or mint name and operation
// tx.gasPrice, tx.gasLimit, tx.gasUsed: always null on Solana
// tx.solana: { signature, slot, blockTime, feeLamports, computeUnitsConsumed,
//              confirmationStatus, err, programLogs, ephemeralAddresses? } once confirmed
```

- **Completed** means the transaction reached the `confirmed` commitment. Reaching `finalized` later only updates `solana.confirmationStatus`; no second webhook is sent.
- **Failed** covers on-chain errors (see `failureReason`, `solana.err` and `solana.programLogs`) and transactions whose blockhash expired after 1Shot's re-sign attempts. A confirmed transaction that is later dropped before finalizing is corrected to Failed (rare).
- Filter history with `client.transactions.list(businessId, { chainId: -2, contractMethodId: instructionOrMintId })`.

## 7) Webhooks

Solana executions fire the same `TransactionExecutionSubmitted`, `TransactionExecutionSuccess` and `TransactionExecutionFailure` events as EVM (see [webhooks.md](webhooks.md)).

- Put instruction or mint ids in a trigger's `contractMethodIds` to filter by definition, or set `callbackUrl` on the instruction or mint to create a trigger for it.
- In the payload, `chainTechnology` is `1`, `transactionReceipt` is `null`, `logs` is empty, and `solana` carries the receipt described in section 6.

## 8) EVM-Only Features

These are not available on Solana chains: contract methods and the smart contract library, contract events, `chains.getFees` and `chains.getCode`, wallet signatures (EIP-3009, Permit2, typed data, message signing), delegations, ERC-7702, x402 and 1ShotPay. Program deployment, address lookup tables and Token-2022 extensions such as transfer hooks are not supported.

## Safety Checks

- Validate base58 addresses (32-44 characters, no `0`, `O`, `I` or `l`) before calling; never pass `0x` addresses to Solana routes.
- Convert human amounts to base units with the mint's `decimals` (9 for SOL) using string or bigint math, never floating point.
- Simulate before executing new or high-value instructions, and read `simulation.logs` on failure.
- Keep the wallet funded for fees and rent; `estimate` gives the cost of one call.
- Use devnet (`-2`) while developing; mainnet (`-1`) moves real funds.
- Treat Completed as confirmed, not finalized, when the value at stake needs finality.
