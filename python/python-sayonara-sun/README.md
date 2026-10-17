# AEON Python Sayonara Sun

A Python config-loading example that mirrors the staged-validation shape of the TypeScript `aeon-3-sayonara-sun` sample, but now uses the higher-level Python loading API instead of building the AEON plumbing by hand.

## What This Example Is Showing

1. `src/config.py`
   - loads the file through the high-level API
   - runs schema validation
   - checks a few business rules
   - maps trusted values into a Python model
2. `src/farewell.py`
   - holds the tiny application model
3. `src/index.py`
   - drives the example and prints the result

## Usage

Use CPython 3.12–3.14 in a virtual environment. The pinned requirement installs
the published native `altopelago-aeon==0.16.0` wheel from PyPI.

```bash
cd python/python-sayonara-sun
python3 -m pip install -r requirements.txt
python3 main.py
```

## Files

- `sun.aeon` - typed custom-mode AEON config file.
- `main.py` - top-level launcher.
- `src/config.py` - config loader for the example.
- `src/farewell.py` - application model.
- `src/index.py` - runtime entrypoint.

## Notes

Import `altopelago.aeon`, not the old reference module `aeon`. The native
loader takes keyword arguments, receives serialized schema contract text, and
returns immutable event objects (read `event.path`/`event.datatype`, not dict
keys). `schema_id` and `schema_version` identify this consumer-supplied schema;
they do not authenticate it.

The source uses custom mode because `:farewell` and `:ver` are application
labels. This still requires typed bindings. Schema constraints run before
business rules, and JSON materialization remains strict. The loader's `mode`
argument selects materialization policy, not a custom-datatype compile override.
