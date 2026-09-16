# TrainVision AI — Working Demo (v0)

A minimal but real, running version of the platform-scheduling idea: a FastAPI
backend that greedily assigns trains to platforms across three stations
(Hyderabad, Secunderabad, Kacheguda), detects and resolves platform conflicts,
and a single-page frontend that shows the live schedule and lets a
"controller" apply manual overrides.

This is intentionally scoped down from the full architecture (no ILP solver,
no Gemini AI, no WebSockets, no database) so it's something you can run and
explain end-to-end tonight. Treat it as Phase 1 of the roadmap.

## How to run it (one command)

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

Then open **http://localhost:8000** in your browser. That's it — the backend
also serves the frontend, so there's nothing else to start.

## What to click during the demo

1. **Live schedule table** — shows all 15 train visits across HYB/SC/KCG with
   their assigned platform, actual arrival/departure, and a plain-English
   `reason` for why they got that slot (on time / reassigned / delayed).
2. **Station tabs** — filter the view to one station at a time.
3. **Conflicts panel** — shows the 8 real conflicts the dataset was built to
   trigger (e.g. two express trains both wanting Platform 1 at Hyderabad at
   the same time), and exactly how the optimizer resolved each one.
4. **Controller override** — pick any train + a different platform, submit,
   and watch the whole schedule re-optimize live around your manual choice
   (mirrors the real system's `/override` endpoint).
5. **Reset overrides** — clears your manual changes and reverts to the
   algorithm's own decisions.

## What's implemented vs simplified

| Feature | Status |
|---|---|
| Greedy platform-assignment optimizer | ✅ Implemented (`backend/optimizer.py`) |
| Conflict detection + logged resolution | ✅ Implemented |
| Manual controller override | ✅ Implemented |
| Live dashboard UI | ✅ Implemented (single HTML file, no build step) |
| ILP optimizer | ⏳ Future work |
| Gemini AI recommendations / chatbot | ⏳ Future work |
| WebSocket live train positions | ⏳ Future work |
| Simulation / Analytics dashboards | ⏳ Future work |
| Persistent database | ⏳ Future work (currently in-memory) |

## Project structure

```
trainvision-demo/
├── backend/
│   ├── main.py          # FastAPI routes
│   ├── models.py        # Pydantic data models
│   ├── optimizer.py      # Greedy scheduling + conflict logging
│   ├── data/trains.json # 15 trains, 3 stations, deliberate conflicts
│   └── requirements.txt
└── frontend/
    └── index.html        # Single-file dashboard (HTML/CSS/JS, no build step)
```
