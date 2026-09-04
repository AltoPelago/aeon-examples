import { buildAnnotationStreamFromSource } from '@altopelago/aeon-annotation-stream';
import { canonicalize } from '@altopelago/aeon-canonical';
import { compile, formatPath } from '@altopelago/aeon-core';
import { finalizeJson } from '@altopelago/aeon-finalize';
import { loadAeonWasm } from '@altopelago/aeon-wasm';
import { parseAddress, resolveAddress } from '@altopelago/sansa';
import { parseSchemaText } from './schema-codec.js';

let defaultWasmInputPromise;

async function loadDefaultWasmInput() {
  defaultWasmInputPromise ??= (async () => {
    const { default: wasmUrl } = await import('@aeon-playground/wasm-artifact');
    const response = await fetch(wasmUrl);

    if (!response.ok) {
      throw new Error(`Failed to load AEON WASM artifact from ${wasmUrl}: HTTP ${response.status}`);
    }

    const bytes = new Uint8Array(await response.arrayBuffer());

    if (
      bytes.length < 4
      || bytes[0] !== 0x00
      || bytes[1] !== 0x61
      || bytes[2] !== 0x73
      || bytes[3] !== 0x6d
    ) {
      throw new Error(`Failed to load AEON WASM artifact from ${wasmUrl}: response was not a WebAssembly module`);
    }

    return bytes;
  })();

  return defaultWasmInputPromise;
}

function isHeaderSummaryEvent(event) {
  return typeof event.key === 'string' && event.key.startsWith('aeon:');
}

function headerFieldPath(key) {
  return `$.["aeon:${key}"]`;
}

function valueTypeName(value) {
  return normalizeValueType(value?.valueType ?? value?.type ?? 'Unknown');
}

function normalizeValueType(valueType) {
  return valueType;
}

function summarizeHeaderFields(header) {
  if (!header?.fields) {
    return [];
  }

  return Array.from(header.fields.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => ({
      path: headerFieldPath(key),
      key: `aeon:${key}`,
      datatype: null,
      valueType: valueTypeName(value),
    }));
}

function selectVisibleEventSummary(events, header, scope) {
  const bodyEvents = events.filter((event) => !isHeaderSummaryEvent(event));
  const headerEvents = summarizeHeaderFields(header);

  if (scope === 'header') {
    return headerEvents;
  }

  if (scope === 'full') {
    return [...headerEvents, ...bodyEvents];
  }

  return bodyEvents;
}

function normalizeTsEvents(events) {
  return events.map((event) => ({
    path: formatPath(event.path),
    key: event.key,
    datatype: event.datatype ?? null,
    valueType: valueTypeName(event.value),
    }));
}

function normalizeDiagnostic(diag) {
  return {
    code: diag.code ?? '',
    path: diag.path ?? null,
    span: diag.span ?? null,
    phase: typeof diag.phase === 'string' ? diag.phase : String(diag.phase ?? ''),
    message: diag.message ?? String(diag),
  };
}

function normalizeAnnotation(annotation) {
  return {
    kind: annotation.kind,
    form: annotation.form,
    subtype: annotation.subtype ?? null,
    raw: annotation.raw,
    span: annotation.span,
    target: annotation.target,
    placement: annotation.placement ?? null,
  };
}

function normalizeEngineResult(engine, result) {
  const errors = (result.errors ?? []).map(normalizeDiagnostic);
  const warnings = (result.warnings ?? []).map(normalizeDiagnostic);
  const canonicalText = typeof result.canonical === 'string'
    ? result.canonical
    : result.canonical?.text ?? '';
  const finalizedDocument = result.finalized && typeof result.finalized === 'object' && 'document' in result.finalized
    ? result.finalized.document
    : result.finalized ?? null;

  return {
    engine,
    ok: errors.length === 0,
    canonical: { text: canonicalText },
    finalized: { document: finalizedDocument },
    annotations: (result.annotations ?? []).map(normalizeAnnotation),
    events: (result.events ?? []).map((event) => ({
      path: event.path,
      key: event.key,
      datatype: event.datatype ?? null,
      valueType: normalizeValueType(event.valueType),
      value: event.value,
      raw: event.raw,
      span: event.span ?? null,
    })),
    diagnostics: { errors, warnings },
    errors,
    warnings,
  };
}

