# Public Relayer — End-to-End Examples

Copy-paste-ready TypeScript patterns for integrating with the 1Shot relayer using `@metamask/smart-accounts-kit` and `viem`. All snippets use `bun` runtime conventions and assume modern ESM.

> Pair these with `SKILL.md` (workflow + decisions) and `reference.md` (schemas + error catalog).

## Shared utilities

```ts
import { bytesToHex } from "viem/utils";

const RELAYER_URL = process.env.RELAYER_URL ?? "https://relayer.1shotapi.com/relayers";

type JsonRpc<T> =
  | { jsonrpc: "2.0"; id: number | string; result: T }
  | { jsonrpc: "2.0"; id: number | string; error: { code: number; message: string; data?: unknown } };

export async function rpc<T>(method: string, params: unknown, id: number = 1): Promise<T> {
  const res = await fetch(RELAYER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  const json = (await res.json()) as JsonRpc<T>;
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json)}`);
  if ("error" in json) {
    throw new Error(`[${json.error.code}] ${json.error.message} ${JSON.stringify(json.error.data ?? "")}`);
  }
  return json.result;
}

/** Convert delegation bigints / Uint8Arrays into JSON-safe shapes. */
export function toRelayerJson(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return `0x${value.toString(16)}`;
  if (value instanceof Uint8Array) return bytesToHex(value);
  if (Array.isArray(value)) return value.map(toRelayerJson);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = toRelayerJson(v);
    return out;
  }
  return value;
}
```

## Fee math (always floor at `minFee`)

```ts
export function computeFeeAmount(
  feeData: { gasPrice: `0x${string}`; rate: number; minFee: string; token: { decimals: number } },
  estimatedGasUsed: bigint,
): bigint {
  const nativeFeeWei = BigInt(feeData.gasPrice) * estimatedGasUsed;
  // rate is a number representing native-wei → token atoms; for high precision, scale with BigInt math.
  // Simple approach: do the float multiplication, then floor; for production, prefer fixed-point.
  const tokenAtomsFloat = Number(nativeFeeWei) * feeData.rate;
  const tokenAtoms = BigInt(Math.ceil(tokenAtomsFloat));
  const minFee = BigInt(feeData.minFee);
  return tokenAtoms < minFee ? minFee : tokenAtoms;
}
```

> For production, replace the float multiplication with a fixed-point conversion to avoid precision loss for large gas amounts.

---

## Example 1 — Self-sponsored, single chain (fee + work in one delegation)

The same delegator pays the fee and executes the work. One delegation scoped to `feeAmount + workAmount`, one bundle with two `executions[]`.

```ts
import { randomBytes } from "node:crypto";
import {
  Implementation,
  ScopeType,
  createDelegation,
  toMetaMaskSmartAccount,
} from "@metamask/smart-accounts-kit";
import { createPublicClient, encodeFunctionData, erc20Abi, getAddress, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia as chain } from "viem/chains";
import { bytesToHex } from "viem/utils";

const STATELESS_DELEGATOR_IMPL = "0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B" as `0x${string}`;

const delegatorAccount = privateKeyToAccount(process.env.DELEGATOR_PRIVATE_KEY as `0x${string}`);
const publicClient = createPublicClient({ chain, transport: http() });

// Step 1: capabilities
const caps = await rpc<Record<string, {
  feeCollector: `0x${string}`;
  targetAddress: `0x${string}`;
  tokens: { address: `0x${string}`; symbol?: string; decimals: number | string }[];
}>>("relayer_getCapabilities", [String(chain.id)]);

const chainCaps = caps[String(chain.id)]!;
const usdc = chainCaps.tokens.find((t) => t.symbol === "USDC")!;

// Step 2: fee data + price-lock
const feeData = await rpc<{
  gasPrice: `0x${string}`; rate: number; minFee: string; expiry: number;
  context?: string; token: { address: `0x${string}`; decimals: number };
}>("relayer_getFeeData", { chainId: String(chain.id), token: usdc.address });

