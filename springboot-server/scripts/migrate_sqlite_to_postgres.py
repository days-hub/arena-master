#!/usr/bin/env python3
"""One-off data migration: SQLite (shared/database/arena_master.db) -> Postgres.

Emits SQL on stdout using only the Python stdlib; pipe it into psql, e.g.:

    python springboot-server/scripts/migrate_sqlite_to_postgres.py \
        | docker exec -i arena-master-db psql -U arena -d arenamaster -v ON_ERROR_STOP=1

Idempotent: truncates the target tables first, preserves original ids, and
resets the sequences afterwards. The tournaments.team_names JSON blob becomes
tournament_registrations rows (seed_order = position in the original array).
"""
import json
import sqlite3
import sys
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[2] / "shared" / "database" / "arena_master.db"


def q(value):
    """SQL-literal-quote a Python value."""
    if value is None:
        return "NULL"
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def main():
    if not DB_PATH.exists():
        sys.exit(f"SQLite database not found: {DB_PATH}")
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row

    out = ["BEGIN;",
           "TRUNCATE tournament_registrations, matches, tournaments, teams RESTART IDENTITY CASCADE;"]

    for t in con.execute("SELECT * FROM tournaments"):
        out.append(
            "INSERT INTO tournaments (id, name, status, game, format) VALUES "
            f"({t['id']}, {q(t['name'])}, {q(t['status'] or 'Created')}, {q(t['game'])}, {q(t['format'] or 'bo1')});"
        )
        for seed, team_name in enumerate(json.loads(t["team_names"] or "[]")):
            out.append(
                "INSERT INTO tournament_registrations (tournament_id, team_name, seed_order) VALUES "
                f"({t['id']}, {q(team_name)}, {seed});"
            )

    for m in con.execute("SELECT * FROM matches"):
        out.append(
            "INSERT INTO matches (id, tournament_id, team_a, team_b, start_time, end_time, state, "
            "round_number, winner, match_number, team_a_score, team_b_score) VALUES "
            f"({m['id']}, {m['tournament_id']}, {q(m['team_a'])}, {q(m['team_b'])}, "
            f"{q(m['start_time'])}, {q(m['end_time'])}, {q(m['state'])}, {m['round_number']}, "
            f"{q(m['winner'])}, {q(m['match_number'])}, {m['team_a_score'] or 0}, {m['team_b_score'] or 0});"
        )

    for team in con.execute("SELECT * FROM teams"):
        members = team["members"] or "[]"
        json.loads(members)  # fail loudly here rather than at psql if a row is corrupt
        out.append(
            "INSERT INTO teams (id, name, members) VALUES "
            f"({team['id']}, {q(team['name'])}, {q(members)}::jsonb);"
        )

    # Sequences must resume above the preserved ids.
    for table in ("tournaments", "matches", "teams"):
        out.append(f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), "
                   f"COALESCE((SELECT MAX(id) FROM {table}), 1));")
    out.append("COMMIT;")
    print("\n".join(out))


if __name__ == "__main__":
    main()
