import os
import datetime
from fastapi import FastAPI, HTTPException, APIRouter, Body, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from discord import Status, member
import random
from sqlite3 import IntegrityError
import httpx
from pydantic import BaseModel, Field, validator
from typing import List, Optional
from databases import Database
from database import database
import logging
import json
from pathlib import Path
from dotenv import load_dotenv

# Load the project-root .env so DISCORD_* vars are available without manual exporting.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

DISCORD_API_URL = "https://discord.com/api/v9"
GUILD_ID = os.getenv("DISCORD_GUILD_ID")
BOT_TOKEN = os.getenv("DISCORD_BOT_TOKEN")
DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL")



app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)
class TournamentBase(BaseModel):
    name: str
    game: Optional[str] = None
    format: str = 'bo1'

class TeamRegistration(BaseModel):
    team_name: str
    
class TournamentCreate(TournamentBase):
    pass

class Tournament(TournamentBase):
    id: int
    teams: List[str] = []
    matches: List[dict] = []  # Add the matches field
   
    class Config:
        orm_mode = True
class MatchResult(BaseModel):
    match_number: int
    winner_team_name: str
class TournamentService:
    def __init__(self, database: Database, tournament_data: Tournament):
        self.db = database  
        self.tournament_data = tournament_data

    async def generate_matches(self, round_number=1, teams=None):
        if teams is None:
            teams = self.tournament_data.teams

        if round_number == 1:
            # Shuffle only for the first round
            random.shuffle(teams)

        matches = []
        for i in range(0, len(teams), 2):
            match_id = await self.insert_match(teams[i], teams[i+1], round_number)
            matches.append((match_id, teams[i], teams[i+1], round_number))
        return matches

    async def insert_match(self, team_a, team_b, round_number=1):
        query = """
        INSERT INTO matches (tournament_id, team_a, team_b, round_number)
        VALUES (:tournament_id, :team_a, :team_b, :round_number)
        """
        values = {
            "tournament_id": self.tournament_data.id, 
            "team_a": team_a, 
            "team_b": team_b,
            "round_number": round_number  # Assign round number here
        }
        last_record_id = await self.db.execute(query=query, values=values)

        # Update the match with the match number after it has been created
        match_number_update_query = """
        UPDATE matches
        SET match_number = id  -- Assuming you want the match_number to be the same as the id
        WHERE id = :match_id
        """
        await self.db.execute(query=match_number_update_query, values={"match_id": last_record_id})

        return last_record_id

    def is_power_of_two(self, num):
        return num != 0 and ((num & (num - 1)) == 0)

class TeamRegistration(BaseModel):
    team_name: str
@app.on_event("startup")
async def startup():
    await database.connect()

@app.on_event("shutdown")
async def shutdown():
    await database.disconnect()

@app.get("/")
async def root():
    return {"message": "Hello World"}

@app.get("/api/tournaments", response_model=List[Tournament])
async def get_tournaments():
    query = "SELECT * FROM tournaments"
    results = await database.fetch_all(query=query)
    return results

@app.get("/api/tournaments/overview")
async def get_tournaments_overview():
    """Dashboard data: one summary row per tournament with status, progress,
    and champion. Declared before /api/tournaments/{id} so the literal path
    'overview' isn't captured by the int path parameter."""
    tournaments = await database.fetch_all("SELECT * FROM tournaments")
    all_matches = await database.fetch_all("SELECT * FROM matches")
    overview = []
    for t in tournaments:
        t_matches = [m for m in all_matches if m["tournament_id"] == t["id"]]
        teams = json.loads(t["team_names"]) if t["team_names"] else []
        decided = [m for m in t_matches if m["winner"]]
        current_round = max((m["round_number"] for m in t_matches), default=0)
        # Single elim: a bracket of N teams has log2(N) rounds.
        total_rounds = max(1, (len(teams) - 1).bit_length()) if len(teams) > 1 else 0
        champion = None
        if t["status"] == "Completed" and t_matches:
            final_round = max(m["round_number"] for m in t_matches)
            final = next((m for m in t_matches if m["round_number"] == final_round and m["winner"]), None)
            champion = final["winner"] if final else None
        overview.append({
            "id": t["id"],
            "name": t["name"],
            "game": t["game"],
            "format": t["format"],
            "status": t["status"] or "Created",
            "team_count": len(teams),
            "matches_total": len(t_matches),
            "matches_decided": len(decided),
            "current_round": current_round,
            "total_rounds": total_rounds,
            "champion": champion,
        })
    return overview


