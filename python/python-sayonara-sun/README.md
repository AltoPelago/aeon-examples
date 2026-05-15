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

```bash
cd python/python-sayonara-sun
python3 -m pip install -r requirements.txt
python3 main.py
```

## Files

- `sun.aeon` - strict-mode AEON config file.
- `main.py` - top-level launcher.
- `src/config.py` - config loader for the example.
- `src/farewell.py` - application model.
- `src/index.py` - runtime entrypoint.

## Notes

The installed package name is `aeon-python`; the import module is `aeon`.
