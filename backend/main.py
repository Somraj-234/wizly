"""HTTP API in front of the local WiZ UDP protocol."""

from __future__ import annotations

import asyncio
import hashlib
import logging
import re
import secrets
from contextlib import asynccontextmanager
from typing import Any
from urllib.request import Request, urlopen

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.nearby import scan_nearby
from backend.palette import dominant_colors
from backend.protocol import METHODS, SCENES, ProtocolError
from backend.scheduler import load_automations, loop as automation_loop, save_automations
from backend.service import Hub
from backend.store import read_json, write_json

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("wizly")

hub = Hub()
stop = asyncio.Event()
YOUTUBE_ID = re.compile(r"(?:v=|vi=|youtu\.be/|shorts/|embed/)([\w-]{11})")


class DiscoverBody(BaseModel):
    wait: float = Field(default=3, ge=1, le=8)


class AddBody(BaseModel):
    ip: str


class PilotBody(BaseModel):
    ips: list[str] = Field(min_length=1)
    params: dict[str, Any]


class GradientBody(BaseModel):
    ips: list[str] = Field(min_length=2)
    start: dict[str, int]
    end: dict[str, int]
    dimming: int = 70


class FadeBody(BaseModel):
    ips: list[str] = Field(min_length=1)
    start: int
    end: int
    ms: int = Field(default=1200, ge=200, le=8000)
    params: dict[str, Any] = Field(default_factory=dict)


class LockBody(BaseModel):
    pin: str = Field(min_length=4, max_length=64)
    enforce: bool = False


class UnlockBody(BaseModel):
    pin: str


class YoutubeBody(BaseModel):
    url: str


def _lock_file() -> dict:
    data = read_json("lock.json", {})
    return data if isinstance(data, dict) else {}


def _enabled() -> bool:
    return bool(_lock_file().get("enabled"))


def _token_ok(header: str | None) -> bool:
    if not _enabled():
        return True
    expected = _lock_file().get("token")
    return bool(header) and header == expected


def _hash_pin(pin: str, salt: str) -> str:
    return hashlib.sha256(f"{salt}:{pin}".encode("utf-8")).hexdigest()


def _require(header: str | None) -> None:
    if not _token_ok(header):
        raise HTTPException(status_code=401, detail="This site is locked. Unlock it with the PIN.")


@asynccontextmanager
async def lifespan(_: FastAPI):
    async def send(ips: list[str], params: dict) -> None:
        if _enabled() and _lock_file().get("enforce"):
            await hub.set_pilot(ips, params, refresh=False)
        elif not _enabled():
            await hub.set_pilot(ips, params, refresh=False)
        else:
            await hub.set_pilot(ips, params, refresh=False)

    async def enforce() -> None:
        while not stop.is_set():
            if _enabled() and _lock_file().get("enforce"):
                await hub.enforce_once()
            try:
                await asyncio.wait_for(stop.wait(), timeout=5)
            except asyncio.TimeoutError:
                continue

    tasks = [
        asyncio.create_task(automation_loop(send, stop)),
        asyncio.create_task(enforce()),
    ]
    yield
    stop.set()
    for task in tasks:
        task.cancel()
    await hub.close()


app = FastAPI(title="Wizly", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _pilot_error(exc: Exception) -> HTTPException:
    if isinstance(exc, ProtocolError):
        return HTTPException(status_code=400, detail=str(exc))
    if isinstance(exc, KeyError):
        return HTTPException(status_code=404, detail=f"Unknown bulb: {exc}")
    text = str(exc)
    if "-32602" in text or "Invalid params" in text:
        return HTTPException(
            status_code=409,
            detail=(
                "The bulb refused this change. Firmware 1.38 only accepts local commands when the WiZ app allows them. "
                "Open the WiZ app, go to Settings, then Security, and set local communication to Allow all controls. "
                "If that is already selected, switch to Only verified controls, save, then switch back to Allow all controls and save."
            ),
        )
    return HTTPException(status_code=502, detail=text)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True, "bulbs": len(hub.records)}


@app.get("/api/protocol")
def protocol() -> dict:
    return {"methods": METHODS, "scenes": SCENES}


@app.get("/api/lock")
def lock_status() -> dict:
    data = _lock_file()
    return {"enabled": bool(data.get("enabled")), "enforce": bool(data.get("enforce"))}


@app.post("/api/lock")
def lock_site(body: LockBody, x_wizly_token: str | None = Header(default=None)) -> dict:
    current = _lock_file()
    if current.get("enabled") and not _token_ok(x_wizly_token):
        if _hash_pin(body.pin, current.get("salt", "")) != current.get("pinHash"):
            raise HTTPException(status_code=401, detail="PIN does not match the lock.")
    salt = secrets.token_hex(16)
    token = secrets.token_urlsafe(32)
    write_json(
        "lock.json",
        {
            "enabled": True,
            "enforce": body.enforce,
            "salt": salt,
            "pinHash": _hash_pin(body.pin, salt),
            "token": token,
        },
    )
    return {"enabled": True, "enforce": body.enforce, "token": token}


