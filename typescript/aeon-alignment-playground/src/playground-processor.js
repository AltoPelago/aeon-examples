import { buildAnnotationStreamFromSource } from '@altopelago/aeon-annotation-stream';
import { canonicalize } from '@altopelago/aeon-canonical';
import { compile, formatPath } from '@altopelago/aeon-core';
import { finalizeJson } from '@altopelago/aeon-finalize';
import { loadAeonWasm } from '@altopelago/aeon-wasm';

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
    })),
    diagnostics: { errors, warnings },
    errors,
    warnings,
  };
}

function applyValidationMode(source, mode) {
  if (mode === 'none') {
    return source;
  }

  const compileMode = mode === 'loose' ? 'transport' : mode;
  const trivia = String.raw`(?:(?:\/#[\s\S]*?#\/)|(?:\/\*[\s\S]*?\*\/)|[ \t\r\n])*`;
  const structuredHeaderRe = new RegExp(`(aeon${trivia}:${trivia}header${trivia}=${trivia}\\{)([\\s\\S]*?)(\\n\\})`, 'm');
  const shorthandModeRe = new RegExp(`aeon${trivia}:${trivia}mode${trivia}=${trivia}"[^"]*"`, 'm');
  const structuredModeRe = new RegExp(`(^[ \\t]*mode${trivia}(?::[\\s\\S]*?)?${trivia}=${trivia})"[^"]*"`, 'm');

  if (structuredHeaderRe.test(source)) {
    return source.replace(structuredHeaderRe, (match, open, body, close) => {
      if (structuredModeRe.test(body)) {
        return `${open}${body.replace(structuredModeRe, `$1"${compileMode}"`)}${close}`;
      }
      return `${open}${body}\n  mode = "${compileMode}"${close}`;
    });
  }

  if (shorthandModeRe.test(source)) {
    return source.replace(shorthandModeRe, `aeon:mode = "${compileMode}"`);
  }

  return `aeon:mode = "${compileMode}"\n${source}`;
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

  const compileResult = compile(applyValidationMode(source, options.validationMode), {
    maxSeparatorDepth: options.maxSeparatorDepth,
    maxAttributeDepth: options.maxAttributeDepth,
    maxGenericDepth: options.maxGenericDepth,
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

  const finalized = finalizeJson(compileResult.events, {
    mode: options.validationMode === 'loose' ? 'loose' : 'strict',
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
  });
}

export async function processWithRustWasm(source, options, initInput = undefined) {
  const runtime = await loadAeonWasm(initInput ?? await loadDefaultWasmInput());
  return normalizeEngineResult('rust-wasm', runtime.processAeon(source, options));
}
