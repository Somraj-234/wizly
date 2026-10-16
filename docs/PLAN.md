# Plan

Wizly is a local controller for Philips WiZ bulbs. The browser never talks to a bulb. It talks to a FastAPI process on this computer, and that process sends the WiZ UDP protocol.

## Why two protocols show up in the docs

[docs.pro.wizconnected.com](https://docs.pro.wizconnected.com/#introduction) is the **cloud** WiZ Pro GraphQL API (`changeLightState`, `PilotingLightStateInput`). It needs an OAuth client from WiZ.

Bulbs on a home network speak **JSON over UDP**:

- port `38899` for commands
- port `38900` for `syncPilot` pushes

Those method names come from WiZ’s own library, [wiz-local-control](https://gitlab.com/wizlighting/wiz-local-control). pywizlight is the socket layer. Wizly builds `setPilot` itself so brightness stays a percent. pywizlight’s `PilotBuilder` treats brightness as 0–255 and converts it.

## Pieces

| Path | Role |
| --- | --- |
| `backend/protocol.py` | Method list, scene table, and the ranges we will actually send |
| `backend/service.py` | Discovery, `getPilot`, `setPilot`, config reads |
| `backend/scheduler.py` | Clock, sunrise/sunset, and rhythm points |
| `backend/main.py` | HTTP API, PIN lock, YouTube thumbnail colors |
| `frontend/` | React, Tailwind, and the Radix pieces used by shadcn |
| `data/` | Known bulbs, automations, and the lock file. Not for git |

Profiles and presets stay in `localStorage`, as requested. Automations stay on the server so they can run after the tab closes.

## Feature map

1. **Discovery.** Broadcast `registration`, then read each bulb. Manual IP if broadcast is blocked.
2. **Several bulbs.** Select any number. One `setPilot` is sent to each selected bulb at once. Names and rooms are browser profiles keyed by MAC.
3. **WiZ app controls.** Swatches, hue/saturation/value, kelvin, dimming 10–100, speed 20–200, the Pro light-mode table, fade in/out, ratio for dual-zone lamps.
4. **Gradient.** Two or more selected bulbs, colors interpolated from the first to the last.
5. **Music.** Analyse a file played by the page (speakers stay on), or a shared tab’s audio. The microphone is the fallback, which is what the WiZ app uses and what often fails while audio plays.
6. **Presets.** Named pilot plus bulb list, stored in the browser.
7. **Clap, camera movement, PIR, sunrise, rhythms.** Clap, camera, and PIR need the tab. Schedules and rhythms run in Python.
8. **Media color.** Local video, an image, ID3 cover art, a YouTube thumbnail, or a shared tab. A YouTube iframe cannot be sampled.
9. **Lock and hardware.** PIN on the API, optional restore of the last command, and the raw config methods plus a decoded `moduleName`.

## What we will not pretend to do

The bulb has no documented way for this site to refuse UDP from another computer on the same Wi-Fi. See `docs/ISSUES.md`.
