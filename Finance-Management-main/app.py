"""
FinTrack — Intelligent Personal Finance Assistant
Flask backend: API routes, SQLite storage, auth, and wiring together the agent, tools, and RAG engine.
"""
import os
import traceback
import json
from functools import wraps

import pandas as pd
from flask import Flask, request, jsonify, render_template, session, send_file, send_from_directory
from flask_cors import CORS
from sqlalchemy import inspect, text
import firebase_admin
from firebase_admin import auth as firebase_auth, credentials

from config import Config
from models import db, User, Transaction, Budget
from rag.rag_engine import RAGEngine
from agent.finance_agent import FinanceAgent
from agent.autonomous_monitor import AutonomousMonitor
from tools import transaction_tools as txn
from tools import goal_tools as goal_tools_mod

app = Flask(__name__)
app.config.from_object(Config)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "finai-dev-secret-change-me")
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.environ.get("COOKIE_SECURE", "false").lower() in ("1", "true", "yes"),
)
CORS(app, supports_credentials=True)
FRONTEND_DIST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend", "dist")

# ---------------------------------------------------------------------------
# Database (SQLite): created automatically on first run -> FinTrack/finai.db
# ---------------------------------------------------------------------------

db.init_app(app)
with app.app_context():
    db.create_all()
    user_columns = {column["name"] for column in inspect(db.engine).get_columns("users")}
    if "email_verified" not in user_columns:
        with db.engine.begin() as connection:
            connection.execute(text("ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE"))
    if "firebase_uid" not in user_columns:
        with db.engine.begin() as connection:
            connection.execute(text("ALTER TABLE users ADD COLUMN firebase_uid VARCHAR(128)"))
    with db.engine.begin() as connection:
        connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_firebase_uid ON users (firebase_uid)"))

# ---------------------------------------------------------------------------
# Startup: Gemini client, then RAG index (embeddings need the client), then
# the autonomous scheduler that watches for budget/health alerts on its own.
# ---------------------------------------------------------------------------

gemini_client = None
gemini_status = "not_configured"
if Config.GEMINI_API_KEY:
    try:
        from google import genai
        gemini_client = genai.Client(api_key=Config.GEMINI_API_KEY)
        gemini_status = "configured"
        print("[FinTrack] Gemini client initialized.")
    except Exception as e:
        gemini_status = f"error: {e}"
        print(f"[FinTrack] WARNING: Gemini client failed to initialize: {e}")
else:
    print("[FinTrack] WARNING: GEMINI_API_KEY not set. Chat will use fallback (non-AI) responses "
          "until you add a key to .env.")

print("[FinTrack] Building RAG index from knowledge base...")
rag_engine = RAGEngine(
    Config.KNOWLEDGE_BASE_PATH,
    gemini_client=gemini_client,
    embedding_model=Config.EMBEDDING_MODEL,
)
print(f"[FinTrack] RAG index ready with {len(rag_engine.chunks)} chunks (backend: {rag_engine.backend}).")

agent = FinanceAgent(rag_engine=rag_engine, gemini_client=gemini_client, gemini_model=Config.GEMINI_MODEL)

# ---------------------------------------------------------------------------
# Helpers: current user, DataFrame loading, budgets
# ---------------------------------------------------------------------------

# The background monitor has no web request, so it checks whichever user was active last.
LAST_ACTIVE = {"uid": None}


def _firebase_app():
    """Initialize the Admin SDK only when its server-side credential is configured."""
    try:
        return firebase_admin.get_app("fintrack")
    except ValueError:
        if not Config.FIREBASE_SERVICE_ACCOUNT_JSON:
            return None
        service_account = json.loads(Config.FIREBASE_SERVICE_ACCOUNT_JSON)
        project_id = Config.FIREBASE_PROJECT_ID or service_account.get("project_id")
        return firebase_admin.initialize_app(
            credentials.Certificate(service_account),
            {"projectId": project_id},
            name="fintrack",
        )


