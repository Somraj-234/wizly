"""Local WiZ UDP ranges and light modes.

The page at https://docs.pro.wizconnected.com/#introduction is the cloud
GraphQL API. Bulbs on the LAN speak JSON over UDP. Field names and ranges
below follow that Pro light-state model and WiZ's own local library
(https://gitlab.com/wizlighting/wiz-local-control). Differences are listed
in docs/ISSUES.md.
"""

from __future__ import annotations

CONTROL_PORT = 38899
PUSH_PORT = 38900

# Pro PilotingLightStateInput and the local README both use 10..100.
# The local class-validator allows 1..100. We write the stricter published range.
DIMMING_MIN = 10
DIMMING_MAX = 100

# Pro docs and SetPilotParametersSpeed. pywizlight also accepts 10.
SPEED_MIN = 20
SPEED_MAX = 200

CHANNEL_MIN = 0
CHANNEL_MAX = 255

# getPilot documents 1000..12000. setPilot in the local library validates 1500..9000.
# The local README's temperature helper uses 2200..6500. Pro says the real range
# depends on the product, commonly 2700..6500. Absolute write ceiling:
TEMP_ABSOLUTE_MIN = 1000
TEMP_ABSOLUTE_MAX = 12000
TEMP_DEFAULT_MIN = 2200
TEMP_DEFAULT_MAX = 6500

RATIO_MIN = 0
RATIO_MAX = 100

# sceneId validator in the local library is 1..150. Pro text says 1..32
# while the Pro light-mode table includes 33.
SCENE_ID_MIN = 1
SCENE_ID_MAX = 150


def _scene(scene_id: int, name: str, *, rgb: bool, tw: bool, dw: bool, speed: bool, dimming: bool, source: str) -> dict:
    return {
        "id": scene_id,
        "name": name,
        "rgb": rgb,
        "tw": tw,
        "dw": dw,
        "speed": speed,
        "dimming": dimming,
        "source": source,
    }


# Pro light-mode table: https://docs.pro.wizconnected.com/#light-modes
# source "pro" rows match that table, including scene 33.
PRO_SCENES = [
    _scene(1, "Ocean", rgb=True, tw=False, dw=False, speed=True, dimming=True, source="pro"),
    _scene(2, "Romance", rgb=True, tw=False, dw=False, speed=True, dimming=True, source="pro"),
    _scene(3, "Sunset", rgb=True, tw=False, dw=False, speed=True, dimming=True, source="pro"),
    _scene(4, "Party", rgb=True, tw=False, dw=False, speed=True, dimming=True, source="pro"),
    _scene(5, "Fireplace", rgb=True, tw=False, dw=False, speed=True, dimming=True, source="pro"),
    _scene(6, "Cozy", rgb=True, tw=True, dw=False, speed=True, dimming=True, source="pro"),
    _scene(7, "Forest", rgb=True, tw=False, dw=False, speed=True, dimming=True, source="pro"),
    _scene(8, "Pastel colors", rgb=True, tw=False, dw=False, speed=True, dimming=True, source="pro"),
    _scene(9, "Wake up", rgb=True, tw=True, dw=True, speed=False, dimming=True, source="pro"),
    _scene(10, "Bedtime", rgb=True, tw=True, dw=True, speed=False, dimming=True, source="pro"),
    _scene(11, "Warm white", rgb=True, tw=True, dw=False, speed=False, dimming=True, source="pro"),
    _scene(12, "Daylight", rgb=True, tw=True, dw=False, speed=False, dimming=True, source="pro"),
    _scene(13, "Cool white", rgb=True, tw=True, dw=True, speed=False, dimming=True, source="pro"),
    _scene(14, "Night light", rgb=True, tw=True, dw=True, speed=False, dimming=False, source="pro"),
    _scene(15, "Focus", rgb=True, tw=True, dw=False, speed=False, dimming=True, source="pro"),
    _scene(16, "Relax", rgb=True, tw=True, dw=False, speed=False, dimming=True, source="pro"),
    _scene(17, "True colors", rgb=True, tw=False, dw=False, speed=False, dimming=True, source="pro"),
    _scene(18, "TV time", rgb=True, tw=True, dw=False, speed=False, dimming=True, source="pro"),
    _scene(19, "Plant growth", rgb=True, tw=False, dw=False, speed=False, dimming=True, source="pro"),
    _scene(20, "Spring", rgb=True, tw=False, dw=False, speed=True, dimming=True, source="pro"),
    _scene(21, "Summer", rgb=True, tw=False, dw=False, speed=True, dimming=True, source="pro"),
    _scene(22, "Fall", rgb=True, tw=False, dw=False, speed=True, dimming=True, source="pro"),
    _scene(23, "Deep dive", rgb=True, tw=False, dw=False, speed=True, dimming=True, source="pro"),
    _scene(24, "Jungle", rgb=True, tw=False, dw=False, speed=True, dimming=True, source="pro"),
    _scene(25, "Mojito", rgb=True, tw=False, dw=False, speed=True, dimming=True, source="pro"),
    _scene(26, "Club", rgb=True, tw=False, dw=False, speed=True, dimming=True, source="pro"),
    _scene(27, "Christmas", rgb=True, tw=False, dw=False, speed=True, dimming=True, source="pro"),
    _scene(28, "Halloween", rgb=True, tw=False, dw=False, speed=True, dimming=True, source="pro"),
    _scene(29, "Candlelight", rgb=True, tw=True, dw=True, speed=True, dimming=True, source="pro"),
    _scene(30, "Golden white", rgb=True, tw=True, dw=True, speed=True, dimming=True, source="pro"),
    _scene(31, "Pulse", rgb=True, tw=True, dw=True, speed=True, dimming=True, source="pro"),
    _scene(32, "Steampunk", rgb=True, tw=True, dw=True, speed=True, dimming=True, source="pro"),
    _scene(33, "Diwali", rgb=True, tw=True, dw=True, speed=True, dimming=True, source="pro"),
]

