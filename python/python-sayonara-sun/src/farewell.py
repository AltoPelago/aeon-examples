from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class Farewell:
    version: str
    daytime: str
    farewell: str
    sunset_hour: int
    cooldown_hours: int

    def get_sunset_window(self) -> str:
        end_hour = (self.sunset_hour + self.cooldown_hours) % 24
        return f"{self.sunset_hour:02d}:00-{end_hour:02d}:00"

    def get_message(self, current_hour: int) -> str:
        window_end = self.sunset_hour + self.cooldown_hours
        is_sunset_window = self.sunset_hour <= current_hour < window_end
        return self.farewell if is_sunset_window else self.daytime