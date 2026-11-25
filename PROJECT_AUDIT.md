# Project Audit & Codebase Review

**Audit scope:** repository root plus all 51 TypeScript source files, configuration files, package manifests, lockfile, environment files, and the current worktree. Vendored `node_modules` and generated `dist` content were excluded from application-code review. The repository has no test suite or test configuration.

**Status labels:** findings marked **Confirmed** are directly supported by the code. Findings marked **Unverified** depend on runtime services or deployment configuration that was not exercised.

## 1. Executive Summary & Overall Health Score

- **Overall health score: 3.5 / 10**
- The project compiles with `tsc --noEmit` and has a small, understandable Express/Mongoose module structure.
- The most serious blocker is the Mongoose `pre(["find","findOne"])` hook: it uses `this.getQuery` instead of `this.getQuery()`, replacing query filters with an unintended `isDeleted` condition. This can make authentication, login, signup duplicate checks, OTP confirmation, and profile lookup stop honoring their filters.
- Database startup failures are swallowed, Redis startup failures can prevent the app, and the process is started from compiled output by scripts that do not build it reliably.
- Multiple live credentials and private configuration values are present in environment files: MongoDB credentials, Redis credentials, Gmail app passwords, a Brevo API key, JWT signatures, and an encryption key.
- Authentication is incomplete: login does not check email confirmation or provider, profile lookup is not scoped to the authenticated user, protected responses expose Mongoose documents including password hashes, and refresh/revoke flows are only partially implemented.
- Validation is missing on login, OTP confirmation, resend, and profile parameters; signup's runtime requirements and validation rules do not match.

### Top critical blockers

1. Fix and remove the Mongoose query hook (`src/DB/models/user.model.ts:75-82`), or at minimum restore original filters.
2. Rotate every secret in the two environment files and move them to a secret manager or untracked `.env.example` workflow.
3. Prevent startup unless MongoDB and Redis are both available, and add process-level startup/error handling.
4. Add authentication/authorization checks to profile retrieval and prevent password/hash/internal fields from being serialized.
5. Validate login and OTP endpoints and enforce email confirmation.

### Highest-impact quick wins

1. Replace all `console.*` operational logging with an environment-aware logger.
2. Configure CORS to use `ALLOWED_ORIGINS`.
3. Add `.env.example`, `build`, `dev`, `test`, `lint`, and `clean` scripts.
4. Return `429` for the rate limiter, no stack trace in production, and consistent HTTP success statuses.
5. Add Zod validation for login, confirm/resend OTP, and object IDs.

## 2. Project Architecture & Tech Stack Overview

### Directory map

```text
src/
  index.ts                         Application entry point
  app.bootstrap.ts                 Express app creation and startup
  config/
    config.service.ts              dotenv loading and typed environment exports
    .env.development              Development secrets and runtime configuration
    .env.production               Production secrets and runtime configuration
  modules/
    auth/
      auth.controller.ts           /auth routes
      auth.service.ts              Signup, OTP, and login operations
      auth.validation.ts           Signup Zod schema
    user/
      user.controller.ts           /user routes
      user.service.ts              Profile retrieval
  middleware/
    authentication.middleware.ts   Bearer JWT verification
    authorization.middleware.ts    Role authorization
    validation.middleware.ts       Zod request validation
    response.middleware.ts         Uniform response formatting
    error.middleware.ts            Global error handler
  DB/
    connection.db.ts               MongoDB connection
    redis.connection.ts            Redis client/service
    models/user.model.ts           Mongoose user schema/hooks
    repositories/
      main.repo.ts                 Generic repository
      user.repo.ts                 User repository
  common/
    exception/                     Typed HTTP exceptions
    interface/                     Shared request/response/data interfaces
    security/                      Hashing, encryption, and obsolete token code
    service/token.service.ts       JWT creation and verification
    utils/                         General Zod rules, enums, issuer, OTP helpers
    utils/email/                   Nodemailer transport and HTML template
    events/event.email.ts          Email EventEmitter listener
  types/express.d.ts               Express Request augmentations
```

### Technology stack

