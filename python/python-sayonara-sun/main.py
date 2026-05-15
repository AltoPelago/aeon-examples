from __future__ import annotations

from pathlib import Path
import sys


EXAMPLE_ROOT = Path(__file__).resolve().parent

sys.path.insert(0, str(EXAMPLE_ROOT / "src"))

from index import main


if __name__ == "__main__":
    main()
