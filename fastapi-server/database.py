# fastapi-server/database.py
from databases import Database

# database URL for sqlite3
database_url = "sqlite:///../shared/database/arena_master.db"
database = Database(database_url)