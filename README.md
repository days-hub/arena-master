# Arena Master

A full-stack tournament management platform for organizing and running single-elimination esports brackets — with a live web dashboard, click-to-record bracket progression, all-time standings, and Discord integration that announces results to your server as they happen.

Built with **Spring Boot + PostgreSQL** on the backend, **React + Material UI** on the frontend, and a **discord.py** bot for chat-based control.

![Tournament dashboard](docs/screenshots/dashboard.png)

## Features

**Tournament dashboard** — every tournament at a glance: live status (Created / Ongoing / Completed), round progress, match completion, and the champion once it's decided. One click into any bracket.

**Interactive bracket** — a pannable, zoomable single-elimination bracket rendered with [@g-loot/react-tournament-brackets](https://github.com/g-loot/react-tournament-brackets). Click any pending match to record a game result; series scores update live, and when a round completes the next round is generated automatically. Best-of-1/3/5 formats supported, with series scoring handled server-side.

![Interactive bracket](docs/screenshots/bracket.png)

**All-time standings** — aggregate team records across every tournament: titles, match win/loss, game win/loss, and game win rate, in a sortable table.

![Standings](docs/screenshots/standings.png)

**Discord integration** — results recorded on the web are announced to your Discord server via webhook ("Krakens take Game 2, winning Match 1 with a score of 2-0!"), and a companion bot allows tournament control from chat. The web app works fully without Discord configured — notifications are best-effort.

**Demo data seeder** — `seed_data.py` populates the app with four tournaments covering every state (completed with champion, mid-bracket, mid-series, and not yet started) so you can explore the full UI immediately. It drives the real HTTP API, so it works against any running backend.

## Stack

| Layer    | Tech                                                          |
| -------- | ------------------------------------------------------------- |
| Backend  | Spring Boot 4 (Java 25), Spring Data JPA, PostgreSQL, Flyway  |
| Frontend | React 18, Material UI 5, React Router, Axios                  |
| Bracket  | @g-loot/react-tournament-brackets                             |
| Bot      | discord.py, Discord webhooks                                  |

## Getting started

Requires **JDK 25**, **Docker Desktop** (for PostgreSQL), **Node 18+**, and **Python 3.12+** (seeder + Discord bot only).

```bash
git clone https://github.com/days-hub/arena-master.git
cd arena-master
```

**1. Backend**

```bash
cd springboot-server
./mvnw spring-boot:run         # http://localhost:8000
```

That single command builds the app, starts PostgreSQL via Docker Compose,
applies the Flyway schema migrations, and serves the API. No local Maven or
Postgres install needed.

**2. Frontend** (separate terminal)

```bash
cd frontend
npm install
npm start                      # http://localhost:3000
```

**3. Demo data** (optional, from the project root, with the backend running)

```bash
python seed_data.py            # seed four demo tournaments
python seed_data.py --reset    # wipe demo data and re-seed fresh
```

**4. Discord** (optional)

Copy `.env.example` to `.env` and set `DISCORD_WEBHOOK_URL` (for result announcements) and bot credentials if running the chat bot. Without it, everything works — the server just logs that notifications are skipped.

## How a tournament runs

1. **Create** a tournament (name, game, bo1/bo3/bo5) on the Tournament Creation page
2. **Register** a power-of-two number of teams (2, 4, 8, ...)
3. **Generate** the bracket — round 1 pairings are shuffled and created
4. **Click matches** on the bracket to record game results; each click records one game of the series. When a match reaches its winning score, the victor advances; when a round completes, the next round spawns automatically
5. **Finish** — the final's winner is crowned, the dashboard shows the champion, and standings update with the title

## API highlights

| Endpoint                                              | Purpose                                  |
| ----------------------------------------------------- | ---------------------------------------- |
| `GET /api/tournaments/overview`                       | Dashboard summary per tournament         |
| `GET /api/standings`                                  | All-time aggregate team records          |
| `POST /api/tournaments/{name}/generate_and_list_matches` | Generate bracket (idempotent; `?force=true` to regenerate) |
| `POST /api/tournaments/{name}/record_match_result`    | Record one game; advances rounds         |
| `GET /api/tournaments/by_name/{name}`                 | Tournament with full match data          |

## Notes for developers

- The backend lives in `springboot-server/` — controllers (`web/`), business
  logic (`service/`), JPA entities (`domain/`), Spring Data repositories
  (`repository/`), and API request/response records (`dto/`).
- The database schema is owned by Flyway
  (`src/main/resources/db/migration/`); Hibernate runs in `validate` mode and
  never alters tables.
- Config follows 12-factor: Discord credentials and CORS origins come from
  properties overridable by env vars (`DISCORD_BOT_TOKEN`,
  `DISCORD_GUILD_ID`, `DISCORD_WEBHOOK_URL`), and the repo-root `.env` is
  read automatically in dev.
- Migrating data from a pre-2026 SQLite install:
  `python springboot-server/scripts/migrate_sqlite_to_postgres.py | docker exec -i arena-master-db psql -U arena -d arenamaster -v ON_ERROR_STOP=1`

## Roadmap

- **Riot API integration** — players link Riot IDs, and match results are ingested automatically from custom games via Match-V5 (with Tournament-V5 codes/callbacks as a stretch goal)
- Match history view and per-team result logs
- Double-elimination support
- Result correction / undo

---

*Built by [Ben Walsh](https://www.linkedin.com/in/ben-walsh-7570aa109/) — see also [astroplanner](https://github.com/days-hub/astroplanner).*
