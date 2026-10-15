# SANSA Query Explorer (TypeScript)

A runnable AEON → AES → SANSA walkthrough: load an inventory, expose its
assignment events through the published SDK namespace adapter, resolve addresses,
and evaluate five SQL-like queries. A mutable document model is not required for
read-only querying.

## Run and test

From the repository root, check dependency age before installing:

```bash
npm run check:npm-package-age
cd typescript/sansa-query-explorer
npm ci --ignore-scripts
npm start
npm test
```

This example pins published AEON SDK **0.15.0** and independently versioned SANSA
**0.14.2**. The repository's seven-day third-party quarantine explicitly exempts
first-party AltoPelago releases. The example-local `.npmrc` disables dependency
lifecycle scripts. No sibling repositories or unreleased packages are required.

## The pipeline

1. `readAeonChecked` compiles `inventory.aeon` and gates compile and strict-JSON
   finalization errors before exposing the events. The source uses `custom` mode
   for application datatype labels such as `inventoryRecord` and `productList`.
   Labels alone are not schema validation; no schema or GP contract is applied.
2. `createAeonNamespace` from `@altopelago/aeon-sdk/sansa` builds the namespace
   from the compiled events. `scope: 'payload'` keeps the header outside inventory
   queries; the exact source bytes are supplied for provenance metadata.
3. `parseAddress` / `renderAddress` demonstrate exact, wildcard, representation
   filter and descendant addresses. `resolveAddress` retrieves the warehouse and
   SKU bindings, retaining their source addresses.
4. `evaluateQuery` demonstrates projection, boolean filtering, category/price
   comparisons, numeric sorting/limits and string functions.

Queries use AEON assignments for projected fields:

```text
from $.inventory.items.*
where .category == "hardware" and .price >= 10.0
select { sku = .sku name = .name price = .price }
```

Results retain `candidateAddress` and a tagged `value` (`scalar`, `object`, or
`bindingSet`). Only the console display unwraps these tags. Helpers throw on
parse, resolution or query errors, so an error cannot print a completed summary.
The tests assert the exact projected values and source addresses of all five
queries, not merely successful parsing or the number of rows.

## Precision and adapter boundaries

The example explicitly selects `numericMaterialization: 'native'` for numeric
comparisons and sorting over this small inventory. That uses JavaScript numbers;
it is not an arbitrary-precision decimal query engine and is not appropriate for
exact monetary calculations. The adapter keeps the canonical `numericLexeme`
(for example, authored `24.50` becomes `24.5`; authored formatting is not retained).
Omit the option for the adapter's lossless numeric-string default, which avoids
rounding large integers such as `9007199254740993` through a JavaScript number.

Use the published adapter rather than reconstructing bindings from native event
paths: AEON 0.15.0 exposes portable `NodeHead` topology, PascalCase representation
names, and distinct key/head attributes and identities. See the
[migration guide](https://github.com/AltoPelago/aeon/blob/main/docs/migration-0.15.0.md).
Tests cover those distinctions, header/body scopes, symbols and reduced-date/WTC
payloads. Namespace inspection preserves AEON scalar families; it does not make
symbols losslessly representable in strict JSON or turn reduced dates into
resolved instants. The inventory loader deliberately requires successful JSON
finalization; separate namespace-only tests do not claim JSON compatibility.

SANSA addresses locate the current structure; list positions can change after
edits. Structural identities are separate occurrence metadata. SANSA supplies
bounded, deterministic in-process evaluation, not persistent storage, indexes,
transactions or a cost-based query optimizer.

## Files

- `inventory.aeon`: typed sample inventory.
- `src/explorer.ts`: compilation, published adapter, addresses and query helpers.
- `src/index.ts`: console walkthrough, usable from any working directory after build.
- `src/explorer.test.ts`: query, provenance, adapter and error-path regressions.