def _verified_login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        uid = session.get("uid")
        user = db.session.get(User, uid) if uid else None
        if user is None or user.is_guest or not user.email_verified:
            return jsonify({"error": "Sign in with a verified email account to continue."}), 401
        LAST_ACTIVE["uid"] = user.id
        return view(*args, **kwargs)
    return wrapped


def _empty_dataframe() -> pd.DataFrame:
    """A typed, zero-row transactions frame so every tool works with no data."""
    return pd.DataFrame({
        "id": pd.Series(dtype="int64"),
        "date": pd.Series(dtype="datetime64[ns]"),
        "description": pd.Series(dtype="object"),
        "category": pd.Series(dtype="object"),
        "type": pd.Series(dtype="object"),
        "amount": pd.Series(dtype="float64"),
    })


def _current_user(create: bool = True):
    """Logged-in user, or a per-browser guest user.

    create=False is for read-only routes: if nobody is logged in and no guest
    exists yet, return None (callers show empty data) instead of inserting a new
    guest row on every page load. Guests are only created when data is saved.
    """
    uid = session.get("uid")
    user = db.session.get(User, uid) if uid else None
    if user is None and create:
        user = User(name="Guest", is_guest=True)
        db.session.add(user)
        db.session.commit()
        session["uid"] = user.id
        session.permanent = True
    if user is not None:
        LAST_ACTIVE["uid"] = user.id
    return user


def _load_df(user_id: int) -> pd.DataFrame:
    rows = Transaction.query.filter_by(user_id=user_id).all()
    if not rows:
        return _empty_dataframe()
    df = pd.DataFrame([{
        "id": r.id, "date": r.date, "description": r.description,
        "category": r.category, "type": r.type, "amount": r.amount,
    } for r in rows])
    df["date"] = pd.to_datetime(df["date"])
    return df


def _df_for(user) -> pd.DataFrame:
    return _load_df(user.id) if user is not None else _empty_dataframe()


def _load_budgets(user_id: int) -> dict:
    return {b.category: b.limit_amount for b in Budget.query.filter_by(user_id=user_id).all()}


def _save_budgets(user_id: int, budgets: dict):
    Budget.query.filter_by(user_id=user_id).delete()
    for cat, limit in budgets.items():
        try:
            db.session.add(Budget(user_id=user_id, category=str(cat), limit_amount=float(limit)))
        except (TypeError, ValueError):
            continue
    db.session.commit()


def _monitor_state():
    uid = LAST_ACTIVE["uid"]
    if uid is None:
        return {"df": _empty_dataframe(), "budgets": {}}
    with app.app_context():
        return {"df": _load_df(uid), "budgets": _load_budgets(uid)}


# Autonomous background monitor: checks budgets/health on a timer and raises
# alerts on its own, without the user having to ask in chat.
monitor = AutonomousMonitor(
    get_state=_monitor_state,
    gemini_client=gemini_client,
    gemini_model=Config.GEMINI_MODEL,
)
monitor.start(interval_minutes=Config.AUTONOMOUS_CHECK_MINUTES)


def _load_dataframe_from_csv(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)
    df.columns = [c.strip().lower() for c in df.columns]

    # Only coerce columns that are actually present — missing columns are
    # reported clearly by _validate_dataframe() instead of raising here.
    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"], errors="coerce")
    if "amount" in df.columns:
        df["amount"] = pd.to_numeric(df["amount"], errors="coerce")
    if "type" in df.columns:
        df["type"] = df["type"].astype(str).str.strip().str.lower()
    if "category" in df.columns:
        df["category"] = df["category"].astype(str).str.strip()
    if "description" in df.columns:
        df["description"] = df["description"].astype(str).str.strip()
    return df


