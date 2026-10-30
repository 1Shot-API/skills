#!/usr/bin/env node
/**
 * Smoke checks: doctor JSON shape; optional create/sign when cast is present;
 * assert stdout never contains a 64-byte private-key-looking hex after a leading 0x
 * in forbidden contexts (we scan for password/mnemonic keywords and raw 66-char keys
 * labeled as privateKey).
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const aw = path.resolve(__dirname, "..", "aw.mjs");
const home = fs.mkdtempSync(path.join(os.tmpdir(), "aw-smoke-"));

function run(args) {
  const r = spawnSync(process.execPath, [aw, ...args, "--home", home, "--name", "smoke"], {
    encoding: "utf8",
    windowsHide: true,
  });
  return {
    status: r.status ?? 1,
    stdout: r.stdout || "",
    stderr: r.stderr || "",
  };
}

function assertNoLeak(label, text) {
  // Forbid JSON fields that would export secrets (docs may mention the words)
  if (/"(privateKey|private_key|mnemonic|seed|password)"\s*:\s*"/i.test(text)) {
    throw new Error(`${label}: secret field with value in output`);
  }
  // Raw 32-byte key as a JSON string value named suspiciously is caught above;
  // also reject lines that look like cast dumping "Private Key: 0x…"
  if (/private\s*key\s*[:=]\s*0x[a-fA-F0-9]{64}/i.test(text)) {
    throw new Error(`${label}: private key dump pattern`);
  }
}

let failed = 0;

function check(name, fn) {
  try {
    fn();
    console.error(`ok  ${name}`);
  } catch (e) {
    failed++;
    console.error(`FAIL ${name}: ${e.message}`);
  }
}

check("doctor runs", () => {
  const r = run(["doctor"]);
  assertNoLeak("doctor stdout", r.stdout);
  assertNoLeak("doctor stderr", r.stderr);
  const j = JSON.parse(r.stdout.trim().split("\n").pop());
  if (!j.ok) throw new Error("doctor not ok");
  if (typeof j.depsOk !== "boolean") throw new Error("missing depsOk");
  if (j.storageTier !== "keystore+password-file") throw new Error("bad storageTier");
});

check("help exits 0", () => {
  const r = run(["help"]);
  if (r.status !== 0) throw new Error(`status ${r.status}`);
  assertNoLeak("help", r.stdout + r.stderr);
});

check("unknown command → 4", () => {
  const r = run(["not-a-cmd"]);
  if (r.status !== 4) throw new Error(`expected 4 got ${r.status}`);
});

const doctor = JSON.parse(run(["doctor"]).stdout.trim().split("\n").pop());

if (doctor.depsOk || doctor.cast) {
  check("create + address + sign-personal (Node/ethers; cast optional)", () => {
    const c = run(["create"]);
    assertNoLeak("create", c.stdout + c.stderr);
    if (c.status !== 0) throw new Error(c.stderr || c.stdout);
    const created = JSON.parse(c.stdout.trim().split("\n").pop());
    if (!created.address?.startsWith("0x")) throw new Error("no address");

    const a = run(["address"]);
    assertNoLeak("address", a.stdout);
    const addr = JSON.parse(a.stdout.trim().split("\n").pop());
    if (addr.address.toLowerCase() !== created.address.toLowerCase()) {
      throw new Error("address mismatch");
    }

    const s = run(["sign-personal", "--message", "hello-agent-wallet"]);
    assertNoLeak("sign-personal", s.stdout + s.stderr);
    if (s.status !== 0) throw new Error(s.stderr || s.stdout);
    const sig = JSON.parse(s.stdout.trim().split("\n").pop());
    if (!sig.signature?.startsWith("0x") || sig.signature.length < 130) {
      throw new Error("bad signature");
    }
  });

  if (doctor.depsOk) {
    check("delegation-create sample (unsigned)", () => {
      const inputPath = path.join(home, "del.json");
      const addr = JSON.parse(run(["address"]).stdout.trim().split("\n").pop()).address;
      fs.writeFileSync(
        inputPath,
        JSON.stringify({
          chainId: 84532,
          to: addr,
          scope: {
            type: "nativeTokenTransferAmount",
            maxAmount: "1000000000000000",
          },
        }),
      );
      const r = run(["delegation-create", "--file", inputPath]);
      assertNoLeak("delegation-create", r.stdout + r.stderr);
      // May fail if chain env unsupported — still must not leak keys
      if (r.status === 0) {
        const j = JSON.parse(r.stdout.trim().split("\n").pop());
        if (!j.delegation) throw new Error("missing delegation");
      } else {
        console.error(`  (delegation-create exited ${r.status}: ${r.stderr.trim().slice(0, 200)})`);
      }
    });
  }
} else {
  console.error("skip create/sign (npm deps + cast both missing)");
  check("create fails with missing deps code", () => {
    const r = run(["create"]);
    if (r.status !== 2) throw new Error(`expected exit 2, got ${r.status}`);
    assertNoLeak("create fail", r.stdout + r.stderr);
  });
}

try {
  fs.rmSync(home, { recursive: true, force: true });
} catch {
  // ignore
}

process.exit(failed ? 1 : 0);
