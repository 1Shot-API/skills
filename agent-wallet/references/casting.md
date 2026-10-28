# Cast mapping

`aw` wraps Foundry `cast` so agents never hit interactive password prompts or key-printing commands.

## Create

```text
cast wallet new <keystoresDir> <name> --unsafe-password <generated>
```

Password is written only to `$HOME/<name>.password`, never to stdout. Keystore path is normalized to `$HOME/keystores/<name>`.

**Never** use bare `cast wallet new` (prints a raw private key).

## Address

```text
cast wallet address --keystore <path> --password-file <path>
```

## Sign (personal / hash / typed)

```text
cast wallet sign <message> --keystore … --password-file …
cast wallet sign <hash> --no-hash --keystore … --password-file …
cast wallet sign --data --from-file <typed.json> --keystore … --password-file …
```

## Send / mktx

```text
cast send <to> [data] --keystore … --password-file … --rpc-url … [--value] [--chain]
cast mktx <to> [data] --keystore … --password-file … --rpc-url … [--value] [--chain]
```

## Forbidden

| Command | Why |
|---------|-----|
| `cast wallet private-key` | Prints plaintext key to stdout |
| `cast wallet new` without `--unsafe-password` | May prompt or print key |
| Interactive password entry | Hangs non-interactive agents |

## Env overrides

- `CAST_PATH` — absolute path to `cast` if not on `PATH`
- `CAST_PASSWORD` — not used by `aw` (password-file only)
