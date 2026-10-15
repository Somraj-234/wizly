"""List this computer's connection and the other devices on that subnet.

Nothing here connects to a service, tries a password, or walks ports.
A neighbor is included when Windows already has it in the ARP table after
a single presence packet, when it answers a ping, or when it announces a
name. Infrared by itself never reaches this computer.
"""

from __future__ import annotations

import json
import logging
import re
import socket
import struct
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor

from backend.scan import broadcast_targets, local_ips

log = logging.getLogger("wizly.nearby")

KIND_RANK = {
    "IR blaster": 5,
    "Light": 4,
    "Display": 3,
    "Speaker": 3,
    "Printer": 2,
    "Router": 2,
    "Computer": 2,
    "Device": 1,
    "Host": 1,
}

SERVICE_LABELS = {
    "_googlecast._tcp": "Chromecast",
    "_hap._tcp": "HomeKit accessory",
    "_hue._tcp": "Philips Hue",
    "_airplay._tcp": "AirPlay",
    "_raop._tcp": "AirPlay speaker",
    "_spotify-connect._tcp": "Spotify speaker",
    "_ipp._tcp": "Printer",
    "_matter._tcp": "Matter device",
    "_smb._tcp": "Windows share",
    "_workstation._tcp": "Computer",
    "_companion-link._tcp": "Apple device",
    "_apple-mobdev2._tcp": "iPhone or iPad",
    "_services._dns-sd._udp": "Service list",
}

WIFI_LABELS = {
    "Name": "Interface",
    "Description": "Adapter",
    "Physical address": "MAC address",
    "State": "Status",
    "SSID": "Network name",
    "AP BSSID": "Access point",
    "Band": "Band",
    "Channel": "Channel",
    "Radio type": "Wi-Fi standard",
    "Authentication": "Security",
    "Cipher": "Encryption",
    "Network type": "Network type",
    "Receive rate (Mbps)": "Receive speed",
    "Transmit rate (Mbps)": "Send speed",
    "Signal": "Signal",
    "Rssi": "Signal strength",
    "Profile": "Saved profile",
}


def _own_subnets() -> list[str]:
    prefixes = []
    for ip in local_ips():
        parts = ip.split(".")
        if len(parts) == 4 and parts[0] not in {"0", "127", "169"}:
            prefixes.append(".".join(parts[:3]))
    return list(dict.fromkeys(prefixes))


def _kind_from_text(text: str) -> str:
    folded = text.lower()
    if any(word in folded for word in ("broadlink", "rmmini", "rm pro", "ir blaster")):
        return "IR blaster"
    if any(word in folded for word in ("wiz", "hue", "light", "bulb", "lamp")):
        return "Light"
    if any(word in folded for word in ("chromecast", "googlecast", "airplay", "raop", "display", "tv")):
        return "Display"
    if any(word in folded for word in ("speaker", "spotify", "sonos", "audio")):
        return "Speaker"
    if any(word in folded for word in ("printer", "ipp", "pdl")):
        return "Printer"
    return "Host"


def ssdp(wait: float) -> list[dict]:
    message = (
        "M-SEARCH * HTTP/1.1\r\n"
        "HOST: 239.255.255.250:1900\r\n"
        'MAN: "ssdp:discover"\r\n'
        "MX: 1\r\n"
        "ST: ssdp:all\r\n"
        "\r\n"
    ).encode()
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    found: dict[str, dict] = {}
    try:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.settimeout(0.4)
        sock.sendto(message, ("239.255.255.250", 1900))
        deadline = time.monotonic() + wait
        while time.monotonic() < deadline:
            try:
                data, (ip, _) = sock.recvfrom(4096)
            except socket.timeout:
                continue
            text = data.decode("utf-8", "replace")
            server = ""
            search = ""
            for line in text.split("\r\n"):
                lower = line.lower()
                if lower.startswith("server:"):
                    server = line.split(":", 1)[1].strip()
                elif lower.startswith("st:"):
                    search = line.split(":", 1)[1].strip()
            location = ""
            for line in text.split("\r\n"):
                if line.lower().startswith("location:"):
                    location = line.split(":", 1)[1].strip()
            detail = " ".join(part for part in (server, search) if part)
            technical = [part for part in (search, server) if part]
            current = found.get(ip)
            row = {
                "ip": ip,
                "name": "",
                "kind": _kind_from_text(detail),
                "via": ["announce"],
                "detail": detail[:160],
                "technical": technical,
                "location": location,
            }
            if current is None or KIND_RANK[row["kind"]] > KIND_RANK.get(current["kind"], 0):
                if current and current.get("location") and not row["location"]:
                    row["location"] = current["location"]
                found[ip] = row
    except OSError as exc:
        log.warning("SSDP scan failed: %s", exc)
    finally:
        sock.close()
    return list(found.values())


