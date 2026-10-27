#!/usr/bin/env node
/**
 * agent-wallet CLI — non-interactive Foundry keystore + EIP-7710 helpers.
 * JSON on stdout; diagnostics on stderr; never print private key / mnemonic / password.
 *
 * Usage: node aw.mjs <command> [flags]
 */

import fs from "node:fs";
import path from "node:path";

import { loadJson, parseArgs, rejectUnknown, requireFlags } from "./lib/args.mjs";
import { castVersion, findCast, runCast } from "./lib/cast.mjs";
import { EXIT, fail, ok } from "./lib/json.mjs";
import {
  createWallet,
  getAddress,
  walletExists,
} from "./lib/keystore.mjs";
import {
  accountPaths,
  defaultWalletHome,
  depsInstalled,
  resolveAccountName,
  scriptsDir,
} from "./lib/paths.mjs";

const COMMANDS = [
  "doctor",
  "create",
  "address",
  "sign-personal",
  "sign-hash",
  "sign-typed",
  "send",
  "mktx",
  "auth7702",
  "delegation-create",
  "delegation-sign",
  "redelegate",
  "help",
];

function helpText() {
  return `agent-wallet (aw) — non-interactive agent keystore CLI

Usage: node aw.mjs <command> [flags]

Commands:
  doctor                 Detect cast, node, wallet, deps
  create                 Create encrypted keystore (--name, --force)
  address                Print wallet address (--name)
  sign-personal          EIP-191 personal_sign (--message)
  sign-hash              Sign raw hash (--hash, cast --no-hash)
  sign-typed             Sign EIP-712 typed data (--file)
  send                   Broadcast tx (--rpc --to [--value] [--data] [--chain-id])
  mktx                   Signed raw tx without broadcast (same flags as send)
  auth7702               Sign EIP-7702 Stateless7702 authorization (--rpc --chain-id)
  delegation-create      Build unsigned EIP-7710 delegation (--file)
  delegation-sign        Sign EIP-7710 delegation (--file)
  redelegate             Redelegate from signed parent (--parent --file)

Global:
  --name <account>       Account name (default: agent)
  --home <dir>           Override AGENT_WALLET_HOME
  --help                 Show this help

Never prints private keys, mnemonics, or passwords.
See ../references/ for storage, casting, security, and EIP-7710 docs.
`;
}

function mapErr(e) {
  const msg = e?.message || String(e);
  const code = e?.code;
  if (code === "MISSING_CAST" || code === "MISSING_DEPS") {
    fail(EXIT.MISSING_DEPS, msg);
  }
  if (code === "NO_WALLET") {
    fail(EXIT.NO_WALLET, msg);
  }
  if (code === "BAD_ARGS") {
    fail(EXIT.BAD_ARGS, msg);
  }
  fail(EXIT.RUNTIME, msg);
}

function homeFromFlags(flags) {
  if (flags.home) {
    return path.resolve(String(flags.home));
  }
  return defaultWalletHome();
}

function nameFromFlags(flags) {
  return resolveAccountName(flags.name === true ? "agent" : flags.name);
}

function keystoreFlags(home, name) {
  return accountPaths(home, name);
}

function ensureCast() {
  const cast = findCast();
  if (!cast) {
    fail(
      EXIT.MISSING_DEPS,
      "cast not found. Install Foundry: curl -L https://foundry.paradigm.xyz | bash && foundryup  (https://getfoundry.sh)",
    );
  }
  return cast;
}

function cmdDoctor(flags) {
  rejectUnknown(flags, new Set(["name", "home", "help"]));
  const home = homeFromFlags(flags);
  const name = nameFromFlags(flags);
  const cast = findCast();
  const version = cast ? castVersion(cast) : null;
  const exists = walletExists(home, name);
  let address;
  if (exists && cast) {
    try {
      address = getAddress(home, name);
    } catch {
      address = undefined;
    }
  }
  const depsOk = depsInstalled();
  ok({
    cast: cast ? { path: cast, version } : null,
    node: process.version,
    platform: process.platform,
    home,
    name,
    wallet: exists,
    address: address ?? null,
    storageTier: "keystore+password-file",
    depsOk,
    depsInstallHint: depsOk
      ? null
      : `cd ${scriptsDir()} && npm install`,
    foundryHint: cast
      ? null
      : "Install Foundry: https://getfoundry.sh then run foundryup",
  });
}

function cmdCreate(flags) {
  rejectUnknown(flags, new Set(["name", "home", "force", "help"]));
  try {
    const result = createWallet({
      home: homeFromFlags(flags),
      name: nameFromFlags(flags),
      force: Boolean(flags.force),
    });
    ok({
      address: result.address,
      name: result.name,
      keystorePath: result.keystorePath,
      storageTier: result.storageTier,
      created: result.created,
    });
  } catch (e) {
    mapErr(e);
  }
}

function cmdAddress(flags) {
  rejectUnknown(flags, new Set(["name", "home", "help"]));
  try {
    const address = getAddress(homeFromFlags(flags), nameFromFlags(flags));
    ok({ address });
  } catch (e) {
    mapErr(e);
  }
}

