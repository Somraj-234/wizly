# Changelog

## 2026-10-15 nearby names

- Nearby shows this computer's connected Wi-Fi in plain language and with the Windows field names: network name, IP, MAC, signal, band, channel, speeds, gateway, DNS, and whether the address came from DHCP.
- Other devices on that same subnet are listed with a friendly name when they have one, and the technical name (Host, a _service, a MAC) stays on the line under it.

## 2026-10-15 nearby

- Nearby lists hosts on this computer's own subnet. A device is included when it answers a ping, announces a name over SSDP or mDNS, or answers as an IR blaster. The page does not control them. Infrared itself is not visible from this computer.

## 2026-10-15 figure

- The cutaway bulb drawing sits beside every page. On Color it follows the hue, white temperature, and dimming sliders. Elsewhere it follows the selected bulb, and goes dark when that bulb is off.
- The glass is a round A60 envelope on the E27 screw, with no bench. Inner opens a window onto the driver, radio can, and five LED dice; Outer closes it.

## 2026-10-15 later

- On and off failed with "Future attached to a different loop" because each bulb kept the asyncio loop from process startup. Commands now rebind the bulb to the request loop before `setPilot`.

## 2026-10-15

- On and off were already sending `setPilot` with `state` true or false. Firmware 1.38 answers that with `-32602 Invalid params`. The site now explains the WiZ app Security setting instead of showing the raw bulb error.

## 2026-10-14 later

- Discovery no longer uses pywizlight’s broadcast helper. On Windows that helper waited forever after closing the UDP socket, so port 38899 stayed open and Scan never returned.
- Bulb commands now give up after about 3 seconds instead of 13, and a second refresh does not start while one is already running.
- A saved address with no MAC and no firmware is dropped when a scan does not see it. `10.255.255.1` was one of those.

## 2026-10-14

- Added the FastAPI service on top of the installed pywizlight 0.6.6 environment.
- Control uses the UDP method names `registration`, `getPilot`, `setPilot`, `getSystemConfig`, `getUserConfig`, `getModelConfig`, `getPower`, and `reboot`.
- `setPilot` is sent with protocol fields (`dimming` 10–100, `speed` 20–200, `temp`, `sceneId`, `r`/`g`/`b`/`c`/`w`, `ratio`) instead of pywizlight’s 0–255 brightness helper.
- Added the React app: discovery, per-bulb profiles in the browser, color and white controls, WiZ light modes, gradient, music sync from playback or shared audio, media colors, presets, schedules, sunrise/sunset, rhythms, clap, camera movement, PIR, a PIN lock, and a hardware page.
- Scene ids 1–33 follow the WiZ Pro light-mode table. Ids from the local library and from pywizlight are grouped separately.
