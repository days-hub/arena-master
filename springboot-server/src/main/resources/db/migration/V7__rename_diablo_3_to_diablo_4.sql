UPDATE tournaments
SET game = 'Diablo IV'
WHERE LOWER(TRIM(game)) IN ('diablo iii', 'diablo 3', 'd3');