function signWithCast(home, name, messageArgs) {
  const cast = ensureCast();
  const { keystorePath, passwordPath } = keystoreFlags(home, name);
  if (!fs.existsSync(keystorePath) || !fs.existsSync(passwordPath)) {
    fail(EXIT.NO_WALLET, `Wallet not found for name=${name} under ${home}`);
  }
  const r = runCast(cast, [
    "wallet",
    "sign",
    ...messageArgs,
    "--keystore",
    keystorePath,
    "--password-file",
    passwordPath,
  ]);
  if (r.status !== 0) {
    fail(EXIT.RUNTIME, r.stderr || r.stdout || "cast wallet sign failed");
  }
  const signature = r.stdout
    .split(/\r?\n/)
    .map((s) => s.trim())
    .find((s) => s.startsWith("0x"));
  if (!signature) {
    fail(EXIT.RUNTIME, "cast did not return a signature");
  }
  return signature;
}

function cmdSignPersonal(flags) {
  rejectUnknown(flags, new Set(["name", "home", "message", "help"]));
  requireFlags(flags, ["message"]);
  try {
    const signature = signWithCast(homeFromFlags(flags), nameFromFlags(flags), [
      String(flags.message),
    ]);
    ok({ signature });
  } catch (e) {
    if (e?.code) mapErr(e);
    fail(EXIT.RUNTIME, e.message);
  }
}

function cmdSignHash(flags) {
  rejectUnknown(flags, new Set(["name", "home", "hash", "help"]));
  requireFlags(flags, ["hash"]);
  const hash = String(flags.hash);
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) {
    fail(EXIT.BAD_ARGS, "--hash must be 0x + 32 bytes hex");
  }
  try {
    const signature = signWithCast(homeFromFlags(flags), nameFromFlags(flags), [
      hash,
      "--no-hash",
    ]);
    ok({ signature });
  } catch (e) {
    if (e?.code) mapErr(e);
    fail(EXIT.RUNTIME, e.message);
  }
}

function cmdSignTyped(flags) {
  rejectUnknown(flags, new Set(["name", "home", "file", "help"]));
  requireFlags(flags, ["file"]);
  const file = path.resolve(String(flags.file));
  if (!fs.existsSync(file)) {
    fail(EXIT.BAD_ARGS, `Typed data file not found: ${file}`);
  }
  try {
    const signature = signWithCast(homeFromFlags(flags), nameFromFlags(flags), [
      "--data",
      "--from-file",
      file,
    ]);
    ok({ signature });
  } catch (e) {
    if (e?.code) mapErr(e);
    fail(EXIT.RUNTIME, e.message);
  }
}

function buildSendArgs(flags, { broadcast }) {
  requireFlags(flags, ["rpc", "to"]);
  const cast = ensureCast();
  const home = homeFromFlags(flags);
  const name = nameFromFlags(flags);
  const { keystorePath, passwordPath } = keystoreFlags(home, name);
  if (!fs.existsSync(keystorePath) || !fs.existsSync(passwordPath)) {
    fail(EXIT.NO_WALLET, `Wallet not found for name=${name} under ${home}`);
  }

  const args = [
    broadcast ? "send" : "mktx",
    String(flags.to),
    ...(flags.data ? [String(flags.data)] : []),
    "--keystore",
    keystorePath,
    "--password-file",
    passwordPath,
    "--rpc-url",
    String(flags.rpc),
  ];
  if (flags.value !== undefined && flags.value !== true) {
    args.push("--value", String(flags.value));
  }
  if (flags["chain-id"] !== undefined && flags["chain-id"] !== true) {
    args.push("--chain", String(flags["chain-id"]));
  }
  if (!broadcast) {
    // cast mktx uses same shape
  }
  return { cast, args };
}

function cmdSend(flags) {
  rejectUnknown(
    flags,
    new Set(["name", "home", "rpc", "to", "value", "data", "chain-id", "help"]),
  );
  try {
    const { cast, args } = buildSendArgs(flags, { broadcast: true });
    const r = runCast(cast, args);
    if (r.status !== 0) {
      fail(EXIT.RUNTIME, r.stderr || r.stdout || "cast send failed");
    }
    const txHash = r.stdout
      .split(/\r?\n/)
      .map((s) => s.trim())
      .find((s) => /^0x[a-fA-F0-9]{64}$/.test(s));
    if (!txHash) {
      // cast may print verbose output — take last 0x64 hex
      const all = [...r.stdout.matchAll(/0x[a-fA-F0-9]{64}/g)].map((m) => m[0]);
      if (all.length === 0) {
        fail(EXIT.RUNTIME, `cast send succeeded but no tx hash found: ${r.stdout}`);
      }
      ok({ txHash: all[all.length - 1], raw: r.stdout });
      return;
    }
    ok({ txHash });
  } catch (e) {
    if (e?.code) mapErr(e);
    fail(EXIT.RUNTIME, e.message);
  }
}