| Area | Technology |
|---|---|
| Language/runtime | TypeScript, Node.js |
| Web framework | Express 5 |
| API validation | Zod 4 |
| Database | MongoDB through Mongoose 9 |
| Cache | Redis through `redis` 6 |
| Authentication | `jsonwebtoken` |
| Password hashing | `bcrypt` 6 |
| Encryption | Node crypto AES-256-CBC |
| Email | Nodemailer 10 |
| CORS/rate limiting | `cors`, `express-rate-limit` |
| Process/dev tooling | nodemon, concurrently, cross-env |

### Request/data flow

1. `src/index.ts` calls `bootstrap()`.
2. `app.bootstrap.ts` creates the Express app, adds JSON/CORS/rate-limit middleware, connects MongoDB and Redis, mounts `/auth` and `/user`, and listens.
3. Auth routes run Zod validation where configured, then a response formatter invokes the controller/service handler.
4. Auth services call `UserRepo`, Redis, Nodemailer, hashing, encryption, and `TokenService`.
5. User routes run JWT authentication, then call `UserService.profile` and generic Mongoose repository methods.
6. Mongoose `userModel` applies password/phone hooks and a query hook on reads.

## 3. Critical Bugs & Logic Flaws

### 1. Mongoose read hooks replace or omit the caller's query

- **Severity:** Critical
- **Location:** `src/DB/models/user.model.ts:75-82`, `pre(["find","findOne"])`
- **What Happens:** The hook accesses `this.getQuery` as a property, not a method. Destructuring `query` therefore cannot preserve the supplied filter and leaves `rest` effectively empty. It calls `this.setQuery({...rest,isDeleted:{$exists:false}})`. There is no `isDeleted` field in the schema or interface. Even a corrected call to `this.getQuery()` would need to preserve the original filter and would still currently invent an unsupported soft-delete filter.
- **Impact:** Signup duplicate checks, login lookup, OTP lookup, resend lookup, profile lookup, and future repository reads can lose their intended criteria. Authentication by an invalid object ID can also produce or return the wrong account depending on Mongoose middleware behavior.
- **Recommended Fix:**

```ts
userSchema.pre(["find", "findOne"], function () {
    const filter = this.getFilter();
    if (!Object.prototype.hasOwnProperty.call(filter, "isDeleted")) {
        this.setFilter({ ...filter, isDeleted: false });
    }
});
```

Only do this after adding an actual `isDeleted: boolean` field and migration/indexing. Otherwise remove the hook entirely.

### 2. Query hook corrupts `findById` authentication lookup

- **Severity:** Critical
- **Location:** `src/DB/models/user.model.ts:75-82`; `src/DB/repositories/main.repo.ts:69-73`; `src/middleware/authentication.middleware.ts:45`
- **What Happens:** Authentication verifies a JWT then calls `findById(userId)`. Mongoose implements `findById` as/findOne and the `pre("findOne")` hook runs. The hook overwrites the ID filter.
- **Impact:** The middleware may fail to bind the intended user or may bind a different or arbitrary user.
- **Recommended Fix:** Remove the hook, immediately verify `findById` behavior with integration tests, and use `lean()`/explicit projection for public/token lookup if needed.

### 3. Database connection failure is swallowed

- **Severity:** Critical
- **Location:** `src/DB/connection.db.ts:3-10`
- **What Happens:** `connectionDB()` catches every Mongoose error and logs it instead of rethrowing or returning a failure state.
- **Impact:** `bootstrap()` continues, mounts routes, and starts listening although MongoDB is unavailable. Requests then fail unpredictably; there is no readiness state.
- **Recommended Fix:** Rethrow or call fatal startup shutdown after `mongoose.connect` fails. Do not listen until MongoDB and Redis are ready.

```ts
await mongoose.connect(DB_URI, { serverSelectionTimeoutMS: 10_000 });
```

### 4. Redis connection failure is unhandled at application entry

- **Severity:** High
- **Location:** `src/DB/redis.connection.ts:18-21`; `src/app.bootstrap.ts:28`; `src/index.ts:3`
- **What Happens:** Redis `connect()` rejection propagates from `bootstrap()`, but `src/index.ts` neither awaits nor catches it.
- **Impact:** Startup behavior is unclear and can leave an unhandled promise rejection process abort or partial server startup.
- **Recommended Fix:** Make entry-point startup explicitly catch errors and terminate non-zero after logging.

### 5. Signup data model requires age, while validation marks it optional

