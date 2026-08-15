import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Avatar, Box, Card, CardContent, Chip, Grid, InputAdornment,
  Paper, Skeleton, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TableSortLabel, TextField, Typography,
} from '@mui/material';
import {
  EmojiEventsRounded, Groups2Rounded, SearchRounded, SportsScoreRounded,
} from '@mui/icons-material';
import { fetchStandings, getApiErrorMessage } from '../api/apiClient';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import { AnimatedProgress, CountUp } from '../components/Motion';

const COLUMNS = [
  { id: 'rank', label: '#', numeric: true, sortable: false },
  { id: 'team', label: 'Team', numeric: false, sortable: true },
  { id: 'titles', label: 'Titles', numeric: true, sortable: true },
  { id: 'match_wins', label: 'Match W', numeric: true, sortable: true },
  { id: 'match_losses', label: 'Match L', numeric: true, sortable: true },
  { id: 'game_wins', label: 'Game W', numeric: true, sortable: true },
  { id: 'game_losses', label: 'Game L', numeric: true, sortable: true },
  { id: 'game_win_pct', label: 'Win rate', numeric: true, sortable: true },
];

const SummaryCard = ({ icon, value, label }) => (
  <Card><CardContent sx={{ p: 2.25, '&:last-child': { pb: 2.25 } }}><Stack direction="row" alignItems="center" spacing={1.5}>
    <Box sx={{ width: 40, height: 40, display: 'grid', placeItems: 'center', borderRadius: 2, color: 'primary.main', bgcolor: 'rgba(11,143,140,.09)' }}>{icon}</Box>
    <Box><Typography variant="h3"><CountUp value={value} /></Typography><Typography variant="caption" color="text.secondary">{label}</Typography></Box>
  </Stack></CardContent></Card>
);

const Standings = () => {
  const [rows, setRows] = useState([]);
  const [orderBy, setOrderBy] = useState('titles');
  const [order, setOrder] = useState('desc');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetchStandings();
        setRows((response.data || []).map((row) => {
          const games = row.game_wins + row.game_losses;
          return { ...row, game_win_pct: games > 0 ? (row.game_wins / games) * 100 : 0 };
        }));
      } catch (requestError) {
        setError(getApiErrorMessage(requestError, 'Standings could not be loaded.'));
      } finally { setLoading(false); }
    };
    load();
  }, []);

  const visibleRows = useMemo(() => [...rows]
    .filter((row) => row.team.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => {
      const first = a[orderBy];
      const second = b[orderBy];
      const comparison = typeof first === 'string' ? first.localeCompare(second) : first - second;
      return order === 'asc' ? comparison : -comparison;
    }), [rows, query, order, orderBy]);

  const handleSort = (column) => {
    if (!column.sortable) return;
    if (orderBy === column.id) setOrder((current) => current === 'asc' ? 'desc' : 'asc');
    else {
      setOrderBy(column.id);
      setOrder(column.id === 'team' ? 'asc' : 'desc');
    }
  };

  const totalMatches = rows.reduce((sum, row) => sum + row.match_wins, 0);
  const totalTitles = rows.reduce((sum, row) => sum + row.titles, 0);
  const leader = [...rows].sort((a, b) => b.titles - a.titles || b.match_wins - a.match_wins)[0];

  return (
    <Box>
      <PageHeader eyebrow="Competition history" title="All-time standings"
        description="Compare titles, match records, and individual game performance across every completed and active tournament." />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}><SummaryCard icon={<Groups2Rounded />} value={rows.length} label="Ranked teams" /></Grid>
        <Grid item xs={12} sm={4}><SummaryCard icon={<SportsScoreRounded />} value={totalMatches} label="Decided matches" /></Grid>
        <Grid item xs={12} sm={4}><SummaryCard icon={<EmojiEventsRounded />} value={totalTitles} label={leader ? `${leader.team} leads the table` : 'Tournament titles'} /></Grid>
      </Grid>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={2} sx={{ px: { xs: 2, sm: 2.5 }, py: 2 }}>
          <Box><Typography variant="h3">Leaderboard</Typography><Typography variant="body2" color="text.secondary">Select a heading to reorder the table.</Typography></Box>
          <TextField size="small" placeholder="Search teams" value={query} onChange={(event) => setQuery(event.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small" /></InputAdornment> }} sx={{ width: { sm: 250 } }} />
        </Stack>

        {loading ? <Box sx={{ p: 2 }}><Skeleton height={48} /><Skeleton height={48} /><Skeleton height={48} /></Box> : visibleRows.length ? (
          <TableContainer>
            <Table sx={{ minWidth: 800 }}>
              <TableHead><TableRow>{COLUMNS.map((column) => (
                <TableCell key={column.id} align={column.numeric ? 'right' : 'left'} sortDirection={orderBy === column.id ? order : false} sx={column.id === 'team' ? { minWidth: 220 } : {}}>
                  {column.sortable ? <TableSortLabel active={orderBy === column.id} direction={orderBy === column.id ? order : 'desc'} onClick={() => handleSort(column)}>{column.label}</TableSortLabel> : column.label}
                </TableCell>
              ))}</TableRow></TableHead>
              <TableBody>
                {visibleRows.map((row, index) => (
                  <TableRow key={row.team} hover className="arena-stagger-in" sx={{ '--stagger-index': Math.min(index, 8), '&:last-child td': { border: 0 } }}>
                    <TableCell align="right"><Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>{index + 1}</Typography></TableCell>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1.25}>
                        <Avatar sx={{ width: 34, height: 34, bgcolor: index < 3 ? 'secondary.main' : '#DDE7E6', color: index < 3 ? 'white' : 'text.primary', fontSize: 12, fontWeight: 800 }}>{row.team.slice(0, 2).toUpperCase()}</Avatar>
                        <Typography sx={{ fontWeight: 700 }}>{row.team}</Typography>
                        {row.titles > 0 && <Chip className={index === 0 ? 'arena-trophy-chip' : ''} icon={<EmojiEventsRounded />} label={row.titles} size="small" color="warning" variant="outlined" />}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">{row.titles}</TableCell>
                    <TableCell align="right" sx={{ color: 'success.dark', fontWeight: 700 }}>{row.match_wins}</TableCell>
                    <TableCell align="right">{row.match_losses}</TableCell>
                    <TableCell align="right">{row.game_wins}</TableCell>
                    <TableCell align="right">{row.game_losses}</TableCell>
                    <TableCell align="right">
                      {row.game_wins + row.game_losses > 0 ? <Box sx={{ minWidth: 88 }}><Typography variant="body2" sx={{ fontWeight: 700 }}>{row.game_win_pct.toFixed(1)}%</Typography><AnimatedProgress value={row.game_win_pct} sx={{ mt: 0.5, height: 4 }} /></Box> : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : <Box sx={{ p: 2 }}><EmptyState compact icon={<SportsScoreRounded />} title={query ? 'No matching teams' : 'No results yet'} description={query ? 'Try a different team name.' : 'Recorded tournament results will build this leaderboard automatically.'} /></Box>}
      </Paper>
    </Box>
  );
};

export default Standings;
