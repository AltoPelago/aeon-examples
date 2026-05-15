# AEON Hello World

A minimal example demonstrating how to load an AEON file, parse it using best practices (validating both the assignment stream and finalized object), and output the result.

## Usage

1. **Install dependencies:**
   ```bash
   npm install --ignore-scripts
   ```

2. **Run the example:**
   ```bash
   npm start
   ```

## Why two-stage validation?

AEON strictly separates parsing (syntax) from semantic mapping (schema). Best practice is to validate the intermediate **assignment stream** using `@altopelago/aeos-core` before finalizing to a JavaScript object. This guarantees that basic structural expectations (e.g., that `greeting` is genuinely a StringLiteral not a NumberLiteral) are met independently of JavaScript types.

## Files

- `hello.aeon` - The target AEON document using strict mode.
- `index.js` - The script that reads, parses, and validates the document.
