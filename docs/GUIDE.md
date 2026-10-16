# Wizly — complete guide

Wizly talks to Philips WiZ bulbs over the local Wi-Fi (UDP port 38899), through a small
Python API (`backend/`) that a React page (`frontend/`) calls. Nothing goes to the
internet except two optional things: YouTube thumbnail colors (Media tab) and location-based
sunrise/sunset math uses your typed coordinates, computed locally — no map service is called.

This guide covers every tab, what each control actually sends to the bulb, and the errors
you may see with what causes them.

---

## Before you start

1. Start the API: `uvicorn backend.main:app --host 127.0.0.1 --port 8787` (see `README.md`).
2. Start the frontend: `npm run dev` in `frontend/`, then open the printed `http://127.0.0.1:5173` address.
3. Your computer and the bulbs must be on the **same Wi-Fi network**. Wizly cannot reach
   a bulb through the internet, a guest network, or a different VLAN.

---

## Lights (home tab)

This is where bulbs are added, selected, and removed.

- **Scan network** — sends a UDP discovery broadcast and waits a few seconds for bulbs to
  answer. Works only if your router/AP allows broadcast traffic between devices (some guest
  networks and "client isolation" settings block it).
- **Add by IP** — if scanning finds nothing, type the bulb's IP address (check your router's
  device list) and press **Add**. This sends a direct `getPilot` to that address.
- **Click a card** — selects/deselects that bulb. The dot on the left fills with the bulb's
  current color when it's on. Selected bulbs get a ring and a "Selected" badge.
  Controls on every other tab (Color, Modes, Gradient, Music, Media, Presets, and the
  schedule/sunrise automations) act on whichever bulbs are selected here.
- **On / Off** — per-bulb quick toggle, independent of selection.
- **Profile** — set a friendly name and room for a bulb. Stored only in this browser
  (not sent to the bulb), so it resets if you clear browser storage or switch browsers.
- **Trash icon** (top-right of each card) — removes the bulb from Wizly's list. Click once to
  arm it (it turns red and shows a confirmation line), click again to actually remove it.
  This does **not** factory-reset the bulb or disconnect it from your Wi-Fi — it just stops
  Wizly from tracking/controlling it. Add it back later with **Scan network** or **Add by IP**.

**Errors you might see here**

| Message | Cause | Fix |
|---|---|---|
| "No bulbs answered. You can add an IP manually." | Discovery broadcast got no replies | Confirm same Wi-Fi/subnet, try Add by IP |
| "UDP discovery failed: ..." | The socket couldn't bind (port in use, OS firewall) | Close other apps using the port, check firewall |
| A per-card red line under a bulb | That bulb didn't answer the last `getPilot`/refresh | Check the bulb is powered and on Wi-Fi |
| "That bulb is already gone. Refresh the Lights list." | You deleted it twice (e.g. two tabs open) | Harmless — the bulb is already removed |

---

## Color

Full manual control for the bulbs selected in Lights.

- **Color / White** tabs — Color sends `r`, `g`, `b` (0–255 each). White sends `temp` in
  kelvin, clamped to the range the bulb reported from `getModelConfig`/`getUserConfig`
  (falls back to 2200–6500K if the bulb didn't report one — see the bulb's card on the
  **Hardware** tab for its real range).
- **Swatches** — quick presets for both color and white.
- **Hue / Saturation / Brightness of color**, or **Color temperature / Dimming** — fine
  sliders. Changes preview instantly on the lamp figure and are sent to the real bulb
  ~140ms after you stop dragging (debounced so it doesn't flood the bulb).
- **Dual-zone ratio** — for bulbs with two tunable zones; sends the `ratio` field.
- **Fade in / Fade out** — ramps dimming over ~1.4s in 8 steps.
- **Turn off** — sends `state: false`.

**Errors**: "Select at least one bulb" (nothing selected in Lights); a 409 error that
explains the bulb refused the change — this means the WiZ app's local-control permission
needs to be re-toggled (Settings → Security → local communication → Allow all controls,
off then on again, in the official WiZ app).

---

## Modes (scenes)

Picks one of the bulb's built-in dynamic/static light modes (`sceneId` 1–33 are WiZ's
official "Pro" table; higher ids are extra modes some bulbs support). A bulb silently
ignores a mode id it doesn't know, so if nothing happens when you pick one, that bulb
doesn't support it.

- **Speed** only affects modes marked "Speed" (dynamic/animated ones).
- **Dimming** only affects modes marked "Dim only" is not it — it applies when the scene
  supports dimming at all.

