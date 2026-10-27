# Northstar — Wind Forecast Intelligence

A full-stack prototype for evaluating UK national wind-generation forecasts against actual generation using data from Elexon BMRS. The dashboard helps users inspect forecast performance, quantify error, and compare matched delivery intervals for January 2026.

## Live application

- **Frontend:** https://northstar-wind-forecast-intelligenc.vercel.app/
- **Backend API:** https://northstar-wind-forecast-intelligence.onrender.com
- **Health check:** https://northstar-wind-forecast-intelligence.onrender.com/api/health
- **Interactive API documentation:** https://northstar-wind-forecast-intelligence.onrender.com/docs
- **Source repository:** https://github.com/skyme-A/northstar-wind-forecast-intelligence

> The live app uses Elexon data when the backend and upstream API are available. Demo mode uses synthetic illustrative values; these are not observed Elexon data.

## What the application does

- Displays forecast-versus-actual wind generation and matched delivery intervals.
- Summarizes forecast error using mean absolute error (MAE), root mean squared error (RMSE), and signed forecast bias.
- Provides interval-level analysis, date filtering, and CSV export.
- Offers an explicitly labelled synthetic demo mode so the dashboard can be explored when live data is unavailable.
- Exposes a Python FastAPI service with health, demo, and live-analysis endpoints.

## Data sources and evaluation assumption

The assignment scope is UK national wind generation from Elexon BMRS only:

- **Actual generation:** `FUELHH` dataset, filtered to `fuelType == "WIND"`. The `startTime` field identifies the delivery interval and `generation` is the generation value.
- **Forecast generation:** `WINDFOR` dataset. Forecast publication time is taken from `publishTime`; generation values are matched to delivery intervals.

Elexon documentation:
- [FUELHH stream endpoint](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream)
- [WINDFOR stream endpoint](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream)

The assignment does not specify the precise day-ahead forecast cutoff. This prototype uses the latest forecast published by **10:00 UTC on the preceding UTC calendar day** for each delivery interval. This is an explicit evaluation assumption, not a confirmed client trading rule. The cutoff can be supplied through the `cutoff_hour_utc` analysis query parameter (0–23).

Only intervals with both an eligible forecast and an actual contribute to the accuracy metrics. Confirm the matched interval count and the source interval convention before interpreting results operationally.

## Technology stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, Recharts, Lucide icons
- **Backend:** Python, FastAPI, Uvicorn, HTTPX
- **Data:** Elexon BMRS API
- **Deployment:** Vercel frontend and Render backend
- **Containerization:** Docker and Docker Compose

## Run locally

Requirements:
- Python 3.11 or newer
- Node.js 20 or newer
- npm
- Docker Desktop (optional, for container-based startup)

### Option A — Run with separate terminals

#### 1. Start the backend

From the repository root:

**Windows PowerShell**
```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload
```

**macOS/Linux**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload
```

Backend URLs:
- Health: http://localhost:8000/api/health
- API docs: http://localhost:8000/docs
- Demo data: http://localhost:8000/api/demo
- January 2026 analysis: http://localhost:8000/api/analysis?start_date=2026-01-01&end_date=2026-01-31&cutoff_hour_utc=10

#### 2. Start the frontend

Open a second terminal from the repository root:

```bash
cd frontend
npm install
```

Create `frontend/.env.local` with the following value for local development:

```dotenv
VITE_API_URL=http://localhost:8000
```

Then run:

```bash
npm run dev
```

Open http://localhost:5173.

Use **Demo data** to inspect the UI without relying on live data, then choose a date range and select **Run live analysis** to request the backend. Do not treat synthetic demo values as actual Elexon observations.

### Option B — Run with Docker Compose

From the repository root, with Docker Desktop running:

```bash
docker compose up --build
```

Then open:
- Frontend: http://localhost:5173
- Backend health: http://localhost:8000/api/health
- API docs: http://localhost:8000/docs

Stop the services with:

```bash
docker compose down
```

The Compose frontend runs the Vite development server; it is intended for local development.

## API endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Backend health check |
| GET | `/api/demo` | Synthetic illustrative demo data |
| GET | `/api/analysis?start_date=2026-01-01&end_date=2026-01-31&cutoff_hour_utc=10` | Fetches Elexon data and evaluates matched forecast/actual intervals |

Analysis parameters:
- `start_date`: first delivery date in `YYYY-MM-DD` format.
- `end_date`: last delivery date in `YYYY-MM-DD` format.
- `cutoff_hour_utc`: publication cutoff hour, from 0 to 23; defaults to 10.

## Configuration

### Frontend

Set `VITE_API_URL` to the backend base URL, without a trailing slash.

- Local: `http://localhost:8000`
- Production: `https://northstar-wind-forecast-intelligence.onrender.com`

For Vite, environment variables are read at build time. Redeploy the frontend after changing the Vercel environment variable.

### Backend

Set `CORS_ORIGINS` to a comma-separated list of permitted frontend origins. For the production deployment, include:

```text
https://northstar-wind-forecast-intelligenc.vercel.app
```

For local development, the backend defaults to allowing `http://localhost:5173` and `http://127.0.0.1:5173`. Update the Render environment variable when the deployed frontend origin changes.

## Deployments

This project is deployed as a split frontend/backend application.

### Render backend

- Root directory: `backend`
- Runtime: Docker
- Dockerfile: `backend/Dockerfile`
- Port: `8000`
- Environment variable: `CORS_ORIGINS` set to the exact Vercel origin

After deployment, verify `/api/health` and `/docs`.

### Vercel frontend

- Root directory: `frontend`
- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_URL=https://northstar-wind-forecast-intelligence.onrender.com`

Redeploy the frontend after changing environment variables. Verify both demo mode and live analysis from the deployed site.

## Validation

Frontend production build:

```bash
cd frontend
npm ci
npm run build
```

Backend tests:

```bash
cd backend
python -m pip install -r requirements.txt
python -m pytest
```

A successful health check confirms that the backend responds; it does not by itself verify CORS, upstream Elexon availability, or successful data matching. For live validation, run an analysis request and inspect the response and matched interval count.

## Project structure

```text
northstar-wind-forecast-intelligence/
├── backend/
│   ├── main.py              # FastAPI routes and Elexon data processing
│   ├── requirements.txt     # Python dependencies
│   ├── Dockerfile           # Backend container image
│   └── test_metrics.py      # Backend metric tests
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # Dashboard and analysis interactions
│   │   ├── styles.css       # Global styles
│   │   └── main.tsx         # React entry point
│   ├── package.json
│   ├── index.html
│   └── vite.config.ts
├── docker-compose.yml       # Local multi-service development
├── render.yaml              # Render deployment configuration
├── vercel.json              # Vercel configuration
├── README.md
├── SUBMISSION_CHECKLIST.md
└── VIDEO_SCRIPT.md
```

## AI assistance disclosure

AI tools (including ChatGPT) were used to assist with implementation, documentation, and debugging. The data-source assumptions and calculated results should be reviewed before any operational or trading use.

## Challenge submission checklist

- [ ] Record an unlisted YouTube demo video, maximum 10 minutes total:
  - Part 1 — customer-facing product overview (up to 5 minutes).
  - Part 2 — technical architecture, implementation, analysis, and development practices (up to 5 minutes).
- [ ] Open the deployed app, public GitHub repository, and unlisted video in an incognito window to verify access.
- [ ] Submit the required links in the challenge submission form.

The demo video is a required deliverable for the challenge; do not submit without it.
