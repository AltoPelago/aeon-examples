# Schema Policy Showcase

Shared comparative example for AEOS schema behavior.

This bundle intentionally uses:

- one AEON document
- several sibling `.aeos` schema artifacts

so you can see how the same assignment stream behaves under different contracts.

## Files

- `document.aeon`
  one source document used across every schema in this bundle
- `schema-open.aeos`
  permissive open-world contract; this one should pass
- `schema-closed.aeos`
  closed-world contract; this one should fail on an extra field
- `schema-no-references.aeos`
  forbids references; this one should fail because the document uses a reference
- `schema-literal-region.aeos`
  requires a direct string literal at `$.app.region`; this one should fail because the document keeps `region` as a reference
- `schema-*.json`
  runtime mirrors of the same contracts for entrypoints that still consume `SchemaV1` directly

## Document

`document.aeon` contains:

- a typed app object
- a referenced `region` field
- an extra `debug` field

That lets the bundle demonstrate:

- open vs closed world
- reference acceptance vs reference rejection
- validating through a reference chain vs requiring a direct literal

## Why the header omits `schema`

Most examples in this workspace pin one schema id in `aeon:header`.

This bundle is different on purpose: it is a comparative showcase, so the same source file is meant to be run against multiple schemas. The header still declares the ecosystem context:

```aeon
aeon:header = {
  version = "1"
  profile = "aeon.gp.profile.v1"
}
```

If you want to pin one schema for distribution, add one of these:

```aeon
schema = "altopelago.schema-policy-showcase.open.v1"
```

or

```aeon
schema = "altopelago.schema-policy-showcase.closed.v1"
```

and so on.

## Expected outcomes

- `schema-open.aeos`
  should pass
- `schema-closed.aeos`
  should fail with `unexpected_binding` because `$.app.debug` is not declared
- `schema-no-references.aeos`
  should fail with `reference_forbidden`
- `schema-literal-region.aeos`
  should fail with `type_mismatch` because `$.app.region` is still a reference at the stream level

## Authoring note

The `.aeos` schemas use the nicer authoring surface where appropriate:

- `reference_target_path = "$.regions[*]"`

The JSON mirrors keep the projected runtime form:

- `reference_target_pattern = "^\\$\\.regions\\[\\d+\\]$"`
