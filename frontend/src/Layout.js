import React from 'react';
import { Box, Tabs, Tab } from '@mui/material';
import { Home as HomeIcon, Create, Group, AccountTree, Leaderboard } from '@mui/icons-material';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import Home from './views/Home';
import TournamentCreation from './views/TournamentCreation';
import TeamRegistration from './views/TeamRegistration';
import TournamentBracket from './views/TournamentBracket';
import Standings from './views/Standings';

const NAV = [
  { label: 'Home', icon: <HomeIcon />, to: '/' },
  { label: 'Tournament Creation', icon: <Create />, to: '/create-tournament' },
  { label: 'Team Registration', icon: <Group />, to: '/register-team' },
  { label: 'Tournament Bracket', icon: <AccountTree />, to: '/bracket' },
  { label: 'Standings', icon: <Leaderboard />, to: '/standings' },
];

const Layout = () => {
  const location = useLocation();
  // Highlight the tab whose route prefixes the current path (so deep links
  // like /bracket/My%20Cup still light up Tournament Bracket).
  const active =
    NAV.slice(1).find((n) => location.pathname.startsWith(n.to))?.to ||
    (location.pathname === '/' ? '/' : false);

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <Tabs
        orientation="vertical"
        variant="scrollable"
        value={active}
        TabIndicatorProps={{ sx: { left: 0, width: 4, backgroundColor: '#fff' } }}
        sx={{
          width: '210px',
          flexShrink: 0,
          backgroundColor: 'primary.dark',
          '& .MuiTab-root': {
            color: 'rgba(255,255,255,0.72)',
            textTransform: 'none',
            fontWeight: 500,
            alignItems: 'center',
            minHeight: 64,
          },
          '& .MuiTab-root.Mui-selected': {
            color: '#fff',
            backgroundColor: 'rgba(255,255,255,0.10)',
          },
        }}
      >
        {NAV.map((n) => (
          <Tab key={n.to} label={n.label} icon={n.icon} value={n.to} component={Link} to={n.to} />
        ))}
      </Tabs>
      <Box sx={{ flexGrow: 1, padding: '20px', overflow: 'auto' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create-tournament" element={<TournamentCreation />} />
          <Route path="/register-team" element={<TeamRegistration />} />
          <Route path="/bracket" element={<TournamentBracket />} />
          <Route path="/bracket/:tournamentName" element={<TournamentBracket />} />
          <Route path="/standings" element={<Standings />} />
        </Routes>
      </Box>
    </Box>
  );
};

export default Layout;