def _validate_dataframe(df: pd.DataFrame):
    errors = []
    missing_cols = [c for c in Config.REQUIRED_COLUMNS if c not in df.columns]
    if missing_cols:
        errors.append(f"Missing required column(s): {', '.join(missing_cols)}")
        return errors  # can't validate further without columns

    if df.empty:
        errors.append("The CSV file has no data rows.")
        return errors

    if df["date"].isna().any():
        errors.append("Some rows have an invalid or unparseable date. Use format YYYY-MM-DD.")

    if df["amount"].isna().any():
        errors.append("Some rows have a missing or non-numeric amount.")

    invalid_types = df[~df["type"].isin(Config.VALID_TYPES)]
    if not invalid_types.empty:
        errors.append("Some rows have an invalid 'type' value. Must be 'income' or 'expense'.")

    empty_desc = df["description"].isna() | (df["description"].str.strip() == "")
    if empty_desc.any():
        errors.append("Some rows are missing a description.")

    return errors


# ---------------------------------------------------------------------------
# Routes — pages
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    # Prefer the React production build when it exists; keep the legacy page
    # available as a fallback until the frontend has been built once.
    react_index = os.path.join(FRONTEND_DIST, "index.html")
    if os.path.isfile(react_index):
        return send_from_directory(FRONTEND_DIST, "index.html")
    return render_template("index.html")


@app.route("/<path:frontend_path>")
def frontend_assets(frontend_path):
    """Serve Vite assets and let React handle browser-side routes."""
    if os.path.isdir(FRONTEND_DIST):
        requested = os.path.join(FRONTEND_DIST, frontend_path)
        if os.path.isfile(requested):
            return send_from_directory(FRONTEND_DIST, frontend_path)
        return send_from_directory(FRONTEND_DIST, "index.html")
    return "Not found", 404


# ---------------------------------------------------------------------------
# Routes — auth
# ---------------------------------------------------------------------------

@app.route("/api/session", methods=["POST"])
def create_session():
    """Exchange a verified Firebase ID token for this app's secure session."""
    payload = request.get_json(silent=True) or {}
    id_token = str(payload.get("idToken", ""))
    if not id_token:
        return jsonify({"error": "A Firebase sign-in token is required."}), 400
    try:
        firebase = _firebase_app()
    except Exception:
        traceback.print_exc()
        return jsonify({"error": "Firebase server credentials are invalid. Check the Render environment settings."}), 503
    if firebase is None:
        return jsonify({"error": "Firebase server authentication is not configured."}), 503
    try:
        claims = firebase_auth.verify_id_token(id_token, app=firebase, check_revoked=True)
        email = str(claims.get("email", "")).strip().lower()
        firebase_uid = claims.get("uid")
        if not claims.get("email_verified") or not email or not firebase_uid:
            return jsonify({"error": "Verify your email using the link Firebase sent, then sign in again."}), 403

        user = User.query.filter_by(firebase_uid=firebase_uid).first()
        if user is None:
            # Preserve existing finance data when accounts migrate to Firebase Auth.
            user = User.query.filter_by(email=email).first()
        if user is None:
            user = User(name=str(claims.get("name") or email.split("@", 1)[0])[:80], email=email)
            db.session.add(user)
        elif user.firebase_uid and user.firebase_uid != firebase_uid:
            return jsonify({"error": "This email is linked to a different sign-in account."}), 409

        user.firebase_uid = firebase_uid
        user.email = email
        user.email_verified = True
        user.is_guest = False
        if claims.get("name"):
            user.name = str(claims["name"])[:80]
        db.session.commit()
        session.clear()
        session["uid"] = user.id
        session.permanent = True
        return jsonify({"message": "Signed in.", "user": user.to_public()})
    except Exception:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({"error": "Firebase could not validate this sign-in. Please try again."}), 401

@app.route("/api/logout", methods=["POST"])
def logout():
    session.pop("uid", None)
    session["chat_history"] = []
    return jsonify({"message": "Logged out."})


@app.route("/api/me", methods=["GET"])
def me():
    """Who is logged in? Used by the frontend to restore the session on refresh."""
    uid = session.get("uid")
    user = db.session.get(User, uid) if uid else None
    if user is None or user.is_guest or not user.email_verified:
        session.pop("uid", None)
        return jsonify({"user": None})
    return jsonify({"user": user.to_public()})


# ---------------------------------------------------------------------------
# Routes — API
# ---------------------------------------------------------------------------

