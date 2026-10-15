import { readFileSync } from 'node:fs';
import { canonicalAddress, loadInventory, queries, queryRequired, queryValueForDisplay, resolveRequired, sampleAddresses } from './explorer.js';

function header(title: string) {
  console.log(`\n=== ${title} ===`);
}

// Resolve relative to this module, not the caller's working directory.
const source = readFileSync(new URL('../inventory.aeon', import.meta.url), 'utf8');
const { compile, namespace } = loadInventory(source);

header('1. Loading AEON and compiling to AES events');
console.log(`Compiled ${compile.events.length} AES events.`);

header('2. Building the published SDK SANSA namespace');
console.log(`Root: ${namespace.root.address}`);
console.log(`Payload members: ${namespace.root.children.map(binding => binding.name).join(', ')}`);

header('3. Parsing and rendering SANSA addresses');
for (const address of sampleAddresses) {
  const result = canonicalAddress(address);
  console.log(`${address} -> ${result.canonical} (exact: ${result.exact})`);
}

header('4. Resolving exact and wildcard addresses');
for (const address of ['$.inventory.warehouse', '$.inventory.items.*.sku']) {
  for (const binding of resolveRequired(address, namespace)) {
    console.log(`${binding.address} => ${binding.value}`);
  }
}

header('5. Evaluating SANSA queries');
for (const { title, query } of queries) {
  console.log(`\n${title}\n${query}`);
  const rows = queryRequired(query, namespace);
  console.log(`Result records (${rows.length}):`);
  for (const row of rows) {
    console.log(`${row.candidateAddress ?? '<derived>'} =>`, queryValueForDisplay(row.value));
  }
}

header('Completed AEON -> AES -> SANSA walkthrough');
