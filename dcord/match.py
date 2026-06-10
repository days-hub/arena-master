class Match:
    _last_id = 0  # Class variable to track the last used ID

    @staticmethod
    def _generate_id():
        Match._last_id += 1
        return Match._last_id
    
    # In match.py, update the Match class's is_final method
    def is_final(self, tournament):
        # A match is final if, after its conclusion, only one team will remain.
        return len(tournament.teams) - len(tournament.current_round_matches) + 1 == 1



    def __init__(self, team1, team2, match_id, game=None, format='bo1'):
        self.id = match_id
        self.team1 = team1
        self.team2 = team2
        self.game = game
        self.format = format
        self.submatches = []  # Store submatch winners here
        self.winner = None

    def add_submatch_result(self, winning_team):
        self.submatches.append(winning_team)
        self.check_overall_winner()

    def check_overall_winner(self):
        team1_wins = self.submatches.count(self.team1)
        team2_wins = self.submatches.count(self.team2)
        needed_wins = {'bo1': 1, 'bo3': 2, 'bo5': 3, 'bo7': 4}[self.format]

        if team1_wins >= needed_wins:
            self.winner = self.team1
        elif team2_wins >= needed_wins:
            self.winner = self.team2