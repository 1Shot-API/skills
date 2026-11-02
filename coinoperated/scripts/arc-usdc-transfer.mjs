#!/usr/bin/env node
/**
 * End-to-end Arc USDC spend via agent-wallet + public relayer (CoinOperated Path D2).
 *
 * Direct payment (user said "send $1 to 0x…"):
 *   node arc-usdc-transfer.mjs --parent ../parent.json --to 0xRecipient --amount 1
 *
 * Pull to agent (default --to = agent address):
 *   node arc-usdc-transfer.mjs --parent ../parent.json --amount 5
 *
 * Prerequisites:
 *   - Linked additional signer + parent.json (raw delegation JSON string/object)
 *   - Sibling skill: ../agent-wallet/scripts with `npm install` done
 *   - CO_SIGNER_NONCE + agent address for Agent Activity memo (optional)
 *
 * Does not print private keys. Run from this scripts/ directory or pass absolute paths.
 */

import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RELAYER_URL = process.env.RELAYER_URL ?? "https://relayer.1shotapi.com/relayers";
const ARC_RPC = process.env.ARC_RPC ?? "https://rpc.mainnet.arc.io";
const CHAIN_ID = "5042";
const WEBHOOK = "https://coinoperated.finance/api/webhooks/relayer";
const USDC_FALLBACK = "0x3600000000000000000000000000000000000000"; // overridden by capabilities