- **Severity:** High
- **Location:** `src/modules/auth/auth.validation.ts:5-15`; `src/modules/auth/auth.service.ts:50-78`; `src/DB/models/user.model.ts:23-26`
- **What Happens:** `age` is optional in Zod and absent clients are accepted by validation, but Mongoose defines `age.required: true`. The service passes `age: undefined` when absent.
- **Impact:** Signup can unexpectedly fail with a Mongoose validation error for the same payload marked valid.
- **Recommended Fix:** Make age required consistently, or make it optional in the Mongoose schema and interface. Update the signup DTO in both cases.

### 6. Login can succeed before email confirmation

- **Severity:** High
- **Location:** `src/modules/auth/auth.service.ts:126-137`
- **What Happens:** Login looks up email/password only. It does not check `confirmEmail`, provider, or account state.
- **Impact:** A user who created an account but never verified it can receive access and refresh tokens.
- **Recommended Fix:** Reject unconfirmed users and verify provider. Return the same generic credential error for absent and wrong credentials.

### 7. Login does not normalize email

- **Severity:** Medium
- **Location:** `src/modules/auth/auth.service.ts:128`
- **What Happens:** Signup stores `email.toLowerCase().trim()`, but login performs the lookup using the raw input.
- **Impact:** Valid credentials may fail for mixed-case or surrounding whitespace, even though signup normalized the value.
- **Recommended Fix:** Normalize login email identically to signup.

### 8. Arbitrary profile enumeration and missing ownership/role policy

- **Severity:** Critical
- **Location:** `src/modules/user/user.controller.ts:13-20`; `src/modules/user/user.service.ts:9-12`
- **What Happens:** Any authenticated user can request `/user/account/:id`. The service returns `findById(id)` without checking `req.user._id` or authorization policy.
- **Impact:** It exposes and permits retrieval of other accounts once Mongoose and authentication behave normally.
- **Recommended Fix:** Treat account ID as optional/current-user data or enforce `id === req.user._id` / explicit admin authorization.

### 9. Profile response serializes password and internal fields

- **Severity:** Critical
- **Location:** `src/modules/user/user.controller.ts:13-20`; `src/DB/models/user.model.ts:7-48`
- **What Happens:** The repository returns a Mongoose document without a projection or `toJSON` transform. It contains password hash, role, provider, phone, confirmation data, credential-change time, timestamps, and internal Mongoose fields.
- **Impact:** Password hashes and sensitive account metadata can be disclosed to authenticated callers.
- **Recommended Fix:** Add `select: false` to password and `toJSON`/public DTO mapping, exclude password by default in repository queries, and return only approved fields.

### 10. OTP confirmation stores a Date in a String field

- **Severity:** Medium
- **Location:** `src/modules/auth/auth.service.ts:107-108`; `src/DB/models/user.model.ts:37-43`; `src/common/interface/user.interfasce.ts:13-14`
- **What Happens:** `confirmEmail` is declared as `string` in the interface and Mongoose schema, but confirmation assigns `new Date() as unknown as string`.
- **Impact:** Mongoose will cast to String at runtime, and the application's type contract is false. Confirmed date format/semantics are inconsistent.
- **Recommended Fix:** Use `confirmEmail: Date` consistently in schema and interface, or store an ISO string intentionally and name it clearly.

### 11. OTP resend lookup/email keys are not normalized

- **Severity:** Medium
- **Location:** `src/modules/auth/auth.service.ts:111-121`
- **What Happens:** Signup sends OTP using lowercased email, but resend sends the raw email from request directly. Confirm normalizes correctly.
- **Impact:** Resend fails or creates a cache entry under a different key for mixed-case/whitespace input.
- **Recommended Fix:** Normalize and validate email at each auth entry, ideally in Zod and once in the service.

### 12. OTP rate-limit state is race-prone

- **Severity:** Medium
- **Location:** `src/modules/auth/auth.service.ts:21-52`
- **What Happens:** TTL check and trail increment are independent Redis operations; concurrent requests can all pass TTL/trail checks.
- **Impact:** Throttling can be bypassed temporarily by concurrent resend/signup attempts.
- **Recommended Fix:** Use an atomic Lua script or a Redis transaction to check and increment trail count and set TTL atomically.

### 13. OTP value is hashed but `EventEmitter.emit` does not ensure delivery

