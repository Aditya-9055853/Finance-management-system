# FinTrack Finance Management

A full-stack personal finance dashboard with a React interface and Flask API. The backend includes account sessions, transaction and budget storage, CSV imports, financial summaries, and an optional Gemini-powered assistant.

## Quick links

- [Application, local setup, and deployment guide](Finance-Management-main/README.md)
- [Render deployment blueprint](render.yaml)

## Deploy

1. Push this repository to GitHub.
2. In Render, create a new **Blueprint** and select the repository. Render reads `render.yaml` and builds the frontend before starting the Flask service.
3. Set `GEMINI_API_KEY` in the Render service environment if you want Gemini chat responses. The app also runs without it.
4. Use the generated public `onrender.com` URL to access the app. Connect a custom domain in Render if desired.

The blueprint uses temporary storage at `/tmp/finai-data` so it can run on Render's free web service. SQLite records and uploaded CSVs can be lost when the service restarts, sleeps, or redeploys. The blueprint uses one Gunicorn worker because the app runs a single in-process background monitor and uses SQLite.

For signup email verification on Render Free, configure a transactional email API key and verified sender in the service's environment. Gmail SMTP app passwords do not work from Render Free because it blocks SMTP egress.

## Updating the live app

Commit and push code changes to the connected GitHub branch. Render rebuilds the React frontend and redeploys the Flask service; users see the update when deployment completes and they reload the page. To deploy automatically, enable **Auto-Deploy** for that branch in Render. This is a deployment workflow, not live editing: changes on your computer are not visible to users until pushed and deployed.

For setup details, environment variables, data handling, and local development, see the [application README](Finance-Management-main/README.md).