@app.route("/api/upload", methods=["POST"])
@_verified_login_required
def upload_csv():
    try:
        user = _current_user()

        if "file" not in request.files:
            return jsonify({"error": "No file was provided."}), 400

        file = request.files["file"]
        if file.filename == "":
            return jsonify({"error": "No file was selected."}), 400

        if not file.filename.lower().endswith(".csv"):
            return jsonify({"error": "Only .csv files are supported."}), 400

        save_path = os.path.join(Config.UPLOAD_FOLDER, f"upload_user_{user.id}.csv")
        file.save(save_path)

        try:
            df = _load_dataframe_from_csv(save_path)
        except Exception:
            return jsonify({"error": "Could not parse this file as a CSV. Please check its formatting."}), 400

        errors = _validate_dataframe(df)
        if errors:
            return jsonify({"error": "CSV validation failed.", "details": errors}), 400

        # Drop rows that failed to parse (shouldn't happen if validation passed, but stay safe)
        df = df.dropna(subset=["date", "amount"]).reset_index(drop=True)

        # Replace this user's data with the uploaded rows
        Transaction.query.filter_by(user_id=user.id).delete()
        db.session.add_all([
            Transaction(
                user_id=user.id,
                date=r["date"].to_pydatetime(),
                description=str(r["description"])[:255],
                category=str(r["category"])[:80],
                type=str(r["type"]),
                amount=float(r["amount"]),
            )
            for _, r in df.iterrows()
        ])
        user.data_source = "uploaded"
        user.data_filename = file.filename
        db.session.commit()

        return jsonify({
            "message": f"Successfully loaded {len(df)} transactions from {file.filename}.",
            "row_count": len(df),
        })
    except Exception:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({"error": "An unexpected error occurred while processing the upload."}), 500


@app.route("/api/import-bank-statement", methods=["POST"])
@_verified_login_required
def import_bank_statement():
    """Append transactions from a common bank statement CSV format."""
    try:
        user = _current_user()
        file = request.files.get("file")
        if file is None or not file.filename:
            return jsonify({"error": "Choose a bank statement CSV file first."}), 400
        if not file.filename.lower().endswith(".csv"):
            return jsonify({"error": "Only .csv bank statements are supported."}), 400

        try:
            statement = pd.read_csv(file)
        except Exception:
            return jsonify({"error": "Could not read this CSV. Check that it is a valid bank statement export."}), 400
        statement.columns = [re.sub(r"[^a-z0-9]+", "_", str(c).strip().lower()).strip("_") for c in statement.columns]
        cols = set(statement.columns)

        def find_column(*names):
            return next((name for name in names if name in cols), None)

        date_col = find_column("date", "transaction_date", "txn_date", "posting_date", "value_date", "value_dt")
        desc_col = find_column("description", "narration", "narrations", "particulars", "transaction_details", "remarks", "details")
        amount_col = find_column("amount", "transaction_amount")
        debit_col = find_column("debit", "withdrawal", "withdrawals", "debit_amount", "withdrawal_amount", "withdrawal_amt")
        credit_col = find_column("credit", "deposit", "deposits", "credit_amount", "deposit_amount", "deposit_amt")
        type_col = find_column("type", "transaction_type", "dr_cr")
        category_col = find_column("category")

        if not date_col or not desc_col or not (amount_col or debit_col or credit_col):
            return jsonify({
                "error": "Required columns not found. Include Date, Description or Narration, and Amount or Debit/Credit columns.",
                "columns": list(statement.columns),
            }), 400
        if statement.empty:
            return jsonify({"error": "This statement has no transactions."}), 400

        def money(value):
            if pd.isna(value) or str(value).strip() == "":
                return 0.0
            raw = str(value).strip().replace(",", "")
            negative = raw.startswith("(") and raw.endswith(")")
            raw = re.sub(r"[^0-9.\-]", "", raw.strip("()"))
            try:
                result = float(raw)
                return -abs(result) if negative else result
            except ValueError:
                return 0.0

        rows = []
        invalid = 0
        for _, item in statement.iterrows():
            parsed_date = pd.to_datetime(item.get(date_col), errors="coerce")
            description = str(item.get(desc_col, "")).strip()
            if pd.isna(parsed_date) or not description or description.lower() == "nan":
                invalid += 1
                continue

            if debit_col or credit_col:
                debit = abs(money(item.get(debit_col))) if debit_col else 0.0
                credit = abs(money(item.get(credit_col))) if credit_col else 0.0
                if debit > 0 and credit > 0:
                    invalid += 1
                    continue
                txn_type, amount = ("income", credit) if credit > 0 else ("expense", debit)
            else:
                raw_amount = money(item.get(amount_col))
                raw_type = str(item.get(type_col, "")).strip().lower() if type_col else ""
                txn_type = "income" if raw_type in ("income", "credit", "cr") else "expense"
                if raw_type not in ("income", "credit", "cr", "expense", "debit", "dr"):
                    txn_type = "income" if raw_amount > 0 else "expense"
                amount = abs(raw_amount)

            if amount <= 0:
                invalid += 1
                continue
            category = str(item.get(category_col, "Uncategorized")).strip() if category_col else "Uncategorized"
            if not category or category.lower() == "nan":
                category = "Uncategorized"
            rows.append({"date": parsed_date.to_pydatetime(), "description": description[:255],
                         "category": category[:80], "type": txn_type, "amount": round(amount, 2)})

        if not rows:
            return jsonify({"error": "No valid transactions found. Check the dates and amount columns.", "skipped": invalid}), 400

        existing = {(r.date.strftime("%Y-%m-%d"), r.description.strip().lower(), r.type, round(r.amount, 2))
                    for r in Transaction.query.filter_by(user_id=user.id).all()}
        added = []
        duplicates = 0
        for row in rows:
            key = (row["date"].strftime("%Y-%m-%d"), row["description"].strip().lower(), row["type"], row["amount"])
            if key in existing:
                duplicates += 1
                continue
            existing.add(key)
            added.append(Transaction(user_id=user.id, **row))

        if added:
            db.session.add_all(added)
            if user.data_source == "empty":
                user.data_source = "bank"
            db.session.commit()
        return jsonify({"message": f"Imported {len(added)} bank transactions.", "added": len(added),
                        "duplicates": duplicates, "skipped": invalid}), 200
    except Exception:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({"error": "Could not import this bank statement."}), 500


