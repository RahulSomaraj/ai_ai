import { applyDecorators } from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { AskRagDto } from '../rag/dto/ask-rag.dto';

// Shared wire schemas: these describe serialized responses, not database inputs.
const str = (example = 'Physics'): SchemaObject => ({
  type: 'string',
  example,
});
const num: SchemaObject = { type: 'number', example: 0.8 };
const int: SchemaObject = { type: 'integer', example: 1 };
const bool: SchemaObject = { type: 'boolean', example: false };
const date: SchemaObject = {
  type: 'string',
  format: 'date-time',
  example: '2026-11-09T08:30:00.000Z',
};
const id = str('550e8400-e29b-41d4-a716-446655440000');
const nullable = (schema: SchemaObject): SchemaObject => ({
  ...schema,
  nullable: true,
});
const arr = (items: SchemaObject): SchemaObject => ({ type: 'array', items });
const obj = (
  properties: Record<string, SchemaObject>,
  optional: string[] = [],
): SchemaObject => ({
  type: 'object',
  properties,
  required: Object.keys(properties).filter((key) => !optional.includes(key)),
});
const subject = obj({
  id,
  name: str(),
  class: { ...int, example: 11 },
  createdAt: date,
  updatedAt: date,
});
const textbook = obj({
  id,
  subjectId: id,
  title: str('Physics Part 1'),
  code: nullable(str('PH11-P1')),
  order: int,
  source: str('NCERT'),
  createdAt: date,
  updatedAt: date,
});
const subjectWithBooks = obj(
  {
    ...subject.properties,
    textbooks: arr(textbook),
    _count: obj({ textbooks: int }),
  },
  ['_count'],
);
const textbookWithSubject = obj({ ...textbook.properties, subject });
const message = obj({ message: str('Deleted successfully') });
const topic = obj({
  topic_id: str('PHY_U1_T1'),
  topic_name: str('Measurement'),
  learning_outcomes: arr(str('Define physical quantity')),
});
const syllabus = obj({
  board: str('CBSE'),
  grade: str('11'),
  subject: str(),
  language: str('English'),
  version: str('2025'),
  units: arr(
    obj({
      unit_id: str('PHY_U1'),
      unit_name: str('Units and Measurement'),
      topics: arr(topic),
    }),
  ),
});
const dbTopic = obj({
  id,
  code: str('PHY_U1_T1'),
  name: str('Measurement'),
  learningOutcomes: arr(str('Define physical quantity')),
});
const scope = {
  subjectId: id,
  subject: str(),
  classLevel: { ...int, example: 11 },
};
const coverage = {
  perTopic: arr(
    obj({
      topicId: id,
      code: str('PHY_U1_T1'),
      name: str('Measurement'),
      chunkCount: int,
    }),
  ),
  untagged: int,
};
const citation = obj({
  documentId: id,
  classLevel: int,
  subject: str(),
  title: str('Units and Measurement'),
  chapter: str('Units and Measurement'),
  topicCode: nullable(str('PHY_U1_T1')),
  topicName: nullable(str('Measurement')),
  chunkId: id,
  similarity: num,
});
const received = obj({
  subjectId: nullable(id),
  textbookId: nullable(id),
  subject: nullable(str()),
  crossSubject: bool,
  classLevel: int,
  chapter: nullable(str()),
  topicCode: nullable(str()),
  unitCode: nullable(str()),
  topicScoped: bool,
  topK: int,
  usedGlobalClassFallback: bool,
});
const session = obj({
  id,
  title: str('What are SI base units?'),
  subjectId: nullable(id),
  textbookId: nullable(id),
  classLevel: int,
  sourceType: nullable(str('ncert_book')),
  lastMessageAt: date,
  createdAt: date,
});
const turn = obj({
  id,
  question: str('What are SI base units?'),
  answer: str('SI base units include the metre, kilogram and second.'),
  status: { type: 'string', enum: ['answered', 'no_context', 'out_of_scope'] },
  citations: arr(citation),
  confidence: num,
  fallback: bool,
  createdAt: date,
});
const lastQuestion = nullable(
  obj({
    id,
    sessionId: id,
    question: str('What are SI base units?'),
    createdAt: date,
  }),
);
const ingest = obj({
  status: str('completed'),
  docId: id,
  chunksInserted: int,
  embeddingsIndexed: int,
});
const mapping = obj({
  query: str('What are SI base units?'),
  topic_ids: arr(str('PHY_U1_T1')),
  learning_outcomes: arr(str('Define physical quantity')),
  isInScope: bool,
  reason: str('Query maps to 1 topic(s)'),
});

