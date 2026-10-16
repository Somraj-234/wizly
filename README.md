# Wizly

A self-hosted control panel for Philips WiZ smart bulbs. A FastAPI backend talks the
bulbs' local UDP protocol directly (no cloud account, no app pairing), and a React
frontend gives you color, white, scenes, gradients, music/media sync, presets,
schedules, sunrise/sunset, rhythms, sensor-triggered automations, a PIN lock, and a raw
hardware inspector.

Bulb state (names, rooms, presets, sensor settings) is kept in the browser's local
storage. Automations, known bulbs, and the lock PIN are kept by the backend process.

## How it works

```
Browser (React + Vite)  <--HTTP-->  FastAPI backend  <--UDP 38899/38900-->  WiZ bulbs
```

WiZ bulbs only accept commands over UDP on the local network, so the backend must run
on a machine that shares a network with the bulbs. See `docs/DEPLOY.md` if you want the
frontend and backend hosted on different machines/services while still reaching bulbs
on your home network.

## Requirements

- Python 3.11+
- Node.js 18+ and npm
- A computer on the same Wi-Fi/LAN as the bulbs, to run the backend

## Setup

Clone the repository, then set up each side from the project root.

### Backend

```sh
python -m venv venv
# Windows
.\venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.\venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8787
# macOS/Linux
source venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --host 127.0.0.1 --port 8787
```

### Frontend

```sh
cd frontend
npm install
npm run dev
```

Open the printed `http://127.0.0.1:5173` address. The Vite dev server proxies `/api`
requests to the backend on port 8787, so both need to be running at the same time.

## Using it

From the **Lights** tab, scan the network to discover bulbs, or add one by IP if
broadcast discovery is blocked on your network. Click a bulb's card to select it —
most other tabs (Color, Modes, Gradient, Music, Media, Presets, Automations) act on
whichever bulbs are currently selected.

## Project layout

- `backend/` — FastAPI app, WiZ UDP protocol, scheduler, local JSON storage
- `frontend/` — React + Tailwind UI
- `data/` — backend-managed JSON (known bulbs, automations, lock state); not meant for
  version control
- `docs/` — see below

## Read next

- `docs/GUIDE.md` — complete guide to every tab, every control, and what each error message means
- `docs/DEPLOY.md` — deploying the frontend to Vercel and the backend behind Cloudflare Tunnel, so it keeps reaching your bulbs
- `docs/PLAN.md` — how the app is split
- `docs/CHANGELOG.md` — what was added
- `docs/ISSUES.md` — where the Pro cloud docs, the local UDP docs, and pywizlight disagree, and what the lock can and cannot do
