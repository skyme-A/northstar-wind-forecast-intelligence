# Wind Forecast Intelligence

A full-stack prototype for evaluating UK national wind-generation forecasts against actual generation using Elexon BMRS data.

## What it does
- React + TypeScript dashboard with KPI cards, forecast-versus-actual chart, interval error chart, interval table, and CSV export.
- Python + FastAPI backend with health, demo, and analysis endpoints.
- Uses Elexon `FUELHH` records for actual generation filtered to `fuelType == WIND`, and `WINDFOR` forecast publications.
- Calculates MAE, RMSE, and signed bias only for intervals with both an eligible forecast and actual.
- Demo mode is explicitly labelled as synthetic/illustrative; it is not Elexon data.

## Analytical assumption
The assignment does not define the exact day-ahead trading cutoff. The default is configurable and selects the latest forecast published by **10:00 UTC on the previous UTC calendar day** for each delivery interval. This is an evaluation assumption, not a confirmed client rule.

For `WINDFOR`, delivery intervals are reconstructed from `settlementDate` and `settlementPeriod` (48 half-hour periods per UTC day), with `startTime` used only as a fallback. Forecast vintages are filtered by `publishTime`, and only intervals with an actual and eligible forecast contribute to metrics. Elexon API schemas or availability may change; verify the live API response and matched interval count before interpreting results.

## Run locally (Windows PowerShell)
Requirements: Python 3.11+ and Node.js 20+. Docker is optional.

### Backend — terminal 1
```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload
```
If PowerShell blocks activation, use `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` in that terminal and activate again. Or skip the virtual environment activation and run `python -m pip install -r requirements.txt`.

Check: <http://localhost:8000/api/health>  
Interactive API docs: <http://localhost:8000/docs>  
Demo data: <http://localhost:8000/api/demo>  
January analysis: <http://localhost:8000/api/analysis?start_date=2026-01-01&end_date=2026-01-31&cutoff_hour_utc=10>

### Frontend — terminal 2
```powershell
cd frontend
npm install
npm run dev
```
Open <http://localhost:5173>. Use **Demo data** to verify the dashboard independently of the external API, then try **Run live analysis**. A live response with `matchedIntervals: 0` is not a successful validation; inspect the API response and backend terminal logs.

### Tests and production build
```powershell
cd backend
python -m pytest
cd ..\frontend
npm run build
```

## API
- `GET /api/health` — health check.
- `GET /api/demo` — clearly labelled synthetic demo data.
- `GET /api/analysis?start_date=2026-01-01&end_date=2026-01-31&cutoff_hour_utc=10` — fetches Elexon records and calculates metrics. `cutoff_hour_utc` accepts 0–23.

## Deploy (recommended split: Render backend + Vercel frontend)
1. Push this repository to a **public GitHub repository** with a neutral/anonymous repository name, as requested by the assignment. Do not include secrets or personal data.
2. **Backend on Render:** create a new Web Service from the GitHub repository. Set the root directory to `backend`, choose Docker as the runtime, and use `backend/Dockerfile`. Add environment variable `CORS_ORIGINS` with the deployed Vercel origin, e.g. `https://your-project.vercel.app` (comma-separated if multiple). Render should use the Dockerfile's port 8000. After deployment verify `/api/health` and `/docs`.
3. **Frontend on Vercel:** import the same GitHub repo, set Root Directory to `frontend`, Framework Preset to Vite, Build Command `npm run build`, Output Directory `dist`. Add environment variable `VITE_API_URL` equal to the Render backend base URL, with no trailing slash (for example `https://your-backend.onrender.com`). Redeploy after setting it.
4. Update Render's `CORS_ORIGINS` to the exact Vercel production origin, then redeploy the backend. Verify the frontend loads and both Demo data and live analysis buttons behave as expected.
5. Put the deployed frontend URL and the GitHub URL in this README before final submission.

A free backend instance may sleep or cold-start. Live Elexon analysis may take time because the API is queried by publication day. Demo mode is the reliable presentation path if the external source is unavailable; be explicit about that in the video.

## AI assistance disclosure
AI tools were used to help develop and debug parts of this prototype. All data-source assumptions, calculations, and final behaviour should be reviewed and verified before operational use.

## Submission links
- Live app: TODO — add deployed Vercel URL
- Public source repository: TODO — add GitHub URL
- Demo video (unlisted YouTube, maximum 10 minutes): TODO — add URL

## Project structure
```text
wind-forecast-intelligence/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── test_metrics.py
├── frontend/
│   ├── src/App.tsx
│   ├── src/styles.css
│   ├── src/main.tsx
│   ├── package.json
│   ├── index.html
│   └── vite.config.ts
├── docker-compose.yml
├── render.yaml
├── vercel.json
├── README.md
├── SUBMISSION_CHECKLIST.md
└── VIDEO_SCRIPT.md
```
