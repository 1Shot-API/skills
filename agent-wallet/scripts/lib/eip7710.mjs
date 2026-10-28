/**
 * EIP-7710 / EIP-7702 helpers. Private keys stay in-process — never log them.
 */

import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  createDelegation,
  getSmartAccountsEnvironment,
  signDelegation,
} from "@metamask/smart-accounts-kit";

import { decryptPrivateKeyHex, getAddress } from "./keystore.mjs";
import { defaultWalletHome } from "./paths.mjs";

function assertAddress(label, value) {
  if (typeof value !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    throw Object.assign(new Error(`${label} must be a 0x-prefixed 20-byte address`), {
      code: "BAD_ARGS",
    });
  }
}

function assertChainId(chainId) {
  const n = Number(chainId);
  if (!Number.isInteger(n) || n <= 0) {
    throw Object.assign(new Error("chainId must be a positive integer"), {
      code: "BAD_ARGS",
    });
  }
  return n;
}

/**
 * Input schema for delegation-create / delegation-sign:
 * {
 *   chainId: number,
 *   to: "0x…",           // delegate
 *   scope: { type, … },  // kit ScopeConfig
 *   caveats?: […],
 *   salt?: "0x…",
 *   from?: "0x…",        // optional override; default = wallet address
 *   parentDelegation?: { … signed Delegation }
 * }
 */
export function buildUnsignedDelegation(input, fromAddress) {
  const chainId = assertChainId(input.chainId);
  assertAddress("to", input.to);
  if (!input.scope || typeof input.scope !== "object") {
    throw Object.assign(new Error("scope is required (kit ScopeConfig object)"), {
      code: "BAD_ARGS",
    });
  }

  const from = input.from ?? fromAddress;
  assertAddress("from", from);

  let environment;
  try {
    environment = getSmartAccountsEnvironment(chainId);
  } catch (e) {
    throw Object.assign(
      new Error(`getSmartAccountsEnvironment(${chainId}) failed: ${e.message}`),
      { code: "RUNTIME" },
    );
  }

  const params = {
    from,
    to: input.to,
    environment,
    scope: input.scope,
  };
  if (input.caveats !== undefined) {
    params.caveats = input.caveats;
  }
  if (input.salt !== undefined) {
    params.salt = input.salt;
  }
  if (input.parentDelegation !== undefined) {
    validateSignedDelegation(input.parentDelegation, "parentDelegation");
    params.parentDelegation = input.parentDelegation;
  }

  try {
    return { delegation: createDelegation(params), chainId, environment };
  } catch (e) {
    throw Object.assign(new Error(`createDelegation failed: ${e.message}`), {
      code: "RUNTIME",
    });
  }
}

export function validateSignedDelegation(d, label = "delegation") {
  if (!d || typeof d !== "object") {
    throw Object.assign(new Error(`${label} must be an object`), { code: "BAD_ARGS" });
  }
  for (const key of ["delegate", "delegator", "authority", "caveats", "salt", "signature"]) {
    if (d[key] === undefined) {
      throw Object.assign(new Error(`${label} missing required field: ${key}`), {
        code: "BAD_ARGS",
      });
    }
  }
  if (typeof d.signature !== "string" || !d.signature.startsWith("0x") || d.signature.length < 130) {
    throw Object.assign(
      new Error(`${label}.signature must be a signed hex string (fully signed parent required)`),
      { code: "BAD_ARGS" },
    );
  }
}

export async function signDelegationWithWallet(home, name, input) {
  const from = getAddress(home, name);
  const { delegation, chainId, environment } = buildUnsignedDelegation(input, from);

  const privateKey = await decryptPrivateKeyHex(home, name);
  try {
    const signature = await signDelegation({
      privateKey,
      delegation,
      chainId,
      delegationManager: environment.DelegationManager,
    });
    return { signedDelegation: { ...delegation, signature }, chainId };
  } finally {
    // best-effort: drop reference (GC); never log
  }
}

export async function createAndSignDelegation(home, name, input) {
  return signDelegationWithWallet(home, name, input);
}

export async function redelegate(home, name, parentDelegation, input) {
  validateSignedDelegation(parentDelegation, "parentDelegation");
  return signDelegationWithWallet(home, name, {
    ...input,
    parentDelegation,
  });
}

/**
 * Sign an EIP-7702 authorization for Stateless7702 impl.
 * Does not broadcast — redemption needs a relayer/bundler.
 */
export async function signAuth7702({ home, name, rpc, chainId }) {
  const cid = assertChainId(chainId);
  if (!rpc || typeof rpc !== "string") {
    throw Object.assign(new Error("--rpc is required"), { code: "BAD_ARGS" });
  }

  let environment;
  try {
    environment = getSmartAccountsEnvironment(cid);
  } catch (e) {
    throw Object.assign(
      new Error(`getSmartAccountsEnvironment(${cid}) failed: ${e.message}`),
      { code: "RUNTIME" },
    );
  }

  const contractAddress = environment.implementations?.EIP7702StatelessDeleGatorImpl;
  if (!contractAddress) {
    throw Object.assign(
      new Error(`No EIP7702StatelessDeleGatorImpl for chainId ${cid}`),
      { code: "RUNTIME" },
    );
  }

  const privateKey = await decryptPrivateKeyHex(home, name);
  const account = privateKeyToAccount(privateKey);

  // Minimal chain object for walletClient
  const chain = {
    id: cid,
    name: `chain-${cid}`,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpc] } },
  };

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpc),
  });

  // Public client optional — signAuthorization works offline for self-executor
  createPublicClient({ chain, transport: http(rpc) });

  try {
    const authorization = await walletClient.signAuthorization({
      account,
      contractAddress,
      executor: "self",
    });
    return {
      authorization,
      contractAddress,
      address: account.address,
      chainId: cid,
    };
  } catch (e) {
    throw Object.assign(new Error(`signAuthorization failed: ${e.message}`), {
      code: "RUNTIME",
    });
  }
}

export { defaultWalletHome };
