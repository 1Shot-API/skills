# Storage layout

## Home directory

| Source | Path |
|--------|------|
| Default | `~/.agent-wallet` (`os.homedir()` + `.agent-wallet`) |
| Override | env `AGENT_WALLET_HOME` or CLI `--home` |

## Files (Tier B)

| Path | Contents | Mode |
|------|----------|------|
| `$HOME/keystores/<name>` | Foundry/Ethereum encrypted JSON keystore | best-effort `0600` |
| `$HOME/<name>.password` | Keystore password (random, generated at create) | best-effort `0600` |

Default account `name` is `agent`.

## Tier A (deferred)

OS keyring (macOS Keychain, Windows Credential Manager, libsecret) is **not** implemented in v1. Headless agent sandboxes often cannot unlock interactive keyrings reliably. Do not invent a parallel password store.

## Windows notes

`fs.chmodSync(0o600)` is best-effort. NTFS ACLs may still allow the current user (and administrators) to read the files. Treat the user profile as the trust boundary.

## Forbidden operations

- Do not print the password file or decrypt the keystore to stdout/logs.
- Do not commit `~/.agent-wallet` to git.
- Do not use `cast wallet private-key` in agent workflows.
