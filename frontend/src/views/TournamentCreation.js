// Import useEffect, useState from 'react', and axios
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Box, TextField, Select, MenuItem, FormControl, InputLabel, RadioGroup, FormControlLabel, Radio, Button, Typography, List, ListItem, ListItemText } from '@mui/material';
import { createTournament, fetchTournaments, deleteTournament } from '../api/apiClient';
const BASE_URL = 'http://localhost:8000/api';
const TournamentCreation = () => {
  // Existing state variables
  const [tournamentName, setTournamentName] = useState('');
  const [games, setGames] = useState([]);
  const [game, setGame] = useState('');
  const [format, setFormat] = useState('bo1');
  const [tournaments, setTournaments] = useState([]);

  useEffect(() => {
    const fetchGames = async () => {
        try {
            const response = await axios.get(`${BASE_URL}/games`); // Corrected path
            setGames(response.data);
        } catch (error) {
            console.error('Failed to fetch games:', error);
        }
    };

    fetchGames();
 }, [])

 // New useEffect for tournaments
 useEffect(() => {
    const fetchAndSetTournaments = async () => {
      const fetchedTournaments = await fetchTournaments();
      setTournaments(fetchedTournaments.data);
    };
    fetchAndSetTournaments();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const tournamentData = { name: tournamentName, game, format };
      await createTournament(tournamentData);
      alert('Tournament created successfully!');
  
      // Refresh tournament list
      const fetchedTournaments = await fetchTournaments();
      setTournaments(fetchedTournaments.data);
    } catch (error) {
      console.error('Failed to create tournament:', error);
      alert('Failed to create tournament. Please try again.');
    }
  };
  const handleDelete = async (tournamentId) => {
    try {
        await deleteTournament(tournamentId);
        alert('Tournament deleted successfully!');

        // Update the tournament list (remove deleted tournament)
        setTournaments(tournaments.filter((tournament) => tournament.id !== tournamentId));

    } catch (error) {
        console.error('Failed to delete tournament:', error);
        alert('Failed to delete tournament. Please try again.');
    }
};
  return (
    <form onSubmit={handleSubmit}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '800px', margin: '0 auto' }}>
        {/* Tournament Name Input */}
        <TextField
          label="Tournament Name"
          variant="outlined"
          fullWidth
          value={tournamentName}
          onChange={(event) => setTournamentName(event.target.value)}
        />
        {/* Games Select Input */}
        <FormControl fullWidth>
          <InputLabel>Game</InputLabel>
          <Select
            label="Game"
            value={game}
            onChange={(event) => setGame(event.target.value)}
          >
            {games.map((game) => (
              <MenuItem key={game} value={game}>{game}</MenuItem> 
            ))}
          </Select>
        </FormControl>
        {/* Format Radio Buttons */}
        <FormControl component="fieldset">
          <RadioGroup row value={format} onChange={(event) => setFormat(event.target.value)}>
            <FormControlLabel value="bo1" control={<Radio />} label="BO1" />
            <FormControlLabel value="bo3" control={<Radio />} label="BO3" />
            <FormControlLabel value="bo5" control={<Radio />} label="BO5" />
          </RadioGroup>
        </FormControl>
        {/* Submit Button */}
        <Button type="submit" variant="contained" color="primary" size="large" width="50">
          Create Tournament
        </Button>
        <Typography variant="h6">Created Tournaments</Typography>
        <List>
          {tournaments.map((tournament) => (
            <ListItem key={tournament.id}>
              {/* 'game' property matches the icon filename */}
              <img 
                // Randomized icon selection
                src={`/Images/game-icons/default_${Math.floor(Math.random() * 3) + 1}.png`} 
                alt="Tournament Icon"  
                style={{ width: '30px', height: '30px', borderRadius: '50%', marginRight: '10px' }}
        /> 

              <ListItemText 
                    primary={tournament.name} 
                    secondary={`Format: ${tournament.format}, Game: ${tournament.game}`} 
              />
              <Button 
                variant="outlined" 
                color="error" 
                onClick={() => handleDelete(tournament.id)}
            >
                Delete
            </Button>
      </ListItem>
   ))}
</List>
      </Box>
    </form>
  );
};

export default TournamentCreation;
