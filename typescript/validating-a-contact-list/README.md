# Validating A Contact List

Simple Node example that:

1. Reads a contacts AEON file.
2. Validates input strictly.
3. Maps each entry into a TypeScript `Contact` object shape.
4. Prints contacts.

This bundle also includes a sibling AEOS schema artifact:

- `schema.aeos`
- `schema.json`

## Install

```bash
cd typescript/validating-a-contact-list
npm install --ignore-scripts
```

## Generate sample data (5 random contacts)

```bash
npm run generate-sample -- ./data/contacts.aeon
```

## Read + validate + print

```bash
npm run read-contacts -- ./data/contacts.aeon
```

Implementation note:
- the examples use `readAeonChecked(...)` from `@altopelago/aeon-sdk` to collapse the repeated "compile errors must be zero / finalize errors must be zero" boilerplate before mapping into application objects.

## AEON assignment-stream validation example

This demonstrates the AEON.AS pattern: validate from `compile.events` via normalized SANSA-style selectors (for example `contacts.*.firstName`) before trusting `finalized.document`.

```bash
npm run read-contacts-assignment -- ./data/contacts.aeon
```

## Expected AEON format

```aeon
aeon:header = {
  encoding:string = "utf-8"
  mode:string = "transport"
  version = "1"
  profile = "aeon.gp.profile.v1"
  schema = "altopelago.contact-list.schema.v1"
}
contacts:contactList = [
  {
    firstName:string = "Ava"
    lastName:string = "Parker"
    email:string = "ava.parker42@example.com"
    phone:string = "+61411222333"
    countryCode:string = "AU"
  }
]
```

Schema note:
- the documents declare `schema = "altopelago.contact-list.schema.v1"` in `aeon:header`
- `schema.aeos` is the canonical authoring artifact for that schema
- `schema.json` mirrors the same rule set for validator/tooling surfaces that still consume `SchemaV1` directly

Pattern write-up:
- `articles/aeon-hybrid-validation-pattern.md` in the public examples repo when that write-up is promoted
