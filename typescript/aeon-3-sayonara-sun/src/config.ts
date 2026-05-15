import { Farewell } from './Farewell.js';
import {
  loadAeonDocument,
  requireDatatype,
  requireNoFinalizeErrors,
  requireSchema,
  requireUnsignedIntegerRange,
} from './aeon-config.js';

export function loadConfig(filePath: string): Farewell {
  const document = loadAeonDocument(filePath, {
    compile: { datatypePolicy: 'allow_custom' },
    finalize: { mode: 'strict' },
  });

  requireDatatype(document, '$.sun', 'farewell');

  requireSchema(document, {
    rules: [
      { path: '$.sun', constraints: { required: true, type: 'ObjectNode' } },
      { path: '$.sun.version', constraints: { required: true, type: 'SeparatorLiteral' } },
      { path: '$.sun.daytime', constraints: { required: true, type: 'StringLiteral' } },
      { path: '$.sun.farewell', constraints: { required: true, type: 'StringLiteral' } },
      {
        path: '$.sun.sunsetHour',
        constraints: { required: true, type: 'IntegerLiteral', sign: 'unsigned', min_digits: 1, max_digits: 2 } as const,
      },
      {
        path: '$.sun.cooldownHours',
        constraints: { required: true, type: 'IntegerLiteral', sign: 'unsigned', min_digits: 1, max_digits: 1 } as const,
      },
    ],
  });

  requireUnsignedIntegerRange(document, '$.sun.sunsetHour', 16, 21);
  requireUnsignedIntegerRange(document, '$.sun.cooldownHours', 1, 6);

  requireNoFinalizeErrors(document);

  const sun = (document.finalized.document as { sun: ConstructorParameters<typeof Farewell>[0] }).sun;
  return new Farewell(sun);
}