def _dns_name(packet: bytes, offset: int, seen: set[int] | None = None) -> tuple[str, int]:
    labels = []
    seen = seen or set()
    jumped = False
    start = offset
    while offset < len(packet):
        if offset in seen:
            break
        seen.add(offset)
        length = packet[offset]
        if length == 0:
            offset += 1
            break
        if length & 0xC0 == 0xC0:
            if offset + 1 >= len(packet):
                break
            pointer = ((length & 0x3F) << 8) | packet[offset + 1]
            name, _ = _dns_name(packet, pointer, seen)
            labels.append(name)
            offset += 2
            jumped = True
            break
        offset += 1
        labels.append(packet[offset : offset + length].decode("utf-8", "replace"))
        offset += length
    name = ".".join(part for part in labels if part)
    return name, (start + 2) if jumped else offset


def _mdns_query(service: str) -> bytes:
    header = struct.pack(">HHHHHH", 0, 0, 1, 0, 0, 0)
    body = b"".join(bytes([len(label)]) + label.encode() for label in service.split(".")) + b"\x00"
    return header + body + struct.pack(">HH", 12, 1)


def mdns(wait: float) -> list[dict]:
    services = (
        "_googlecast._tcp.local",
        "_hap._tcp.local",
        "_hue._tcp.local",
        "_airplay._tcp.local",
        "_raop._tcp.local",
        "_spotify-connect._tcp.local",
        "_ipp._tcp.local",
        "_matter._tcp.local",
        "_services._dns-sd._udp.local",
    )
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    found: dict[str, dict] = {}
    own = local_ips()
    try:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.setsockopt(socket.IPPROTO_IP, socket.IP_MULTICAST_TTL, 1)
        sock.settimeout(0.4)
        for service in services:
            sock.sendto(_mdns_query(service), ("224.0.0.251", 5353))
        deadline = time.monotonic() + wait
        while time.monotonic() < deadline:
            try:
                data, (ip, _) = sock.recvfrom(4096)
            except socket.timeout:
                continue
            if ip.startswith("127.") or ip in own:
                continue
            names = []
            offset = 12
            guard = 0
            while offset < len(data) and guard < 12:
                name, offset = _dns_name(data, offset)
                if name:
                    names.append(name)
                if offset + 4 > len(data):
                    break
                offset += 4
                guard += 1
            friendly, technical = _names_from_dns(names)
            kind = _kind_from_text(" ".join(names))
            for service, label in SERVICE_LABELS.items():
                if any(service in name for name in names):
                    kind = label
                    break
            current = found.get(ip)
            row = {
                "ip": ip,
                "name": friendly,
                "kind": kind,
                "via": ["announce"],
                "detail": (names[0] if names else "")[:160],
                "technical": technical or names[:4],
                "location": "",
            }
            if current is None or KIND_RANK.get(kind, 0) >= KIND_RANK.get(current["kind"], 0):
                found[ip] = row
    except OSError as exc:
        log.warning("mDNS scan failed: %s", exc)
    finally:
        sock.close()
    return list(found.values())


def ir_blasters(wait: float) -> list[dict]:
    """Ask IR hubs that speak the Broadlink discovery broadcast. No command is sent."""
    packet = bytearray(0x30)
    packet[0x26] = 6
    checksum = sum(packet, 0xBEAF) & 0xFFFF
    packet[0x20] = checksum & 0xFF
    packet[0x21] = checksum >> 8
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    found: dict[str, dict] = {}
    try:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        sock.settimeout(0.4)
        for target in broadcast_targets(local_ips()):
            try:
                sock.sendto(packet, (target, 80))
            except OSError:
                continue
        deadline = time.monotonic() + wait
        while time.monotonic() < deadline:
            try:
                data, (ip, _) = sock.recvfrom(1024)
            except socket.timeout:
                continue
            if len(data) < 0x40:
                continue
            mac = ":".join(f"{byte:02x}" for byte in data[0x3A:0x40][::-1])
            name = ""
            if len(data) > 0x40:
                name = data[0x40:].split(b"\x00", 1)[0].decode("utf-8", "replace")
            found[ip] = {
                "ip": ip,
                "name": name,
                "kind": "IR blaster",
                "via": ["ir"],
                "detail": f"MAC {mac}",
                "technical": ["IR blaster", mac],
                "location": "",
            }
    except OSError as exc:
        log.warning("IR blaster scan failed: %s", exc)
    finally:
        sock.close()
    return list(found.values())