function positionAtOffset(source, offset) {
  if (!Number.isInteger(offset) || offset < 0 || offset > source.length) {
    return null;
  }

  let line = 1;
  let column = 1;
  let current = 0;

  for (const char of source) {
    if (current >= offset) {
      break;
    }
    current += char.length;
    if (char === '\n') {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  return current === offset ? { line, column, offset } : null;
}

function positionMatchesSource(source, position) {
  const actual = positionAtOffset(source, position?.offset);
  return actual !== null
    && actual.line === position.line
    && actual.column === position.column;
}

function spanMatchesSource(source, span) {
  return span?.start
    && span?.end
    && positionMatchesSource(source, span.start)
    && positionMatchesSource(source, span.end);
}

function validationModeHeaderPrefixLength(mode) {
  if (mode === 'none') {
    return 0;
  }
  const compileMode = mode === 'transport' ? 'transport' : mode;
  return `aeon:mode = "${compileMode}"\n`.length;
}

function normalizeDiagnosticSpanForSource(source, span, prefixLength) {
  if (!span?.start || !span?.end || prefixLength <= 0 || spanMatchesSource(source, span)) {
    return span ?? null;
  }

  const candidate = {
    ...span,
    start: {
      ...span.start,
      line: span.start.line - 1,
      offset: span.start.offset - prefixLength,
    },
    end: {
      ...span.end,
      line: span.end.line - 1,
      offset: span.end.offset - prefixLength,
    },
  };

  return spanMatchesSource(source, candidate) ? candidate : span;
}

function normalizeDiagnosticSpansForSource(diagnostics, source, options) {
  const prefixLength = validationModeHeaderPrefixLength(options.validationMode);
  return diagnostics.map((diagnostic) => ({
    ...diagnostic,
    span: normalizeDiagnosticSpanForSource(source, diagnostic.span, prefixLength),
  }));
}

function parseSchemaOption(options) {
  if (!options.schemaEnabled) {
    return null;
  }
  return parseSchemaText(options.schemaText, options);
}

function schemaDiag(code, path, message, span = null) {
  return {
    code,
    path,
    span,
    phase: 'schema_validation',
    message,
  };
}

function schemaRuleAddress(rule) {
  return rule.selector ?? rule.path;
}

function schemaRuleMatches(rule, event, selectorMatchSets = new Map()) {
  if (typeof rule.path === 'string') {
    return rule.path === event.path;
  }
  if (typeof rule.selector !== 'string') {
    return false;
  }
  return selectorMatchSets.get(rule.selector)?.has(event.path) ?? false;
}

function datatypeBaseName(datatype) {
  const text = String(datatype ?? '').trim();
  const generic = text.indexOf('<');
  return (generic >= 0 ? text.slice(0, generic) : text).toLowerCase();
}

const SANSA_IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SCHEMA_REPRESENTATION_KIND_BY_VALUE_TYPE = {
  StringLiteral: 'string',
  TrimtickStringLiteral: 'string',
  NumberLiteral: 'number',
  IntegerLiteral: 'integer',
  FloatLiteral: 'float',
  BooleanLiteral: 'boolean',
  ToggleLiteral: 'toggle',
  NullLiteral: 'null',
  NaNLiteral: 'nan',
  InfinityLiteral: 'infinity',
  ObjectNode: 'object',
  ListNode: 'list',
  TupleLiteral: 'tuple',
  TupleNode: 'tuple',
  NodeLiteral: 'node',
  HexLiteral: 'hex',
  EncodingLiteral: 'encoding',
  RadixLiteral: 'radix',
  SeparatorLiteral: 'separator',
  DateLiteral: 'date',
  TimeLiteral: 'time',
  DateTimeLiteral: 'datetime',
  WTCDateTimeLiteral: 'wtc',
  SansaAddressLiteral: 'sansa',
};

const SCHEMA_FILTER_ALIASES = new Map([
  ['bool', 'boolean'],
  ['int', 'integer'],
]);

function normalizeSchemaFilterName(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return SCHEMA_FILTER_ALIASES.get(normalized) ?? normalized;
}

function schemaRepresentationKind(event) {
  return SCHEMA_REPRESENTATION_KIND_BY_VALUE_TYPE[event.valueType] ?? datatypeBaseName(event.valueType);
}

function schemaMemberAddress(parentAddress, name) {
  return SANSA_IDENTIFIER_RE.test(name)
    ? `${parentAddress}.${name}`
    : `${parentAddress}.[${JSON.stringify(name)}]`;
}

function schemaPositionAddress(parentAddress, index) {
  return `${parentAddress}[${index}]`;
}

function createSchemaResolveBinding(address, fields = {}) {
  return {
    address,
    children: [],
    childByName: new Map(),
    childByIndex: new Map(),
    ...fields,
  };
}

function getOrCreateSchemaChild(parent, selector) {
  if (selector.type === 'member') {
    let child = parent.childByName.get(selector.name);
    if (!child) {
      child = createSchemaResolveBinding(schemaMemberAddress(parent.address, selector.name), {
        name: selector.name,
      });
      parent.childByName.set(selector.name, child);
      parent.children.push(child);
    }
    return child;
  }
  if (selector.type === 'position') {
    let child = parent.childByIndex.get(selector.index);
    if (!child) {
      child = createSchemaResolveBinding(schemaPositionAddress(parent.address, selector.index), {
        index: selector.index,
      });
      parent.childByIndex.set(selector.index, child);
      parent.children.push(child);
    }
    return child;
  }
  return null;
}

function getOrCreateSchemaAttributeSpace(parent) {
  if (!parent.attributeSpace) {
    parent.attributeSpace = createSchemaResolveBinding(`${parent.address}.@`, {
      representationKind: 'object',
    });
  }
  return parent.attributeSpace;
}

function insertSchemaResolveEvent(root, event) {
  const parsed = parseAddress(event.path);
  if (!parsed.ok) {
    return;
  }

  let current = root;
  for (const selector of parsed.address.selectors) {
    if (selector.type === 'attributeSpace') {
      current = getOrCreateSchemaAttributeSpace(current);
      continue;
    }
    const child = getOrCreateSchemaChild(current, selector);
    if (!child) {
      return;
    }
    current = child;
  }

  current.event = event;
  current.semanticType = event.datatype ?? undefined;
  current.representationKind = schemaRepresentationKind(event);
}

function buildSchemaResolveNamespace(events) {
  const root = createSchemaResolveBinding('$', {
    representationKind: 'object',
  });
  for (const event of events) {
    insertSchemaResolveEvent(root, event);
  }
  return {
    root,
    children: (binding) => binding.children,
    attributeSpace: (binding) => binding.attributeSpace,
    semanticTypeMatches: (binding, expected) => (
      normalizeSchemaFilterName(datatypeBaseName(binding.semanticType)) === normalizeSchemaFilterName(expected)
    ),
    representationKindMatches: (binding, expected) => (
      normalizeSchemaFilterName(binding.representationKind) === normalizeSchemaFilterName(expected)
    ),
  };
}

function schemaSelectorMatchSet(selector, namespace) {
  const result = resolveAddress(selector, namespace);
  if (!result.ok) {
    return new Set();
  }
  return new Set(
    result.bindings
      .filter((binding) => binding.event)
      .map((binding) => binding.event.path),
  );
}

function buildSchemaSelectorMatchSets(rules, namespace) {
  const matchSets = new Map();
  for (const rule of rules) {
    if (typeof rule.selector === 'string' && !matchSets.has(rule.selector)) {
      matchSets.set(rule.selector, schemaSelectorMatchSet(rule.selector, namespace));
    }
  }
  return matchSets;
}

function appendAttributePath(basePath, key) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key)
    ? `${basePath}.@.${key}`
    : `${basePath}.@.[${JSON.stringify(key)}]`;
}

