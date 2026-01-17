# AI AI - Syllabus-Controlled RAG System

A Retrieval-Augmented Generation (RAG) system that uses **frozen syllabus documents** as policy to control AI responses. This ensures exam-aligned answers and prevents hallucination by strictly enforcing syllabus boundaries.

## 🎯 Core Philosophy

**Separation of Policy and Content:**
- **Syllabus** = Frozen policy (what can be taught/tested)
- **Content** = Textbook material (what is available)
- **RAG** = Controlled retrieval and generation (respects both)

## 🏗️ Architecture

### Modules

1. **Syllabus Module** (`/syllabus`)
   - Stores and manages frozen syllabus JSON
   - Maps queries to learning outcomes
   - Validates query scope
   - **No content** - only structure and policy

2. **Content Module** (`/content`)
   - Stores textbook content separately
   - Chunks content for vector storage
   - Searches content by topic/query
   - **No policy** - only data

3. **RAG Module** (`/rag`)
   - Integrates syllabus + content
   - Validates queries against syllabus
   - Retrieves content filtered by syllabus topics
   - Generates responses within scope
   - **Gatekeeping** - rejects out-of-scope queries

## 📋 API Endpoints

### Syllabus Management

- `POST /syllabus` - Create/update syllabus
- `GET /syllabus/:board/:grade/:subject` - Get syllabus
- `GET /syllabus/:board/:grade/:subject/topics` - Get all topics
- `GET /syllabus/:board/:grade/:subject/topics/:topicId` - Get specific topic
- `POST /syllabus/:board/:grade/:subject/query/map` - Map query to topics
- `POST /syllabus/:board/:grade/:subject/query/validate` - Validate query scope

### Content Management

- `POST /content` - Create content document
- `GET /content/:board/:grade/:subject` - Get all content
- `GET /content/:board/:grade/:subject/topic/:topicId` - Get content by topic
- `POST /content/:board/:grade/:subject/search` - Search content (text-based)
- `POST /content/:board/:grade/:subject/semantic-search` - Semantic search using vector embeddings

### RAG Queries

- `POST /rag/query` - Process RAG query (main endpoint)
- `POST /rag/validate` - Validate query without processing

## 🚀 Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Create `.env` file

```env
PORT=3000
NODE_ENV=development

# OpenAI API Configuration (for embeddings)
OPENAI_API_KEY=your-openai-api-key-here
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

**Note:** You need an OpenAI API key for semantic search. Get one from [OpenAI Platform](https://platform.openai.com/api-keys).

### 3. Start the Application

```bash
npm run start:dev
```

### 4. Access Swagger Documentation

Visit: `http://localhost:3000/api`

## 📝 Example: Creating a Syllabus

```bash
POST /syllabus
Content-Type: application/json

{
  "board": "CBSE",
  "grade": "11",
  "subject": "Physics",
  "language": "English",
  "version": "2025",
  "units": [
    {
      "unit_id": "PHY_U1",
      "unit_name": "Units and Measurement",
      "topics": [
        {
          "topic_id": "PHY_U1_T1",
          "topic_name": "Introduction to Physical Measurement",
          "learning_outcomes": [
            "Define physical quantity",
            "Explain the need for measurement"
          ]
        }
      ]
    }
  ]
}
```

## 📝 Example: Adding Content

```bash
POST /content
Content-Type: application/json

{
  "board": "CBSE",
  "grade": "11",
  "subject": "Physics",
  "unit_id": "PHY_U1",
  "topic_id": "PHY_U1_T1",
  "title": "Introduction to Measurement",
  "content": "Physical quantities are measurable properties of objects..."
}
```

## 📝 Example: RAG Query

```bash
POST /rag/query
Content-Type: application/json

{
  "query": "What are SI base units?",
  "board": "CBSE",
  "grade": "11",
  "subject": "Physics"
}
```

**Response includes:**
- `answer`: Generated response (within syllabus scope)
- `isInScope`: Boolean validation
- `scopeValidation`: Detailed scope check
- `sources`: Retrieved content documents
- `metadata`: Processing information

## 🔒 Gatekeeping Rules

The system enforces:

1. **Query must map to at least one syllabus topic**
2. **Content retrieval filtered by mapped topics**
3. **Out-of-scope queries rejected** (if `rejectOutOfScope: true`)
4. **Response generation respects learning outcomes**

## 📁 Data Storage

- Syllabus: `data/syllabus/{BOARD}_{GRADE}_{SUBJECT}.json`
- Content: `data/content/{BOARD}_{GRADE}_{SUBJECT}.json`

## 🔮 Future Enhancements

- [x] Vector embeddings for semantic search ✅
- [ ] LLM integration (OpenAI, Anthropic) for answer generation
- [ ] Advanced query-to-topic mapping (NLP/ML)
- [ ] Vector database integration (Pinecone, Weaviate) - Currently using in-memory storage
- [ ] Multi-language support
- [ ] Content versioning
- [ ] Analytics and usage tracking

## 🧠 Vector Embeddings & Semantic Search

The system now supports **semantic search** using vector embeddings:

### How It Works

1. **Content Embedding**: When content is created, it's automatically embedded using OpenAI's embedding model
2. **Query Embedding**: User queries are converted to vectors
3. **Similarity Search**: Cosine similarity finds the most relevant content
4. **Filtered Results**: Results are filtered by syllabus topics and sorted by relevance score

### Features

- **Automatic Embedding**: Content is embedded on creation
- **Chunk Embeddings**: Long documents are chunked and each chunk is embedded
- **Semantic Search**: Find content by meaning, not just keywords
- **Similarity Scores**: Results include relevance scores (0-1)
- **Topic Filtering**: Search respects syllabus topic boundaries

### Example: Semantic Search

```bash
POST /content/CBSE/11/Physics/semantic-search
Content-Type: application/json

{
  "query": "What are the fundamental units of measurement?",
  "topic_ids": ["PHY_U1_T1", "PHY_U1_T2"],
  "limit": 5,
  "minScore": 0.7
}
```

**Response includes similarity scores:**
```json
[
  {
    "document_id": "DOC_...",
    "title": "SI Units",
    "content": "...",
    "similarity_score": 0.89
  }
]
```

### Configuration

Set `OPENAI_API_KEY` in your `.env` file. The system will:
- Generate embeddings automatically when content is created
- Use semantic search in RAG queries (with text search fallback)
- Store vectors in-memory (can be upgraded to Pinecone/Weaviate)

## 📚 Key Concepts

### Syllabus Structure

```typescript
{
  board: string;        // e.g., "CBSE"
  grade: string;        // e.g., "11"
  subject: string;      // e.g., "Physics"
  units: Unit[];        // Array of units
}

Unit {
  unit_id: string;      // e.g., "PHY_U1"
  unit_name: string;    // e.g., "Units and Measurement"
  topics: Topic[];      // Array of topics
}

Topic {
  topic_id: string;    // e.g., "PHY_U1_T1"
  topic_name: string;  // e.g., "Introduction to Physical Measurement"
  learning_outcomes: string[];  // Testable outcomes
}
```

### Query Flow

1. User query → RAG Service
2. RAG Service → Syllabus Service (validate scope)
3. Syllabus Service → Map query to topics/outcomes
4. RAG Service → Content Service (retrieve filtered content)
5. RAG Service → Generate answer (respecting syllabus)
6. Return response with validation metadata

## 🛡️ Error Handling

- **403 Forbidden**: Query outside syllabus scope
- **404 Not Found**: Syllabus/content not found
- **400 Bad Request**: Invalid input/validation error

## 📖 License

UNLICENSED
