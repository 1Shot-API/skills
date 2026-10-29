# Agent SIWE → Bearer JWT

Production base: `https://coinoperated.finance`.

## Sequence

1. **Nonce**

   ```http
   GET /api/auth/siwe/nonce
   ```

   Response includes `nonce`, `chainId` (number; payment/Arc chain), and `domain` (host from CoinOperated `publicOrigin`, e.g. `coinoperated.finance`).

2. **Message**

   Build a SIWE message (EIP-4361) with:

   - `domain` — from nonce response
   - `address` — agent EOA (additional signer)
   - `statement` — `Sign in to CoinOperated`
   - `uri` — `https://coinoperated.finance` (or the same origin you are calling)
   - `version` — `1`
   - `chainId` — from nonce response
   - `nonce` — from nonce response

   Libraries such as `siwe` (`new SiweMessage({…}).prepareMessage()`) are fine. Sign the **prepared message string**.

3. **Sign**

   Use skill **agent-wallet**:

   ```bash
   node scripts/aw.mjs sign-personal --message "<prepared SIWE message>"
   ```

   Parse `signature` from JSON stdout.

4. **Token**

   ```http
   POST /api/auth/siwe/verify/token
   Content-Type: application/json

   { "message": "<prepared SIWE message>", "signature": "0x…" }
   ```

   Success includes `accessToken`, `tokenType` (`Bearer`), `expiresIn` (seconds), `user` (parent account), and `signerNonce` (string when this address is an additional signer; `null` for primary). Persist **`signerNonce`** — it goes in relayer `params.memo` JSON so CoinOperated can attribute spends to Agent Activity. The address must already be a primary wallet or a registered additional signer — this endpoint does **not** create new users.

5. **Authorized calls**

   ```http
   Authorization: Bearer <accessToken>
   ```

   Soft-deleting the additional signer on CoinOperated revokes outstanding JWTs for that signer.

## OpenAPI

Schemas and every route: [https://coinoperated.finance/openapi.yaml](https://coinoperated.finance/openapi.yaml).

Useful after link: `GET /api/agent/delegations` (Bearer required; cookie sessions rejected).