const schemas = {
  'app.getHello': str('Hello World!'),
  'subjects.create': subjectWithBooks,
  'subjects.findAll': { oneOf: [arr(subjectWithBooks), subjectWithBooks] },
  'subjects.findOne': subjectWithBooks,
  'subjects.update': subjectWithBooks,
  'subjects.remove': message,
  'subjects.getTextbooksCount': obj({ count: int }),
  'textbooks.create': textbookWithSubject,
  'textbooks.findAll': arr(textbookWithSubject),
  'textbooks.findOne': textbookWithSubject,
  'textbooks.findBySubject': arr(textbookWithSubject),
  'textbooks.update': textbookWithSubject,
  'textbooks.remove': message,
  'textbooks.findChapters': obj({
    textbook: obj({
      id,
      title: str('Physics Part 1'),
      source: str('NCERT'),
      subject: str(),
      classLevel: int,
    }),
    chapterCount: int,
    chapters: arr(
      obj({
        documentId: id,
        number: int,
        title: str('Units and Measurement'),
        wholeVolume: bool,
        pdfPages: nullable(obj({ from: int, to: int })),
        chunkCount: int,
      }),
    ),
  }),
  'syllabus.importSyllabus': obj({
    status: str('imported'),
    ...scope,
    board: str('CBSE'),
    version: str('2025'),
    unitsUpserted: int,
    topicsUpserted: int,
  }),
  'syllabus.getDbStructure': obj({
    ...scope,
    units: arr(
      obj({
        id,
        code: str('PHY_U1'),
        name: str('Units and Measurement'),
        topics: arr(dbTopic),
      }),
    ),
  }),
  'syllabus.getDbTopics': arr(
    obj({
      ...dbTopic.properties,
      unit: obj({
        id,
        code: str('PHY_U1'),
        name: str('Units and Measurement'),
      }),
    }),
  ),
  'syllabus.createSyllabus': syllabus,
  'syllabus.getSyllabus': syllabus,
  'syllabus.getCurrentTopics': arr(
    obj({
      board: str('CBSE'),
      grade: str('11'),
      subject: str(),
      unit_id: str('PHY_U1'),
      unit_name: str('Units and Measurement'),
      ...topic.properties,
    }),
  ),
  'syllabus.getAllTopics': arr(topic),
  'syllabus.getTopicById': topic,
  'syllabus.getAllLearningOutcomes': arr(str('Define physical quantity')),
  'syllabus.mapQuery': mapping,
  'syllabus.validateQuery': obj({
    allowed: bool,
    reason: str('Query maps to 1 topic(s)'),
  }),
  'rag.getStatus': obj({
    module: str('rag'),
    ready: bool,
    topK: int,
    minSimilarity: num,
    topicMinSimilarity: num,
  }),
  'rag.ingest': ingest,
  'rag.ingestPdf': ingest,
  'rag.embedTopics': obj({
    status: str('embedded'),
    ...scope,
    topicsEmbedded: int,
    model: str('text-embedding-3-small'),
  }),
  'rag.mapTopics': obj({
    status: str('mapped'),
    ...scope,
    minSimilarity: num,
    onlyUntagged: bool,
    chunksAssigned: int,
    coverage: obj(coverage),
  }),
  'rag.topicCoverage': obj({ ...scope, ...coverage }),
  'rag.ask': obj(
    {
      status: { type: 'string', enum: ['answered', 'no_context'] },
      answer: str('SI base units include the metre, kilogram and second.'),
      citations: arr(citation),
      confidence: num,
      fallback: bool,
      message: str('Fallback details, when applicable'),
      received,
      sessionId: {
        ...id,
        description:
          'Conversation ID. Present only when userId was provided and the turn was saved.',
      },
      messageId: {
        ...id,
        description:
          'ID of this saved question-and-answer turn; not needed for follow-up requests.',
      },
    },
    ['message', 'sessionId', 'messageId'],
  ),
  'rag.lastQuestion': lastQuestion,
  'rag.listSessions': obj({
    items: arr(
      obj({
        ...session.properties,
        messageCount: int,
        lastQuestion: nullable(str('What are SI base units?')),
      }),
    ),
    nextCursor: nullable(id),
  }),
  'rag.listMessages': obj({
    session,
    items: arr(turn),
    nextCursor: nullable(id),
  }),
  'rag.deleteSession': obj({ id, deleted: { type: 'boolean', example: true } }),
} satisfies Record<string, SchemaObject>;