- **Severity:** Medium
- **Location:** `src/modules/auth/auth.service.ts:50`; `src/common/events/event.email.ts:7-21`
- **What Happens:** The async email listener is invoked via `EventEmitter.emit`, but emit does not await it. Listener failures are caught and logged, and signup still appears successful.
- **Impact:** Redis stores a valid OTP while email delivery can fail silently, and resend/signup return success despite no email sent.
- **Recommended Fix:** Replace the listener with an awaited email service call or return delivery status. Consider a queue/retry mechanism.

### 14. Password update paths are not hashed

- **Severity:** Medium
- **Location:** `src/DB/models/user.model.ts:68-72`; `src/DB/repositories/main.repo.ts:140-173`
- **What Happens:** The `pre("save")` hook hashes passwords, but repository `updateOne` and `updateMany` bypass save middleware.
- **Impact:** Any password update added through these generic repository methods will store plaintext or fail to rotate credentials consistently.
- **Recommended Fix:** Never accept raw password in bulk updates, and either use save hooks or explicitly hash password fields in update operations.

### 15. Invalid/signup ObjectId routes are not validated

- **Severity:** Medium
- **Location:** `src/modules/user/user.controller.ts:13-20`
- **What Happens:** `/account/:id` is passed directly to Mongoose even though `generalRules.id` exists.
- **Impact:** Invalid IDs can trigger cast errors and inconsistent 500 responses.
- **Recommended Fix:** Apply a Zod params schema and return `400` for invalid IDs.

### 16. Incorrect HTTP status codes

- **Severity:** Low
- **Location:** `src/modules/auth/auth.controller.ts:25,52`; `src/modules/user/user.controller.ts:20`; `src/app.bootstrap.ts:18-22`
- **What Happens:** Login/profile are returned with `201`, and rate-limit responses use `427` rather than standard `429`.
- **Impact:** API clients cannot rely on conventional status semantics.
- **Recommended Fix:** Use `201` for signup only, `200` for login/profile, and `429` for throttling.

## 4. TypeScript, Types & Data Layer Issues

### 4.1 Confirmed high-risk typing issues

| Location | Issue | Recommended fix |
|---|---|---|
| `src/DB/models/user.model.ts:76` | `const query:any=this.getQuery` introduces `any` and tries to destructure a function. | Remove or type the hook as Mongoose `Query`; call `getFilter()`/`getQuery()` and preserve filters. |
| `src/DB/repositories/main.repo.ts:43,45` | `model.create(data as any)` discards type safety. | Use overloads and `AnyKeys<T>`, or `model.create<T>(data)` and let Mongoose types verify. |
| `src/common/security/hash.security.ts:8` | `Compare(plainText:any,cipherText:any)` accepts any values. | Define `Compare(plainText: string, cipherText: string): Promise<boolean>`. |
| `src/common/interface/response.interface.ts:3-4` | `data?: any`, `extra?: any` leak unbounded types. | Use `unknown` or a generic `IResponse<T>`. |
| `src/modules/auth/auth.service.ts:107` | `new Date() as unknown as string` is a deliberate type bypass. | Change `confirmEmail` to `Date` in both schema and `Iuser`. |
| `src/common/service/token.service.ts:40` | `jwt.verify(...) as JwtPayloadType` trusts runtime JSON. | Validate payload shape with Zod or explicit guards before user ID/revoke operations. |
| `src/modules/user/user.controller.ts:20` | `req.params.id as string` is an assertion with no validation. | Validate params and preserve the inferred string in the Zod result. |
| `src/common/security/encryption.security.ts:12-17` | Cipher text deserialization uses tuple assertion and unchecked Buffer text. | Validate `ivHex:cipherText`, key length, IV length, and hexadecimal format before decryption. |
| `src/common/interface/user.interfasce.ts` | `phone`, `confirmEmail`, `provider`, `changeCredentialTime`, and role fields are modeled as always present but several are optional/defaulted. | Define `phone?:`, `confirmEmail?:`, and `changeCredentialTime?:`; use a creation DTO separate from persisted user type. |

### 4.2 Schema vs interface drift

- `Iuser` requires `role`, `gender`, `phone`, `confirmEmail`, `provider`, and `changeCredentialTime`, while signup supplies only name, email, password, phone, gender, and age.
- `Iuser.confirmEmail` is `string`, but confirmed state should be `Date` or a nullable boolean/date marker.
- Mongoose `age` is required, but `signupSchema` makes it optional.
- Mongoose `password` is required and not optional, which will not fit any future Google/social provider flow unless provider-specific validation and password handling are introduced.
- Mongoose contains `timestamps`, but `Iuser` does not declare `createdAt`/`updatedAt`.
- Mongoose has no `isDeleted` field, but the query hook attempts to add it.
- The generic repository interface returns `HydratedDocument<T>[]`; Mongoose `.lean()` or flatten maps are possible but not represented consistently.

