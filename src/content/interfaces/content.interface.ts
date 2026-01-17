export interface ContentChunk {
  chunk_id: string;
  topic_id: string;
  unit_id: string;
  content: string;
  metadata: {
    page?: number;
    section?: string;
    chapter?: string;
    created_at: string;
  };
}

export interface ContentDocument {
  document_id: string;
  board: string;
  grade: string;
  subject: string;
  unit_id: string;
  topic_id: string;
  title: string;
  content: string;
  metadata: {
    source?: string;
    page?: number;
    created_at: string;
  };
}