@app.get("/api/standings")
async def get_standings():
    """Aggregate team performance across all tournaments: match win/loss
    (decided matches only), game win/loss (all recorded game scores), and
    titles (champion of each Completed tournament)."""
    all_matches = await database.fetch_all("SELECT * FROM matches")
    tournaments = await database.fetch_all("SELECT * FROM tournaments")

    stats = {}

    def team(name):
        if name not in stats:
            stats[name] = {
                "team": name, "titles": 0,
                "match_wins": 0, "match_losses": 0,
                "game_wins": 0, "game_losses": 0,
            }
        return stats[name]

    for m in all_matches:
        a, b = m["team_a"], m["team_b"]
        if not a or not b:
            continue
        # Games count whenever any were recorded, even mid-series.
        team(a)["game_wins"] += m["team_a_score"] or 0
        team(a)["game_losses"] += m["team_b_score"] or 0
        team(b)["game_wins"] += m["team_b_score"] or 0
        team(b)["game_losses"] += m["team_a_score"] or 0
        # Matches only count once decided.
        if m["winner"]:
            loser = b if m["winner"] == a else a
            team(m["winner"])["match_wins"] += 1
            team(loser)["match_losses"] += 1

    # Titles: champion = winner of the highest round in each Completed tournament.
    for t in tournaments:
        if (t["status"] or "") != "Completed":
            continue
        t_matches = [m for m in all_matches if m["tournament_id"] == t["id"]]
        if not t_matches:
            continue
        final_round = max(m["round_number"] for m in t_matches)
        final = next((m for m in t_matches if m["round_number"] == final_round and m["winner"]), None)
        if final:
            team(final["winner"])["titles"] += 1

    standings = sorted(
        stats.values(),
        key=lambda s: (s["titles"], s["match_wins"], s["game_wins"]),
        reverse=True,
    )
    return standings


@app.get("/api/tournaments/{id}", response_model=Tournament)
async def get_tournament(id: int):
    query = "SELECT * FROM tournaments WHERE id = :id"
    result = await database.fetch_one(query=query, values={"id": id})
    if result is None:
        raise HTTPException(status_code=404, detail="Tournament not found")
    return result

@app.post("/api/notify-discord")
async def notify_discord(payload: dict):
    message = payload["message"]
    # Best-effort: a missing, placeholder, or unreachable webhook should not error out
    # the action that triggered the notification.
    if not DISCORD_WEBHOOK_URL or not DISCORD_WEBHOOK_URL.startswith(("http://", "https://")):
        logging.warning("DISCORD_WEBHOOK_URL is not configured; skipping notification.")
        return {"message": "Discord notification skipped (webhook not configured)"}
    try:
        async with httpx.AsyncClient() as client:
            await client.post(DISCORD_WEBHOOK_URL, json={"content": message})
    except httpx.HTTPError as e:
        logging.warning("Failed to send Discord notification: %s", e)
        return {"message": "Discord notification failed"}
    return {"message": "Notification sent to Discord"}