@app.route("/api/clear-data", methods=["POST"])
@_verified_login_required
def clear_data():
    try:
        user = _current_user()
        Transaction.query.filter_by(user_id=user.id).delete()
        user.data_source = "empty"
        user.data_filename = None
        db.session.commit()
        return jsonify({"message": "All data cleared.", "row_count": 0})
    except Exception:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({"error": "Could not reset data."}), 500


@app.route("/api/download-sample", methods=["GET"])
def download_sample():
    try:
        return send_file(
            Config.SAMPLE_CSV_PATH,
            as_attachment=True,
            download_name="sample_transactions.csv",
            mimetype="text/csv"
        )
    except Exception:
        traceback.print_exc()
        return jsonify({"error": "Could not download sample file."}), 500


@app.route("/api/summary", methods=["GET"])
@_verified_login_required
def summary():
    user = _current_user(create=False)
    df = _df_for(user)
    if df.empty:
        return jsonify({"total_income": 0, "total_expenses": 0, "balance": 0, "savings_rate": 0,
                         "transaction_count": 0, "source": "empty"})
    return jsonify({
        "total_income": txn.get_total_income(df),
        "total_expenses": txn.get_total_expenses(df),
        "balance": txn.get_balance(df),
        "savings_rate": txn.get_savings_rate(df),
        "transaction_count": txn.get_transaction_count(df),
        "source": user.data_source if user.data_source != "empty" else "manual",
        "filename": user.data_filename,
    })


@app.route("/api/transactions", methods=["GET"])
@_verified_login_required
def transactions():
    df = _df_for(_current_user(create=False))
    if df.empty:
        return jsonify({"transactions": []})
    cols = ["id", "date", "description", "category", "type", "amount"]
    out = df.sort_values(["date", "id"], ascending=[False, False])[cols]
    out = out.assign(date=lambda d: d["date"].dt.strftime("%Y-%m-%d"))
    return jsonify({"transactions": out.to_dict(orient="records")})


