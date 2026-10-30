# Agent SIWE → Bearer JWT

Production base: `https://coinoperated.finance`.

## Sequence

1. **Nonce**

   ```http
   GET /api/auth/siwe/nonce
   ```

   Response includes `nonce`, `chainId` (number; payment/Arc chain), and `domain` (host from CoinOperated `publicOrigin`, e.g. `coinoperated.finance`).

2. **Message (exact EIP-4361 template)**

   `siwe` is **not** bundled with agent-wallet. Build the string yourself (or any SIWE library). **Issued At** is required by many verifiers — use ISO-8601 UTC (`new Date().toISOString()`).

   ```text
   ${domain} wants you to sign in with your Ethereum account:
   ${address}

   Sign in to CoinOperated

   URI: https://coinoperated.finance
   Version: 1
   Chain ID: ${chainId}
   Nonce: ${nonce}
   Issued At: ${issuedAt}
   ```

   Example with concrete values:

   ```text
   coinoperated.finance wants you to sign in with your Ethereum account:
   0xAbCdEf0123456789AbCdEf0123456789AbCdEf01

   Sign in to CoinOperated

   URI: https://coinoperated.finance
   Version: 1
   Chain ID: 5042
   Nonce: a1b2c3d4e5f67890
   Issued At: 2026-10-30T17:00:00.000Z
   ```

   Field mapping:

   | Placeholder | Source |
   |-------------|--------|
   | `domain` | nonce response `domain` (no scheme) |
   | `address` | agent EOA checksum or lowercase `0x` + 40 hex |
   | `chainId` | nonce response `chainId` (decimal integer) |
   | `nonce` | nonce response `nonce` |
   | `issuedAt` | `new Date().toISOString()` at signing time |

   Keep a blank line after the address line and after the statement line (standard EIP-4361). Sign this **entire** string as the personal_sign message.

3. **Sign**

   Use skill **agent-wallet**:

   ```bash
   node scripts/aw.mjs sign-personal --message "<prepared SIWE message>"
   ```

   Parse `signature` from JSON stdout. (Works without Foundry after `cd scripts && npm install`.)

4. **Token**

   ```http
   POST /api/auth/siwe/verify/token
   Content-Type: application/json

   { "message": "<prepared SIWE message>", "signature": "0x…" }
   ```

   Success includes:

   | Field | Notes |
   |-------|--------|
   | `accessToken` | Bearer JWT |
   | `tokenType` | `Bearer` |
   | `expiresIn` | seconds |
   | `user` | parent account |
   | `signerNonce` | `0x` + 32 hex when SIWE address is an **additional signer**; `null` for primary. Persist for Agent Activity `memo.nonce` |

   The address must already be a primary wallet or a registered additional signer — this endpoint does **not** create new users.

5. **Authorized calls**

   ```http
   Authorization: Bearer <accessToken>
   ```

   Soft-deleting the additional signer on CoinOperated revokes outstanding JWTs for that signer.

## OpenAPI

Schemas and every route: [https://coinoperated.finance/openapi.yaml](https://coinoperated.finance/openapi.yaml).

Useful after link: `GET /api/agent/delegations` (Bearer required; cookie sessions rejected).

**`delegation` on each row is a JSON string** — write it raw to `parent.json` (do not `JSON.stringify` again). See coinoperated `SKILL.md` Phase 3.
