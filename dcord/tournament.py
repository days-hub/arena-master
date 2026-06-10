import random
from match import Match  # Ensure Match class is defined in match.py

class Tournament:
    def __init__(self, name, game=None, format='bo1'):
        self.name = name
        self.game = game  # Optional: single game for the whole tournament
        self.format = format
        self.teams = []  # Stores team names/IDs
        self.matches = []  # Stores Match instances
        self.rounds = 0  # Keep track of the number of rounds
        self.current_round_matches = []  # Active matches for the current round
        self.winner = None  # Stores the winner of the tournament
        self.next_match_id = 1  # Keep track of the next match ID

    def add_team(self, team_name):
        if team_name not in self.teams:
            self.teams.append(team_name)
    def is_final(self):
        # Returns True if the tournament is down to its final match
        return len(self.teams) == 1 and len(self.current_round_matches) == 0
    def generate_matches(self):
        if len(self.teams) % 2 != 0:
            raise ValueError("Number of teams must be even for this implementation.")

        random.shuffle(self.teams)
        self.current_round_matches = []
        match_info = []

        # Inside the Tournament class's generate_matches method
        for i in range(0, len(self.teams), 2):
            match = Match(self.teams[i], self.teams[i + 1], self.next_match_id, self.game, self.format)  # Pass match_id correctly
            self.matches.append(match)
            self.current_round_matches.append(match)
            self.next_match_id += 1  # Increment next match ID for the tournament

            match_info.append((match.id, match.team1, match.team2))

        self.rounds += 1
        round_announcement = f"Round {self.rounds} has started with the following matches:\n" + \
                            '\n'.join([f"Match {m.id}: {m.team1} vs {m.team2}" for m in self.current_round_matches])
        
        # Returning both match information and the round announcement
        return {"matches": match_info, "announcement": round_announcement}

        

    def record_match_result(self, match_id, winner):
        match_found = None
        for match in self.matches:
            if match.id == match_id:
                match_found = match
                break

        if not match_found:
            return "No match found with ID: {}".format(match_id), ""

        match_found.winner = winner
        
        # Determine if the tournament has concluded
        if self.is_final() and len(self.teams) == 1:
            self.winner = winner
            result_message = "🏆Congratulations to {} for winning the tournament!".format(winner)
            new_round_message = ""
            self.reset_tournament()  # Reset or conclude tournament here, if needed
        else:
            new_round_message = self._update_team_status(match_found, winner)
            result_message = self._generate_match_result_message(match_found)
        
        # If it's the last match of the current round but not the final of the tournament, check and advance to the next round
        if not self.winner and all(m.winner for m in self.current_round_matches):
            next_round_info = self.check_and_advance_round()
            if next_round_info and "announcement" in next_round_info:
                new_round_message = next_round_info["announcement"]

        return result_message, new_round_message



    def _update_team_status(self, match, winner):
        loser = match.team1 if match.team2 == winner else match.team2
        self.teams.remove(loser)

        # Remove the concluded match from current round matches
        self.current_round_matches.remove(match)

        new_round_message = ""  # Initialize an empty message for a new round

        if len(self.teams) <= 1:
            self._declare_winner(winner)
            return f"{winner} has defeated {loser}!"

        elif len(self.current_round_matches) == 0:
            # Prepare for the next round if any
            new_round_info = self.generate_matches()
            new_round_message = new_round_info["announcement"]

        return new_round_message




    def _declare_winner(self, winner):
        # Update tournament state to declare the winner
        self.winner = winner

    def _progress_teams(self, winner, loser):
        # Advance the winner and potentially eliminate the loser
        self.teams.remove(loser)

    def _generate_match_result_message(self, match):
        if self.winner:  # If a winner is set, it means the tournament has concluded.
            return f"Congratulations to {self.winner} for winning the tournament!"
        else:
            # If it's not the final, construct the message about moving to the next round.
            next_round_msg = "They have progressed to the next round, " if not match.is_final(self) else ""
            elimination_msg = f"and {match.team1 if match.team1 != match.winner else match.team2} has been eliminated."
            return (f"{match.winner} has won Match {match.id} against {match.team1 if match.team1 != match.winner else match.team2} "
                    f"on a {match.format} match score. {next_round_msg}{elimination_msg}")
        
    def check_and_advance_round(self):
        # Check if all matches this round have concluded
        if not all(match.winner for match in self.current_round_matches):
            # Not all matches have concluded, so do nothing
            return None

        # Prepare for the next round
        self.teams = [match.winner for match in self.current_round_matches]  # Update teams for next round
        self.current_round_matches.clear()  # Clear current round matches for the next round

        # If only one team is left, declare them the tournament winner
        if len(self.teams) == 1:
            self.winner = self.teams[0]
            return f"🏆 Congratulations to {self.winner}, the tournament champions!"

        # Else, generate matches for the next round
        return self.generate_matches()




        # Optionally, progress tournament based on this result
        # This could involve checking if the current round is complete and generating new matches for the next round