### 4.3 TypeScript configuration issues

- `strict` is enabled, but `skipLibCheck` is enabled and `types: []` excludes Node ambient types; Node APIs still compile because direct imports/types resolve in this workspace.
- `noImplicitReturns`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `isolatedModules` are good strictness settings.
- `noImplicitAny`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, and `noPropertyAccessFromIndexSignature` are commented out.
- `moduleDetection: "force"` is valid, but the package is CommonJS (`"type": "commonjs"`) while TypeScript's `"nodenext"` module mode may emit `.js` CJS files. `.js` imports in source are mapped to emitted files and work in this build, but the setup is harder to audit and should be explicitly documented.
- `jsx: "react-jsx"` is irrelevant to a Node-only API and can remain but adds noise.
- No `sourceMap`, declaration, or build-time test config.

### 4.4 Build verification

- `tsc --noEmit` completed successfully with zero diagnostics in the current environment.
- A direct `tsc` emit completed successfully and populated `dist`.
- `tsc --noEmit` proving type cleanliness does not validate runtime behavior or Mongoose middleware correctness.

### 4.5 Repository and pagination issues

- `src/DB/repositories/main.repo.ts:108-116` accepts `limit` and then computes `skip` and `totalPages` without validation. A caller can pass `limit: 0`, negative, or a huge value.
- `src/DB/repositories/main.repo.ts:96-107` mutates `filter` to add regex search text, and `searchField` is unchecked against trusted keys. This could expose arbitrary Mongoose operators or field names if exposed publicly.
- `src/DB/repositories/main.repo.ts:81-85` merge order `{ new: true, ...options }` lets supplied `new: false` override the `new: true` default.
- `src/DB/repositories/main.repo.ts:43-45` uses `as any` for create payloads.

## 5. Security & Auth / Authorization Review

### 5.1 Confirmed secrets exposure

- **Severity:** Critical
- **Location:** `src/config/.env.development:1-27`, `src/config/.env.production:1-27`
- **What Happens:** The files contain a MongoDB username/password, Redis URL/password, JWT signatures, AES key, Gmail app passwords, Google client ID, and a Brevo API key.
- **Impact:** Anyone with repository/workspace access may obtain database, email, Redis, and API credentials. JWT signatures allow forging sessions if used outside the application. The MongoDB URI includes plaintext credentials.
- **Recommended Fix:** Rotate all credentials immediately. Purge them from source history if ever committed. Store secrets in a secret manager or CI/environment variables. Keep only `.env.example` in source with empty placeholders.

### 5.2 CORS is effectively unrestricted

- **Severity:** High
- **Location:** `src/app.bootstrap.ts:25`; `src/config/config.service.ts:24-26`
- **What Happens:** `app.use(express.json(), cors(), limiter)` calls CORS with default allow-all behavior. `ALLOWED_ORIGINS` is parsed but never used.
- **Impact:** Browser origins are allowed unless a higher-level deployment policy blocks them.
- **Recommended Fix:**

```ts
cors({
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error("Origin not allowed"));
  },
  credentials: true,
})
```

### 5.3 Authentication checks are incomplete

- **Severity:** High
- **Location:** `src/modules/auth/auth.service.ts:126-137`
- Confirmed: login does not verify `confirmEmail`.
- Confirmed: login does not verify `provider === ProviderEnum.SYSTEM`.
- Unverified: whether another provider implementation exists outside this repository; no such implementation is present.
- **Recommended Fix:** Explicitly block unconfirmed accounts and disallow password login for OAuth accounts.

### 5.4 Authorization middleware is present but not broadly applied

- **Severity:** High
- **Location:** `src/middleware/authorization.middleware.ts`; `src/modules/user/user.controller.ts`
- **What Happens:** Only authentication is applied to profile routes. The `authorization` middleware is not mounted anywhere in the routers.
- **Impact:** No role/permission check exists for account access or future admin operations.
- **Recommended Fix:** Apply explicit role and resource ownership middleware to each route.

