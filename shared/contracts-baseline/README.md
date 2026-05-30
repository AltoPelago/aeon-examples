# Contracts Baseline Example

Run from repo root:

```bash
npx @altopelago/aeon-cli@0.9.2 bind sample-with-contracts.aeon --contract-registry <path-to-contract-registry.json> --strict
```

This example resolves `aeon:profile` and `aeon:schema` through the trusted registry and verifies contract artifact hashes before load.
