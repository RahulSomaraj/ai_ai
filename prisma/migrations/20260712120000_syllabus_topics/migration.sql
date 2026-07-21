-- Syllabus becomes first-class in Postgres: units + topics + topic embeddings,
-- and RAG chunks gain an optional topic_id so retrieval can be syllabus-scoped.

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "learning_outcomes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic_embeddings" (
    "topic_id" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "model" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topic_embeddings_pkey" PRIMARY KEY ("topic_id")
);

-- AlterTable: link chunks to a syllabus topic (nullable, back-filled by mapping)
ALTER TABLE "chunks" ADD COLUMN "topic_id" TEXT;

-- CreateIndex
CREATE INDEX "units_subject_id_idx" ON "units"("subject_id");

-- CreateIndex
CREATE UNIQUE INDEX "units_subject_id_code_key" ON "units"("subject_id", "code");

-- CreateIndex
CREATE INDEX "topics_unit_id_idx" ON "topics"("unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "topics_unit_id_code_key" ON "topics"("unit_id", "code");

-- CreateIndex
CREATE INDEX "chunks_topic_id_idx" ON "chunks"("topic_id");

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topics" ADD CONSTRAINT "topics_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic_embeddings" ADD CONSTRAINT "topic_embeddings_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
