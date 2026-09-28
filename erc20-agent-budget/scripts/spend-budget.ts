/**
 * Spend an ERC20PeriodTransferEnforcer grant through the 1Shot relayer.
 *
 * Context U (user): token.transfer(agent, spend), then token.transfer(feeCollector, fee).
 * Context A (agent): the action executions, limited to this redemption.
 * An empty executions file submits Context U only.
 *
 * Run from a project that has viem and @metamask/smart-accounts-kit installed:
 *
 *   AGENT_PRIVATE_KEY=0x... npx tsx spend-budget.ts \
 *     --grant ./user-grant.json \
 *     --executions ./action.json \
 *     --chain-id 84532 \
 *     --spend 5 \
 *     --rpc-url "$RPC_URL"
 *
 * --spend is a decimal in token units. The key is read from AGENT_PRIVATE_KEY only.
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

import {
  ROOT_AUTHORITY,
  getSmartAccountsEnvironment,
  signDelegation,
} from "@metamask/smart-accounts-kit";
import type { Delegation } from "@metamask/smart-accounts-kit";
import { createCaveatBuilder, hashDelegation } from "@metamask/smart-accounts-kit/utils";
import {
  createPublicClient,
  encodeFunctionData,
  erc20Abi,
  getAddress,
  http,
  isAddressEqual,
  isHex,
  parseUnits,
  toHex,
} from "viem";
import type { Address, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const DELEGATION_PREFIX = "0xef0100";
const PERIOD_TERMS_BYTES = 116;

type JsonRpc<T> =
  | { jsonrpc: "2.0"; id: number; result: T }
  | {
      jsonrpc: "2.0";
      id: number;
      error: { code: number; message: string; data?: unknown };
    };

type Capability = {
  feeCollector: Address;
  targetAddress: Address;
  tokens: Array<{ address: Address; symbol?: string; decimals: number | string }>;
};

type FeeData = {
  minFee: string;
};

type EstimateResult = {
  success: boolean;
  requiredPaymentAmount?: string;
  context?: string;
  error?: string;
};

type ActionExecution = {
  target: Address;
  value: string;
  data: Hex;
};

type SendParams = {
  chainId: string;
  transactions: Array<{
    permissionContext: unknown[];
    executions: Array<{ target: Address; value: string; data: Hex }>;
  }>;
  authorizationList?: Array<{
    address: Address;
    chainId: number;
    nonce: number;
    r: Hex;
    s: Hex;
    yParity: number;
  }>;
};

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function budgetExceeded(input: {
  available: bigint;
  fee: bigint;
  requested: bigint;
  feeBasis: "minFee" | "requiredPaymentAmount";
}): never {
  const maxSpend = input.available > input.fee ? input.available - input.fee : 0n;
  process.stdout.write(
    `${JSON.stringify({
      status: "spend-exceeds-budget",
      availableAmount: input.available.toString(),
      fee: input.fee.toString(),
      feeBasis: input.feeBasis,
      maxSpend: maxSpend.toString(),
      requestedSpend: input.requested.toString(),
    })}\n`,
  );
  process.stderr.write(
    `Requested spend ${input.requested} plus fee ${input.fee} (${input.feeBasis}) exceeds available ${input.available}. Max spend is ${maxSpend} atoms. Rebuild the action for that amount and run again.\n`,
  );
  process.exit(2);
}

function relayerUrlForChain(chainId: string): string {
  if (process.env.RELAYER_URL) return process.env.RELAYER_URL;
  if (chainId === "11155111" || chainId === "84532") {
    return "https://relayer.1shotapi.dev/relayers";
  }
  return "https://relayer.1shotapi.com/relayers";
}

async function rpc<T>(relayerUrl: string, method: string, params: unknown): Promise<T> {
  const response = await fetch(relayerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = (await response.json()) as JsonRpc<T>;
  if (!response.ok) {
    fail(`HTTP ${response.status}: ${JSON.stringify(json)}`);
  }
  if ("error" in json) {
    fail(`[${json.error.code}] ${json.error.message} ${JSON.stringify(json.error.data ?? "")}`);
  }
  return json.result;
}

function toRelayerJson(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return `0x${value.toString(16)}`;
  if (value instanceof Uint8Array) return toHex(value);
  if (Array.isArray(value)) return value.map(toRelayerJson);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) out[key] = toRelayerJson(entry);
    return out;
  }
  return value;
}

function readPrivateKey(): Hex {
  const raw = process.env.AGENT_PRIVATE_KEY?.trim();
  if (!raw) fail("Set AGENT_PRIVATE_KEY in the environment. Do not pass the key as an argument.");
  const hex = raw.startsWith("0x") ? raw : `0x${raw}`;
  if (!isHex(hex) || hex.length !== 66) fail("AGENT_PRIVATE_KEY must be a 32-byte hex string.");
  return hex;
}

function normalizeBytes32(value: string, label: string): Hex {
  let parsed: bigint;
  try {
    parsed = BigInt(value);
  } catch {
    fail(`${label} is not a hex or decimal integer.`);
  }
  return toHex(parsed, { size: 32 });
}

function loadGrant(path: string): Delegation {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<Delegation>;
  if (!parsed.delegate || !parsed.delegator || !parsed.authority || !parsed.salt || !parsed.signature) {
    fail("Grant JSON must include delegate, delegator, authority, salt, and signature.");
  }
  if (!Array.isArray(parsed.caveats) || parsed.caveats.length === 0) {
    fail("Grant JSON must include the ERC20PeriodTransferEnforcer caveat.");
  }
  return {
    delegate: getAddress(parsed.delegate),
    delegator: getAddress(parsed.delegator),
    authority: normalizeBytes32(parsed.authority, "authority"),
    caveats: parsed.caveats.map((caveat) => ({
      enforcer: getAddress(caveat.enforcer),
      terms: caveat.terms,
      args: caveat.args,
    })),
    salt: normalizeBytes32(parsed.salt, "salt"),
    signature: parsed.signature,
  };
}

function loadActions(path: string): ActionExecution[] {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!Array.isArray(parsed)) {
    fail("Executions JSON must be an array of { target, data, value }, or [] to receive the allowance and stop.");
  }
  if (parsed.length === 0) return [];
  return parsed.map((entry, index) => {
    if (!entry || typeof entry !== "object") fail(`Execution ${index} is not an object.`);
    const raw = entry as { target?: string; data?: string; value?: string };
    if (!raw.target || !raw.data) fail(`Execution ${index} needs target and data.`);
    if (!isHex(raw.data)) fail(`Execution ${index} data must be hex.`);
    const value = raw.value ?? "0";
    if (BigInt(value) !== 0n) fail(`Execution ${index} value must be 0. The agent has no native gas.`);
    return { target: getAddress(raw.target), value: "0", data: raw.data };
  });
}

function delegatedImplementation(code: Hex | undefined): Address | null {
  if (!code || code === "0x" || code.length !== 48) return null;
  if (!code.toLowerCase().startsWith(DELEGATION_PREFIX)) return null;
  return getAddress(`0x${code.slice(8)}`);
}

function transferExecution(token: Address, to: Address, amount: bigint): ActionExecution {
  return {
    target: token,
    value: "0",
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [to, amount],
    }),
  };
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      grant: { type: "string" },
      executions: { type: "string" },
      "chain-id": { type: "string" },
      spend: { type: "string" },
      "rpc-url": { type: "string" },
      memo: { type: "string" },
      "destination-url": { type: "string" },
    },
    strict: true,
  });

  const grantPath = values.grant ?? fail("Pass --grant path/to/user-grant.json");
  const executionsPath = values.executions ?? fail("Pass --executions path/to/action.json");
  const chainIdArg = values["chain-id"] ?? fail("Pass --chain-id (decimal).");
  const spendArg = values.spend ?? fail("Pass --spend as a decimal in token units (for example 5 for 5 USDC).");
  const rpcUrl = values["rpc-url"] ?? process.env.RPC_URL ?? fail("Pass --rpc-url or set RPC_URL.");
  const chainId = Number(chainIdArg);
  if (!Number.isInteger(chainId) || chainId <= 0) fail("--chain-id must be a positive integer.");
  const chainIdString = String(chainId);

  const privateKey = readPrivateKey();
  const agent = privateKeyToAccount(privateKey);
  const grant = loadGrant(grantPath);
  const actions = loadActions(executionsPath);

  if (!isAddressEqual(grant.delegate, agent.address)) {
    fail(`Grant delegate ${grant.delegate} is not this agent ${agent.address}.`);
  }
  if (grant.authority.toLowerCase() !== ROOT_AUTHORITY.toLowerCase()) {
    fail("Grant authority must be the root authority. This script redeems [redelegation, userGrant] only.");
  }
  if (!isHex(grant.signature) || grant.signature.length <= 2) {
    fail("Grant signature is missing.");
  }

  const environment = getSmartAccountsEnvironment(chainId);
  const periodEnforcer = environment.caveatEnforcers.ERC20PeriodTransferEnforcer;
  const delegatorImpl = environment.implementations.EIP7702StatelessDeleGatorImpl;
  if (!periodEnforcer || !delegatorImpl) {
    fail(`Chain ${chainId} is missing ERC20PeriodTransferEnforcer or EIP7702StatelessDeleGatorImpl in the kit environment.`);
  }

  const periodCaveats = grant.caveats.filter((caveat) =>
    isAddressEqual(caveat.enforcer, periodEnforcer),
  );
  if (periodCaveats.length !== 1) {
    fail(
      `Expected one ERC20PeriodTransferEnforcer caveat (${periodEnforcer}), found ${periodCaveats.length}.`,
    );
  }
  const terms = periodCaveats[0]!.terms;
  if (!isHex(terms) || (terms.length - 2) / 2 !== PERIOD_TERMS_BYTES) {
    fail(`Period terms must be ${PERIOD_TERMS_BYTES} bytes.`);
  }
  const token = getAddress(`0x${terms.slice(2, 42)}`);

  const publicClient = createPublicClient({ transport: http(rpcUrl) });
  const [userCode, agentCode] = await Promise.all([
    publicClient.getCode({ address: grant.delegator }),
    publicClient.getCode({ address: agent.address }),
  ]);
  const userImpl = delegatedImplementation(userCode);
  if (!userImpl || !isAddressEqual(userImpl, delegatorImpl)) {
    fail(
      `User ${grant.delegator} is not an EIP7702StatelessDeleGator (${delegatorImpl}). The request allows one authorization, and that slot is the agent's.`,
    );
  }
  const agentImpl = delegatedImplementation(agentCode);
  if (agentImpl && !isAddressEqual(agentImpl, delegatorImpl)) {
    fail(`Agent code delegates to ${agentImpl}, not ${delegatorImpl}.`);
  }

  const delegationHash = hashDelegation(grant);
  const availableResult = await publicClient.readContract({
    address: periodEnforcer,
    abi: [
      {
        type: "function",
        name: "getAvailableAmount",
        stateMutability: "view",
        inputs: [
          { name: "delegationHash", type: "bytes32" },
          { name: "delegationManager", type: "address" },
          { name: "terms", type: "bytes" },
        ],
        outputs: [
          { name: "availableAmount", type: "uint256" },
          { name: "isNewPeriod", type: "bool" },
          { name: "currentPeriod", type: "uint256" },
        ],
      },
    ] as const,
    functionName: "getAvailableAmount",
    args: [delegationHash, environment.DelegationManager, terms],
  });
  const available = availableResult[0];
  process.stderr.write(
    `availableAmount=${available} isNewPeriod=${availableResult[1]} currentPeriod=${availableResult[2]}\n`,
  );
  if (available === 0n) {
    fail("Available amount is 0. The period has not started, or this period's allowance is spent.");
  }

  const relayerUrl = relayerUrlForChain(chainIdString);
  const capabilities = await rpc<Record<string, Capability>>(relayerUrl, "relayer_getCapabilities", [
    chainIdString,
  ]);
  const caps = capabilities[chainIdString];
  if (!caps?.targetAddress || !caps.feeCollector) {
    fail(`relayer_getCapabilities has no targetAddress or feeCollector for chain ${chainIdString}.`);
  }
  const paymentToken = caps.tokens.find((entry) => isAddressEqual(getAddress(entry.address), token));
  if (!paymentToken) {
    fail(`Granted token ${token} is not a relayer payment token on chain ${chainIdString}.`);
  }
  const decimals = Number(paymentToken.decimals);
  if (!Number.isInteger(decimals) || decimals < 0) fail("Payment token decimals are missing.");

  let requestedSpend: bigint;
  try {
    requestedSpend = parseUnits(spendArg, decimals);
  } catch {
    fail(`--spend must be a decimal in token units, not atoms. Received "${spendArg}".`);
  }
  if (requestedSpend <= 0n) fail("--spend must be positive.");

  const feeData = await rpc<FeeData>(relayerUrl, "relayer_getFeeData", {
    chainId: chainIdString,
    token,
  });
  const minFee = BigInt(feeData.minFee);
  if (minFee <= 0n) fail("relayer_getFeeData returned a non-positive minFee.");
  if (requestedSpend + minFee > available) {
    budgetExceeded({
      available,
      fee: minFee,
      requested: requestedSpend,
      feeBasis: "minFee",
    });
  }

  const targetAddress = getAddress(caps.targetAddress);
  const feeCollector = getAddress(caps.feeCollector);
  // Built by hand so caveats stay empty on kit 1.3 (createDelegation there requires a scope)
  // and kit 2.x (where parentDelegation alone would produce the same struct).
  const redelegation: Omit<Delegation, "signature"> = {
    delegate: targetAddress,
    delegator: agent.address,
    authority: hashDelegation(grant),
    caveats: [],
    salt: toHex(randomBytes(32)),
  };
  const redelegationSignature = await signDelegation({
    privateKey,
    delegation: redelegation,
    delegationManager: environment.DelegationManager,
    chainId,
    allowInsecureUnrestrictedDelegation: true,
  });
  const signedRedelegation = { ...redelegation, signature: redelegationSignature };

  let signedAgentDelegation: Delegation | undefined;
  if (actions.length > 0) {
    const agentCaveats = createCaveatBuilder(environment)
      .addCaveat("limitedCalls", { limit: actions.length })
      .build();
    const agentDelegation: Omit<Delegation, "signature"> = {
      delegate: targetAddress,
      delegator: agent.address,
      authority: ROOT_AUTHORITY,
      caveats: agentCaveats,
      salt: toHex(randomBytes(32)),
    };
    const agentSignature = await signDelegation({
      privateKey,
      delegation: agentDelegation,
      delegationManager: environment.DelegationManager,
      chainId,
    });
    signedAgentDelegation = { ...agentDelegation, signature: agentSignature };
  }

  let authorizationList: SendParams["authorizationList"];
  if (!agentImpl) {
    const nonce = await publicClient.getTransactionCount({
      address: agent.address,
      blockTag: "pending",
    });
    const authorization = await agent.signAuthorization({
      chainId,
      contractAddress: delegatorImpl,
      nonce,
    });
    authorizationList = [
      {
        address: authorization.address,
        chainId: Number(authorization.chainId),
        nonce: Number(authorization.nonce),
        r: authorization.r,
        s: authorization.s,
        yParity: authorization.yParity ?? 0,
      },
    ];
  }

  const userContext = (spend: bigint, fee: bigint) => [
    transferExecution(token, agent.address, spend),
    transferExecution(token, feeCollector, fee),
  ];

  const buildParams = (spend: bigint, fee: bigint): SendParams => {
    const transactions: SendParams["transactions"] = [
      {
        permissionContext: [toRelayerJson(signedRedelegation), toRelayerJson(grant)] as unknown[],
        executions: userContext(spend, fee),
      },
    ];
    if (signedAgentDelegation) {
      transactions.push({
        permissionContext: [toRelayerJson(signedAgentDelegation)] as unknown[],
        executions: actions,
      });
    }
    return {
      chainId: chainIdString,
      transactions,
      ...(authorizationList ? { authorizationList } : {}),
    };
  };

  const estimate = await rpc<EstimateResult>(
    relayerUrl,
    "relayer_estimate7710Transaction",
    buildParams(requestedSpend, minFee),
  );
  if (!estimate.success) fail(estimate.error ?? "relayer_estimate7710Transaction failed.");
  if (!estimate.requiredPaymentAmount || !estimate.context) {
    fail("Estimate succeeded without requiredPaymentAmount or context.");
  }
  const fee = BigInt(estimate.requiredPaymentAmount);
  if (fee < minFee) fail(`requiredPaymentAmount ${fee} is below minFee ${minFee}.`);
  if (requestedSpend + fee > available) {
    budgetExceeded({
      available,
      fee,
      requested: requestedSpend,
      feeBasis: "requiredPaymentAmount",
    });
  }
  if (fee !== minFee) {
    process.stderr.write(`Patching fee from minFee ${minFee} to requiredPaymentAmount ${fee} without re-signing.\n`);
  }

  const taskId = await rpc<string>(relayerUrl, "relayer_send7710Transaction", {
    ...buildParams(requestedSpend, fee),
    context: estimate.context,
    ...(values.memo ? { memo: values.memo } : {}),
    ...(values["destination-url"] ? { destinationUrl: values["destination-url"] } : {}),
  });

  process.stdout.write(
    `${JSON.stringify({
      status: "submitted",
      taskId,
      chainId: chainIdString,
      spend: requestedSpend.toString(),
      fee: fee.toString(),
    })}\n`,
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  fail(message);
});
