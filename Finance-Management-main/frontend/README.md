# FinTrack frontend

React 19 and Vite frontend for FinTrack. In production, Vite's `dist/` build is served by the Flask app at the repository root. For full installation, deployment, and environment configuration, see the [main project README](../README.md).

## Development

Start the Flask backend from the project root in one terminal:

```powershell
python run.py
```

Then run Vite from this directory in another terminal:

```powershell
npm ci
npm run dev
```

Open <http://localhost:5173>. The Vite dev server proxies `/api` calls to Flask at `http://localhost:5000`.

## Build and preview

```powershell
npm ci
npm run build
npm run preview
```

The production build is written to `dist/`. For the deployed app, rebuild with `npm run build` and let Flask serve that directory. Push code changes and redeploy the hosting service for users to receive updates; the Vite development server is for local development only.

## Scripts

- `npm run dev` — local Vite development server
- `npm run build` — optimized production assets
- `npm run preview` — serve the production build locally
- `npm run lint` — run Oxlint
