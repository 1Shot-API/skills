import { spawnSync } from "node:child_process";
import fs from "node:fs";

/**
 * Locate cast binary. Returns path or null.
 */
export function findCast() {
  const fromEnv = process.env.CAST_PATH?.trim();
  if (fromEnv && fs.existsSync(fromEnv)) {
    return fromEnv;
  }
  const r = spawnSync(process.platform === "win32" ? "where" : "which", ["cast"], {
    encoding: "utf8",
  });
  if (r.status === 0) {
    const line = (r.stdout || "").split(/\r?\n/).map((s) => s.trim()).find(Boolean);
    if (line) {
      return line;
    }
  }
  return null;
}

export function castVersion(castPath) {
  const r = spawnSync(castPath, ["--version"], { encoding: "utf8" });
  if (r.status !== 0) {
    return null;
  }
  return (r.stdout || r.stderr || "").trim().split(/\r?\n/)[0] ?? null;
}

/**
 * Run cast. Captures stdout/stderr. Never logs secrets.
 * @param {string} castPath
 * @param {string[]} args
 * @param {{ env?: NodeJS.ProcessEnv, input?: string }} [opts]
 */
export function runCast(castPath, args, opts = {}) {
  const r = spawnSync(castPath, args, {
    encoding: "utf8",
    input: opts.input,
    env: { ...process.env, ...opts.env },
    windowsHide: true,
  });
  return {
    status: r.status ?? 1,
    stdout: (r.stdout || "").trim(),
    stderr: (r.stderr || "").trim(),
    error: r.error,
  };
}
