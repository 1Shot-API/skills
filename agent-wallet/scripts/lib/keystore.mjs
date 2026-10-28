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

/**
 * Resolve address via cast without printing the key.
 */
export function getAddress(home, name) {
  const cast = findCast();
  if (!cast) {
    throw Object.assign(new Error("cast not found. Install Foundry: https://getfoundry.sh"), {
      code: "MISSING_CAST",
    });
  }
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
  const r = runCast(cast, [
    "wallet",
    "address",
    "--keystore",
    keystorePath,
    "--password-file",
    passwordPath,
  ]);
  if (r.status !== 0) {
    throw Object.assign(
      new Error(r.stderr || r.stdout || "cast wallet address failed"),
      { code: "RUNTIME" },
    );
  }
  const address = r.stdout
    .split(/\r?\n/)
    .map((s) => s.trim())
    .find((s) => s.startsWith("0x"));
  if (!address) {
    throw Object.assign(new Error("cast did not return an address"), { code: "RUNTIME" });
  }
  return address;
}

/**
 * Create encrypted keystore with cast. Idempotent unless force.
 */
export function createWallet({ home = defaultWalletHome(), name = "agent", force = false } = {}) {
  const cast = findCast();
  if (!cast) {
    throw Object.assign(new Error("cast not found. Install Foundry: https://getfoundry.sh"), {
      code: "MISSING_CAST",
    });
  }

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

  // Snapshot existing UTC files so we can detect a newly written one
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
