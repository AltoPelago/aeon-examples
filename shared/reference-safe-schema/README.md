# Reference-Safe AEOS Schema

Focused shared example for the new AEOS reference hardening surface:

- `reference_target_path`
- `resolve_reference_form`

The example keeps the document small on purpose so the boundary is easy to see:

- `person.postcode` is only allowed to point into `postcodes[...]`
- `person.age` is only allowed to point into `ages[...]`
- both fields validate the terminal literal form reached by the reference chain

## Files

- `schema.aeos`
  Human-facing AEOS schema document using the canonical `aeos:schema = { ... }` form
- `schema.json`
  Runtime mirror in `SchemaV1` JSON form for current validator/tooling surfaces that still consume JSON directly
- `valid-person.aeon`
  Valid document where each reference points to the correct domain and resolves to an allowed value
- `invalid-swapped-domain.aeon`
  Invalid document where `person.postcode` points at `ages[0]`
- `invalid-laundered-terminal.aeon`
  Invalid document where `person.postcode` points at `postcodes[0]`, but that entry is itself a clone of `ages[0]`

## Why this example exists

This bundle demonstrates the two complementary checks:

- `reference_target_path`
  is the preferred authoring constraint for where a reference may point
- `resolve_reference_form`
  protects what literal value the reference ultimately represents

Using both closes the common "role swap" and "value laundering through an allowed target" gaps.

## Safe pattern

`schema.aeos` expresses the schema in AEON form using the author-friendly surface, and `schema.json` mirrors the projected runtime rule set for current validator entrypoints.

All example documents also declare the same schema id in `aeon:header`:

```aeon
aeon:header = {
  version = "1"
  profile = "aeon.gp.profile.v1"
  schema = "altopelago.reference-safe-schema.v1"
}
```

In `schema.aeos`, the author-facing rule uses:

```aeon
reference_target_path = "$.postcodes[*]"
```

That projects to the runtime-facing rule in `schema.json`:

```json
{
  "reference_target_pattern": "^\\$\\.postcodes\\[\\d+\\]$"
}
```

The runtime rule for `$.person.postcode` is:

```json
{
  "path": "$.person.postcode",
  "constraints": {
    "reference": "require",
    "reference_kind": "clone",
    "reference_target_pattern": "^\\$\\.postcodes\\[\\d+\\]$",
    "type": "IntegerLiteral",
    "min_value": "1000",
    "max_value": "9999",
    "resolve_reference_form": true
  }
}
```

That means:

- the value at `$.person.postcode` must still be a clone reference
- the declared target must stay inside `$.postcodes[...]`
- the terminal literal must still be a 4-digit postcode in the configured range

## Expected outcomes

- `valid-person.aeon`
  should pass
- `invalid-swapped-domain.aeon`
  should fail with `reference_target_mismatch`
- `invalid-laundered-terminal.aeon`
  should fail with `numeric_form_violation`

## Notes

- Core still owns missing-target, forward-reference, self-reference, and cycle legality.
- This example is intentionally schema-only and language-neutral so it can be reused across TypeScript, Rust, and Python validator surfaces.
- Prefer the AEON-authored `schema.aeos` when reading or publishing the example. The JSON mirror exists because some validator entrypoints still accept in-memory `SchemaV1` objects directly.
