#!/usr/bin/env python3
"""Seed Arena Master with mock data covering every UI state.

Usage (backend must be running — see README):
    python seed_data.py            # add demo data (skips if already present)
    python seed_data.py --reset    # delete previous demo data, then re-seed

Creates four tournaments, all named "Demo ..." so they're easy to spot and
easy to remove without touching your real data:

  1. Demo Worlds 2026     - 8 teams, COMPLETED. Full 3-round bo3 bracket with
                            scores and a champion. Exercises: big bracket
                            render, champion card, standings titles.
  2. Demo Spring Split    - 8 teams, ONGOING. Round 1 decided, round 2
                            generated with one of two matches decided.
                            Exercises: progress bar, mixed pending/done
                            matches, clickable bracket dialog.
  3. Demo Clash Cup       - 4 teams, ONGOING. Round 1 mid-series (1-0, no
                            winner yet). Exercises: live series scores in the
                            bracket dialog and match labels.
  4. Demo Open Qualifier  - 4 teams, CREATED. No matches. Exercises: the
                            'Created' dashboard card and the generate flow.

Unlike the original (which wrote SQLite directly), this seeder drives the
real HTTP API, so it works against any running backend — local or deployed.
Bracket pairings are randomly shuffled by the server, but outcomes are
deterministic: every match is won by the higher-ranked team in POWER_RANKING,
so Turbo Geese always take Demo Worlds 2026.
"""
import argparse
import json
import os
import pathlib
import sys
import urllib.error
import urllib.request
from urllib.parse import quote

# Filled in by main() from arguments and the environment.
API = "http://localhost:8000/api"
SERVICE_KEY = ""
ACTING_USER = ""


def load_env(path):
    """Read KEY=VALUE lines from a .env file, ignoring comments and blanks."""
    values = {}
    env_file = pathlib.Path(path)
    if not env_file.exists():
        return values
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()
    return values

TEAMS_8 = ["Krakens", "Night Owls", "Iron Wolves", "Solar Flare",
           "Void Walkers", "Maple Syndicate", "Frostbite", "Turbo Geese"]
TEAMS_4A = ["Krakens", "Frostbite", "Turbo Geese", "Night Owls"]
TEAMS_4B = ["Iron Wolves", "Solar Flare", "Void Walkers", "Maple Syndicate"]

# Lower index = stronger team; decides every recorded game.
POWER_RANKING = ["Turbo Geese", "Krakens", "Void Walkers", "Frostbite",
                 "Night Owls", "Solar Flare", "Iron Wolves", "Maple Syndicate"]

DEMO_PREFIX = "Demo "


def call(method, path, body=None):
    req = urllib.request.Request(API + path, method=method)
    data = None
    if body is not None:
        data = json.dumps(body).encode()
        req.add_header("Content-Type", "application/json")
    # Same credentials the Discord bot uses: the service key proves the caller
    # is trusted, and the acting-user header decides whose permissions apply.
    # Seeded tournaments are therefore owned by a real account rather than
    # appearing from nowhere.
    if SERVICE_KEY:
        req.add_header("X-Service-Key", SERVICE_KEY)
        req.add_header("X-Acting-User", ACTING_USER)
    try:
        with urllib.request.urlopen(req, data) as r:
            raw = r.read()
            return r.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw) if raw else None
        except json.JSONDecodeError:
            return e.code, None


def get_tournament(name):
    _, t = call("GET", f"/tournaments/by_name/{quote(name)}")
    return t


def undecided(tournament, round_number):
    return [m for m in tournament["matches"]
            if m["round_number"] == round_number and not m["winner"]]


def record_games(name, match, loser_games):
    """Record a bo3 series: interleave wins so the stronger team takes the
    match 2-0 (loser_games=0) or 2-1 (loser_games=1). loser_games=None plays
    a single game (1-0); loser_games='split' plays one game each (1-1)."""
    a, b = (p["name"] for p in match["participants"])
    winner = a if POWER_RANKING.index(a) < POWER_RANKING.index(b) else b
    loser = b if winner == a else a
    if loser_games is None:
        sequence = [winner]
    elif loser_games == "split":
        sequence = [winner, loser]
    else:
        sequence = [winner] + [loser] * loser_games + [winner]
    for game_winner in sequence:
        status, body = call("POST", f"/tournaments/{quote(name)}/record_match_result",
                            {"match_number": match["id"], "winner_team_name": game_winner})
        if status != 200:
            raise SystemExit(f"Recording result failed for {name}: {body}")


def create_and_register(name, teams, game="League of Legends", fmt="bo3"):
    status, body = call("POST", "/tournaments", {"name": name, "game": game, "format": fmt})
    if status != 200:
        raise SystemExit(f"Creating {name} failed: {body}")
    for team in teams:
        call("POST", f"/tournaments/{quote(name)}/register", {"team_name": team})


