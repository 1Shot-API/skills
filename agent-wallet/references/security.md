# Security model

## Goals

1. Keep private keys, mnemonics, and keystore passwords **out of model/chat context**.
2. Prefer non-interactive, scriptable flows suitable for agent sandboxes.
3. Fail closed when Foundry or Node deps are missing (no silent JS keygen in v1).

## Trust boundary

The **host filesystem** (and any process that can read it) can access:

- `$AGENT_WALLET_HOME/keystores/<name>`
- `$AGENT_WALLET_HOME/<name>.password`

`aw` prevents **accidental** leakage into stdout/stderr JSON. It does **not** protect against a compromised sandbox, malicious tools with FS access, or the user pasting keystore contents into chat.

## Hard rules for agents

- Never read the password file into the conversation.
- Never run `cast wallet private-key`.
- Never log decrypted keys from EIP-7710 helpers (decrypt is in-process only).
- Show users the **address** after create; funding and permissions are their decision.
- Prefer small allowances / scoped EIP-7710 caveats over open-ended delegations.

## Output contract

| Channel | Content |
|---------|---------|
| stdout | Single JSON object per command (`ok: true` + result fields) |
| stderr | Diagnostics / error JSON (`ok: false`) |

Success and error JSON must not contain `privateKey`, `mnemonic`, `password`, or raw keystore ciphertext dumps.

## EIP-7710 path

`ethers.Wallet.fromEncryptedJson` decrypts in memory; `signDelegation` / `signAuthorization` use the key once. Do not write decrypted keys to disk or temp files.
