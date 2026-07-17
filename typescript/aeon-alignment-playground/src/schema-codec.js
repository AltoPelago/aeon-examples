import {
  normalizeSchemaObject,
  parseSchemaSource,
  schemaToAeon as coreSchemaToAeon,
} from '../../../../aeon/implementations/typescript/packages/aeos/dist/index.js';

function schemaCompileOptions(options = {}) {
  return {
    maxSeparatorDepth: options.maxSeparatorDepth ?? 8,
    maxAttributeDepth: options.maxAttributeDepth ?? 1,
    maxGenericDepth: options.maxGenericDepth ?? 1,
    datatypePolicy: 'allow_custom',
  };
}

export function parseSchemaText(text, options = {}) {
  const raw = String(text ?? '').trim();
  if (!raw) {
    return null;
  }

  if (raw.startsWith('{') || raw.startsWith('[')) {
    return withPlaygroundDefaults(normalizeSchemaObject(JSON.parse(raw)));
  }

  return withPlaygroundDefaults(parseSchemaSource(raw, {
    compileOptions: schemaCompileOptions(options),
  }));
}

export function schemaToAeon(schema) {
  return coreSchemaToAeon(withPlaygroundDefaults(normalizeSchemaObject(schema))).trimEnd();
}

function withPlaygroundDefaults(schema) {
  return {
    ...schema,
    world: schema.world ?? 'open',
  };
}
