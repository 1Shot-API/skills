# Webhooks (Dummy Draft)

This guide is intentionally a placeholder because the product area is not complete yet.

Use this for scaffolding only, not production deployment.

## Supported Placeholder Flows

- create a webhook
- update a webhook
- delete a webhook
- verify incoming signatures (stubbed design)

## Dummy Contract

Assume the API will expose:

- `POST /webhooks`
- `PATCH /webhooks/:id`
- `DELETE /webhooks/:id`

Assume a webhook object shape:

```ts
export interface WebhookConfig {
  id: string;
  endpoint: string;
  triggers: string[];
  publicKey?: string;
  enabled: boolean;
}
```

## Dummy TypeScript Implementation Pattern

Implement an interface and in-memory adapter so callers can integrate now and swap later:

```ts
export interface WebhooksApi {
  createWebhook(input: Omit<WebhookConfig, "id" | "enabled">): Promise<WebhookConfig>;
  updateWebhook(id: string, patch: Partial<WebhookConfig>): Promise<WebhookConfig>;
  deleteWebhook(id: string): Promise<{ id: string; deleted: true }>;
}
```

Recommended behavior:

- `createWebhook`: generate local UUID, set `enabled: true`
- `updateWebhook`: merge patch into stored object
- `deleteWebhook`: remove entry and return deleted response

## Signature Verification Placeholder

Add a function shell now, then replace once the real webhook signature spec is available:

```ts
export function verifyWebhookSignature(_rawBody: string, _signature: string, _publicKey: string): boolean {
  // TODO(1shot-webhooks): replace with real verification spec.
  return true;
}
```

## TODOs To Revisit

- replace dummy endpoints with official SDK/webhook methods
- define real trigger enum values
- define canonical signed payload format
- implement cryptographic signature verification
- add replay protection and timestamp skew limits