def _names_from_dns(names: list[str]) -> tuple[str, list[str]]:
    friendly = ""
    technical: list[str] = []
    for name in names:
        cleaned = name.replace("\\032", " ")
        if cleaned and cleaned not in technical:
            technical.append(cleaned)
        instance = cleaned.split(".", 1)[0]
        if instance and not instance.startswith("_") and not friendly:
            friendly = instance.replace("-", " ")
    return friendly, technical[:6]


def _field(label: str, technical: str, value: str) -> dict:
    return {"label": label, "technical": technical, "value": value}


def _parse_netsh(text: str) -> dict[str, str]:
    fields: dict[str, str] = {}
    for line in text.splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        key, value = key.strip(), value.strip()
        if key and value and key not in fields:
            fields[key] = value
    return fields


def _run(args: list[str], timeout: float = 8) -> str:
    try:
        result = subprocess.run(args, capture_output=True, timeout=timeout, check=False)
    except (OSError, subprocess.TimeoutExpired):
        return ""
    data = result.stdout or b""
    for encoding in ("utf-8", "oem", "cp1252"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", "replace")


def network_info() -> dict:
    wifi = _parse_netsh(_run(["netsh", "wlan", "show", "interfaces"]))
    alias = wifi.get("Name", "Wi-Fi")
    script = (
        f"$cfg = Get-NetIPConfiguration -InterfaceAlias {json.dumps(alias)}; "
        f"$addr = Get-NetIPAddress -InterfaceAlias {json.dumps(alias)} -AddressFamily IPv4 | Select-Object -First 1; "
        "$dns = @($cfg.DNSServer | Where-Object { $_.AddressFamily -eq 2 } | ForEach-Object { $_.ServerAddresses }); "
        "[pscustomobject]@{ IP = $cfg.IPv4Address.IPAddress; Prefix = $cfg.IPv4Address.PrefixLength; "
        "Gateway = @($cfg.IPv4DefaultGateway.NextHop); DNS = $dns; Origin = [string]$addr.PrefixOrigin } | ConvertTo-Json -Compress"
    )
    ip_info: dict = {}
    raw = _run(["powershell", "-NoProfile", "-Command", script], timeout=20)
    if raw.strip():
        try:
            ip_info = json.loads(raw)
        except json.JSONDecodeError:
            ip_info = {}
    ip = str(ip_info.get("IP") or "")
    prefix = ip_info.get("Prefix")
    gateway = ip_info.get("Gateway") or []
    if isinstance(gateway, str):
        gateway = [gateway]
    dns = ip_info.get("DNS") or []
    if isinstance(dns, str):
        dns = [dns]
    origin = str(ip_info.get("Origin") or "")
    dhcp = "DHCP" if origin.lower() == "dhcp" else origin
    fields = []
    for key, label in WIFI_LABELS.items():
        if wifi.get(key):
            fields.append(_field(label, key, wifi[key]))
    if ip:
        shown = f"{ip}/{prefix}" if prefix else ip
        fields.append(_field("IP address", "IPv4Address", shown))
    if gateway:
        fields.append(_field("Gateway", "IPv4DefaultGateway", ", ".join(str(item) for item in gateway if item)))
    if dns:
        fields.append(_field("DNS", "DNSServer", ", ".join(str(item) for item in dns if item)))
    if dhcp:
        fields.append(_field("Address assignment", "PrefixOrigin", dhcp))
    subnet = ".".join(ip.split(".")[:3]) if ip.count(".") == 3 else ""
    return {"title": wifi.get("SSID") or alias or "This network", "interface": alias, "subnet": subnet, "fields": fields}


def _ping(ip: str) -> str | None:
    try:
        result = subprocess.run(
            ["ping", "-n", "1", "-w", "200", ip],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=1,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    return ip if result.returncode == 0 else None


def _poke(ip: str) -> None:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.settimeout(0.2)
        sock.sendto(b"\x00", (ip, 9))
    except OSError:
        pass
    finally:
        sock.close()


def neighbors(subnet: str) -> list[dict]:
    """Fill the ARP table, then read neighbors Windows already resolved. No port walk."""
    if not subnet:
        return []
    own = local_ips()
    addresses = [f"{subnet}.{host}" for host in range(1, 255) if f"{subnet}.{host}" not in own]
    with ThreadPoolExecutor(max_workers=64) as pool:
        list(pool.map(_poke, addresses))
        alive = {ip for ip in pool.map(_ping, addresses) if ip}
    time.sleep(0.4)
    found: dict[str, dict] = {}
    for line in _run(["arp", "-a"]).splitlines():
        parts = line.split()
        if len(parts) < 3 or parts[0].count(".") != 3:
            continue
        ip, mac, kind = parts[0], parts[1], parts[2].lower()
        if not ip.startswith(subnet + ".") or kind not in {"dynamic", "static"}:
            continue
        if mac.replace("-", "") == "000000000000":
            continue
        technical = ["Host", mac]
        row_kind = "Router" if ip.endswith(".1") else "Device"
        found[ip] = {
            "ip": ip,
            "name": "",
            "kind": row_kind,
            "via": ["neighbor"],
            "detail": mac,
            "technical": technical,
            "location": "",
        }
    for ip in alive:
        found.setdefault(
            ip,
            {"ip": ip, "name": "", "kind": "Device", "via": ["ping"], "detail": "", "technical": ["Host"], "location": ""},
        )
        if "ping" not in found[ip]["via"]:
            found[ip]["via"].append("ping")
    return list(found.values())


def _netbios_name(ip: str) -> str:
    text = _run(["nbtstat", "-A", ip], timeout=2)
    for line in text.splitlines():
        if "<00>" in line and "UNIQUE" in line.upper():
            return line.split("<", 1)[0].strip()
    return ""


def _reverse_name(ip: str) -> str:
    previous = socket.getdefaulttimeout()
    socket.setdefaulttimeout(0.4)
    try:
        host, _, _ = socket.gethostbyaddr(ip)
    except OSError:
        return ""
    finally:
        socket.setdefaulttimeout(previous)
    if host == ip:
        return ""
    return host.split(".")[0]


def _friendly_from_location(url: str, subnet: str) -> str:
    """Read the name from the description document the device itself announced."""
    from urllib.parse import urlparse
    from urllib.request import urlopen

    if not url.lower().startswith("http://"):
        return ""
    host = urlparse(url).hostname or ""
    if subnet and not host.startswith(subnet + "."):
        return ""
    try:
        with urlopen(url, timeout=1) as response:
            body = response.read(80_000).decode("utf-8", "replace")
    except (OSError, ValueError):
        return ""
    match = re.search(r"<friendlyName>([^<]+)", body, re.I)
    return match.group(1).strip() if match else ""


def _attach_names(rows: list[dict], subnet: str) -> None:
    def one(row: dict) -> None:
        if not row.get("name"):
            row["name"] = _netbios_name(row["ip"]) or _reverse_name(row["ip"])
        if row.get("name") and row["kind"] in {"Device", "Host"}:
            row["kind"] = "Computer"
        location = row.get("location") or ""
        if location and not row.get("name"):
            friendly = _friendly_from_location(location, subnet)
            if friendly:
                row["name"] = friendly
        if row["ip"].endswith(".1") and row["kind"] in {"Device", "Host"}:
            row["kind"] = "Router"

    with ThreadPoolExecutor(max_workers=16) as pool:
        list(pool.map(one, rows))


def _merge(rows: list[dict]) -> list[dict]:
    by_ip: dict[str, dict] = {}
    for row in rows:
        current = by_ip.get(row["ip"])
        if current is None:
            by_ip[row["ip"]] = {
                **row,
                "via": list(row.get("via") or []),
                "technical": list(row.get("technical") or []),
            }
            continue
        for source in row.get("via") or []:
            if source not in current["via"]:
                current["via"].append(source)
        for item in row.get("technical") or []:
            if item and item not in current["technical"]:
                current["technical"].append(item)
        if row.get("name") and not current.get("name"):
            current["name"] = row["name"]
        if KIND_RANK.get(row.get("kind"), 4) > KIND_RANK.get(current.get("kind"), 4):
            current["kind"] = row["kind"]
        if row.get("detail") and not current.get("detail"):
            current["detail"] = row["detail"]
        if row.get("location") and not current.get("location"):
            current["location"] = row["location"]
    ordered = sorted(by_ip.values(), key=lambda item: tuple(int(part) for part in item["ip"].split(".")))
    for row in ordered:
        row.pop("location", None)
    return ordered


def scan_nearby(wait: float = 2.5) -> dict:
    info = network_info()
    subnet = info.get("subnet") or ""
    log.info("Looking for devices on %s", subnet or "no connected subnet")
    with ThreadPoolExecutor(max_workers=4) as pool:
        jobs = [pool.submit(fn, wait) for fn in (ssdp, mdns, ir_blasters)]
        jobs.append(pool.submit(neighbors, subnet))
        rows = [row for job in jobs for row in job.result()]
    if subnet:
        rows = [row for row in rows if str(row.get("ip", "")).startswith(subnet + ".")]
    merged = _merge(rows)
    _attach_names(merged, subnet)
    return {"network": info, "devices": merged}
