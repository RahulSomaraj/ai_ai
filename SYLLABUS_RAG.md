# Syllabus-Controlled RAG — Step 2 (Postgres syllabus + topic-aware retrieval)

This step makes the **syllabus first-class in Postgres** and **wires it into RAG**.
Since content (documents, chunks, embeddings) already exists, this does **not**
re-process any PDFs — it maps your existing chunks to syllabus topics by reusing
the vectors already stored, and lets retrieval scope answers to a topic or unit.

PDF import/auto-structuring is intentionally deferred to a later step.

## What changed

**Schema (new tables + column)**
- `units` — syllabus units, scoped to a `Subject` (subject name + class).
- `topics` — topics under a unit, with `learning_outcomes`.
- `topic_embeddings` — one `vector(1536)` per topic (name + outcomes).
- `chunks.topic_id` — optional FK linking each chunk to a syllabus topic.

**New / changed endpoints**
- `POST /syllabus/import` — upsert a syllabus (units + topics) into Postgres. Idempotent by `unit_id`/`topic_id`.
- `GET  /syllabus/db/:subjectId/structure` — units + topics for a subject.
- `GET  /syllabus/db/:subjectId/topics` — flat topic list.
- `POST /rag/topics/embed` — embed all topics for a subject.
- `POST /rag/topics/map` — assign existing chunks to their nearest topic (reuses chunk embeddings).
- `GET  /rag/topics/coverage/:subjectId` — chunks per topic + untagged count.
- `POST /rag/ask` — now accepts `topicCode`, `unitCode`, `rejectOutOfScope`, and returns topic info in citations.

The legacy file-based `POST /syllabus` and `GET /syllabus/:board/...` routes are unchanged (kept for compatibility, tagged `[Legacy]` in Swagger).

## Apply it

From the project root (paths are your machine):

```bash
# 1. Apply the new migration (creates units/topics/topic_embeddings, adds chunks.topic_id)
npx prisma migrate deploy

# 2. Regenerate the Prisma client so the new models/fields are typed
npm run prisma:generate

# 3. Build + run
npm run start:dev
```

> If `migrate deploy` reports nothing pending, the migration folder
> `prisma/migrations/20260712120000_syllabus_topics` may not have been picked up —
> confirm it exists, then retry. `npx prisma migrate dev` also works and will
> apply it. The migration assumes the `vector` extension is already enabled
> (it was created by the init migration).

## Use it (end-to-end, using the seeded Physics 11 subject)

Assuming `subjectId = seed-11-physics` (from your existing seed) and `OPENAI_API_KEY` is set.

```bash
# 1. Import the syllabus into Postgres (reuses your data/syllabus JSON shape)
curl -sS -X POST http://localhost:3000/v1/syllabus/import \
  -H 'Content-Type: application/json' \
  --data-binary @data/syllabus/sample_syllabus.json

# 2. Embed the topics
curl -sS -X POST http://localhost:3000/v1/rag/topics/embed \
  -H 'Content-Type: application/json' \
  -d '{"subjectId":"seed-11-physics"}'

# 3. Map existing chunks to topics (reuses chunk embeddings; no re-processing)
curl -sS -X POST http://localhost:3000/v1/rag/topics/map \
  -H 'Content-Type: application/json' \
  -d '{"subjectId":"seed-11-physics"}'

# 4. Check coverage — how many chunks landed on each topic
curl -sS http://localhost:3000/v1/rag/topics/coverage/seed-11-physics

# 5. Ask, scoped to a syllabus topic (only chunks tagged PHY_U1_T3 are used)
curl -sS -X POST http://localhost:3000/v1/rag/ask \
  -H 'Content-Type: application/json' \
  -d '{
    "subjectId":"seed-11-physics",
    "classLevel":11,
    "question":"How many significant figures are in 0.0420?",
    "topicCode":"PHY_U1_T3",
    "rejectOutOfScope":true
  }'
```

The `ask` response now includes `topicCode`/`topicName` on each citation and a
`received.topicScoped` flag. With `rejectOutOfScope:true`, a question with no
in-scope passage returns **HTTP 403** instead of falling back to nearest chunks.

## How topic mapping works

`POST /rag/topics/map` runs a single set-based SQL pass:

1. Scope = chunks whose document `subject` + `class_level` match the subject.
2. For each chunk, find the nearest `topic_embeddings` row (pgvector cosine).
3. If similarity ≥ `minSimilarity` (default `RAG_TOPIC_MIN_SIMILARITY=0.3`), set `chunk.topic_id`.

Tune with the request body: `{"subjectId":"...","minSimilarity":0.35,"onlyUntagged":true}`.
`onlyUntagged:true` leaves already-tagged chunks alone (useful after adding new content).

## New env var (optional)

```env
RAG_TOPIC_MIN_SIMILARITY=0.3   # threshold for tagging a chunk with its nearest topic
```

## Notes / things to verify on first run

- **Array param in retrieval**: topic-scoped `ask` filters chunks with
  `c.topic_id = ANY($n::text[])`. If your Prisma/pg version rejects the array
  binding, tell me and I'll switch it to a resolved `IN (...)` list.
- Re-run `topics/embed` **and** `topics/map` after editing a syllabus, since
  changing topic names/outcomes changes their vectors.
- Mapping is re-runnable and non-destructive; it only sets `topic_id`.