# Present in wiz-local-control staticScenes, absent from the Pro table.
LOCAL_EXTRA_SCENES = [
    _scene(34, "White", rgb=True, tw=True, dw=True, speed=False, dimming=True, source="local-library"),
    _scene(35, "Alarm", rgb=True, tw=True, dw=True, speed=False, dimming=True, source="local-library"),
    _scene(36, "Snowy sky", rgb=True, tw=True, dw=False, speed=True, dimming=True, source="local-library"),
    _scene(100, "EyeCare Study", rgb=True, tw=True, dw=False, speed=False, dimming=True, source="local-library"),
    _scene(101, "EyeCare Screen", rgb=True, tw=True, dw=False, speed=False, dimming=True, source="local-library"),
    _scene(102, "EyeCare Activity", rgb=True, tw=True, dw=False, speed=False, dimming=True, source="local-library"),
    _scene(103, "EyeCare 202020", rgb=True, tw=True, dw=False, speed=False, dimming=True, source="local-library"),
]

# Named by pywizlight and not by the two WiZ documents above.
PYWIZ_EXTRA_SCENES = [
    _scene(40, "Dim-to-warm", rgb=True, tw=True, dw=False, speed=False, dimming=True, source="pywizlight"),
]
PYWIZ_EXTRA_SCENES += [
    _scene(256 + index, f"Custom mode {index}", rgb=True, tw=True, dw=True, speed=True, dimming=True, source="pywizlight")
    for index in range(1, 11)
]

SCENES = PRO_SCENES + LOCAL_EXTRA_SCENES + PYWIZ_EXTRA_SCENES
SCENES_BY_ID = {scene["id"]: scene for scene in SCENES}

