import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { findCast, runCast } from "./cast.mjs";
import {
  accountPaths,
  chmodPrivate,
  defaultWalletHome,
  ensureDir,
} from "./paths.mjs";

export function generatePassword() {
  return crypto.randomBytes(32).toString("base64url");
}

export function walletExists(home, name) {
  const { keystorePath, passwordPath } = accountPaths(home, name);
  return fs.existsSync(keystorePath) && fs.existsSync(passwordPath);
}

export function readPassword(passwordPath) {
  return fs.readFileSync(passwordPath, "utf8").trim();
}

function normalizeAddressHex(raw) {
  const hex = String(raw).replace(/^0x/i, "");
  if (!/^[a-fA-F0-9]{40}$/.test(hex)) {
    return null;
  }
  return `0x${hex}`;
}

/**
 * Resolve address without printing the key.
 * Prefers the address embedded in the keystore JSON; falls back to cast, then decrypt.
 */
export function getAddress(home, name) {
  const { keystorePath, passwordPath } = accountPaths(home, name);
  if (!fs.existsSync(keystorePath)) {
    throw Object.assign(new Error(`Wallet keystore not found: ${keystorePath}`), {
      code: "NO_WALLET",
    });
  }
  if (!fs.existsSync(passwordPath)) {
    throw Object.assign(new Error(`Password file not found: ${passwordPath}`), {
      code: "NO_WALLET",
    });
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(keystorePath, "utf8"));
    const fromJson = normalizeAddressHex(parsed?.address);
    if (fromJson) {
      return fromJson;
    }
  } catch {
    // fall through
  }

  const cast = findCast();
  if (cast) {
    const r = runCast(cast, [
      "wallet",
      "address",
      "--keystore",
      keystorePath,
      "--password-file",
      passwordPath,
    ]);
    if (r.status === 0) {
      const address = r.stdout
        .split(/\r?\n/)
        .map((s) => s.trim())
        .find((s) => s.startsWith("0x"));
      if (address) {
        return address;
      }
    }
  }

  throw Object.assign(
    new Error(
      "Could not resolve wallet address from keystore JSON. Re-run create, or install Foundry cast.",
    ),
    { code: "RUNTIME" },
  );
}

async function loadEthersWallet() {
  try {
    const { Wallet } = await import("ethers");
    return Wallet;
  } catch {
    throw Object.assign(
      new Error(
        "ethers not installed. Run: cd scripts && npm install  (from the agent-wallet skill root)",
      ),
      { code: "MISSING_DEPS" },
    );
  }
}

/**
 * Create encrypted keystore. Prefers pure Node (ethers) so Foundry is optional.
 * Falls back to `cast wallet new` if ethers is unavailable. Idempotent unless force.
 */
