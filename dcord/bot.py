import os
import discord
from discord.ext.commands import Context
from discord import Interaction, SelectOption, Webhook, ui
from discord.ui import Select, View
import uvicorn
import httpx
import asyncio
from discord.ext import commands
import sqlite3
from fastapi import FastAPI, Request
from urllib.parse import quote
import logging
from pathlib import Path
from dotenv import load_dotenv
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Load the project-root .env so DISCORD_* vars are available without manual exporting.
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

API_BASE_URL = "http://localhost:8000"
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000")
SERVICE_KEY = os.getenv("ARENA_SERVICE_KEY", "")


def api_client(ctx):
    """An HTTP client that authenticates as the person who typed the command.

    The service key proves the request came from the bot; the acting-user
    header tells the API whose permissions to apply, so !record_match_result
    obeys the same ownership rules as clicking the bracket in the web UI. A
    key that authenticated the bot alone would make everyone in the channel
    an administrator.
    """
    headers = {}
    if SERVICE_KEY:
        headers["X-Service-Key"] = SERVICE_KEY
        headers["X-Acting-User"] = str(ctx.author.id)
    return httpx.AsyncClient(headers=headers)
# Connect to the SQLite database
conn = sqlite3.connect('../shared/database/arena_master.db')
c = conn.cursor()
app = FastAPI()



@app.get("/members")
async def get_members():
    guild = bot.get_guild(int(os.getenv('DISCORD_GUILD_ID')))  # guild ID from env
    members = [{"id": member.id, "name": member.name} for member in guild.members]
    return members

# Create tables if they don't already exist.
# NOTE: do NOT drop these — the FastAPI server shares this database, so dropping
# on startup would wipe every tournament, team, and match each time the bot runs.
c.execute('''
CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY,
    name TEXT,
    members TEXT,
    avatar_url TEXT
)
''')
c.execute('''CREATE TABLE IF NOT EXISTS tournaments
             (id INTEGER PRIMARY KEY, name TEXT, team_names TEXT, status TEXT, game TEXT, format TEXT)''')
c.execute('''
CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY,
    tournament_id INTEGER,
    team_a TEXT,
    team_b TEXT,
    start_time TEXT,
    end_time TEXT,
    state TEXT,
    round_number INTEGER,
    winner TEXT,
    match_number INTEGER,
    team_a_score INTEGER DEFAULT 0,
    team_b_score INTEGER DEFAULT 0,
    FOREIGN KEY (tournament_id) REFERENCES tournaments (id)
)''')
conn.commit()


# Define intents
intents = discord.Intents.default()

intents.members = True  # Track join/leave events, list members, etc.
intents.messages = True  # For receiving messages
intents.guilds = True  # For guild-related events
intents.message_content = True  # Enable message content intent



# Create bot with specified intents
bot = commands.Bot(command_prefix='!', intents=intents)

@bot.event
async def on_command_error(ctx, error):
    if isinstance(error, commands.MissingRequiredArgument):
        await ctx.send("You're missing a required argument. Please check the command usage.")
    elif isinstance(error, commands.MemberNotFound):
        await ctx.send("Member not found. Please mention a valid member.")
    else:
        logging.error(f"Unhandled error: {error}")
        await ctx.send("An unexpected error occurred. Please try again later.")

@app.post("/create-team-channels")
async def create_team_channels(request: Request):
    data = await request.json()
    team_name = data["team_name"]

    guild = bot.get_guild(int(os.getenv('DISCORD_GUILD_ID')))  # guild ID from env
    category = discord.utils.get(guild.categories, name='Teams')
    if category is None:
        category = await guild.create_category('Teams')

    overwrites = {
        guild.default_role: discord.PermissionOverwrite(read_messages=False),
        guild.me: discord.PermissionOverwrite(read_messages=True),
    }

    text_channel_name = team_name.replace(' ', '-').lower()
    text_channel = await guild.create_text_channel(text_channel_name, overwrites=overwrites, category=category)
    voice_channel = await guild.create_voice_channel(text_channel_name, overwrites=overwrites, category=category)

    return {"status": "success"}