METHODS = [
    {
        "method": "registration",
        "port": CONTROL_PORT,
        "purpose": "Discovery reply, or subscribe this computer to syncPilot pushes.",
        "params": {"register": "bool", "phoneMac": "12 hex chars", "phoneIp": "string"},
    },
    {
        "method": "getPilot",
        "port": CONTROL_PORT,
        "purpose": "Read on/off, dimming, color, temperature, scene, speed, ratio, rssi, mac.",
        "params": {},
    },
    {
        "method": "setPilot",
        "port": CONTROL_PORT,
        "purpose": "Change state, dimming, r/g/b/c/w, temp, sceneId, speed, or ratio.",
        "params": {
            "state": "bool",
            "dimming": "10-100",
            "r": "0-255",
            "g": "0-255",
            "b": "0-255",
            "c": "0-255 cool white",
            "w": "0-255 warm white",
            "temp": "Kelvin, product range",
            "sceneId": "light mode id",
            "speed": "20-200",
            "ratio": "0-100 dual-zone balance",
        },
    },
    {
        "method": "getSystemConfig",
        "port": CONTROL_PORT,
        "purpose": "Firmware, module, homeId, groupId, typeId, lock, OTA status.",
        "params": {},
    },
    {
        "method": "getUserConfig",
        "port": CONTROL_PORT,
        "purpose": "whiteRange, extRange, pwmRange, default dimming, startup mode.",
        "params": {},
    },
    {
        "method": "getModelConfig",
        "port": CONTROL_PORT,
        "purpose": "CCT range, PWM, white channel count, tap sensor, fan speed. Firmware above 1.22.",
        "params": {},
    },
    {
        "method": "getPower",
        "port": CONTROL_PORT,
        "purpose": "Instant power sample. Not every bulb implements it.",
        "params": {},
    },
    {
        "method": "syncPilot",
        "port": PUSH_PORT,
        "purpose": "Bulb push after registration. Wizly polls getPilot instead of listening.",
        "params": {},
    },
    {
        "method": "reboot",
        "port": CONTROL_PORT,
        "purpose": "Restart the bulb.",
        "params": {},
    },
]


class ProtocolError(ValueError):
    pass


def _as_int(value, name: str) -> int:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ProtocolError(f"{name} must be an integer.")
    number = int(value)
    if number != value:
        raise ProtocolError(f"{name} must be an integer.")
    return number


def clamp_dimming(value) -> int:
    number = _as_int(value, "dimming")
    if not DIMMING_MIN <= number <= DIMMING_MAX:
        raise ProtocolError(f"dimming must be {DIMMING_MIN}-{DIMMING_MAX}.")
    return number


def clamp_speed(value) -> int:
    number = _as_int(value, "speed")
    if not SPEED_MIN <= number <= SPEED_MAX:
        raise ProtocolError(f"speed must be {SPEED_MIN}-{SPEED_MAX}.")
    return number


def clamp_channel(value, name: str) -> int:
    number = _as_int(value, name)
    if not CHANNEL_MIN <= number <= CHANNEL_MAX:
        raise ProtocolError(f"{name} must be {CHANNEL_MIN}-{CHANNEL_MAX}.")
    return number


def clamp_ratio(value) -> int:
    number = _as_int(value, "ratio")
    if not RATIO_MIN <= number <= RATIO_MAX:
        raise ProtocolError(f"ratio must be {RATIO_MIN}-{RATIO_MAX}.")
    return number


def clamp_scene(value) -> int:
    number = _as_int(value, "sceneId")
    if not SCENE_ID_MIN <= number <= SCENE_ID_MAX:
        raise ProtocolError(f"sceneId must be {SCENE_ID_MIN}-{SCENE_ID_MAX}.")
    return number


def clamp_temp(value, minimum: int | None = None, maximum: int | None = None) -> int:
    number = _as_int(value, "temp")
    low = minimum if minimum is not None else TEMP_DEFAULT_MIN
    high = maximum if maximum is not None else TEMP_DEFAULT_MAX
    low = max(TEMP_ABSOLUTE_MIN, low)
    high = min(TEMP_ABSOLUTE_MAX, high)
    if high < low:
        low, high = TEMP_DEFAULT_MIN, TEMP_DEFAULT_MAX
    if not low <= number <= high:
        raise ProtocolError(f"temp must be {low}-{high} K for this bulb.")
    return number


PILOT_KEYS = {"state", "dimming", "r", "g", "b", "c", "w", "temp", "sceneId", "speed", "ratio"}


