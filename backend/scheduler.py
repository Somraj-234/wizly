"""Clock, sunrise, and rhythm automations. They run while this server is open."""

from __future__ import annotations

import asyncio
import logging
import math
from datetime import datetime
from typing import Any, Awaitable, Callable

from backend.store import read_json, write_json

SendPilot = Callable[[list[str], dict], Awaitable[Any]]
log = logging.getLogger("wizly")


def load_automations() -> list[dict[str, Any]]:
    payload = read_json("automations.json", [])
    return payload if isinstance(payload, list) else []


def save_automations(items: list[dict[str, Any]]) -> None:
    write_json("automations.json", items)


def _minutes(now: datetime) -> int:
    return now.hour * 60 + now.minute


def _sun_local_minutes(latitude: float, longitude: float, when: datetime, rise: bool) -> int | None:
    """NOAA-style sunrise or sunset, converted to the computer's local clock."""
    day = when.timetuple().tm_yday
    lng_hour = longitude / 15
    approx = day + ((6 if rise else 18) - lng_hour) / 24
    mean = (0.9856 * approx) - 3.289
    longitude_sun = (
        mean
        + (1.916 * math.sin(math.radians(mean)))
        + (0.020 * math.sin(math.radians(2 * mean)))
        + 282.634
    ) % 360
    right_asc = math.degrees(math.atan(0.91764 * math.tan(math.radians(longitude_sun)))) % 360
    right_asc += (math.floor(longitude_sun / 90) * 90) - (math.floor(right_asc / 90) * 90)
    right_asc /= 15
    sin_dec = 0.39782 * math.sin(math.radians(longitude_sun))
    cos_dec = math.cos(math.asin(sin_dec))
    cos_hour = (
        math.cos(math.radians(90.833)) - (sin_dec * math.sin(math.radians(latitude)))
    ) / (cos_dec * math.cos(math.radians(latitude)))
    if cos_hour > 1 or cos_hour < -1:
        return None
    hour_angle = 360 - math.degrees(math.acos(cos_hour)) if rise else math.degrees(math.acos(cos_hour))
    local_mean = hour_angle / 15 + right_asc - (0.06571 * approx) - 6.622
    utc_hours = (local_mean - lng_hour) % 24
    offset_hours = when.utcoffset().total_seconds() / 3600 if when.utcoffset() else 0
    local = (utc_hours + offset_hours) % 24
    return int(round(local * 60)) % (24 * 60)


def _due(stamp: str, today: str) -> bool:
    return stamp != today


async def run_due(send: SendPilot) -> None:
    items = load_automations()
    now = datetime.now().astimezone()
    today = now.date().isoformat()
    minute = _minutes(now)
    weekday = now.weekday()
    changed = False

    for item in items:
        if not item.get("enabled"):
            continue
        days = item.get("days") or list(range(7))
        if weekday not in days:
            continue
        ips = [ip for ip in item.get("ips", []) if isinstance(ip, str)]
        if not ips:
            continue
        kind = item.get("kind")
        fired = item.setdefault("fired", {})

        if kind == "schedule":
            target = _clock_minutes(item.get("time"))
            key = f"schedule:{today}"
            if target is not None and target <= minute <= target + 1 and _due(fired.get("schedule"), today):
                await _apply(send, ips, item.get("action"), item.get("params") or {"state": True})
                fired["schedule"] = today
                changed = True

        elif kind == "sun":
            lat = item.get("latitude")
            lon = item.get("longitude")
            if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)):
                continue
            event = _sun_local_minutes(float(lat), float(lon), now, item.get("event") != "sunset")
            if event is None:
                continue
            target = (event + int(item.get("offsetMin") or 0)) % (24 * 60)
            key = f"sun:{today}"
            if target <= minute <= target + 1 and _due(fired.get("sun"), today):
                await _apply(send, ips, item.get("action"), item.get("params") or {"state": True})
                fired["sun"] = today
                changed = True

        elif kind == "rhythm":
            points = item.get("points") or []
            current = None
            label = None
            for index, point in enumerate(points):
                at = point.get("minutes")
                if isinstance(at, int) and at <= minute:
                    current = point
                    label = str(index)
            if current is None or label is None:
                continue
            key = f"rhythm:{today}:{label}"
            if fired.get("rhythm") != key:
                action = current.get("action")
                params = current.get("params") or {}
                if action is not None:
                    await _apply(send, ips, action, params)
                elif params:
                    await send(ips, params)
                fired["rhythm"] = key
                changed = True

    if changed:
        save_automations(items)


def _clock_minutes(value: Any) -> int | None:
    if not isinstance(value, str) or ":" not in value:
        return None
    hour, minute = value.split(":", 1)
    try:
        return int(hour) * 60 + int(minute)
    except ValueError:
        return None


async def _apply(send: SendPilot, ips: list[str], action: Any, params: dict) -> None:
    """Apply a configured action. `action` picks the mode, `params` carries
    whichever of r/g/b, temp, sceneId, speed, and dimming that mode needs.
    """
    if action == "off":
        await send(ips, {"state": False})
        return
    payload = dict(params or {})
    if "state" not in payload:
        payload["state"] = True
    await send(ips, payload)


async def loop(send: SendPilot, stop: asyncio.Event) -> None:
    while not stop.is_set():
        try:
            await run_due(send)
        except Exception:
            log.exception("automation tick failed")
        try:
            await asyncio.wait_for(stop.wait(), timeout=20)
        except asyncio.TimeoutError:
            continue
