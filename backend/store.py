"""Small JSON files for lock state, known bulbs, and automations."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"


def _path(name: str) -> Path:
    DATA.mkdir(exist_ok=True)
    return DATA / name


def read_json(name: str, fallback: Any) -> Any:
    path = _path(name)
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return fallback


def write_json(name: str, payload: Any) -> None:
    path = _path(name)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