@app.route("/api/transactions", methods=["POST"])
@_verified_login_required
def add_transaction():
    try:
        user = _current_user()
        payload = request.get_json(force=True) or {}
        date_str = str(payload.get("date", "")).strip()
        desc = str(payload.get("description", "")).strip()
        category = str(payload.get("category", "")).strip()
        txn_type = str(payload.get("type", "")).strip().lower()
        amount_raw = payload.get("amount")

        # Validation matching CSV rules
        if not date_str:
            return jsonify({"error": "Date is required (format: YYYY-MM-DD)."}), 400
        try:
            parsed_date = pd.to_datetime(date_str, format="%Y-%m-%d")
        except Exception:
            try:
                parsed_date = pd.to_datetime(date_str)
            except Exception:
                return jsonify({"error": "Invalid date format. Use YYYY-MM-DD."}), 400

        if not desc:
            return jsonify({"error": "Description cannot be empty."}), 400

        if not category:
            return jsonify({"error": "Category cannot be empty."}), 400

        if txn_type not in Config.VALID_TYPES:
            return jsonify({"error": f"Invalid type '{txn_type}'. Must be 'income' or 'expense'."}), 400

        try:
            amount = float(amount_raw)
            if amount <= 0:
                return jsonify({"error": "Amount must be a positive number greater than 0."}), 400
        except (ValueError, TypeError):
            return jsonify({"error": "Amount must be a valid numeric value."}), 400

        row = Transaction(
            user_id=user.id,
            date=parsed_date.to_pydatetime(),
            description=desc[:255],
            category=category[:80],
            type=txn_type,
            amount=round(amount, 2),
        )
        db.session.add(row)
        if user.data_source == "empty":
            user.data_source = "manual"
        db.session.commit()

        return jsonify({
            "message": "Transaction added successfully.",
            "transaction": {
                "id": row.id,
                "date": parsed_date.strftime("%Y-%m-%d"),
                "description": desc,
                "category": category,
                "type": txn_type,
                "amount": round(amount, 2),
            },
            "transaction_count": Transaction.query.filter_by(user_id=user.id).count(),
        }), 201
    except Exception:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({"error": "An unexpected error occurred while adding transaction."}), 500


@app.route("/api/transactions/<int:txn_id>", methods=["DELETE"])
@_verified_login_required
def delete_transaction(txn_id):
    try:
        user = _current_user(create=False)
        row = Transaction.query.filter_by(id=txn_id, user_id=user.id).first() if user else None
        if row is None:
            return jsonify({"error": f"Transaction with ID {txn_id} not found."}), 404

        db.session.delete(row)
        db.session.commit()
        return jsonify({
            "message": "Transaction deleted.",
            "remaining_count": Transaction.query.filter_by(user_id=user.id).count(),
        })
    except Exception:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({"error": "An unexpected error occurred while deleting transaction."}), 500


@app.route("/api/categories", methods=["GET"])
@_verified_login_required
def categories():
    df = _df_for(_current_user(create=False))
    if df.empty:
        return jsonify({"categories": {}})
    return jsonify({"categories": txn.get_category_spending(df)})


@app.route("/api/monthly-summary", methods=["GET"])
@_verified_login_required
def monthly_summary():
    df = _df_for(_current_user(create=False))
    if df.empty:
        return jsonify({"months": []})
    return jsonify({"months": txn.get_monthly_summary(df)})


@app.route("/api/budget", methods=["GET"])
@_verified_login_required
def get_budgets():
    """Budgets the user saved earlier (so they survive refresh/restart)."""
    user = _current_user(create=False)
    return jsonify({"budgets": _load_budgets(user.id) if user else {}})