### 5.5 Profile/hash data exposure

- **Severity:** Critical
- **Location:** `src/modules/user/user.controller.ts:13-20`
- Password hash and confidential fields are exposed as Mongoose document JSON. The exact serialized shape depends on Mongoose defaults, but password is present in the schema and no projection/toJSON exclusion exists.
- **Recommended Fix:** Set `password: { select: false }`, add public DTO serialization, and never return full hydration documents.

### 5.6 JWT validation gaps

- **Severity:** High
- **Location:** `src/common/service/token.service.ts:31-40`; `src/middleware/authentication.middleware.ts:34-43`
- Runtime payload shape is asserted after `jwt.verify`.
- `issuer` is derived from attacker-controlled HTTP Host through `req.host` and signed into login tokens, but verification has no issuer allowlist.
- Access tokens are hardcoded to one hour and ignore `ACCESS_TOKEN_EXPIRES_IN`.
- Refresh token expiry is Number-coerced; malformed environment values become `NaN`/unexpected behavior.
- No refresh-token exchange/revocation route is implemented in the codebase.
- **Recommended Fix:** Configure a stable server issuer, verify it explicitly, validate payload with Zod, enforce refresh rotation, and revoke on credential reset/password change.

### 5.7 Logout/revoke implementation is incomplete

- **Severity:** High
- **Location:** `src/common/service/token.service.ts:104-123`
- `createRevokeToken` exists but no route calls it.
- Redis revocation lookup uses `payload.jti`, but if a supplied malformed payload lacks `jti`, the key may be incorrect.
- **Recommended Fix:** Add logout and refresh revoke endpoints, validate `jti` and subject, and ensure all sessions can be revoked.

### 5.8 Password and encryption handling

- Passwords are hashed with bcrypt and never compared in plain text.
- `Compare` and `Hash` use bcrypt correctly, despite unsafe TypeScript parameter types.
- AES key handling has no validation. The development key is 32 bytes and works, but if `ENCRYPTION_KEY` is omitted and fallback 38-byte text is used, AES-256-CBC initialization can throw.
- CBC encryption is unauthenticated, so ciphertext can be tampered with undetectably. It also derives no per-purpose key or key rotation identifier.
- **Recommended Fix:** Derive/validate a 32-byte key, rotate secrets, prefer AES-GCM or Envelope Encryption, and include authentication data/key version.

### 5.9 OTP security

- OTP values are six digits (600,000 possibilities), hashed in Redis, and expire after 300 seconds.
- Confirmed: requests can brute force below OTP-level rate limit due to a Redis trial race and no shared attempt counter on failed confirmations.
- The 3-trial Redis state blocks resend, but there is no equivalent failed-`confirmEmail` counter.
- `confirmEmail` and `resendOTP` are not Zod validated.
- **Recommended Fix:** Add per-user confirmation attempt counter, use a constant-time compare library, lock after attempts, and normalize email.

### 5.10 Input and injection risks

- Zod signup validation rejects unknown fields? Zod 4 object stripping defaults to ignoring unknown keys. Unknown fields are removed rather than rejected.
- Email allowlist arbitrarily excludes valid email domains and can break legitimate users.
- No request body size limit beyond Express default 100KB.
- MongoDB repository search can pass user-controlled regex and field names. It is not currently mounted in a public search route, but the repository is unsafe as a reusable API surface.
- Redis keys are built directly from email in key names. OTP email is constrained by signup Zod but confirm/resend routes are unvalidated. Redis key injection is not a common DB injection, but unbounded/odd input can create unexpected cache keys.

### 5.11 Error and secret leakage

- Global handler returns `err`, `stack`, `cause`, and `err_message` in every environment.
- This may expose JWT details, database errors, stack paths, and internal exception objects.
- The `NotFoundException` constructor does not forward `cause`, although that is less severe.
- **Recommended Fix:** Return stable public error codes and environment-blinded messages. Log the full error only server-side.

## 6. Error Handling, Logging & Resilience

### Confirmed issues