@app.post("/api/unlock")
def unlock_site(body: UnlockBody) -> dict:
    current = _lock_file()
    if not current.get("enabled"):
        return {"enabled": False, "enforce": False}
    if _hash_pin(body.pin, current.get("salt", "")) != current.get("pinHash"):
        raise HTTPException(status_code=401, detail="PIN does not match.")
    write_json("lock.json", {"enabled": False, "enforce": False})
    return {"enabled": False, "enforce": False}


@app.post("/api/discover")
async def discover(body: DiscoverBody | None = None, x_wizly_token: str | None = Header(default=None)) -> dict:
    _require(x_wizly_token)
    try:
        bulbs = await hub.discover(wait=body.wait if body else 3)
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"UDP discovery failed: {exc}") from exc
    return {"bulbs": bulbs}


@app.post("/api/nearby")
async def nearby(body: DiscoverBody | None = None, x_wizly_token: str | None = Header(default=None)) -> dict:
    _require(x_wizly_token)
    found = await asyncio.to_thread(scan_nearby, body.wait if body else 2.5)
    return {
        "network": found["network"],
        "devices": found["devices"],
        "note": (
            "This is the network this computer is connected to, and the other devices on that same subnet. "
            "Nothing here is controlled. Infrared never arrives here."
        ),
    }


@app.post("/api/bulbs")
async def add_bulb(body: AddBody, x_wizly_token: str | None = Header(default=None)) -> dict:
    _require(x_wizly_token)
    try:
        record = await hub.add_ip(body.ip.strip())
    except ConnectionError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return record


@app.get("/api/bulbs")
async def bulbs(x_wizly_token: str | None = Header(default=None)) -> dict:
    _require(x_wizly_token)
    if hub.lights:
        try:
            await hub.refresh()
        except Exception:
            log.debug("refresh failed", exc_info=True)
    return {"bulbs": hub.list_bulbs()}


@app.get("/api/bulbs/{ip}/hardware")
async def hardware(ip: str, x_wizly_token: str | None = Header(default=None)) -> dict:
    _require(x_wizly_token)
    try:
        return await hub.hardware(ip)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Unknown bulb. Discover it first.") from exc


@app.post("/api/pilot")
async def pilot(body: PilotBody, x_wizly_token: str | None = Header(default=None)) -> dict:
    _require(x_wizly_token)
    try:
        results = await hub.set_pilot(body.ips, body.params)
    except Exception as exc:
        raise _pilot_error(exc) from exc
    return {"results": results, "bulbs": hub.list_bulbs()}


@app.post("/api/gradient")
async def gradient(body: GradientBody, x_wizly_token: str | None = Header(default=None)) -> dict:
    _require(x_wizly_token)
    for point in (body.start, body.end):
        for channel in ("r", "g", "b"):
            if channel not in point:
                raise HTTPException(status_code=400, detail="Gradient colors need r, g, and b.")
    try:
        results = await hub.gradient(body.ips, body.start, body.end, body.dimming)
    except Exception as exc:
        raise _pilot_error(exc) from exc
    return {"results": results, "bulbs": hub.list_bulbs()}


@app.post("/api/fade")
async def fade(body: FadeBody, x_wizly_token: str | None = Header(default=None)) -> dict:
    _require(x_wizly_token)
    steps = 8
    delay = body.ms / steps / 1000
    try:
        for index in range(steps + 1):
            dimming = round(body.start + (body.end - body.start) * index / steps)
            params = {**body.params, "dimming": max(10, min(100, dimming))}
            if body.end == 0 and index == steps:
                params = {"state": False}
            elif "state" not in params:
                params["state"] = True
            await hub.set_pilot(body.ips, params, refresh=index == steps)
            if index != steps:
                await asyncio.sleep(delay)
    except Exception as exc:
        raise _pilot_error(exc) from exc
    return {"bulbs": hub.list_bulbs()}


@app.post("/api/bulbs/{ip}/reboot")
async def reboot(ip: str, x_wizly_token: str | None = Header(default=None)) -> dict:
    _require(x_wizly_token)
    try:
        response = await hub.reboot(ip)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Unknown bulb.") from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"response": response}


@app.get("/api/automations")
def get_automations(x_wizly_token: str | None = Header(default=None)) -> dict:
    _require(x_wizly_token)
    return {"automations": load_automations()}


@app.put("/api/automations")
def put_automations(body: dict, x_wizly_token: str | None = Header(default=None)) -> dict:
    _require(x_wizly_token)
    items = body.get("automations")
    if not isinstance(items, list):
        raise HTTPException(status_code=400, detail="Expected {automations: [...] }.")
    save_automations(items)
    return {"automations": items}


@app.post("/api/media/youtube")
def youtube_palette(body: YoutubeBody, x_wizly_token: str | None = Header(default=None)) -> dict:
    _require(x_wizly_token)
    match = YOUTUBE_ID.search(body.url)
    if not match:
        raise HTTPException(status_code=400, detail="That does not look like a YouTube link.")
    video_id = match.group(1)
    thumb = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"
    request = Request(thumb, headers={"User-Agent": "wizly"})
    try:
        with urlopen(request, timeout=8) as response:
            raw = response.read()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not fetch the thumbnail: {exc}") from exc
    return {"videoId": video_id, "thumbnail": thumb, "colors": dominant_colors(raw)}
