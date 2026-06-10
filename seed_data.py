#!/usr/bin/env python3
"""Seed Arena Master with mock data covering every UI state.

Usage (from the project root):
    python seed_data.py            # add demo data (skips if already present)
    python seed_data.py --reset    # delete previous demo data, then re-seed

Creates four tournaments, all named "Demo ..." so they're easy to spot and
easy to remove without touching your real data:

  1. Demo Worlds 2026     - 8 teams, COMPLETED. Full 3-round bo3 bracket with
                            scores, end times, and a champion. Exercises: big
                            bracket render, champion card, standings titles.
  2. Demo Spring Split    - 8 teams, ONGOING. Round 1 decided, round 2
                            generated with one of two matches decided.
                            Exercises: progress bar, mixed pending/done
                            matches, clickable bracket dialog.
  3. Demo Clash Cup       - 4 teams, ONGOING. Round 1 mid-series (1-0, no
                            winner yet). Exercises: live series scores in the
                            bracket dialog and match labels.
  4. Demo Open Qualifier  - 4 teams, CREATED. No matches. Exercises: the
                            'Created' dashboard card and the generate flow.

The seeder writes the db directly (no server needed) and mirrors exactly how
the backend creates data: team_names as JSON on the tournament, match_number
equal to the row id, sequential round pairing so winners line up with the
bracket transform.
"""
import argparse
import datetime
import json
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "shared" / "database" / "arena_master.db"

TEAMS_8 = ["Krakens", "Night Owls", "Iron Wolves", "Solar Flare",
           "Void Walkers", "Maple Syndicate", "Frostbite", "Turbo Geese"]
TEAMS_4A = ["Krakens", "Frostbite", "Turbo Geese", "Night Owls"]
TEAMS_4B = ["Iron Wolves", "Solar Flare", "Void Walkers", "Maple Syndicate"]

DEMO_PREFIX = "Demo "


