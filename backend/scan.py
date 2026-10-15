"""Find WiZ bulbs with a registration broadcast.

pywizlight waits on an asyncio datagram future after closing the socket.
On Windows that future never completes, so UDP 38899 stays open and the
API request never returns. This scan uses a normal socket on a worker
thread and always closes it.
"""

from __future__ import annotations

import json
import logging
import socket
import time
from dataclasses import dataclass

log = logging.getLogger("wizly.scan")

PORT = 38899
REGISTER = (
    b'{"method":"registration","params":{"phoneMac":"AAAAAAAAAAAA",'
    b'"register":false,"phoneIp":"1.2.3.4","id":"1"}}'
)


@dataclass(frozen=True)
class FoundBulb:
    ip: str
    mac: str


def local_ips() -> set[str]:
    ips = {"127.0.0.1", "0.0.0.0"}
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None):
            addr = info[4][0]
            if isinstance(addr, str):
                ips.add(addr.split("%", 1)[0])
    except OSError:
        pass
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        probe.connect(("8.8.8.8", 80))
        ips.add(probe.getsockname()[0])
    except OSError:
        pass
    finally:
        probe.close()
    return ips


def broadcast_targets(own: set[str]) -> list[str]:
    targets = ["255.255.255.255"]
    for ip in own:
        parts = ip.split(".")
        if len(parts) == 4 and parts[0] not in {"0", "127", "169"}:
            targets.append(".".join(parts[:3] + ["255"]))
    # Keep order, drop duplicates.
    return list(dict.fromkeys(targets))


def scan(wait: float = 4.0) -> list[FoundBulb]:
    own = local_ips()
    targets = broadcast_targets(own)
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    found: dict[str, str] = {}
    try:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.bind(("", PORT))
        sock.settimeout(0.4)
        deadline = time.monotonic() + wait
        log.info("Scanning %s seconds toward %s", wait, ", ".join(targets))
        while time.monotonic() < deadline:
            for target in targets:
                try:
                    sock.sendto(REGISTER, (target, PORT))
                except OSError as exc:
                    log.warning("Broadcast to %s failed: %s", target, exc)
            slice_end = min(deadline, time.monotonic() + 0.8)
            while time.monotonic() < slice_end:
                try:
                    data, addr = sock.recvfrom(4096)
                except socket.timeout:
                    break
                ip = addr[0]
                if ip in own:
                    log.info("Ignored a registration reply from this computer (%s)", ip)
                    continue
                try:
                    payload = json.loads(data.decode("utf-8", errors="replace"))
                except json.JSONDecodeError:
                    log.info("Ignored a non-JSON reply from %s", ip)
                    continue
                mac = payload.get("result", {}).get("mac") if isinstance(payload, dict) else None
                if isinstance(mac, str) and mac:
                    found[ip] = mac
                    log.info("Bulb replied from %s mac %s", ip, mac)
                else:
                    log.info("Reply from %s had no MAC: %s", ip, data[:180])
    finally:
        sock.close()
    return [FoundBulb(ip, mac) for ip, mac in found.items()]