# in-memory structure for storing teams
teams = {}  
@bot.command(name='create_team', help="Creates a new team with text and voice channels. Usage: !create_team 'Team Name'")
async def create_team(ctx, *, team_name: str):
    # Step 1: Create the team in the database via FastAPI
    team_data = {"name": team_name, "members": []}  # API's expected payload
    async with api_client(ctx) as client:
        try:
            # This posts to the endpoint that creates a new team entity in database
            response = await client.post(f"{API_BASE_URL}/api/teams", json=team_data)
            response.raise_for_status()  # Will raise an exception for 4xx/5xx responses
            
            # successful creation returns the created team's data
            created_team = response.json()
            team_id = created_team.get("id")
            await ctx.send(f"Team `{team_name}` created successfully with ID: {team_id}")
        except httpx.HTTPStatusError as e:
            await ctx.send(f"Failed to create team due to a server error: {e.response.text}")
            return
        except httpx.RequestError as e:
            await ctx.send("Failed to create team due to a network error. Please try again later.")
            return
    
    # Step 2: Create corresponding Discord channels for the team
    try:
        guild = ctx.guild  # This gets the guild (server) where the command was issued
        category = discord.utils.get(guild.categories, name='Teams')
        if category is None:
            category = await guild.create_category('Teams')

        overwrites = {
            guild.default_role: discord.PermissionOverwrite(read_messages=False),
            guild.me: discord.PermissionOverwrite(read_messages=True),
        }

        text_channel_name = team_name.replace(' ', '-').lower() + "-text"
        voice_channel_name = team_name.replace(' ', '-').lower() + "-voice"
        text_channel = await guild.create_text_channel(text_channel_name, overwrites=overwrites, category=category)
        voice_channel = await guild.create_voice_channel(voice_channel_name, overwrites=overwrites, category=category)
        await ctx.send(f"Discord channels created for `{team_name}`: {text_channel.mention}, {voice_channel.name}")
    except Exception as e:
        await ctx.send(f"Failed to create Discord channels for the team due to an error: {e}")





@bot.command(name='add_to_team', help="Adds a specified member to a team. Usage: !add_to_team 'Team Name' @Member")
async def add_to_team(ctx, team_name: str, member: discord.Member):
    member_data = {"team_name": team_name, "member_id": member.id}
    async with api_client(ctx) as client:
        try:
            response = await client.post(f"{API_BASE_URL}/api/teams/add_member", json=member_data)
            response.raise_for_status()
            await ctx.send(f"{member.display_name} added to team `{team_name}`.")
        except httpx.HTTPStatusError as e:
            logging.error(f"HTTP error on adding member to team: {e.response.status_code} - {e.response.text}")
            await ctx.send("Failed to add member to team due to a server error.")
        except httpx.RequestError as e:
            logging.error(f"Request error on adding member to team: {e}")
            await ctx.send("Failed to add member to team due to a network error.")





@bot.command(name='delete_team', help="Deletes the specified team and its channels. Usage: !delete_team 'Team Name'")
@commands.has_permissions(manage_guild=True)
async def delete_team(ctx, *, team_name: str):
    async with api_client(ctx) as client:
        try:
            # Fetch the team by name to get its ID
            fetch_response = await client.get(f"{API_BASE_URL}/api/teams/by_name/{team_name}")
            fetch_response.raise_for_status()
            team_id = fetch_response.json()['id']

            # Delete the team in the database
            delete_response = await client.delete(f"{API_BASE_URL}/api/teams/{team_id}")
            delete_response.raise_for_status()

            # Delete Discord channels associated with the team
            category = discord.utils.get(ctx.guild.categories, name='Teams')
            if category:
                # Adjust the channel names as necessary based on naming scheme
                text_channel_name = team_name.replace(' ', '-').lower()
                voice_channel_name = text_channel_name  # Assuming same naming scheme for voice channel

                text_channel = discord.utils.get(category.text_channels, name=text_channel_name)
                voice_channel = discord.utils.get(category.voice_channels, name=voice_channel_name)

                if text_channel:
                    await text_channel.delete(reason=f"Deleting team {team_name}'s text channel")
                if voice_channel:
                    await voice_channel.delete(reason=f"Deleting team {team_name}'s voice channel")

            await ctx.send(f"Team `{team_name}` and its channels have been deleted.")
        except httpx.HTTPStatusError as e:
            logging.error(f"HTTP error on deleting team: {e.response.status_code} - {e.response.text}")
            await ctx.send("Failed to delete team due to a server error.")
        except httpx.RequestError as e:
            logging.error(f"Request error on deleting team: {e}")
            await ctx.send("Failed to delete team due to a network error.")




