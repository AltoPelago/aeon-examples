from __future__ import annotations

from pathlib import Path

from aeon import AeonLoadError, LoadOptions, LoadedDocument, load_file
from farewell import Farewell


def load_config(file_path: str | Path) -> Farewell:
    # Load the document and apply AEOS schema checks before business logic runs.
    document = load_file(
        file_path,
        LoadOptions(
            schema=build_schema(),
            datatype_policy="allow_custom",
        ),
    )
    document.require_ok()

    # These checks are app-specific rules layered on top of the schema contract.
    require_datatype(document, "$.sun", "farewell")
    require_unsigned_integer_range(document, "$.sun.sunsetHour", 16, 21)
    require_unsigned_integer_range(document, "$.sun.cooldownHours", 1, 6)
    require_unsigned_integer_range(document, "$.sun.sleepHour", 21, 23)
    require_unsigned_integer_range(document, "$.sun.wakeHour", 1, 7)

    return map_farewell(document)


def build_schema() -> dict[str, object]:
    return {
        "rules": [
            {"path": "$.sun", "constraints": {"required": True, "type": "ObjectNode"}},
            {"path": "$.sun.version", "constraints": {"required": True, "type": "SeparatorLiteral"}},
            {"path": "$.sun.daytime", "constraints": {"required": True, "type": "StringLiteral"}},
            {"path": "$.sun.farewell", "constraints": {"required": True, "type": "StringLiteral"}},
            {"path": "$.sun.sleepTight", "constraints": {"required": True, "type": "StringLiteral"}},
            {
                "path": "$.sun.sunsetHour",
                "constraints": {"required": True, "type": "IntegerLiteral", "sign": "unsigned", "min_digits": 1, "max_digits": 2},
            },
            {
                "path": "$.sun.cooldownHours",
                "constraints": {"required": True, "type": "IntegerLiteral", "sign": "unsigned", "min_digits": 1, "max_digits": 1},
            },
            {
                "path": "$.sun.sleepHour",
                "constraints": {"required": True, "type": "IntegerLiteral", "sign": "unsigned", "min_digits": 1, "max_digits": 2},
            },
            {
                "path": "$.sun.wakeHour",
                "constraints": {"required": True, "type": "IntegerLiteral", "sign": "unsigned", "min_digits": 1, "max_digits": 1},
            },
        ]
    }


def map_farewell(document: LoadedDocument) -> Farewell:
    return Farewell(
        version=read_separator_literal(document, "$.sun.version"),
        daytime=read_string_literal(document, "$.sun.daytime"),
        farewell=read_string_literal(document, "$.sun.farewell"),
        sleep_tight=read_string_literal(document, "$.sun.sleepTight"),
        sunset_hour=read_integer_literal(document, "$.sun.sunsetHour"),
        cooldown_hours=read_integer_literal(document, "$.sun.cooldownHours"),
        sleep_hour=read_integer_literal(document, "$.sun.sleepHour"),
        wake_hour=read_integer_literal(document, "$.sun.wakeHour"),
    )


def require_datatype(document: LoadedDocument, path: str, datatype: str) -> None:
    for event in document.compile.events:
        if event.get("path") == path:
            if event.get("datatype") != datatype:
                raise AeonLoadError(f"{path} must be typed as :{datatype}")
            return
    raise AeonLoadError(f"Missing required assignment at {path}")


def require_unsigned_integer_range(document: LoadedDocument, path: str, minimum: int, maximum: int) -> None:
    value = read_integer_literal(document, path)
    if value < minimum or value > maximum:
        raise AeonLoadError(f"{path} must be between {minimum} and {maximum}. Got: {value}")


def read_string_literal(document: LoadedDocument, path: str) -> str:
    value = document.require(path)
    if not isinstance(value, str):
        raise AeonLoadError(f"{path} must materialize to a string")
    return value


def read_separator_literal(document: LoadedDocument, path: str) -> str:
    return read_string_literal(document, path)


def read_integer_literal(document: LoadedDocument, path: str) -> int:
    value = document.require(path)
    if not isinstance(value, int):
        raise AeonLoadError(f"{path} must materialize to an integer")
    return value
