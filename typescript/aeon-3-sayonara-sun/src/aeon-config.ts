import fs from 'node:fs';
import { indexEventsByPath, readAeon, type CompileResult, type FinalizeJsonResult, type ReadAeonOptions } from '@altopelago/aeon-sdk';
import { validate } from '@altopelago/aeos-core';
import type { SchemaV1 } from '@altopelago/aeos-core';

type AssignmentEvent = CompileResult['events'][number];

export class ConfigValidationError extends Error {
  readonly phase: string;

  constructor(phase: string, message: string) {
    super(message);
    this.phase = phase;
    this.name = 'ConfigValidationError';
  }
}

export interface LoadedAeonDocument {
  readonly compile: CompileResult;
  readonly finalized: FinalizeJsonResult;
  readonly eventsByPath: ReadonlyMap<string, AssignmentEvent>;
}

export function loadAeonDocument(filePath: string, options: ReadAeonOptions = {}): LoadedAeonDocument {
  const source = fs.readFileSync(new URL(filePath, import.meta.url), 'utf8');
  const result = readAeon(source, options);

  // Keep compile failures separate from schema and business-rule failures.
  if (result.compile.errors.length > 0) {
    const summary = result.compile.errors.map((error) => `${error.code}: ${error.message}`).join('\n');
    throw new ConfigValidationError('compile', `Assignment stream validation failed:\n${summary}`);
  }

  return {
    compile: result.compile,
    finalized: result.finalized,
    eventsByPath: indexEventsByPath(result.compile.events),
  };
}

export function requireDatatype(document: LoadedAeonDocument, path: string, datatype: string): void {
  const event = document.eventsByPath.get(path);
  if (!event) {
    throw new ConfigValidationError('datatype', `Missing required assignment at ${path}`);
  }
  if (event.datatype !== datatype) {
    throw new ConfigValidationError('datatype', `${path} must be typed as :${datatype}`);
  }
}

export function requireSchema(document: LoadedAeonDocument, schema: SchemaV1): void {
  // AEOS validates the assignment stream shape before app-specific rules run.
  const result = validate(document.compile.events, schema);
  if (!result.ok) {
    const details = result.errors.map((diag) => `${diag.code} at ${diag.path}`).join('; ');
    throw new ConfigValidationError('schema', `Stream schema validation failed (${result.errors.length}): ${details}`);
  }
}

export function requireUnsignedIntegerRange(
  document: LoadedAeonDocument,
  path: string,
  min: number,
  max: number,
): void {
  const event = document.eventsByPath.get(path);
  const value = typeof event?.value === 'object' && event?.value && 'value' in event.value
    ? Number((event.value as { value: unknown }).value)
    : NaN;

  if (!Number.isInteger(value)) {
    throw new ConfigValidationError('business-rules', `${path} must be an integer. Got: ${String(value)}`);
  }
  if (value < min || value > max) {
    throw new ConfigValidationError('business-rules', `${path} must be between ${min} and ${max}. Got: ${value}`);
  }
}

export function requireNoFinalizeErrors(document: LoadedAeonDocument): void {
  const errors = document.finalized.meta?.errors ?? [];
  if (errors.length > 0) {
    const summary = errors.map((error) => error.message).join('\n');
    throw new ConfigValidationError('finalize', `Finalized object validation failed:\n${summary}`);
  }
}