---

## Gradient

Spreads one color into another across the bulbs selected in Lights, in selection order
(first selected gets the start color, last gets the end color). Needs **at least two**
bulbs selected. "Apply gradient" sends one `setPilot` per bulb with its own mixed color.

**Error**: "Select two bulbs, or more." if fewer than two are selected.

---

## Music

Pulses color on the beat of audio, using the selected bulbs.

- **Play a file** — choose a local audio file; it plays through your speakers while the
  analyser reads it.
- **Share tab audio** — captures audio from a browser tab/window you pick (the browser
  will ask you to choose what to share and to enable its audio checkbox).
- **Microphone** — listens to the room via your mic.

Palette tiles choose which four colors cycle on beats; Intensity scales how bright a beat
flash is. The bar under Intensity shows the live audio energy so you can see if the
analyser is hearing anything at all.

**Errors**: if "Start sync" throws, the message comes straight from the browser (e.g. you
picked "Play a file" with no file chosen, or you denied the share/microphone permission
prompt, or the window you shared had no audio track).

---

## Media

Samples colors from a video, image, audio cover, YouTube thumbnail, or a shared screen,
and can continuously push the dominant color to the selected bulbs.

- **File input** — accepts video, audio (reads embedded cover art), or image files.
- **YouTube link** → **Thumbnail colors** — fetches only the still thumbnail image (not the
  video) and extracts its dominant colors; this is the one place Wizly calls the internet.
- **Share a tab** — captures a tab/window's video frames (no audio) and samples color live.
- **Keep the selected bulbs on the strongest color** — when on, resends the top color to
  the selection every ~700ms.

**Errors**: "This video cannot be sampled. Try a local file." happens on cross-origin video
the browser won't let JavaScript read pixels from. "That does not look like a YouTube
link." means the pasted URL doesn't contain a recognizable video id.

---

## Presets

Named, reusable combinations of bulbs + a pilot command, stored in this browser only.

- **warm** / **day** / **off** are fixed quick presets.
- **current** snapshots whatever the *first* selected bulb is doing right now (color, temp,
  scene, speed, dimming) so you can save "the way it looks right now" as a one-click preset.
- **Apply** resends that preset's exact `setPilot` payload to the bulbs it was saved with
  (or to your current selection if it was saved with no bulbs).
- **Delete** removes the preset from this browser (does not touch any bulb).

---

## Automations

Automations decide **when** something happens; each one also needs an **action** — what
should actually happen. Every action type below is available everywhere in this tab: plain
on/off, toggle, a specific color, a specific white temperature, or one of the bulb's light
modes (scenes) — so clap/motion/schedules can all do exactly the same things Color and
Modes can do.

### The three timing kinds (schedule / sunrise-sunset / rhythm)

| Kind | What it means | Runs even with the tab closed? |
|---|---|---|
| **Daily schedule** | Fires once a day at a clock time you pick (e.g. every day at 19:00). | Yes — the Python server checks every ~20 seconds. |
| **Sunrise / sunset** | Fires at the computed sunrise or sunset for a latitude/longitude, optionally shifted by an offset in minutes (e.g. "30 minutes before sunset"). No internet call — the sun position is computed with a standard NOAA-style formula from your typed coordinates and the server's local clock. Press **Use my location** to fill in your coordinates from the browser's location permission, or type them manually (look up "my coordinates" if unsure). | Yes |
| **Rhythm (several times a day)** | A list of time-of-day **steps**, each with its own action — e.g. 07:00 soft white, 12:00 full daylight, 18:00 warm, 22:00 off. Add or remove steps freely; they run in time order, and the most recent step whose time has passed is the one currently "active" each day. | Yes |

### What should happen (the action)

For schedule and sunrise/sunset, pick **one** action under "What should happen." For
rhythm, each step has its own action. Options:

- **Turn on** — turns the bulb(s) on at a brightness you set, without changing color/white.
- **Turn off** — turns the bulb(s) off.
- **Set color** — pick a swatch, sent as `r`/`g`/`b` plus a brightness.
- **Set white** — pick a color temperature (kelvin) plus a brightness.
- **Run a light mode** — pick one of the bulb's scenes (from the Modes tab's list) with its
  own brightness/speed if that mode supports them.

Every automation you save applies to **whichever bulbs are selected in Lights at the
moment you press "Save for selected bulbs."** Select bulbs first, then open Automations.

### Sensors (clap / camera movement / built-in motion)

