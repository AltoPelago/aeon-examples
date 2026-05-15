# AEON Goodnight Moon

A deeper example demonstrating staged AEON validation, nested object evaluation, and application-facing config loading.

## Features specific to this example

Unlike `aeon-hello-world`, this example focuses on deeper application safeguards before accessing the finalized document:

1. **Datatype stream validation:** checks the `compile.events` stream directly to ensure that `moon` is annotated with the custom datatype `:greeting`.
2. **Separator-literal convention:** uses `version:ver[.] = ^1.0.0` and validates it as a `SeparatorLiteral`, not as a built-in semver literal.
3. **Shape validation:** ensures nested structure and expected literal families exist before finalizing.
4. **Business rule validation:** checks the hour fields on the assignment stream before handing data to application code.
5. **Application logic:** consumes the trusted finalized object to choose the daytime or nighttime greeting using local system time.

## Usage

1. **Install dependencies:**
   ```bash
   npm install --ignore-scripts
   ```

2. **Run the example:**
   ```bash
   npm start
   ```

## Files

- `moon.aeon` - The target AEON document using strict mode.
- `src/config.ts` - Contains the staged validation pipeline before handing the document to the app.
- `src/index.ts` - The main application logic. It imports the validated runtime configuration and performs the time-based check.
- `src/Greeting.ts` - A small application model that wraps the trusted finalized object.
