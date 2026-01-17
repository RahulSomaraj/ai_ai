# Vector Embeddings Guide

This document explains how vector embeddings work in the RAG system.

## Overview

Vector embeddings convert text into numerical vectors that capture semantic meaning. Similar texts have similar vectors, enabling semantic search beyond keyword matching.

## Architecture

### Components

1. **EmbeddingsService**: Main service for generating embeddings
2. **OpenAIEmbeddingsProvider**: Uses OpenAI's embedding models
3. **InMemoryVectorStorage**: Stores vectors in memory (with cosine similarity search)
4. **ContentService Integration**: Automatically generates embeddings for content

### Flow

```
Content Creation → Generate Embedding → Store Vector → Ready for Search
User Query → Generate Query Embedding → Vector Search → Return Similar Content
```

## Usage

### Automatic Embedding

When you create content, embeddings are generated automatically:

```typescript
POST /content
{
  "board": "CBSE",
  "grade": "11",
  "subject": "Physics",
  "topic_id": "PHY_U1_T1",
  "title": "SI Units",
  "content": "The International System of Units..."
}
```

The system will:

1. Create the content document
2. Generate an embedding for `title + content`
3. Store the vector with metadata
4. Return the document

### Semantic Search

Use semantic search to find content by meaning:

```typescript
POST /content/CBSE/11/Physics/semantic-search
{
  "query": "What are base measurement units?",
  "topic_ids": ["PHY_U1_T1"],
  "limit": 5,
  "minScore": 0.7
}
```

### RAG Integration

The RAG service automatically uses semantic search:

```typescript
POST /rag/query
{
  "query": "Explain SI units",
  "board": "CBSE",
  "grade": "11",
  "subject": "Physics"
}
```

The system will:

1. Validate query against syllabus
2. Map query to topics
3. Use semantic search to find relevant content
4. Generate response from top results

## Configuration

### Environment Variables

```env
OPENAI_API_KEY=sk-...              # Required for embeddings
OPENAI_EMBEDDING_MODEL=text-embedding-3-small  # Optional, defaults to text-embedding-3-small
```

### Models

- `text-embedding-3-small`: 1536 dimensions, fast, cost-effective
- `text-embedding-3-large`: 3072 dimensions, more accurate
- `text-embedding-ada-002`: Legacy model (1536 dimensions)

## Vector Storage

### Current: In-Memory

- Fast for development
- Lost on restart
- Good for testing

### Future: Vector Databases

Can be upgraded to:

- **Pinecone**: Managed vector database
- **Weaviate**: Open-source vector search
- **Qdrant**: High-performance vector DB
- **Chroma**: Embedded vector store

## Similarity Scoring

### Cosine Similarity

The system uses cosine similarity to measure vector similarity:

- **1.0**: Identical meaning
- **0.7-0.9**: Very similar
- **0.5-0.7**: Somewhat related
- **<0.5**: Not related

### Best Practices

1. **minScore**: Set to 0.5-0.7 to filter low-quality matches
2. **Chunking**: Long documents are chunked for better granularity
3. **Topic Filtering**: Always filter by syllabus topics
4. **Batch Processing**: Embeddings are generated in batches when possible

## Performance

### Embedding Generation

- **Single**: ~100-200ms per text
- **Batch**: ~200-500ms for 10 texts (more efficient)

### Search

- **In-Memory**: <10ms for thousands of vectors
- **Vector DB**: Depends on database (usually <100ms)

## Troubleshooting

### "EmbeddingsService not available"

- Check that `OPENAI_API_KEY` is set
- Verify `EmbeddingsModule` is imported in `AppModule`

### Low Similarity Scores

- Query might be too different from content
- Try rephrasing the query
- Lower `minScore` threshold
- Check if content exists for the topic

### Embedding Generation Fails

- Check OpenAI API key validity
- Verify API quota/limits
- Check network connectivity
- System falls back to text search automatically

## Advanced Usage

### Custom Embedding Providers

You can create custom providers:

```typescript
@Injectable()
export class CustomEmbeddingsProvider implements EmbeddingProvider {
  async generateEmbedding(text: string): Promise<number[]> {
    // Your implementation
  }
}
```

### Vector Storage Backend

Implement `VectorStorage` interface:

```typescript
@Injectable()
export class PineconeVectorStorage implements VectorStorage {
  // Implementation
}
```

## Cost Considerations

### OpenAI Pricing (as of 2024)

- `text-embedding-3-small`: $0.02 per 1M tokens
- `text-embedding-3-large`: $0.13 per 1M tokens

### Optimization Tips

1. Use `text-embedding-3-small` for most cases
2. Cache embeddings (don't regenerate for same content)
3. Chunk documents efficiently
4. Batch embedding requests

## Next Steps

1. ✅ Basic embeddings implemented
2. ⏳ Add embedding caching
3. ⏳ Integrate vector database (Pinecone/Weaviate)
4. ⏳ Add embedding versioning
5. ⏳ Support multiple embedding providers
