import fs from 'node:fs';
import { readAeon } from '@altopelago/aeon-sdk';
import { validate } from '@altopelago/aeos-core';

// Load the aeon file
const source = fs.readFileSync(new URL('./hello.aeon', import.meta.url), 'utf8');

// Parse it using strict mode (default for finalize is strict, but we can be explicit)
const { compile, finalized } = readAeon(source, {
    finalize: { mode: 'strict' }
});

// Best practice 1: Validate the assignment stream for structural errors
if (compile.errors.length > 0) {
    const summary = compile.errors.map(e => `${e.code}: ${e.message}`).join('\n');
    console.error(`Assignment stream validation failed:\n${summary}`);
    process.exit(1);
}

// Best practice 2: Validate the assignment stream shape via AEOS schema validation
// This guarantees the node types at the AST level, ensuring the greeting
// is ACTUALLY a string literal, not a number, boolean, or complex object.
const schema = {
    rules: [
        {
            path: '$.greeting',
            constraints: { required: true, type: 'StringLiteral' }
        }
    ]
};

const schemaResult = validate(compile.events, schema);
if (!schemaResult.ok) {
    const details = schemaResult.errors
        .map((diag) => `${diag.code} at ${diag.path}`)
        .join('; ');
    console.error(`Stream schema validation failed (${schemaResult.errors.length}): ${details}`);
    process.exit(1);
}

// Best practice 3: Validate the finalized object for canonicalization / schema mapping errors
if (finalized.meta?.errors?.length > 0) {
    const summary = finalized.meta.errors.map(e => e.message).join('\n');
    console.error(`Finalized object validation failed:\n${summary}`);
    process.exit(1);
}

// Everything is valid! Get the document
const doc = finalized.document;

console.log("AEON parsed successfully.");
console.log("Greeting:", doc.greeting);
