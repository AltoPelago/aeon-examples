from pathlib import Path

from aeon import load_file


loaded = load_file(Path(__file__).resolve().parent / "hello.aeon")
loaded.require_ok()
print("Greeting:", loaded.require("$.greeting"))