def generate(name):
    status, body = call("POST", f"/tournaments/{quote(name)}/generate_and_list_matches")
    if status != 200 or "matches" not in (body or {}):
        raise SystemExit(f"Generating bracket for {name} failed: {body}")


def seed():
    # ---- 1. Completed 8-team tournament (3 full rounds) -------------------
    name = DEMO_PREFIX + "Worlds 2026"
    create_and_register(name, TEAMS_8)
    generate(name)
    round_number, loser_games = 1, 0
    while True:
        t = get_tournament(name)
        pending = undecided(t, round_number)
        if not pending:
            break  # final recorded; tournament completed
        for match in pending:
            record_games(name, match, loser_games)
            loser_games = 1 - loser_games  # alternate 2-0 / 2-1 for variety
        round_number += 1

    # ---- 2. Ongoing 8-team tournament (round 2 in progress) ---------------
    name = DEMO_PREFIX + "Spring Split"
    create_and_register(name, TEAMS_8)
    generate(name)
    for match in undecided(get_tournament(name), 1):
        record_games(name, match, 0)
    semis = undecided(get_tournament(name), 2)  # auto-generated by the server
    record_games(name, semis[0], 1)        # one semi decided 2-1
    record_games(name, semis[1], "split")  # the other live at 1-1

    # ---- 3. Ongoing 4-team tournament (round 1 mid-series) ----------------
    name = DEMO_PREFIX + "Clash Cup"
    create_and_register(name, TEAMS_4A)
    generate(name)
    first, _second = undecided(get_tournament(name), 1)
    record_games(name, first, None)        # 1-0, series live; second untouched

    # ---- 4. Created tournament (no bracket yet) ---------------------------
    create_and_register(DEMO_PREFIX + "Open Qualifier", TEAMS_4B)

    # Make sure the demo teams exist in the teams table for the registration
    # UI. Team creation also tries to create a Discord channel and errors if
    # Discord isn't configured — but the team row is saved regardless (legacy
    # behavior the port preserves), so failures here are ignored on purpose.
    for team in TEAMS_8:
        call("POST", "/teams", {"name": team, "members": []})


def demo_tournaments():
    status, tournaments = call("GET", "/tournaments")
    if status != 200:
        raise SystemExit("Backend not reachable — start it first (see README).")
    return [t for t in tournaments if t["name"].startswith(DEMO_PREFIX)]


def main():
    global API, SERVICE_KEY, ACTING_USER

    parser = argparse.ArgumentParser(description="Seed Arena Master demo data")
    parser.add_argument("--reset", action="store_true",
                        help="remove existing demo data before seeding")
    parser.add_argument("--api", default="http://localhost:8000/api",
                        help="API base URL, e.g. https://arena.bortle.app/api")
    parser.add_argument("--env", default=".env",
                        help="file to read ARENA_SERVICE_KEY and ADMIN_DISCORD_IDS from")
    parser.add_argument("--as-user", dest="as_user",
                        help="Discord id to act as; defaults to the first ADMIN_DISCORD_IDS entry")
    args = parser.parse_args()

    API = args.api.rstrip("/")
    env = load_env(args.env)
    # Real environment variables win, so a deployed key can be supplied without
    # editing the local .env.
    SERVICE_KEY = os.environ.get("ARENA_SERVICE_KEY", env.get("ARENA_SERVICE_KEY", ""))
    admin_ids = os.environ.get("ADMIN_DISCORD_IDS", env.get("ADMIN_DISCORD_IDS", ""))
    ACTING_USER = args.as_user or admin_ids.split(",")[0].strip()

    if not SERVICE_KEY or not ACTING_USER:
        sys.exit(
            "Seeding needs credentials: creating tournaments requires an account.\n"
            "Set ARENA_SERVICE_KEY and ADMIN_DISCORD_IDS (in .env or the environment),\n"
            "and make sure that Discord user has signed in to this deployment at least once."
        )

    try:
        existing = demo_tournaments()
    except urllib.error.URLError:
        sys.exit(f"Backend not reachable at {API} — start it first (see README).")

    if args.reset and existing:
        for t in existing:
            call("DELETE", f"/tournaments/{t['id']}")
        print(f"Removed {len(existing)} existing demo tournament(s).")
        existing = []

    if existing:
        sys.exit("Demo data already present - run with --reset to re-seed.")

    seed()

    seeded = demo_tournaments()
    total_matches = sum(len(get_tournament(t["name"])["matches"]) for t in seeded)
    print(f"Seeded {len(seeded)} demo tournaments with {total_matches} matches.")
    print("Champion of Demo Worlds 2026: Turbo Geese (check Standings for the title chip).")


if __name__ == "__main__":
    main()
