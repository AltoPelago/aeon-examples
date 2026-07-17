import { compile } from '@altopelago/aeon-core';
import { finalizeJson } from '@altopelago/aeon-finalize';

function schemaCompileOptions(options = {}) {
  return {
    maxSeparatorDepth: options.maxSeparatorDepth ?? 8,
    maxAttributeDepth: options.maxAttributeDepth ?? 1,
    maxGenericDepth: options.maxGenericDepth ?? 1,
    datatypePolicy: 'allow_custom',
  };
}

function normalizeRules(rules) {
  if (Array.isArray(rules)) {
    return rules.map((rule, index) => {
      if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
        throw new Error(`Schema rule ${index + 1} must be an object.`);
      }
      const hasPath = typeof rule.path === 'string' && rule.path.length > 0;
      const hasSelector = typeof rule.selector === 'string' && rule.selector.length > 0;
      if (hasPath === hasSelector) {
        throw new Error(`Schema rule ${index + 1} must include exactly one of path or selector.`);
      }
      const address = hasPath ? rule.path : rule.selector;
      if (address.includes('[*]')) {
        throw new Error(`Schema rule ${index + 1} uses legacy [*] wildcard syntax; use a SANSA selector with .* instead.`);
      }
      if (!rule.constraints || typeof rule.constraints !== 'object' || Array.isArray(rule.constraints)) {
        throw new Error(`Schema rule ${index + 1} must include constraints.`);
      }
      return {
        ...(hasPath ? { path: rule.path } : { selector: rule.selector }),
        constraints: rule.constraints,
      };
    });
  }

  if (rules && typeof rules === 'object') {
    return Object.entries(rules).map(([path, constraints]) => {
      if (!constraints || typeof constraints !== 'object' || Array.isArray(constraints)) {
        throw new Error(`Schema rule ${path} must be an object.`);
      }
      if (path.includes('[*]')) {
        throw new Error(`Schema rule ${path} uses legacy [*] wildcard syntax; use a SANSA selector with .* instead.`);
      }
      return { path, constraints };
    });
  }

  throw new Error('Schema must include rules.');
}

function normalizeSchemaObject(schema) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    throw new Error('Schema must be an AEON object.');
  }
  const schemaRoot = schema.aeos && typeof schema.aeos === 'object' && !Array.isArray(schema.aeos)
    ? schema.aeos
    : schema;
  if (schemaRoot.world !== undefined && schemaRoot.world !== 'open' && schemaRoot.world !== 'closed') {
    throw new Error('Schema world must be "open" or "closed".');
  }
  return {
    world: schemaRoot.world === 'closed' ? 'closed' : 'open',
    rules: normalizeRules(schemaRoot.rules),
  };
}

export function parseSchemaText(text, options = {}) {
  const raw = String(text ?? '').trim();
  if (!raw) {
    return null;
  }

  if (raw.startsWith('{') || raw.startsWith('[')) {
    return normalizeSchemaObject(JSON.parse(raw));
  }

  const result = compile(raw, schemaCompileOptions(options));
  if (result.errors.length > 0) {
    const first = result.errors[0];
    throw new Error(first.message ?? first.code ?? 'Schema AEON did not compile.');
  }

  const finalized = finalizeJson(result.events, {
    mode: 'strict',
    scope: 'payload',
  });
  return normalizeSchemaObject(finalized.document);
}

function aeonString(value) {
  return JSON.stringify(String(value));
}

function aeonKey(value) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value) ? value : JSON.stringify(value);
}

function constraintValueToAeon(value) {
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (Number.isFinite(value)) {
    return String(value);
  }
  return aeonString(value);
}

function constraintToAeon(key, value, indent) {
  return `${indent}${key}:${typeof value === 'boolean' ? 'boolean' : Number.isFinite(value) ? 'number' : 'string'} = ${constraintValueToAeon(value)}`;
}

export function schemaToAeon(schema) {
  const normalized = normalizeSchemaObject(schema);
  const lines = [
    '//! format:aeos-v1',
    'aeos:schema = {',
    '  id:string = "playground.schema"',
    '  version:string = "1"',
    `  world:string = ${aeonString(normalized.world)}`,
    '  rules:list<object> = [',
  ];

  for (const rule of normalized.rules) {
    lines.push('    {');
    if (rule.selector) {
      lines.push(`      selector:string = ${aeonString(rule.selector)}`);
    } else {
      lines.push(`      path:string = ${aeonString(rule.path)}`);
    }
    lines.push('      constraints:object = {');
    for (const [key, value] of Object.entries(rule.constraints)) {
      if (value === undefined || value === null || value === '') {
        continue;
      }
      lines.push(constraintToAeon(key, value, '        '));
    }
    lines.push('      }');
    lines.push('    }');
  }

  lines.push('  ]');
  lines.push('}');
  return lines.join('\n');
}