def insert_match(cur, tournament_id, team_a, team_b, round_number,
                 winner=None, score=(0, 0), days_ago=0):
    """Insert one match the same way the backend does (match_number = id)."""
    end_time = None
    state = None
    if winner:
        end = datetime.datetime.now() - datetime.timedelta(days=days_ago)
        end_time = end.strftime("%Y-%m-%d %H:%M:%S")
        state = "Completed"
    cur.execute(
        """INSERT INTO matches (tournament_id, team_a, team_b, round_number,
                                winner, team_a_score, team_b_score, end_time, state)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (tournament_id, team_a, team_b, round_number,
         winner, score[0], score[1], end_time, state),
    )
    match_id = cur.lastrowid
    cur.execute("UPDATE matches SET match_number = ? WHERE id = ?", (match_id, match_id))
    return match_id


def insert_tournament(cur, name, teams, status, game="League of Legends", fmt="bo3"):
    cur.execute(
        "INSERT INTO tournaments (name, team_names, status, game, format) VALUES (?, ?, ?, ?, ?)",
        (name, json.dumps(teams), status, game, fmt),
    )
    return cur.lastrowid


def seed(cur):
    # ---- 1. Completed 8-team tournament (3 full rounds) -------------------
    t1 = insert_tournament(cur, DEMO_PREFIX + "Worlds 2026", TEAMS_8, "Completed")
    # Round 1 (pairs in order; winners feed the next round sequentially)
    r1_winners = ["Krakens", "Solar Flare", "Void Walkers", "Turbo Geese"]
    insert_match(cur, t1, "Krakens", "Night Owls", 1, "Krakens", (2, 0), days_ago=9)
    insert_match(cur, t1, "Iron Wolves", "Solar Flare", 1, "Solar Flare", (1, 2), days_ago=9)
    insert_match(cur, t1, "Void Walkers", "Maple Syndicate", 1, "Void Walkers", (2, 1), days_ago=8)
    insert_match(cur, t1, "Frostbite", "Turbo Geese", 1, "Turbo Geese", (0, 2), days_ago=8)
    # Round 2 (semis)
    insert_match(cur, t1, r1_winners[0], r1_winners[1], 2, "Krakens", (2, 1), days_ago=6)
    insert_match(cur, t1, r1_winners[2], r1_winners[3], 2, "Turbo Geese", (1, 2), days_ago=6)
    # Round 3 (final) - champion: Turbo Geese
    insert_match(cur, t1, "Krakens", "Turbo Geese", 3, "Turbo Geese", (1, 2), days_ago=5)

    # ---- 2. Ongoing 8-team tournament (round 2 in progress) ---------------
    t2 = insert_tournament(cur, DEMO_PREFIX + "Spring Split", TEAMS_8, "Ongoing")
    insert_match(cur, t2, "Night Owls", "Iron Wolves", 1, "Night Owls", (2, 1), days_ago=3)
    insert_match(cur, t2, "Maple Syndicate", "Krakens", 1, "Krakens", (0, 2), days_ago=3)
    insert_match(cur, t2, "Solar Flare", "Frostbite", 1, "Frostbite", (1, 2), days_ago=2)
    insert_match(cur, t2, "Turbo Geese", "Void Walkers", 1, "Void Walkers", (1, 2), days_ago=2)
    # Round 2: one semi decided, one pending with a live series score
    insert_match(cur, t2, "Night Owls", "Krakens", 2, "Krakens", (0, 2), days_ago=1)
    insert_match(cur, t2, "Frostbite", "Void Walkers", 2, None, (1, 1))

    # ---- 3. Ongoing 4-team tournament (round 1 mid-series) ----------------
    t3 = insert_tournament(cur, DEMO_PREFIX + "Clash Cup", TEAMS_4A, "Ongoing")
    insert_match(cur, t3, "Krakens", "Frostbite", 1, None, (1, 0))
    insert_match(cur, t3, "Turbo Geese", "Night Owls", 1, None, (0, 0))

    # ---- 4. Created tournament (no bracket yet) ----------------------------
    insert_tournament(cur, DEMO_PREFIX + "Open Qualifier", TEAMS_4B, "Created")

    # Make sure the demo teams exist in the teams table for the registration UI.
    for name in TEAMS_8:
        exists = cur.execute("SELECT 1 FROM teams WHERE name = ?", (name,)).fetchone()
        if not exists:
            cur.execute("INSERT INTO teams (name, members) VALUES (?, ?)", (name, json.dumps([])))


def reset(cur):
    rows = cur.execute(
        "SELECT id FROM tournaments WHERE name LIKE ?", (DEMO_PREFIX + "%",)
    ).fetchall()
    ids = [r[0] for r in rows]
    for tid in ids:
        cur.execute("DELETE FROM matches WHERE tournament_id = ?", (tid,))
        cur.execute("DELETE FROM tournaments WHERE id = ?", (tid,))
    return len(ids)


def main():
    parser = argparse.ArgumentParser(description="Seed Arena Master demo data")
    parser.add_argument("--reset", action="store_true",
                        help="remove existing demo data before seeding")
    args = parser.parse_args()

    if not DB_PATH.exists():
        raise SystemExit(f"Database not found at {DB_PATH} - run from the project root.")

    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()

    if args.reset:
        removed = reset(cur)
        print(f"Removed {removed} existing demo tournament(s).")

    existing = cur.execute(
        "SELECT COUNT(*) FROM tournaments WHERE name LIKE ?", (DEMO_PREFIX + "%",)
    ).fetchone()[0]
    if existing:
        con.close()
        raise SystemExit("Demo data already present - run with --reset to re-seed.")

    seed(cur)
    con.commit()

    n_t = cur.execute("SELECT COUNT(*) FROM tournaments WHERE name LIKE ?", (DEMO_PREFIX + "%",)).fetchone()[0]
    n_m = cur.execute(
        "SELECT COUNT(*) FROM matches WHERE tournament_id IN "
        "(SELECT id FROM tournaments WHERE name LIKE ?)", (DEMO_PREFIX + "%",)
    ).fetchone()[0]
    print(f"Seeded {n_t} demo tournaments with {n_m} matches.")
    print("Champion of Demo Worlds 2026: Turbo Geese (check Standings for the title chip).")
    con.close()


if __name__ == "__main__":
    main()