def sanitize_pilot(params: dict, kelvin: tuple[int, int] | None = None) -> dict:
    """Keep only documented setPilot fields and enforce ranges."""
    if not isinstance(params, dict) or not params:
        raise ProtocolError("setPilot params are required.")
    unknown = set(params) - PILOT_KEYS
    if unknown:
        raise ProtocolError(f"Unknown setPilot fields: {', '.join(sorted(unknown))}.")

    clean: dict = {}
    if "state" in params:
        if not isinstance(params["state"], bool):
            raise ProtocolError("state must be true or false.")
        clean["state"] = params["state"]
    if "dimming" in params:
        clean["dimming"] = clamp_dimming(params["dimming"])
    for channel in ("r", "g", "b", "c", "w"):
        if channel in params:
            clean[channel] = clamp_channel(params[channel], channel)
    if "temp" in params:
        bounds = kelvin or (None, None)
        clean["temp"] = clamp_temp(params["temp"], bounds[0], bounds[1])
    if "sceneId" in params:
        clean["sceneId"] = clamp_scene(params["sceneId"])
    if "speed" in params:
        clean["speed"] = clamp_speed(params["speed"])
    if "ratio" in params:
        clean["ratio"] = clamp_ratio(params["ratio"])

    color_channels = [key for key in ("r", "g", "b", "c", "w") if key in clean]
    if color_channels and "temp" in clean:
        raise ProtocolError("Send either color channels or temp, not both.")
    if color_channels and "sceneId" in clean:
        raise ProtocolError("Send either a color or a sceneId, not both.")
    if "temp" in clean and "sceneId" in clean:
        raise ProtocolError("Send either temp or a sceneId, not both.")
    return clean


def decode_module(module_name: str | None) -> dict:
    """Explain a moduleName such as ESP25_SHRGB_01. The bulb does not report a radius."""
    if not module_name or "_" not in module_name:
        return {
            "moduleName": module_name,
            "chip": None,
            "wifi": None,
            "band": None,
            "heads": None,
            "lightClass": None,
        }
    family, identifier, *rest = module_name.split("_")
    chips = {
        "ESP01": ("ESP8266", "802.11 b/g/n", "2.4 GHz"),
        "ESP03": ("ESP8266", "802.11 b/g/n", "2.4 GHz"),
        "ESP05": ("ESP8266", "802.11 b/g/n", "2.4 GHz"),
        "ESP10": ("ESP8266", "802.11 b/g/n", "2.4 GHz"),
        "ESP20": ("ESP32", "802.11 b/g/n", "2.4 GHz"),
        "ESP25": ("ESP32", "802.11 b/g/n", "2.4 GHz"),
    }
    chip, wifi, band = chips.get(family, (None, None, None))
    if "RGB" in identifier:
        light_class = "RGBTW"
    elif "TW" in identifier:
        light_class = "TW"
    elif "SOCKET" in identifier:
        light_class = "SOCKET"
    elif "FANDIM" in identifier:
        light_class = "DW+fan"
    else:
        light_class = "DW"
    heads = "dual" if "DH" in identifier else "single" if "SH" in identifier else None
    return {
        "moduleName": module_name,
        "family": family,
        "identifier": identifier,
        "revision": rest[0] if rest else None,
        "chip": chip,
        "wifi": wifi,
        "band": band,
        "heads": heads,
        "lightClass": light_class,
    }


def kelvin_bounds_from_configs(user_result: dict | None, model_result: dict | None) -> tuple[int, int] | None:
    """Prefer getModelConfig.cctRange, then getUserConfig extRange / whiteRange."""
    for source in (model_result or {}, user_result or {}):
        for key in ("cctRange", "extRange", "whiteRange"):
            values = source.get(key)
            if isinstance(values, list) and values:
                numbers = [int(item) for item in values if isinstance(item, (int, float))]
                if numbers:
                    return max(TEMP_ABSOLUTE_MIN, min(numbers)), min(TEMP_ABSOLUTE_MAX, max(numbers))
    return None


RANGE_NOTE = (
    "The bulb does not report a radio radius. Control is UDP on the local network, "
    f"port {CONTROL_PORT}. Usable distance is the Wi-Fi access point's coverage, "
    "commonly about 10–30 m indoors. A different network cannot reach the bulb "
    "unless someone forwards that UDP port."
)
