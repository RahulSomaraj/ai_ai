export interface LearningOutcome {
  outcome: string;
}

export interface Topic {
  topic_id: string;
  topic_name: string;
  learning_outcomes: string[];
}

export interface Unit {
  unit_id: string;
  unit_name: string;
  topics: Topic[];
}

export interface Syllabus {
  board: string;
  grade: string;
  subject: string;
  language: string;
  version: string;
  units: Unit[];
}

export interface QueryMapping {
  query: string;
  topic_ids?: string[];
  learning_outcomes?: string[];
  isInScope: boolean;
  reason?: string;
}

export interface CurrentTopic {
  board: string;
  grade: string;
  subject: string;
  unit_id: string;
  unit_name: string;
  topic_id: string;
  topic_name: string;
  learning_outcomes: string[];
}