tournaments = {}  # Store tournament objects by name

formats = ['bo1', 'bo3', 'bo5']  # Predefined formats
# Predefined list of games
games = ['Valorant', 'Mario Kart', 'Overwatch', 'Marvel Rivals', 'Fortnite', 'League of Legends', 'Apex Legends', 'Minecraft', 'Counter-Strike 2', 'Rainbow Six Siege', 'PUBG', 'Dota 2', 'World of Warcraft', 'Hearthstone', 'Rocket League', 'Smite', 'Paladins', 'Heroes of the Storm', 'Starcraft II', 'Diablo IV', 'Warcraft III', 'Starcraft: Remastered']


@bot.command(name='create_tournament', help="Guides through creating a new tournament.")
async def create_tournament(ctx: commands.Context):
    async with api_client(ctx) as client:
        try:
            games_response = await client.get(f"{API_BASE_URL}/api/games")
            games_response.raise_for_status()
            games = games_response.json()
        except httpx.HTTPStatusError as e:
            logging.error(f"HTTP error when fetching games: {e.response.status_code} - {e.response.text}")
            await ctx.send("Failed to fetch games list. Please try again later.")
            return
        except httpx.RequestError as e:
            logging.error(f"Request error when fetching games: {e}")
            await ctx.send("Network error when trying to fetch games list. Please check your connection and try again later.")
            return

        await ctx.send("What is the tournament name?")

        def check(m):
            return m.author == ctx.author and m.channel == ctx.channel

        try:
            tournament_name_msg = await bot.wait_for('message', check=check, timeout=60)
            tournament_name = tournament_name_msg.content

            # Display the list of available games
            await ctx.send(f"Choose a game from the list:\n{', '.join(games)}")
            game_msg = await bot.wait_for('message', check=check, timeout=60)
            selected_game = game_msg.content

            if selected_game not in games:
                await ctx.send("Invalid game. Please select from the list.")
                return  # Exit the command

            # Select a format
            await ctx.send("Choose a format (bo1, bo3, bo5, bo7):")
            format_msg = await bot.wait_for('message', check=check, timeout=60)
            selected_format = format_msg.content
            formats = ['bo1', 'bo3', 'bo5', 'bo7']

            if selected_format not in formats:
                await ctx.send("Invalid format. Please choose from bo1, bo3, bo5, or bo7.")
                return

            # Construct payload to send to API
            payload = {
                "name": tournament_name,
                "game": selected_game,
                "format": selected_format
            }

            # Before sending the request, log the payload
            logging.debug("Payload being sent to API: %s", payload)

            try:
                response = await client.post(f"{API_BASE_URL}/api/tournaments", json=payload)
                response.raise_for_status()  # Check for HTTP errors
                await ctx.send(f"Tournament '{tournament_name}' created successfully!")
            except httpx.HTTPStatusError as e:
                logging.error(f"HTTP error when creating tournament: {e.response.status_code} - {e.response.text}")
                await ctx.send(f"Failed to create tournament due to a server error ({e.response.status_code}). Please try again later.")
            except httpx.RequestError as e:
                logging.error(f"Request error when creating tournament: {e}")
                await ctx.send("Failed to create tournament due to a network error. Please check your internet connection and try again later.")

        except asyncio.TimeoutError:
            await ctx.send("Tournament creation timed out.")
        except Exception as e:
            logging.error(f"An error occurred while creating the tournament: {e}")
            await ctx.send("An unexpected error has occurred. Please try again later.")


