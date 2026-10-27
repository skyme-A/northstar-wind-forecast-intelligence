# Unlisted YouTube demo script (10 minutes maximum)

Keep the screen recording concise. Show the deployed app if available; otherwise say the deployment is still in progress and record locally. Do not claim demo data is real Elexon data.

## Part 1 — Customer pitch (target 3–4 minutes; max 5)

**0:00–0:30 — Problem**  
“Day-ahead procurement decisions depend on how well wind generation can be forecast. This prototype brings forecast and actual generation into one place and makes forecast error measurable.”

**0:30–1:15 — Dashboard**  
Show the dashboard, selected date range, MAE, RMSE, bias, and matched interval count. Explain: “MAE is the average absolute error, RMSE penalises larger misses more strongly, and bias shows whether forecasts are high or low on average.”

**1:15–2:15 — Visual exploration**  
Show the forecast-versus-actual chart and interval errors. Point out that users can inspect the time series and table rather than relying on a single score.

**2:15–3:00 — Export and transparency**  
Demonstrate CSV export. Explain the cutoff assumption and the difference between live Elexon data and clearly labelled illustrative demo data.

**3:00–3:30 — Value and next step**  
“The next step would be to confirm the actual procurement decision cutoff with the trading team, validate results against the official source, and then monitor accuracy over time.”

## Part 2 — Technical review (target 4–5 minutes; max 5)

**0:00–1:00 — Architecture**  
Show the repository tree: React + TypeScript + Vite frontend, FastAPI backend, Elexon BMRS integration, Docker configuration.

**1:00–2:00 — Data flow**  
Explain `FUELHH` actual records filtered to `fuelType == WIND`; `WINDFOR` forecast vintages selected by publication time; delivery intervals aligned by UTC half-hour period; only matched intervals enter the metrics.

**2:00–3:00 — Metrics and API**  
Show `/docs`, `/api/health`, and `/api/analysis`. Explain MAE, RMSE and signed bias. If live matched interval count is zero, be candid: explain that live source matching still requires verification and show the demo only as a UI demonstration.

**3:00–4:00 — Reliability and tradeoffs**  
Mention API failures are surfaced rather than silently treated as valid results, the cutoff is configurable, and demo data is explicitly labelled. Mention that Elexon rate/response behaviour and production performance require further validation.

**4:00–4:30 — Close**  
Summarise what is complete and identify next steps: validate live historical matching, confirm business cutoff, add automated data-quality checks and deploy monitoring.

## Recording checklist
- Use screen recording with readable browser zoom (around 100–125%).
- Close unrelated tabs and hide personal notifications.
- Keep the two parts clearly separated by a title card or spoken transition.
- Upload to YouTube as **Unlisted**, then test the link in a private browser window.