type Contract = keyof typeof schemas;
const notFound: Contract[] = [
  'subjects.findAll',
  'subjects.findOne',
  'subjects.update',
  'subjects.remove',
  'textbooks.create',
  'textbooks.findAll',
  'textbooks.findOne',
  'textbooks.findChapters',
  'textbooks.findBySubject',
  'textbooks.update',
  'textbooks.remove',
  'syllabus.getDbStructure',
  'syllabus.getDbTopics',
  'syllabus.getSyllabus',
  'syllabus.getAllTopics',
  'syllabus.getTopicById',
  'syllabus.getAllLearningOutcomes',
  'syllabus.mapQuery',
  'syllabus.validateQuery',
  'rag.ask',
  'rag.lastQuestion',
  'rag.listMessages',
  'rag.deleteSession',
];
const created: Contract[] = [
  'subjects.create',
  'textbooks.create',
  'syllabus.importSyllabus',
  'syllabus.createSyllabus',
  'rag.ingest',
  'rag.ingestPdf',
];
const badRequest: Contract[] = [
  'subjects.create',
  'subjects.update',
  'textbooks.create',
  'textbooks.update',
  'syllabus.importSyllabus',
  'syllabus.createSyllabus',
  'rag.ingest',
  'rag.ingestPdf',
  'rag.embedTopics',
  'rag.mapTopics',
  'rag.topicCoverage',
  'rag.ask',
  'rag.lastQuestion',
  'rag.listSessions',
  'rag.listMessages',
  'rag.deleteSession',
];
const error = (status: number): SchemaObject =>
  obj({
    statusCode: { type: 'integer', example: status },
    message: { oneOf: [str('Request failed'), arr(str('Validation failed'))] },
    error: str(
      {
        400: 'Bad Request',
        404: 'Not Found',
        413: 'Payload Too Large',
        500: 'Internal Server Error',
        503: 'Service Unavailable',
      }[status] ?? 'Error',
    ),
  });

