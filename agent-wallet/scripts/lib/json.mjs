/** Structured JSON stdout / stderr helpers for agent-friendly CLIs. */

export const EXIT = {
  OK: 0,
  MISSING_DEPS: 2,
  NO_WALLET: 3,
  BAD_ARGS: 4,
  RUNTIME: 5,
};

export function ok(data) {
  process.stdout.write(JSON.stringify({ ok: true, ...data }) + "\n");
  process.exit(EXIT.OK);
}

export function fail(code, message, extra = {}) {
  process.stderr.write(JSON.stringify({ ok: false, error: message, ...extra }) + "\n");
  process.exit(code);
}

export function logDiag(...args) {
  process.stderr.write(args.map(String).join(" ") + "\n");
}
