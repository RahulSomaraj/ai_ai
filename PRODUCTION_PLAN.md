# Production-Readiness Plan — AI AI (Syllabus-Controlled RAG)

An implementation spec for **Claude Code** to harden this repo from a working
MVP feature into a production-ready service. Each work item is self-contained:
goal, files, exact dependencies, implementation notes, acceptance criteria, and
verification commands. Do them in the order listed; later items assume earlier
ones are done.

> **How to use this:** hand Claude Code one work item at a time (P0 first).
> After each, run its **Verify** block and confirm **Acceptance** before moving on.

---

## Repo context (ground truth for the implementer)

- **Stack:** NestJS 11, TypeScript 5.7, Prisma 6 (PostgreSQL + `pgvector`), OpenAI SDK v4, Swagger.
- **Global route prefix:** `v1` (set from `appConfig.globalPrefix` in `src/main.ts`). All URLs below use `/v1/...`.
- **Global pipe:** `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })` already enabled in `main.ts`.
- **Config:** namespaced via `registerAs` in `src/config/*.config.ts`, loaded in `src/config/config.module.ts` (`isGlobal: true`).
- **DB access:** `PrismaService` (`src/prisma/prisma.service.ts`), `PrismaModule` is `@Global()`.
- **Key modules:** `src/rag` (ingest/ask/topics), `src/syllabus` (Postgres + legacy file store), `src/subjects`, `src/textbooks`.
- **Vectors:** `chunk_embeddings.embedding vector(1536)` and `topic_embeddings.embedding vector(1536)`; queried with the pgvector `<=>` cosine operator via `$queryRawUnsafe`.
- **Conventions to follow:** keep the namespaced-config pattern; keep DTOs in `dto/` with class-validator decorators and `@ApiProperty`; add `@ApiOperation`/`@ApiResponse` to new endpoints; do not commit secrets.

**Do not touch** the deferred PDF auto-structuring feature — out of scope here.

---

## P0 — Verify it builds, migrates, and answers (gate)

**Goal:** Prove the current code (schema + step-2 syllabus/topic feature) compiles, migrates, and returns a topic-scoped answer before hardening anything.

**Steps**
1. `npx prisma migrate deploy` then `npm run prisma:generate`.
2. `npm run build` — fix any TypeScript errors.
3. `npm run start:dev`, then run the end-to-end curl sequence in `SYLLABUS_RAG.md` (import → topics/embed → topics/map → coverage → ask with `topicCode`).

**Known risk to check:** topic-scoped `ask` filters chunks with
`c.topic_id = ANY($n::text[])` (see `src/rag/rag.service.ts`). If Prisma rejects
the array binding at runtime, replace the array param with a safe interpolated
`IN ('uuid1','uuid2')` list built from the resolved topic UUIDs (they are
DB-generated UUIDs, so validate each with a UUID regex before interpolating).

**Acceptance**
- `npm run build` exits 0.
- The `ask` call with `topicCode` returns `status:"answered"` and citations that include `topicCode`/`topicName`.
- `GET /v1/rag/topics/coverage/:subjectId` shows non-zero chunk counts on at least one topic.

**Verify**
```bash
npm run build && echo BUILD_OK
curl -sS http://localhost:3000/v1/rag/topics/coverage/seed-11-physics | head
```

---

## P1 — Secrets hygiene

**Goal:** Stop tracking secrets; make config reproducible.

**Files**
- `.gitignore` — ensure `.env` (and `.env.*` except `.env.example`) are ignored.
- `.env.example` — new; every key the app reads, with placeholder values and comments. Include: `PORT`, `NODE_ENV`, `DATABASE_URL`, `OPENAI_API_KEY`, `OPENAI_EMBED_MODEL`, `OPENAI_CHAT_MODEL`, `RAG_TOP_K`, `RAG_MIN_SIMILARITY`, `RAG_TOPIC_MIN_SIMILARITY`, plus the new keys from P2/P5 (`API_KEYS`, throttle vars).
- If `.env` is already committed: `git rm --cached .env` and tell the user to **rotate any key that was ever committed**.

**Acceptance:** `git status` shows `.env` untracked/ignored; `.env.example` present and complete.

**Verify**
```bash
git check-ignore .env && echo IGNORED
test -f .env.example && echo EXAMPLE_OK
```

---

## P2 — Authentication + rate limiting (highest security priority)

**Goal:** No unauthenticated access; cap request volume so OpenAI-hitting endpoints can't be abused.

**Install**
```bash
npm i @nestjs/throttler
```