const estimatedGasUsed = 200_000n; // upper bound for fee transfer + work transfer
const feeAmount = computeFeeAmount(feeData, estimatedGasUsed);
const workAmount = 20_000n; // 0.02 USDC
const destinationAddress = "0x3e6a2f0CBA03d293B54c9fCF354948903007a798" as `0x${string}`;

// Step 3a: smart account + (optional) EIP-7702 authorization
const smartAccount = await toMetaMaskSmartAccount({
  client: publicClient,
  implementation: Implementation.Stateless7702,
  address: delegatorAccount.address,
  signer: { account: delegatorAccount },
});

let authorizationList: unknown[] | undefined;
if (process.env.RELAYER_7710_AUTHORIZE === "true") {
  const nonce = await publicClient.getTransactionCount({
    address: delegatorAccount.address,
    blockTag: "pending",
  });
  const auth = await delegatorAccount.signAuthorization({
    chainId: chain.id,
    contractAddress: getAddress(STATELESS_DELEGATOR_IMPL),
    nonce,
  });
  authorizationList = [{
    address: auth.address, chainId: auth.chainId, nonce: auth.nonce,
    r: auth.r, s: auth.s, yParity: auth.yParity ?? 0,
  }];
}

// Step 3b: delegation (single, scoped to fee + work)
const delegation = createDelegation({
  to: chainCaps.targetAddress,
  from: smartAccount.address,
  environment: smartAccount.environment,
  salt: bytesToHex(Uint8Array.from(randomBytes(32))) as `0x${string}`,
  scope: {
    type: ScopeType.Erc20TransferAmount,
    tokenAddress: usdc.address,
    maxAmount: feeAmount + workAmount,
  },
});
const signature = await smartAccount.signDelegation({ delegation });
const signedDelegation = { ...delegation, signature };

// Step 3c: encode executions
const feeCalldata = encodeFunctionData({
  abi: erc20Abi, functionName: "transfer",
  args: [chainCaps.feeCollector, feeAmount],
});
const workCalldata = encodeFunctionData({
  abi: erc20Abi, functionName: "transfer",
  args: [destinationAddress, workAmount],
});

// Step 3d: submit (with destinationUrl recommended)
const taskId = await rpc<string>("relayer_send7710Transaction", {
  chainId: String(chain.id),
  context: feeData.context,
  destinationUrl: process.env.WEBHOOK_URL, // optional but encouraged
  ...(authorizationList ? { authorizationList } : {}),
  transactions: [{
    permissionContext: [toRelayerJson(signedDelegation)],
    executions: [
      { target: usdc.address, value: "0", data: feeCalldata },
      { target: usdc.address, value: "0", data: workCalldata },
    ],
  }],
});

console.log("submitted", taskId);
```

If `destinationUrl` is not set, fall back to polling — see `relayer_getStatus` polling pattern in Example 4.

---

## Example 2 — Sponsored, single chain (separate sponsor pays the fee)

Two delegations (sponsor → fee transfer; delegator → work transfer) batched into one `relayer_send7710Transaction`. Two `transactions[]` entries, each with its own `permissionContext`. The relayer merges them into one on-chain `redeemDelegations` batch.

```ts
const sponsorAccount = privateKeyToAccount(process.env.SPONSOR_PRIVATE_KEY as `0x${string}`);
const sponsorSmartAccount = await toMetaMaskSmartAccount({
  client: publicClient,
  implementation: Implementation.Stateless7702,
  address: sponsorAccount.address,
  signer: { account: sponsorAccount },
});

const sponsorDelegation = createDelegation({
  to: chainCaps.targetAddress,
  from: sponsorSmartAccount.address,
  environment: sponsorSmartAccount.environment,
  salt: bytesToHex(Uint8Array.from(randomBytes(32))) as `0x${string}`,
  scope: { type: ScopeType.Erc20TransferAmount, tokenAddress: usdc.address, maxAmount: feeAmount },
});
const sponsorSig = await sponsorSmartAccount.signDelegation({ delegation: sponsorDelegation });

