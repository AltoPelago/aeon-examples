import { readAeonChecked } from '@altopelago/aeon-sdk';
import { createAeonNamespace, type AeonSansaNamespace } from '@altopelago/aeon-sdk/sansa';
import { evaluateQuery, parseAddress, renderAddress, resolveAddress, type SansaQueryValue } from '@altopelago/sansa';

/** Compile and validate before exposing events to the published SANSA adapter. */
export function loadInventory(source: string) {
  const { compile } = readAeonChecked(source, {
    compile: { datatypePolicy: 'allow_custom' },
    finalize: { mode: 'strict' },
  });
  const namespace = createAeonNamespace(compile.events, {
    scope: 'payload',
    // This small inventory intentionally uses JS numbers for comparisons/sorting.
    // Omit this option for the adapter's lossless numeric-string default.
    numericMaterialization: 'native',
    sourceBytes: new TextEncoder().encode(source),
  });
  return { compile, namespace };
}

export const sampleAddresses = [
  '$.inventory.items[0].sku',
  '$.inventory.items.*.name',
  '$.inventory.items.*.qty%NumberLiteral',
  '$.inventory.**',
] as const;

export function canonicalAddress(source: string) {
  const result = parseAddress(source);
  if (!result.ok) throw new Error(`Address parse failed: ${JSON.stringify(result.errors)}`);
  return { canonical: renderAddress(result.address), exact: result.address.isExact };
}

export function resolveRequired(address: string, namespace: AeonSansaNamespace) {
  const result = resolveAddress(address, namespace);
  if (!result.ok) throw new Error(`Address resolution failed: ${JSON.stringify(result.errors)}`);
  if (result.bindings.length === 0) throw new Error(`No bindings found at ${address}`);
  return result.bindings;
}

export function queryRequired(query: string, namespace: AeonSansaNamespace) {
  const result = evaluateQuery(query, namespace);
  if (!result.ok) throw new Error(`Query failed: ${JSON.stringify(result.errors)}`);
  return result.results;
}

/** For readable output only: callers can keep the tagged query values instead. */
export function queryValueForDisplay(value: SansaQueryValue): unknown {
  if (value.type === 'scalar' || value.type === 'object') return value.value;
  return value.bindings.map((binding) => ({ address: binding.address, value: binding.value }));
}

export const queries = [
  {
    title: 'Select all SKUs and names',
    query: 'from $.inventory.items.*\nselect { sku = .sku name = .name }',
  },
  {
    title: 'Filter active items only',
    query: 'from $.inventory.items.*\nwhere .active == true\nselect { sku = .sku name = .name price = .price }',
  },
  {
    title: 'Filter by category and price threshold',
    query: 'from $.inventory.items.*\nwhere .category == "hardware" and .price >= 10.0\nselect { sku = .sku name = .name price = .price }',
  },
  {
    title: 'Order by quantity descending, top 3 items',
    query: 'from $.inventory.items.*\norder by .qty desc\nlimit 3\nselect { name = .name qty = .qty }',
  },
  {
    title: 'String function: items with "Probe" or "Clamp" in name',
    query: 'from $.inventory.items.*\nwhere contains(.name, "Clamp") or contains(.name, "Probe")\nselect { sku = .sku name = .name category = .category }',
  },
] as const;