@app.post("/api/teams/create-channels")
async def create_discord_channels(team_name: str):
    headers = {
        "Authorization": f"Bot {BOT_TOKEN}",
        "Content-Type": "application/json"
    }
    
    channel_name = f"{team_name.lower().replace(' ', '-')}-general"  # Creating a channel name based on the team name
    payload = {
        "name": channel_name,
        "type": 0,  # 0 is the type for a text channel
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(f"{DISCORD_API_URL}/guilds/{GUILD_ID}/channels", json=payload, headers=headers)
        
        if response.status_code != 201:
            raise HTTPException(status_code=400, detail="Failed to create Discord channel")
    
    return {"message": f"Channel '{channel_name}' created for team '{team_name}'"}

@app.post("/api/tournaments", response_model=Tournament)
async def create_tournament(tournament: TournamentCreate):
    # Normalize the name: trailing/leading whitespace breaks name-based URL
    # routing (browsers strip trailing spaces from URLs -> by_name 404s).
    tournament.name = tournament.name.strip()
    if not tournament.name:
        raise HTTPException(status_code=400, detail="Tournament name cannot be empty.")
    query = """
    INSERT INTO tournaments (name, game, format, status)
    VALUES (:name, :game, :format, :status)
    """
    values = {**tournament.dict(), "status": "Created"}
    existing_tournament = await database.fetch_one(
        "SELECT * FROM tournaments WHERE name = :name AND status IN ('Created', 'Ongoing')",
        values={"name": tournament.name}
    )
    if existing_tournament:
        raise HTTPException(status_code=400, detail="A tournament with this name is already ongoing or has been created.")
    try:
        last_record_id = await database.execute(query=query, values=values)
    except IntegrityError as e:
        raise HTTPException(status_code=400, detail=f"Tournament with name '{tournament.name}' already exists.")
    except Exception as e:
        logging.error("Unexpected error during tournament creation: %s", e)
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")

    return {**tournament.dict(), "id": last_record_id}

@app.post("/api/tournaments/{tournament_name}/register")
async def register_team_for_tournament(tournament_name: str, team_registration: TeamRegistration):
    # Log the team registration attempt
    logging.info(f"Registering team: {team_registration.team_name} for tournament: {tournament_name}")

    # Fetch the tournament by name to check if it exists
    tournament_query = "SELECT * FROM tournaments WHERE name = :tournament_name"
    tournament = await database.fetch_one(query=tournament_query, values={"tournament_name": tournament_name})
    if not tournament:
        raise HTTPException(status_code=404, detail=f"Tournament '{tournament_name}' not found")

    # Deserialize the existing team names from the tournament record, if any
    existing_teams = json.loads(tournament['team_names']) if tournament['team_names'] else []

    # Check if the team is already registered to prevent duplicates
    if team_registration.team_name in existing_teams:
        raise HTTPException(status_code=400, detail=f"Team '{team_registration.team_name}' is already registered for the tournament '{tournament_name}'")

    # Add the new team to the list of existing teams and serialize it back to JSON
    updated_teams = existing_teams + [team_registration.team_name]
    updated_teams_json = json.dumps(updated_teams)

    # Update the tournament record with the new list of team names
    update_tournament_query = "UPDATE tournaments SET team_names = :team_names WHERE name = :tournament_name"
    await database.execute(update_tournament_query, values={"team_names": updated_teams_json, "tournament_name": tournament_name})
    
    return {"message": f"Team '{team_registration.team_name}' registered for tournament '{tournament_name}' successfully"}




@app.put("/api/tournaments/{id}", response_model=Tournament)
async def update_tournament(id: int, tournament: TournamentCreate):
    query = "UPDATE tournaments SET name = :name, game = :game, format = :format WHERE id = :id"
    values = {**tournament.dict(), "id": id}
    await database.execute(query=query, values=values)
    return {**tournament.dict(), "id": id}

@app.post("/api/tournaments/{tournament_name}/generate_and_list_matches")
async def api_generate_and_list_matches(tournament_name: str, force: bool = False):
    tournament_data = await get_tournament_by_name(tournament_name)
    if not tournament_data:
        return {"message": "Tournament not found"}
   
    if not tournament_data.teams:
        return {"message": "No teams registered for the tournament"}
   
    if len(tournament_data.teams) < 2:
        return {"message": "Not enough teams to generate matches"}

    tournament_service = TournamentService(database, tournament_data)

    # Single elimination without byes requires a power-of-two team count;
    # an odd count would also crash the pairing loop below.
    if not tournament_service.is_power_of_two(len(tournament_data.teams)):
        return {"message": "Team count must be a power of two (2, 4, 8, ...) to generate a bracket"}

    # Idempotency guard: generating twice was silently inserting a second full
    # set of round-1 matches, which made the frontend bracket render with twice
    # as many first-round slots. If matches already exist, return them unless
    # the caller explicitly asks to regenerate (which wipes and rebuilds).
    existing = await database.fetch_all(
        "SELECT * FROM matches WHERE tournament_id = :tid ORDER BY id",
        values={"tid": tournament_data.id},
    )
    if existing and not force:
        formatted_matches = [
            {"match_id": m["id"], "team_a": m["team_a"], "team_b": m["team_b"]}
            for m in existing if m["round_number"] == 1
        ]
        return {"matches": formatted_matches, "message": "Bracket already generated"}
    if existing and force:
        await database.execute(
            "DELETE FROM matches WHERE tournament_id = :tid",
            values={"tid": tournament_data.id},
        )

    matches = await tournament_service.generate_matches()
   
    if matches:
        # Update tournament status to "Ongoing"
        update_query = "UPDATE tournaments SET status = 'Ongoing' WHERE name = :tournament_name"
        await database.execute(update_query, values={"tournament_name": tournament_name})
       
        # Format matches for response
        formatted_matches = [{"match_id": m[0], "team_a": m[1], "team_b": m[2]} for m in matches]
        return {"matches": formatted_matches}
    else:
        return {"message": "Failed to generate matches"}




    
@app.get("/api/tournaments/by_name/{tournament_name}", response_model=Tournament)
async def get_tournament_by_name(tournament_name: str):
    query = "SELECT * FROM tournaments WHERE name = :tournament_name"
    tournament_data = await database.fetch_one(query=query, values={"tournament_name": tournament_name})
    if tournament_data is None:
        raise HTTPException(status_code=404, detail="Tournament not found")
   
    teams = json.loads(tournament_data["team_names"]) if tournament_data["team_names"] else []
   
    # Fetch the matches for the tournament
    matches_query = "SELECT * FROM matches WHERE tournament_id = :tournament_id"
    matches_data = await database.fetch_all(query=matches_query, values={"tournament_id": tournament_data["id"]})
   
    # Transform the matches data into the desired format
    matches = [
        {
            "id": match["id"],
            "startTime": match["start_time"],
            "state": match["state"],
            "round_number": match["round_number"],
            "winner": match["winner"],
            "participants": [
                {
                    "id": match["team_a"],
                    "resultText": match["team_a_score"],
                    "isWinner": match["winner"] == match["team_a"],
                    "status": "PLAYED",
                    "name": match["team_a"]
                },
                {
                    "id": match["team_b"],
                    "resultText": match["team_b_score"],
                    "isWinner": match["winner"] == match["team_b"],
                    "status": "PLAYED",
                    "name": match["team_b"]
                }
            ]
        }
        for match in matches_data
    ]
   
    tournament = Tournament(
        id=tournament_data["id"],
        name=tournament_data["name"],
        game=tournament_data["game"],
        format=tournament_data["format"],
        teams=teams,
        matches=matches  # Include the matches data in the response
    )
   
    return tournament

async def fetch_tournament_teams(tournament_id: int) -> List[str]:
    # Fetch the tournament record to get the team_names field
    tournament_query = "SELECT team_names FROM tournaments WHERE id = :id"
    tournament_record = await database.fetch_one(query=tournament_query, values={"id": tournament_id})
    if tournament_record and tournament_record['team_names']:
        # Deserialize the JSON-encoded team names
        return json.loads(tournament_record['team_names'])
    else:
        # Return an empty list if there are no teams or the tournament doesn't exist
        return []
    
async def process_match_result(tournament_name: str, match_result: MatchResult):
    """Shared logic for record_match_result and record_submatch_result: update the
    match scores, set the winner once a team reaches the format's winning score,
    advance the bracket to the next round (or complete the tournament), and return a
    response message — plus the next round's matches when one is generated."""
    async with database.transaction():
        # Fetch tournament record
        tournament_query = "SELECT * FROM tournaments WHERE name = :tournament_name"
        tournament_record = await database.fetch_one(query=tournament_query, values={"tournament_name": tournament_name})
        if not tournament_record:
            raise HTTPException(status_code=404, detail="Tournament not found")

        # Fetch the match record
        match_query = """
        SELECT *
        FROM matches
        WHERE tournament_id = :tournament_id AND match_number = :match_number
        """
        match = await database.fetch_one(match_query, values={
            "tournament_id": tournament_record["id"],
            "match_number": match_result.match_number
        })
        if not match:
            raise HTTPException(status_code=404, detail="Match not found")

        # Determine the winning team and update the match scores
        if match_result.winner_team_name == match["team_a"]:
            team_a_score = match["team_a_score"] + 1
            team_b_score = match["team_b_score"]
        elif match_result.winner_team_name == match["team_b"]:
            team_a_score = match["team_a_score"]
            team_b_score = match["team_b_score"] + 1
        else:
            raise HTTPException(status_code=400, detail="Invalid winning team")

        # Update the match scores
        update_match_scores_query = """
        UPDATE matches
        SET team_a_score = :team_a_score, team_b_score = :team_b_score
        WHERE id = :match_id
        """
        await database.execute(update_match_scores_query, values={
            "team_a_score": team_a_score,
            "team_b_score": team_b_score,
            "match_id": match["id"]
        })
        now = datetime.datetime.now()
        end_time = now.strftime('%Y-%m-%d %H:%M:%S')
        update_end_time_query = """
            UPDATE matches 
            SET end_time = :end_time 
            WHERE id = :match_id
        """
        await database.execute(update_end_time_query, values={"end_time": end_time, "match_id": match["id"]})
        # Determine if the match is complete based on the tournament format
        tournament_format = tournament_record["format"]
        if tournament_format == "bo3":
            winning_score = 2
        elif tournament_format == "bo5":
            winning_score = 3
        elif tournament_format == "bo7":
            winning_score = 4
        else:
            winning_score = 1

        if team_a_score == winning_score:
            winner = match["team_a"]
            update_match_winner_query = """
            UPDATE matches
            SET winner = :winner
            WHERE id = :match_id
            """
            await database.execute(update_match_winner_query, values={
                "winner": winner,
                "match_id": match["id"]
            })
        elif team_b_score == winning_score:
            winner = match["team_b"]
            update_match_winner_query = """
            UPDATE matches
            SET winner = :winner
            WHERE id = :match_id
            """
            await database.execute(update_match_winner_query, values={
                "winner": winner,
                "match_id": match["id"]
            })
        else:
            winner = None

        # Fetch updated tournament data, ensuring the teams are included
        tournament_query = """
            SELECT * FROM tournaments
            WHERE name = :tournament_name
        """
        tournament_record = await database.fetch_one(query=tournament_query, values={"tournament_name": tournament_name})
        tournament_data = Tournament(
            id=tournament_record["id"],
            name=tournament_record["name"],
            game=tournament_record["game"],
            format=tournament_record["format"],
            teams=json.loads(tournament_record["team_names"])
        )
        tournament_service = TournamentService(database, tournament_data)

        # Generate the response message based on the submatch result
        if winner is None:
            response_message = f"{match_result.winner_team_name} takes Game {team_a_score + team_b_score}! The score is now {team_a_score}-{team_b_score}."
        else:
            response_message = f"{winner} takes Game {team_a_score + team_b_score}, winning Match {match_result.match_number} with a score of {team_a_score}-{team_b_score}!"

        all_matches_query = "SELECT * FROM matches WHERE tournament_id = :tournament_id"
        all_matches = await database.fetch_all(query=all_matches_query, values={"tournament_id": tournament_record["id"]})
        round_matches = [m for m in all_matches if m["round_number"] == match["round_number"]]
        all_matches_complete = all(m['winner'] for m in round_matches)

        if all_matches_complete:
            next_round_number = max(m["round_number"] for m in all_matches) + 1
            next_round_teams = [m["winner"] for m in round_matches]
            if len(next_round_teams) == 1:
                winner = next_round_teams[0]
                completion_query = "UPDATE tournaments SET status = 'Completed' WHERE name = :tournament_name"
                await database.execute(completion_query, values={"tournament_name": tournament_name})
                response_message += f"\n\n🏆 The tournament is complete! Congratulations to the winner: {winner}. What an epic journey! 🎉"
                return {"message": response_message}
            else:
                tournament_service = TournamentService(database, tournament_data)
                next_round_matches = await tournament_service.generate_matches(next_round_number, next_round_teams)
                formatted_next_round_matches = [{"match_id": m[0], "team_a": m[1], "team_b": m[2]} for m in next_round_matches]
                matches_display = "\n".join([f"Match {m['match_id']}: {m['team_a']} vs {m['team_b']}" for m in formatted_next_round_matches])
                response_message += "\n\nNext round matches generated:\n" + matches_display
                return {"message": response_message, "next_round_matches": formatted_next_round_matches}
        else:
            return {"message": response_message}


@app.post("/api/tournaments/{tournament_name}/record_match_result")
async def record_match_result(tournament_name: str, match_result: MatchResult):
    return await process_match_result(tournament_name, match_result)


@app.delete("/api/tournaments/{tournament_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tournament(tournament_id: int):
    query = "DELETE FROM tournaments WHERE id = :id"
    await database.execute(query=query, values={"id": tournament_id})
    # Delete all matches associated with the tournament
    query = "DELETE FROM matches WHERE tournament_id = :id"
    await database.execute(query=query, values={"id": tournament_id})
    return



@app.post("/api/tournaments/{tournament_name}/record_submatch_result")
async def record_submatch_result(tournament_name: str, match_result: MatchResult):
    return await process_match_result(tournament_name, match_result)

# Team models
class TeamBase(BaseModel):
    name: str
    members: List[int] = Field(default_factory=list)

    @validator('members', pre=True, allow_reuse=True)
    def load_json(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                raise ValueError("Could not decode JSON string")
        return v

class AddMemberBody(BaseModel):
    team_id: int
    member_id: int

# TeamCreate now inherits from TeamBase
class TeamCreate(TeamBase):
    pass  # No additional fields 

class Team(TeamBase):
    id: int

    class Config:
        orm_mode = True

# Team routes
@app.post("/api/teams", response_model=Team)
async def create_team(team: TeamCreate):
    # Check if a team with the same name already exists
    check_query = "SELECT * FROM teams WHERE name = :name"
    existing_team = await database.fetch_one(check_query, values={"name": team.name})
    if existing_team:
        # If a team with the name exists, return an error message
        raise HTTPException(status_code=400, detail="Team already exists")
   
    # If no existing team is found, proceed to create a new team
    members_json = json.dumps(team.members)
    query = "INSERT INTO teams (name, members) VALUES (:name, :members)"
    values = {"name": team.name, "members": members_json}    
    last_record_id = await database.execute(query=query, values=values)
   
     # After saving the team in database, proceed to create Discord channels
    headers = {
        "Authorization": f"Bot {BOT_TOKEN}",
        "Content-Type": "application/json"
    }
    channel_name = f"{team.name.lower().replace(' ', '-')}"
    payload = {
        "name": channel_name,
        "type": 0,  # Type 0 for a text channel
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(f"https://discord.com/api/v9/guilds/{GUILD_ID}/channels", json=payload, headers=headers)
        if response.status_code != 201:
            raise HTTPException(status_code=response.status_code, detail="Failed to create Discord channel")
    
    # Return the created team (and potentially info about the created channels)
    return {**team.dict(), "id": last_record_id}

@app.get("/api/discord/members")
async def get_discord_members():
    discord_token = os.getenv('DISCORD_BOT_TOKEN')
    guild_id = os.getenv('DISCORD_GUILD_ID')
    url = f'https://discord.com/api/guilds/{guild_id}/members?limit=1000'

    headers = {
        'Authorization': f'Bot {discord_token}',
        'Content-Type': 'application/json'
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)
        
        if response.status_code == 200:
            members_data = response.json()
            members = []
            for member in members_data:
                user_id = member['user']['id']
                avatar_hash = member['user'].get('avatar')
                avatar_url = None
                if avatar_hash:
                    avatar_url = f"https://cdn.discordapp.com/avatars/{user_id}/{avatar_hash}.png"
                members.append({
                    'id': user_id, 
                    'name': member['user']['username'], 
                    'avatar': avatar_url
                })
            return members
        else:
            raise HTTPException(status_code=response.status_code, detail="Failed to fetch Discord members")
        
    return {"message": "Unable to fetch members"}

@app.get("/api/teams", response_model=List[Team])
async def get_teams():
    query = "SELECT * FROM teams"
    return await database.fetch_all(query=query)


@app.get("/api/teams/{id}", response_model=Team)
async def get_team(id: int):
    query = "SELECT * FROM teams WHERE id = :id"
    team_record = await database.fetch_one(query=query, values={"id": id})
    if team_record:
        team = dict(team_record)
        # Ensure 'members' is deserialized correctly
        team["members"] = json.loads(team["members"]) if isinstance(team["members"], str) else team["members"]
    else:
        raise HTTPException(status_code=404, detail="Team not found")
    return team

@app.get("/api/teams/by_name/{team_name}", response_model=Team)
async def get_team_by_name(team_name: str):
    query = "SELECT * FROM teams WHERE name = :name"
    team_record = await database.fetch_one(query=query, values={"name": team_name})
    if team_record is None:
        raise HTTPException(status_code=404, detail="Team not found")

    # Convert the Record object to a dictionary
    team = dict(team_record)

    # Deserialize the members from string to list if necessary
    team["members"] = json.loads(team["members"]) if isinstance(team["members"], str) else team["members"]
    return team

@app.post("/api/teams/add_member")
async def add_member_to_team(body: AddMemberBody):
    team_id = body.team_id
    member_id = body.member_id    
    query = "SELECT * FROM teams WHERE id = :id"
    team = await database.fetch_one(query=query, values={"id": team_id})
    if team is None:
        raise HTTPException(status_code=404, detail="Team not found")
    members = json.loads(team["members"])
    if member_id in members:
        raise HTTPException(status_code=400, detail="Member already exists in team")
    members.append(member_id)
    updated_members = json.dumps(members)
    update_query = "UPDATE teams SET members = :members WHERE id = :id"
    await database.execute(update_query, values={"members": updated_members, "id": team_id})
 
    return {"message": "Member added to team successfully"}

@app.delete("/api/teams/{id}", response_model=dict)
async def delete_team(id: int):
    # Check if the team exists
    query = "SELECT * FROM teams WHERE id = :id"
    team = await database.fetch_one(query=query, values={"id": id})
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")

    # Delete the team if it exists
    delete_query = "DELETE FROM teams WHERE id = :id"
    await database.execute(delete_query, values={"id": id})
    return {"message": "Team successfully deleted"}

@app.get("/api/games", response_model=List[str])
async def list_games():
    games = ['Valorant', 'Mario Kart', 'Overwatch', 'Fortnite', 'League of Legends', 
             'Apex Legends', 'Minecraft', 'CS:GO', 'Rainbow Six Siege', 'PUBG', 
             'Dota 2', 'World of Warcraft', 'Hearthstone', 'Rocket League', 'Smite', 
             'Paladins', 'Heroes of the Storm', 'Starcraft II', 'Diablo III', 
             'Warcraft III', 'Starcraft: Remastered', 'HOTS', 'SC2', 'D3', 'WC3', 'SCR']
    return games

@app.put("/api/teams/{id}", response_model=Team)
async def update_team(id: int, team: TeamCreate):
    query = "UPDATE teams SET name = :name, members = :members WHERE id = :id"
    values = {**team.dict(), "id": id}
    await database.execute(query=query, values=values)
    updated_team = await database.fetch_one("SELECT * FROM teams WHERE id = :id", values={"id": id})
    if updated_team is None:
        raise HTTPException(status_code=404, detail="Team not found")
    return updated_team