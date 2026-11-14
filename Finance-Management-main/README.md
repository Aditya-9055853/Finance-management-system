# FinTrack — Intelligent Personal Finance Assistant

FinTrack is a full-stack finance dashboard. The React frontend is built with Vite and served by Flask; the Flask API stores user accounts, transactions, and budgets in SQLite. Gemini is optional and only called from the backend.

## Features

- Dashboard, transaction table, analytics, and category budgets
- Savings goal, loan/EMI, investment, and currency tools
- CSV upload and bank statement import
- Optional Gemini chat with a local financial knowledge base
- Session-based accounts with password sign-in and email verification

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
| `VITE_FIREBASE_API_KEY` | Firebase web API key used by the browser auth flow. | Required |
| `FIREBASE_PROJECT_ID` | Firebase project ID used to verify sign-in tokens. | Required |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Private Firebase Admin service account JSON; keep this secret. | Required on server |
| `GEMINI_MODEL` | Gemini text model | `gemini-3.6-flash` |
| `EMBEDDING_MODEL` | Gemini embedding model | `gemini-embedding-001` |
| `AUTONOMOUS_CHECK_MINUTES` | Background monitor interval | `30` |
| `DATA_DIR` | Directory for SQLite and uploaded files | Project directory |
| `DATABASE_URL` | SQLAlchemy database URL; can point to persistent SQLite storage | `finai.db` under `DATA_DIR` |
| `COOKIE_SECURE` | Send session cookies only over HTTPS; use `true` behind HTTPS | `false` |

Never commit `.env` or place API keys in frontend code. Without a Gemini key, dashboard and finance tools still work and chat uses its fallback response.

### Email verification setup

New users create an account with an email and password, then click the verification link Firebase sends before FinTrack grants access. Firebase handles password storage and email delivery; Flask verifies Firebase ID tokens before creating the app session. Existing local accounts can keep their finance records: create a Firebase account with the same email, verify it, and sign in to link that account.

### Firebase setup (free Spark plan)

1. Create a Firebase project and open **Authentication → Sign-in method**. Enable **Email/Password**.
2. In **Authentication → Settings → Authorized domains**, add the Render hostname (for example, `finai-ieb8.onrender.com`) and `localhost` for local development.
3. Register a Web App in Firebase project settings and copy its **Web API key** and **Project ID**.
4. In **Project settings → Service accounts**, create a private key. Copy the complete JSON securely; never commit it or put it in frontend code.
5. Set `VITE_FIREBASE_API_KEY`, `FIREBASE_PROJECT_ID`, and `FIREBASE_SERVICE_ACCOUNT_JSON` in Render's service **Environment** settings. For local work, place them in the root `.env` file (copy `.env.example`) and restart the backend/build.
6. Redeploy. A new signup should receive a Firebase verification link. The browser returns to the app after verification; the user then signs in with the same password.

The Firebase web API key is intended to be public, but restrict it to the Identity Toolkit API in Google Cloud if desired. The service account JSON is a private server credential and must remain secret. Firebase Spark includes a free allowance for address verification emails; check Firebase's current [Authentication limits](https://firebase.google.com/docs/auth/limits).

Guest access is disabled so an unverified visitor cannot use transaction or budget features. Each verified account sees its own finance data.

## Deploy to Render

The repository includes a `render.yaml` Blueprint at its top level. It builds the React application and starts Flask with Gunicorn, all on one public service and domain. API requests remain same-origin, so no separate frontend hosting or CORS setup is needed.

1. Push the repository to GitHub.
2. In Render, choose **New → Blueprint**, connect the repository, and apply `render.yaml`.
3. In the service's environment settings, add `GEMINI_API_KEY` if Gemini chat is needed, plus the Firebase values described above.
4. Wait for the first build and open the public service URL Render provides.
5. Enable Auto-Deploy for the chosen branch if you want pushes to deploy automatically.

The blueprint uses temporary storage at `/tmp/finai-data` so it can run on Render's free web service. SQLite records and uploaded CSVs can be lost when the service restarts, sleeps, or redeploys. Keep the single Gunicorn worker: the app starts an in-process monitor and is configured for SQLite.

### Publish changes

Edit the source, commit, and push to the connected branch. Render rebuilds `frontend/dist` and restarts the backend. Users see deployed changes after the deployment finishes and they reload the site (a hard refresh can clear an old browser cache). Local edits do not appear on the public site until pushed and deployed.

### Other hosting providers

Use a Python web service that supports persistent storage. Build with `pip install -r requirements.txt && cd frontend && npm ci && npm run build`, then start with `gunicorn --workers 1 --threads 4 --timeout 120 --bind 0.0.0.0:$PORT app:app`. Set `FLASK_SECRET_KEY`, `COOKIE_SECURE=true`, and `DATA_DIR` to a writable persistent mount. Set `DATABASE_URL` to a persistent database; if using a hosted Postgres URL, convert `postgres://` to `postgresql://` if the provider supplies the old scheme. Make sure the runtime's database driver is installed. Configure HTTPS and backups. Do not use the Flask development server for a public deployment.

## Data and deployment notes

- Accounts and finance records are stored in the configured database. A new browser can sign up for its own account; one user's records are not intended to be shared with everyone.
- Email verification is required before users can access finance data. Users only see records associated with their account.
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
