import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Skill scripts/ directory (parent of lib/). */
export function scriptsDir() {
  return path.resolve(__dirname, "..");
}

/** Skill root (agent-wallet/). */
export function skillRoot() {
  return path.resolve(scriptsDir(), "..");
}

export function defaultWalletHome() {
  const env = process.env.AGENT_WALLET_HOME?.trim();
  if (env) {
    return path.resolve(env);
  }
  return path.join(os.homedir(), ".agent-wallet");
}

export function resolveAccountName(name) {
  const n = (name ?? "agent").trim();
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(n)) {
    throw new Error(
      `Invalid account name "${n}". Use 1–64 chars: letters, digits, _ or -`,
    );
  }
  return n;
}

/**
 * Layout:
 *   $AGENT_WALLET_HOME/
 *     keystores/<name>     # Foundry keystore file or dir entry
 *     <name>.password      # password file (0600)
 */
export function accountPaths(home, name) {
  const account = resolveAccountName(name);
  const keystoresDir = path.join(home, "keystores");
  return {
    home,
    account,
    keystoresDir,
    keystorePath: path.join(keystoresDir, account),
    passwordPath: path.join(home, `${account}.password`),
  };
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/** Best-effort restrictive mode (no-op semantics on some Windows setups). */
export function chmodPrivate(filePath) {
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // ignore
  }
}

export function depsInstalled() {
  return fs.existsSync(path.join(scriptsDir(), "node_modules", "ethers"));
}
