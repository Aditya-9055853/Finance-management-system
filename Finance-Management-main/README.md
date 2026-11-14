# FinTrack — Intelligent Personal Finance Assistant

FinTrack is a full-stack finance dashboard. The React frontend is built with Vite and served by Flask; the Flask API stores user accounts, transactions, and budgets in SQLite. Gemini is optional and only called from the backend.

## Features

- Dashboard, transaction table, analytics, and category budgets
- Savings goal, loan/EMI, investment, and currency tools
- CSV upload and bank statement import
- Optional Gemini chat with a local financial knowledge base
- Session-based accounts and guest mode

## Project layout

```text
Finance-Management-main/
├── app.py                 # Flask API and production frontend serving
├── run.py                 # Local development launcher
├── config.py              # Environment and storage configuration
├── models.py              # SQLAlchemy models
├── agent/                 # Assistant and background monitor
├── rag/                   # Finance knowledge retrieval
├── tools/                 # Finance calculations
├── data/                  # Sample CSV and knowledge base
├── frontend/              # React + Vite source
├── templates/ static/     # Legacy frontend fallback
├── uploads/               # Local CSV upload directory
└── requirements.txt
```

## Run locally on Windows

Open PowerShell in this directory:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
cd frontend
npm ci
npm run build
cd ..
python run.py
```

Open <http://127.0.0.1:5000>. The built React interface is served by Flask. For frontend hot reload, run `python run.py` in one terminal, then in a second terminal run `cd frontend; npm ci; npm run dev` and visit <http://localhost:5173>.

If PowerShell blocks virtual environment activation, run `\.venv\Scripts\python.exe -m pip install -r requirements.txt` and later `\.venv\Scripts\python.exe run.py` from the project root instead. Python 3.11 and Node.js 20 or newer are recommended.

## Configuration

Copy `.env.example` to `.env` and set values as needed:

| Variable | Purpose | Default |
| --- | --- | --- |
| `FLASK_SECRET_KEY` | Signs browser session cookies. Set a long, random value for production. | Development-only fallback |
| `GEMINI_API_KEY` | Enables Gemini assistant responses. Keep this server-side. | Empty (fallback chat mode) |
| `GEMINI_MODEL` | Gemini text model | `gemini-3.6-flash` |
| `EMBEDDING_MODEL` | Gemini embedding model | `gemini-embedding-001` |
| `AUTONOMOUS_CHECK_MINUTES` | Background monitor interval | `30` |
| `DATA_DIR` | Directory for SQLite and uploaded files | Project directory |
| `DATABASE_URL` | SQLAlchemy database URL; can point to persistent SQLite storage | `finai.db` under `DATA_DIR` |
| `COOKIE_SECURE` | Send session cookies only over HTTPS; use `true` behind HTTPS | `false` |

Never commit `.env` or place API keys in frontend code. Without a Gemini key, dashboard and finance tools still work and chat uses its fallback response.

## Deploy to Render

The repository includes a `render.yaml` Blueprint at its top level. It builds the React application and starts Flask with Gunicorn, all on one public service and domain. API requests remain same-origin, so no separate frontend hosting or CORS setup is needed.

1. Push the repository to GitHub.
2. In Render, choose **New → Blueprint**, connect the repository, and apply `render.yaml`.
3. In the service's environment settings, add `GEMINI_API_KEY` if Gemini chat is needed.
4. Wait for the first build and open the public service URL Render provides.
5. Enable Auto-Deploy for the chosen branch if you want pushes to deploy automatically.

The blueprint uses temporary storage at `/tmp/finai-data` so it can run on Render's free web service. SQLite records and uploaded CSVs can be lost when the service restarts, sleeps, or redeploys. Keep the single Gunicorn worker: the app starts an in-process monitor and is configured for SQLite.

### Publish changes

Edit the source, commit, and push to the connected branch. Render rebuilds `frontend/dist` and restarts the backend. Users see deployed changes after the deployment finishes and they reload the site (a hard refresh can clear an old browser cache). Local edits do not appear on the public site until pushed and deployed.

### Other hosting providers

Use a Python web service that supports persistent storage. Build with `pip install -r requirements.txt && cd frontend && npm ci && npm run build`, then start with `gunicorn --workers 1 --threads 4 --timeout 120 --bind 0.0.0.0:$PORT app:app`. Set `FLASK_SECRET_KEY`, `COOKIE_SECURE=true`, and `DATA_DIR` to a writable persistent mount. Set `DATABASE_URL` to a persistent database; if using a hosted Postgres URL, convert `postgres://` to `postgresql://` if the provider supplies the old scheme. Make sure the runtime's database driver is installed. Configure HTTPS and backups. Do not use the Flask development server for a public deployment.

## Data and deployment notes

- Accounts and finance records are stored in the configured database. A new browser can sign up for its own account; one user's records are not intended to be shared with everyone.
- Guest data is tied to its browser session. Signing up or logging in creates a regular account.
- SQLite is suitable for this single-instance starter deployment. For multiple app instances or heavier concurrent use, migrate to a managed PostgreSQL database and review the in-process monitor's deployment model.
- Uploaded CSV copies are stored under `DATA_DIR/uploads`; transaction rows are also stored in the database.
- The background budget monitor runs inside the web process. Use a single worker as configured to avoid duplicate monitor jobs.
- Financial tools are educational and do not provide licensed financial advice or execute transactions.

## Frontend-only development commands

From `frontend/`:

```bash
npm ci
npm run dev       # Vite on http://localhost:5173; /api proxies to Flask on port 5000
npm run build     # production files in frontend/dist/
npm run preview   # preview the production frontend build
```

For frontend contribution notes, see [frontend/README.md](frontend/README.md).
