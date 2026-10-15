from __future__ import annotations

from datetime import datetime
from pathlib import Path
import sys

from altopelago.aeon import AeonError
from config import load_config


def main() -> None:
    try:
        farewell = load_config(Path(__file__).resolve().parents[1] / "sun.aeon")
        now = datetime.now()
        current_hour = now.hour

        print(f"AEON configuration loaded correctly (v{farewell.version})")
        print(f"Current local time: {now.strftime('%H:%M:%S')}")
        print(f"Sunset window: {farewell.get_sunset_window()}")
        print(f"Sleep window: {farewell.get_sleep_window()}")
        print("---")
        print(farewell.get_message(current_hour))
    except AeonError as error:
        print(error, file=sys.stderr)
        raise SystemExit(1) from error


if __name__ == "__main__":
    main()
