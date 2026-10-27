# Final submission checklist

## Before recording
- [ ] Backend health check returns `{"status":"healthy", ...}`.
- [ ] Frontend opens locally and the Demo data button loads clearly labelled illustrative data.
- [ ] Run `python -m pytest` from `backend`.
- [ ] Run `npm run build` from `frontend`.
- [ ] Try live analysis once. If `matchedIntervals` is zero, do not describe live metrics as validated; show the diagnostics and use demo mode for the visual walkthrough.
- [ ] Do not claim synthetic demo data is actual Elexon data.

## Publish
- [ ] Create a public GitHub repo with an anonymous/neutral name, per assignment.
- [ ] Commit the code and README; check no `.env`, credentials, personal data, or `node_modules` are committed.
- [ ] Deploy backend on Render using root `backend` and Docker.
- [ ] Set Render `CORS_ORIGINS` to the exact deployed Vercel frontend origin.
- [ ] Deploy frontend on Vercel using root `frontend`, build `npm run build`, output `dist`, and environment variable `VITE_API_URL` set to the backend base URL.
- [ ] Verify the deployed app and backend health endpoint in a private/incognito browser.
- [ ] Replace the three TODO URLs in README.
- [ ] Record two sections: customer pitch (up to 5 minutes) and technical review (up to 5 minutes); keep the total at or under 10 minutes.
- [ ] Upload the video to YouTube as **Unlisted** and paste the link in README.
- [ ] Submit the live app, GitHub repo, and video URLs wherever the recruiter requested them.

## Git commands (run from project root)
```powershell
git init
git add .
git commit -m "Build wind forecast intelligence prototype"
git branch -M main
git remote add origin https://github.com/YOUR-ANONYMOUS-USERNAME/YOUR-REPO.git
git push -u origin main
```
Create the GitHub repository in the browser first, then replace the placeholder remote URL. Do not commit generated `frontend/node_modules` or Python virtual environments.