**Auth design — API-key guard (pragmatic; matches the scaffolded bearer):**
- New `src/auth/api-key.guard.ts`: a global `CanActivate` that reads `x-api-key` header (also accept `Authorization: Bearer <key>`), compares against a set from config `security.apiKeys` (parsed from env `API_KEYS`, comma-separated). Reject with `401 UnauthorizedException` when missing/invalid.
- New `src/auth/public.decorator.ts`: `@Public()` using `SetMetadata('isPublic', true)`; the guard skips public routes.
- New `src/config/security.config.ts`: `registerAs('security', () => ({ apiKeys: (process.env.API_KEYS||'').split(',').map(s=>s.trim()).filter(Boolean) }))`; add to the `load: [...]` array in `config.module.ts` and to `src/config/index.ts`.
- Register the guard globally in `src/app.module.ts` via `{ provide: APP_GUARD, useClass: ApiKeyGuard }`.
- Mark `GET /v1/rag/status` and the Swagger UI path `@Public()` (health from P4 too). Keep Swagger's `addBearerAuth` and add `@ApiSecurity`/`@ApiBearerAuth` on protected controllers so "Authorize" works in the UI.

**Rate limiting**
- Import `ThrottlerModule.forRoot([{ ttl: seconds, limit: n }])` in `app.module.ts` using config env `THROTTLE_TTL` (default 60) and `THROTTLE_LIMIT` (default 60).
- Register `{ provide: APP_GUARD, useClass: ThrottlerGuard }` globally (order after the api-key guard).
- Apply a **stricter** limit to OpenAI-hitting routes with `@Throttle({ default: { ttl: 60, limit: 10 } })` on: `POST /rag/ask`, `POST /rag/ingest`, `POST /rag/ingest/pdf`, `POST /rag/topics/embed`, `POST /rag/topics/map`.

**Acceptance**
- A request without a valid key → `401`.
- With a valid key → works as before.
- Exceeding the per-route limit → `429`.
- `GET /v1/rag/status` works without a key.

**Verify**
```bash
curl -si http://localhost:3000/v1/rag/ask -X POST -H 'content-type: application/json' -d '{}' | head -1   # expect 401
curl -si http://localhost:3000/v1/rag/status | head -1                                                      # expect 200
curl -si http://localhost:3000/v1/rag/ask -X POST -H "x-api-key: $API_KEYS" -H 'content-type: application/json' \
  -d '{"classLevel":11,"question":"test"}' | head -1                                                        # expect 200/403/200-ish, not 401
```

---

## P3 — Vector ANN index (retrieval scale)

**Goal:** Replace sequential vector scans with an approximate-nearest-neighbor index so retrieval stays fast as content grows.