@bot.command(name='register_team', help="Registers a team for a tournament. Usage: !register_team 'Team Name' 'Tournament Name'")
async def register_team(ctx, team_name: str, tournament_name: str):
    async with api_client(ctx) as client:
        try:
            response = await client.post(f"{API_BASE_URL}/api/tournaments/{tournament_name}/register", json={"team_name": team_name})
            response.raise_for_status()
            await ctx.send(f"Team `{team_name}` has been successfully registered for tournament `{tournament_name}`.")
        except httpx.HTTPStatusError as e:
            logging.error(f"HTTP error on team registration: {e.response.status_code} - {e.response.text}")
            await ctx.send(f"Failed to register team `{team_name}`. Server responded with an error.")
        except httpx.RequestError as e:
            logging.error(f"Request error on team registration: {e}")
            await ctx.send("Failed to register team due to a network error. Please try again later.")


@bot.command(name='generate_matches', help="Generates and lists matches for the tournament.")
async def generate_matches(ctx, tournament_name: str):
    async with api_client(ctx) as client:
        try:
            response = await client.post(f"{API_BASE_URL}/api/tournaments/{tournament_name}/generate_and_list_matches")
            response.raise_for_status()

            matches_info = response.json()
            if 'matches' in matches_info and matches_info['matches']:
                matches_display = "\n".join([f"Match {i+1}: {match['team_a']} vs {match['team_b']}"
                                             for i, match in enumerate(matches_info['matches'])])
                await ctx.send(f"Round 1 for tournament '{tournament_name}':\n{matches_display}")
            else:
                await ctx.send(matches_info.get('message', 'No matches were generated.'))
                
        except httpx.HTTPStatusError as e:
            logging.error(f"HTTP error on generating matches: {e.response.status_code} - {e.response.text}")
            await ctx.send("Failed to generate matches due to a server error.")
        except httpx.RequestError as e:
            logging.error(f"Request error on generating matches: {e}")
            await ctx.send("Failed to generate matches due to a network error.")


@bot.command(name='bracket', help="Posts a link to the tournament's live bracket page. Usage: !bracket 'Tournament Name'")
async def bracket(ctx, *, tournament_name: str):
    async with api_client(ctx) as client:
        try:
            response = await client.get(f"{API_BASE_URL}/api/tournaments/by_name/{tournament_name}")
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            logging.error(f"HTTP error fetching tournament for bracket: {e.response.status_code} - {e.response.text}")
            await ctx.send(f"Couldn't find tournament `{tournament_name}`.")
            return
        except httpx.RequestError as e:
            logging.error(f"Request error fetching tournament for bracket: {e}")
            await ctx.send("Failed to fetch the tournament due to a network error. Please try again later.")
            return

    data = response.json()
    teams = data.get("teams") or []
    matches = data.get("matches") or []
    bracket_url = f"{FRONTEND_BASE_URL}/bracket/{quote(tournament_name)}"

    embed = discord.Embed(
        title=f"🏆 {tournament_name}",
        url=bracket_url,
        description=f"[Open the live bracket]({bracket_url})",
        color=0x45CAC8,
    )
    if data.get("game"):
        embed.add_field(name="Game", value=data["game"], inline=True)
    if data.get("format"):
        embed.add_field(name="Format", value=data["format"], inline=True)
    embed.add_field(name="Teams", value=str(len(teams)), inline=True)

    if not matches:
        embed.add_field(name="Status", value="No matches generated yet", inline=False)
    else:
        current_round = max((m.get("round_number") or 1) for m in matches)
        final_matches = [m for m in matches if (m.get("round_number") or 1) == current_round]
        champion = final_matches[0].get("winner") if len(final_matches) == 1 else None
        if champion:
            embed.add_field(name="Champion", value=f"{champion} 🥇", inline=False)
        else:
            embed.add_field(name="Current round", value=f"Round {current_round}", inline=True)

    await ctx.send(embed=embed)