export async function createWallet({
  home = defaultWalletHome(),
  name = "agent",
  force = false,
} = {}) {
  const paths = accountPaths(home, name);
  ensureDir(paths.keystoresDir);
  ensureDir(paths.home);

  if (walletExists(home, name) && !force) {
    const address = getAddress(home, name);
    return {
      created: false,
      address,
      name: paths.account,
      keystorePath: paths.keystorePath,
      passwordPath: paths.passwordPath,
      storageTier: "keystore+password-file",
    };
  }

  if (force) {
    for (const p of [paths.keystorePath, paths.passwordPath]) {
      try {
        fs.rmSync(p, { force: true, recursive: true });
      } catch {
        // ignore
      }
    }
  }

  const password = generatePassword();
  fs.writeFileSync(paths.passwordPath, password + "\n", {
    encoding: "utf8",
    mode: 0o600,
  });
  chmodPrivate(paths.passwordPath);

  try {
    const Wallet = await loadEthersWallet();
    const wallet = Wallet.createRandom();
    const json = await wallet.encrypt(password);
    fs.writeFileSync(paths.keystorePath, json, { encoding: "utf8", mode: 0o600 });
    chmodPrivate(paths.keystorePath);
    return {
      created: true,
      address: wallet.address,
      name: paths.account,
      keystorePath: paths.keystorePath,
      passwordPath: paths.passwordPath,
      storageTier: "keystore+password-file",
    };
  } catch (e) {
    if (e?.code !== "MISSING_DEPS") {
      try {
        fs.rmSync(paths.passwordPath, { force: true });
      } catch {
        // ignore
      }
      throw e;
    }
    // ethers missing — fall through to optional cast
  }

  const cast = findCast();
  if (!cast) {
    try {
      fs.rmSync(paths.passwordPath, { force: true });
    } catch {
      // ignore
    }
    throw Object.assign(
      new Error(
        "ethers not available and cast not found. Run: cd scripts && npm install  (Foundry cast is optional)",
      ),
      { code: "MISSING_DEPS" },
    );
  }

  const before = new Set(
    fs.existsSync(paths.keystoresDir) ? fs.readdirSync(paths.keystoresDir) : [],
  );

  const r = runCast(cast, [
    "wallet",
    "new",
    paths.keystoresDir,
    paths.account,
    "--unsafe-password",
    password,
    ...(force ? ["--force"] : []),
  ]);

  if (r.status !== 0) {
    try {
      fs.rmSync(paths.passwordPath, { force: true });
    } catch {
      // ignore
    }
    throw Object.assign(new Error(r.stderr || r.stdout || "cast wallet new failed"), {
      code: "RUNTIME",
    });
  }

  normalizeKeystoreFile(paths, before);

  const address = getAddress(home, name);
  return {
    created: true,
    address,
    name: paths.account,
    keystorePath: paths.keystorePath,
    passwordPath: paths.passwordPath,
    storageTier: "keystore+password-file",
  };
}

/**
 * Foundry may write keystores/<account> or a UTC--* filename.
 * Normalize to a stable keystores/<account> path.
 */
function normalizeKeystoreFile(paths, before = new Set()) {
  if (fs.existsSync(paths.keystorePath) && !fs.statSync(paths.keystorePath).isDirectory()) {
    chmodPrivate(paths.keystorePath);
    return;
  }

  const entries = fs.readdirSync(paths.keystoresDir);
  if (entries.includes(paths.account)) {
    const p = path.join(paths.keystoresDir, paths.account);
    if (fs.statSync(p).isFile()) {
      chmodPrivate(p);
      return;
    }
  }

  const utc = entries
    .filter((e) => e.startsWith("UTC--") && !before.has(e))
    .map((e) => ({
      e,
      m: fs.statSync(path.join(paths.keystoresDir, e)).mtimeMs,
    }))
    .sort((a, b) => b.m - a.m);

  // Fallback: any UTC-- if none newly appeared
  const candidates =
    utc.length > 0
      ? utc
      : entries
          .filter((e) => e.startsWith("UTC--"))
          .map((e) => ({
            e,
            m: fs.statSync(path.join(paths.keystoresDir, e)).mtimeMs,
          }))
          .sort((a, b) => b.m - a.m);

  if (candidates.length === 0) {
    throw Object.assign(
      new Error(`cast wallet new succeeded but no keystore file found in ${paths.keystoresDir}`),
      { code: "RUNTIME" },
    );
  }

  const src = path.join(paths.keystoresDir, candidates[0].e);
  fs.renameSync(src, paths.keystorePath);
  chmodPrivate(paths.keystorePath);
}

/**
 * Decrypt keystore in-process with ethers. NEVER log the private key.
 * Returns a viem-compatible PrivateKeyAccount hex string (0x…).
 */
export async function decryptPrivateKeyHex(home, name) {
  const { keystorePath, passwordPath } = accountPaths(home, name);
  if (!fs.existsSync(keystorePath) || !fs.existsSync(passwordPath)) {
    throw Object.assign(new Error("Wallet not found"), { code: "NO_WALLET" });
  }
  const json = fs.readFileSync(keystorePath, "utf8");
  const password = readPassword(passwordPath);

  let Wallet;
  try {
    ({ Wallet } = await import("ethers"));
  } catch {
    throw Object.assign(
      new Error(
        "ethers not installed. Run: cd scripts && npm install  (from the agent-wallet skill root)",
      ),
      { code: "MISSING_DEPS" },
    );
  }

  const wallet = await Wallet.fromEncryptedJson(json, password);
  return wallet.privateKey;
}