**Files**
- New Prisma migration `prisma/migrations/<timestamp>_vector_hnsw_index/migration.sql` (hand-authored, because the vector columns are `Unsupported` in the schema and Prisma won't generate this):

```sql
-- HNSW indexes for cosine distance (matches the <=> operator used in queries)
CREATE INDEX IF NOT EXISTS chunk_embeddings_embedding_hnsw
  ON chunk_embeddings USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS topic_embeddings_embedding_hnsw
  ON topic_embeddings USING hnsw (embedding vector_cosine_ops);
```
- If the installed pgvector version predates HNSW (< 0.5.0), fall back to IVFFlat:
  `CREATE INDEX ... USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);` and `ANALYZE` the tables.

**Implementation notes:** no app-code change needed — the existing `ORDER BY embedding <=> $1` queries use the index automatically. Optionally set `SET hnsw.ef_search` per-session for recall tuning; leave default for now.

**Acceptance**
- Migration applies cleanly.
- `EXPLAIN` on a retrieval query shows an Index Scan using the hnsw/ivfflat index (once tables have enough rows).

**Verify**
```bash
npx prisma migrate deploy
psql "$DATABASE_URL" -c "\di+ chunk_embeddings_embedding_hnsw"
```

---

## P4 — Resilience & observability

**Goal:** Survive transient OpenAI/DB failures; make the service observable.

**A. OpenAI retry/backoff**
- New `src/rag/utils/retry.ts`: `withRetry(fn, { retries=3, baseMs=500 })` — exponential backoff with jitter; retry only on `429`/`5xx`/network errors, not on `400`.
- Wrap the network calls in `src/rag/embeddings.openai.ts` (`fetchEmbeddings`) and the chat call in `rag.service.ts` (`openai.chat.completions.create`) with `withRetry`.

**B. Health/readiness**
```bash
npm i @nestjs/terminus
```
- New `src/health/health.module.ts` + `health.controller.ts` exposing `GET /v1/health` (`@Public()`): checks DB connectivity (a `SELECT 1` via PrismaService) and reports OpenAI-key presence (not a live call). Register the module in `app.module.ts`.

**C. Structured logging (recommended, optional)**
```bash
npm i nestjs-pino pino-http
```
- Replace default logger with `nestjs-pino` in `main.ts`; redact `authorization`/`x-api-key` headers; include a request-id.

**D. Error tracking (optional, flag-gated)**
- If `SENTRY_DSN` is set, initialize Sentry in `main.ts` and add a global exception filter. No-op when unset.

**Acceptance**
- Simulated OpenAI `429` triggers retries then succeeds/fails cleanly (add a unit test in P5).
- `GET /v1/health` returns `200` with `{ status: "ok", db: "up" }` when DB is reachable, `503` when not.

**Verify**
```bash
curl -si http://localhost:3000/v1/health | head -1   # expect 200
```

---

## P5 — Tests

**Goal:** Cover the logic most likely to break. Jest + ts-jest are already configured (`package.json` jest block; `rootDir: src`).

**Unit (no DB, high value)**
- `src/rag/chunking.spec.ts` — `buildChunks`/`normalizeText`/`estimateTokens`: empty input, single short paragraph, oversized paragraph split by sentence, overlap correctness, `chunkIndex` monotonic.
- `src/rag/utils/optional-textbook-id.spec.ts` — placeholder stripping (`"string"`, `"uuid"`, empty, real id).
- `src/rag/utils/retry.spec.ts` (from P4) — retries on 429, gives up after N, no retry on 400.
- `src/rag/rag.service.spec.ts` — `resolveAskScope` and out-of-scope rejection, with `PrismaService`, `ConfigService`, and `SyllabusDbService` **mocked** (no real DB/OpenAI). Assert: `subjectId` path validates class, `textbookId` without `subjectId` throws, `rejectOutOfScope:true` + empty pool → `ForbiddenException`.
- `src/syllabus/syllabus-db.service.spec.ts` — `parseGradeToClass` bounds; `resolveTopicIds` merges unit scope + topic code (mock Prisma).

**E2E smoke (optional, DB-gated)**
- `test/rag.e2e-spec.ts` — boot the app with a test `DATABASE_URL`; skip if unset. Hit `/v1/rag/status` and (if `OPENAI_API_KEY` set) a full import→embed→map→ask flow.

**Acceptance**
- `npm test` passes; chunking + scope-resolution + retry are covered.
- CI (P6) runs `npm test` green.

**Verify**
```bash
npm test
```

---

## P6 — Ops: containerization, CI, env validation, backfill

**Goal:** Reproducible builds, automated checks, fail-fast config, and a one-shot data backfill.

**A. Env validation (fail fast)**
- In `config.module.ts`, add `@nestjs/config` `validationSchema` (Joi). `npm i joi`. Require `DATABASE_URL`; validate `OPENAI_API_KEY` present in production; coerce/validate numeric RAG vars and throttle vars. App should refuse to boot on invalid config.

**B. Dockerfile (multi-stage) + `.dockerignore`**
- `Dockerfile`: stage 1 installs deps + `prisma generate` + `npm run build`; stage 2 runs `node dist/main` on a slim node image, copying `dist`, `node_modules` (prod only), and `prisma/`. Entry runs `npx prisma migrate deploy` before `node dist/main` (or document running it separately).
- `.dockerignore`: `node_modules`, `dist`, `.git`, `.env`, `data/`.

**C. docker-compose for local dev**
- `docker-compose.yml`: a `pgvector/pgvector:pg16` (or `ankane/pgvector`) Postgres service with a volume, and the app service wired to it via `DATABASE_URL`. The DB image ships the `vector` extension.

**D. CI (GitHub Actions)**
- `.github/workflows/ci.yml`: on push/PR — `npm ci`, `npx prisma generate`, `npm run lint`, `npm run build`, `npm test`. Add a Postgres+pgvector service container for the e2e job (or keep e2e behind an env flag).

**E. Backfill script (multi-subject topic mapping)**
- `prisma/backfill-topics.ts` (add script `prisma:backfill:topics` in `package.json`): iterate every `Subject`, call the embed + map logic for each (import the functions from `src/rag/topic-mapping.ts`, or call the HTTP endpoints). Log per-subject counts and total untagged. Idempotent.

**Acceptance**
- `docker compose up` brings up DB + app; migrations apply; `/v1/health` is green.
- CI passes on a clean checkout.
- Invalid/missing `DATABASE_URL` prevents boot with a clear error.
- `npm run prisma:backfill:topics` tags chunks across all subjects and prints a summary.

**Verify**
```bash
docker compose up -d --build && sleep 8 && curl -si http://localhost:3000/v1/health | head -1
```

---

## Suggested execution order & dependencies

```
P0 (gate) ─▶ P1 ─▶ P2 ─▶ P3 ─▶ P4 ─▶ P5 ─▶ P6
                     │                     ▲
                     └── P5 tests cover P2/P4 behavior ┘
```

- **P0** must pass before anything else.
- **P2** (auth) is the top production blocker — do it early.
- **P3** is independent and quick; can slot anywhere after P0.
- **P5** depends on P4's `retry.ts` existing for the retry test.

## Definition of done (production-ready)

- [ ] Builds, migrates, and serves; topic-scoped `ask` verified (P0)
- [ ] No secrets in git; `.env.example` present (P1)
- [ ] All routes authenticated; OpenAI routes rate-limited (P2)
- [ ] Vector ANN index in place (P3)
- [ ] OpenAI calls retry on transient errors; `/v1/health` live (P4)
- [ ] Core logic unit-tested; `npm test` green in CI (P5)
- [ ] Dockerized, CI green, env-validated, backfill script available (P6)

## Explicitly out of scope

- PDF auto-structuring / heading detection / LLM section classification (a later feature step).
- Multi-tenancy, per-user billing, and a web UI.