@bot.command(name='list_teams')
async def list_teams(ctx, tournament_name: str):
    # Assuming an endpoint or method to fetch tournament details including teams
    async with api_client(ctx) as client:
        response = await client.get(f"{API_BASE_URL}/api/tournaments/by_name/{tournament_name}")
        if response.status_code == 200:
            tournament_data = response.json()
            teams_list = '\n'.join(tournament_data['teams'])
            await ctx.send(f"Teams registered for {tournament_name}: \n{teams_list}")
        else:
            await ctx.send(f"Could not retrieve teams for {tournament_name}")







# In bot.py, within the record_match_result command

@bot.command(name='record_match_result', help="Records the result of a match. Usage: !record_match_result 'Tournament Name' 'Match Number' 'Winner Team Name'")
async def record_match_result(ctx, tournament_name: str, match_number: int, winner_team_name: str):
    async with api_client(ctx) as client:
        try:
            response = await client.post(
                f"{API_BASE_URL}/api/tournaments/{tournament_name}/record_match_result",
                json={
                    "match_number": match_number,
                    "winner_team_name": winner_team_name
                }
            )
            response.raise_for_status()
            result_info = response.json()
            await ctx.send(result_info.get('message', 'The match result has been recorded.'))
            if 'matches_display' in result_info:
                await ctx.send(result_info['matches_display'])
        except httpx.HTTPStatusError as e:
            logging.error(f"HTTP error on recording match result: {e.response.status_code} - {e.response.text}")
            await ctx.send(f"Failed to record match result due to a server error: {e.response.text}")
        except httpx.RequestError as e:
            logging.error(f"Request error on recording match result: {e}")
            await ctx.send("Failed to record match result due to a network error.")


  # Send the new round announcement if there is one
@bot.command(name='record_submatch_result', help="Records the result of a submatch. Usage: !record_submatch_result 'Tournament Name' 'Match Number' 'Winning Team Name'")
async def record_submatch_result(ctx, tournament_name: str, match_number: int, winner_team_name: str):
    async with api_client(ctx) as client:
        try:
            response = await client.post(
                 f"{API_BASE_URL}/api/tournaments/{tournament_name}/record_submatch_result",
                json={
                    "match_number": match_number,
                    "winner_team_name": winner_team_name
                }
            )
            response.raise_for_status()
            result_info = response.json()
            await ctx.send(result_info.get('message', 'The submatch result has been recorded.'))
            if 'next_round_matches' in result_info:
                matches_display = "\n".join([f"Match {m['match_id']}: {m['team_a']} vs {m['team_b']}" for m in result_info['next_round_matches']])
                await ctx.send("Next round matches generated:\n" + matches_display)
        except httpx.HTTPStatusError as e:
            logging.error(f"HTTP error on recording submatch result: {e.response.status_code} - {e.response.text}")
            await ctx.send(f"Failed to record submatch result due to a server error: {e.response.text}")
        except httpx.RequestError as e:
            logging.error(f"Request error on recording submatch result: {e}")
            await ctx.send("Failed to record submatch result due to a network error.")






@bot.command(name='games')
async def list_games(ctx):
    async with api_client(ctx) as client:
        try:
            response = await client.get(f"{API_BASE_URL}/api/games")
            response.raise_for_status()  # Check for HTTP errors
            games_list = response.json()
            games_text = '\n'.join(games_list)
            await ctx.send(f"Available games:\n{games_text}")
        except httpx.HTTPStatusError as e:
            logging.error(f"HTTP error when fetching games: {e.response.status_code} - {e.response.text}")
            await ctx.send("Failed to fetch games due to a server error.")
        except httpx.RequestError as e:
            logging.error(f"Request error when fetching games: {e}")
            await ctx.send("Failed to fetch games due to a network error.")




# Event listener for when the bot has switched from offline to online.
@bot.event
async def on_ready():
    print(f'Logged in as {bot.user.name} (ID: {bot.user.id})')
    print('------')

@bot.event
async def on_disconnect():
    conn.close()
# Run the bot with token
bot.run(os.getenv('DISCORD_BOT_TOKEN'))