function normalizeSchemaEvent(event) {
  const value = event.value;
  const unwrapped = value?.valueType === 'TypedValue' || value?.type === 'TypedValue'
    ? value.value
    : value;
  const valueType = event.valueType ?? valueTypeName(unwrapped);
  return {
    path: typeof event.path === 'string' ? event.path : formatPath(event.path),
    key: event.key,
    datatype: event.datatype ?? value?.datatype ?? null,
    valueType,
    value: unwrapped?.value,
    raw: unwrapped?.raw,
    span: event.span ?? unwrapped?.span ?? null,
  };
}

function entriesFromAttributeMap(attributes) {
  if (!attributes) {
    return [];
  }
  if (attributes instanceof Map) {
    return Array.from(attributes.entries());
  }
  if (typeof attributes === 'object' && !Array.isArray(attributes)) {
    return Object.entries(attributes);
  }
  return [];
}

function normalizeAttributeEvent(basePath, key, entry) {
  const value = entry?.value;
  return {
    path: appendAttributePath(basePath, key),
    key,
    datatype: typeof entry?.datatype === 'string' ? entry.datatype : entry?.datatype?.name ?? null,
    valueType: valueTypeName(value),
    value: value?.value,
    raw: value?.raw,
    span: value?.span ?? null,
  };
}

