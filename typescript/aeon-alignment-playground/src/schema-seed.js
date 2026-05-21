import { compile, formatPath } from '@altopelago/aeon-core';

export const BUILTIN_SCHEMA_TYPES_BY_DATATYPE = new Map([
  ['string', 'StringLiteral'],
  ['str', 'StringLiteral'],
  ['s', 'StringLiteral'],
  ['number', 'NumberLiteral'],
  ['num', 'NumberLiteral'],
  ['n', 'NumberLiteral'],
  ['integer', 'IntegerLiteral'],
  ['int', 'IntegerLiteral'],
  ['float', 'FloatLiteral'],
  ['boolean', 'BooleanLiteral'],
  ['bool', 'BooleanLiteral'],
  ['b', 'BooleanLiteral'],
  ['toggle', 'ToggleLiteral'],
  ['null', 'NullLiteral'],
  ['nan', 'NaNLiteral'],
  ['infinity', 'InfinityLiteral'],
  ['object', 'ObjectNode'],
  ['obj', 'ObjectNode'],
  ['o', 'ObjectNode'],
  ['list', 'ListNode'],
  ['tuple', 'TupleNode'],
  ['node', 'NodeLiteral'],
]);

const SCHEMA_TYPES_BY_VALUE_TYPE = new Map([
  ['StringLiteral', 'StringLiteral'],
  ['TrimtickStringLiteral', 'StringLiteral'],
  ['NumberLiteral', 'NumberLiteral'],
  ['IntegerLiteral', 'IntegerLiteral'],
  ['FloatLiteral', 'FloatLiteral'],
  ['BooleanLiteral', 'BooleanLiteral'],
  ['ToggleLiteral', 'ToggleLiteral'],
  ['NullLiteral', 'NullLiteral'],
  ['NaNLiteral', 'NaNLiteral'],
  ['InfinityLiteral', 'InfinityLiteral'],
  ['ObjectNode', 'ObjectNode'],
  ['ListNode', 'ListNode'],
  ['TupleLiteral', 'TupleNode'],
  ['TupleNode', 'TupleNode'],
  ['NodeLiteral', 'NodeLiteral'],
  ['HexLiteral', 'HexLiteral'],
  ['EncodingLiteral', 'EncodingLiteral'],
  ['RadixLiteral', 'RadixLiteral'],
  ['SeparatorLiteral', 'SeparatorLiteral'],
  ['DateLiteral', 'DateLiteral'],
  ['TimeLiteral', 'TimeLiteral'],
  ['DateTimeLiteral', 'DateTimeLiteral'],
  ['ZRUTDateTimeLiteral', 'DateTimeLiteral'],
]);

function datatypePolicyForMode(validationMode) {
  if (validationMode === 'strict') {
    return 'reserved_only';
  }
  if (validationMode === 'custom') {
    return 'allow_custom';
  }
  return undefined;
}

function schemaTypeForEvent(event) {
  const datatype = typeof event.datatype === 'string' ? event.datatype : '';
  const builtinType = BUILTIN_SCHEMA_TYPES_BY_DATATYPE.get(datatype.toLowerCase());
  if (builtinType) {
    return builtinType;
  }
  const valueType = event.value?.valueType ?? event.value?.type ?? event.valueType;
  return SCHEMA_TYPES_BY_VALUE_TYPE.get(valueType) ?? 'StringLiteral';
}

function schemaConstraintsForEvent(event) {
  const datatype = typeof event.datatype === 'string' ? event.datatype : '';
  const type = schemaTypeForEvent(event);
  const constraints = {
    type,
    required: true,
  };

  if (datatype && !BUILTIN_SCHEMA_TYPES_BY_DATATYPE.has(datatype.toLowerCase())) {
    constraints.datatype = datatype;
  }

  return constraints;
}

function isHeaderPath(path) {
  return path.startsWith('$.["aeon:');
}

export function seedSchemaFromAeonSource(source, options = {}) {
  const result = compile(source, {
    recovery: true,
    maxSeparatorDepth: options.maxSeparatorDepth ?? 8,
    maxAttributeDepth: options.maxAttributeDepth ?? 1,
    maxGenericDepth: options.maxGenericDepth ?? 1,
    ...(datatypePolicyForMode(options.validationMode) ? { datatypePolicy: datatypePolicyForMode(options.validationMode) } : {}),
  });

  const rulesByPath = new Map();
  for (const event of result.events ?? []) {
    const path = formatPath(event.path);
    if (isHeaderPath(path) || rulesByPath.has(path)) {
      continue;
    }
    rulesByPath.set(path, {
      path,
      constraints: schemaConstraintsForEvent(event),
    });
  }

  return [...rulesByPath.values()];
}
