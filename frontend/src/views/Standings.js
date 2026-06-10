import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TableSortLabel, Paper, Chip, Alert,
} from '@mui/material';
import { EmojiEvents } from '@mui/icons-material';
import { fetchStandings } from '../api/apiClient';

// All-time team standings aggregated across every tournament: titles,
// match record (decided matches), game record, and game win rate.
const COLUMNS = [
  { id: 'team', label: 'Team', numeric: false },
  { id: 'titles', label: 'Titles', numeric: true },
  { id: 'match_wins', label: 'Match W', numeric: true },
  { id: 'match_losses', label: 'Match L', numeric: true },
  { id: 'game_wins', label: 'Game W', numeric: true },
  { id: 'game_losses', label: 'Game L', numeric: true },
  { id: 'game_win_pct', label: 'Game Win %', numeric: true },
];

const Standings = () => {
  const [rows, setRows] = useState([]);
  const [orderBy, setOrderBy] = useState('titles');
  const [order, setOrder] = useState('desc');
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetchStandings();
        const withPct = (response.data || []).map((r) => {
          const games = r.game_wins + r.game_losses;
          return { ...r, game_win_pct: games > 0 ? (r.game_wins / games) * 100 : 0 };
        });
        setRows(withPct);
      } catch (e) {
        console.error('Failed to fetch standings:', e);
        setError('Could not load standings. Is the backend running?');
      }
    };
    load();
  }, []);

  const handleSort = (columnId) => {
    if (orderBy === columnId) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setOrderBy(columnId);
      setOrder(columnId === 'team' ? 'asc' : 'desc');
    }
  };

  const sorted = [...rows].sort((a, b) => {
    const va = a[orderBy];
    const vb = b[orderBy];
    const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
    return order === 'asc' ? cmp : -cmp;
  });

  return (
    <Box sx={{ maxWidth: '900px', margin: '0 auto' }}>
      <Typography variant="h5" sx={{ mb: 0.5 }}>Standings</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        All-time records across every tournament. Match record counts decided
        matches; game record counts every recorded game.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {COLUMNS.map((col) => (
                <TableCell
                  key={col.id}
                  align={col.numeric ? 'right' : 'left'}
                  sortDirection={orderBy === col.id ? order : false}
                >
                  <TableSortLabel
                    active={orderBy === col.id}
                    direction={orderBy === col.id ? order : 'desc'}
                    onClick={() => handleSort(col.id)}
                  >
                    {col.label}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.map((row) => (
              <TableRow key={row.team} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {row.team}
                    {row.titles > 0 && (
                      <Chip
                        icon={<EmojiEvents />}
                        label={row.titles}
                        size="small"
                        color="warning"
                        variant="outlined"
                      />
                    )}
                  </Box>
                </TableCell>
                <TableCell align="right">{row.titles}</TableCell>
                <TableCell align="right">{row.match_wins}</TableCell>
                <TableCell align="right">{row.match_losses}</TableCell>
                <TableCell align="right">{row.game_wins}</TableCell>
                <TableCell align="right">{row.game_losses}</TableCell>
                <TableCell align="right">
                  {row.game_wins + row.game_losses > 0 ? `${row.game_win_pct.toFixed(1)}%` : '—'}
                </TableCell>
              </TableRow>
            ))}
            {sorted.length === 0 && !error && (
              <TableRow>
                <TableCell colSpan={COLUMNS.length} align="center">
                  No results recorded yet — finish some matches and check back.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default Standings;