These three need **this browser tab to stay open**, because the microphone, camera, and a
bulb's own motion report are all only visible to the open tab, not the Python server. Each
sensor has its own on/off switch, its own target bulbs, and its own action — pick exactly
what you want to happen, the same way as above.

- **Double clap** — listens through your microphone for two sharp sounds inside about a
  second, then runs the configured action. Good default action: **Toggle on/off**.
- **Camera movement** — watches your computer's camera for a frame-to-frame brightness
  change (a low-res 32×24 sample, nothing is recorded or uploaded) and runs the action when
  it sees a big enough change. Good default action: **Turn on** at a modest brightness.
- **Built-in motion sensor (PIR)** — some WiZ bulbs/accessories include their own
  passive-infrared sensor and report `src: "pir"` in their status when it fires. Wizly polls
  the known bulbs for that flag every 2 seconds. If you leave "Applies to" empty, the action
  runs on the *same* bulb that reported movement; set target bulbs if you want one sensor
  bulb to control other lights.

Press **"Use the N bulbs selected in Lights"** inside a sensor's card to assign bulbs to it
— this is separate from the bulb selection used for schedule/sunrise/rhythm, so a sensor
keeps working even if you later select different bulbs elsewhere.

### Errors you might see

| Message | Cause | Fix |
|---|---|---|
| "Give the automation a name first." | Name field empty on Save | Type a name |
| "Select at least one bulb in Lights before saving an automation." | Nothing selected when you pressed Save | Select bulbs in Lights, come back |
| "Latitude and longitude need to be numbers." | Non-numeric text in those fields | Type decimal numbers, e.g. `28.61` |
| "Add at least one step to the rhythm." | All rhythm steps were removed | Add at least one step |
| "Could not load/save automations: ..." | The Python API isn't reachable | Confirm `uvicorn` is running on port 8787 |
| "Microphone access was blocked. Allow the microphone for this site..." | Browser permission denied | Click the padlock/site info icon in the address bar, allow microphone, toggle Double clap off then on |
| "Camera access was blocked...similarly" | Same, for camera | Allow camera permission the same way |
| "No microphone/camera was found on this computer." | No such device attached | Connect one, or use a different trigger |
| "...needs a secure context (https:// or localhost)..." | Browsers refuse mic/camera access on plain `http://` from a non-localhost address | Open Wizly via `http://127.0.0.1:5173` or `http://localhost:5173`, not a LAN IP |
| "A sensor automation is enabled but has no bulbs assigned..." | You turned a sensor on but never pressed "Use the bulbs selected" and had nothing selected either | Press that button after selecting bulbs in Lights |
| "The sensor automation could not reach a bulb." | `setPilot` failed for the assigned bulb(s) | Check the bulb is still online in Lights |

---

## Lock

Password-protects **this API**, not the bulb itself (WiZ's local protocol has no documented
way to set a password on the bulb). While locked:

- Every `/api/...` call needs the token issued at lock time (kept only in this browser tab's
  session storage — closing the tab forgets it).
- "Restore the last command if the bulb changes" (enforce mode) re-sends Wizly's last
  `setPilot` to a bulb every ~5 seconds if something else (the WiZ app, another computer)
  changed it — useful to stop someone else from overriding your lighting while locked.

**Errors**: "PIN does not match the lock." / "PIN does not match." on a wrong PIN; "This
site is locked. Unlock it with the PIN." on any API call made without (or with the wrong)
token.

---

## Nearby

A read-only network scan: shows the Wi-Fi this computer is on and the other devices
answering on the same subnet (by mDNS/announce, ping, ARP neighbor table, or IR-blaster
reply). **Nothing here is controlled** — it's for figuring out which IP belongs to which
device before using "Add by IP" in Lights.

---

## Hardware

Raw protocol inspector for one bulb at a time: shows the literal JSON replies from
`getPilot`, `getSystemConfig`, `getUserConfig`, `getModelConfig`, and `getPower`, plus a
decoded summary (module, chip, Wi-Fi generation, kelvin range, measured power, RSSI). The
**Reboot** button sends the bulb a `reboot` command after a confirmation dialog.

---

## Where data lives

- **This browser** (localStorage/sessionStorage): bulb names/rooms (profiles), presets,
  theme, current selection, sensor automation settings (clap/motion/PIR), and the Lock
  session token.
- **The Python process** (`data/*.json` next to `backend/`): known bulbs (`known.json`),
  the lock PIN hash (`lock.json`), and schedule/sunrise/rhythm automations
  (`automations.json`). These survive closing the browser tab, but not deleting those files
  or reinstalling.