/** Reusable documentation only; does not alter routing, validation or responses. */
export function ApiContract(key: Contract, params: string[] = []) {
  const decorators: (ClassDecorator | MethodDecorator | PropertyDecorator)[] = [
    ApiResponse({
      status: created.includes(key) ? 201 : 200,
      description:
        key === 'rag.lastQuestion'
          ? 'Latest saved question, or JSON null when history is empty'
          : 'Successful response',
      schema: schemas[key],
    }),
  ];
  if (key === 'rag.lastQuestion') {
    decorators.push(
      ApiResponse({
        status: 200,
        description:
          'Latest saved question, or JSON null when history is empty',
        content: {
          'application/json': {
            schema: lastQuestion,
            examples: {
              found: {
                summary: 'Latest saved question',
                value: {
                  id: '7d882964-883b-4cf1-a143-bdd427aba2a0',
                  sessionId: id.example,
                  question: 'What are SI base units?',
                  createdAt: date.example,
                },
              },
              empty: { summary: 'No saved questions', value: null },
            },
          },
        },
      }),
    );
  }
  for (const name of params) {
    decorators.push(
      ApiParam({
        name,
        type: String,
        description:
          name === 'id' || name === 'subjectId'
            ? 'Resource identifier'
            : `Syllabus ${name}`,
        example:
          name === 'board'
            ? 'CBSE'
            : name === 'grade'
              ? '11'
              : name === 'subject'
                ? 'Physics'
                : name === 'topicId'
                  ? 'PHY_U1_T1'
                  : key.startsWith('textbooks.') && name === 'id'
                    ? 'seed-11-physics-tb1'
                    : key.startsWith('rag.') && name === 'id'
                      ? id.example
                      : 'seed-11-physics',
      }),
    );
  }
  for (const status of [
    500,
    ...(badRequest.includes(key) ? [400] : []),
    ...(notFound.includes(key) ? [404] : []),
  ]) {
    decorators.push(
      ApiResponse({
        status,
        description:
          status === 500
            ? 'Unexpected backend or dependency failure'
            : status === 404
              ? 'Resource not found or session unavailable for this user'
              : 'Validation error or invalid academic scope',
        schema: error(status),
      }),
    );
  }
  if (key === 'rag.ask' || key === 'rag.embedTopics') {
    decorators.push(
      ApiResponse({
        status: 503,
        description: 'OpenAI API key is not configured',
        schema: error(503),
      }),
    );
  }
  if (key === 'rag.ask') {
    decorators.push(
      ApiBody({
        type: AskRagDto,
        examples: {
          newChat: {
            summary: 'New conversation with saved history',
            value: {
              userId: 'stu_1024',
              question: 'What are SI base units?',
              classLevel: 11,
              subjectId: 'seed-11-physics',
            },
          },
          followUp: {
            summary:
              'Follow-up in an existing conversation (use a returned sessionId)',
            value: {
              userId: 'stu_1024',
              sessionId: id.example,
              question: 'Can you give an example?',
              classLevel: 11,
              subjectId: 'seed-11-physics',
            },
          },
          minimal: {
            summary: 'Required fields only; history is not saved',
            value: { question: 'What are SI base units?', classLevel: 11 },
          },
        },
      }),
    );
    decorators.push(
      ApiResponse({
        status: 403,
        description:
          'Out of scope when rejectOutOfScope=true; the turn may still be saved',
        schema: obj(
          {
            status: str('out_of_scope'),
            message: str('No indexed passages found for the requested scope.'),
            received,
            sessionId: id,
            messageId: id,
          },
          ['sessionId', 'messageId'],
        ),
      }),
    );
  }
  if (key === 'rag.ingestPdf') {
    decorators.push(
      ApiResponse({
        status: 413,
        description: 'Uploaded file exceeds 20 MB',
        schema: error(413),
      }),
    );
  }
  if (key === 'subjects.findAll') {
    decorators.push(
      ApiQuery({
        name: 'class',
        required: false,
        type: Number,
        example: 11,
        description:
          'Used only together with name. With both filters, returns a single subject; otherwise returns all subjects.',
      }),
      ApiQuery({
        name: 'name',
        required: false,
        type: String,
        example: 'Physics',
        description:
          'Case-insensitive exact name; used only together with class.',
      }),
    );
  }
  if (key === 'textbooks.findAll')
    decorators.push(
      ApiQuery({
        name: 'subjectId',
        required: false,
        type: String,
        example: 'seed-11-physics',
        description:
          'Filter by subject. A supplied unknown subject returns 404.',
      }),
    );
  if (key === 'syllabus.getCurrentTopics')
    decorators.push(
      ApiQuery({
        name: 'subject',
        required: false,
        type: String,
        example: 'Physics',
        description: 'Optional subject filter',
      }),
    );
  if (key === 'syllabus.mapQuery' || key === 'syllabus.validateQuery') {
    decorators.push(
      ApiBody({ schema: obj({ query: str('What are SI base units?') }) }),
    );
  }
  if (key === 'app.getHello')
    decorators.push(
      ApiTags('Application'),
      ApiOperation({ summary: 'Get the application greeting' }),
      ApiProduces('text/html'),
    );
  return applyDecorators(...decorators);
}