- `src/DB/connection.db.ts:8-10` logs and swallows MongoDB connection failures.
- `src/index.ts:3` calls `bootstrap()` without `await`/`.catch()`.
- `src/app.bootstrap.ts:27-28` awaits MongoDB and Redis sequentially but no startup timeout or readiness endpoint is present.
- `src/middleware/error.middleware.ts:3-13` leaks stack, cause, and the error object.
- `src/middleware/response.middleware.ts:9-23` depends on every handler resolving to `IResponse`; it does not catch thrown errors itself, relying on Express 5 promise handling.
- `src/middleware/validation.middleware.ts:27-32` throws inside synchronous middleware, which Express 5 handles, but it provides Zod issue objects as `cause`.
- Redis and email services mix operational `console.log/error` with thrown errors.
- The email listener catches and suppresses delivery errors, so callers cannot know whether email was sent.
- No graceful shutdown for HTTP, MongoDB, or Redis is implemented.
- No process signal handlers, health check, readiness check, or liveness check exist.
- No structured/correlation/request logging exists.
- No retry/backoff policy is implemented for database, Redis, or SMTP; Redis only listens to error events.
- No transaction/compensating operation exists for signup (database created before OTP cache/email).

### HTTP behavior issues

- Unhandled Mongoose cast errors can become a 500 instead of 400 unless a global mapping is added.
- Duplicate-key races can become 500 instead of 409.
- Invalid OTP and invalid credentials are 400/404 respectively and may assist enumeration of account state. Login should use a generic 401 or 400.
- Missing routes may not reach the wildcard because `app.get("/")` is registered after `app.listen`, and Express middleware/routing setup generally occurs before listen but the wildcard setup happens before listen invocation call completes. The wildcard should be explicitly tested under Express 5.
- The wildcard path `'{/*dumm}'` is non-obvious Express 5 syntax and has no regression test.

### Recommended pattern

```ts
export const globalError = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) return;

  if (err instanceof AppException) {
    return res.status(err.status).json({ message: err.message });
  }

  logger.error({ err });
  return res.status(500).json({ message: "Internal server error" });
};
```

## 7. Code Quality, Duplication & Maintainability Notes
## 7.  2for 3b8any

- The architecture is generally easy to follow: router -> response formatter -> service -> repository.
- Naming typos and inconsistencies:
  - `generelRules.ts` instead of `generalRules.ts`
  - `cacheServise` instead of `cacheService`
  - `DBRepo.interface.ts`
  - `user.interfasce.ts`
  - `security.emum.ts`
- Duplicate `bcrypt`/`bcryptjs` dependencies are present; application code imports `bcrypt` only.
- `src/common/security/token.security.ts` is entirely commented old implementation and dead code.
- `sendEmail` and `eventEmitterEmail` imports are unused in `src/app.bootstrap.ts:11-13`.
- `mongoose`, `randomUUID`, `Hash`, `Encrypt`, `SALT`, access/refresh imports have unused or partial usage in auth/model/service files.
- `UserService` imports Mongoose and Redis but does not use them.
- `AuthService` imports unused encryption, Hash, randomUUID, and token constants.
- `AuthService` keeps private `cacheServise` and `userRepo`, then instantiates them correctly but no interface abstraction exists.
- `NotFoundException` constructor signature omits forwarding `cause`.
- Exception types do not use `override` and no HTTP error code enum exists.
- Response API is inconsistent: many routes return a truthy `message` but no clear data contract.
- Login returns signup text in `extra`.
- Console logging appears in config, DB, Redis, email, and model hooks.
- No tests, linting, formatting, or CI configuration is present.
- No README/onboarding documentation exists.
- Email template is 372 lines and hardcodes Social app/footer and copyright text; its size could be split into layout/component/escape helpers.
- The repository has no soft-delete implementation despite a soft-delete query attempt.
- `createUser` in `UserRepo` has a weak API and is unused.
- `main.repo.ts` is 149 lines and contains no runtime validation for page/limit/search.
- Environment parsing uses `parseInt` without range validation.
- `PROJECT_NAME`, `PORT`, token values, and key sizes are exported as strings/numbers without startup validation.

## 8. Configuration, Environment & Build / Tooling Notes

### Package scripts

- `start` runs compiled `dist/index.js` but no build script is present.
- `start:conc` launches `tsc --watch` and nodemon concurrently.
- There is no `build`, `dev`, `test`, `lint`, `format`, `clean`, or `typecheck` script.
- The package `"main"` field is `"index.js"` rather than `"dist/index.js"`.
- No `engines` field documents required Node.js version. Redis 6 declares Node >=20.
- `typescript` is declared `^7.0.2`, unusually specific for a project likely intended for Node. The lockfile resolves the declared version; no compatibility matrix is documented.
- `@types/bcryptjs` is in dependencies instead of devDependencies and the package itself is unused.
- `bcryptjs` is installed but application code uses native `bcrypt`; this is unnecessary duplication.

