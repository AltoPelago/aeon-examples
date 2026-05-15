# AEON Python Hello World

A minimal Python example that reads an AEON document, loads it through the convenience API, and prints one value.

This is the smallest readable starting point for the Python implementation. It is intentionally simpler than the staged-validation examples.

## Usage

```bash
cd python/python-hello-world
python3 -m pip install -r requirements.txt
python3 main_minimal.py
python3 main.py
python3 main_finalize.py
```

## Files

- `hello.aeon` - strict-mode AEON input document.
- `main_minimal.py` - the shortest copyable version.
- `main.py` - the same example with a few explanatory comments.
- `main_finalize.py` - the minimal version using `finalize_json(...)`.

## What It Does

All three scripts only do three things:

1. imports the installed `aeon-python` package
2. loads `hello.aeon`
3. reads `greeting` and prints it

Use `main_minimal.py` if you want the fastest possible starting point.

Use `main.py` if you want the same flow with a little more explanation.

Use `main_finalize.py` if you want the same hello-world example through the new Python finalization layer.

### Which Style Should You Start With?

- `main_minimal.py`: start here if you want the shortest "load -> require -> print" flow.
- `main_finalize.py`: start here if you want to see the finalized document directly.
- `main.py`: use this when you want the same convenience flow with a little commentary.

If you want the fuller "compile + schema validation + business rules" shape, use [python-sayonara-sun](../python-sayonara-sun/README.md) instead.

## Notes

The installed package name is `aeon-python`; the import module is `aeon`.
