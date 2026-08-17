UPDATE tournaments
SET game = 'Counter-Strike 2'
WHERE LOWER(TRIM(game)) IN ('cs:go', 'csgo', 'counter-strike: global offensive');
