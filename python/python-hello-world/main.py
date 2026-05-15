from __future__ import annotations

from pathlib import Path

from aeon import load_file


def main() -> None:
    # Load the file through the high-level convenience API.
    loaded = load_file(Path(__file__).resolve().parent / "hello.aeon")
    loaded.require_ok()

    # Read the finalized document value by canonical path.
    print("Greeting:", loaded.require("$.greeting"))


if __name__ == "__main__":
    main()
