from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

# Configure engine for PostgreSQL or SQLite
connect_args = {}
db_url = settings.DATABASE_URL
if db_url.startswith("sqlite:///."):
    import os
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    db_filename = db_url.replace("sqlite:///./", "").replace("sqlite:///.", "")
    abs_db_path = os.path.join(backend_dir, db_filename)
    db_url = f"sqlite:///{abs_db_path.replace(os.sep, '/')}"

if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    db_url,
    connect_args=connect_args,
    pool_pre_ping=True if not db_url.startswith("sqlite") else False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
