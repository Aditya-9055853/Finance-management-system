"""
Central configuration for FinAI.
Loads environment variables and defines app-wide constants.
"""
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
    GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")
    EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "gemini-embedding-001")

    # How often the autonomous monitor re-checks budgets/health in the background.
    AUTONOMOUS_CHECK_MINUTES = int(os.environ.get("AUTONOMOUS_CHECK_MINUTES", "30"))

    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    # Set DATA_DIR to a persistent mounted directory on a hosting provider.
    DATA_DIR = os.environ.get("DATA_DIR", BASE_DIR)
    os.makedirs(DATA_DIR, exist_ok=True)
    UPLOAD_FOLDER = os.path.join(DATA_DIR, "uploads")
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    SAMPLE_CSV_PATH = os.path.join(BASE_DIR, "data", "sample_transactions.csv")
    KNOWLEDGE_BASE_PATH = os.path.join(BASE_DIR, "data", "finance_knowledge.md")

    # SQLite database file (created automatically on first run)
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", "sqlite:///" + os.path.join(DATA_DIR, "finai.db"))
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    ALLOWED_EXTENSIONS = {"csv"}
    REQUIRED_COLUMNS = ["date", "description", "category", "type", "amount"]
    VALID_TYPES = {"income", "expense"}

    MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # 5 MB upload limit

    RAG_TOP_K = 4