function die(msg, code = 1) {
  console.error(JSON.stringify({ ok: false, error: msg }));
  process.exit(code);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function findAw() {
  const env = process.env.AGENT_WALLET_AW;
  if (env && fs.existsSync(env)) return env;
  const sibling = path.resolve(__dirname, "../../agent-wallet/scripts/aw.mjs");
  if (fs.existsSync(sibling)) return sibling;
  const cursor = path.join(
    process.env.USERPROFILE || process.env.HOME || "",
    ".cursor",
    "skills",
    "agent-wallet",
    "scripts",
    "aw.mjs",
  );
  if (fs.existsSync(cursor)) return cursor;
  die("agent-wallet aw.mjs not found. Set AGENT_WALLET_AW or install sibling skill.");
}

function aw(awPath, args) {
  const cwd = path.dirname(awPath);
  const r = spawnSync(process.execPath, [awPath, ...args], {
    encoding: "utf8",
    cwd,
    windowsHide: true,
  });
  const line = (r.stdout || "")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .pop();
  if (r.status !== 0) {
    die(`aw ${args[0]} failed: ${r.stderr || r.stdout || `exit ${r.status}`}`);
  }
  try {
    return JSON.parse(line);
  } catch {
    die(`aw ${args[0]} returned non-JSON: ${r.stdout}`);
  }
}

async function rpc(method, params, { retries = 3 } = {}) {
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(RELAYER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json)}`);
      if (json.error) {
        throw new Error(`[${json.error.code}] ${json.error.message}`);
      }
      return json.result;
    } catch (e) {
      lastErr = e;
      const msg = String(e?.message || e);
      const transient =
        /ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed|socket|HTTP 50[23]/i.test(msg);
      if (!transient || i === retries - 1) throw e;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastErr;
}

function toRelayerJson(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return `0x${value.toString(16)}`;
  if (Array.isArray(value)) return value.map(toRelayerJson);
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = toRelayerJson(v);
    return out;
  }
  return value;
}

function encodeErc20Transfer(to, amountAtoms) {
  const sel = "a9059cbb";
  const addr = String(to).replace(/^0x/i, "").toLowerCase().padStart(64, "0");
  const amt = BigInt(amountAtoms).toString(16).padStart(64, "0");
  return `0x${sel}${addr}${amt}`;
}

function parseAmountAtoms(human, decimals) {
  const s = String(human).trim();
  if (!s.includes(".")) return BigInt(s) * 10n ** BigInt(decimals);
  const [whole, frac = ""] = s.split(".");
  const f = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(f || "0");
}

function randomSalt() {
  return `0x${crypto.randomBytes(32).toString("hex")}`;
}

function loadParent(file) {
  const raw = fs.readFileSync(file, "utf8").trim();
  const parsed = JSON.parse(raw);
  return parsed.signedDelegation ?? parsed.delegation ?? parsed;
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help || flags.h) {
    console.log(`Usage: node arc-usdc-transfer.mjs --parent parent.json --amount 1 [--to 0x…] [--max-fee 0.05]
  --parent     Signed parent delegation JSON (CoinOperated delegation string written once)
  --amount     Human USDC amount to transfer (e.g. 1 or 1.5)
  --to         Recipient (default: agent address = pull-to-self)
  --max-fee    Abort if estimate requiredPaymentAmount exceeds this human USDC amount
  --skip-auth  Skip auth7702 (agent already upgraded on Arc)
Env: RELAYER_URL, ARC_RPC, APP_DELEGATION_SECRET, CO_SIGNER_NONCE, AGENT_WALLET_AW`);
    process.exit(0);
  }

  if (!flags.parent || flags.amount === undefined) {
    die("Required: --parent <file> --amount <humanUsdc>");
  }

  const awPath = findAw();
  const agent = aw(["address"]);
  const agentAddress = agent.address;
  const to = flags.to && flags.to !== true ? String(flags.to) : agentAddress;
  const parentPath = path.resolve(String(flags.parent));
  const parent = loadParent(parentPath);

  const caps = await rpc("relayer_getCapabilities", [CHAIN_ID]);
  const chainCaps = caps[CHAIN_ID];
  if (!chainCaps) die(`No capabilities for chain ${CHAIN_ID}`);
  const { targetAddress, feeCollector, tokens } = chainCaps;
  const usdc =
    tokens.find((t) => String(t.symbol).toUpperCase() === "USDC") ??
    tokens.find((t) => t.address?.toLowerCase() === USDC_FALLBACK.toLowerCase()) ??
    tokens[0];
  if (!usdc) die("No payment token in capabilities");
  const decimals = Number(usdc.decimals ?? 6);
  const workAtoms = parseAmountAtoms(flags.amount, decimals);
  const mockFeeAtoms = parseAmountAtoms("0.01", decimals);
  const maxFeeAtoms =
    flags["max-fee"] && flags["max-fee"] !== true
      ? parseAmountAtoms(flags["max-fee"], decimals)
      : null;

  let authorization;
  if (!flags["skip-auth"]) {
    const auth = aw([
      "auth7702",
      "--rpc",
      ARC_RPC,
      "--chain-id",
      CHAIN_ID,
    ]);
    authorization = auth.authorization;
  }

  const childInput = {
    chainId: Number(CHAIN_ID),
    to: targetAddress,
    scope: {
      type: "erc20TransferAmount",
      tokenAddress: usdc.address,
      maxAmount: (mockFeeAtoms + workAtoms).toString(),
    },
    salt: randomSalt(),
  };
  const childPath = path.join(__dirname, `.child-${process.pid}.json`);
  fs.writeFileSync(childPath, JSON.stringify(childInput, null, 2));
  let child;
  try {
    const redelegated = aw([
      "redelegate",
      "--parent",
      parentPath,
      "--file",
      childPath,
    ]);
    child = redelegated.signedDelegation;
  } finally {
    try {
      fs.rmSync(childPath, { force: true });
    } catch {
      // ignore
    }
  }

  if (String(child.delegate).toLowerCase() !== String(targetAddress).toLowerCase()) {
    die(`Child delegate ${child.delegate} !== targetAddress ${targetAddress}`);
  }

  const permissionContext = [toRelayerJson(child), toRelayerJson(parent)];

  function buildParams(feeAtoms) {
    return {
      chainId: CHAIN_ID,
      ...(authorization ? { authorizationList: [authorization] } : {}),
      transactions: [
        {
          permissionContext,
          executions: [
            {
              target: usdc.address,
              value: "0",
              data: encodeErc20Transfer(feeCollector, feeAtoms),
            },
            {
              target: usdc.address,
              value: "0",
              data: encodeErc20Transfer(to, workAtoms),
            },
          ],
        },
      ],
    };
  }

  let sendParams = buildParams(mockFeeAtoms);
  let estimate = await rpc("relayer_estimate7710Transaction", sendParams);
  if (!estimate?.success) {
    die(`estimate failed: ${estimate?.error ?? JSON.stringify(estimate)}`);
  }

  const required = BigInt(estimate.requiredPaymentAmount);
  if (maxFeeAtoms != null && required > maxFeeAtoms) {
    die(
      `required fee ${required} atoms exceeds --max-fee cap ${maxFeeAtoms} atoms`,
    );
  }

  if (required !== mockFeeAtoms) {
    // Re-sign child with tighter/looser maxAmount, then re-estimate under fee cap
    childInput.scope.maxAmount = (required + workAtoms).toString();
    childInput.salt = randomSalt();
    fs.writeFileSync(childPath, JSON.stringify(childInput, null, 2));
    try {
      const redelegated = aw([
        "redelegate",
        "--parent",
        parentPath,
        "--file",
        childPath,
      ]);
      child = redelegated.signedDelegation;
    } finally {
      try {
        fs.rmSync(childPath, { force: true });
      } catch {
        // ignore
      }
    }
    sendParams = {
      ...buildParams(required),
      transactions: [
        {
          permissionContext: [toRelayerJson(child), toRelayerJson(parent)],
          executions: buildParams(required).transactions[0].executions,
        },
      ],
    };
    estimate = await rpc("relayer_estimate7710Transaction", sendParams);
    if (!estimate?.success) {
      die(`re-estimate failed: ${estimate?.error ?? JSON.stringify(estimate)}`);
    }
    const required2 = BigInt(estimate.requiredPaymentAmount);
    if (maxFeeAtoms != null && required2 > maxFeeAtoms) {
      die(`re-estimate fee ${required2} exceeds --max-fee`);
    }
  }

  const signerNonce = process.env.CO_SIGNER_NONCE;
  const memo =
    signerNonce &&
    JSON.stringify({
      source: "coinoperated",
      signerAddress: agentAddress,
      nonce: signerNonce,
      justification:
        to.toLowerCase() === agentAddress.toLowerCase()
          ? `Pull ${flags.amount} USDC to agent`
          : `Send ${flags.amount} USDC to ${to}`,
    });

  const taskId = await rpc("relayer_send7710Transaction", {
    ...sendParams,
    context: estimate.context,
    destinationUrl: WEBHOOK,
    ...(memo && memo.length <= 256 ? { memo } : {}),
    ...(process.env.APP_DELEGATION_SECRET
      ? { delegationSecret: process.env.APP_DELEGATION_SECRET }
      : {}),
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        taskId,
        chainId: CHAIN_ID,
        to,
        amountAtoms: workAtoms.toString(),
        feeAtoms: estimate.requiredPaymentAmount,
        path:
          to.toLowerCase() === agentAddress.toLowerCase()
            ? "pull-to-agent"
            : "direct-transfer",
      },
      null,
      2,
    ),
  );
}

main().catch((e) => die(e?.message || String(e)));
