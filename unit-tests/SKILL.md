---
name: unit-tests
description: >-
  Authors Jest unit tests for TypeScript services using testdouble, neverthrow
  ResultAsync, and a structured mocks class. Use when writing or refactoring unit
  tests, adding test coverage, or when the user asks for tests matching project
  conventions (Arrange/Act/Assert, explicit mocks, negative-only td.verify).
license: MIT
metadata:
  author: 1Shot-API
  version: "1.0.0"
  repository: https://github.com/1Shot-API/skills
---

# Unit tests (service / business layer)

Follow this structure so tests stay readable, explicit, and easy to maintain. Reference implementations (in the oneshot monorepo):

- `packages/signer/test/unit/business/SignerService.test.ts` — parameterized mocks class, explicit Redis key matching, `getInstance()`.
- `packages/EVMBaseChain/test/unit/business/EscrowWalletService.test.ts` — shared `CommonValues`, heavy domain setup in Arrange, `factoryService()`.

## Install this skill (consumer / global)

```bash
npx skills add 1Shot-API/skills/unit-tests -g -a cursor -y
```

## When to use this skill

- Writing or refactoring Jest unit tests for TypeScript services in the oneshot monorepo
- Adding coverage that should match project conventions (testdouble, neverthrow `ResultAsync`)
- The user asks for tests matching Arrange/Act/Assert, explicit mocks, or negative-only `td.verify`

## When NOT to use this skill

- Frontend/portal component tests that do not use the service mocks class pattern
- Integration or e2e tests outside the Jest + testdouble service layer style
- Relayer (`1shot-okx-relayer`) tests that use `bun:test` instead of Jest/testdouble

## 1. File-level constants

At the top of the test file (after imports), declare **named constants** used across tests:

- **Stable IDs and branded types** (`UserId`, `BusinessId`, addresses) so every test uses the same fake identity unless a case needs a different value.
- **Shared primitives** reused in mocks (e.g. JWT strings, chain enum) when they are not test-specific.

Use real or fake values deliberately: prefer values that match production shape (UUIDs, `0x`-prefixed addresses) so type constructors and validators behave like production.

## 2. `ClassUnderTestMocks` class

Create one class named after the system under test, e.g. `SignerServiceMocks`, `EscrowWalletServiceMocks`.

- **Constructor parameters**: Pass anything that should vary the **baseline** behavior across tests (e.g. `userId`, `EService` for the chain service token). Tests that need the same baseline use the same arguments; divergent tests pass different constructor args **or** override in Arrange (see below).

## 3. Dependencies

The mocks class **owns every dependency** the class-under-test needs:

- `td.object<Interface>()` for each injected port (repository, config provider, Redis, etc.).
- Public fields so tests and overrides can reference them (`mocks.kmsRepository`, `mocks.redisClient`, …).

Wire the real constructor in a single factory method:

- Name it `getInstance()`, `factoryService()`, or another clear name; one place constructs `new ClassUnderTest(...)`.

## 4. Baseline = happy path in the constructor

In the **constructor** (or an `init()` called from it), set **`td.when(...).thenReturn(...)`** for the default, success-path behavior:

- `getConfig()` → `okAsync` a real-enough config object.
- `getRedisClient()` → `okAsync` the mock Redis client.
- Any stubbed remote call that most tests expect to succeed.

**Prefer explicit arguments** in `td.when()`:

- Pass concrete `CreateSigningKeyParams`-like values, exact `RedisKeys.*` arrays, or `td.matchers.contains([...])` with real key strings when the implementation builds a known list.
- Avoid `td.matchers.anything()` in baseline stubs unless the API is truly opaque; the tighter the match, the earlier wrong calls fail.

Complex or repeated payloads (resolved user context, config blobs) can be built in **protected helpers** or **factory methods** on the mocks class.

## 5. Public members and factories

Expose on the mocks class:

- **Data the SUT needs from outside**: e.g. `ruc`, `config`, prebuilt `SignerConfig`.
- **Factory methods** for verbose objects (`makeRucForUserAndChainService`, etc.) when multiple tests need the same shape with small variations.

## 6. Test structure: Arrange / Act / Assert

Each `test(...)` (or `it(...)`) uses three sections with **comments**:

```ts
test("descriptive name", async () => {
	// Arrange
	const mocks = new SomeServiceMocks(/* baseline params */);
	// Optional: td.when overrides for this test only
	const svc = mocks.getInstance();

	// Act
	const result = await svc.someMethod(...);

	// Assert
	expect(result.isErr()).toBe(true);
	// ...
});
```

## 7. Arrange

- Instantiate **`ClassUnderTestMocks`** with the right constructor args.
- Apply **overrides** after construction: extra `td.when(mocks.dep.method(explicitArgs)).thenReturn(...)` for this test only (e.g. kill switch returns `["on"]`).
- End Arrange with **`const sut = mocks.getInstance()`** (or `factoryService()`).

## 8. Act

- **Only** calls on the system under test (and sometimes one obvious preparatory call if the scenario requires it). No assertions in Act.

## 9. Assert

- **Primary**: `expect(...)` on the method result — for `ResultAsync` / neverthrow, `result.isOk()`, `result.isErr()`, `_unsafeUnwrap()`, `_unsafeUnwrapErr()`, `toBeInstanceOf`, deep equality on unwrapped values.
- **Avoid** `td.verify` for happy-path call counts unless the team explicitly wants interaction testing for that case.

## 10. `td.verify` — negative guarantees only

Use **`td.verify(..., { times: 0 })`** when the test’s purpose is to prove something **did not run** (e.g. KMS not called after validation failure, or Redis kill switch short-circuits before repository access).

When `verify` is required, still prefer **specific arguments** where feasible; use `anything()` only for parameters that are intentionally opaque or unstable.

## Naming consistency

- Mocks class: `{ClassUnderTest}Mocks` (e.g. `SignerServiceMocks`).
- Factory: `getInstance()` or `factoryService()` — pick one per file and stay consistent.
- Fix typos in dependency field names (`repository` not `repsitory`) in new tests.

## Checklist for a new test file

- [ ] Constants block for shared IDs / tokens / addresses
- [ ] Single mocks class with all `td.object` dependencies
- [ ] Constructor establishes happy-path `td.when` with explicit values where possible
- [ ] `getInstance` / `factoryService` builds the real service
- [ ] Each test has `// Arrange`, `// Act`, `// Assert`
- [ ] Assert focuses on `expect` on results; `td.verify` only for must-not-happen side effects