function cmdMktx(flags) {
  rejectUnknown(
    flags,
    new Set(["name", "home", "rpc", "to", "value", "data", "chain-id", "help"]),
  );
  try {
    const { cast, args } = buildSendArgs(flags, { broadcast: false });
    const r = runCast(cast, args);
    if (r.status !== 0) {
      fail(EXIT.RUNTIME, r.stderr || r.stdout || "cast mktx failed");
    }
    const rawTransaction = r.stdout
      .split(/\r?\n/)
      .map((s) => s.trim())
      .find((s) => s.startsWith("0x") && s.length > 68);
    if (!rawTransaction) {
      fail(EXIT.RUNTIME, `cast mktx did not return raw tx: ${r.stdout}`);
    }
    ok({ rawTransaction });
  } catch (e) {
    if (e?.code) mapErr(e);
    fail(EXIT.RUNTIME, e.message);
  }
}

async function ensureDeps() {
  if (!depsInstalled()) {
    fail(
      EXIT.MISSING_DEPS,
      `Node deps missing. Run: cd ${scriptsDir()} && npm install`,
    );
  }
}

async function cmdAuth7702(flags) {
  rejectUnknown(flags, new Set(["name", "home", "rpc", "chain-id", "help"]));
  requireFlags(flags, ["rpc", "chain-id"]);
  await ensureDeps();
  const { signAuth7702 } = await import("./lib/eip7710.mjs");
  try {
    const result = await signAuth7702({
      home: homeFromFlags(flags),
      name: nameFromFlags(flags),
      rpc: String(flags.rpc),
      chainId: flags["chain-id"],
    });
    ok({
      authorization: result.authorization,
      contractAddress: result.contractAddress,
      address: result.address,
      chainId: result.chainId,
    });
  } catch (e) {
    mapErr(e);
  }
}

async function cmdDelegationCreate(flags) {
  rejectUnknown(flags, new Set(["name", "home", "file", "help"]));
  requireFlags(flags, ["file"]);
  await ensureDeps();
  const input = loadJson(path.resolve(String(flags.file)));
  const { buildUnsignedDelegation } = await import("./lib/eip7710.mjs");
  try {
    const home = homeFromFlags(flags);
    const name = nameFromFlags(flags);
    const from = getAddress(home, name);
    const { delegation, chainId } = buildUnsignedDelegation(input, from);
    ok({ delegation, chainId });
  } catch (e) {
    mapErr(e);
  }
}

async function cmdDelegationSign(flags) {
  rejectUnknown(flags, new Set(["name", "home", "file", "help"]));
  requireFlags(flags, ["file"]);
  await ensureDeps();
  const input = loadJson(path.resolve(String(flags.file)));
  const { createAndSignDelegation } = await import("./lib/eip7710.mjs");
  try {
    const { signedDelegation, chainId } = await createAndSignDelegation(
      homeFromFlags(flags),
      nameFromFlags(flags),
      input,
    );
    ok({ signedDelegation, chainId });
  } catch (e) {
    mapErr(e);
  }
}

async function cmdRedelegate(flags) {
  rejectUnknown(flags, new Set(["name", "home", "file", "parent", "help"]));
  requireFlags(flags, ["file", "parent"]);
  await ensureDeps();
  const input = loadJson(path.resolve(String(flags.file)));
  const parent = loadJson(path.resolve(String(flags.parent)));
  const parentDelegation = parent.signedDelegation ?? parent.delegation ?? parent;
  const { redelegate } = await import("./lib/eip7710.mjs");
  try {
    const { signedDelegation, chainId } = await redelegate(
      homeFromFlags(flags),
      nameFromFlags(flags),
      parentDelegation,
      input,
    );
    ok({ signedDelegation, chainId });
  } catch (e) {
    mapErr(e);
  }
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === "help" || argv[0] === "--help" || argv[0] === "-h") {
    process.stdout.write(helpText());
    process.exit(EXIT.OK);
  }

  const command = argv[0];
  const { flags } = parseArgs(argv.slice(1));

  if (flags.help === true) {
    process.stdout.write(helpText());
    process.exit(EXIT.OK);
  }

  if (!COMMANDS.includes(command)) {
    fail(
      EXIT.BAD_ARGS,
      `Unknown command: ${command}. Available: ${COMMANDS.filter((c) => c !== "help").join(", ")}`,
    );
  }

  try {
    switch (command) {
      case "doctor":
        cmdDoctor(flags);
        break;
      case "create":
        cmdCreate(flags);
        break;
      case "address":
        cmdAddress(flags);
        break;
      case "sign-personal":
        cmdSignPersonal(flags);
        break;
      case "sign-hash":
        cmdSignHash(flags);
        break;
      case "sign-typed":
        cmdSignTyped(flags);
        break;
      case "send":
        cmdSend(flags);
        break;
      case "mktx":
        cmdMktx(flags);
        break;
      case "auth7702":
        await cmdAuth7702(flags);
        break;
      case "delegation-create":
        await cmdDelegationCreate(flags);
        break;
      case "delegation-sign":
        await cmdDelegationSign(flags);
        break;
      case "redelegate":
        await cmdRedelegate(flags);
        break;
      default:
        fail(EXIT.BAD_ARGS, `Unhandled command: ${command}`);
    }
  } catch (e) {
    mapErr(e);
  }
}

main();
