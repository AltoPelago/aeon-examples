import fs from 'node:fs';
import { formatPath, readAeon } from '@altopelago/aeon-sdk';
import { validate } from '@altopelago/aeos-core';
import { Greeting } from './Greeting.js';

export function loadConfig(filePath: string): Greeting {
    const source = fs.readFileSync(new URL(filePath, import.meta.url), 'utf8');

    // Parse it using strict mode
    const { compile, finalized } = readAeon(source, {
        compile: { datatypePolicy: 'allow_custom' },
        finalize: { mode: 'strict' }
    });

    // Best practice 1: Validate the assignment stream for structural syntax errors
    if (compile.errors.length > 0) {
        const summary = compile.errors.map(e => `${e.code}: ${e.message}`).join('\n');
        console.error(`Assignment stream syntax validation failed:\n${summary}`);
        process.exit(1);
    }

    // Best practice 2: Manually assert stream datatype constraints
    const moonEvent = compile.events.find((event) => formatPath(event.path) === '$.moon');
    if (!moonEvent || moonEvent.datatype !== 'greeting') {
        console.error("Validation failed: 'moon' must have datatype :greeting");
        process.exit(1);
    }

    // Best practice 3: Validate the assignment stream shape via AEOS schema validation
    const schema = {
        rules: [
            { path: '$.moon', constraints: { required: true, type: 'ObjectNode' } },
            { path: '$.moon.version', constraints: { required: true, type: 'SeparatorLiteral' } },
            { path: '$.moon.daytime', constraints: { required: true, type: 'StringLiteral' } },
            { path: '$.moon.nighttime', constraints: { required: true, type: 'StringLiteral' } },
            {
                path: '$.moon.hoursBeforeMidnight',
                constraints: { required: true, type: 'IntegerLiteral', sign: 'unsigned', min_digits: 1, max_digits: 1 } as const
            },
            {
                path: '$.moon.hoursAfterMidnight',
                constraints: { required: true, type: 'IntegerLiteral', sign: 'unsigned', min_digits: 1, max_digits: 1 } as const
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

    // Best practice 4: Validate logical business rules manually on the assignment stream before finalizing
    for (const event of compile.events) {
        const path = formatPath(event.path);

        if (path === '$.moon.hoursBeforeMidnight' || path === '$.moon.hoursAfterMidnight') {
            const val = parseInt((event.value as any).value, 10);
            if (val < 0 || val > 6) {
                console.error(`Stream validation failed: ${path} must be between 0 and 6. Got: ${val}`);
                process.exit(1);
            }
        }
    }

    // Best practice 5: Validate the finalized object for canonicalization / schema mapping errors
    if (finalized.meta?.errors && finalized.meta.errors.length > 0) {
        const summary = finalized.meta.errors.map(e => e.message).join('\n');
        console.error(`Finalized object validation failed:\n${summary}`);
        process.exit(1);
    }

    // Everything is valid! Wrap the trusted document in our strongly-typed business logic class
    const doc = finalized.document as any;
    return new Greeting(doc.moon);
}
