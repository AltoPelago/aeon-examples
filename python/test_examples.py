from __future__ import annotations

from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from altopelago.aeon import AeonLoadError

ROOT = Path(__file__).resolve().parent
SUN_ROOT = ROOT / "python-sayonara-sun"
sys.path.insert(0, str(SUN_ROOT / "src"))
from config import load_config


class NativeExampleTests(unittest.TestCase):
    def load_source(self, source: str):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "sun.aeon"
            path.write_text(source, encoding="utf-8")
            return load_config(path)

    def test_sample_maps_native_events_and_document(self) -> None:
        model = load_config(SUN_ROOT / "sun.aeon")
        self.assertEqual(model.version, "1.2.0")
        self.assertEqual(model.sunset_hour, 18)
        self.assertEqual(model.get_message(19), "Sayonara, Sun")

    def test_schema_rejects_boolean_hour(self) -> None:
        source = (SUN_ROOT / "sun.aeon").read_text(encoding="utf-8")
        source = source.replace("sunsetHour:number = 18", "sunsetHour:boolean = true")
        with self.assertRaises(AeonLoadError):
            self.load_source(source)

    def test_app_rejects_fractional_hour(self) -> None:
        source = (SUN_ROOT / "sun.aeon").read_text(encoding="utf-8")
        source = source.replace("sunsetHour:number = 18", "sunsetHour:number = 18.5")
        with self.assertRaisesRegex(AeonLoadError, "must materialize to an integer"):
            self.load_source(source)

    def test_business_rules_reject_out_of_range_hour(self) -> None:
        source = (SUN_ROOT / "sun.aeon").read_text(encoding="utf-8")
        source = source.replace("sunsetHour:number = 18", "sunsetHour:number = 22")
        with self.assertRaisesRegex(AeonLoadError, "between 16 and 21") as raised:
            self.load_source(source)
        self.assertEqual(len(raised.exception.errors), 1)

    def test_application_datatype_is_checked(self) -> None:
        source = (SUN_ROOT / "sun.aeon").read_text(encoding="utf-8")
        source = source.replace("sun:farewell", "sun:object")
        with self.assertRaisesRegex(AeonLoadError, "must be typed as :farewell"):
            self.load_source(source)

    def test_scripts_run_from_outside_their_example_directory(self) -> None:
        for script in ["main_minimal.py", "main.py", "main_finalize.py"]:
            result = subprocess.run(
                [sys.executable, str(ROOT / "python-hello-world" / script)],
                cwd=tempfile.gettempdir(), capture_output=True, text=True, check=True,
            )
            self.assertIn("Hello, World from AEON!", result.stdout)
        result = subprocess.run(
            [sys.executable, str(SUN_ROOT / "main.py")],
            cwd=tempfile.gettempdir(), capture_output=True, text=True, check=True,
        )
        self.assertIn("AEON configuration loaded correctly", result.stdout)


if __name__ == "__main__":
    unittest.main()
