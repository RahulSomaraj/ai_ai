# Database Setup Guide - Prisma + PostgreSQL

## 🎯 Architecture Overview

```
Subject → Textbook → (Future: Chapter → Topic → Lesson)
```

**Foundation Entities:**
- **Subject**: Academic grouping (Physics, Chemistry, etc.)
- **Textbook**: Physical book (Physics Part 1, Part 2, etc.)

**Design Principles:**
- Subjects do NOT contain syllabus
- Subjects only own textbooks
- Syllabus will attach to textbooks later
- Clean separation, no overengineering

---

## 📋 Prerequisites

1. **PostgreSQL** installed and running
2. **Node.js** and npm installed
3. **Prisma CLI** (installed via npm)

---

## 🚀 Setup Steps

### 1. Configure Database URL

Create/update `.env` file:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/ai_ai_db?schema=public"

# Application
PORT=3000
NODE_ENV=development

# OpenAI (for embeddings)
OPENAI_API_KEY=your-api-key-here
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

### 2. Create PostgreSQL Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE ai_ai_db;

# Exit
\q
```

### 3. Generate Prisma Client

```bash
npx prisma generate
```

### 4. Run Migrations

```bash
# Create initial migration
npx prisma migrate dev --name init

# This will:
# - Create migration files
# - Apply to database
# - Generate Prisma Client
```

### 5. Verify Setup

```bash
# Open Prisma Studio (optional, for visual DB management)
npx prisma studio
```

---

## 📊 Database Schema

### Subject Model

```prisma
model Subject {
  id        String     @id @default(uuid())
  name      String     // "Physics"
  class     Int        // 11
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
  textbooks Textbook[]
}
```

### Textbook Model

```prisma
model Textbook {
  id         String   @id @default(uuid())
  subjectId String
  title      String   // "Physics Part 1"
  code       String?  // "PH11-P1"
  order      Int      // 1, 2, 3...
  source     String   @default("NCERT")
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  subject    Subject  @relation(...)
}
```

---

## 🧪 Example Usage

### 1. Create Subject

```bash
POST /subjects
{
  "name": "Physics",
  "class": 11
}
```

**Response:**
```json
{
  "id": "uuid-here",
  "name": "Physics",
  "class": 11,
  "textbooks": [],
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-01T00:00:00.000Z"
}
```

### 2. Create Textbooks

```bash
# Physics Part 1
POST /textbooks
{
  "subjectId": "uuid-from-step-1",
  "title": "Physics Part 1",
  "code": "PH11-P1",
  "order": 1,
  "source": "NCERT"
}

# Physics Part 2
POST /textbooks
{
  "subjectId": "uuid-from-step-1",
  "title": "Physics Part 2",
  "code": "PH11-P2",
  "order": 2,
  "source": "NCERT"
}
```

### 3. Get Subject with Textbooks

```bash
GET /subjects/{subjectId}
```

**Response:**
```json
{
  "id": "uuid",
  "name": "Physics",
  "class": 11,
  "textbooks": [
    {
      "id": "uuid-1",
      "title": "Physics Part 1",
      "order": 1,
      "source": "NCERT"
    },
    {
      "id": "uuid-2",
      "title": "Physics Part 2",
      "order": 2,
      "source": "NCERT"
    }
  ],
  "_count": {
    "textbooks": 2
  }
}
```

---

## 🔧 Common Commands

### Prisma Commands

```bash
# Generate Prisma Client
npx prisma generate

# Create migration
npx prisma migrate dev --name migration_name

# Apply migrations (production)
npx prisma migrate deploy

# Reset database (dev only)
npx prisma migrate reset

# Open Prisma Studio
npx prisma studio

# Format schema
npx prisma format

# Validate schema
npx prisma validate
```

### Database Commands

```bash
# View migrations
npx prisma migrate status

# Rollback (manual)
# Edit migration files, then:
npx prisma migrate resolve --rolled-back migration_name
```

---

## 🏗️ Future Schema Extensions

When ready to add syllabus:

```prisma
model Chapter {
  id         String   @id @default(uuid())
  textbookId String
  title      String
  order      Int
  textbook   Textbook @relation(fields: [textbookId], references: [id])
  topics     Topic[]
  // ...
}

model Topic {
  id         String   @id @default(uuid())
  chapterId String
  title      String
  order      Int
  chapter    Chapter  @relation(...)
  // ...
}
```

**Key Point:** Subjects and Textbooks remain unchanged. Syllabus attaches to textbooks.

---

## 🐛 Troubleshooting

### Connection Issues

```bash
# Test connection
npx prisma db pull

# Check DATABASE_URL format
# Should be: postgresql://user:pass@host:port/db?schema=public
```

### Migration Issues

```bash
# Reset and reapply
npx prisma migrate reset

# Mark migration as applied (if already applied manually)
npx prisma migrate resolve --applied migration_name
```

### Client Generation Issues

```bash
# Clear and regenerate
rm -rf node_modules/.prisma
npx prisma generate
```

---

## 📚 Resources

- [Prisma Docs](https://www.prisma.io/docs)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [NestJS Prisma Integration](https://docs.nestjs.com/recipes/prisma)

---

## ✅ Checklist

- [ ] PostgreSQL installed and running
- [ ] Database created
- [ ] `.env` file configured
- [ ] Prisma Client generated
- [ ] Migrations applied
- [ ] Test API endpoints working
- [ ] Subject CRUD working
- [ ] Textbook CRUD working

---

**Next Steps:**
1. Test Subject creation
2. Test Textbook creation (2 books for Physics)
3. Verify relationships work
4. Ready for syllabus integration later