@app.route("/api/budget", methods=["POST"])
@_verified_login_required
def budget_status():
    try:
        from tools import budget_tools
        user = _current_user(create=False)
        df = _df_for(user)
        payload = request.get_json(force=True) or {}
        budgets = payload.get("budgets", {})
        month = str(payload.get("month", "")).strip()
        if df.empty:
            return jsonify({"error": "No transaction data is loaded."}), 400
        if not budgets:
            return jsonify({"error": "No budgets were provided."}), 400
        if month:
            if not re.fullmatch(r"\d{4}-\d{2}", month):
                return jsonify({"error": "Month must use YYYY-MM format."}), 400
            df = df[df["date"].dt.to_period("M").astype(str) == month]
            if df.empty:
                return jsonify({"error": f"No transactions were found for {month}."}), 400
        _save_budgets(user.id, budgets)  # saved so the autonomous monitor and next visit can use it
        results = budget_tools.calculate_budget_status(df, budgets)
        return jsonify({"results": results, "month": month or None})
    except Exception:
        db.session.rollback()
        traceback.print_exc()
        return jsonify({"error": "Could not calculate budget status."}), 500


@app.route("/api/goal", methods=["POST"])
@_verified_login_required
def goal_endpoint():
    try:
        df = _df_for(_current_user(create=False))
        payload = request.get_json(force=True) or {}
        target_amount = payload.get("target_amount")
        timeline_months = payload.get("timeline_months")
        current_savings = payload.get("current_savings", 0)

        if target_amount is None or timeline_months is None:
            return jsonify({"error": "target_amount and timeline_months are required."}), 400
        if df.empty:
            return jsonify({"error": "No transaction data is loaded."}), 400

        result = goal_tools_mod.analyze_savings_goal(
            df, float(target_amount), float(timeline_months), float(current_savings)
        )
        return jsonify(result)
    except Exception:
        traceback.print_exc()
        return jsonify({"error": "Could not analyze savings goal."}), 500


@app.route("/api/chat", methods=["POST"])
@_verified_login_required
def chat():
    try:
        user = _current_user(create=False)
        payload = request.get_json(force=True) or {}
        message = (payload.get("message") or "").strip()
        budgets = payload.get("budgets") or (_load_budgets(user.id) if user else None) or None

        if not message:
            return jsonify({"error": "Message cannot be empty."}), 400

        if "chat_history" not in session:
            session["chat_history"] = []

        history = session["chat_history"]

        df = _df_for(user)
        result = agent.handle_message(message, df, history, budgets=budgets)

        history.append({"role": "user", "content": message[:200]})
        history.append({"role": "assistant", "content": result["answer"][:300]})
        session["chat_history"] = history[-6:]  # keep recent 6 turns for context
        session.modified = True

        return jsonify(result)
    except Exception:
        traceback.print_exc()
        return jsonify({
            "answer": "Something went wrong while processing your question. Please try again.",
            "sources": [], "tools_used": [], "data_used": False, "rag_used": False,
            "error": True,
        }), 500


@app.route("/api/clear-chat", methods=["POST"])
@_verified_login_required
def clear_chat():
    session["chat_history"] = []
    return jsonify({"message": "Chat history cleared."})


@app.route("/api/status", methods=["GET"])
def status():
    user = _current_user(create=False)
    return jsonify({
        "gemini_status": gemini_status,
        "rag_backend": rag_engine.backend,
        "rag_chunks_loaded": len(rag_engine.chunks),
        "data_source": user.data_source if user else "empty",
        "transaction_count": Transaction.query.filter_by(user_id=user.id).count() if user else 0,
        "autonomous_monitor_last_checked": monitor.last_checked,
    })


@app.route("/api/alerts", methods=["GET"])
@_verified_login_required
def alerts():
    """Alerts the autonomous monitor raised on its own, in the background —
    the frontend can poll this to show a notification without the user
    having to ask anything in chat first."""
    return jsonify({
        "alerts": monitor.latest_alerts,
        "last_checked": monitor.last_checked,
    })


@app.route("/api/alerts/dismiss", methods=["POST"])
@_verified_login_required
def dismiss_alerts():
    monitor.latest_alerts = []
    return jsonify({"message": "Alerts cleared."})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)