### Environment

- Environment files live at `src/config/.env.*`, as opposed to conventional repository root `.env.*`.
- Dotenv loads the file after reading `NODE_ENV` but before exported values are initialized.
- `NODE_ENV` is logged before dotenv loads.
- `DB_URI`, signatures, Redis URI, email values, and API key types are asserted with `as string` rather than validated.
- The app falls back to weak/default secrets for encryption, and JWT secrets can be `undefined` at runtime.
- No `.env.example` exists.
- Both environment files are covered by `.gitignore`, and `git ls-files` returned no tracked copies. The delivery/workspace may still contain them, but they are not confirmed committed. Rotation is still mandatory because local copies are production-like secrets.

### TypeScript/build

- Root and output directories are configured.
- TSC emit succeeds and `dist` is generated.
- No source map is emitted.
- No incremental build cache or declarations are configured.
- `types: []` should be re-evaluated after adding Node test tooling.
- CommonJS package mode plus ESM-like `.js` source imports require testing with the exact Node version/lockfile.
- No build copies non-code assets (none exist).

### Missing operational files

- No README
- No Dockerfile or Compose file
- No CI workflow
- No ESLint/Prettier configuration
- No Jest/Vitest/Mocha/Supertest setup
- No OpenAPI/Swagger contract
- No migration tooling or seed scripts

## 9. Prioritized Action Plan

### Immediate (Fix First / Blockers)

1. **Rotate credentials and remove secrets from environment files.** MongoDB, Redis, Gmail, JWT, encryption, Google, and Brevo values must be rotated.
2. **Fix Mongoose hooks.** Remove the current pre-find hook or implement it with `getFilter()` and a real soft-delete field.
3. **Fail startup on MongoDB/Redis failure.** Rework `connectionDB`, `bootstrap`, and `src/index.ts`.
4. **Restrict profile data.** Enforce ownership/admin authorization and add password exclusion/public DTO.
5. **Add login safeguards.** Normalize email, check confirmed email/provider, and return generic credential failures.
6. **Add validation.** Validate login, confirm OTP, resend OTP, and profile ID params.
7. **Fix signup contract.** Decide whether age is required and update schema/interface/service consistently.
8. **Remove sensitive global error output.** Return stable messages and log stacks only server-side.
9. **Configure CORS using `ALLOWED_ORIGINS`.**
10. **Correct the `427` rate-limit status to `429`.**

### Short-Term (Next Refactoring Pass)

1. Add integration tests for signup, confirmation, resend, login, authorization, and profile lookup.
2. Add unit tests for repositories, Redis atomic operations, JWT payload validation, encryption, hashing, and Zod rules.
3. Replace async EventEmitter email delivery with an awaited service call or queue.
4. Implement atomic OTP resend and confirmation attempt counters.
5. Add refresh/login/logout/revoke endpoints and credential-change revocation.
6. Add Mongoose `toJSON` projection and password `select: false`.
7. Replace `console` with structured logging and add request IDs.
8. Implement graceful shutdown and health/readiness endpoints.
9. Add environment schema validation (Zod) and production-secret enforcement.
9. Add `build`, `typecheck`, `test`, `lint`, `format`, and `dev` scripts.
10. Rename misspelled files and variables.
11. Remove duplicate/dead dependencies and unused imports/dead token implementation.
12. Add public API documentation and error/response contracts.

### Long-Term (Architecture & Scaling)

1. Use separate account write/read DTOs and domain interfaces.
2. Introduce account status, soft delete, and migration-tested Mongoose schema fields.
3. Move OTP/email delivery to a durable queue with retries and delivery audit records.
4. Use AES-GCM or envelope encryption and support key rotation.
5. Add Redis cluster-compatible health/retry behavior and Mongo transaction support where needed.
6. Use a centralized API error type and observability stack.
7. Split the generic repository search and pagination logic into validated primitives.
8. Add CI gates for strict TypeScript, lint, unit tests, integration tests, dependency audit, secret scanning, and container/package smoke tests.
9. Define deployment manifests and separate development/staging/production configuration.