function normalizeAttributeEvents(basePath, attributes) {
  const events = [];
  for (const [key, entry] of entriesFromAttributeMap(attributes)) {
    const event = normalizeAttributeEvent(basePath, key, entry);
    events.push(event);
    events.push(...normalizeAttributeEvents(event.path, entry?.annotations ?? entry?.attributes));
  }
  return events;
}

function normalizeSchemaEvents(rawEvents) {
  const events = [];
  for (const rawEvent of rawEvents) {
    const event = normalizeSchemaEvent(rawEvent);
    events.push(event);
    events.push(...normalizeAttributeEvents(event.path, rawEvent.annotations));
  }
  return events;
}

function numericRaw(event) {
  return event.raw !== undefined || event.value !== undefined
    ? String(event.raw ?? event.value)
    : null;
}

function toggleRaw(event) {
  return event.raw !== undefined || event.value !== undefined
    ? String(event.raw ?? event.value).toLowerCase()
    : null;
}

function schemaTypeMatches(event, constraints) {
  const numericWideningTypes = ['NumberLiteral', 'IntegerLiteral', 'FloatLiteral', 'HexLiteral', 'RadixLiteral'];
  if (typeof constraints.type !== 'string') {
    return true;
  }
  if (event.valueType === constraints.type) {
    return true;
  }
  if (constraints.nullable === true && event.valueType === 'NullLiteral') {
    return true;
  }
  if (constraints.allow_infinity === true && event.valueType === 'InfinityLiteral' && numericWideningTypes.includes(constraints.type)) {
    return true;
  }
  if (constraints.allow_nan === true && event.valueType === 'NaNLiteral' && numericWideningTypes.includes(constraints.type)) {
    return true;
  }
  return false;
}

function immediateChildCount(events, path) {
  const exactIndex = new RegExp(`^${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\[\\d+\\]$`);
  const objectChild = new RegExp(`^${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.(?:[A-Za-z_][A-Za-z0-9_]*|\\["(?:\\\\.|[^"])*"\\])$`);
  return events.filter((event) => exactIndex.test(event.path) || objectChild.test(event.path)).length;
}

