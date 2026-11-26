# TrainVision AI — Railway Operations Control Center

A railway platform-scheduling, live-telemetry, analytics, and disruption-simulation system for the South Eastern Railway corridor (**Howrah Junction `HWH`**, **Santragachi Junction `SRC`**, and **Kharagpur Junction `KGP`**).

---

## 1. Architecture

```
┌───────────────────────────┐      REST / WS       ┌──────────────────────────┐      SQL      ┌──────────────────┐
│         Frontend          │◄────────────────────►│         Backend          │◄────────────►│    PostgreSQL    │
│  Next.js 16 + React 19    │                      │        (FastAPI)         │              │ overrides +      │
│  Clerk Auth + Tailwind v4 │                      │  Greedy & ILP optimizers │              │ audit_log        │
└───────────────────────────┘                      │  Analytics & Simulator   │              └──────────────────┘
                                                   │  WebSocket + Gemini AI   │
                                                   └────────────┬─────────────┘
                                                                │ REST
                                                                ▼
                                                   ┌──────────────────────────┐
                                                   │      RailRadar API       │
                                                   │  (live boards & GPS,     │
                                                   │   cached w/ fallback)    │
                                                   └──────────────────────────┘
```

---

## 2. Key Capabilities & Recent Updates

### Four Console Modes
1. **Schedule (`ScheduleView.tsx`)** — Live platform allocation timetable, KPI cards (active trains, delayed/conflict count, on-time %), station sector filtering (`ALL`, `HWH`, `SRC`, `KGP`), and conflict resolution cards.
2. **Live Radar (`LiveRadar.tsx`)** — Real-time WebSocket (`/ws`, 10s push) corridor tracker across `KGP -> SRC -> HWH` with speed, compass bearing, delay telemetry, search, and AI Copilot handoff.
3. **Analytics & Gantt (`AnalyticsView.tsx`)** — Head-to-head **Greedy vs. ILP** live benchmark (total delay, priority-weighted delay, on-time %, conflicts, solver time in ms), interactive **Platform Occupancy Gantt Timeline** (click any train bar to prefill an override), and per-station/platform utilization bars.
4. **What-If Disruption Simulator (`SimulationView.tsx`)** — Non-destructive sandbox to test platform maintenance closures (`blocked_platforms`), incoming train delay injections, and extra/emergency train insertions with quick presets, Greedy vs. ILP disruption comparison, and an **Impacted Trains Diff Table**.

### Controller Tools & AI
- **Manual Overrides & Audit Trail (`ControlPanel.tsx`, `AuditLogModal.tsx`)** — Apply platform overrides, clear individual overrides (`DELETE /override/{train_id}/{station_id}`), reset all overrides (`POST /reset`), and inspect the persistent PostgreSQL audit log (`GET /log`).
- **Algorithm-Aware Gemini AI Copilot (`AIAssistant.tsx`)** — Free-text Operations Chat and structured Smart Recommendations backed by Google Gemini, synchronized with the active optimizer (`greedy` or `ilp`).
- **Live Data Source Indicator (`TopNav.tsx`)** — Displays `RailRadar Live` vs. `Static Fallback` status (`GET /data-source`) with a manual refresh trigger (`POST /trains/refresh`).

## 3. Feature Matrix

| Feature | Status | Location |
|---|---|---|
| Greedy platform-assignment optimizer | Done | `backend/optimizer.py` |
| ILP optimal scheduler (PuLP CBC) | Done | `backend/ilp_optimizer.py` |
| Conflict detection & resolution log | Done | `backend/optimizer.py`, `backend/ilp_optimizer.py` |
| Live train data + static fallback (`trains.json`) | Done | `backend/railradar_client.py`, `backend/data/trains.json` |
| PostgreSQL persistence & audit log | Done | `backend/database.py`, `backend/db_models.py` |
| Manual overrides (apply, clear single, reset all) | Done | `backend/main.py`, `ControlPanel.tsx` |
| Persistent Audit Log drawer UI | Done | `AuditLogModal.tsx` |
| Live Data Source status & manual refresh | Done | `TopNav.tsx`, `home/page.tsx` |
| Gemini AI Copilot (Q&A + Recommendations) | Done | `backend/ai_assistant.py`, `AIAssistant.tsx` |
| WebSocket Live Track Radar & telemetry | Done | `backend/train_positions.py`, `backend/websocket_manager.py`, `LiveRadar.tsx` |
| Analytics & Platform Occupancy Gantt chart | Done | `backend/simulation_analytics.py`, `AnalyticsView.tsx` |
| What-If Disruption Simulator (closures, delays, extra trains) | Done | `backend/simulation_analytics.py`, `SimulationView.tsx` |
| Authentication & protected console routes (Clerk) | Done | `frontend/proxy.ts`, `AuthPage.tsx`, `home/layout.tsx` |

