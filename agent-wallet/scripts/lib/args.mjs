import fs from "node:fs";

/**
 * Minimal argv parser. Supports --flag value, --flag=value, and boolean --flag.
 */

export function parseArgs(argv) {
  const positional = [];
  const flags = {};

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq !== -1) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
        continue;
      }
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
      continue;
    }
    positional.push(a);
  }

  return { positional, flags };
}

export function requireFlags(flags, required) {
  const missing = required.filter((k) => flags[k] === undefined || flags[k] === "");
  if (missing.length) {
    throw Object.assign(
      new Error(`Missing required flags: ${missing.map((m) => `--${m}`).join(", ")}`),
      { code: "BAD_ARGS" },
    );
  }
}

export function rejectUnknown(flags, allowed) {
  const bad = Object.keys(flags).filter((k) => !allowed.has(k));
  if (bad.length) {
    throw Object.assign(
      new Error(
        `Unknown flag(s): ${bad.map((b) => `--${b}`).join(", ")}. Allowed: ${[...allowed]
          .map((a) => `--${a}`)
          .join(", ")}`,
      ),
      { code: "BAD_ARGS" },
    );
  }
}

export function loadJson(filePath) {
  // Strip UTF-8 BOM (common on Windows editors / PowerShell Set-Content)
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  try {
    return JSON.parse(text);
  } catch (e) {
    throw Object.assign(new Error(`Invalid JSON in ${filePath}: ${e.message}`), {
      code: "BAD_ARGS",
    });
  }
}