function validateSchemaEvents(rawEvents, schema) {
  if (!schema) {
    return { ok: true, errors: [], warnings: [] };
  }

  const events = normalizeSchemaEvents(rawEvents)
    .filter((event) => !event.path.startsWith('$.[\"aeon:'));
  const errors = [];
  const selectorMatchSets = buildSchemaSelectorMatchSets(
    schema.rules,
    buildSchemaResolveNamespace(events),
  );

  for (const rule of schema.rules) {
    const ruleAddress = schemaRuleAddress(rule);
    const matches = events.filter((event) => schemaRuleMatches(rule, event, selectorMatchSets));
    const constraints = rule.constraints;

    if (constraints.required === true && matches.length === 0) {
      errors.push(schemaDiag('missing_required_field', ruleAddress, `Missing required field: ${ruleAddress}`));
      continue;
    }

    for (const event of matches) {
      if (!schemaTypeMatches(event, constraints)) {
        errors.push(schemaDiag('type_mismatch', event.path, `Type mismatch: expected ${constraints.type}, got ${event.valueType}`, event.span));
      }
      if (typeof constraints.datatype === 'string' && event.datatype !== constraints.datatype) {
        errors.push(schemaDiag('datatype_mismatch', event.path, `Datatype mismatch: expected ${constraints.datatype}, got ${event.datatype ?? '<none>'}`, event.span));
      }
      if (typeof constraints.type_is === 'string' && event.valueType !== (constraints.type_is === 'tuple' ? 'TupleNode' : 'ListNode')) {
        errors.push(schemaDiag('container_kind_mismatch', event.path, `Container kind mismatch: expected ${constraints.type_is}, got ${event.valueType}`, event.span));
      }
      if (Number.isInteger(constraints.length_exact)) {
        const count = immediateChildCount(events, event.path);
        if (count !== constraints.length_exact) {
          errors.push(schemaDiag('container_length_mismatch', event.path, `Container arity mismatch: expected ${constraints.length_exact}, got ${count}`, event.span));
        }
      }
      if (Number.isInteger(constraints.min_children)) {
        const count = immediateChildCount(events, event.path);
        if (count < constraints.min_children) {
          errors.push(schemaDiag('container_cardinality_mismatch', event.path, `Container cardinality mismatch: expected at least ${constraints.min_children}, got ${count}`, event.span));
        }
      }
      if (Number.isInteger(constraints.max_children)) {
        const count = immediateChildCount(events, event.path);
        if (count > constraints.max_children) {
          errors.push(schemaDiag('container_cardinality_mismatch', event.path, `Container cardinality mismatch: expected at most ${constraints.max_children}, got ${count}`, event.span));
        }
      }
      if (event.valueType === 'NullLiteral' && typeof constraints.null_value === 'string' && event.value !== constraints.null_value) {
        errors.push(schemaDiag('null_value_mismatch', event.path, `Null value mismatch: expected ${constraints.null_value}, got ${event.value ?? '<none>'}`, event.span));
      }
      if (event.valueType === 'StringLiteral' && typeof event.value === 'string') {
        if (Number.isInteger(constraints.min_length) && event.value.length < constraints.min_length) {
          errors.push(schemaDiag('string_min_length', event.path, `String length violation: expected min length ${constraints.min_length}, got ${event.value.length}`, event.span));
        }
        if (Number.isInteger(constraints.max_length) && event.value.length > constraints.max_length) {
          errors.push(schemaDiag('string_max_length', event.path, `String length violation: expected max length ${constraints.max_length}, got ${event.value.length}`, event.span));
        }
        if (typeof constraints.pattern === 'string' && !new RegExp(constraints.pattern).test(event.value)) {
          errors.push(schemaDiag('string_pattern', event.path, `String pattern violation: expected ${constraints.pattern}`, event.span));
        }
      }
      if (event.valueType === 'NumberLiteral') {
        const raw = numericRaw(event);
        if (raw === null) {
          continue;
        }
        const normalized = raw.replace(/_/g, '');
        if (constraints.sign === 'unsigned' && normalized.startsWith('-')) {
          errors.push(schemaDiag('numeric_sign', event.path, 'Numeric form violation: expected unsigned, got negative', event.span));
        }
        const integerDigits = normalized.replace(/^[+-]/, '').split(/[.eE]/)[0] ?? '';
        if (Number.isInteger(constraints.min_digits) && integerDigits.length < constraints.min_digits) {
          errors.push(schemaDiag('numeric_min_digits', event.path, `Numeric form violation: expected min ${constraints.min_digits} digits, got ${integerDigits.length}`, event.span));
        }
        if (Number.isInteger(constraints.max_digits) && integerDigits.length > constraints.max_digits) {
          errors.push(schemaDiag('numeric_max_digits', event.path, `Numeric form violation: expected max ${constraints.max_digits} digits, got ${integerDigits.length}`, event.span));
        }
        const asNumber = Number(normalized);
        if (Number.isFinite(asNumber) && constraints.min_value !== undefined && asNumber < Number(constraints.min_value)) {
          errors.push(schemaDiag('numeric_min_value', event.path, `Numeric value violation: expected >= ${constraints.min_value}, got ${normalized}`, event.span));
        }
        if (Number.isFinite(asNumber) && constraints.max_value !== undefined && asNumber > Number(constraints.max_value)) {
          errors.push(schemaDiag('numeric_max_value', event.path, `Numeric value violation: expected <= ${constraints.max_value}, got ${normalized}`, event.span));
        }
      }
      if (event.valueType === 'ToggleLiteral' && typeof constraints.toggle_pair === 'string' && constraints.toggle_pair !== 'any') {
        const raw = toggleRaw(event);
        const allowed = constraints.toggle_pair === 'yes_no'
          ? new Set(['yes', 'no'])
          : constraints.toggle_pair === 'on_off'
            ? new Set(['on', 'off'])
            : null;
        if (allowed && !allowed.has(raw)) {
          errors.push(schemaDiag('toggle_pair_mismatch', event.path, `Toggle pair mismatch: expected ${constraints.toggle_pair}, got ${raw ?? '<unknown>'}`, event.span));
        }
      }
    }
  }

  if (schema.world === 'closed') {
    const unexpected = new Set();
    for (const event of events) {
      if (!schema.rules.some((rule) => schemaRuleMatches(rule, event, selectorMatchSets))) {
        if (unexpected.has(event.path)) {
          continue;
        }
        unexpected.add(event.path);
        errors.push(schemaDiag('unexpected_binding', event.path, `Binding '${event.path}' is not allowed by closed-world schema`, event.span));
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings: [],
  };
}

function schemaSummary(schema) {
  if (!schema) {
    return 'schema: inactive';
  }
  return `schema: active (${schema.world ?? 'open'} · ${schema.rules.length} rule${schema.rules.length === 1 ? '' : 's'})`;
}

function annotationCompileOptions(options) {
  return {
    recovery: true,
    maxSeparatorDepth: options.maxSeparatorDepth,
    maxAttributeDepth: options.maxAttributeDepth,
    maxGenericDepth: options.maxGenericDepth,
    ...(options.validationMode === 'strict'
      ? { datatypePolicy: 'reserved_only' }
      : options.validationMode === 'custom'
        ? { datatypePolicy: 'allow_custom' }
        : {}),
  };
}

function buildTsAnnotations(source, options) {
  const annotationCompile = compile(source, annotationCompileOptions(options));
  return buildAnnotationStreamFromSource(source, annotationCompile.events);
}

export async function processWithTypeScriptCore(source, options) {
  const schema = parseSchemaOption(options);
  const canonical = canonicalize(source, {
    maxSeparatorDepth: options.maxSeparatorDepth,
    maxAttributeDepth: options.maxAttributeDepth,
    maxGenericDepth: options.maxGenericDepth,
  });
  const annotations = buildTsAnnotations(source, options);

  if (canonical.errors.length > 0) {
    return normalizeEngineResult('typescript', {
      canonical: '',
      finalized: null,
      annotations,
      events: [],
      warnings: [],
      errors: canonical.errors,
    });
  }

  if (options.validationMode === 'none') {
    return normalizeEngineResult('typescript', {
      canonical: canonical.text,
      finalized: null,
      annotations,
      events: [],
      warnings: [],
      errors: [],
    });
  }

  const compileResult = compile(source, {
    maxSeparatorDepth: options.maxSeparatorDepth,
    maxAttributeDepth: options.maxAttributeDepth,
    maxGenericDepth: options.maxGenericDepth,
    mode: options.validationMode === 'transport' ? 'transport' : options.validationMode,
    ...(options.validationMode === 'strict'
      ? { datatypePolicy: 'reserved_only' }
      : options.validationMode === 'custom'
        ? { datatypePolicy: 'allow_custom' }
        : {}),
  });

  if (compileResult.errors.length > 0) {
    return normalizeEngineResult('typescript', {
      canonical: canonical.text,
      finalized: null,
      annotations,
      events: selectVisibleEventSummary(
        normalizeTsEvents(compileResult.events),
        compileResult.header,
        options.finalizeScope,
      ),
      warnings: [],
      errors: compileResult.errors,
    });
  }

  const schemaResult = validateSchemaEvents(compileResult.events, schema);
  if (!schemaResult.ok) {
    return normalizeEngineResult('typescript', {
      canonical: canonical.text,
      finalized: null,
      annotations,
      events: selectVisibleEventSummary(
        normalizeTsEvents(compileResult.events),
        compileResult.header,
        options.finalizeScope,
      ),
      warnings: schemaResult.warnings,
      errors: schemaResult.errors,
    });
  }

  const finalized = finalizeJson(compileResult.events, {
    mode: options.validationMode === 'transport' ? 'loose' : 'strict',
    scope: options.finalizeScope,
    ...(compileResult.header
      ? {
          header: compileResult.header,
        }
      : {}),
    ...(options.materializationMode === 'projected'
      ? {
          materialization: 'projected',
          includePaths: options.includePaths,
        }
      : {}),
  });

  return normalizeEngineResult('typescript', {
    canonical: canonical.text,
    finalized: finalized.document,
    annotations,
    events: selectVisibleEventSummary(
      normalizeTsEvents(compileResult.events),
      compileResult.header,
      options.finalizeScope,
    ),
    warnings: finalized.meta?.warnings ?? [],
    errors: finalized.meta?.errors ?? [],
    schema: schemaSummary(schema),
  });
}

export async function processWithRustWasm(source, options, initInput = undefined) {
  const runtime = await loadAeonWasm(initInput ?? await loadDefaultWasmInput());
  const schema = parseSchemaOption(options);
  const result = normalizeEngineResult('rust-wasm', runtime.processAeon(source, {
    ...options,
    validationMode: options.validationMode === 'transport' ? 'loose' : options.validationMode,
  }));
  result.errors = normalizeDiagnosticSpansForSource(result.errors, source, options);
  result.warnings = normalizeDiagnosticSpansForSource(result.warnings, source, options);
  result.diagnostics = {
    errors: result.errors,
    warnings: result.warnings,
  };
  const schemaResult = validateSchemaEvents(result.events, schema);
  if (!schemaResult.ok) {
    const errors = [...result.errors, ...schemaResult.errors];
    return {
      ...result,
      ok: false,
      errors,
      diagnostics: {
        errors,
        warnings: result.warnings,
      },
    };
  }
  return result;
}