---

## 4. Repository Structure

```
Trainvision-AI/
├── docker-compose.yml              # Local PostgreSQL 16 container (port 5433)
├── backend/
│   ├── main.py                     # FastAPI REST & WebSocket server
│   ├── models.py                   # Pydantic schemas (schedule, analytics, simulation)
│   ├── optimizer.py                # Greedy platform assignment + blocked platform support
│   ├── ilp_optimizer.py            # PuLP CBC Integer Linear Programming optimizer
│   ├── simulation_analytics.py     # Greedy vs ILP benchmark, station utilization, What-If simulator
│   ├── ai_assistant.py             # Google Gemini Q&A & structured recommendations
│   ├── railradar_client.py         # RailRadar live station board client
│   ├── train_positions.py          # Corridor prioritization, GPS/bearing telemetry & extrapolation
│   ├── websocket_manager.py        # WebSocket broadcast manager
│   ├── database.py                 # SQLAlchemy engine & session setup
│   ├── db_models.py                # OverrideRecord & AuditLogEntry ORM models
│   ├── data/trains.json            # Station config (HWH/SRC/KGP) & offline demo dataset
│   ├── tests/                      # Backend verification tests
│   └── requirements.txt
└── frontend/                       # Next.js 16 + React 19 + Tailwind CSS v4 + Clerk
    ├── next.config.ts              # Rewrites /api/backend/* -> http://127.0.0.1:8000/*
    ├── proxy.ts                    # Clerk middleware
    └── app/
        ├── page.tsx                # Public landing & Clerk auth redirect
        ├── AuthPage.tsx            # Sign-in / Sign-up UI
        ├── types.ts                # Shared TypeScript interfaces
        ├── utils/api.ts            # Fetch + WebSocket helpers
        ├── home/
        │   ├── layout.tsx          # Server-side Clerk auth guard
        │   └── page.tsx            # Main Operations Control Center
        └── components/
            ├── TopNav.tsx          # Algorithm & view switcher, Data Source, Audit Log, AI toggle
            ├── ScheduleView.tsx    # KPI cards & timetable
            ├── LiveRadar.tsx       # WebSocket corridor radar
            ├── AnalyticsView.tsx   # Greedy vs ILP benchmark, Gantt timeline, platform utilization
            ├── SimulationView.tsx  # Non-destructive What-If disruption sandbox
            ├── ControlPanel.tsx    # Conflicts, manual override, active override clear, audit trigger
            ├── AuditLogModal.tsx   # Persistent audit log drawer
            └── AIAssistant.tsx     # Gemini recommendations & operations chat
```

---

## 5. Setup, Running & Testing Locally

**1. Start PostgreSQL:**
```bash
docker compose up -d
```

**2. Configure & run the backend:**
```bash
cd backend
pip install -r requirements.txt
# Set RAILRADAR_API_KEY, GEMINI_API_KEY, DATABASE_URL in backend/.env
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

**3. Configure & run the frontend:**
```bash
cd frontend
npm install
# Set Clerk keys in frontend/.env
npm run dev
# On Windows PowerShell if npm.ps1 is blocked by execution policy:
# npm.cmd run dev
```

**4. Run backend tests:**
```bash
python -m unittest backend/tests/test_features.py -v
```

---

## 6. API Reference

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Service health check |
| GET | `/data-source` | Live vs static fallback status, cache timestamp, last error |
| POST | `/trains/refresh` | Force a fresh RailRadar board pull (uses API quota) |
| GET | `/stations` | Configured stations and platform counts |
| GET | `/trains` | Current train visits (cached live or fallback) |
| GET | `/schedule?algorithm=greedy\|ilp` | Optimized platform schedule + conflicts |
| GET | `/analytics?algorithm=greedy\|ilp` | Greedy vs ILP benchmark, station & platform utilization |
| POST | `/simulate` | Non-destructive What-If disruption simulation |
| GET | `/overrides` | List active manual controller overrides |
| POST | `/override?algorithm=greedy\|ilp` | Apply a manual platform override `{train_id, station_id, platform}` |
| DELETE | `/override/{train_id}/{station_id}` | Clear a single manual override |
| POST | `/reset?algorithm=greedy\|ilp` | Clear all overrides |
| GET | `/log` | Persistent audit trail (last 200 actions) |
| GET | `/ai/status` | Gemini AI configuration & model status |
| POST | `/ai/analyze-schedule?algorithm=greedy\|ilp` | Gemini Q&A over active schedule |
| GET | `/recommendations?algorithm=greedy\|ilp` | Structured Gemini platform recommendations |
| GET | `/train-positions` | Snapshot of tracked train telemetry |
| WS | `/ws` | Real-time 10s position push stream |
