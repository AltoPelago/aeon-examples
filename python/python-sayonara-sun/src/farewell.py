from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class Farewell:
    version: str
    daytime: str
    farewell: str
    sleep_tight: str
    sunset_hour: int
    cooldown_hours: int
    sleep_hour: int
    wake_hour: int

    def get_sunset_window(self) -> str:
        end_hour = (self.sunset_hour + self.cooldown_hours) % 24
        return f"{self.sunset_hour:02d}:00-{end_hour:02d}:00"

    def get_sleep_window(self) -> str:
        return f"{self.sleep_hour:02d}:00-{self.wake_hour:02d}:00"

    def _hour_in_window(self, current_hour: int, start_hour: int, end_hour: int) -> bool:
        if start_hour == end_hour:
            return True
        if start_hour < end_hour:
            return start_hour <= current_hour < end_hour
        return start_hour <= current_hour or current_hour < end_hour

    def get_message(self, current_hour: int) -> str:
        sunset_end = (self.sunset_hour + self.cooldown_hours) % 24
        if self._hour_in_window(current_hour, self.sleep_hour, self.wake_hour):
            return self.sleep_tight
        if self._hour_in_window(current_hour, self.sunset_hour, sunset_end):
            return self.farewell
        return self.daytime