const delegatorDelegation = createDelegation({
  to: chainCaps.targetAddress,
  from: smartAccount.address,
  environment: smartAccount.environment,
  salt: bytesToHex(Uint8Array.from(randomBytes(32))) as `0x${string}`,
  scope: { type: ScopeType.Erc20TransferAmount, tokenAddress: usdc.address, maxAmount: workAmount },
});
const delegatorSig = await smartAccount.signDelegation({ delegation: delegatorDelegation });

// Only one authorizationList entry allowed total — pick whichever account needs the upgrade.
const taskId = await rpc<string>("relayer_send7710Transaction", {
  chainId: String(chain.id),
  context: feeData.context,
  destinationUrl: process.env.WEBHOOK_URL,
  transactions: [
    {
      permissionContext: [toRelayerJson({ ...sponsorDelegation, signature: sponsorSig })],
      executions: [{ target: usdc.address, value: "0", data: feeCalldata }],
    },
    {
      permissionContext: [toRelayerJson({ ...delegatorDelegation, signature: delegatorSig })],
      executions: [{ target: usdc.address, value: "0", data: workCalldata }],
    },
  ],
});
```

---

## Example 3 — Multichain (fee on chain A, work on chain B)

Use `relayer_send7710TransactionMultichain` when the fee and the work happen on different chains. Each chain gets its own params object (own `context` from `relayer_getFeeData` for that chain, own `authorizationList`, own `transactions[]`). Returns one `TaskId` per chain entry, in order.

```ts
import { baseSepolia, sepolia } from "viem/chains";

// Quote each chain independently:
const feeBaseCaps = (await rpc<...>("relayer_getCapabilities", [String(baseSepolia.id), String(sepolia.id)]))[String(baseSepolia.id)]!;
const feeBaseQuote = await rpc<...>("relayer_getFeeData", { chainId: String(baseSepolia.id), token: usdcBase });
const sepoliaQuote = await rpc<...>("relayer_getFeeData", { chainId: String(sepolia.id), token: usdcSepolia });

// Build a delegation per chain (each scoped to its own amount).
// Sign separately under public clients for each chain.

const taskIds = await rpc<string[]>("relayer_send7710TransactionMultichain", [
  {
    chainId: String(baseSepolia.id),
    context: feeBaseQuote.context,
    destinationUrl: process.env.WEBHOOK_URL,
    ...(authBase ? { authorizationList: authBase } : {}),
    transactions: [{
      permissionContext: [toRelayerJson(signedFeeDelegation)],
      executions: [{ target: usdcBase, value: "0", data: feeCalldataBase }],
    }],
  },
  {
    chainId: String(sepolia.id),
    context: sepoliaQuote.context,
    destinationUrl: process.env.WEBHOOK_URL,
    ...(authSep ? { authorizationList: authSep } : {}),
    transactions: [{
      permissionContext: [toRelayerJson(signedWorkDelegation)],
      executions: [{ target: usdcSepolia, value: "0", data: workCalldataSepolia }],
    }],
  },
]);

