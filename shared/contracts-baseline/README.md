# Contracts Baseline Example

Run from repo root:

```bash
npx --ignore-scripts @altopelago/aeon-cli@0.15.0 bind shared/contracts-baseline/sample-with-contracts.aeon --contract-registry <path-to-contract-registry.json> --strict
```

This example resolves `aeon:profile` and `aeon:schema` through the trusted registry and verifies contract artifact hashes before load.
