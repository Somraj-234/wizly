# Wizly

A local site for Philips WiZ bulbs. React and Tailwind in the browser, FastAPI and the pywizlight package you already installed on this machine.

The browser stores bulb names, rooms, and presets. The Python process discovers bulbs, sends `setPilot`, and runs schedules.

## Run

From `D:\MyCodes\wizly`, in two terminals:

```powershell
.\venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.\venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8787
```

```powershell
cd frontend
npm install
npm run dev
```

Open http://127.0.0.1:5173. The dev server proxies `/api` to port 8787.

Scan the network from Lights, or add a bulb by IP if broadcast is blocked. Select a bulb before changing color, modes, music, or presets.

## Read next

- `docs/PLAN.md` — how the app is split
- `docs/CHANGELOG.md` — what was added
- `docs/ISSUES.md` — where the Pro cloud docs, the local UDP docs, and pywizlight disagree, and what the lock can and cannot do