const [feeTaskId, workTaskId] = taskIds;
```

---

## Example 4 — Polling fallback for `relayer_getStatus`

Prefer webhooks (Example 5). Use polling only if you can't accept inbound HTTP.

```ts
async function pollUntilTerminal(taskId: string, intervalMs = 3000, timeoutMs = 5 * 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await rpc<{
      status: 100 | 110 | 200 | 400 | 500;
      hash?: string; receipt?: object; message?: string; data?: unknown;
    }>("relayer_getStatus", { id: taskId, logs: true });

    if (result.status === 200) return { ok: true as const, receipt: result.receipt };
    if (result.status === 400) return { ok: false as const, reason: result.message };
    if (result.status === 500) return { ok: false as const, reason: "reverted", data: result.data };

    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timeout waiting for ${taskId}`);
}
```

---

## Example 5 — Webhook receiver with Ed25519 verification

Recommended path. Pass `destinationUrl: "https://my-app.example.com/relayer-webhook"` when submitting, then run an HTTP server that:

1. Reads the JSON body.
2. Looks up the public key by `keyId` against a cached JWKS.
3. Removes `signature`, canonicalizes, and verifies.
4. Returns `200` quickly; queues processing in the background.

```ts
import * as ed from "@noble/ed25519";
import Crypto from "node:crypto";
import stringify from "safe-stable-stringify";

ed.hashes.sha512 = (m: Uint8Array) =>
  new Uint8Array(Crypto.createHash("sha512").update(Buffer.from(m)).digest());

type Jwk = { kty: "OKP"; crv: "Ed25519"; kid: string; x: string };
type Jwks = { keys: Jwk[] };

let jwksCache: { fetchedAt: number; keys: Map<string, Uint8Array> } | null = null;
const JWKS_TTL_MS = 10 * 60_000;
const JWKS_URL = "https://relayer.1shotapi.com/.well-known/jwks.json";

function base64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(b64url.length + (4 - (b64url.length % 4)) % 4, "=");
  return new Uint8Array(Buffer.from(b64, "base64"));
}

async function getJwks(force = false): Promise<Map<string, Uint8Array>> {
  if (!force && jwksCache && Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS) return jwksCache.keys;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const { keys } = (await res.json()) as Jwks;
  const map = new Map<string, Uint8Array>();
  for (const k of keys) {
    if (k.kty === "OKP" && k.crv === "Ed25519") map.set(k.kid, base64urlToBytes(k.x));
  }
  jwksCache = { fetchedAt: Date.now(), keys: map };
  return map;
}

export async function verifyRelayerWebhook(body: Record<string, unknown>): Promise<boolean> {
  const sigB64 = body.signature as string | undefined;
  const keyId = body.keyId as string | undefined;
  if (!sigB64 || !keyId) return false;

  let keys = await getJwks();
  let pub = keys.get(keyId);
  if (!pub) {
    keys = await getJwks(true); // force refresh on miss (key rotation)
    pub = keys.get(keyId);
    if (!pub) return false;
  }

  const { signature: _omit, ...rest } = body; // canonicalize without signature
  const message = new TextEncoder().encode(stringify(rest) as string);
  const sig = new Uint8Array(Buffer.from(sigB64, "base64"));
  return ed.verify(sig, message, pub);
}

// Bun HTTP server
Bun.serve({
  port: 3000,
  routes: {
    "/relayer-webhook": {
      POST: async (req) => {
        const body = (await req.json()) as Record<string, unknown>;
        const ok = await verifyRelayerWebhook(body);
        if (!ok) return new Response("invalid signature", { status: 401 });

        // Idempotency: dedupe on (transactionId, eventName)
        // Persist quickly, do heavy work async.
        console.log(body.eventName, (body.data as { transactionId: string }).transactionId);
        return new Response("ok", { status: 200 });
      },
    },
  },
});
```

Key points:

- The relayer signs over the **canonical JSON** of the body **without `signature`**. Reorder or whitespace differences will fail verification — always use `safe-stable-stringify` (or an equivalent stable serializer).
- Cache the JWKS; refetch on a `kid` miss to handle rotation.
- Respond `2xx` within the timeout (typically <30s) so the relayer marks the delivery as `Success` instead of retrying.
- De-duplicate at the application level: webhook delivery is at-least-once.

---

## Troubleshooting cheatsheet

| Symptom                                            | Likely cause                                                                 |
| -------------------------------------------------- | ---------------------------------------------------------------------------- |
| `4204 Quote Expired`                               | Submitted >45s after `relayer_getFeeData`. Refetch and resubmit immediately. |
| `4200 Insufficient Payment`                        | Forgot to floor at `minFee` or under-estimated `gasUsed`.                    |
| `4210 Invalid Authorization List`                  | Two entries supplied; relayer accepts at most one per request.               |
| Webhook returns `signature mismatch`               | Canonicalization mismatch — always use stable-key stringify, omit `signature`. |
| `CaveatEnforcer:invalid-call-type` revert on chain | `ScopeType.Erc20TransferAmount` doesn't match a batched call. Switch to `ScopeType.FunctionCall` (token + selector). |
| Delegation not redeemable                          | `delegator` EOA hasn't been EIP-7702-upgraded; include `authorizationList` in the request or upgrade out-of-band first. |
| `Cannot serialize bigint`                          | Run delegation through `toRelayerJson` before JSON-RPC submission.           |
