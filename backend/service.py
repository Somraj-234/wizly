"""Talk to bulbs with the documented UDP methods, via pywizlight's socket."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import pywizlight.bulb as wizbulb
from pywizlight.bulb import wizlight
from pywizlight.exceptions import WizLightConnectionError, WizLightMethodNotFound, WizLightTimeOutError

from backend.scan import scan

# A missing bulb otherwise blocks the API for 13 seconds per method.
wizbulb.TIMEOUT = 3
wizbulb.MAX_SEND_DATAGRAMS = 2

from backend.protocol import (
    CONTROL_PORT,
    PUSH_PORT,
    RANGE_NOTE,
    SCENES,
    decode_module,
    kelvin_bounds_from_configs,
    sanitize_pilot,
)
from backend.store import read_json, write_json

log = logging.getLogger("wizly")

BULB_ERRORS = (WizLightConnectionError, WizLightTimeOutError, WizLightMethodNotFound, OSError, asyncio.TimeoutError)


def _result(payload: dict | None) -> dict:
    if not isinstance(payload, dict):
        return {}
    result = payload.get("result")
    return result if isinstance(result, dict) else {}


def _watts(power_payload: dict | None) -> float | None:
    power = _result(power_payload).get("power")
    if not isinstance(power, (int, float)):
        return None
    # pywizlight divides this field by 1000. Values above a few hundred are milliwatts.
    if power > 500:
        return round(power / 1000, 3)
    return round(float(power), 3)


class Hub:
    def __init__(self) -> None:
        self.lights: dict[str, wizlight] = {}
        self.records: dict[str, dict[str, Any]] = {}
        self.last_pilot: dict[str, dict[str, Any]] = {}
        self.kelvin: dict[str, tuple[int, int]] = {}
        self._guard = asyncio.Lock()
        self._refresh_lock = asyncio.Lock()
        self._call_locks: dict[str, asyncio.Lock] = {}
        known = read_json("known.json", {})
        if isinstance(known, dict):
            for ip, record in known.items():
                if isinstance(record, dict):
                    self.records[ip] = record
                    self.lights[ip] = wizlight(ip, mac=record.get("mac"))

    def _remember(self) -> None:
        write_json("known.json", self.records)

    def _bind(self, light: wizlight) -> None:
        """pywizlight stores the loop from construction time.

        The hub is built while the app is imported, before uvicorn's loop is
        running. A socket future from that old loop cannot be awaited by a
        request, which surfaces as "Future attached to a different loop".
        """
        loop = asyncio.get_running_loop()
        if light.loop is loop:
            return
        transport = light.transport
        light.transport = None
        light.protocol = None
        light.response_future = None
        if transport is not None:
            try:
                transport.close()
            except Exception:
                log.debug("closing a bulb socket from the old loop failed", exc_info=True)
        light.loop = loop
        light.lock = asyncio.Lock()

    def _call_lock(self, ip: str) -> asyncio.Lock:
        lock = self._call_locks.get(ip)
        if lock is None:
            lock = asyncio.Lock()
            self._call_locks[ip] = lock
        return lock

    async def _call(self, light: wizlight, method: str, params: dict | None = None) -> dict:
        self._bind(light)
        message: dict[str, Any] = {"method": method}
        if params is not None:
            message["params"] = params
        async with self._call_lock(light.ip):
            payload = await light.send(message)
        return payload if isinstance(payload, dict) else {}

    async def _refresh_one(self, ip: str) -> dict[str, Any]:
        light = self.lights[ip]
        errors: list[str] = []
        pilot_raw: dict = {}
        system_raw: dict = {}
        user_raw: dict = {}
        model_raw: dict = {}
        power_raw: dict = {}
        try:
            pilot_raw = await self._call(light, "getPilot", {})
        except BULB_ERRORS as exc:
            errors.append(f"getPilot: {exc or type(exc).__name__}")
            log.info("%s did not answer getPilot (%s). Skipping the other reads.", ip, errors[-1])
        if pilot_raw:
            for method, slot in (
                ("getSystemConfig", "system"),
                ("getUserConfig", "user"),
                ("getModelConfig", "model"),
                ("getPower", "power"),
            ):
                try:
                    payload = await self._call(light, method, {})
                except BULB_ERRORS as exc:
                    errors.append(f"{method}: {exc or type(exc).__name__}")
                    continue
                if slot == "system":
                    system_raw = payload
                elif slot == "user":
                    user_raw = payload
                elif slot == "model":
                    model_raw = payload
                else:
                    power_raw = payload

        pilot = _result(pilot_raw)
        system = _result(system_raw)
        user = _result(user_raw)
        model = _result(model_raw)
        module_name = system.get("moduleName") or model.get("moduleName")
        decoded = decode_module(module_name if isinstance(module_name, str) else None)
        bounds = kelvin_bounds_from_configs(user, model)
        if bounds:
            self.kelvin[ip] = bounds
        mac = pilot.get("mac") or system.get("mac") or light.mac
        record = {
            "ip": ip,
            "mac": mac,
            "online": not errors or bool(pilot or system),
            "errors": errors,
            "pilot": pilot,
            "module": decoded,
            "kelvin": {"min": bounds[0], "max": bounds[1]} if bounds else None,
            "rssi": pilot.get("rssi"),
            "fwVersion": system.get("fwVersion"),
            "lock": system.get("lock"),
            "powerWatts": _watts(power_raw),
            "ports": {"control": CONTROL_PORT, "push": PUSH_PORT},
            "rangeNote": RANGE_NOTE,
        }
        # `remove()` can pop this ip out of self.lights while the awaits above
        # were in flight. Nothing below this point awaits, so this check-then-write
        # is atomic under asyncio's cooperative scheduling: skip writing the record
        # back if the bulb was deleted while we were talking to it, otherwise a
        # concurrent refresh can resurrect a bulb right after it was removed.
        if ip in self.lights:
            self.records[ip] = record
            if isinstance(mac, str):
                light.mac = mac
        try:
            light._async_close()
        except Exception:
            log.debug("close after refresh failed", exc_info=True)
        return record

    async def discover(self, wait: float = 4.0) -> list[dict[str, Any]]:
        found = await asyncio.to_thread(scan, wait)
        log.info("Scan found %s bulb(s)", len(found))
        async with self._guard:
            found_ips = set()
            for item in found:
                found_ips.add(item.ip)
                if item.ip not in self.lights:
                    self.lights[item.ip] = wizlight(item.ip, mac=item.mac)
                else:
                    self.lights[item.ip].mac = item.mac
            for ip in list(self.lights):
                record = self.records.get(ip, {})
                if ip not in found_ips and not record.get("mac") and not record.get("fwVersion"):
                    log.info("Dropping %s because it never answered as a bulb", ip)
                    self.lights.pop(ip, None)
                    self.records.pop(ip, None)
            ips = list(self.lights)
        await asyncio.gather(*(self._refresh_one(ip) for ip in ips), return_exceptions=True)
        self._remember()
        return [self.records[ip] for ip in self.lights if ip in self.records]

    async def add_ip(self, ip: str) -> dict[str, Any]:
        async with self._guard:
            self.lights.setdefault(ip, wizlight(ip))
        record = await self._refresh_one(ip)
        self._remember()
        if not record.get("pilot") and not record.get("fwVersion"):
            raise ConnectionError(record["errors"][0] if record["errors"] else "No reply from that address.")
        return record

    def list_bulbs(self) -> list[dict[str, Any]]:
        return list(self.records.values())

    async def remove(self, ip: str) -> None:
        """Forget a bulb. Idempotent on purpose: removing something that is
        already gone (a second click, a stale card, a race with a refresh)
        is still a successful removal from the caller's point of view.
        """
        light = self.lights.pop(ip, None)
        self.records.pop(ip, None)
        self.last_pilot.pop(ip, None)
        self.kelvin.pop(ip, None)
        self._call_locks.pop(ip, None)
        if light is not None:
            try:
                await light.async_close()
            except Exception:
                log.debug("closing a bulb socket during removal failed", exc_info=True)
        self._remember()

    async def refresh(self, ip: str | None = None) -> list[dict[str, Any]]:
        if ip is None and self._refresh_lock.locked():
            return self.list_bulbs()
        ips = [ip] if ip else list(self.lights)
        if ip and ip not in self.lights:
            raise KeyError(ip)
        async with self._refresh_lock:
            await asyncio.gather(*(self._refresh_one(item) for item in ips))
            self._remember()
        return [self.records[item] for item in ips if item in self.records]

    async def hardware(self, ip: str) -> dict[str, Any]:
        if ip not in self.lights:
            raise KeyError(ip)
        light = self.lights[ip]
        methods = {}
        for method in ("getPilot", "getSystemConfig", "getUserConfig", "getModelConfig", "getPower"):
            try:
                methods[method] = await self._call(light, method, {})
            except BULB_ERRORS as exc:
                methods[method] = {"method": method, "error": str(exc)}
        await self._refresh_one(ip)
        self._remember()
        return {"summary": self.records.get(ip), "methods": methods, "scenes": SCENES}

    async def set_pilot(self, ips: list[str], params: dict, refresh: bool = True) -> list[dict[str, Any]]:
        missing = [ip for ip in ips if ip not in self.lights]
        if missing:
            raise KeyError(", ".join(missing))

        async def one(ip: str) -> dict[str, Any]:
            clean = sanitize_pilot(params, self.kelvin.get(ip))
            payload = await self._call(self.lights[ip], "setPilot", clean)
            self.last_pilot[ip] = clean
            return {"ip": ip, "params": clean, "response": payload}

        results = await asyncio.gather(*(one(ip) for ip in ips), return_exceptions=True)
        failed = [item for item in results if isinstance(item, Exception)]
        if failed and len(failed) == len(results):
            raise failed[0]
        ok = []
        for item in results:
            if isinstance(item, Exception):
                ok.append({"error": str(item)})
            else:
                ok.append(item)
        if refresh:
            await asyncio.gather(*(self._refresh_one(ip) for ip in ips), return_exceptions=True)
        return ok

    async def gradient(self, ips: list[str], start: dict, end: dict, dimming: int) -> list[dict[str, Any]]:
        if len(ips) < 2:
            raise ValueError("Pick at least two bulbs.")
        steps = len(ips) - 1

        def mix(index: int) -> dict:
            amount = index / steps
            return {
                "state": True,
                "dimming": dimming,
                "r": round(start["r"] + (end["r"] - start["r"]) * amount),
                "g": round(start["g"] + (end["g"] - start["g"]) * amount),
                "b": round(start["b"] + (end["b"] - start["b"]) * amount),
            }

        async def one(index: int, ip: str) -> dict[str, Any]:
            return (await self.set_pilot([ip], mix(index)))[0]

        return list(await asyncio.gather(*(one(index, ip) for index, ip in enumerate(ips))))

    async def reboot(self, ip: str) -> dict:
        if ip not in self.lights:
            raise KeyError(ip)
        return await self._call(self.lights[ip], "reboot", {})

    async def enforce_once(self) -> None:
        """If a locked bulb was changed elsewhere, send our last setPilot again."""
        for ip, params in list(self.last_pilot.items()):
            if ip not in self.lights or not params:
                continue
            try:
                raw = await self._call(self.lights[ip], "getPilot", {})
            except BULB_ERRORS:
                continue
            current = _result(raw)
            if _diverged(current, params):
                try:
                    await self._call(self.lights[ip], "setPilot", params)
                except BULB_ERRORS as exc:
                    log.warning("Could not restore %s: %s", ip, exc)

    async def close(self) -> None:
        for light in self.lights.values():
            try:
                await light.async_close()
            except Exception:
                log.debug("close failed", exc_info=True)


def _diverged(current: dict, commanded: dict) -> bool:
    for key, value in commanded.items():
        if key not in current:
            continue
        if current.get(key) != value:
            return True
    return False
