export interface RAGQuery {
  query: string;
  board: string;
  grade: string;
  subject: string;
  context?: {
    topic_ids?: string[];
    learning_outcomes?: string[];
  };
}

export interface RAGResponse {
  answer: string;
  isInScope: boolean;
  scopeValidation: {
    allowed: boolean;
    reason: string;
    matched_topics?: string[];
    matched_outcomes?: string[];
  };
  sources: Array<{
    document_id: string;
    title: string;
    topic_id: string;
    relevance_score?: number;
  }>;
  metadata: {
    query: string;
    timestamp: string;
    processing_time_ms?: number;
  };
}

export interface RAGConfig {
  maxSources: number;
  requireScopeValidation: boolean;
  rejectOutOfScope: boolean;
}
