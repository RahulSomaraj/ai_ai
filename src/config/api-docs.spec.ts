import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppController } from '../app.controller';
import { SubjectsController } from '../subjects/subjects.controller';
import { TextbooksController } from '../textbooks/textbooks.controller';
import { SyllabusController } from '../syllabus/syllabus.controller';
import { RagController } from '../rag/rag.controller';

describe('Generated Swagger contract', () => {
  it('documents every route, response body, and frontend integration requirement', async () => {
    const controllers = [
      AppController,
      SubjectsController,
      TextbooksController,
      SyllabusController,
      RagController,
    ];
    // Build the real controllers without initializing a database or calling OpenAI.
    const dependencies = new Set<Function>(
      controllers.flatMap(
        (controller) =>
          Reflect.getMetadata('design:paramtypes', controller) ?? [],
      ),
    );
    const module = await Test.createTestingModule({
      controllers,
      providers: [...dependencies].map((provide) => ({
        provide,
        useValue: {},
      })),
    }).compile();
    const app = module.createNestApplication();
    app.setGlobalPrefix('v1');
    try {
      const document = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().setTitle('Test').setVersion('1').build(),
      );
      const operations = Object.values(document.paths).flatMap((path) =>
        Object.entries(path!)
          .filter(([method]) =>
            ['get', 'post', 'patch', 'delete'].includes(method),
          )
          .map(([, operation]) => operation),
      );
      expect(operations).toHaveLength(36);
      for (const operation of operations) {
        expect(operation.summary).toBeTruthy();
        const success =
          operation.responses['200'] ?? operation.responses['201'];
        expect(success.content).toBeDefined();
        for (const media of Object.values(success.content) as {
          schema: unknown;
        }[])
          expect(media.schema).toBeDefined();
      }
      const last = document.paths['/v1/rag/last-question']!.get!;
      expect(last.parameters).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'userId', required: true }),
          expect.objectContaining({ name: 'sessionId', required: false }),
        ]),
      );
      expect(
        (last.responses['200'] as any).content['application/json'].schema
          .nullable,
      ).toBe(true);
      const ask = (document.paths['/v1/rag/ask']!.post!.responses['200'] as any)
        .content['application/json'].schema;
      expect(ask.properties.messageId.description).toContain(
        'question-and-answer',
      );
      expect(ask.required).not.toContain('sessionId');
      const askInput = document.components!.schemas!.AskRagDto as any;
      expect(askInput.required.sort()).toEqual(['classLevel', 'question']);
      for (const suffix of ['map', 'validate']) {
        const operation =
          document.paths[
            `/v1/syllabus/{board}/{grade}/{subject}/query/${suffix}`
          ]!.post!;
        expect(
          (operation.requestBody as any).content['application/json'].schema
            .required,
        ).toEqual(['query']);
      }
      const filters = document.paths['/v1/subjects']!.get!.parameters as any[];
      expect(
        filters
          .filter((parameter) => parameter.in === 'query')
          .every((parameter) => parameter.required === false),
      ).toBe(true);
    } finally {
      await app.close();
    }
  });
});
