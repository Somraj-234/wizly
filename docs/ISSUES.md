# Issues and differences

Nothing here has crashed in a running session yet. This file is the list of protocol mismatches and the limits of what the site can promise.

## The Pro URL is the cloud API

`https://docs.pro.wizconnected.com/#introduction` describes GraphQL on `https://api.pro.wizconnected.com/api/graphql`. Mutations are `changeLightState`, `changeGroupState`, `changeRoomState`, `changeFloorState`, `changeBuildingState`, and `applyRoomScene`. That API needs a WiZ `clientId` and OAuth.

Home bulbs are controlled with UDP methods from [WiZ’s wiz-local-control library](https://gitlab.com/wizlighting/wiz-local-control): `getPilot`, `setPilot`, `registration`, `getSystemConfig`, `setSystemConfig`, `setUserConfig`, `setModelConfig`, `getPower`, `syncPilot`, `reboot`, `reset`. Wizly uses those, because that is what a bulb on the LAN answers. The cloud light-state fields (`dimming`, `sceneId`, `speed`, `ratio`, `temperature` / local `temp`, `r`, `g`, `b`, cool white, warm white, `state`) match the UDP pilot closely enough to share one range table.

## Ranges that do not agree

| Field | What we send | Other published bounds |
| --- | --- | --- |
| `dimming` | 10–100 | Pro text and the local README say 10–100. The local `SetPilotParametersDimming` validator says 1–100. pywizlight converts a 0–255 “hex” brightness into a percent. |
| `speed` | 20–200 | Pro and the local library say 20–200. pywizlight allows 10–200. |
| `temp` | The bulb’s `cctRange`, else `extRange`, else `whiteRange`. If none of those exist, 2200–6500. Never outside 1000–12000. | getPilot text says 1000–12000. The local setter validates 1500–9000. The local README helper uses 2200–6500. Pro says the product decides, commonly 2700–6500. |
| `sceneId` | 1–150, which is the local validator | Pro prose says 1–32, but the Pro table includes 33 Diwali. The local library also lists 34–36 and 100–103. pywizlight adds 40 and custom slots 256–265. Those extras are labeled in the UI. |

Color and `temp` are not sent together. Color and `sceneId` are not sent together. The local library says the light engine will not play `r+g+b` together with a white channel, so a color command sends only `r`, `g`, and `b`.

## Future attached to a different loop

`wizlight` saves `asyncio.get_event_loop()` in its constructor. The hub is created at import, and uvicorn then serves requests on another loop. The next `setPilot` awaits a datagram future from the old loop. Rebinding `light.loop` and replacing its lock before each command avoids that. Bulb calls for one IP are also serialized so a status poll cannot close the socket mid-command.

## Firmware 1.38 rejects on and off

`getPilot` works. `setPilot` with `{"state": true}` or `{"state": false}` comes back as error `-32602 Invalid params`, and the reply includes `hmac` and `sigTs`. That is WiZ’s local-control lock on firmware 1.38, not a bad brightness or color field. Reads stay open. Writes are accepted after the WiZ app’s Security setting is Allow all controls. Only verified controls needs the home security key, which the bulb does not give out.

## This computer could not reach the bulb

On 14 Oct 2026 the API was on Wi-Fi `10.49.41.194`. One registration reply arrived from `10.49.41.158` (MAC `9877d5b76b98`). `getPilot` to that address timed out, later scans saw nothing, and ARP had no entry for it (`Destination host unreachable`). The WiZ phone app can still work when the phone is on the bulb’s Wi-Fi and this PC is not, or when the access point blocks device-to-device traffic. Control needs this PC on that same Wi-Fi, not a guest network.

## Discovery hung on Windows

pywizlight `find_wizlights` binds UDP 38899, sleeps, closes the transport, then awaits a future that `connection_lost` is supposed to finish. On the Windows Proactor event loop that future does not finish. The request stays open, the port stays taken, and later Scan clicks pile up. `backend/scan.py` does the same `registration` broadcast with `register: false` on a normal socket and closes it in a `finally`. Replies from this computer’s own addresses are ignored.

## Discovery versus registration

pywizlight finds bulbs by broadcasting `registration` with `register: false`. The bulbs answer with their MAC. That is what Scan uses.

WiZ’s `RegistrationMessage` uses `register: true`, plus `phoneMac` and `phoneIp`, so the bulb will push `syncPilot` to UDP 38900. Wizly does not listen on 38900. It polls `getPilot` on 38899. A short PIR pulse can be missed between polls. The PIR switch polls about every 2 seconds, which is still not the same as a push.

## Config methods

`getSystemConfig` in the local library’s TypeScript type only lists `homeId`, `lock`, `groupId`, `typeId`, `fwOtaStatus`, and `fwVersion`. Real bulbs also return `moduleName`, `mac`, and other fields. The hardware page prints every key the bulb sends.

`getUserConfig` and `getModelConfig` are the names pywizlight uses. The master `constants.ts` we fetched exposes `setUserConfig` and `setModelConfig`, not the getters. A 2024 branch of the same repo adds `getModelConfig`. Bulbs with firmware above 1.22 answer `getModelConfig`. Older firmware returns “method not found”, and that error is shown on the hardware page instead of failing the whole request.

`getPower.result.power` is documented only as a number. pywizlight divides it by 1000, so large values are treated here as milliwatts.

## Lock and “other networks”

`getSystemConfig.result.lock` is displayed. `setSystemConfig` in the local library does not document a `lock` parameter, so Wizly never writes it.

UDP has no password. Another device on the same Wi-Fi can send `setPilot` itself. The optional restore loop resends the last command about every 5 seconds while the server is running. That is not a network lock.

A different network cannot reach the bulb unless UDP 38899 is forwarded. The API binds to `127.0.0.1` so the website is not open on the LAN by default.

There is no radius field. Reach is the access point’s Wi-Fi cell. RSSI is the bulb’s view of that access point, in dBm. The chip and 802.11 text are inferred from prefixes such as `ESP01` (ESP8266) and `ESP25` (ESP32). Unknown prefixes stay blank instead of being guessed.

`reset` is a factory reset in the local library. It is not in the UI.

## Rhythms and schedules

The WiZ app can store rhythms on the bulb with `setSchd` / `setSchdPset`. Those parameter schemas were not in the pages we could read, and pywizlight only recognizes rhythm when `getPilot` contains `schdPsetId`. Wizly rhythms are applied by this server: at each time point it sends a normal `setPilot`. They run only while the Python process is running.

Sunrise and sunset use a local approximation of the NOAA calculation and this computer’s timezone. They need a latitude and longitude. The default in the form is New Delhi; change it.

## Music and media

The WiZ app listens with the microphone and often cannot do that while the speaker is active. Wizly’s file player uses a Web Audio graph that is also connected to the speakers. “Share tab audio” uses `getDisplayMedia`, which is the browser’s supported way to hear other audio on the same machine. The microphone remains available and has the same limitation as the official app.

YouTube embeds are cross-origin, so the page cannot read pixels from the player. Thumbnail colors are fetched from `i.ytimg.com` after the video id is parsed. Live colors need a local file or a shared tab.

## Not verified on hardware yet

Discovery, color, and the config reads need bulbs on this LAN. The UI and the protocol checks below were run without a bulb answering.
